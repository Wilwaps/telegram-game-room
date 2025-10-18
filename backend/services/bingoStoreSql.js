const EventEmitter = require('events');
const db = require('../db');

const SPONSOR_TG = 'tg:1417856820';

class BingoStoreSql extends EventEmitter {
  constructor(){ super(); }

  onRoom(roomId, fn){ const ev = 'room_update_'+String(roomId); this.on(ev, fn); return () => this.off(ev, fn); }
  async emitRoom(roomId){ try{ const s = await this.getState(roomId); this.emit('room_update_'+String(roomId), s); }catch(_){} }

  // Utils
  sizeBag(ballSet){ const n = [75,90].includes(Number(ballSet))? Number(ballSet) : 90; return n; }
  shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
  generateCard(ballSet=90){
    const max = [75,90].includes(Number(ballSet)) ? Number(ballSet) : 90;
    const ranges = max === 75 ? [ [1,15], [16,30], [31,45], [46,60], [61,75] ] : [ [1,18], [19,36], [37,54], [55,72], [73,90] ];
    const pick = (count,a,b)=>{ const pool=[]; for(let n=a;n<=b;n++) pool.push(n); this.shuffle(pool); return pool.slice(0,count).sort((x,y)=>x-y); };
    const columns = ranges.map(([a,b]) => pick(5,a,b));
    const card = Array.from({length:5},()=>Array(5).fill(null));
    for(let c=0;c<5;c++){ for(let r=0;r<5;r++){ card[r][c]=columns[c][r]; } }
    card[2][2]='FREE';
    return card;
  }
  checkCardWin(card, calledSet, mode){
    const isCalled = (n,r,c)=> (r===2 && c===2) ? true : calledSet.has(n);
    const hasLine = () => {
      for(let r=0;r<5;r++){ let ok=true; for(let c=0;c<5;c++){ if(!isCalled(card[r][c],r,c)){ ok=false; break; } } if(ok) return true; }
      for(let c=0;c<5;c++){ let ok=true; for(let r=0;r<5;r++){ if(!isCalled(card[r][c],r,c)){ ok=false; break; } } if(ok) return true; }
      let okd1=true; for(let i=0;i<5;i++) if(!isCalled(card[i][i],i,i)) { okd1=false; break; }
      let okd2=true; for(let i=0;i<5;i++) if(!isCalled(card[i][4-i],i,4-i)) { okd2=false; break; }
      return okd1||okd2;
    };
    const hasCorners = ()=> isCalled(card[0][0],0,0)&&isCalled(card[0][4],0,4)&&isCalled(card[4][0],4,0)&&isCalled(card[4][4],4,4);
    const hasFull = ()=>{ for(let r=0;r<5;r++){ for(let c=0;c<5;c++){ if(!isCalled(card[r][c],r,c)) return false; } } return true; };
    if (mode==='4c') return hasCorners(); if(mode==='carton') return hasFull(); return hasLine();
  }

  async mapExtToDbUserId(userExt){
    try{
      const v = String(userExt||'').trim(); if(!v) return null;
      if (v.startsWith('db:')) return v.slice(3);
      if (v.startsWith('tg:')){ const tg=v.slice(3); const r=await db.query('SELECT id FROM users WHERE tg_id=$1 LIMIT 1',[tg]); return r.rows?.[0]?.id||null; }
      if (v.startsWith('em:')){ const em=v.slice(3).toLowerCase(); const r=await db.query('SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1',[em]); return r.rows?.[0]?.id||null; }
      return null;
    }catch(_){ return null; }
  }

  async getState(roomId){
    const id = String(roomId);
    const r0 = await db.query('SELECT id, code, host_id, name, mode, entry_price_fire, pot_fires, status, numbers_drawn, rules_meta, created_at FROM bingo_rooms WHERE id=$1',[id]);
    const row = r0.rows?.[0]; if(!row) return null;
    const playersRs = await db.query("SELECT id, user_ext, user_id, cards_count, status FROM bingo_players WHERE room_id=$1",[id]);
    const players = (playersRs.rows||[]).map(p=>({ userId: p.user_ext || (p.user_id?('db:'+p.user_id):null), ready: p.status==='ready', cardsCount: p.cards_count||0 }));
    const called = row.numbers_drawn || [];
    return {
      id: row.id,
      code: row.code,
      createdAt: row.created_at?.getTime?.() || new Date(row.created_at).getTime(),
      hostId: row.host_id?('db:'+row.host_id):(row.rules_meta?.hostExt||null),
      visibility: (row.rules_meta?.visibility)||'private',
      costType: (row.rules_meta?.costType)||'free',
      costValue: (row.rules_meta?.costValue)|| (row.mode==='fire'?1:0),
      ballSet: (row.rules_meta?.ballSet)||90,
      mode: (row.rules_meta?.winMode)||'linea',
      status: row.status==='open'?'lobby':(row.status==='running'?'playing':'finished'),
      players,
      potFires: Number(row.pot_fires||0),
      potCoins: 0,
      called,
      lastCall: called.length? called[called.length-1] : null,
      winners: [],
      lastPayout: null
    };
  }

  async createRoom({ userId, visibility='private', costType='free', costValue=1, mode='linea', ballSet=90 }){
    const hostExt = String(userId||'');
    const hostDb = await this.mapExtToDbUserId(hostExt);
    const vis = (visibility==='public')?'public':'private';
    const isFire = (costType==='fuego');
    const code = String(Math.floor(100000 + Math.random()*900000));
    const meta = { hostExt, visibility: vis, costType, costValue: isFire?1:0, winMode: ['linea','4c','carton'].includes(mode)?mode:'linea', ballSet: [75,90].includes(Number(ballSet))?Number(ballSet):90 };
    const ins = await db.query("INSERT INTO bingo_rooms(code, host_id, name, mode, entry_price_fire, pot_fires, status, numbers_drawn, rules_meta, created_at) VALUES ($1,$2,$3,$4,$5,$6,'open',ARRAY[]::integer[],$7,NOW()) RETURNING id",[code, hostDb, code, isFire?'fire':'friendly', isFire?1:0, 0, meta]);
    const roomId = ins.rows[0].id;
    await db.query("INSERT INTO bingo_players(room_id, user_ext, user_id, fires_spent, cards_count, status) VALUES ($1,$2,$3,0,1,'active') ON CONFLICT DO NOTHING",[roomId, hostExt, hostDb]);
    const state = await this.getState(roomId);
    this.emitRoom(roomId);
    return state;
  }

  async listRoomsByUser(userId){
    const ext = String(userId||'');
    const rs = await db.query("SELECT DISTINCT r.id FROM bingo_rooms r JOIN bingo_players p ON p.room_id=r.id WHERE p.user_ext=$1 OR p.user_id = $2 ORDER BY r.created_at DESC", [ext, await this.mapExtToDbUserId(ext)]);
    const out = [];
    for(const row of rs.rows||[]){ out.push(await this.getState(row.id)); }
    return out;
  }
  async listPublicRooms(){
    const rs = await db.query("SELECT id FROM bingo_rooms WHERE (rules_meta->>'visibility')='public' ORDER BY created_at DESC LIMIT 50",[]);
    const out = []; for(const r of rs.rows||[]){ out.push(await this.getState(r.id)); } return out;
  }
  async findByCode(code){ const rs = await db.query('SELECT id FROM bingo_rooms WHERE code=$1',[String(code||'')]); const row = rs.rows?.[0]; return row? await this.getState(row.id) : null; }

  async joinRoom(roomId, userId){
    const id = String(roomId);
    const ext = String(userId||'');
    const dbu = await this.mapExtToDbUserId(ext);
    const r0 = await db.query('SELECT status FROM bingo_rooms WHERE id=$1',[id]);
    if (!r0.rows?.[0]) throw new Error('room_not_found');
    if (r0.rows[0].status !== 'open') throw new Error('already_started');
    const cntRs = await db.query('SELECT COUNT(*)::int AS c FROM bingo_players WHERE room_id=$1',[id]);
    if ((cntRs.rows?.[0]?.c||0) >= 30) throw new Error('max_players');
    await db.query("INSERT INTO bingo_players(room_id, user_ext, user_id, fires_spent, cards_count, status) VALUES ($1,$2,$3,0,1,'active') ON CONFLICT (room_id,user_ext) DO NOTHING", [id, ext, dbu]);
    const s = await this.getState(id); this.emitRoom(id); return s;
  }

  async setOptions(roomId, userId, opts={}){
    const id = String(roomId); const ext = String(userId||'');
    const r0 = await db.query('SELECT host_id, rules_meta FROM bingo_rooms WHERE id=$1',[id]); const row = r0.rows?.[0]; if(!row) throw new Error('room_not_found');
    const hostDb = row.host_id; const extDb = await this.mapExtToDbUserId(ext);
    if (hostDb && extDb && String(hostDb)!==String(extDb)) throw new Error('not_host');
    const meta = row.rules_meta || {};
    if (typeof opts.visibility !== 'undefined') meta.visibility = (opts.visibility==='public')?'public':'private';
    if (typeof opts.costType !== 'undefined') meta.costType = ['free','fuego','coins'].includes(opts.costType)?opts.costType:meta.costType;
    if (typeof opts.costValue !== 'undefined') meta.costValue = (meta.costType==='fuego'||meta.costType==='coins')?1:0;
    if (typeof opts.mode !== 'undefined') meta.winMode = ['linea','4c','carton'].includes(opts.mode)?opts.mode:meta.winMode;
    if (typeof opts.ballSet !== 'undefined') meta.ballSet = [75,90].includes(Number(opts.ballSet))?Number(opts.ballSet):meta.ballSet;
    await db.query('UPDATE bingo_rooms SET rules_meta=$2 WHERE id=$1',[id, meta]);
    const s = await this.getState(id); this.emitRoom(id); return s;
  }

  async setReady(roomId, userId, { ready, cardsCount }){
    const id = String(roomId); const ext = String(userId||'');
    const r0 = await db.query('SELECT status FROM bingo_rooms WHERE id=$1',[id]); const row = r0.rows?.[0]; if(!row) throw new Error('room_not_found');
    if (row.status !== 'open') throw new Error('already_started');
    const st = ready? 'ready' : 'active';
    const cc = Math.max(1, Math.min(10, Number(cardsCount||1)));
    await db.query('UPDATE bingo_players SET status=$3, cards_count=$4 WHERE room_id=$1 AND user_ext=$2', [id, ext, st, cc]);
    const s = await this.getState(id); this.emitRoom(id); return s;
  }

  async start({ roomId, userId }){
    const id = String(roomId); const ext = String(userId||'');
    const r0 = await db.query('SELECT id, host_id, mode, rules_meta, status FROM bingo_rooms WHERE id=$1',[id]); const row = r0.rows?.[0]; if(!row) throw new Error('room_not_found');
    const extDb = await this.mapExtToDbUserId(ext);
    if (row.host_id && extDb && String(row.host_id)!==String(extDb)) throw new Error('not_host');
    if (row.status !== 'open') throw new Error('already_started');
    const meta = row.rules_meta || {}; const ballSet = meta.ballSet || 90; const isFire = (row.mode==='fire');
    const actives = await db.query("SELECT id, user_ext, user_id, cards_count FROM bingo_players WHERE room_id=$1 AND status='ready' AND cards_count>0",[id]);
    if (!actives.rows || actives.rows.length===0) throw new Error('no_ready_players');
    // Generate cards and debit wallets if fire
    for(const p of actives.rows){
      for(let i=0;i<Number(p.cards_count||0);i++){
        const card = this.generateCard(ballSet);
        await db.query('INSERT INTO bingo_cards(room_id, player_id, card, is_winner) VALUES ($1,$2,$3,false)', [id, p.id, card]);
      }
      if (isFire){
        const dbu = p.user_id || await this.mapExtToDbUserId(p.user_ext);
        if (!dbu) continue;
        await db.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING',[dbu]);
        const w = await db.query('SELECT id, fires_balance FROM wallets WHERE user_id=$1 FOR UPDATE',[dbu]);
        const wid = w.rows?.[0]?.id; const bal = Number(w.rows?.[0]?.fires_balance||0);
        const cost = Number(p.cards_count||0) * 1;
        if (cost>0){ if (bal < cost) { throw new Error('insufficient_fires'); }
          await db.query('UPDATE wallets SET fires_balance=fires_balance-$2, updated_at=NOW() WHERE id=$1',[wid, cost]);
          await db.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid,'bingo_entry', -cost, String(id), { cards:p.cards_count }]);
          await db.query('UPDATE bingo_rooms SET pot_fires=COALESCE(pot_fires,0)+$2 WHERE id=$1',[id, cost]);
        }
      }
    }
    await db.query("UPDATE bingo_rooms SET status='running' WHERE id=$1",[id]);
    // empty draws
    await db.query('DELETE FROM bingo_draws WHERE room_id=$1',[id]);
    const s = await this.getState(id); this.emitRoom(id); return s;
  }

  async draw({ roomId, userId }){
    const id = String(roomId); const ext = String(userId||'');
    const r0 = await db.query('SELECT id, host_id, rules_meta, numbers_drawn, status FROM bingo_rooms WHERE id=$1',[id]); const row = r0.rows?.[0]; if(!row) throw new Error('room_not_found');
    const extDb = await this.mapExtToDbUserId(ext);
    if (row.host_id && extDb && String(row.host_id)!==String(extDb)) throw new Error('not_host');
    if (row.status !== 'running') throw new Error('not_playing');
    const called = row.numbers_drawn || [];
    const max = row.rules_meta?.ballSet || 90;
    // find next not-called number
    const calledSet = new Set(called);
    let next = null; for(let n=1;n<=max;n++){ if(!calledSet.has(n)){ next=n; break; } }
    if (next===null) throw new Error('empty_bag');
    await db.query('INSERT INTO bingo_draws(room_id, number) VALUES ($1,$2)',[id, next]);
    await db.query('UPDATE bingo_rooms SET numbers_drawn = array_append(numbers_drawn, $2) WHERE id=$1',[id, next]);
    const s = await this.getState(id); this.emitRoom(id); return s;
  }

  async claim(roomId, userId, { cardIndex=0 }={}){
    const id = String(roomId); const ext = String(userId||'');
    const r0 = await db.query('SELECT id, host_id, mode, rules_meta, numbers_drawn, status, pot_fires FROM bingo_rooms WHERE id=$1',[id]); const row = r0.rows?.[0]; if(!row) throw new Error('room_not_found');
    if (row.status !== 'running') throw new Error('not_playing');
    const pr = await db.query('SELECT id, cards_count FROM bingo_players WHERE room_id=$1 AND user_ext=$2',[id, ext]); const pl = pr.rows?.[0]; if(!pl) throw new Error('not_in_room');
    const crs = await db.query('SELECT id, card FROM bingo_cards WHERE room_id=$1 AND player_id=$2 ORDER BY created_at ASC',[id, pl.id]);
    const card = crs.rows?.[cardIndex]?.card; if(!card) throw new Error('invalid_card');
    const called = row.numbers_drawn || []; const calledSet = new Set(called);
    const mode = row.rules_meta?.winMode || 'linea';
    const win = this.checkCardWin(card, calledSet, mode);
    if (!win) throw new Error('no_bingo');
    // mark room finished
    await db.query("UPDATE bingo_rooms SET status='closed' WHERE id=$1",[id]);
    // payout 70/20/10 if fire
    if (row.mode==='fire'){
      const pot = Number(row.pot_fires||0);
      if (pot>0){
        const g = Math.floor(pot*0.70), h=Math.floor(pot*0.20), s=Math.max(0, pot-g-h);
        const winnerDb = await this.mapExtToDbUserId(ext);
        const hostDb = row.host_id || null;
        const sponsorDb = await this.mapExtToDbUserId(SPONSOR_TG);
        const credit = async (userId, amount, type) => {
          if (!userId || amount<=0) return;
          await db.query('INSERT INTO wallets(user_id,fires_balance,coins_balance,updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING',[userId]);
          const w = await db.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE',[userId]); const wid = w.rows?.[0]?.id; if (!wid) return;
          await db.query('UPDATE wallets SET fires_balance=fires_balance+$2, updated_at=NOW() WHERE id=$1',[wid, amount]);
          await db.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid, type, amount, String(id), { bingoRoom: id }]);
        };
        await credit(winnerDb, g, 'bingo_payout_winner');
        await credit(hostDb, h, 'bingo_payout_host');
        await credit(sponsorDb, s, 'bingo_payout_sponsor');
        await db.query('UPDATE bingo_rooms SET pot_fires=0 WHERE id=$1',[id]);
      }
    }
    const s = await this.getState(id); this.emitRoom(id); return s;
  }

  async rematch(roomId, userId){
    const id = String(roomId); const ext = String(userId||'');
    const r0 = await db.query('SELECT id, host_id, status FROM bingo_rooms WHERE id=$1',[id]); const row = r0.rows?.[0]; if(!row) throw new Error('room_not_found');
    const extDb = await this.mapExtToDbUserId(ext);
    if (row.host_id && extDb && String(row.host_id)!==String(extDb)) throw new Error('not_host');
    if (row.status !== 'closed') throw new Error('not_finished');
    await db.query("UPDATE bingo_rooms SET status='open', pot_fires=0, numbers_drawn=ARRAY[]::integer[] WHERE id=$1",[id]);
    await db.query('DELETE FROM bingo_draws WHERE room_id=$1',[id]);
    await db.query('DELETE FROM bingo_cards WHERE room_id=$1',[id]);
    await db.query("UPDATE bingo_players SET status='active' WHERE room_id=$1",[id]);
    const s = await this.getState(id); this.emitRoom(id); return s;
  }
}

module.exports = new BingoStoreSql();
