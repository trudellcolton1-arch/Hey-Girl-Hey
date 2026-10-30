/**
 * TeXML endpoint for outbound alert calls.
 *  - default: speak the alert, ask the listener to press 1 to confirm
 *  - ?ack=1: Gather result. Digit 1 = confirmed. Anything else = redial.
 *  - ?noack=1: Gather timed out (voicemail or unattended). Redial.
 *  - ?status=1: Telnyx status callback. Redial on no-answer/busy/failed.
 */
function esc(s) { return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])); }

async function readForm(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) { raw = await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); req.on('error', () => r('')); }); }
  return Object.fromEntries(new URLSearchParams(raw));
}

function xml(res, inner) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${inner}</Response>`);
}

function alertFromQuery(q) {
  return { id: q.get('id') || '', name: q.get('name') || '', lat: q.get('loc') === '1' ? 0 : null };
}

async function redial(q, reason) {
  const { placeCall, MAX_CALL_ATTEMPTS } = require('./panic.js');
  const attempt = parseInt(q.get('attempt') || '1', 10);
  const to = q.get('to');
  console.log(JSON.stringify({ event: 'call_redial_check', id: q.get('id'), to, attempt, reason }));
  if (to && attempt < MAX_CALL_ATTEMPTS) await placeCall(to, alertFromQuery(q), attempt + 1);
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://x');
  const q = url.searchParams;

  if (q.get('status')) {
    res.statusCode = 200; res.end('ok');
    try {
      const form = await readForm(req);
      const callStatus = String(form.CallStatus || '').toLowerCase();
      if (['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) await redial(q, callStatus);
    } catch (e) { console.log(JSON.stringify({ event: 'call_status_error', error: String(e).slice(0, 200) })); }
    return;
  }

  if (q.get('ack')) {
    const form = await readForm(req).catch(() => ({}));
    const digits = String(form.Digits || '').trim();
    if (digits === '1') {
      console.log(JSON.stringify({ event: 'call_ack', id: q.get('id'), to: q.get('to') }));
      return xml(res, `<Say voice="Polly.Joanna">Thank you. Alert confirmed. Go now.</Say><Hangup/>`);
    }
    await redial(q, 'wrong-digit').catch(() => {});
    return xml(res, `<Say voice="Polly.Joanna">No confirmation received. We will call again.</Say><Hangup/>`);
  }

  if (q.get('noack')) {
    await redial(q, 'no-input').catch(() => {});
    return xml(res, `<Hangup/>`);
  }

  // Main script
  const id = esc(q.get('id') || '');
  const name = esc(q.get('name') || '');
  const hasLoc = q.get('loc') === '1';
  const attempt = parseInt(q.get('attempt') || '1', 10);
  const isTest = /^test/i.test(name);
  const who = name && !isTest ? ` from ${name}` : '';
  const again = attempt > 1 ? ` This is call number ${attempt}.` : '';
  const where = hasLoc ? 'Her location is in the alert text and email.' : 'Her location was not available. Check the alert for details.';
  const line = isTest
    ? `Hey Girl test. This is only a test of the emergency alert line.${again}`
    : `Hey Girl emergency${who}. A girl pressed the panic button. Check your texts and email now for her location.${again}`;
  const detail = isTest ? '' : ` ${where} Alert I D ${id.split('').join(' ')}. If there is immediate danger, call 9 1 1.`;
  const carry = new URLSearchParams({ id: q.get('id') || '', name: q.get('name') || '', loc: hasLoc ? '1' : '0', attempt: String(attempt), to: q.get('to') || '' });
  const ackUrl = esc(`/api/voice?ack=1&${carry}`);
  const noackUrl = esc(`/api/voice?noack=1&${carry}`);
  return xml(res, `
  <Gather action="${ackUrl}" method="POST" numDigits="1" timeout="6">
    <Say voice="Polly.Joanna">${line} Press 1 to confirm you got this.</Say>
    <Say voice="Polly.Joanna">${line}${detail} Press 1 now to confirm.</Say>
  </Gather>
  <Say voice="Polly.Joanna">No confirmation received. We will call again.</Say>
  <Redirect method="POST">${noackUrl}</Redirect>
`);
};
