const EventEmitter = require('events');
const mem = require('./memoryStore');

class BingoStore extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.codeIndex = new Map();
  }
  newId() { return 'bing_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
  makeCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  // Utilidades de cartones
  randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  generateCard() {
    // B(1–15), I(16–30), N(31–45), G(46–60), O(61–75)
    const cols = [
      this.shuffle(Array.from({ length: 15 }, (_, i) => i + 1)).slice(0, 5),
      this.shuffle(Array.from({ length: 15 }, (_, i) => i + 16)).slice(0, 5),
      this.shuffle(Array.from({ length: 15 }, (_, i) => i + 31)).slice(0, 5),
      this.shuffle(Array.from({ length: 15 }, (_, i) => i + 46)).slice(0, 5),
      this.shuffle(Array.from({ length: 15 }, (_, i) => i + 61)).slice(0, 5)
    ];
    // Construir 5x5 por filas
    const grid = Array.from({ length: 5 }, () => Array(5).fill(null));
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 5; r++) {
        grid[r][c] = cols[c][r];
      }
    }
    // Casilla central libre
    grid[2][2] = 'FREE';
    return grid; // 5x5
  }
  generateCards(n = 1) { n = Math.max(1, Math.min(10, Number(n) || 1)); return Array.from({ length: n }, () => this.generateCard()); }

  createRoom(hostId, opts = {}) {
    const id = this.newId();
    const state = {
      id,
      code: this.makeCode(),
      createdAt: Date.now(),
      hostId: String(hostId),
      visibility: (opts.visibility === 'public' ? 'public' : 'private'),
      costType: (['free', 'fuego'].includes(opts.costType) ? opts.costType : 'free'),
      costValue: Math.max(0, Number(opts.costValue || 1) || 1),
      mode: (['linea', '4c', 'carton'].includes(opts.mode) ? opts.mode : 'linea'),
      status: 'lobby', // lobby | playing | finished
      players: new Map(), // userId -> { userId, ready, cardsCount, cards }
      potFires: 0,
      drawQueue: [], // números restantes por salir
      called: [],
      lastCall: null,
      winners: []
    };
    // Host entra por defecto, 1 cartón y no ready
    state.players.set(String(hostId), { userId: String(hostId), ready: false, cardsCount: 1, cards: [] });
    this.rooms.set(id, state);
    this.codeIndex.set(state.code, id);
    return this.getState(id);
  }

  getState(roomId) {
    const r = this.rooms.get(String(roomId));
    if (!r) return null;
    const players = Array.from(r.players.values()).map(p => ({ userId: p.userId, ready: p.ready, cardsCount: p.cardsCount, cards: p.cards && p.cards.length ? p.cards : undefined }));
    return {
      id: r.id,
      code: r.code,
      createdAt: r.createdAt,
      hostId: r.hostId,
      visibility: r.visibility,
      costType: r.costType,
      costValue: r.costValue,
      mode: r.mode,
      status: r.status,
      players,
      potFires: r.potFires,
      called: [...r.called],
      lastCall: r.lastCall,
      winners: [...r.winners]
    };
  }

  listRoomsByUser(userId) {
    const uid = String(userId);
    const out = [];
    for (const r of this.rooms.values()) {
      if (r.hostId === uid || r.players.has(uid)) out.push(this.getState(r.id));
    }
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }
  listPublicRooms() {
    const out = [];
    for (const r of this.rooms.values()) { if (r.visibility === 'public') out.push(this.getState(r.id)); }
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }
  findByCode(code) {
    const id = this.codeIndex.get(String(code));
    if (!id) return null;
    return this.getState(id);
  }

  joinRoom(roomId, userId) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (r.status !== 'lobby') throw new Error('already_started');
    const uid = String(userId);
    if (!r.players.has(uid)) r.players.set(uid, { userId: uid, ready: false, cardsCount: 1, cards: [] });
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }
  setOptions(roomId, userId, opts = {}) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (String(userId) !== String(r.hostId)) throw new Error('not_host');
    if (typeof opts.visibility !== 'undefined') r.visibility = (opts.visibility === 'public' ? 'public' : 'private');
    if (typeof opts.costType !== 'undefined') r.costType = (['free','fuego'].includes(opts.costType) ? opts.costType : r.costType);
    if (typeof opts.costValue !== 'undefined') r.costValue = Math.max(0, Number(opts.costValue || 1) || 1);
    if (typeof opts.mode !== 'undefined') r.mode = (['linea','4c','carton'].includes(opts.mode) ? opts.mode : r.mode);
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }
  setReady(roomId, userId, { ready, cardsCount }) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (r.status !== 'lobby') throw new Error('already_started');
    const uid = String(userId);
    const p = r.players.get(uid); if (!p) throw new Error('not_in_room');
    if (typeof cardsCount !== 'undefined') p.cardsCount = Math.max(1, Math.min(10, Number(cardsCount) || 1));
    if (typeof ready !== 'undefined') p.ready = !!ready;
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }
  start(roomId, userId) {
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (String(userId) !== String(r.hostId)) throw new Error('not_host');
    if (r.status !== 'lobby') throw new Error('already_started');
    // Generar cartas y cobrar si aplica
    const players = Array.from(r.players.values());
    const actives = players.filter(p => p.ready && p.cardsCount > 0);
    if (actives.length === 0) throw new Error('no_ready_players');
    let pot = 0; const charged = [];
    for (const p of actives) {
      p.cards = this.generateCards(p.cardsCount);
      if (r.costType === 'fuego' && r.costValue > 0) {
        const total = Math.max(0, Math.floor(Number(r.costValue) || 0)) * p.cardsCount;
        const rs = mem.trySpendFires({ userId: p.userId, amount: total, reason: 'bingo_entry' });
        if (!rs || !rs.ok) { p.ready = false; p.cards = []; continue; }
        pot += total; charged.push({ userId: p.userId, amount: total });
      }
    }
    if (actives.filter(p => p.ready).length === 0) throw new Error('no_paid_players');
    r.potFires = pot;
    r.drawQueue = this.shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
    r.called = []; r.lastCall = null; r.winners = [];
    r.status = 'playing';
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }

  checkCardWin(card, calledSet, mode) {
    // card: 5x5 numbers, 'FREE' at [2][2]
    const isCalled = (n, r, c) => (r === 2 && c === 2) ? true : calledSet.has(n);
    // filas y columnas completas
    const hasLine = () => {
      for (let r = 0; r < 5; r++) {
        let ok = true; for (let c = 0; c < 5; c++) { if (!isCalled(card[r][c], r, c)) { ok = false; break; } }
        if (ok) return true;
      }
      for (let c = 0; c < 5; c++) {
        let ok = true; for (let r = 0; r < 5; r++) { if (!isCalled(card[r][c], r, c)) { ok = false; break; } }
        if (ok) return true;
      }
      // diagonales
      let okd1 = true; for (let i = 0; i < 5; i++) if (!isCalled(card[i][i], i, i)) { okd1 = false; break; }
      let okd2 = true; for (let i = 0; i < 5; i++) if (!isCalled(card[i][4-i], i, 4-i)) { okd2 = false; break; }
      return okd1 || okd2;
    };
    const hasCorners = () => isCalled(card[0][0],0,0) && isCalled(card[0][4],0,4) && isCalled(card[4][0],4,0) && isCalled(card[4][4],4,4);
    const hasFull = () => {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (!isCalled(card[r][c], r, c)) return false;
        }
      }
      return true;
    };
    if (mode === '4c') return hasCorners();
    if (mode === 'carton') return hasFull();
    return hasLine();
  }

  drawNext(roomId, userId) {
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (String(userId) !== String(r.hostId)) throw new Error('not_host');
    if (r.status !== 'playing') throw new Error('not_playing');
    if (r.drawQueue.length === 0) throw new Error('empty_bag');
    const n = r.drawQueue.shift();
    r.called.push(n); r.lastCall = n;
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }

  claim(roomId, userId, { cardIndex = 0 } = {}) {
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (r.status !== 'playing') throw new Error('not_playing');
    const p = r.players.get(String(userId)); if (!p) throw new Error('not_in_room');
    const card = (p.cards && p.cards[cardIndex]) || null; if (!card) throw new Error('invalid_card');
    const calledSet = new Set(r.called);
    const win = this.checkCardWin(card, calledSet, r.mode);
    if (!win) throw new Error('no_bingo');
    r.status = 'finished';
    r.winners = [{ userId: p.userId, cardIndex }];
    // Distribución del pozo: 70% ganador, 20% host, 10% sponsor fijo
    const pot = Math.max(0, Number(r.potFires || 0));
    const wAmt = Math.floor(pot * 0.70);
    const hAmt = Math.floor(pot * 0.20);
    const sAmt = Math.max(0, pot - (wAmt + hAmt));
    if (wAmt > 0) mem.addFiresAdmin({ userId: p.userId, amount: wAmt, reason: 'bingo_win_70' });
    if (hAmt > 0) mem.addFiresAdmin({ userId: r.hostId, amount: hAmt, reason: 'bingo_host_20' });
    if (sAmt > 0) mem.addFiresAdmin({ userId: '1417856820', amount: sAmt, reason: 'bingo_sponsor_10' });
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }

  rematch(roomId, userId) {
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    // Solo el anfitrión puede forzar revancha
    if (String(userId) !== String(r.hostId)) throw new Error('not_host');
    if (r.status !== 'finished') throw new Error('not_finished');
    // Reset de estado a lobby, conservar opciones
    r.status = 'lobby';
    r.potFires = 0;
    r.drawQueue = [];
    r.called = [];
    r.lastCall = null;
    r.winners = [];
    // Limpiar cartas y marcar no ready para todos, mantener cardsCount elegido
    for (const p of r.players.values()) { p.ready = false; p.cards = []; }
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }

  onRoom(roomId, fn) { const ev = 'room_update_' + String(roomId); this.on(ev, fn); return () => this.off(ev, fn); }
}

module.exports = new BingoStore();
