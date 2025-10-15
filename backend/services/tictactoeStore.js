const EventEmitter = require('events');
const mem = require('./memoryStore');

class TTTStore extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.turnTimeoutMs = Math.max(1000, parseInt(process.env.TTT_TURN_TIMEOUT_MS || '30000', 10) || 30000);
    this.codeIndex = new Map(); // code -> roomId
  }
  newId() {
    return 'ttt_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }
  makeCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  createRoom(hostId, opts = {}) {
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
      score: { ...r.score },
      round: r.round,
      rematchVotes: { X: !!(r.rematchVotes && r.rematchVotes.X), O: !!(r.rematchVotes && r.rematchVotes.O) },
      playerNames: {
        X: r.players.X ? (mem.getUser(r.players.X)?.userName || r.players.X) : null,
        O: r.players.O ? (mem.getUser(r.players.O)?.userName || r.players.O) : null
      }
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
    const both = r.players.X && r.players.O;
    if (both && r.status !== 'finished') {
      // Cobro de entrada si aplica
      let canStart = true;
      if (r.costType !== 'free' && r.costValue > 0) {
        const charge = (pid) => {
          if (pid === 'X' && r.paidFlags.X) return true;
          if (pid === 'O' && r.paidFlags.O) return true;
          const targetId = (pid === 'X') ? r.players.X : r.players.O;
          if (!targetId) return false;
          if (r.costType === 'coins') {
            const rs = mem.trySpendCoins({ userId: targetId, amount: r.costValue, reason: 'ttt_entry' });
            if (rs && rs.ok) { r.paidFlags[pid] = true; return true; }
            return false;
          } else if (r.costType === 'fuego') {
            const rs = mem.trySpendFires({ userId: targetId, amount: r.costValue, reason: 'ttt_entry' });
            if (rs && rs.ok) { r.paidFlags[pid] = true; return true; }
            return false;
          }
          return true;
        };
        const xok = charge('X');
        const ook = charge('O');
        canStart = xok && ook;
      }
      if (canStart) {
        r.status = 'playing';
        if (!r.lastMoveAt) r.lastMoveAt = Date.now();
        r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
      } else {
        r.status = 'waiting';
      }
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
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
      const both = r.players.X && r.players.O;
      r.status = both ? 'playing' : 'waiting';
      r.turnDeadline = both ? (r.lastMoveAt + this.turnTimeoutMs) : null;
      r.rematchVotes = { X: false, O: false };
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  tick() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      if (r && r.status === 'playing' && r.turnDeadline && now > r.turnDeadline) {
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
