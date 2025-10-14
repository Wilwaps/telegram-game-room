const express = require('express');
const router = express.Router();
let roles = null; try { roles = require('../services/roles'); } catch(_) { roles = { getRoles: ()=> ['general'], grant: ()=>['general'], revoke: ()=>['general'], listAll: ()=>[] }; }
const auth = require('../services/authStore');

function getSessUserId(req){
  const raw = String(req.headers.cookie || '');
  let sid='';
  for(const part of raw.split(/;\s*/)){ const [k,v]=part.split('='); if(k==='sid'){ sid=v; break; } }
  const sess = sid ? auth.getSession(sid) : null;
  return (sess && sess.userId) ? String(sess.userId) : '';
}
function requireAdmin(req,res,next){
  try{
    const uid = getSessUserId(req);
    if (!uid) return res.status(401).json({ success:false, error:'no_session' });
    const rs = roles.getRoles(uid);
    if (!rs.includes('tote') && !rs.includes('admin')) return res.status(403).json({ success:false, error:'forbidden' });
    return next();
  }catch(e){ return res.status(500).json({ success:false, error:'authz_error' }); }
}

// GET /api/roles/me
router.get('/me', (req, res) => {
  try{
    const uid = getSessUserId(req);
    const sess = uid ? { userId: uid } : null;
    if (!sess) return res.status(401).json({ success:false, error:'no_session' });
    const r = roles.getRoles(sess.userId);
    res.json({ success:true, roles:r, userId: sess.userId });
  }catch(e){ res.status(500).json({ success:false, error:'roles_me_error' }); }
});

// POST /api/roles/grant { userId, role }
router.post('/grant', requireAdmin, (req, res) => {
  try{
    const { userId, role } = req.body || {};
    if(!userId || !role) return res.status(400).json({ success:false, error:'invalid_params' });
    const r = roles.grant(userId, role);
    res.json({ success:true, roles:r });
  }catch(e){ res.status(400).json({ success:false, error: e && e.message || 'grant_error' }); }
});

// POST /api/roles/revoke { userId, role }
router.post('/revoke', requireAdmin, (req, res) => {
  try{
    const { userId, role } = req.body || {};
    if(!userId || !role) return res.status(400).json({ success:false, error:'invalid_params' });
    const r = roles.revoke(userId, role);
    res.json({ success:true, roles:r });
  }catch(e){ res.status(400).json({ success:false, error: e && e.message || 'revoke_error' }); }
});

// GET /api/roles/all
router.get('/all', requireAdmin, (req, res) => {
  try{ res.json({ success:true, items: roles.listAll() }); }
  catch(e){ res.status(500).json({ success:false, error:'roles_list_error' }); }
});

module.exports = router;
