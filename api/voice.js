/**
 * TeXML endpoint for outbound alert calls. Telnyx fetches this when the callee answers
 * and speaks the returned <Say> content. Also receives status callbacks (ignored, 200).
 * Query: id, name, loc (1/0). No PII beyond what the alert already carries.
 */
function esc(s) { return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])); }

module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://x');
  if (url.searchParams.get('status')) { res.statusCode = 200; return res.end('ok'); }
  const id = esc(url.searchParams.get('id') || '');
  const name = esc(url.searchParams.get('name') || '');
  const hasLoc = url.searchParams.get('loc') === '1';
  const isTest = /^test/i.test(name);
  const who = name && !isTest ? ` from ${name}` : '';
  const where = hasLoc ? 'Her location is in the alert text and email.' : 'Her location was not available. Check the alert for details.';
  const line = isTest
    ? `This is a test of the Hey Girl emergency alert system. No action is needed. When a girl presses the panic button, this phone will ring and you will hear her name and alert details. Alert I D ${id.split('').join(' ')}. This was only a test.`
    : `This is a Hey Girl emergency alert${who}. A girl has pressed the panic button. ${where} Please check your messages now. Alert I D ${id.split('').join(' ')}. If there is immediate danger, call 9 1 1.`;
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
