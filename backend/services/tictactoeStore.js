const EventEmitter = require('events');

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
  createRoom(hostId) {
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
      code: this.makeCode()
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
      code: r.code
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
  joinRoom(roomId, userId) {
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    const uid = String(userId);
    if (!r.players.X) r.players.X = uid;
    else if (!r.players.O && r.players.X !== uid) r.players.O = uid;
    const both = r.players.X && r.players.O;
    if (both && r.status !== 'finished') {
      r.status = 'playing';
      if (!r.lastMoveAt) r.lastMoveAt = Date.now();
      r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
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
    } else {
      r.turn = r.turn === 'X' ? 'O' : 'X';
      r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  onRoom(roomId, fn) {
    const ev = 'room_update_' + String(roomId);
    this.on(ev, fn);
    return () => this.off(ev, fn);
  }
}

module.exports = new TTTStore();
