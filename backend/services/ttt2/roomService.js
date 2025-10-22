"use strict";

const EventEmitter = require('events');
const mem = require('../memoryStore');
const engine = require('./engine');
const economy = require('./economyService');
let logger = null; try { logger = require('../../config/logger'); } catch(_) { logger = console; }

function potUserId(roomId){ return `ttt:pot:${String(roomId)}`; }

class RoomService extends EventEmitter {
  constructor(){
    super();
    this.rooms = new Map();
    this.turnTimeoutMs = Math.max(1000, parseInt(process.env.TTT_TURN_TIMEOUT_MS || '10000', 10) || 10000);
  }
  newId(){ return 'tt2_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
  makeCode(){ return String(Math.floor(100000 + Math.random()*900000)); }

  getState(roomId){
    const r = this.rooms.get(String(roomId));
    if (!r) return null;
    const pot = mem.getUser(potUserId(r.id)) || { coins:0, fires:0 };
    const potCoins = Math.max(0, Number(pot.coins||0));
    const potFires = Math.max(0, Number(pot.fires||0));
    const display = (uid)=>{ if(!uid) return null; const u = mem.getUser(uid); const n = u && u.userName ? String(u.userName).trim() : ''; if (n) return n; const raw = String(uid||''); let seed=0; for(let i=0;i<raw.length;i++){ seed=((seed<<5)-seed)+raw.charCodeAt(i); seed|=0; } const tag=Math.abs(seed).toString(36).slice(-6).toUpperCase().padStart(6,'0'); return 'User '+tag; };
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
      playerNames: { X: display(r.players.X), O: display(r.players.O) },
      lastFailReason: r.lastFailReason || null
    };
  }
  onRoom(roomId, fn){ const ev='room_update_'+String(roomId); this.on(ev, fn); return ()=> this.off(ev, fn); }

  createRoom(hostId, opts={}){
    const existing = (()=>{ const uid=String(hostId); for (const r of this.rooms.values()){ if (r && r.players && r.players.X===uid && r.status!=='finished') return r; } return null; })();
    if (existing) return this.getState(existing.id);
    const id = this.newId();
    const r = {
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
      visibility: (opts.visibility==='public' ? 'public' : 'private'),
      costType: (['coins','fuego'].includes(opts.costType) ? opts.costType : 'coins'),
      costValue: Math.max(1, Number(opts.costValue||1) || 1),
      score: { X:0, O:0 },
      round: 1,
      lastWinner: null,
      paidFlags: { X:false, O:false },
      rematchVotes: { X:false, O:false },
      ready: { X:false, O:false },
      pauseBudgetMs: { X:30000, O:30000 }
    };
    this.rooms.set(id, r);
    this.codeIndex = this.codeIndex || new Map();
    this.codeIndex.set(r.code, id);
    return this.getState(id);
  }

  listPublicRooms(){ const out=[]; for (const r of this.rooms.values()){ if (r.visibility==='public') out.push(this.getState(r.id)); } out.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0)); return out; }
  listRoomsByUser(userId){ const uid=String(userId); const out=[]; for (const r of this.rooms.values()){ if (r.players.X===uid || r.players.O===uid) out.push(this.getState(r.id)); } out.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0)); return out; }
  findByCode(code){ const id = this.codeIndex && this.codeIndex.get(String(code)); return id ? this.getState(id) : null; }

  who(r, userId){ const uid=String(userId); if (r.players.X===uid) return 'X'; if (r.players.O===uid) return 'O'; return null; }

  setOptions(roomId, opts={}){
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (typeof opts.visibility !== 'undefined') r.visibility = (opts.visibility==='public' ? 'public' : 'private');
    if (typeof opts.costType !== 'undefined') r.costType = (['coins','fuego'].includes(opts.costType) ? opts.costType : r.costType);
    if (typeof opts.costValue !== 'undefined') r.costValue = Math.max(1, Number(opts.costValue||1)||1);
    // reset ready y pagos al cambiar modo
    r.ready = r.ready || { X:false, O:false }; r.ready.O = false;
    r.paidFlags = { X:false, O:false };
    const s = this.getState(roomId); this.emit('room_update_'+r.id, s); return s;
  }

  joinRoom(roomId, userId){
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    const uid = String(userId);
    if (!r.players.X) r.players.X = uid; else if (!r.players.O && r.players.X!==uid) r.players.O = uid;
    // reanudar pausa si vuelve el mismo jugador
    const seat = this.who(r, uid);
    if (seat && r.pauseUntil && r.pausedBy === seat){
      const rem = Math.max(0, Number(r.pauseUntil) - Date.now());
      r.pauseBudgetMs = r.pauseBudgetMs || { X:30000, O:30000 };
      r.pauseBudgetMs[seat] = rem;
      r.pauseUntil = null; r.pausedBy = null;
      if (r.status === 'playing') { r.lastMoveAt = Date.now(); r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs; }
    }
    const s = this.getState(roomId); this.emit('room_update_'+r.id, s); return s;
  }

  async startGame(roomId, userId){
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (!r.players.X || !r.players.O) throw new Error('both_required');
    const seat = this.who(r, userId); if (seat !== 'X') throw new Error('only_host_can_start');
    if (!r.ready || !r.ready.O) throw new Error('opponent_not_ready');
    r.lastFailReason = null; r.paidFlags = { X:false, O:false };
    const ct = String(r.costType||'coins'); const cv = Math.max(1, Number(r.costValue||1)||1);

    // DB o memoria según flag de economy
    if (economy.isDb()){
      const dx = await economy.debit({ userId: r.players.X, amount: cv, type:'ttt_wager_debit', reference: r.id, asset: ct });
      if (!dx || !dx.ok){ r.lastFailReason = (dx && dx.error) || 'debit_error'; logger.info && logger.info('[TTT2] debit X failed', { roomId:r.id, err: r.lastFailReason }); throw new Error('payment_failed'); }
      r.paidFlags.X = true;
      const dox = await economy.debit({ userId: r.players.O, amount: cv, type:'ttt_wager_debit', reference: r.id, asset: ct });
      if (!dox || !dox.ok){
        r.lastFailReason = (dox && dox.error) || 'debit_error';
        try { await economy.credit({ userId: r.players.X, amount: cv, type:'ttt_wager_refund', reference: r.id, asset: ct }); r.paidFlags.X=false; } catch(_){ }
        logger.info && logger.info('[TTT2] debit O failed', { roomId:r.id, err: r.lastFailReason });
        throw new Error('payment_failed');
      }
      r.paidFlags.O = true;
    } else {
      const dx = await economy.debit({ userId: r.players.X, amount: cv, type:'ttt_wager_pot', reference: r.id, asset: ct });
      if (!dx || !dx.ok){ r.lastFailReason = (dx && dx.error) || 'insufficient_'+(ct==='coins'?'coins':'fires'); throw new Error('payment_failed'); }
      r.paidFlags.X = true;
      const dox = await economy.debit({ userId: r.players.O, amount: cv, type:'ttt_wager_pot', reference: r.id, asset: ct });
      if (!dox || !dox.ok){ r.lastFailReason = (dox && dox.error) || 'insufficient_'+(ct==='coins'?'coins':'fires'); try{ await economy.credit({ userId: r.players.X, amount: cv, type:'ttt_wager_refund', reference: r.id, asset: ct }); r.paidFlags.X=false; }catch(_){ } throw new Error('payment_failed'); }
      r.paidFlags.O = true;
    }

    // pasar a playing
    r.status = 'playing';
    r.lastMoveAt = Date.now();
    r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
    r.rematchVotes = { X:false, O:false };
    const s = this.getState(roomId); this.emit('room_update_'+r.id, s); return s;
  }

  async settlePot(r){
    const ct = String(r.costType||'coins'); const cv = Math.max(1, Number(r.costValue||1)||1);
    const winnerId = r.winner ? (r.winner==='X' ? r.players.X : r.players.O) : null;
    if (winnerId){
      const amt = cv*2; await economy.credit({ userId: winnerId, amount: amt, type:'ttt_wager_win', reference: r.id, asset: ct });
    } else {
      // empate: reembolsar
      if (r.players.X) await economy.credit({ userId: r.players.X, amount: cv, type:'ttt_wager_draw', reference: r.id, asset: ct });
      if (r.players.O) await economy.credit({ userId: r.players.O, amount: cv, type:'ttt_wager_draw', reference: r.id, asset: ct });
    }
  }

  move({ roomId, userId, index }){
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (r.status !== 'playing') throw new Error('not_playing');
    const me = this.who(r, userId); if (!me) throw new Error('not_in_room');

    // timeout de turno
    const now = Date.now();
    const deadline = r.lastMoveAt ? (r.lastMoveAt + this.turnTimeoutMs) : now + this.turnTimeoutMs;
    if (!r.turnDeadline) r.turnDeadline = deadline;
    if (now > deadline){ r.turn = r.turn==='X' ? 'O':'X'; r.lastMoveAt = now; r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs; }
    if (r.turn !== me) throw new Error('not_your_turn');

    const i = Number(index); if (!engine.isValidMove(r.board, i)) throw new Error('invalid_index');
    r.board[i] = me; r.lastMoveAt = now;

    const w = engine.checkWinner(r.board);
    if (w){
      r.winner = (w==='draw') ? null : w; r.status = 'finished'; r.turnDeadline = null; r.rematchVotes = { X:false, O:false };
      if (r.winner){ r.lastWinner = r.winner; if (r.winner==='X') r.score.X+=1; else r.score.O+=1; try{ const xid=r.players.X, oid=r.players.O; if (xid&&oid){ if(r.winner==='X'){ mem.recordGameResult({ userId:xid, game:'tictactoe', result:'win' }); mem.recordGameResult({ userId:oid, game:'tictactoe', result:'loss' }); } else { mem.recordGameResult({ userId:oid, game:'tictactoe', result:'win' }); mem.recordGameResult({ userId:xid, game:'tictactoe', result:'loss' }); } } }catch(_){ } }
      else { r.lastWinner = null; try{ const xid=r.players.X, oid=r.players.O; if(xid) mem.recordGameResult({ userId:xid, game:'tictactoe', result:'draw' }); if(oid) mem.recordGameResult({ userId:oid, game:'tictactoe', result:'draw' }); }catch(_){ } }
      this.settlePot(r).catch(()=>{});
    } else {
      r.turn = r.turn==='X' ? 'O':'X'; r.turnDeadline = r.lastMoveAt + this.turnTimeoutMs;
    }
    const s = this.getState(roomId); this.emit('room_update_'+r.id, s); return s;
  }

  rematch(roomId, userId){
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    if (r.status !== 'finished') throw new Error('not_finished');
    const me = this.who(r, userId); if (!me) throw new Error('not_in_room');
    r.rematchVotes = r.rematchVotes || { X:false, O:false }; r.rematchVotes[me] = true;
    if (r.rematchVotes.X && r.rematchVotes.O){
      r.round += 1; r.board = Array(9).fill(null); r.winner=null; r.lastMoveAt=null; r.turnDeadline=null; r.status='waiting'; r.turn = (r.turn==='X')? 'O':'X'; r.paidFlags={ X:false, O:false }; r.rematchVotes={ X:false, O:false }; r.ready={ X:false, O:false };
    }
    const s = this.getState(roomId); this.emit('room_update_'+r.id, s); return s;
  }

  leaveRoom(roomId, userId){
    const r = this.rooms.get(String(roomId)); if (!r) throw new Error('room_not_found');
    const uid = String(userId); const seat = this.who(r, uid); if (!seat) return { state: this.getState(roomId), closed:false };
    if (r.status === 'playing'){
      if (!r.lastDisconnect) r.lastDisconnect = {}; r.lastDisconnect[seat] = Date.now();
      r.pauseBudgetMs = r.pauseBudgetMs || { X:30000, O:30000 };
      const budget = Math.max(0, Number(r.pauseBudgetMs[seat] || 30000));
      if (budget <= 0){
        const loser = seat; const winner = loser==='X' ? 'O' : 'X'; r.status='finished'; r.winner=winner; r.lastWinner=winner; r.turnDeadline=null; r.rematchVotes={ X:false, O:false };
        if (winner==='X') r.score.X+=1; else r.score.O+=1; this.settlePot(r).catch(()=>{});
        const s = this.getState(r.id); this.emit('room_update_'+r.id, s); return { state: s, closed:false };
      }
      r.pausedBy = seat; r.pauseUntil = Date.now() + budget; const s = this.getState(roomId); this.emit('room_update_'+r.id, s); return { state:s, closed:false };
    }
    if (r.status === 'waiting'){
      if (seat === 'X'){
        if (!r.players.O){ this.rooms.delete(String(roomId)); return { state:null, closed:true }; }
        else { r.players.X = r.players.O; r.players.O = null; const s=this.getState(roomId); this.emit('room_update_'+r.id, s); return { state:s, closed:false }; }
      } else { r.players.O = null; const s=this.getState(roomId); this.emit('room_update_'+r.id, s); return { state:s, closed:false }; }
    }
    if (r.status === 'finished'){
      if (seat === 'X') r.players.X=null; if (seat==='O') r.players.O=null; if (!r.players.X && !r.players.O){ this.rooms.delete(String(roomId)); return { state:null, closed:true }; }
      const s=this.getState(roomId); this.emit('room_update_'+r.id, s); return { state:s, closed:false };
    }
    const s=this.getState(roomId); this.emit('room_update_'+r.id, s); return { state:s, closed:false };
  }

  tick(){
    const now = Date.now();
    for (const r of this.rooms.values()){
      if (!r || r.status !== 'playing') continue;
      // pausa expirada -> derrota del que salió
      if (r.pauseUntil && now >= r.pauseUntil){
        const loser = r.pausedBy === 'X' ? 'X' : 'O';
        const winner = loser === 'X' ? 'O' : 'X';
        r.status = 'finished'; r.winner = winner; r.lastWinner = winner; r.turnDeadline = null; r.rematchVotes = { X:false, O:false };
        if (winner === 'X') r.score.X += 1; else r.score.O += 1;
        r.pausedBy = null; r.pauseUntil = null;
        try { this.settlePot(r).catch(()=>{}); } catch(_){ }
        const s = this.getState(r.id); this.emit('room_update_'+r.id, s);
        continue;
      }
      if (r.pauseUntil && now < r.pauseUntil) continue; // en pausa: no aplicar timeout de turno
      if (r.turnDeadline && now > r.turnDeadline){
        const loser = r.turn; const winner = loser==='X' ? 'O' : 'X';
        r.status = 'finished'; r.winner = winner; r.lastWinner = winner; r.turnDeadline = null; r.rematchVotes = { X:false, O:false };
        if (winner === 'X') r.score.X += 1; else r.score.O += 1;
        try { this.settlePot(r).catch(()=>{}); } catch(_){ }
        const s = this.getState(r.id); this.emit('room_update_'+r.id, s);
      }
    }
  }
}

module.exports = new RoomService();
