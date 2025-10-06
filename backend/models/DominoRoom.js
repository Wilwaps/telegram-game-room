class DominoRoom {
  constructor({ code, host, isPublic = false, mode = 'friendly', stake = 1 }) {
    this.code = code;
    this.host = host; // userId
    this.isPublic = !!isPublic;
    this.mode = mode; // 'friendly' | 'normal'
    this.stake = Math.max(1, Math.min(10, parseInt(stake, 10) || 1));

    this.status = 'waiting'; // waiting|playing|finished
    this.players = []; // [{userId,userName,joinTime,isReady}]

    // Match / scoring
    this.matchId = `${Date.now()}`;
    this.scores = {}; // userId -> points

    // Round state
    this.roundId = 0;
    this.hands = {}; // userId -> [tileId]
    this.boneyard = []; // usual 4J double-six has no boneyard; kept for flexibility
    this.board = { tiles: [], leftOpen: null, rightOpen: null };
    this.turnUserId = null;
    this.passesInRow = 0;
    this.openingPlayerId = null;

    // Economy (normal mode)
    this.entries = {}; // userId -> stake paid
    this.payoutDone = false;

    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  addPlayer({ userId, userName }) {
    if (this.players.find(p => p.userId === userId)) return;
    const now = Date.now();
    this.players.push({ userId, userName, joinTime: now, isReady: false });
    this.scores[userId] = this.scores[userId] || 0;
    this.lastActivity = now;
  }

  removePlayer(userId) {
    this.players = this.players.filter(p => p.userId !== userId);
    delete this.hands[userId];
    delete this.entries[userId];
    this.lastActivity = Date.now();
  }

  isFull() { return this.players.length >= 4; }
  isEmpty() { return this.players.length === 0; }
  isHost(userId) { return this.host === userId; }

  setReady(userId, ready) {
    const p = this.players.find(x => x.userId === userId);
    if (p) p.isReady = !!ready;
  }

  allReady() {
    return this.players.length === 4 && this.players.every(p => p.isReady);
  }

  toJSON() {
    return {
      code: this.code,
      gameType: 'domino',
      host: this.host,
      isPublic: this.isPublic,
      mode: this.mode,
      stake: this.stake,
      status: this.status,
      players: this.players,
      matchId: this.matchId,
      scores: this.scores,
      roundId: this.roundId,
      board: this.board,
      turnUserId: this.turnUserId,
      passesInRow: this.passesInRow,
      openingPlayerId: this.openingPlayerId,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }

  static fromJSON(data){
    const r = new DominoRoom({ code: data.code, host: data.host, isPublic: data.isPublic, mode: data.mode, stake: data.stake });
    r.status = data.status;
    r.players = Array.isArray(data.players) ? data.players : [];
    r.matchId = data.matchId || `${Date.now()}`;
    r.scores = data.scores || {};
    r.roundId = data.roundId || 0;
    r.hands = data.hands || {};
    r.boneyard = data.boneyard || [];
    r.board = data.board || { tiles: [], leftOpen: null, rightOpen: null };
    r.turnUserId = data.turnUserId || null;
    r.passesInRow = data.passesInRow || 0;
    r.openingPlayerId = data.openingPlayerId || null;
    r.entries = data.entries || {};
    r.payoutDone = !!data.payoutDone;
    r.createdAt = data.createdAt || Date.now();
    r.lastActivity = data.lastActivity || Date.now();
    return r;
  }
}

module.exports = DominoRoom;
