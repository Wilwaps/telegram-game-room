const crypto = require('crypto');
const store = require('./memoryStore');

function uid(n = 16) { return crypto.randomBytes(n).toString('hex'); }
function now() { return Date.now(); }
function toLower(s) { return String(s || '').trim().toLowerCase(); }

function hashPassword(password) {
  const salt = uid(8);
  const h = crypto.createHash('sha256').update(salt + '::' + String(password || '')).digest('hex');
  return `${salt}:${h}`;
}
function verifyPassword(password, stored) {
  const [salt, h] = String(stored || '').split(':');
  if (!salt || !h) return false;
  const calc = crypto.createHash('sha256').update(salt + '::' + String(password || '')).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(h));
}

class AuthStore {
  constructor() {
    this.usersByEmail = new Map(); // emailLower -> { email, name, passwordHash, verified, telegramId, internalId }
    this.sessions = new Map(); // sid -> { userId, ua, createdAt }
    this.emailCodes = new Map(); // emailLower -> { code, expiresAt }
    this.tgReplays = new Map();
  }

  getUserByEmail(email) { return this.usersByEmail.get(toLower(email)) || null; }
  getUserByTelegramId(tgId) {
    const id = String(tgId || '').trim();
    if (!id) return null;
    for (const u of this.usersByEmail.values()) {
      if (String(u.telegramId || '') === id) return u;
    }
    return null;
  }

  ensurePlatformUserForEmail(email, name) {
    const internalId = 'em:' + toLower(email);
    const u = store.ensureUser(internalId);
    if (name) u.userName = name;
    return u;
  }

  ensurePlatformUserForTelegram(tgId, name) {
    const internalId = 'tg:' + String(tgId);
    const u = store.ensureUser(internalId);
    if (name) u.userName = name;
    return u;
  }

  createEmailUser({ name, email, password }) {
    const e = toLower(email);
    if (!e || !password) throw new Error('invalid_params');
    if (this.usersByEmail.has(e)) throw new Error('email_exists');
    const rec = {
      email: e,
      name: String(name || '').trim() || e,
      passwordHash: hashPassword(password),
      verified: false,
      telegramId: undefined,
      internalId: 'em:' + e
    };
    this.usersByEmail.set(e, rec);
    const u = this.ensurePlatformUserForEmail(e, rec.name);
    try { store.setUserContact({ userId: u.userId, email: e }); } catch (_) {}
    return rec;
  }

  issueEmailCode(email) {
    const e = toLower(email);
    const rec = this.getUserByEmail(e);
    if (!rec) throw new Error('user_not_found');
    const code = ('' + Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const expiresAt = now() + 10 * 60 * 1000; // 10 minutos
    this.emailCodes.set(e, { code, expiresAt });
    // Simulación envío email: log a consola
    console.log(`[auth] Código de verificación para ${e}: ${code} (expira en 10m)`);
    return { code, expiresAt };
  }

  verifyEmail({ email, code }) {
    const e = toLower(email);
    const rec = this.getUserByEmail(e);
    if (!rec) throw new Error('user_not_found');
    const entry = this.emailCodes.get(e);
    if (!entry || entry.code !== String(code || '')) throw new Error('invalid_code');
    if (now() > entry.expiresAt) throw new Error('code_expired');
    rec.verified = true;
    this.emailCodes.delete(e);
    try { store.setUserContact({ userId: rec.internalId, email: e }); } catch (_) {}
    return { ok: true };
  }

  loginWithEmail({ email, password, ua }) {
    const e = toLower(email);
    const rec = this.getUserByEmail(e);
    if (!rec) throw new Error('user_not_found');
    const allowUnv = String(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN || '').toLowerCase() === 'true';
    if (!rec.verified && !allowUnv) throw new Error('email_not_verified');
    if (!verifyPassword(password, rec.passwordHash)) throw new Error('invalid_credentials');
    const sid = uid(18);
    this.sessions.set(sid, { userId: rec.internalId, ua: String(ua || ''), createdAt: now() });
    try { store.touchUser(rec.internalId); store.setUserContact({ userId: rec.internalId, email: e }); } catch (_) {}
    return { sid, userId: rec.internalId };
  }

  // Vincular email <-> Telegram; si existe cuenta tg y email distintas, fusionar saldos en la primaria (priorizamos tg)
  linkTelegram({ email, telegramId }) {
    const e = toLower(email);
    const tg = String(telegramId || '').trim();
    if (!e || !tg) throw new Error('invalid_params');
    const rec = this.getUserByEmail(e);
    if (!rec) throw new Error('user_not_found');
    rec.telegramId = tg;
    const tgUser = this.ensurePlatformUserForTelegram(tg, rec.name);
    const emailUser = this.ensurePlatformUserForEmail(e, rec.name);
    // Fusionar si ids distintos
    if (tgUser.userId !== emailUser.userId) {
      try { store.mergeUsers({ primaryId: tgUser.userId, secondaryId: emailUser.userId }); } catch (_) {}
      rec.internalId = tgUser.userId;
    }
    try { store.setUserContact({ userId: rec.internalId, email: e, telegramId: tg }); } catch (_) {}
    return { ok: true, userId: rec.internalId };
  }

  createSessionForTelegram({ telegramId, name, ua }) {
    const tg = String(telegramId || '').trim();
    if (!tg) throw new Error('invalid_params');
    const u = this.ensurePlatformUserForTelegram(tg, name);
    try { store.setUserContact({ userId: u.userId, telegramId: tg }); } catch (_) {}
    const sid = uid(18);
    this.sessions.set(sid, { userId: u.userId, ua: String(ua || ''), createdAt: now() });
    return { sid, userId: u.userId };
  }

  getSession(sid) { return this.sessions.get(String(sid || '')) || null; }
  destroySession(sid) { this.sessions.delete(String(sid || '')); }

  createGuestSession({ ua }) {
    const gid = 'anon:' + uid(6);
    const u = store.ensureUser(gid);
    const sid = uid(18);
    this.sessions.set(sid, { userId: u.userId, ua: String(ua || ''), createdAt: now() });
    return { sid, userId: u.userId };
  }

  checkAndStoreTelegramReplay({ hash, authDate, ttlSec }) {
    const key = String(hash || '').trim();
    if (!key) return false;
    const nowMs = now();
    const ttlMs = Math.max(1, Number(ttlSec || 600)) * 1000;
    const prev = this.tgReplays.get(key);
    if (prev && nowMs < prev) return true;
    this.tgReplays.set(key, nowMs + ttlMs);
    if (this.tgReplays.size > 5000) {
      const entries = Array.from(this.tgReplays.entries());
      const cutoff = nowMs;
      for (let i = 0; i < entries.length; i++) {
        if (entries[i][1] < cutoff) this.tgReplays.delete(entries[i][0]);
      }
    }
    return false;
  }
}

module.exports = new AuthStore();
