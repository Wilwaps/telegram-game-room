class MessageStore {
  constructor(){ this.inbox = new Map(); }
  _arr(uid){ const id=String(uid||'').trim(); if(!this.inbox.has(id)) this.inbox.set(id, []); return this.inbox.get(id); }
  send({ toUserId, text, meta }){
    const uid=String(toUserId||'').trim(); if(!uid) return null;
    const msg = { id: 'msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), ts: Date.now(), text: String(text||''), meta: meta||{}, read: false };
    const arr = this._arr(uid); arr.unshift(msg); this.inbox.set(uid, arr.slice(0,200));
    return msg;
  }
  inboxList(userId, { onlyUnread=false, limit=50, offset=0 }={}){
    const arr = this._arr(userId);
    const data = onlyUnread ? arr.filter(m=>!m.read) : arr;
    const l=Math.max(1,Math.min(100,Number(limit)||50)); const o=Math.max(0,Number(offset)||0);
    return { items: data.slice(o,o+l), total: data.length, limit:l, offset:o };
  }
  unreadCount(userId){ return this._arr(userId).filter(m=>!m.read).length; }
  readAll(userId){ const arr=this._arr(userId); for(const m of arr){ m.read=true; } return { ok:true }; }
}

module.exports = new MessageStore();
