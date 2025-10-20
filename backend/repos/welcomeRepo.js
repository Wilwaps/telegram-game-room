const db = require('../db');

// ---------- Utilidades (legacy kv/claims) ----------
async function ensureKv(){
  try{
    await db.query(`CREATE TABLE IF NOT EXISTS app_kv(
      key TEXT PRIMARY KEY,
      value JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  }catch(_){ }
}
async function ensureLegacyClaims(){
  try{
    await db.query(`CREATE TABLE IF NOT EXISTS welcome_claims(
      user_ext TEXT PRIMARY KEY,
      claimed_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  }catch(_){ }
}

// ---------- Modelo nuevo en Postgres ----------
async function ensureTables(){
  try{
    await db.query(`CREATE TABLE IF NOT EXISTS welcome_events(
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0,
      fires INTEGER NOT NULL DEFAULT 0,
      duration_hours INTEGER NOT NULL DEFAULT 24,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS welcome_event_history(
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS welcome_event_claims(
      event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
      user_ext TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(event_id, user_ext)
    )`);
  }catch(_){ }
}
async function getCurrentEvent(){
  try{
    await ensureTables();
    const r = await db.query('SELECT id, name, message, coins, fires, duration_hours, starts_at, ends_at, active FROM welcome_events WHERE active = TRUE ORDER BY starts_at DESC NULLS LAST, id DESC LIMIT 1');
    const row = r.rows && r.rows[0];
    if (!row) return { active:false, startsAt:0, endsAt:0, coins:0, fires:0, message:'' };
    return {
      id: row.id,
      name: row.name,
      message: row.message || '',
      coins: Number(row.coins||0),
      fires: Number(row.fires||0),
      durationHours: Number(row.duration_hours||0),
      startsAt: row.starts_at ? new Date(row.starts_at).getTime() : 0,
      endsAt: row.ends_at ? new Date(row.ends_at).getTime() : 0,
      active: !!row.active
    };
  }catch(_){
    // Fallback a legacy app_kv
    return getEventLegacy();
  }
}

async function getEventLegacy(){
  await ensureKv();
  const rs = await db.query('SELECT value FROM app_kv WHERE key=$1', ['welcome_event']);
  const v = (rs.rows && rs.rows[0] && rs.rows[0].value) || null;
  if (!v) return { active:false, startsAt:0, endsAt:0, coins:0, fires:0, message:'' };
  return v;
}

async function getEvent(){
  // Mantener compatibilidad con rutas existentes
  return getCurrentEvent();
}

async function listEvents({ includeInactive = true } = {}){
  await ensureTables();
  const cond = includeInactive ? '' : 'WHERE active = TRUE';
  const r = await db.query(`SELECT id, name, message, coins, fires, duration_hours, starts_at, ends_at, active, created_by, created_at, updated_at FROM welcome_events ${cond} ORDER BY id DESC`);
  return (r.rows||[]).map(row=>({
    id: row.id,
    name: row.name,
    message: row.message||'',
    coins: Number(row.coins||0),
    fires: Number(row.fires||0),
    durationHours: Number(row.duration_hours||0),
    startsAt: row.starts_at ? new Date(row.starts_at).getTime() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
    active: !!row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function createEvent({ name, message, coins=0, fires=0, durationHours=24 }, actor='system'){
  await ensureTables();
  const r = await db.query(
    'INSERT INTO welcome_events(name,message,coins,fires,duration_hours,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, message, coins, fires, duration_hours, active, created_by, created_at, updated_at',
    [String(name||'').trim(), String(message||''), Math.max(0, Number(coins)||0), Math.max(0, Number(fires)||0), Math.max(1, Number(durationHours)||1), String(actor||'system')]
  );
  const row = r.rows && r.rows[0];
  await db.query('INSERT INTO welcome_event_history(event_id, action, actor, payload) VALUES ($1,$2,$3,$4)', [row.id, 'created', actor, { name, message, coins, fires, durationHours }]);
  return row;
}

async function updateEvent(eventId, { name, message, coins, fires, durationHours }, actor='system'){
  await ensureTables();
  const id = Number(eventId);
  const r = await db.query('SELECT active FROM welcome_events WHERE id=$1', [id]);
  const active = r.rows && r.rows[0] && r.rows[0].active;
  if (active) throw new Error('cannot_update_active_event');
  const parts = []; const args = []; let i=1;
  if (typeof name !== 'undefined'){ parts.push(`name=$${i++}`); args.push(String(name||'')); }
  if (typeof message !== 'undefined'){ parts.push(`message=$${i++}`); args.push(String(message||'')); }
  if (typeof coins !== 'undefined'){ parts.push(`coins=$${i++}`); args.push(Math.max(0, Number(coins)||0)); }
  if (typeof fires !== 'undefined'){ parts.push(`fires=$${i++}`); args.push(Math.max(0, Number(fires)||0)); }
  if (typeof durationHours !== 'undefined'){ parts.push(`duration_hours=$${i++}`); args.push(Math.max(1, Number(durationHours)||1)); }
  if (parts.length===0) return { ok:true };
  args.push(id);
  await db.query(`UPDATE welcome_events SET ${parts.join(', ')}, updated_at=NOW() WHERE id=$${i}`, args);
  await db.query('INSERT INTO welcome_event_history(event_id, action, actor, payload) VALUES ($1,$2,$3,$4)', [id, 'updated', actor, { name, message, coins, fires, durationHours }]);
  return { ok:true };
}

async function activateEvent({ eventId, startsAt, actor='system' }){
  await ensureTables();
  const id = Number(eventId);
  const st = startsAt ? new Date(startsAt) : new Date();
  const row = await db.query('SELECT duration_hours FROM welcome_events WHERE id=$1', [id]);
  if (!row.rows || !row.rows[0]) throw new Error('event_not_found');
  const duration = Math.max(1, Number(row.rows[0].duration_hours)||1);
  const ends = new Date(st.getTime() + duration*3600*1000);
  await db.query('UPDATE welcome_events SET active=FALSE WHERE active=TRUE');
  await db.query('UPDATE welcome_events SET starts_at=$1, ends_at=$2, active=TRUE, updated_at=NOW() WHERE id=$3', [st, ends, id]);
  await db.query('INSERT INTO welcome_event_history(event_id, action, actor, payload) VALUES ($1,$2,$3,$4)', [id, 'activated', actor, { startsAt: st, endsAt: ends }]);
  await ensureKv();
  try{ await db.query('INSERT INTO app_kv(key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()', ['welcome_current_event_id', id]); }catch(_){ }
  return { ok:true, id, startsAt: st, endsAt: ends };
}

async function deactivateEvent({ eventId, actor='system' }){
  await ensureTables();
  const id = Number(eventId);
  await db.query('UPDATE welcome_events SET active=FALSE, updated_at=NOW() WHERE id=$1', [id]);
  await db.query('INSERT INTO welcome_event_history(event_id, action, actor) VALUES ($1,$2,$3)', [id, 'deactivated', actor]);
  return { ok:true };
}

// ---------- Claims por evento ----------
async function hasClaimForEvent(eventId, userExt){
  await ensureTables();
  const rs = await db.query('SELECT 1 FROM welcome_event_claims WHERE event_id=$1 AND user_ext=$2', [Number(eventId), String(userExt||'')]);
  return !!(rs.rows && rs.rows[0]);
}
async function setClaimForEvent(eventId, userExt){
  await ensureTables();
  await db.query('INSERT INTO welcome_event_claims(event_id,user_ext,claimed_at) VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING', [Number(eventId), String(userExt||'')]);
}

async function mapExtToDbUserId(userExt){
  const v = String(userExt||'').trim(); if (!v) return null;
  if (v.startsWith('db:')) return v.slice(3);
  if (v.startsWith('tg:')){ const tg=v.slice(3); const r = await db.query('SELECT id FROM users WHERE tg_id=$1 LIMIT 1',[tg]); return (r.rows&&r.rows[0]&&r.rows[0].id)||null; }
  if (v.startsWith('em:')){ const em=v.slice(3).toLowerCase(); const r = await db.query('SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1',[em]); return (r.rows&&r.rows[0]&&r.rows[0].id)||null; }
  return null;
}

async function ensureWallet(dbUserId){
  await db.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING', [dbUserId]);
}

async function getWalletExtBalances(userExt){
  const id = await mapExtToDbUserId(userExt); if (!id) return null;
  const rs = await db.query('SELECT fires_balance, coins_balance FROM wallets WHERE user_id=$1', [id]);
  const row = rs.rows && rs.rows[0]; if (!row) return { fires:0, coins:0 };
  return { fires: Number(row.fires_balance||0), coins: Number(row.coins_balance||0) };
}

let supplyRepo = null; try { supplyRepo = require('./supplyRepo'); } catch(_) { supplyRepo = null; }

async function awardIfEligible(userExt){
  const ext = String(userExt||'');
  if (!ext.startsWith('tg:')) return { awarded:false };
  const ev = await getCurrentEvent();
  const now = Date.now();
  if (!ev.active || now < Number(ev.startsAt||0) || now > Number(ev.endsAt||0)) return { awarded:false };
  if (ev.id && await hasClaimForEvent(ev.id, ext)) return { awarded:false };
  const dbUserId = await mapExtToDbUserId(ext);
  if (!dbUserId) return { awarded:false };
  await ensureWallet(dbUserId);
  const coins = Math.max(0, Number(ev.coins||0));
  const fires = Math.max(0, Number(ev.fires||0));
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    if (fires>0){
      const upd = await client.query('UPDATE fire_supply SET emitted = emitted + $1, updated_at=NOW() WHERE id=1 AND emitted + $1 <= total_max RETURNING emitted,total_max',[fires]);
      if (!upd.rows || !upd.rows[0]){ await client.query('ROLLBACK'); return { awarded:false }; }
    }
    if (coins>0){
      const w = await client.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
      const wid = w.rows?.[0]?.id; if (wid){
        await client.query('UPDATE wallets SET coins_balance = coins_balance + $2, updated_at=NOW() WHERE id=$1',[wid, coins]);
        await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_coin,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid,'welcome_bonus', coins, 'welcome', { userExt: ext }]);
      }
    }
    if (fires>0){
      const w2 = await client.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
      const wid2 = w2.rows?.[0]?.id; if (wid2){
        await client.query('UPDATE wallets SET fires_balance = fires_balance + $2, updated_at=NOW() WHERE id=$1',[wid2, fires]);
        await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid2,'welcome_bonus', fires, 'welcome', { userExt: ext }]);
      }
    }
    if (fires>0){
      const evId = ev.id || null;
      await client.query('INSERT INTO supply_txs(ts,type,amount,user_ext,user_id,event_id,reference,meta,actor) VALUES (NOW(),$1,$2,$3,$4,$5,$6,$7,$8)', ['welcome_bonus', fires, ext, dbUserId, evId, 'welcome', { coinsAwarded: coins }, 'system']);
    }
    await client.query('COMMIT');
  }catch(e){ try{ await client.query('ROLLBACK'); }catch(_){} throw e; }
  finally{ client.release(); }
  if (ev.id) await setClaimForEvent(ev.id, ext); else { try{ await ensureLegacyClaims(); await db.query('INSERT INTO welcome_claims(user_ext,claimed_at) VALUES($1,NOW()) ON CONFLICT DO NOTHING',[ext]); }catch(_){ } }
  return { awarded:true, coinsAwarded: coins, firesAwarded: fires, until: ev.endsAt };
}

// Compatibilidad con rutas legacy: setEvent/disableEvent ahora crean/actualizan welcome_events
async function setEvent(ev){
  const name = String(ev.name || 'Welcome Event');
  const message = String(ev.message || '');
  const coins = Math.max(0, parseInt(ev.coins||0,10));
  const fires = Math.max(0, parseInt(ev.fires||0,10));
  const durationHours = Math.max(1, Math.floor(Number(ev.durationHours)|| (ev.endsAt && ev.startsAt ? Math.max(1, Math.floor((Number(ev.endsAt)-Number(ev.startsAt))/3600000)) : 72)));
  const actor = 'legacy_api';
  // crear o reutilizar evento más reciente con mismos parámetros si está inactivo
  const created = await createEvent({ name, message, coins, fires, durationHours }, actor);
  if (ev.active){ await activateEvent({ eventId: created.id, startsAt: ev.startsAt ? new Date(ev.startsAt) : new Date(), actor }); }
  return getCurrentEvent();
}
async function disableEvent(){
  const cur = await getCurrentEvent();
  if (cur && cur.id) await deactivateEvent({ eventId: cur.id, actor: 'legacy_api' });
  return { success:true };
}

module.exports = { getEvent, getCurrentEvent, listEvents, createEvent, updateEvent, activateEvent, deactivateEvent, awardIfEligible, getWalletExtBalances };
