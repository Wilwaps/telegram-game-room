const express = require('express');
const router = express.Router();
const inbox = require('../services/messageStore');

router.get('/inbox/:userId', (req,res)=>{
  const { userId } = req.params; const { unreadOnly, limit, offset } = req.query||{};
  const out = inbox.inboxList(userId, { onlyUnread: String(unreadOnly||'')==='1', limit, offset });
  res.json({ success:true, ...out });
});

router.get('/unread-count/:userId', (req,res)=>{
  const n = inbox.unreadCount(req.params.userId);
  res.json({ success:true, count: n });
});

router.post('/read-all', (req,res)=>{
  const { userId } = req.body||{};
  const out = inbox.readAll(userId);
  res.json({ success:true, ...out });
});

module.exports = router;
