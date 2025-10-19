const express = require('express');
const router = express.Router();
const { preferSessionUserId } = require('../middleware/sessionUser');
const tttStore = require('../services/tictactoeStore');
const useBingoSql = String(process.env.BINGO_BACKEND||'').toLowerCase()==='sql';
const bingoStore = useBingoSql ? require('../services/bingoStoreSql') : require('../services/bingoStore');

function pickActiveTtt(userId){
  try{
    const mine = tttStore.listRoomsByUser(userId) || [];
    const playing = mine.filter(r=>r && r.status==='playing');
    if (!playing.length) return null;
    const room = playing[0];
    const meMark = (room && room.players) ? (room.players.X===userId?'X':(room.players.O===userId?'O':null)) : null;
    let countdownSeconds = null;
    if (room && room.turnDeadline && meMark && room.turn===meMark){
      countdownSeconds = Math.max(0, Math.ceil((Number(room.turnDeadline)-Date.now())/1000));
    }
    const players = [];
    try{
      if (room.playerNames){ if (room.playerNames.X) players.push(room.playerNames.X); if (room.playerNames.O) players.push(room.playerNames.O); }
    }catch(_){ }
    return { type:'tictactoe', roomId: room.id, link: `/games/tictactoe?room=${encodeURIComponent(room.id)}`, countdownSeconds, players };
  }catch(_){ return null; }
}

function computeBingoRemainingForUser(state, userId){
  try{
    const called = new Set(state.called||[]);
    const p = (state.players||[]).find(x=>String(x.userId)===String(userId));
    if (!p || !Array.isArray(p.cards) || !p.cards[0]) return [];
    const card = p.cards[0];
    const nums = [];
    for (let r=0;r<5;r++){
      for (let c=0;c<5;c++){
        const v = card[r][c];
        if (v==='FREE') continue;
        if (!called.has(v)) nums.push(v);
      }
    }
    return nums.sort((a,b)=>a-b).slice(0,25);
  }catch(_){ return []; }
}

function pickActiveBingo(userId){
  try{
    const mine = bingoStore.listRoomsByUser ? bingoStore.listRoomsByUser(userId) : [];
    if (mine && typeof mine.then==='function'){ /* SQL impl */ return null; }
    const playing = (mine||[]).filter(r=>r && r.status==='playing');
    if (!playing.length) return null;
    const room = playing[0];
    const remainingNumbers = computeBingoRemainingForUser(room, userId);
    return { type:'bingo', roomId: room.id, link: `/games/bingo?room=${encodeURIComponent(room.id)}`, remainingNumbers };
  }catch(_){ return null; }
}

router.get('/active', async (req,res)=>{
  try{
    const userId = preferSessionUserId(req, req.query && req.query.userId);
    if (!userId) return res.status(200).json({ success:false });
    const aTtt = pickActiveTtt(userId);
    if (aTtt) return res.json({ success:true, ...aTtt });
    // Para bingo SQL necesitaríamos consultas asíncronas; por simplicidad devolvemos vacío si es SQL.
    const aBingo = pickActiveBingo(userId);
    if (aBingo) return res.json({ success:true, ...aBingo });
    return res.status(200).json({ success:false });
  }catch(_){ return res.status(200).json({ success:false }); }
});

module.exports = router;
