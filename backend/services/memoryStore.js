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
  }

  getSupplySummary() {
    return { ...this.supply };
  }

  getReserve() {
    // Reserva disponible = total - (circulating + burned)
    const { total, circulating, burned } = this.supply;
    return Math.max(0, Number(total) - (Number(circulating) + Number(burned)));
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
}

module.exports = new MemoryStore();
