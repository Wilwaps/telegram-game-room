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

router.post('/register-simple', (req, res) => {
  try {
    const { name, email, confirmEmail, password, confirmPassword, telegramId } = req.body || {};
    const nm = String(name || '').trim();
    const e1 = String(email || '').trim();
    const e2 = String(confirmEmail || '').trim();
    const p1 = String(password || '');
    const p2 = String(confirmPassword || '');
    if (!e1 || !p1) return res.status(400).json({ success: false, error: 'invalid_params' });
    if (e1.toLowerCase() !== e2.toLowerCase()) return res.status(400).json({ success: false, error: 'mismatch_email' });
    if (p1 !== p2) return res.status(400).json({ success: false, error: 'mismatch_password' });
    const created = auth.createEmailUser({ name: nm || e1, email: e1, password: p1 });
    created.verified = true;
    try { auth.usersByEmail.set(created.email, created); } catch(_){}
    try { store.setUserContact({ userId: created.internalId, email: created.email, telegramId: telegramId ? String(telegramId).trim() : undefined }); } catch (_) {}
    return res.json({ success: true, userId: created.internalId });
  } catch (err) {
    const msg = (err && err.message) || 'register_error';
    const code = (msg === 'invalid_params' || msg === 'email_exists' || msg === 'mismatch_email' || msg === 'mismatch_password') ? 400 : 500;
    return res.status(code).json({ success: false, error: msg });
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
    // Para Telegram WebApp, el secreto es HMAC_SHA256(bot_token) con clave fija 'WebAppData'
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
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
    if (!token) {
      return res.status(500).json({ success: false, error: 'telegram_token_missing' });
    }
    const rawInit = String(initData || '');
    if (!rawInit) {
      return res.status(400).json({ success: false, error: 'no_init_data' });
    }
    const allowUnverified = String(process.env.ALLOW_UNVERIFIED_TG_INIT || '').toLowerCase() === 'true';
    let parsed = null;
    if (allowUnverified) {
      try {
        const qs = new URLSearchParams(rawInit);
        const userStr = qs.get('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          parsed = { user, authDate: Number(qs.get('auth_date') || 0) };
        }
      } catch (_) { /* ignore */ }
    }
    if (!parsed) {
      parsed = verifyTelegramInitData(rawInit, token);
    }
    if (!parsed || !parsed.user || !parsed.user.id) {
      const qs = new URLSearchParams(rawInit);
      const hasUser = !!qs.get('user');
      const authDate = qs.get('auth_date') || '';
      return res.status(400).json({ success: false, error: 'invalid_telegram_data', reason: 'hash_mismatch_or_malformed', hasUser, authDatePresent: !!authDate, initLen: rawInit.length, allowUnverified });
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

// Debug: estado de email (existe / verificado)
router.get('/debug-email', (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ success:false, error:'invalid_email' });
    const rec = auth.getUserByEmail(email);
    if (!rec) return res.json({ success:true, exists:false, verified:false });
    return res.json({ success:true, exists:true, verified: !!rec.verified, internalId: rec.internalId });
  } catch (err) {
    res.status(500).json({ success:false, error:'debug_email_error' });
  }
});

// Admin: forzar verificación de email (uso temporal para QA)
router.post('/force-verify', (req, res) => {
  try {
    const { email } = req.body || {};
    const e = String(email || '').trim();
    if (!e) return res.status(400).json({ success:false, error:'invalid_email' });
    const rec = auth.getUserByEmail(e);
    if (!rec) return res.status(404).json({ success:false, error:'user_not_found' });
    rec.verified = true;
    try { auth.usersByEmail.set(rec.email, rec); } catch(_){}
    try { store.setUserContact({ userId: rec.internalId, email: rec.email }); } catch(_){}
    return res.json({ success:true, verified: true, internalId: rec.internalId });
  } catch (err) {
    res.status(500).json({ success:false, error:'force_verify_error' });
  }
});

// Diagnóstico de Telegram WebApp initData (sin exponer datos sensibles)
router.post('/debug-telegram-init', (req, res) => {
  try {
    const { initData } = req.body || {};
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const tokenLoaded = !!token;
    const raw = String(initData || '');
    const base = { success: true, tokenLoaded, initPresent: !!raw, initLen: raw.length };
    if (!raw) return res.json({ ...base, error: 'no_init_data' });

    const qs = new URLSearchParams(raw);
    const keys = Array.from(qs.keys());
    const userStr = qs.get('user');
    const authDateStr = qs.get('auth_date') || '';
    let userId = null, username = null;
    try { if (userStr) { const u = JSON.parse(userStr); userId = String(u.id || ''); username = u.username || null; } } catch (_) {}

    // Validación de firma si hay token
    let hashValid = null; let reason = null;
    if (tokenLoaded) {
      try {
        const params = new URLSearchParams(raw);
        const hash = params.get('hash') || '';
        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        hashValid = (hmac === hash);
        if (!hashValid) reason = 'hash_mismatch';
      } catch (_) { hashValid = false; reason = 'verify_exception'; }
    } else {
      reason = 'telegram_token_missing';
    }

    const maskedUserId = userId ? (userId.length <= 4 ? '****' : (userId.slice(0,2) + '***' + userId.slice(-2))) : null;
    const skewSec = authDateStr ? Math.floor(Date.now()/1000 - Number(authDateStr)) : null;
    return res.json({
      ...base,
      keys,
      hasUser: !!userStr,
      authDatePresent: !!authDateStr,
      username,
      userIdMasked: maskedUserId,
      hashValid,
      reason,
      skewSec,
      now: Date.now()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'debug_error' });
  }
});

module.exports = router;
