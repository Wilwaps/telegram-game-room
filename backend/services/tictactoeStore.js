const EventEmitter = require('events');
const mem = require('./memoryStore');

class TTTStore extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.turnTimeoutMs = Math.max(1000, parseInt(process.env.TTT_TURN_TIMEOUT_MS || '30000', 10) || 30000);
    this.codeIndex = new Map(); // code -> roomId
  }
  potUserId(id) {
    return 'pot:' + String(id);
  }
  newId() {
    return 'ttt_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }
  makeCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  createRoom(hostId, opts = {}) {
    const existing = (()=>{ const uid=String(hostId); for (const r of this.rooms.values()){ if (r && r.players && r.players.X === uid && r.status !== 'finished') return r; } return null; })();
    if (existing) return this.getState(existing.id);
    const id = this.newId();
    const state = {
      id,
      createdAt: Date.now(),
      players: { X: String(hostId), O: null },
      board: Array(9).fill(null),
      turn: 'X',
      winner: null,
      status: 'waiting',
      lastMoveAt: null,
      turnDeadline: null,
      code: this.makeCode(),
      visibility: (opts.visibility === 'public' ? 'public' : 'private'),
      costType: (['free','coins','fuego'].includes(opts.costType) ? opts.costType : 'free'),
      costValue: Math.max(0, Number(opts.costValue || 0) || 0),
      score: { X: 0, O: 0 },
      round: 1,
      lastWinner: null,
      paidFlags: { X: false, O: false },
      rematchVotes: { X: false, O: false }
    };
    this.rooms.set(id, state);
    this.codeIndex.set(state.code, id);
    return this.getState(id);
  }
  getState(roomId) {
    const r = this.rooms.get(String(roomId));
    if (!r) return null;
    const pot = (()=>{ try { return mem.getUser(this.potUserId(r.id)) || null; } catch(_){ return null; } })();
    const potFires = Math.max(0, Number(pot && pot.fires || 0));
    const potCoins = Math.max(0, Number(pot && pot.coins || 0));
    const maskId = (uid)=>{
      const raw = String(uid||'');
      let seed = 0; for (let i=0;i<raw.length;i++){ seed = ((seed<<5)-seed) + raw.charCodeAt(i); seed|=0; }
      const tag = Math.abs(seed).toString(36).slice(-6).toUpperCase().padStart(6,'0');
      return 'User ' + tag;
    };
    const display = (uid)=>{ if(!uid) return null; const u = mem.getUser(uid); const n = u && u.userName ? String(u.userName).trim() : ''; return n || maskId(uid); };
    return {
      id: r.id,
      createdAt: r.createdAt,
      players: { X: r.players.X, O: r.players.O },
      board: [...r.board],
      turn: r.turn,
      winner: r.winner,
      status: r.status,
      lastMoveAt: r.lastMoveAt,
      turnDeadline: r.turnDeadline,
      code: r.code,
      visibility: r.visibility,
      costType: r.costType,
      costValue: r.costValue,
      potFires,
      potCoins,
      score: { ...r.score },
      round: r.round,
      rematchVotes: { X: !!(r.rematchVotes && r.rematchVotes.X), O: !!(r.rematchVotes && r.rematchVotes.O) },
      pausedBy: r.pausedBy || null,
      pauseUntil: r.pauseUntil || null,
      playerNames: { X: display(r.players.X), O: display(r.players.O) }
    };
  }
  listRoomsByUser(userId) {
    const uid = String(userId);
    const out = [];
    for (const r of this.rooms.values()) {
      if (r.players.X === uid || r.players.O === uid) out.push(this.getState(r.id));
    }
    out.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    return out;
  }
  findByCode(code) {
    const id = this.codeIndex.get(String(code));
    if (!id) return null;
    return this.getState(id);
  }
  listPublicRooms() {
    const out = [];
    for (const r of this.rooms.values()) {
      if (r.visibility === 'public') out.push(this.getState(r.id));
    }
    out.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    return out;
  }
  joinRoom(roomId, userId) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    const uid = String(userId);
    if (!r.players.X) r.players.X = uid;
    else if (!r.players.O && r.players.X !== uid) r.players.O = uid;
    // si estaba en pausa por desconexión y vuelve el mismo jugador, reanudar
    const seat = this.who(r, uid);
    if (seat && r.pauseUntil && r.pausedBy === seat) {
      r.pauseUntil = null; r.pausedBy = null;
      if (r.lastDisconnect) { try{ delete r.lastDisconnect[seat]; }catch(_){ } }
      if (r.status === 'playing') {
        r.lastMoveAt = Date.now();
        r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
      }
    }
    const both = r.players.X && r.players.O;
    if (both && r.status !== 'finished') {
      this.chargeAndMaybeStart(r);
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  closeRoom(roomId){
    const id = String(roomId);
    const r = this.rooms.get(id);
    if (!r) return false;
    try { if (r && r.code) this.codeIndex.delete(r.code); } catch(_){ }
    this.rooms.delete(id);
    return true;
  }
  setOptions(roomId, opts = {}) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (typeof opts.visibility !== 'undefined') {
      r.visibility = (opts.visibility === 'public' ? 'public' : 'private');
    }
    if (typeof opts.costType !== 'undefined') {
      r.costType = (['free','coins','fuego'].includes(opts.costType) ? opts.costType : r.costType);
    }
    if (typeof opts.costValue !== 'undefined') {
      r.costValue = Math.max(0, Number(opts.costValue || 0) || 0);
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  who(room, userId) {
    const uid = String(userId);
    if (room.players.X === uid) return 'X';
    if (room.players.O === uid) return 'O';
    return null;
  }
  leaveRoom(roomId, userId){
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    const uid = String(userId);
    const seat = this.who(r, uid);
    if (!seat) return { state: this.getState(roomId), closed: false };
    if (r.status === 'playing'){
      if (!r.lastDisconnect) r.lastDisconnect = {};
      r.lastDisconnect[seat] = Date.now();
      // activar pausa de 30s para reingreso
      r.pausedBy = seat;
      r.pauseUntil = Date.now() + 30000;
      const s = this.getState(roomId);
      this.emit('room_update_' + r.id, s);
      return { state: s, closed: false };
    }
    if (r.status === 'waiting'){
      if (seat === 'X'){
        if (!r.players.O){
          const ok = this.closeRoom(roomId);
          return { state: null, closed: ok };
        } else {
          r.players.X = r.players.O;
          r.players.O = null;
          const s = this.getState(roomId);
          this.emit('room_update_' + r.id, s);
          return { state: s, closed: false };
        }
      } else {
        r.players.O = null;
        const s = this.getState(roomId);
        this.emit('room_update_' + r.id, s);
        return { state: s, closed: false };
      }
    }
    if (r.status === 'finished'){
      if (seat === 'X') r.players.X = null;
      if (seat === 'O') r.players.O = null;
      if (!r.players.X && !r.players.O){
        const ok = this.closeRoom(roomId);
        return { state: null, closed: ok };
      }
      const s = this.getState(roomId);
      this.emit('room_update_' + r.id, s);
      return { state: s, closed: false };
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return { state: s, closed: false };
  }
  checkWinner(b) {
    const L = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (const [a,c,d] of L) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    if (b.every(x => x)) return 'draw';
    return null;
  }
  move({ roomId, userId, index }) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (r.status !== 'playing') throw new Error('not_playing');
    const me = this.who(r, userId);
    if (!me) throw new Error('not_in_room');
    // manejar timeout de turno
    const now = Date.now();
    const deadline = (r.lastMoveAt ? (r.lastMoveAt + this.turnTimeoutMs) : now + this.turnTimeoutMs);
    if (!r.turnDeadline) r.turnDeadline = deadline;
    if (now > deadline) {
      // expira turno: rota
      r.turn = r.turn === 'X' ? 'O' : 'X';
      r.lastMoveAt = now;
      r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
    }
    if (r.turn !== me) throw new Error('not_your_turn');
    const i = Number(index);
    if (!(i >= 0 && i < 9)) throw new Error('invalid_index');
    if (r.board[i]) throw new Error('occupied');
    r.board[i] = me;
    r.lastMoveAt = now;
    const w = this.checkWinner(r.board);
    if (w) {
      r.winner = w === 'draw' ? null : w;
      r.status = 'finished';
      r.turnDeadline = null;
      r.rematchVotes = { X: false, O: false };
      if (r.winner) {
        r.lastWinner = r.winner;
        if (r.winner === 'X') r.score.X += 1; else if (r.winner === 'O') r.score.O += 1;
        try {
          const xid = r.players.X, oid = r.players.O;
          if (xid && oid) {
            if (r.winner === 'X') {
              mem.recordGameResult({ userId: xid, game: 'tictactoe', result: 'win' });
              mem.recordGameResult({ userId: oid, game: 'tictactoe', result: 'loss' });
            } else if (r.winner === 'O') {
              mem.recordGameResult({ userId: oid, game: 'tictactoe', result: 'win' });
              mem.recordGameResult({ userId: xid, game: 'tictactoe', result: 'loss' });
            }
          }
        } catch(_) {}
      } else {
        r.lastWinner = null;
        try {
          const xid = r.players.X, oid = r.players.O;
          if (xid) mem.recordGameResult({ userId: xid, game: 'tictactoe', result: 'draw' });
          if (oid) mem.recordGameResult({ userId: oid, game: 'tictactoe', result: 'draw' });
        } catch(_) {}
      }
      // liquidar pot (pago a ganador o reembolso en empate)
      this.settlePot(r);
    } else {
      r.turn = r.turn === 'X' ? 'O' : 'X';
      r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  rematch(roomId, userId) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (r.status !== 'finished') throw new Error('not_finished');
    const me = this.who(r, userId);
    if (!me) throw new Error('not_in_room');
    if (!r.rematchVotes) r.rematchVotes = { X: false, O: false };
    r.rematchVotes[me] = true;
    const bothAccepted = !!r.rematchVotes.X && !!r.rematchVotes.O;
    if (bothAccepted) {
      r.round += 1;
      r.board = Array(9).fill(null);
      r.winner = null;
      r.lastMoveAt = Date.now();
      r.turn = (r.turn === 'X') ? 'O' : 'X';
      r.paidFlags = { X:false, O:false };
      r.rematchVotes = { X: false, O: false };
      // intentar cobrar y arrancar
      this.chargeAndMaybeStart(r);
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  tick() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      if (!r || r.status !== 'playing') continue;
      // si hay pausa activa, resolver o esperar
      if (r.pauseUntil && now >= r.pauseUntil) {
        // derrota del que salió
        const loser = r.pausedBy === 'X' ? 'X' : 'O';
        const winner = loser === 'X' ? 'O' : 'X';
        r.status = 'finished';
        r.winner = winner;
        r.lastWinner = winner;
        r.turnDeadline = null;
        r.rematchVotes = { X:false, O:false };
        if (winner === 'X') r.score.X += 1; else if (winner === 'O') r.score.O += 1;
        r.pausedBy = null; r.pauseUntil = null;
        try {
          const xid = r.players.X; const oid = r.players.O;
          if (xid && oid) {
            if (winner === 'X') { mem.recordGameResult({ userId: xid, game: 'tictactoe', result: 'win' }); mem.recordGameResult({ userId: oid, game: 'tictactoe', result: 'loss' }); }
            else { mem.recordGameResult({ userId: oid, game: 'tictactoe', result: 'win' }); mem.recordGameResult({ userId: xid, game: 'tictactoe', result: 'loss' }); }
          }
        } catch(_) {}
        this.settlePot(r);
        const s = this.getState(r.id);
        this.emit('room_update_' + r.id, s);
        continue;
      }
      if (r.pauseUntil && now < r.pauseUntil) {
        // en pausa: no aplicar timeout de turno
        continue;
      }
      if (r.turnDeadline && now > r.turnDeadline) {
        const loser = r.turn;
        const winner = loser === 'X' ? 'O' : 'X';
        r.status = 'finished';
        r.winner = winner;
        r.lastWinner = winner;
        r.turnDeadline = null;
        r.rematchVotes = { X: false, O: false };
        if (winner === 'X') r.score.X += 1; else if (winner === 'O') r.score.O += 1;
        try {
          const xid = r.players.X;
          const oid = r.players.O;
          if (xid && oid) {
            if (winner === 'X') {
              mem.recordGameResult({ userId: xid, game: 'tictactoe', result: 'win' });
              mem.recordGameResult({ userId: oid, game: 'tictactoe', result: 'loss' });
            } else if (winner === 'O') {
              mem.recordGameResult({ userId: oid, game: 'tictactoe', result: 'win' });
              mem.recordGameResult({ userId: xid, game: 'tictactoe', result: 'loss' });
            }
          }
        } catch(_) {}
        // liquidar pot
        this.settlePot(r);
        const s = this.getState(r.id);
        this.emit('room_update_' + r.id, s);
      }
    }
  }
  onRoom(roomId, fn) {
    const ev = 'room_update_' + String(roomId);
    this.on(ev, fn);
    return () => this.off(ev, fn);
  }
}

module.exports = new TTTStore();
