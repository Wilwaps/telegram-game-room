const EventEmitter = require('events');
const mem = require('./memoryStore');
let walletRepo = null; try { walletRepo = require('../repos/walletRepo'); } catch(_) { walletRepo = null; }
let logger = null; try { logger = require('../config/logger'); } catch(_) { logger = console; }

class TTTStore extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.turnTimeoutMs = Math.max(1000, parseInt(process.env.TTT_TURN_TIMEOUT_MS || '10000', 10) || 10000);
    this.codeIndex = new Map(); // code -> roomId
    this.dbWalletEnabled = String(process.env.TTT_DB_WALLET || 'false').toLowerCase() === 'true';
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
      costType: (['coins','fuego'].includes(opts.costType) ? opts.costType : 'coins'),
      costValue: Math.max(1, Number(opts.costValue || 1) || 1),
      score: { X: 0, O: 0 },
      round: 1,
      lastWinner: null,
      paidFlags: { X: false, O: false },
      _dbPot: { type: null, amount: 0 },
      rematchVotes: { X: false, O: false },
      ready: { X: false, O: false },
      pauseBudgetMs: { X: 30000, O: 30000 }
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
      ready: { X: !!(r.ready && r.ready.X), O: !!(r.ready && r.ready.O) },
      pauseBudget: { X: Math.max(0, r.pauseBudgetMs?.X||0), O: Math.max(0, r.pauseBudgetMs?.O||0) },
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
  async chargeAndMaybeStart(r) {
    if (!r) return false;
    if (!(r.players && r.players.X && r.players.O)) return false;
    if (r.status === 'playing') return true;
    const ct = String(r.costType||'coins');
    const cv = Math.max(1, Number(r.costValue||1) || 1);
    const potId = this.potUserId(r.id);
    if (!r.paidFlags) r.paidFlags = { X:false, O:false };
    try {
      // Sincronizar saldos desde billetera externa si aplica (tg:/db:/em:) y si está habilitado
      try { if (this.dbWalletEnabled && typeof mem.syncFromExtWallet === 'function') { await mem.syncFromExtWallet(r.players.X); await mem.syncFromExtWallet(r.players.O); } } catch(_){ }
      // Si DB está habilitado, solo debitar en DB. Si no, solo en memoria.
      if (ct === 'coins') {
        if (this.dbWalletEnabled && walletRepo && typeof walletRepo.debitCoinsByExt === 'function') {
          // Modo DB: solo debitar en DB
          if (!r.paidFlags.X) {
            const dx = await walletRepo.debitCoinsByExt(r.players.X, cv, { type: 'ttt_wager_debit', reference: r.id, meta: { roomId: r.id, round: r.round } });
            if (!dx || !dx.ok) { logger.info && logger.info(`[TTT] debitCoins X failed`, { roomId: r.id, user: r.players.X, error: dx && dx.error }); return false; }
            r.paidFlags.X = true;
            r._dbPot.type = 'coins';
            r._dbPot.amount = Math.max(0, Number(r._dbPot.amount||0)) + cv;
          }
          if (!r.paidFlags.O) {
            const dox = await walletRepo.debitCoinsByExt(r.players.O, cv, { type: 'ttt_wager_debit', reference: r.id, meta: { roomId: r.id, round: r.round } });
            if (!dox || !dox.ok) {
              // Revertir X si fue debitado en este intento
              try { if (r.paidFlags.X) { await walletRepo.creditCoinsByExt(r.players.X, cv, { type: 'ttt_wager_refund', reference: r.id, meta: { roomId: r.id, round: r.round } }); r.paidFlags.X = false; r._dbPot.amount = Math.max(0, Number(r._dbPot.amount||0) - cv); } } catch(_){}
              logger.info && logger.info(`[TTT] debitCoins O failed`, { roomId: r.id, user: r.players.O, error: dox && dox.error });
              return false;
            }
            r.paidFlags.O = true;
            r._dbPot.amount = Math.max(0, Number(r._dbPot.amount||0)) + cv;
          }
        } else {
          // Modo memoria: transferir al pot en memoria
          if (!r.paidFlags.X) {
            const rx = mem.transferCoins({ fromUserId: r.players.X, toUserId: potId, amount: cv, reason: 'ttt_wager_pot' });
            if (!rx || !rx.ok) { logger.info && logger.info(`[TTT] mem.transferCoins X failed`, { roomId: r.id }); return false; }
            r.paidFlags.X = true;
          }
          if (!r.paidFlags.O) {
            const ro = mem.transferCoins({ fromUserId: r.players.O, toUserId: potId, amount: cv, reason: 'ttt_wager_pot' });
            if (!ro || !ro.ok) { logger.info && logger.info(`[TTT] mem.transferCoins O failed`, { roomId: r.id }); return false; }
            r.paidFlags.O = true;
          }
        }
      } else if (ct === 'fuego') {
        if (this.dbWalletEnabled && walletRepo && typeof walletRepo.debitFiresByExt === 'function') {
          // Modo DB: solo debitar en DB
          if (!r.paidFlags.X) {
            const dx = await walletRepo.debitFiresByExt(r.players.X, cv, { type: 'ttt_wager_debit', reference: r.id, meta: { roomId: r.id, round: r.round } });
            if (!dx || !dx.ok) { logger.info && logger.info(`[TTT] debitFires X failed`, { roomId: r.id, user: r.players.X, error: dx && dx.error }); return false; }
            r.paidFlags.X = true;
            r._dbPot.type = 'fuego';
            r._dbPot.amount = Math.max(0, Number(r._dbPot.amount||0)) + cv;
          }
          if (!r.paidFlags.O) {
            const dox = await walletRepo.debitFiresByExt(r.players.O, cv, { type: 'ttt_wager_debit', reference: r.id, meta: { roomId: r.id, round: r.round } });
            if (!dox || !dox.ok) {
              // Revertir X si fue debitado en este intento
              try { if (r.paidFlags.X) { await walletRepo.creditFiresByExt(r.players.X, cv, { type: 'ttt_wager_refund', reference: r.id, meta: { roomId: r.id, round: r.round } }); r.paidFlags.X = false; r._dbPot.amount = Math.max(0, Number(r._dbPot.amount||0) - cv); } } catch(_){ }
              logger.info && logger.info(`[TTT] debitFires O failed`, { roomId: r.id, user: r.players.O, error: dox && dox.error });
              return false;
            }
            r.paidFlags.O = true;
            r._dbPot.amount = Math.max(0, Number(r._dbPot.amount||0)) + cv;
          }
        } else {
          // Modo memoria: transferir al pot en memoria
          if (!r.paidFlags.X) {
            const rx = mem.transferFires({ fromUserId: r.players.X, toUserId: potId, amount: cv, reason: 'ttt_wager_pot' });
            if (!rx || !rx.ok) { logger.info && logger.info(`[TTT] mem.transferFires X failed`, { roomId: r.id }); return false; }
            r.paidFlags.X = true;
          }
          if (!r.paidFlags.O) {
            const ro = mem.transferFires({ fromUserId: r.players.O, toUserId: potId, amount: cv, reason: 'ttt_wager_pot' });
            if (!ro || !ro.ok) { logger.info && logger.info(`[TTT] mem.transferFires O failed`, { roomId: r.id }); return false; }
            r.paidFlags.O = true;
          }
        }
      }
      if (r.paidFlags.X && r.paidFlags.O) {
        r.status = 'playing';
        r.lastMoveAt = Date.now();
        r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
        r.rematchVotes = { X:false, O:false };
        logger.info && logger.info(`[TTT] Start OK`, { roomId: r.id, costType: ct, costValue: cv, dbPot: r._dbPot });
        return true;
      }
    } catch (_) {}
    return false;
  }
  settlePot(r) {
    if (!r) return;
    const potId = this.potUserId(r.id);
    const pot = mem.getUser(potId) || { coins:0, fires:0 };
    const potCoins = Math.max(0, Number(pot.coins||0));
    const potFires = Math.max(0, Number(pot.fires||0));
    try {
      if (r.winner) {
        const winId = r.winner === 'X' ? r.players.X : r.players.O;
        // Si DB está habilitado, usar el pot DB. Si no, usar memoria
        if (this.dbWalletEnabled && r._dbPot && r._dbPot.type && walletRepo) {
          const amt = Math.max(0, Number(r._dbPot.amount||0))*2; // *2 porque ambos jugadores pagaron
          if (r._dbPot.type === 'fuego' && typeof walletRepo.creditFiresByExt === 'function') {
            walletRepo.creditFiresByExt(winId, amt, { type:'ttt_wager_win', reference: r.id, meta: { roomId: r.id, round: r.round } });
          } else if (r._dbPot.type === 'coins' && typeof walletRepo.creditCoinsByExt === 'function') {
            walletRepo.creditCoinsByExt(winId, amt, { type:'ttt_wager_win', reference: r.id, meta: { roomId: r.id, round: r.round } });
          }
        } else {
          // Modo memoria: transferir desde pot
          if (potCoins > 0) mem.transferCoins({ fromUserId: potId, toUserId: winId, amount: potCoins, reason: 'ttt_wager_win' });
          if (potFires > 0) mem.transferFires({ fromUserId: potId, toUserId: winId, amount: potFires, reason: 'ttt_wager_win' });
        }
      } else {
        // Empate: dividir entre ambos
        if (this.dbWalletEnabled && r._dbPot && r._dbPot.type && walletRepo) {
          const amt = Math.max(0, Number(r._dbPot.amount||0)); // Cada uno recupera lo que apostó
          if (r._dbPot.type === 'fuego' && typeof walletRepo.creditFiresByExt === 'function') {
            if (r.players.X) walletRepo.creditFiresByExt(r.players.X, amt, { type:'ttt_wager_draw', reference: r.id, meta: { roomId: r.id, round: r.round } });
            if (r.players.O) walletRepo.creditFiresByExt(r.players.O, amt, { type:'ttt_wager_draw', reference: r.id, meta: { roomId: r.id, round: r.round } });
          } else if (r._dbPot.type === 'coins' && typeof walletRepo.creditCoinsByExt === 'function') {
            if (r.players.X) walletRepo.creditCoinsByExt(r.players.X, amt, { type:'ttt_wager_draw', reference: r.id, meta: { roomId: r.id, round: r.round } });
            if (r.players.O) walletRepo.creditCoinsByExt(r.players.O, amt, { type:'ttt_wager_draw', reference: r.id, meta: { roomId: r.id, round: r.round } });
          }
        } else {
          // Modo memoria: dividir pot
          const halfC = Math.floor(potCoins / 2);
          const halfF = Math.floor(potFires / 2);
          if (potCoins > 0) {
            if (r.players.X) mem.transferCoins({ fromUserId: potId, toUserId: r.players.X, amount: halfC, reason: 'ttt_wager_draw' });
            if (r.players.O) mem.transferCoins({ fromUserId: potId, toUserId: r.players.O, amount: potCoins - halfC, reason: 'ttt_wager_draw' });
          }
          if (potFires > 0) {
            if (r.players.X) mem.transferFires({ fromUserId: potId, toUserId: r.players.X, amount: halfF, reason: 'ttt_wager_draw' });
            if (r.players.O) mem.transferFires({ fromUserId: potId, toUserId: r.players.O, amount: potFires - halfF, reason: 'ttt_wager_draw' });
          }
        }
      }
    } catch (_) {}
    // limpiar pot DB de la ronda
    try { if (r && r._dbPot) r._dbPot = { type:null, amount:0 }; } catch(_){ }
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
      const rem = Math.max(0, Number(r.pauseUntil) - Date.now());
      if (!r.pauseBudgetMs) r.pauseBudgetMs = { X:30000, O:30000 };
      r.pauseBudgetMs[seat] = rem;
      r.pauseUntil = null; r.pausedBy = null;
      if (r.lastDisconnect) { try{ delete r.lastDisconnect[seat]; }catch(_){ } }
      if (r.status === 'playing') {
        r.lastMoveAt = Date.now();
        r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
      }
    }
    // no auto-start; el host debe iniciar manualmente
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
      r.costType = (['coins','fuego'].includes(opts.costType) ? opts.costType : r.costType);
    }
    if (typeof opts.costValue !== 'undefined') {
      r.costValue = Math.max(1, Number(opts.costValue || 1) || 1);
    }
    // cambiar modo desactiva listo del invitado y reinicia pagos
    if (!r.ready) r.ready = { X:false, O:false };
    r.ready.O = false;
    r.paidFlags = { X:false, O:false };
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
      // activar pausa con presupuesto restante acumulativo
      if (!r.pauseBudgetMs) r.pauseBudgetMs = { X:30000, O:30000 };
      const budget = Math.max(0, Number(r.pauseBudgetMs[seat] || 30000));
      if (budget <= 0) {
        // sin presupuesto: derrota inmediata
        const loser = seat;
        const winner = loser === 'X' ? 'O' : 'X';
        r.status = 'finished';
        r.winner = winner;
        r.lastWinner = winner;
        r.turnDeadline = null;
        r.rematchVotes = { X:false, O:false };
        if (winner === 'X') r.score.X += 1; else if (winner === 'O') r.score.O += 1;
        this.settlePot(r);
        const s = this.getState(r.id);
        this.emit('room_update_' + r.id, s);
        return { state: s, closed: false };
      }
      r.pausedBy = seat;
      r.pauseUntil = Date.now() + budget;
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
      r.lastMoveAt = null;
      r.turnDeadline = null;
      r.status = 'waiting';
      r.turn = (r.turn === 'X') ? 'O' : 'X';
      r.paidFlags = { X:false, O:false };
      r.rematchVotes = { X: false, O: false };
      r.ready = { X:false, O:false };
    }
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  setReady(roomId, userId, ready){
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    const seat = this.who(r, userId);
    if (!seat) throw new Error('not_in_room');
    if (!r.ready) r.ready = { X:false, O:false };
    r.ready[seat] = !!ready;
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    return s;
  }
  async startGame(roomId, userId){
    const r = this.rooms.get(String(roomId));
    if (!r) throw new Error('room_not_found');
    if (!r.players.X || !r.players.O) throw new Error('both_required');
    const seat = this.who(r, userId);
    if (seat !== 'X') throw new Error('only_host_can_start');
    if (!r.ready || !r.ready.O) throw new Error('opponent_not_ready');
    r.paidFlags = { X:false, O:false };
    const ok = await this.chargeAndMaybeStart(r);
    const s = this.getState(roomId);
    this.emit('room_update_' + r.id, s);
    if (!ok) throw new Error('payment_failed');
    r.ready = { X:false, O:false };
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
