"use strict";

const mem = require('../memoryStore');
let walletRepo = null; try { walletRepo = require('../../repos/walletRepo'); } catch(_) { walletRepo = null; }

function withTimeout(p, ms=2500, fallback={ ok:false, error:'timeout' }){
  return Promise.race([ p, new Promise(res => setTimeout(() => res(fallback), ms)) ]);
}

class EconomyService {
  constructor(){
    this.dbWalletEnabled = String(process.env.TTT_DB_WALLET||'false').toLowerCase()==='true';
  }
  isDb(){ return !!this.dbWalletEnabled; }
  setDbEnabled(v){ this.dbWalletEnabled = !!v; }

  async ensureWallet(userExt){
    if (!this.isDb() || !walletRepo) return { ok:true };
    try{
      const id = await withTimeout(walletRepo.mapExtToDbUserId(userExt));
      if (!id) return { ok:false, error:'wallet_user_not_found' };
      await withTimeout(walletRepo.ensureWallet(id));
      return { ok:true };
    }catch(e){ return { ok:false, error:'wallet_ensure_error' }; }
  }

  async getPotId(roomId){ return `ttt:pot:${String(roomId)}`; }

  async debit({ userId, amount, type, reference, asset }){
    const amt = Math.max(0, Number(amount||0));
    if (!amt) return { ok:false, error:'invalid_amount' };
    const assetKind = String(asset||'coins');
    if (this.isDb() && walletRepo){
      await this.ensureWallet(userId); // best effort
      if (assetKind==='coins'){
        return await withTimeout(walletRepo.debitCoinsByExt(userId, amt, { type:type||'ttt_debit', reference, meta:{ asset: 'coins' } }), 2500, { ok:false, error:'db_timeout' });
      } else {
        return await withTimeout(walletRepo.debitFiresByExt(userId, amt, { type:type||'ttt_debit', reference, meta:{ asset: 'fuego' } }), 2500, { ok:false, error:'db_timeout' });
      }
    }
    // memoria
    const potId = await this.getPotId(reference);
    if (assetKind==='coins'){
      const r = mem.transferCoins({ fromUserId: userId, toUserId: potId, amount: amt, reason: 'ttt_wager_pot' });
      return r && r.ok ? { ok:true } : { ok:false, error: (r && r.error)||'insufficient_coins' };
    } else {
      const r = mem.transferFires({ fromUserId: userId, toUserId: potId, amount: amt, reason: 'ttt_wager_pot' });
      return r && r.ok ? { ok:true } : { ok:false, error: (r && r.error)||'insufficient_fires' };
    }
  }

  async credit({ userId, amount, type, reference, asset }){
    const amt = Math.max(0, Number(amount||0));
    if (!amt) return { ok:true };
    const assetKind = String(asset||'coins');
    if (this.isDb() && walletRepo){
      if (assetKind==='coins'){
        return await withTimeout(walletRepo.creditCoinsByExt(userId, amt, { type:type||'ttt_credit', reference, meta:{ asset: 'coins' } }), 2500, { ok:false, error:'db_timeout' });
      } else {
        return await withTimeout(walletRepo.creditFiresByExt(userId, amt, { type:type||'ttt_credit', reference, meta:{ asset: 'fuego' } }), 2500, { ok:false, error:'db_timeout' });
      }
    }
    // memoria
    const potId = await this.getPotId(reference);
    if (assetKind==='coins'){
      const r = mem.transferCoins({ fromUserId: potId, toUserId: userId, amount: amt, reason: 'ttt_payout' });
      return r && r.ok ? { ok:true } : { ok:false, error: (r && r.error)||'mem_credit_error' };
    } else {
      const r = mem.transferFires({ fromUserId: potId, toUserId: userId, amount: amt, reason: 'ttt_payout' });
      return r && r.ok ? { ok:true } : { ok:false, error: (r && r.error)||'mem_credit_error' };
    }
  }
}

module.exports = new EconomyService();
