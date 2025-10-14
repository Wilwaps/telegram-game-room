const ALLOWED = new Set(['tote','admin','sponsor','shop','general']);

class RolesService {
  constructor(){
    this.map = new Map(); // userId -> Set(roles)
    this._seedFromEnv();
  }
  _ensure(userId){
    const id = String(userId||'').trim();
    if(!id) return new Set();
    if(!this.map.has(id)) this.map.set(id, new Set(['general']));
    return this.map.get(id);
  }
  getRoles(userId){
    const set = this._ensure(userId);
    return Array.from(set);
  }
  hasRole(userId, role){
    const set = this._ensure(userId);
    return set.has(String(role||'').toLowerCase());
  }
  grant(userId, role){
    const r = String(role||'').toLowerCase();
    if(!ALLOWED.has(r)) throw new Error('invalid_role');
    const set = this._ensure(userId);
    set.add(r);
    this.map.set(String(userId), set);
    return Array.from(set);
  }
  revoke(userId, role){
    const r = String(role||'').toLowerCase();
    const set = this._ensure(userId);
    set.delete(r);
    if(set.size===0) set.add('general');
    this.map.set(String(userId), set);
    return Array.from(set);
  }
  listAll(){
    const out = [];
    for(const [k,v] of this.map.entries()) out.push({ userId:k, roles: Array.from(v)});
    return out;
  }
  _seedFromEnv(){
    try{
      const parse = (s)=> String(s||'').split(/[;,\s]+/).map(x=>x.trim()).filter(Boolean);
      const addAll = (ids, role)=>{ for(const id of ids){ try{ this.grant(id, role);}catch(_){} } };
      const toteIds = parse(process.env.ROLE_TOTE_USER_IDS || process.env.TOTE_ID);
      const adminIds = parse(process.env.ROLE_ADMIN_USER_IDS);
      const sponsorIds = parse(process.env.ROLE_SPONSOR_USER_IDS);
      const shopIds = parse(process.env.ROLE_SHOP_USER_IDS);
      addAll(toteIds, 'tote');
      addAll(adminIds, 'admin');
      addAll(sponsorIds, 'sponsor');
      addAll(shopIds, 'shop');
    }catch(_){/* ignore */}
  }
}

module.exports = new RolesService();
