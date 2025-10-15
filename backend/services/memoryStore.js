const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class MemoryStore extends EventEmitter {
  constructor() {
    super();
    this.supply = {
      total: 1_000_000_000,
      circulating: 100_000,
      burned: 0
    };
    this.users = new Map(); // userId -> { userId, userName, fires, coins, createdAt, lastSeenAt, firstSeenAt, currentSessionStart, lastDurationMs, lastDevice, devices }
    this.sponsors = new Map(); // userId -> { userId, key, description }
    this.userTx = new Map(); // userId -> [tx]
    this.txs = []; // simple list of transactions
    this.coinDaily = new Map(); // userId -> { date: 'YYYY-MM-DD', count: number }
    this.fireRequests = []; // [{ id, userId, amount, reference, status, createdAt, updatedAt }]
    this.userStats = new Map(); // userId -> { wins, losses, draws, games, byGame: { [game]: { wins, losses, draws, games } } }
    // Evento de bienvenida (bono por primer login)
    this.welcomeEvent = { active: false, startsAt: 0, endsAt: 0, coins: 0, fires: 0, message: '' };
    this.welcomeClaims = new Map(); // userId -> ts de entrega
    // Cargar estado persistido si existe
    try {
      const p = path.resolve(__dirname, '../../storage/events/welcome.json');
      if (fs.existsSync(p)) {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (j && j.active && j.endsAt && Date.now() < Number(j.endsAt)) {
          this.welcomeEvent = {
            active: true,
            startsAt: Number(j.startsAt || Date.now()),
            endsAt: Number(j.endsAt),
            coins: Math.max(0, parseInt(j.coins || 0, 10)),
            fires: Math.max(0, parseInt(j.fires || 0, 10)),
            message: String(j.message || '')
          };
        }
      }
    } catch (_) {}
    // Cargar claims persistidos
    try {
      const pc = path.resolve(__dirname, '../../storage/events/welcome_claims.json');
      if (fs.existsSync(pc)) {
        const jc = JSON.parse(fs.readFileSync(pc, 'utf8'));
        if (jc && typeof jc === 'object') {
          for (const [k, v] of Object.entries(jc)) {
            if (k) this.welcomeClaims.set(k, Number(v) || Date.now());
          }
        }
      }
    } catch (_) {}
  }

  getSupplySummary() {
    const sumBalances = Array.from(this.users.values()).reduce((acc, u) => acc + Math.max(0, Number(u.fires || 0)), 0);
    const total = Number(this.supply.total);
    const burned = Math.max(0, Number(this.supply.burned || 0));
    const reserve = Math.max(0, total - (sumBalances + burned));
    return { total, circulating: sumBalances, burned, reserve };
  }

  getReserve() {
    const snap = this.getSupplySummary();
    return Math.max(0, Number(snap.reserve || 0));
  }

  // -------- Evento de Bienvenida --------
  setWelcomeEventActive({ coins = 100, fires = 10, durationHours = 72, startsAt, message = '' } = {}) {
    const now = Date.now();
    const start = Number(startsAt || now);
    const ends = start + Math.max(1, Math.floor(Number(durationHours) || 72)) * 3600 * 1000;
    this.welcomeEvent = {
      active: true,
      startsAt: start,
      endsAt: ends,
      coins: Math.max(0, parseInt(coins || 0, 10)),
      fires: Math.max(0, parseInt(fires || 0, 10)),
      message: String(message || '')
    };
    try {
      const dir = path.resolve(__dirname, '../../storage/events');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'welcome.json'), JSON.stringify(this.welcomeEvent, null, 2));
    } catch (_) {}
    return { ...this.welcomeEvent };
  }

  disableWelcomeEvent() {
    this.welcomeEvent = { active: false, startsAt: 0, endsAt: 0, coins: 0, fires: 0, message: '' };
    try {
      const dir = path.resolve(__dirname, '../../storage/events');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'welcome.json'), JSON.stringify(this.welcomeEvent, null, 2));
    } catch (_) {}
  }

  getWelcomeEvent() {
    return { ...this.welcomeEvent };
  }

  _setWelcomeClaim(userId) {
    const id = String(userId || '').trim();
    if (!id) return;
    this.welcomeClaims.set(id, Date.now());
    try {
      const dir = path.resolve(__dirname, '../../storage/events');
      fs.mkdirSync(dir, { recursive: true });
      const obj = {};
      for (const [k, v] of this.welcomeClaims.entries()) obj[k] = v;
      fs.writeFileSync(path.join(dir, 'welcome_claims.json'), JSON.stringify(obj));
    } catch (_) {}
  }

  hasClaimedWelcome(userId) {
    const id = String(userId || '').trim();
    return !!this.welcomeClaims.get(id);
  }

  awardWelcomeIfEligible(userId) {
    const id = String(userId || '').trim();
    if (!id) return { awarded: false };
    const ev = this.getWelcomeEvent();
    const now = Date.now();
    if (!ev.active || now < ev.startsAt || now > ev.endsAt) return { awarded: false };
    if (this.hasClaimedWelcome(id)) return { awarded: false };
    // Otorgar: monedas generadas (admin) y fuegos desde la reserva (max supply)
    if (ev.coins > 0) this.addCoinsAdmin({ userId: id, amount: ev.coins, reason: 'welcome_bonus' });
    if (ev.fires > 0) this.grantFromSupply({ toUserId: id, amount: ev.fires, reason: 'welcome_bonus' });
    const tx = this.pushTx({ type: 'welcome_bonus', toUserId: id, coins: ev.coins, fires: ev.fires });
    this._addUserTx(id, tx);
    this._setWelcomeClaim(id);
    return { awarded: true, coinsAwarded: ev.coins, firesAwarded: ev.fires, until: ev.endsAt };
  }

  getDateKey() {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  }

  addBurn(amount) {
    const request = Math.max(0, parseInt(amount || 0, 10));
    const reserve = this.getReserve();
    const canBurn = Math.min(request, reserve);
    if (canBurn > 0) {
      this.supply.burned += canBurn;
      this.emit('supply_changed', this.getSupplySummary());
    }
    return canBurn;
  }

  getInitialCirculationStatus() {
    try {
      const p = path.resolve(__dirname, '../../storage/economy/initial_circulation.json');
      if (!fs.existsSync(p)) return { assigned: false };
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { assigned: !!j.assigned, ...j };
    } catch (_) { return { assigned: false }; }
  }

  assignInitialCirculation({ toUserId, amount, reason = 'initial_circulation' }) {
    const status = this.getInitialCirculationStatus();
    if (status.assigned) throw new Error('already_assigned');
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (!toUserId || a <= 0) throw new Error('invalid_params');
    const out = this.grantFromSupply({ toUserId, amount: a, reason });
    try {
      const dir = path.resolve(__dirname, '../../storage/economy');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'initial_circulation.json'), JSON.stringify({ assigned: true, ts: Date.now(), toUserId, amount: a }, null, 2));
    } catch (_) {}
    return out;
  }

  pushTx(tx) {
    const entry = { id: 'tx_' + Date.now(), ts: Date.now(), ...tx };
    this.txs.unshift(entry);
    this.txs = this.txs.slice(0, 500);
    return entry;
  }

  ensureUser(userId) {
    const id = String(userId || '').trim();
    if (!id) return null;
    const now = Date.now();
    if (!this.users.has(id)) {
      this.users.set(id, { userId: id, userName: id, fires: 0, coins: 0, createdAt: now, lastSeenAt: now, firstSeenAt: now, currentSessionStart: now, lastDurationMs: 0, devices: [] });
    } else {
      const u = this.users.get(id);
      if (u) { u.lastSeenAt = now; this.users.set(id, u); }
    }
    return this.users.get(id);
  }

  getUser(userId) {
    const id = String(userId || '').trim();
    if (!id) return null;
    return this.users.get(id) || null;
  }

  listUsers({ search = '', limit = 20, cursor = 0 } = {}) {
    const arr = Array.from(this.users.values());
    const q = String(search || '').toLowerCase();
    const filtered = q ? arr.filter(u => (u.userId || '').toLowerCase().includes(q) || (u.userName || '').toLowerCase().includes(q)) : arr;
    const start = Number(cursor) || 0;
    const end = Math.min(filtered.length, start + Math.max(1, Math.min(100, Number(limit) || 20)));
    const items = filtered.slice(start, end);
    const nextCursor = end < filtered.length ? end : null;
    return { items, nextCursor, total: filtered.length };
  }

  // --- Stats ---
  _statObj() { return { wins: 0, losses: 0, draws: 0, games: 0 }; }
  _getStats(userId){
    const id = String(userId||'').trim();
    if (!this.userStats.has(id)) this.userStats.set(id, { ...this._statObj(), byGame: {} });
    return this.userStats.get(id);
  }
  recordGameResult({ userId, game = 'generic', result }){
    const id = String(userId||'').trim(); if (!id) return;
    const g = String(game||'generic'); const r = String(result||'').toLowerCase();
    const st = this._getStats(id);
    st.games += 1;
    if (r === 'win') st.wins += 1; else if (r === 'loss') st.losses += 1; else if (r === 'draw') st.draws += 1;
    if (!st.byGame[g]) st.byGame[g] = this._statObj();
    st.byGame[g].games += 1;
    if (r === 'win') st.byGame[g].wins += 1; else if (r === 'loss') st.byGame[g].losses += 1; else if (r === 'draw') st.byGame[g].draws += 1;
    this.userStats.set(id, st);
  }
  getUserStats(userId){
    const st = this._getStats(userId);
    return { wins: st.wins, losses: st.losses, draws: st.draws, games: st.games, byGame: { ...st.byGame } };
  }

  // --- User tracking & contact metadata ---
  touchUser(userId, opts) {
    const u = this.ensureUser(userId);
    if (!u) return u;
    const now = Date.now();
    const prevLast = Number(u.lastSeenAt || 0);
    u.lastSeenAt = now;
    const windowMs = Math.max(15000, Math.min(10 * 60_000, parseInt(process.env.ONLINE_WINDOW_MS || '120000', 10) || 120000));
    const gap = now - prevLast;
    if (!u.currentSessionStart || gap > windowMs) {
      u.currentSessionStart = now;
      u.lastDurationMs = 0;
    } else {
      const start = Number(u.currentSessionStart || u.firstSeenAt || u.createdAt || now);
      u.lastDurationMs = Math.max(0, now - start);
    }
    if (opts && typeof opts === 'object') {
      const ua = String(opts.ua || '').trim();
      if (ua) {
        u.lastDevice = ua;
        try {
          if (!Array.isArray(u.devices)) u.devices = [];
          if (!u.devices.includes(ua)) {
            u.devices.unshift(ua);
            u.devices = u.devices.slice(0, 5);
          }
        } catch (_) {}
      }
    }
    this.users.set(u.userId, u);
    return u;
  }

  setUserContact({ userId, email, phone, telegramId }) {
    const u = this.ensureUser(userId);
    if (!u) throw new Error('invalid_user');
    if (typeof email !== 'undefined') u.email = String(email || '').trim() || undefined;
    if (typeof phone !== 'undefined') u.phone = String(phone || '').trim() || undefined;
    if (typeof telegramId !== 'undefined') u.telegramId = String(telegramId || '').trim() || undefined;
    this.users.set(u.userId, u);
    return u;
  }

  resetUserCredentials({ userId }) {
    const u = this.ensureUser(userId);
    if (!u) throw new Error('invalid_user');
    delete u.email;
    delete u.phone;
    u.lastDevice = undefined;
    u.devices = [];
    u.lastDurationMs = 0;
    u.currentSessionStart = Date.now();
    this.users.set(u.userId, u);
    return u;
  }

  listUsersDetailed({ search = '', limit = 50, cursor = 0 } = {}) {
    const arr = Array.from(this.users.values()).map(u => {
      const tgId = (u.telegramId) ? String(u.telegramId) : (String(u.userId || '').startsWith('tg:') ? String(u.userId).slice(3) : undefined);
      return {
        userId: u.userId,
        userName: u.userName,
        createdAt: Number(u.createdAt || 0),
        lastSeenAt: Number(u.lastSeenAt || 0),
        telegramId: tgId,
        email: u.email,
        phone: u.phone,
        fires: Math.max(0, Number(u.fires || 0)),
        coins: Math.max(0, Number(u.coins || 0)),
        lastDevice: u.lastDevice,
        lastDurationMs: Math.max(0, Number(u.lastDurationMs || 0)),
        devices: Array.isArray(u.devices) ? u.devices.slice(0, 5) : []
      };
    });
    const q = String(search || '').toLowerCase();
    const filtered = q ? arr.filter(x =>
      (x.userId||'').toLowerCase().includes(q) ||
      (x.userName||'').toLowerCase().includes(q) ||
      (x.email||'').toLowerCase().includes(q) ||
      (x.phone||'').toLowerCase().includes(q) ||
      (x.telegramId||'').toLowerCase().includes(q)
    ) : arr;
    filtered.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    const start = Number(cursor) || 0;
    const end = Math.min(filtered.length, start + Math.max(1, Math.min(200, Number(limit) || 50)));
    const items = filtered.slice(start, end);
    const nextCursor = end < filtered.length ? end : null;
    return { items, nextCursor, total: filtered.length };
  }

  addSponsor({ userId, key, description, initialAmount = 0 }) {
    const id = String(userId || '').trim();
    if (!id) throw new Error('invalid_user');
    const rec = { userId: id, key: key ? String(key) : undefined, description: description ? String(description) : undefined };
    this.sponsors.set(id, rec);
    if (initialAmount > 0) {
      this.grantFromSupply({ toUserId: id, amount: Number(initialAmount), reason: 'sponsor_init' });
    }
    return rec;
  }

  removeSponsor({ userId }) {
    const id = String(userId || '').trim();
    this.sponsors.delete(id);
    return true;
  }

  setSponsorMeta({ userId, description }) {
    const id = String(userId || '').trim();
    const cur = this.sponsors.get(id) || { userId: id };
    cur.description = description;
    this.sponsors.set(id, cur);
    return cur;
  }

  setSponsorKey({ userId, key }) {
    const id = String(userId || '').trim();
    const cur = this.sponsors.get(id) || { userId: id };
    cur.key = String(key || '');
    this.sponsors.set(id, cur);
    return cur;
  }

  removeSponsorKey({ userId }) {
    const id = String(userId || '').trim();
    const cur = this.sponsors.get(id);
    if (cur) delete cur.key;
    return cur;
  }

  verifySponsorKey({ userId, sponsorKey }) {
    const rec = this.sponsors.get(String(userId || '').trim());
    if (!rec || !rec.key) return false;
    return String(rec.key) === String(sponsorKey || '');
  }

  addCoins({ userId, amount = 1, userName, reason = 'coin_msg' }) {
    const id = String(userId || '').trim();
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const cap = Math.max(0, parseInt(process.env.COIN_DAILY_CAP || '100', 10) || 100);
    if (!id || a <= 0 || cap <= 0) return null;
    const dateKey = this.getDateKey();
    let rec = this.coinDaily.get(id);
    if (!rec || rec.date !== dateKey) rec = { date: dateKey, count: 0 };
    const remaining = Math.max(0, cap - rec.count);
    const award = Math.min(a, remaining);
    if (award <= 0) return null;
    const u = this.ensureUser(id);
    if (userName) u.userName = userName;
    u.coins = Math.max(0, Number(u.coins || 0)) + award;
    rec.count += award;
    this.coinDaily.set(id, rec);
    const tx = this.pushTx({ type: 'coin', toUserId: id, amount: award, reason });
    this._addUserTx(id, tx);
    return { u, tx, awarded: award, remaining: Math.max(0, cap - rec.count), cap };
  }

  grantFromSupply({ toUserId, amount, reason }) {
    const u = this.ensureUser(toUserId);
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (!u || a <= 0) throw new Error('invalid_grant');
    const reserve = this.getReserve();
    if (a > reserve) throw new Error('insufficient_reserve');
    u.fires += a;
    const tx = this.pushTx({ type: 'grant', toUserId, amount: a, reason: reason || 'grant' });
    this._addUserTx(toUserId, tx);
    this.emit('supply_changed', this.getSupplySummary());
    return { u, tx };
  }

  transferFromSponsor({ fromUserId, toUserId, amount, sponsorKey, reason }) {
    const from = this.sponsors.get(String(fromUserId || '').trim());
    if (!from || !from.key || String(from.key) !== String(sponsorKey || '')) {
      throw new Error('invalid_sponsor_key');
    }
    const a = Math.max(0, Number(amount) || 0);
    if (a <= 0) throw new Error('invalid_amount');
    const to = this.ensureUser(toUserId);
    to.fires += a;
    const tx = this.pushTx({ type: 'transfer', fromUserId, toUserId, amount: a, reason: reason || 'transfer' });
    this._addUserTx(toUserId, tx);
    return { to, tx };
  }

  _addUserTx(userId, tx) {
    const id = String(userId || '').trim();
    if (!this.userTx.has(id)) this.userTx.set(id, []);
    const arr = this.userTx.get(id);
    arr.unshift(tx);
    this.userTx.set(id, arr.slice(0, 200));
  }

  getUserHistory(userId, { limit = 20, offset = 0 } = {}) {
    const id = String(userId || '').trim();
    const arr = this.userTx.get(id) || [];
    const l = Math.max(1, Math.min(100, Number(limit) || 20));
    const o = Math.max(0, Number(offset) || 0);
    return { items: arr.slice(o, o + l), total: arr.length, limit: l, offset: o };
  }

  // ----- Fire Requests (compras de fuegos) -----
  createFireRequest({ userId, amount, reference }) {
    const uid = String(userId || '').trim();
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const ref = String(reference || '').trim();
    if (!uid || a <= 0 || !ref) throw new Error('invalid_request');
    this.ensureUser(uid);
    const rec = {
      id: 'fr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      userId: uid,
      amount: a,
      reference: ref,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.fireRequests.unshift(rec);
    const tx = this.pushTx({ type: 'fire_request_create', userId: uid, amount: a, reference: ref });
    this._addUserTx(uid, tx);
    return rec;
  }

  listFireRequests({ status, limit = 20, offset = 0 } = {}) {
    let arr = this.fireRequests.slice();
    if (status) arr = arr.filter(r => r.status === status);
    const l = Math.max(1, Math.min(100, Number(limit) || 20));
    const o = Math.max(0, Number(offset) || 0);
    return { items: arr.slice(o, o + l), total: arr.length, limit: l, offset: o };
  }

  listFireRequestsByUser(userId, { limit = 20, offset = 0 } = {}) {
    const uid = String(userId || '').trim();
    const all = this.fireRequests.filter(r => r.userId === uid);
    const l = Math.max(1, Math.min(100, Number(limit) || 20));
    const o = Math.max(0, Number(offset) || 0);
    return { items: all.slice(o, o + l), total: all.length, limit: l, offset: o };
  }

  getFireRequest(id) {
    const rid = String(id || '').trim();
    return this.fireRequests.find(r => r.id === rid) || null;
  }

  acceptFireRequest({ id, adminUserName }) {
    const rec = this.getFireRequest(id);
    if (!rec) throw new Error('request_not_found');
    if (rec.status !== 'pending') throw new Error('request_not_pending');
    rec.status = 'accepted';
    rec.updatedAt = Date.now();
    // Aceptar: otorgar desde la reserva hacia el usuario
    const out = this.grantFromSupply({ toUserId: rec.userId, amount: rec.amount, reason: 'fire_request_accept' });
    const tx = this.pushTx({ type: 'fire_request_accept', requestId: rec.id, toUserId: rec.userId, amount: rec.amount, admin: adminUserName });
    this._addUserTx(rec.userId, tx);
    return { request: rec, grant: out };
  }

  rejectFireRequest({ id, adminUserName }) {
    const rec = this.getFireRequest(id);
    if (!rec) throw new Error('request_not_found');
    if (rec.status !== 'pending') throw new Error('request_not_pending');
    rec.status = 'rejected';
    rec.updatedAt = Date.now();
    const tx = this.pushTx({ type: 'fire_request_reject', requestId: rec.id, userId: rec.userId, amount: rec.amount, admin: adminUserName });
    this._addUserTx(rec.userId, tx);
    return { request: rec };
  }

  // Gasto de monedas (coins): descuenta si hay saldo suficiente
  trySpendCoins({ userId, amount = 0, reason = 'coins_spend' }) {
    const id = String(userId || '').trim();
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (!id || a <= 0) return { ok: false, error: 'invalid_amount' };
    const u = this.ensureUser(id);
    const cur = Math.max(0, Number(u.coins || 0));
    if (cur < a) return { ok: false, error: 'insufficient_coins' };
    u.coins = cur - a;
    const tx = this.pushTx({ type: 'coins_spend', fromUserId: id, amount: a, reason });
    this._addUserTx(id, tx);
    return { ok: true, remaining: u.coins, tx };
  }

  // Gasto de fuegos (fires): descuenta si hay saldo suficiente
  trySpendFires({ userId, amount = 0, reason = 'fires_spend' }) {
    const id = String(userId || '').trim();
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (!id || a <= 0) return { ok: false, error: 'invalid_amount' };
    const u = this.ensureUser(id);
    const cur = Math.max(0, Number(u.fires || 0));
    if (cur < a) return { ok: false, error: 'insufficient_fires' };
    u.fires = cur - a;
    const tx = this.pushTx({ type: 'fires_spend', fromUserId: id, amount: a, reason });
    this._addUserTx(id, tx);
    return { ok: true, remaining: u.fires, tx };
  }

  // Transferencia entre usuarios (no afecta supply)
  transferFires({ fromUserId, toUserId, amount = 0, reason = 'transfer' }) {
    const from = String(fromUserId || '').trim();
    const to = String(toUserId || '').trim();
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (!from || !to || from === to || a <= 0) return { ok: false, error: 'invalid_transfer' };
    const fu = this.ensureUser(from);
    const tu = this.ensureUser(to);
    const cur = Math.max(0, Number(fu.fires || 0));
    if (cur < a) return { ok: false, error: 'insufficient_fires' };
    fu.fires = cur - a;
    tu.fires = Math.max(0, Number(tu.fires || 0)) + a;
    const tx = this.pushTx({ type: 'transfer', fromUserId: from, toUserId: to, amount: a, reason });
    this._addUserTx(from, tx);
    this._addUserTx(to, tx);
    return { ok: true, from: fu, to: tu, tx };
  }

  // Crédito administrativo de coins (sin cap diario)
  addCoinsAdmin({ userId, amount = 0, reason = 'coins_admin_add' }) {
    const id = String(userId || '').trim();
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (!id || a <= 0) return { ok: false, error: 'invalid_amount' };
    const u = this.ensureUser(id);
    u.coins = Math.max(0, Number(u.coins || 0)) + a;
    const tx = this.pushTx({ type: 'coins_admin_add', toUserId: id, amount: a, reason });
    this._addUserTx(id, tx);
    return { ok: true, balance: u.coins, tx };
  }

  // Crédito administrativo de fires (sin tocar supply)
  addFiresAdmin({ userId, amount = 0, reason = 'fires_admin_add' }) {
    const id = String(userId || '').trim();
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (!id || a <= 0) return { ok: false, error: 'invalid_amount' };
    const u = this.ensureUser(id);
    u.fires = Math.max(0, Number(u.fires || 0)) + a;
    const tx = this.pushTx({ type: 'fires_admin_add', toUserId: id, amount: a, reason });
    this._addUserTx(id, tx);
    return { ok: true, balance: u.fires, tx };
  }

  mergeUsers({ primaryId, secondaryId }) {
    const pId = String(primaryId || '').trim();
    const sId = String(secondaryId || '').trim();
    if (!pId || !sId || pId === sId) return { ok: false };
    const p = this.ensureUser(pId);
    const s = this.getUser(sId);
    if (!s) return { ok: true };
    p.coins = Math.max(0, Number(p.coins || 0)) + Math.max(0, Number(s.coins || 0));
    p.fires = Math.max(0, Number(p.fires || 0)) + Math.max(0, Number(s.fires || 0));
    const sTx = this.userTx.get(sId) || [];
    const pTx = this.userTx.get(pId) || [];
    const merged = sTx.concat(pTx).slice(0, 200);
    this.userTx.set(pId, merged);
    this.userTx.delete(sId);
    for (const tx of this.txs) {
      if (!tx) continue;
      if (tx.toUserId === sId) tx.toUserId = pId;
      if (tx.fromUserId === sId) tx.fromUserId = pId;
      if (tx.userId === sId) tx.userId = pId;
    }
    this.fireRequests = this.fireRequests.map(r => r && r.userId === sId ? { ...r, userId: pId } : r);
    const sSponsor = this.sponsors.get(sId);
    const pSponsor = this.sponsors.get(pId);
    if (sSponsor && !pSponsor) {
      const moved = { ...sSponsor, userId: pId };
      this.sponsors.set(pId, moved);
    }
    this.sponsors.delete(sId);
    this.users.delete(sId);
    const sDaily = this.coinDaily.get(sId);
    if (sDaily) {
      const pDaily = this.coinDaily.get(pId);
      if (!pDaily || pDaily.date !== sDaily.date) {
        this.coinDaily.set(pId, sDaily);
      } else {
        pDaily.count = Math.max(0, Number(pDaily.count || 0)) + Math.max(0, Number(sDaily.count || 0));
        this.coinDaily.set(pId, pDaily);
      }
      this.coinDaily.delete(sId);
    }
    this.emit('supply_changed', this.getSupplySummary());
    return { ok: true, primaryId: pId };
  }
}

module.exports = new MemoryStore();
