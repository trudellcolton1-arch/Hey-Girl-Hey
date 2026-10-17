/**
 * POST /api/panic
 * Receives a panic alert from the home page button and notifies the on-call
 * team by SMS (Twilio) and email (Resend). Zero dependencies.
 *
 * Env vars (set in Vercel → Project → Settings → Environment Variables):
 *   PANIC_ENABLED            "true" to enable. Anything else returns 503.
 *   ALERT_SMS_TO             Comma-separated E.164 numbers, e.g. +12145551234,+18175559876
 *   TWILIO_ACCOUNT_SID       Twilio credentials
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM              Your Twilio number (E.164) or Messaging Service SID (MG...)
 *   ALERT_EMAIL_TO           Comma-separated emails
 *   RESEND_API_KEY           Resend credentials (domain hghey.org must be verified in Resend)
 *   ALERT_EMAIL_FROM         e.g. "HEY GIRL Alerts <alerts@hghey.org>"
 *   UPSTASH_REDIS_REST_URL   Optional. Durable rate limiting + 24h audit log.
 *   UPSTASH_REDIS_REST_TOKEN
 *   ALLOWED_ORIGINS          Optional. Comma-separated. Defaults to hghey.org + *.vercel.app
 */

const LIMITS = { perIpPer10Min: 3, globalPerHour: 30 };
const mem = { ip: new Map(), global: [] };

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function originAllowed(req) {
  const origin = req.headers.origin || '';
  const list = (process.env.ALLOWED_ORIGINS || 'https://hghey.org,https://www.hghey.org')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  try { return new URL(origin).hostname.endsWith('.vercel.app'); } catch { return false; }
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

async function upstash(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  return j.result;
}

async function rateLimited(ip) {
  const now = Date.now();
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const ipKey = `panic:ip:${ip}`, gKey = 'panic:global';
    const ipCount = await upstash(['INCR', ipKey]);
    if (ipCount === 1) await upstash(['EXPIRE', ipKey, 600]);
    const gCount = await upstash(['INCR', gKey]);
    if (gCount === 1) await upstash(['EXPIRE', gKey, 3600]);
    return ipCount > LIMITS.perIpPer10Min || gCount > LIMITS.globalPerHour;
  }
  // In-memory fallback (per warm instance). Good enough to stop a casual spam loop.
  const ipHits = (mem.ip.get(ip) || []).filter(t => now - t < 600_000);
  mem.global = mem.global.filter(t => now - t < 3_600_000);
  if (ipHits.length >= LIMITS.perIpPer10Min || mem.global.length >= LIMITS.globalPerHour) return true;
  ipHits.push(now); mem.ip.set(ip, ipHits); mem.global.push(now);
  return false;
}

function buildMessage(a) {
  const when = new Date(a.ts).toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const loc = a.lat != null
    ? `Location: https://maps.google.com/?q=${a.lat},${a.lng} (±${Math.round(a.accuracy || 0)}m)`
    : 'Location: NOT AVAILABLE (permission denied or no GPS)';
  const who = a.name ? `Name: ${a.name}\n` : '';
  const phone = a.phone ? `Phone: ${a.phone}\n` : '';
  const note = a.note ? `Note: ${a.note}\n` : '';
  return `HEY GIRL PANIC ALERT\n${when} CT\n${who}${phone}${loc}\n${note}Call 911 if there is immediate danger. Do not approach alone.\nAlert ID ${a.id}`;
}

async function sendSms(text) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  const to = (process.env.ALERT_SMS_TO || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!sid || !tok || !from || !to.length) return { sent: 0, skipped: true };
  const auth = Buffer.from(`${sid}:${tok}`).toString('base64');
  const results = await Promise.allSettled(to.map(async num => {
    const body = new URLSearchParams({ To: num, Body: text });
    body.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body
    });
    if (!r.ok) throw new Error(`twilio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }));
  const failed = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
  return { sent: results.length - failed.length, failed };
}

async function sendEmail(text, a) {
  const key = process.env.RESEND_API_KEY, from = process.env.ALERT_EMAIL_FROM;
  const to = (process.env.ALERT_EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!key || !from || !to.length) return { sent: 0, skipped: true };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: `🚨 PANIC ALERT ${a.lat != null ? 'with location' : '(no location)'} — ${a.id}`, text })
  });
  if (!r.ok) return { sent: 0, failed: [`resend ${r.status}: ${(await r.text()).slice(0, 200)}`] };
  return { sent: to.length };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method === 'GET') {
    // Health: which channels are configured. Booleans only, never values.
    return json(res, 200, {
      enabled: process.env.PANIC_ENABLED === 'true',
      sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM && process.env.ALERT_SMS_TO),
      email: !!(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_FROM && process.env.ALERT_EMAIL_TO),
      ratelimit: process.env.UPSTASH_REDIS_REST_URL ? 'durable' : 'memory'
    });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method' });
  if (process.env.PANIC_ENABLED !== 'true') return json(res, 503, { ok: false, error: 'disabled' });
  if (!originAllowed(req)) return json(res, 403, { ok: false, error: 'origin' });

  const ip = clientIp(req);
  if (await rateLimited(ip)) return json(res, 429, { ok: false, error: 'rate' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  if (b.website) return json(res, 200, { ok: true, id: 'hp' }); // honeypot

  const lat = Number.isFinite(+b.lat) ? +b.lat : null;
  const lng = Number.isFinite(+b.lng) ? +b.lng : null;
  const alert = {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    ts: Date.now(),
    lat: lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? lat : null,
    lng: lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? lng : null,
    accuracy: Number.isFinite(+b.accuracy) ? +b.accuracy : null,
    name: String(b.name || '').slice(0, 60),
    phone: String(b.phone || '').slice(0, 30),
    note: String(b.note || '').slice(0, 300),
    ua: String(req.headers['user-agent'] || '').slice(0, 120)
  };

  const text = buildMessage(alert);
  const [sms, email] = await Promise.all([sendSms(text), sendEmail(text, alert)]);
  const delivered = (sms.sent || 0) + (email.sent || 0);

  // Minimal 24h audit log (no IP, no user agent beyond the record)
  try { await upstash(['SET', `panic:log:${alert.id}`, JSON.stringify({ ...alert, sms, email }), 'EX', 86400]); } catch {}
  console.log(JSON.stringify({ event: 'panic', id: alert.id, hasLocation: alert.lat != null, sms, email }));

  if (!delivered) return json(res, 502, { ok: false, error: 'undelivered', id: alert.id, sms, email });
  return json(res, 200, { ok: true, id: alert.id, sms: sms.sent, email: email.sent });
};
