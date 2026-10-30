/**
 * TeXML endpoint for outbound alert calls. Telnyx fetches this when the callee answers
 * and speaks the returned <Say> content. Also receives status callbacks (ignored, 200).
 * Query: id, name, loc (1/0). No PII beyond what the alert already carries.
 */
function esc(s) { return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])); }

async function readForm(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) { raw = await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); req.on('error', () => r('')); }); }
  return Object.fromEntries(new URLSearchParams(raw));
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://x');
  if (url.searchParams.get('status')) {
    // Telnyx status callback. Redial if nobody (human) answered.
    res.statusCode = 200; res.end('ok');
    try {
      const form = await readForm(req);
      const callStatus = String(form.CallStatus || '').toLowerCase();
      const answeredBy = String(form.AnsweredBy || '').toLowerCase();
      const attempt = parseInt(url.searchParams.get('attempt') || '1', 10);
      const to = url.searchParams.get('to');
      const human = callStatus === 'completed' && (!answeredBy || answeredBy === 'human');
      console.log(JSON.stringify({ event: 'call_status', id: url.searchParams.get('id'), to, attempt, callStatus, answeredBy, human }));
      const { placeCall, MAX_CALL_ATTEMPTS } = require('./panic.js');
      if (!human && to && attempt < MAX_CALL_ATTEMPTS) {
        const a = { id: url.searchParams.get('id') || '', name: url.searchParams.get('name') || '', lat: url.searchParams.get('loc') === '1' ? 0 : null };
        await placeCall(to, a, attempt + 1);
      }
    } catch (e) { console.log(JSON.stringify({ event: 'call_status_error', error: String(e).slice(0, 200) })); }
    return;
  }
  const id = esc(url.searchParams.get('id') || '');
  const name = esc(url.searchParams.get('name') || '');
  const hasLoc = url.searchParams.get('loc') === '1';
  const isTest = /^test/i.test(name);
  const attempt = parseInt(url.searchParams.get('attempt') || '1', 10);
  const again = attempt > 1 ? ' This is call number ' + attempt + '.' : '';
  const who = name && !isTest ? ` from ${name}` : '';
  const where = hasLoc ? 'Her location is in the alert text and email.' : 'Her location was not available. Check the alert for details.';
  const line = isTest
    ? `This is a test of the Hey Girl emergency alert system. No action is needed. When a girl presses the panic button, this phone will ring and you will hear her name and alert details. Alert I D ${id.split('').join(' ')}. This was only a test.`
    : `This is a Hey Girl emergency alert${who}.${again} A girl has pressed the panic button. ${where} Please check your messages now. Alert I D ${id.split('').join(' ')}. If there is immediate danger, call 9 1 1.`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">${line}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Repeating. ${line}</Say>
</Response>`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'no-store');
  res.end(xml);
};
