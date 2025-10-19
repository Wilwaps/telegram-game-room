const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const auth = require('../services/authStore');
const Sentry = require('@sentry/node');
const logger = require('../config/logger');
const store = require('../services/memoryStore');
let roles = null; try { roles = require('../services/roles'); } catch(_) { roles = { getRoles: ()=> ['general'] }; }
let userRepo = null; try { userRepo = require('../repos/userRepo'); } catch(_) { userRepo = null; }

function setSessionCookie(res, sid) {
  const maxAge = 30 * 24 * 3600; // 30 días
  const cookieStd = [`sid=${sid}`, 'Path=/', 'HttpOnly', 'SameSite=None', 'Secure', `Max-Age=${maxAge}`].join('; ');
  const cookiePart = [`sidp=${sid}`, 'Path=/', 'HttpOnly', 'SameSite=None', 'Secure', 'Partitioned', `Max-Age=${maxAge}`].join('; ');
  res.setHeader('Set-Cookie', [cookieStd, cookiePart]);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    'sid=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0',
    'sidp=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0'
  ]);
}
function getSidFromReq(req) {
  const raw = String(req.headers.cookie || '');
  let sid = '';
  let sidp = '';
  for (const part of raw.split(/;\s*/)) {
    const [k, v] = part.split('=');
    if (k === 'sid') sid = v;
    if (k === 'sidp') sidp = v;
  }
  // Fallbacks: cabecera x-session-id y query ?sid (útil para WebViews y QA)
  try { if (!sid && !sidp) { const h = String(req.headers['x-session-id'] || '').trim(); if (h) return h; } } catch(_) {}
  try { const qsid = String((req.query && req.query.sid) || '').trim(); if (qsid) return qsid; } catch(_) {}
  return sid || sidp || '';
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
    const signature = urlParams.get('signature');
    urlParams.delete('hash');
    if (signature) urlParams.delete('signature'); // excluir también 'signature' si viene
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    // Para Telegram WebApp, el secreto es HMAC_SHA256(bot_token) con clave fija 'WebAppData'
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    // timing-safe compare
    try {
      const a = Buffer.from(String(hmac), 'hex');
      const b = Buffer.from(String(hash||''), 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    } catch(_) { return null; }
    const userStr = urlParams.get('user');
    const authDate = Number(urlParams.get('auth_date') || 0);
    if (!userStr || !authDate) return null;
    const user = JSON.parse(userStr);
    return { user, authDate };
  } catch (_) { return null; }
}

function verifyTelegramWidgetData(dataObj, botToken) {
  try {
    if (!dataObj || !botToken) return null;
    const entries = Object.entries(dataObj).filter(([k]) => k !== 'hash');
    const dataCheckString = entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (hmac !== String(dataObj.hash || '')) return null;
    const u = dataObj || {};
    const user = { id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name };
    const authDate = Number(u.auth_date || 0);
    if (!user.id || !authDate) return null;
    return { user, authDate, hash: String(dataObj.hash || '') };
  } catch (_) { return null; }
}

// Login con Telegram WebApp
router.post('/login-telegram', (req, res) => {
  try {
    const { initData } = req.body || {};
    const rawInit = String(initData || '');
    if (!rawInit) {
      return res.status(400).json({ success: false, error: 'no_init_data' });
    }
    const allowUnverified = String(process.env.ALLOW_UNVERIFIED_TG_INIT || '').toLowerCase() === 'true';
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!token && !allowUnverified) {
      return res.status(500).json({ success: false, error: 'telegram_token_missing' });
    }
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
    if (!parsed && token) {
      parsed = verifyTelegramInitData(rawInit, token);
    }
    if (!parsed || !parsed.user || !parsed.user.id) {
      const qs = new URLSearchParams(rawInit);
      const hasUser = !!qs.get('user');
      const authDate = qs.get('auth_date') || '';
      return res.status(400).json({ success: false, error: 'invalid_telegram_data', reason: 'hash_mismatch_or_malformed', hasUser, authDatePresent: !!authDate, initLen: rawInit.length, allowUnverified });
    }
    const params = new URLSearchParams(rawInit);
    const hash = params.get('hash') || '';
    const authDateSec = Number(params.get('auth_date') || parsed.authDate || 0);
    const maxSkewSec = parseInt(process.env.TELEGRAM_AUTH_MAX_SKEW_SEC || '86400', 10);
    const replayTtlSec = parseInt(process.env.TELEGRAM_REPLAY_TTL_SEC || '120', 10);
    if (authDateSec && maxSkewSec && (Math.floor(Date.now()/1000) - authDateSec > maxSkewSec)) {
      return res.status(401).json({ success:false, error:'stale_telegram_auth' });
    }
    try {
      const isReplay = auth.checkAndStoreTelegramReplay({ hash, authDate: authDateSec, ttlSec: replayTtlSec });
      if (isReplay) return res.status(409).json({ success:false, error:'replay_detected' });
    } catch(_) {}
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

router.post('/login-telegram-widget', (req, res) => {
  try {
    const { data } = req.body || {};
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!token) return res.status(500).json({ success:false, error:'telegram_token_missing' });
    const payload = (typeof data === 'string') ? JSON.parse(data) : (data || {});
    const parsed = verifyTelegramWidgetData(payload, token);
    if (!parsed || !parsed.user || !parsed.user.id) {
      return res.status(400).json({ success:false, error:'invalid_telegram_data' });
    }
    const maxSkewSec = parseInt(process.env.TELEGRAM_AUTH_MAX_SKEW_SEC || '86400', 10);
    if (parsed.authDate && maxSkewSec && (Math.floor(Date.now()/1000) - parsed.authDate > maxSkewSec)) {
      return res.status(401).json({ success:false, error:'stale_telegram_auth' });
    }
    try {
      const isReplay = auth.checkAndStoreTelegramReplay({ hash: String(payload.hash||''), authDate: parsed.authDate, ttlSec: replayTtlSec });
      if (isReplay) {
        try { Sentry.captureMessage('tg_verify_replay', { level: 'warning', extra: { ...tl, ua: String(req.headers['user-agent']||'') } }); } catch(_){ }
        logger.warn('[tg.verify] replay_detected');
        return res.status(409).json({ success:false, error:'replay_detected' });
      }
    } catch(_) {}
    const name = parsed.user.username || [parsed.user.first_name, parsed.user.last_name].filter(Boolean).join(' ');
    const { sid, userId } = auth.createSessionForTelegram({ telegramId: parsed.user.id, name, ua: String(req.headers['user-agent'] || '') });
    setSessionCookie(res, sid);
    res.json({ success:true, sid, userId });
  } catch (err) {
    res.status(500).json({ success:false, error:'telegram_login_error' });
  }
});

// Estado de sesión actual
router.get('/me', (req, res) => {
  try {
    const sid = getSidFromReq(req);
    let userId = '';
    if (sid) {
      const sess = auth.getSession(sid);
      if (!sess) return res.status(401).json({ success: false, error: 'invalid_session' });
      userId = String(sess.userId || '');
    } else if (req.sessionUserId) {
      // Cuando el WebView bloquea cookies pero server.js resolvió sesión por cabecera x-session-id
      userId = String(req.sessionUserId || '');
    } else {
      return res.status(401).json({ success: false, error: 'no_session' });
    }
    const u = store.getUser(userId) || store.ensureUser(userId);
    const myRoles = (roles && typeof roles.getRoles==='function') ? roles.getRoles(u.userId) : ['general'];
    res.json({ success: true, user: { userId: u.userId, userName: u.userName, fires: u.fires || 0, coins: u.coins || 0, roles: myRoles } });
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

// Ping de salud para WebView/Telegram
router.get('/ping', (req, res) => {
  try {
    res.json({ success: true, now: Date.now(), ua: String(req.headers['user-agent']||'') });
  } catch (_) {
    res.status(500).json({ success:false, error:'ping_error' });
  }
});

// Echo simple para verificar POST JSON
router.post('/echo', (req, res) => {
  try {
    const body = req.body || {};
    res.json({ success:true, received: body, len: JSON.stringify(body||{}).length });
  } catch(_) {
    res.status(500).json({ success:false, error:'echo_error' });
  }
});

router.get('/handshake', (req, res) => {
  try {
    const sid = String((req.query && req.query.sid) || '').trim();
    if (!sid) return res.status(400).json({ success:false, error:'invalid_sid' });
    const sess = auth.getSession(sid);
    if (!sess) return res.status(401).json({ success:false, error:'invalid_session' });
    setSessionCookie(res, sid);
    // Emitir ticket firmado para rehidratación cross-instance (válido por 60s)
    const uid = String(sess.userId || '');
    const ts = Date.now();
    const secret = String(process.env.SESSION_TICKET_SECRET || 'dev-secret');
    const payload = `${sid}.${uid}.${ts}`;
    const ticket = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return res.json({ success:true, sid, uid, ts, ticket });
  } catch (err) {
    return res.status(500).json({ success:false, error:'handshake_error' });
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
    try { return res.status(500).json({ success:false, error:'debug_telegram_init_error' }); } catch(_) { /* noop */ }
  }
});

router.post('/telegram/verify', async (req, res) => {
  try {
    const { initData } = req.body || {};
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const rawInit = String(initData||'');
    let parsed = verifyTelegramInitData(rawInit, token);
    const tl = { tokenLoaded: !!token };
    if (!parsed || !parsed.user || !parsed.user.id) {
      // Fallback QA opcional: permitir sin verificar HMAC si ALLOW_UNVERIFIED_TG_INIT=true
      try {
        const allowUnverified = String(process.env.ALLOW_UNVERIFIED_TG_INIT || '').toLowerCase() === 'true';
        if (allowUnverified && rawInit) {
          const qs = new URLSearchParams(rawInit);
          const userStr = qs.get('user');
          const authDate = Number(qs.get('auth_date') || 0);
          if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.id) {
              parsed = { user, authDate };
              try { Sentry.captureMessage('tg_verify_fallback_unverified', { level:'warning', extra: { ...tl, ua: String(req.headers['user-agent']||'') } }); } catch(_){ }
            }
          }
        }
      } catch(_){ }
    }
    if (!parsed || !parsed.user || !parsed.user.id) {
      try { Sentry.captureMessage('tg_verify_invalid_data', { level: 'warning', extra: { ...tl, reason: 'parsed_missing', ua: String(req.headers['user-agent']||'') } }); } catch(_){ }
      logger.warn('[tg.verify] invalid_telegram_data');
      return res.status(400).json({ success:false, error:'invalid_telegram_data' });
    }
    // Verificación anti-stale y anti-replay
    const params = new URLSearchParams(String(initData||''));
    const hash = params.get('hash') || '';
    const authDateSec = Number(params.get('auth_date') || parsed.authDate || 0);
    const maxSkewSec = parseInt(process.env.TELEGRAM_AUTH_MAX_SKEW_SEC || '600', 10);
    const replayTtlSec = parseInt(process.env.TELEGRAM_REPLAY_TTL_SEC || '120', 10);
    if (authDateSec && maxSkewSec && (Math.floor(Date.now()/1000) - authDateSec > maxSkewSec)) {
      try { Sentry.captureMessage('tg_verify_stale_auth', { level: 'warning', extra: { ...tl, ua: String(req.headers['user-agent']||''), skewSec: Math.floor(Date.now()/1000) - authDateSec } }); } catch(_){ }
      return res.status(401).json({ success:false, error:'stale_telegram_auth' });
    }
    try {
      const isReplay = auth.checkAndStoreTelegramReplay({ hash, authDate: authDateSec, ttlSec: replayTtlSec });
      if (isReplay) {
        try { Sentry.captureMessage('tg_verify_replay', { level: 'warning', extra: { ...tl, ua: String(req.headers['user-agent']||'') } }); } catch(_){ }
        logger.warn('[tg.verify] replay_detected');
        return res.status(409).json({ success:false, error:'replay_detected' });
      }
    } catch(_) {}
    let dbUserId = null;
    try { if (userRepo) { const out = await userRepo.upsertTelegramUser({ tgId: parsed.user.id, username: parsed.user.username, displayName: [parsed.user.first_name, parsed.user.last_name].filter(Boolean).join(' ') }); dbUserId = out.userId; } } catch(_){}
    const name = parsed.user.username || [parsed.user.first_name, parsed.user.last_name].filter(Boolean).join(' ');
    // Merge con sesión previa (si existía y no era tg)
    try {
      const raw = String(req.headers.cookie || '');
      let oldSid = '';
      for (const part of raw.split(/;\s*/)) { const [k, v] = part.split('='); if (k === 'sid') { oldSid = v; break; } }
      const sess = oldSid ? auth.getSession(oldSid) : null;
      const tgUserId = 'tg:' + String(parsed.user.id);
      if (sess && sess.userId && sess.userId !== tgUserId) {
        const cur = String(sess.userId);
        if (!cur.startsWith('tg:')) {
          try { store.mergeUsers({ primaryId: tgUserId, secondaryId: cur }); } catch (_) {}
        }
      }
      // Fallback de fusión con anon UID enviado por cliente (cuando no hay cookies)
      try {
        const anonUid = String(req.headers['x-anon-uid'] || '').trim();
        if (anonUid && anonUid.startsWith('anon:') && anonUid !== tgUserId) {
          try { store.mergeUsers({ primaryId: tgUserId, secondaryId: anonUid }); } catch (_){ }
        }
      } catch(_) {}
    } catch (_) {}
    const { sid, userId } = auth.createSessionForTelegram({ telegramId: parsed.user.id, name, ua: String(req.headers['user-agent'] || '') });
    setSessionCookie(res, sid);
    try { Sentry.captureMessage('tg_verify_success', { level: 'info', extra: { ...tl, maskedUserId: String(parsed.user.id).replace(/^(\d{0,2})(.*)(\d{2})$/, '$1***$3'), ua: String(req.headers['user-agent']||'') } }); } catch(_){ }
    logger.info('[tg.verify] success');
    res.json({ success:true, sid, userId, dbUserId });
  } catch (_) { res.status(500).json({ success:false, error:'telegram_verify_error' }); }
});

router.post('/login', async (req, res) => {
  try {
    if (!userRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const { email, password } = req.body || {};
    const out = await userRepo.loginWithEmailDb({ email, password });
    const ua = String(req.headers['user-agent'] || '');
    const sid = crypto.randomBytes(18).toString('hex');
    try { auth.sessions.set(sid, { userId: 'db:'+out.userId, ua, createdAt: Date.now() }); } catch(_){ }
    setSessionCookie(res, sid);
    res.json({ success:true, sid, userId: 'db:'+out.userId });
  } catch (err) {
    const msg = (err && err.message) || 'login_error';
    const code = (msg === 'invalid_params' || msg === 'user_not_found' || msg === 'invalid_credentials') ? 403 : 500;
    res.status(code).json({ success:false, error: msg });
  }
});

module.exports = router;
