const EventEmitter = require('events');
const mem = require('./memoryStore');

const SPONSOR_ID = 'tg:1417856820';

class BingoStore extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.codeIndex = new Map();
    this.sponsorId = SPONSOR_ID;
  }
  potUserId(id){ return 'pot:' + String(id); }
  newId() { return 'bing_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
  makeCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  // Utilidades de cartones
  randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  randomUnique(count, min, max) {
    const lo = Math.floor(Number(min) || 0);
    const hi = Math.floor(Number(max) || 0);
    if (hi < lo) return [];
    const total = Math.min(Math.max(1, Number(count) || 1), hi - lo + 1);
    const pool = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    this.shuffle(pool);
    return pool.slice(0, total).sort((a, b) => a - b);
  }
  generateCard(ballSet = 90) {
    const max = [75,90].includes(Number(ballSet)) ? Number(ballSet) : 90;
    const ranges = ballSet === 75
      ? [ [1,15], [16,30], [31,45], [46,60], [61,75] ]
      : [ [1,18], [19,36], [37,54], [55,72], [73,90] ];
    const columns = ranges.map(([a,b]) => this.randomUnique(5, a, b));
    const card = Array.from({ length: 5 }, () => Array(5).fill(null));
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 5; r++) {
        card[r][c] = columns[c][r];
      }
    }
    card[2][2] = 'FREE';
    return card;
  }
  generateCards(n = 1) { n = Math.max(1, Math.min(10, Number(n) || 1)); return Array.from({ length: n }, () => this.generateCard()); }
  generateCardsForPlayers(players, ballSet = 90) {
    const cards = [];
    for (const p of players) {
      const playerCards = Array.from({ length: p.cardsCount }, () => this.generateCard(ballSet));
      cards.push(playerCards);
    }
    return cards;
  }

  createRoom({ userId, visibility = 'private', costType = 'free', costValue = 1, mode = 'linea', ballSet = 90 }) {
    // costo por cartón: 1 cuando es coins/fuego; 0 en free
    const finalCost = (['fuego','coins'].includes(costType)) ? 1 : 0;
    const id = this.newId();
    const state = {
      id,
      code: this.makeCode(),
      createdAt: Date.now(),
      hostId: String(userId),
      visibility: (visibility === 'public' ? 'public' : 'private'),
      costType: ['free','fuego','coins'].includes(costType) ? costType : 'free',
      costValue: finalCost,
      mode: ['linea','4c','carton'].includes(mode) ? mode : 'linea',
      ballSet: [75,90].includes(Number(ballSet)) ? Number(ballSet) : 90,
      status: 'lobby', // lobby | playing | finished
      players: new Map(), // userId -> { userId, ready, cardsCount, cards }
      potFires: 0,
      potCoins: 0,
      drawQueue: [], // números restantes por salir
      called: [],
      lastCall: null,
      winners: [],
      lastPayout: null
    };
    // Host entra por defecto, 1 cartón y no ready
    state.players.set(String(userId), { userId: String(userId), ready: false, cardsCount: 1, cards: [] });
    this.rooms.set(id, state);
    this.codeIndex.set(state.code, id);
    return this.getState(id);
  }

  getState(roomId) {
    const r = this.rooms.get(String(roomId));
    if (!r) return null;
    // Leer pot real desde cuenta pot
    const pot = (()=>{ try { return mem.getUser(this.potUserId(r.id)) || null; } catch(_){ return null; } })();
    const potFires = Math.max(0, Number(pot && pot.fires || 0));
    const potCoins = Math.max(0, Number(pot && pot.coins || 0));
    const players = Array.from(r.players.values()).map(p => ({ userId: p.userId, ready: p.ready, cardsCount: p.cardsCount, cards: p.cards && p.cards.length ? p.cards : undefined }));
    return {
      id: r.id,
      code: r.code,
      createdAt: r.createdAt,
      hostId: r.hostId,
      visibility: r.visibility,
      costType: r.costType,
      costValue: r.costValue,
      ballSet: r.ballSet,
      mode: r.mode,
      status: r.status,
      players,
      potFires,
      potCoins,
      called: [...r.called],
      lastCall: r.lastCall,
      winners: [...r.winners],
      lastPayout: r.lastPayout || null
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
    const uid = String(userId);
    const exists = r.players.has(uid);
    if (!exists && r.status !== 'lobby') throw new Error('already_started');
    if (!exists) {
      // límite de 30 jugadores
      if (r.players.size >= 30) throw new Error('max_players');
      r.players.set(uid, { userId: uid, ready: false, cardsCount: 1, cards: [] });
    }
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }
  setOptions(roomId, userId, opts = {}) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (String(userId) !== String(r.hostId)) throw new Error('not_host');
    if (r.status !== 'lobby') throw new Error('already_started');
    if (typeof opts.visibility !== 'undefined') r.visibility = (opts.visibility === 'public' ? 'public' : 'private');
    if (typeof opts.costType !== 'undefined') r.costType = (['free','fuego','coins'].includes(opts.costType) ? opts.costType : r.costType);
    if (typeof opts.costValue !== 'undefined') {
      // costo fijo 1 por cartón para coins/fuego
      const raw = Math.max(0, Number(opts.costValue || 1) || 1);
      r.costValue = (r.costType === 'free') ? 0 : 1;
    }
    if (typeof opts.mode !== 'undefined') r.mode = (['linea','4c','carton'].includes(opts.mode) ? opts.mode : r.mode);
    if (typeof opts.ballSet !== 'undefined') r.ballSet = (['75','90'].includes(opts.ballSet) ? Number(opts.ballSet) : r.ballSet);
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
  start({ roomId, userId }) {
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (String(userId) !== String(r.hostId)) throw new Error('not_host');
    if (r.status !== 'lobby') throw new Error('already_started');
    // Generar cartas y cobrar si aplica
    const players = Array.from(r.players.values());
    const actives = players.filter(p => p.ready && p.cardsCount > 0);
    if (actives.length === 0) throw new Error('no_ready_players');
    const potId = this.potUserId(r.id);
    try { mem.ensureUser(potId); } catch(_){ }
    let paidCount = 0;
    for (const p of actives) {
      const playerCards = Array.from({ length: p.cardsCount }, () => this.generateCard(r.ballSet));
      p.cards = playerCards;
      const isHost = String(p.userId) === String(r.hostId);
      if (r.costType === 'fuego') {
        // host deposita 10 🔥 al pot
        if (isHost) {
          const dep = mem.transferFires({ fromUserId: p.userId, toUserId: potId, amount: 10, reason: 'bingo_host_open_fire' });
          if (!dep || !dep.ok) { p.ready=false; p.cards=[]; continue; }
          paidCount++;
        }
        const total = Math.max(0, Number(p.cardsCount||0)) * 1;
        if (total>0){
          const tr = mem.transferFires({ fromUserId: p.userId, toUserId: potId, amount: total, reason: 'bingo_entry_fire' });
          if (!tr || !tr.ok) { p.ready=false; p.cards=[]; continue; }
          paidCount++;
        }
      } else if (r.costType === 'coins') {
        if (isHost) {
          const dep = mem.transferCoins({ fromUserId: p.userId, toUserId: potId, amount: 10, reason: 'bingo_host_open_coin' });
          if (!dep || !dep.ok) { p.ready=false; p.cards=[]; continue; }
          paidCount++;
        }
        const total = Math.max(0, Number(p.cardsCount||0)) * 1;
        if (total>0){
          const tr = mem.transferCoins({ fromUserId: p.userId, toUserId: potId, amount: total, reason: 'bingo_entry_coin' });
          if (!tr || !tr.ok) { p.ready=false; p.cards=[]; continue; }
          paidCount++;
        }
      }
    }
    if (actives.filter(p => p.ready).length === 0 || paidCount===0) throw new Error('no_paid_players');
    r.drawQueue = this.makeBag(r.ballSet);
    r.called = []; r.lastCall = null; r.winners = [];
    r.status = 'playing';
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }

  makeBag(ballSet = 90) {
    const arr = [];
    const max = [75,90].includes(Number(ballSet)) ? Number(ballSet) : 90;
    for (let i=1;i<=max;i++) arr.push(i);
    return this.shuffle(arr);
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

  draw({ roomId, userId }) {
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
    // Estadísticas por usuario
    try {
      const winnerId = String(p.userId);
      // Ganador
      mem.recordGameResult({ userId: winnerId, game: 'bingo', result: 'win' });
      // Perdedor(es)
      for (const other of r.players.values()) {
        const oid = String(other.userId||''); if (!oid || oid===winnerId) continue;
        mem.recordGameResult({ userId: oid, game: 'bingo', result: 'loss' });
      }
    } catch(_) {}
    // Distribución del pozo real desde cuenta pot: 70% ganador, 20% host, 10% sponsor
    const potId = this.potUserId(r.id);
    const potUser = (()=>{ try { return mem.getUser(potId) || null; } catch(_){ return null; } })();
    const curF = Math.max(0, Number(potUser && potUser.fires || 0));
    const curC = Math.max(0, Number(potUser && potUser.coins || 0));
    let wFires=0,hFires=0,sFires=0,wCoins=0,hCoins=0,sCoins=0;
    if (r.costType === 'fuego' && curF>0){
      wFires = Math.floor(curF*0.70); hFires = Math.floor(curF*0.20); sFires = Math.max(0, curF - wFires - hFires);
      try{ if (wFires>0) mem.transferFires({ fromUserId: potId, toUserId: p.userId, amount: wFires, reason: 'bingo_win_70' }); }catch(_){ }
      try{ if (hFires>0) mem.transferFires({ fromUserId: potId, toUserId: r.hostId, amount: hFires, reason: 'bingo_host_20' }); }catch(_){ }
      try{ if (sFires>0) mem.transferFires({ fromUserId: potId, toUserId: this.sponsorId, amount: sFires, reason: 'bingo_sponsor_10' }); }catch(_){ }
    } else if (r.costType === 'coins' && curC>0){
      wCoins = Math.floor(curC*0.70); hCoins = Math.floor(curC*0.20); sCoins = Math.max(0, curC - wCoins - hCoins);
      try{ if (wCoins>0) mem.transferCoins({ fromUserId: potId, toUserId: p.userId, amount: wCoins, reason: 'bingo_win_coins_70' }); }catch(_){ }
      try{ if (hCoins>0) mem.transferCoins({ fromUserId: potId, toUserId: r.hostId, amount: hCoins, reason: 'bingo_host_coins_20' }); }catch(_){ }
      try{ if (sCoins>0) mem.transferCoins({ fromUserId: potId, toUserId: this.sponsorId, amount: sCoins, reason: 'bingo_sponsor_coins_10' }); }catch(_){ }
    }

    try {
      mem.recordBingoWin({
        roomId: r.id,
        winnerId: p.userId,
        hostId: r.hostId,
        mode: r.mode,
        ballSet: r.ballSet,
        potFires: curF,
        potCoins: curC,
        winnerFires: wFires,
        hostFires: hFires,
        sponsorFires: sFires,
        winnerCoins: wCoins,
        hostCoins: hCoins,
        sponsorCoins: sCoins
      });
    } catch(_) {}

    r.lastPayout = {
      winnerFires: wFires,
      hostFires: hFires,
      sponsorFires: sFires,
      winnerCoins: wCoins,
      hostCoins: hCoins,
      sponsorCoins: sCoins
    };
    r.potFires = 0;
    r.potCoins = 0;
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
    r.lastPayout = null;
    // Limpiar cartas y marcar no ready para todos, mantener cardsCount elegido
    for (const p of r.players.values()) { p.ready = false; p.cards = []; }
    const s = this.getState(roomId); this.emit('room_update_' + r.id, s); return s;
  }

  onRoom(roomId, fn) { const ev = 'room_update_' + String(roomId); this.on(ev, fn); return () => this.off(ev, fn); }
}

module.exports = new BingoStore();
