const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const auth = require('../services/authStore');
const store = require('../services/memoryStore');

function setSessionCookie(res, sid) {
  const maxAge = 30 * 24 * 3600; // 30 días
  const cookie = [`sid=${sid}`, 'Path=/', 'HttpOnly', 'SameSite=None', 'Secure', `Max-Age=${maxAge}`].join('; ');
  res.setHeader('Set-Cookie', cookie);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', ['sid=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0']);
}
function getSidFromReq(req) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(/;\s*/)) {
    const [k, v] = part.split('=');
    if (k === 'sid') return v;
  }
  return '';
}

// Registro con email (crea usuario y emite código)
router.post('/register-email', (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const rec = auth.createEmailUser({ name, email, password });
    const { code, expiresAt } = auth.issueEmailCode(email);
    // TODO: Integrar envío real de email vía SMTP (nodemailer) cuando se configure
    res.json({ success: true, email: rec.email, expiresAt });
  } catch (err) {
    const msg = (err && err.message) || 'register_error';
    const code = (msg === 'invalid_params' || msg === 'email_exists') ? 400 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// Verificación de email con código
router.post('/verify-email', (req, res) => {
  try {
    const { email, code } = req.body || {};
    const out = auth.verifyEmail({ email, code });
    res.json({ success: true, ...out });
  } catch (err) {
    const msg = (err && err.message) || 'verify_error';
    const code = (msg === 'invalid_code' || msg === 'code_expired' || msg === 'user_not_found') ? 400 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// Reenviar código de verificación por email
router.post('/resend-code', (req, res) => {
  try {
    const { email } = req.body || {};
    const out = auth.issueEmailCode(email);
    res.json({ success: true, expiresAt: out.expiresAt });
  } catch (err) {
    const msg = (err && err.message) || 'resend_error';
    const code = (msg === 'user_not_found') ? 404 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// Login con email
router.post('/login-email', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const { sid, userId } = auth.loginWithEmail({ email, password, ua: String(req.headers['user-agent'] || '') });
    setSessionCookie(res, sid);
    res.json({ success: true, sid, userId });
  } catch (err) {
    const msg = (err && err.message) || 'login_error';
    const code = (msg === 'user_not_found' || msg === 'email_not_verified' || msg === 'invalid_credentials') ? 403 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// Vincular email con Telegram ID (fusiona cuentas)
router.post('/link-telegram', (req, res) => {
  try {
    const { email, telegramId } = req.body || {};
    const out = auth.linkTelegram({ email, telegramId });
    res.json({ success: true, ...out });
  } catch (err) {
    const msg = (err && err.message) || 'link_error';
    const code = (msg === 'invalid_params' || msg === 'user_not_found') ? 400 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// Utilidad: verificar initData de Telegram WebApp
function verifyTelegramInitData(initData, botToken) {
  try {
    if (!initData || !botToken) return null;
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (hmac !== hash) return null;
    const userStr = urlParams.get('user');
    const authDate = Number(urlParams.get('auth_date') || 0);
    if (!userStr || !authDate) return null;
    const user = JSON.parse(userStr);
    return { user, authDate };
  } catch (_) { return null; }
}

// Login con Telegram WebApp
router.post('/login-telegram', (req, res) => {
  try {
    const { initData } = req.body || {};
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const parsed = verifyTelegramInitData(String(initData || ''), token);
    if (!parsed || !parsed.user || !parsed.user.id) {
      return res.status(400).json({ success: false, error: 'invalid_telegram_data' });
    }
    const name = parsed.user.username || [parsed.user.first_name, parsed.user.last_name].filter(Boolean).join(' ');
    const tgUserId = 'tg:' + String(parsed.user.id);
    try {
      const raw = String(req.headers.cookie || '');
      let oldSid = '';
      for (const part of raw.split(/;\s*/)) { const [k, v] = part.split('='); if (k === 'sid') { oldSid = v; break; } }
      const sess = oldSid ? auth.getSession(oldSid) : null;
      if (sess && sess.userId && sess.userId !== tgUserId) {
        const cur = String(sess.userId);
        if (!cur.startsWith('tg:')) {
          try { store.mergeUsers({ primaryId: tgUserId, secondaryId: cur }); } catch (_) {}
        }
      }
    } catch (_) {}
    const { sid, userId } = auth.createSessionForTelegram({ telegramId: parsed.user.id, name, ua: String(req.headers['user-agent'] || '') });
    setSessionCookie(res, sid);
    res.json({ success: true, sid, userId });
  } catch (err) {
    res.status(500).json({ success: false, error: 'telegram_login_error' });
  }
});

// Estado de sesión actual
router.get('/me', (req, res) => {
  try {
    const sid = getSidFromReq(req);
    if (!sid) return res.status(401).json({ success: false, error: 'no_session' });
    const sess = auth.getSession(sid);
    if (!sess) return res.status(401).json({ success: false, error: 'invalid_session' });
    const u = store.getUser(sess.userId) || store.ensureUser(sess.userId);
    res.json({ success: true, user: { userId: u.userId, userName: u.userName, fires: u.fires || 0, coins: u.coins || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'me_error' });
  }
});

router.post('/logout', (req, res) => {
  try {
    const sid = getSidFromReq(req);
    if (sid) auth.destroySession(sid);
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'logout_error' });
  }
});

module.exports = router;
