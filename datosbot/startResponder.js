const https = require('https');
const { URL } = require('url');

function buildSummary(from) {
  try {
    if (!from) return null;
    const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
    const lines = [
      'Registro completado.',
      `ID: ${from.id}`,
      `Username: ${from.username || 'None'}`,
      `Nombre: ${fullName || 'None'}`,
      `Premium: ${from.is_premium ? 'Sí' : 'None'}`,
      `Idioma: ${from.language_code || 'None'}`
    ];
    return lines.join('\n');
  } catch (_) {
    return null;
  }
}

function postJSON(urlStr, data) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const body = Buffer.from(JSON.stringify(data));
      const opts = {
        method: 'POST',
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length
        }
      };
      const req = https.request(opts, (resp) => {
        resp.on('data', () => {});
        resp.on('end', resolve);
      });
      req.on('error', () => resolve());
      req.write(body);
      req.end();
    } catch (_) {
      resolve();
    }
  });
}

async function handleStart({ token, message, chat, from }) {
  try {
    if (!token || !message || !chat || !from) return false;
    if (!message.text || !/^\s*\/start(\s|$)/i.test(String(message.text))) return false;
    const summary = buildSummary(from);
    if (!summary) return false;
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await postJSON(apiUrl, {
      chat_id: chat.id,
      text: summary
    });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { handleStart };
