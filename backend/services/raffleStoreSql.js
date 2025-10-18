const EventEmitter = require('events');
const db = require('../db');

class RaffleStoreSql extends EventEmitter {
  constructor(){ super(); }

  sizeFromRange(range){ return (range === '000-999') ? 1000 : 100; }

  async mapExtToDbUserId(userExt){
    try{
      const v = String(userExt||'').trim(); if (!v) return null;
      if (v.startsWith('db:')) return v.slice(3);
      if (v.startsWith('tg:')) {
        const tg = v.slice(3);
        const r = await db.query('SELECT id FROM users WHERE tg_id=$1 LIMIT 1', [tg]);
        return (r.rows && r.rows[0] && r.rows[0].id) || null;
      }
      if (v.startsWith('em:')) {
        const em = v.slice(3).toLowerCase();
        const r = await db.query('SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1', [em]);
        return (r.rows && r.rows[0] && r.rows[0].id) || null;
      }
      return null;
    }catch(_){ return null; }
  }

  getPublicInfoRow(r){
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      hostId: r.host_ext || (r.host_id?('db:'+r.host_id):null),
      hostName: r.host_name,
      mode: r.mode,
      entryPrice: Number(r.entry_price_fire||0),
      visibility: r.visibility,
      range: r.range,
      size: r.size,
      createdAt: r.created_at?.getTime?.() || new Date(r.created_at).getTime(),
      endsAt: r.ends_at ? (r.ends_at.getTime? r.ends_at.getTime() : new Date(r.ends_at).getTime()) : null,
      status: r.status,
      sold: Number(r.sold||0),
      reserved: Number(r.reserved||0),
      available: Math.max(0, Number(r.size||0) - Number(r.sold||0) - Number(r.reserved||0)),
      potFires: Number(r.pot_fires||0),
      prize: (r.prize_meta && r.prize_meta.prize) || undefined
    };
  }

  async listPublic({ limit=20, offset=0 }={}){
    const l = Math.max(1, Math.min(50, Number(limit)||20));
    const o = Math.max(0, Number(offset)||0);
    const q = `
      WITH cte AS (
        SELECT r.*, 
          SUM(CASE WHEN n.state='sold' THEN 1 ELSE 0 END) AS sold,
          SUM(CASE WHEN n.state='reserved' THEN 1 ELSE 0 END) AS reserved
        FROM raffles r
        LEFT JOIN raffle_numbers n ON n.raffle_id = r.id
        WHERE r.visibility='public' AND r.status IN ('open','running')
        GROUP BY r.id
      )
      SELECT * FROM cte ORDER BY created_at DESC LIMIT $1 OFFSET $2
    `;
    const rs = await db.query(q, [l, o]);
    const items = (rs.rows||[]).map(r=>this.getPublicInfoRow(r));
    return { items, total: items.length, limit:l, offset:o };
  }

  async listByHost(hostExt, { limit=20, offset=0 }={}){
    const l = Math.max(1, Math.min(50, Number(limit)||20));
    const o = Math.max(0, Number(offset)||0);
    const rs = await db.query(
      `WITH cte AS (
         SELECT r.*, 
           SUM(CASE WHEN n.state='sold' THEN 1 ELSE 0 END) AS sold,
           SUM(CASE WHEN n.state='reserved' THEN 1 ELSE 0 END) AS reserved
         FROM raffles r
         LEFT JOIN raffle_numbers n ON n.raffle_id = r.id
         WHERE r.host_meta->>'hostExt' = $1
         GROUP BY r.id)
       SELECT * FROM cte ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [String(hostExt||''), l, o]
    );
    const items = (rs.rows||[]).map(r=>this.getPublicInfoRow(r));
    return { items, total: items.length, limit:l, offset:o };
  }

  async listParticipating(userExt, { limit=20, offset=0 }={}){
    const l = Math.max(1, Math.min(50, Number(limit)||20));
    const o = Math.max(0, Number(offset)||0);
    const rs = await db.query(
      `WITH cte AS (
         SELECT r.*, 
           SUM(CASE WHEN n.state='sold' THEN 1 ELSE 0 END) AS sold,
           SUM(CASE WHEN n.state='reserved' THEN 1 ELSE 0 END) AS reserved
         FROM raffles r
         JOIN raffle_participants p ON p.raffle_id = r.id AND p.user_ext = $1
         LEFT JOIN raffle_numbers n ON n.raffle_id = r.id
         GROUP BY r.id)
       SELECT * FROM cte ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [String(userExt||''), l, o]
    );
    const items = (rs.rows||[]).map(r=>this.getPublicInfoRow(r));
    return { items, total: items.length, limit:l, offset:o };
  }

  async findById(id){
    const r = await db.query('SELECT * FROM raffles WHERE id=$1', [id]);
    const row = (r.rows && r.rows[0]) ? r.rows[0] : null;
    if (!row) return null;
    const size = this.sizeFromRange(row.range);
    return { ...row, size };
  }
  async findByCode(code){
    const r = await db.query('SELECT * FROM raffles WHERE code = $1', [String(code||'').toUpperCase()]);
    return (r.rows && r.rows[0]) ? r.rows[0] : null;
  }

  async details(id){
    const q = `
      SELECT r.*, 
        SUM(CASE WHEN n.state='sold' THEN 1 ELSE 0 END) AS sold,
        SUM(CASE WHEN n.state='reserved' THEN 1 ELSE 0 END) AS reserved
      FROM raffles r LEFT JOIN raffle_numbers n ON n.raffle_id=r.id WHERE r.id=$1 GROUP BY r.id`;
    const rs = await db.query(q, [id]);
    const row = (rs.rows||[])[0]; if (!row) return null;
    const nums = await db.query('SELECT number_idx AS idx, CASE state WHEN \'available\' THEN 0 WHEN \'reserved\' THEN 1 ELSE 2 END AS state FROM raffle_numbers WHERE raffle_id=$1 ORDER BY number_idx ASC', [id]);
    return { ...this.getPublicInfoRow(row), numbers: nums.rows||[], participants: [] };
  }

  getPublicInfo(rec){ return rec; }

  async create({ hostId, hostName, mode='fire', entryPrice=10, visibility='public', range='00-99', time='winner', name, hostMeta, prizeMeta }){
    const rng = (range === '000-999') ? '000-999' : '00-99';
    const size = this.sizeFromRange(rng);
    const vis = (visibility === 'private') ? 'private' : 'public';
    const tm = (time === '1d' || time === '1w') ? time : 'winner';
    const client = await db.pool.connect();
    try{
      await client.query('BEGIN');
      const code = 'R' + Math.random().toString(36).slice(2,7).toUpperCase();
      const endsAt = tm === '1d' ? new Date(Date.now()+24*3600*1000) : tm === '1w' ? new Date(Date.now()+7*24*3600*1000) : null;
      const rIns = await client.query(
        `INSERT INTO raffles(code, host_id, name, mode, entry_price_fire, range, visibility, status, host_meta, prize_meta, created_at, ends_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,NOW(),$10) RETURNING id, code`,
        [code, await this.mapExtToDbUserId(hostId), String(name||code), String(mode), Number(entryPrice||0), rng, vis, { hostExt:String(hostId||''), hostName: hostName||null }, prizeMeta||null, endsAt]
      );
      const raffleId = rIns.rows[0].id;
      const values = [];
      for (let i=0;i<size;i++){ values.push(`('${raffleId}', ${i}, 'available', NULL, NULL, NULL, NOW())`); }
      await client.query(`INSERT INTO raffle_numbers(raffle_id, number_idx, state, reserved_by_ext, reserved_until, sold_to_ext, updated_at) VALUES ${values.join(',')}`);
      await client.query('COMMIT');
      const out = { id: raffleId, code, hostId: String(hostId||''), hostName, mode, entryPrice: Number(entryPrice||0), visibility: vis, range: rng, size, time: tm, createdAt: Date.now(), endsAt: endsAt?endsAt.getTime():null, status:'open' };
      try{ this.emit('raffle_updated', { id: raffleId }); }catch(_){ }
      return out;
    }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} throw err; }
    finally{ client.release(); }
  }

  async reserve({ id, userId, number }){
    const client = await db.pool.connect();
    try{
      await client.query('BEGIN');
      const idx = Math.max(0, Number(number)||0);
      const q = await client.query('SELECT state, reserved_by_ext FROM raffle_numbers WHERE raffle_id=$1 AND number_idx=$2 FOR UPDATE', [id, idx]);
      const cur = q.rows[0]; if (!cur) throw new Error('not_found');
      if (cur.state !== 'available') throw new Error('not_available');
      await client.query('UPDATE raffle_numbers SET state=\'reserved\', reserved_by_ext=$1, reserved_until=NOW()+INTERVAL \'45 seconds\', updated_at=NOW() WHERE raffle_id=$2 AND number_idx=$3', [String(userId||''), id, idx]);
      await client.query('COMMIT');
      try{ this.emit('raffle_updated', { id, idx, action:'reserve' }); }catch(_){ }
      return { ok:true, idx };
    }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} throw err; }
    finally{ client.release(); }
  }

  async release({ id, userId, number }){
    const client = await db.pool.connect();
    try{
      await client.query('BEGIN');
      const idx = Math.max(0, Number(number)||0);
      const q = await client.query('SELECT state, reserved_by_ext FROM raffle_numbers WHERE raffle_id=$1 AND number_idx=$2 FOR UPDATE', [id, idx]);
      const cur = q.rows[0]; if (!cur) throw new Error('not_found');
      if (cur.state === 'reserved' && String(cur.reserved_by_ext||'') === String(userId||'')){
        await client.query('UPDATE raffle_numbers SET state=\'available\', reserved_by_ext=NULL, reserved_until=NULL, updated_at=NOW() WHERE raffle_id=$1 AND number_idx=$2', [id, idx]);
      }
      await client.query('COMMIT');
      try{ this.emit('raffle_updated', { id, idx, action:'release' }); }catch(_){ }
      return { ok:true };
    }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} throw err; }
    finally{ client.release(); }
  }

  async confirm({ id, userId, number, reference }){
    const client = await db.pool.connect();
    try{
      await client.query('BEGIN');
      const r0 = await client.query('SELECT mode, entry_price_fire, size, ends_at FROM raffles WHERE id=$1 FOR UPDATE', [id]);
      if (!r0.rows[0]) throw new Error('raffle_not_found');
      const mode = r0.rows[0].mode;
      const price = Number(r0.rows[0].entry_price_fire||0);
      const idx = Math.max(0, Number(number)||0);
      const q = await client.query('SELECT state, reserved_by_ext FROM raffle_numbers WHERE raffle_id=$1 AND number_idx=$2 FOR UPDATE', [id, idx]);
      const cur = q.rows[0]; if (!cur) throw new Error('not_found');
      if (!(cur.state === 'available' || (cur.state==='reserved' && String(cur.reserved_by_ext||'')===String(userId||'')))) throw new Error('not_available');
      if (mode === 'fire'){
        // incrementar pot y (en versión extendida) debitar wallet del usuario (se hará cuando marquemos DB-only wallets activos)
        await client.query('UPDATE raffles SET pot_fires = COALESCE(pot_fires,0) + $2 WHERE id=$1', [id, price]);
      } else if (mode === 'prize') {
        throw new Error('invalid_mode_for_confirm');
      }
      await client.query('UPDATE raffle_numbers SET state=\'sold\', sold_to_ext=$1, reserved_by_ext=NULL, reserved_until=NULL, reference=$2, updated_at=NOW() WHERE raffle_id=$3 AND number_idx=$4', [String(userId||''), String(reference||''), id, idx]);
      await client.query('INSERT INTO raffle_participants (raffle_id, user_ext, numbers, fires_spent, status) VALUES ($1,$2, ARRAY[$3], $4, \'active\') ON CONFLICT (raffle_id, user_ext) DO UPDATE SET numbers = array_append(raffle_participants.numbers, $3), fires_spent = raffle_participants.fires_spent + $4', [id, String(userId||''), idx, mode==='fire'?price:0]);
      await client.query('COMMIT');
      try{ this.emit('raffle_updated', { id, idx, action:'confirm' }); }catch(_){ }
      return { ok:true };
    }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} throw err; }
    finally{ client.release(); }
  }

  async closeAndPayout(r){
    // Marcar como cerrado/completado y repartir pot (70/20/10) si hay modo fire
    try{
      const client = await db.pool.connect();
      try{
        await client.query('BEGIN');
        const rs = await client.query('SELECT id, mode, host_id, host_meta, pot_fires FROM raffles WHERE id=$1 FOR UPDATE', [r.id||r]);
        const row = rs.rows[0]; if (!row) { await client.query('ROLLBACK'); return; }
        await client.query('UPDATE raffles SET status=\'closed\' WHERE id=$1', [row.id]);
        if (row.mode === 'fire'){
          const pot = Number(row.pot_fires||0);
          if (pot>0){
            const g = Math.floor(pot*0.70); const h = Math.floor(pot*0.20); const s = Math.max(0, pot-g-h);
            const hostDbId = row.host_id || null;
            // Sponsor TG fijo
            const sponsorDbId = await this.mapExtToDbUserId('tg:1417856820');
            if (g>0) await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) SELECT w.id, $1, $2, $3, $4, NOW() FROM wallets w WHERE w.user_id = $5', ['raffle_payout_winner', g, String(row.id), { raffleId: row.id }, null]);
            if (h>0 && hostDbId) await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) SELECT w.id, $1, $2, $3, $4, NOW() FROM wallets w WHERE w.user_id = $5', ['raffle_payout_host', h, String(row.id), { raffleId: row.id }, hostDbId]);
            if (s>0 && sponsorDbId) await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) SELECT w.id, $1, $2, $3, $4, NOW() FROM wallets w WHERE w.user_id = $5', ['raffle_payout_sponsor', s, String(row.id), { raffleId: row.id }, sponsorDbId]);
          }
        }
        await client.query('UPDATE raffles SET status=\'completed\' WHERE id=$1', [row.id]);
        await client.query('COMMIT');
      }catch(e){ try{ await client.query('ROLLBACK'); }catch(_){} }
      finally{ client.release(); }
      try{ this.emit('raffle_updated', { id: r.id||r, action:'completed' }); }catch(_){ }
    }catch(_){ }
  }
}

module.exports = new RaffleStoreSql();
