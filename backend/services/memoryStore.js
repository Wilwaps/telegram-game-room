const EventEmitter = require('events');

class MemoryStore extends EventEmitter {
  constructor() {
    super();
    this.supply = {
      total: 1_000_000_000,
      circulating: 100_000,
      burned: 0
    };
    this.users = new Map(); // userId -> { userId, userName, fires, coins }
    this.sponsors = new Map(); // userId -> { userId, key, description }
    this.userTx = new Map(); // userId -> [tx]
    this.txs = []; // simple list of transactions
    this.coinDaily = new Map(); // userId -> { date: 'YYYY-MM-DD', count: number }
  }

  getSupplySummary() {
    return { ...this.supply };
  }

  getReserve() {
    // Reserva disponible = total - (circulating + burned)
    const { total, circulating, burned } = this.supply;
    return Math.max(0, Number(total) - (Number(circulating) + Number(burned)));
  }

  getDateKey() {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  }

  addBurn(amount) {
    const request = Math.max(0, parseInt(amount || 0, 10));
    const canBurn = Math.min(request, this.supply.circulating);
    if (canBurn > 0) {
      this.supply.burned += canBurn;
      this.supply.circulating -= canBurn;
      this.emit('supply_changed', this.getSupplySummary());
    }
    return canBurn;
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
    if (!this.users.has(id)) {
      this.users.set(id, { userId: id, userName: id, fires: 0, coins: 0 });
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
    this.supply.circulating += a; // Se libera desde la reserva hacia circulación
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
}

module.exports = new MemoryStore();
