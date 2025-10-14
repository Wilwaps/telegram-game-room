const express = require('express');
const router = express.Router();
let roles = null; try { roles = require('../services/roles'); } catch(_) { roles = { getRoles: ()=> ['general'], grant: ()=>['general'], revoke: ()=>['general'], listAll: ()=>[] }; }

// GET /api/roles/me
router.get('/me', (req, res) => {
  try{
    const raw = String(req.headers.cookie || '');
    let sid='';
    for(const part of raw.split(/;\s*/)){ const [k,v]=part.split('='); if(k==='sid'){ sid=v; break; } }
    const auth = require('../services/authStore');
    const sess = sid ? auth.getSession(sid) : null;
    if (!sess) return res.status(401).json({ success:false, error:'no_session' });
    const r = roles.getRoles(sess.userId);
    res.json({ success:true, roles:r, userId: sess.userId });
  }catch(e){ res.status(500).json({ success:false, error:'roles_me_error' }); }
});

// POST /api/roles/grant { userId, role }
router.post('/grant', (req, res) => {
  try{
    const { userId, role } = req.body || {};
    if(!userId || !role) return res.status(400).json({ success:false, error:'invalid_params' });
    const r = roles.grant(userId, role);
    res.json({ success:true, roles:r });
  }catch(e){ res.status(400).json({ success:false, error: e && e.message || 'grant_error' }); }
});

// POST /api/roles/revoke { userId, role }
router.post('/revoke', (req, res) => {
  try{
    const { userId, role } = req.body || {};
    if(!userId || !role) return res.status(400).json({ success:false, error:'invalid_params' });
    const r = roles.revoke(userId, role);
    res.json({ success:true, roles:r });
  }catch(e){ res.status(400).json({ success:false, error: e && e.message || 'revoke_error' }); }
});

// GET /api/roles/all
router.get('/all', (req, res) => {
  try{ res.json({ success:true, items: roles.listAll() }); }
  catch(e){ res.status(500).json({ success:false, error:'roles_list_error' }); }
});

module.exports = router;
