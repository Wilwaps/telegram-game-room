const express = require('express');
const router = express.Router();
const profileService = require('../services/profileService');
const logger = require('../config/logger');

// Nota: Estas rutas asumen que el frontend (MiniApp) conoce su userId de Telegram
// En producción se debe validar la identidad vía Telegram WebApp initData

// GET /api/profile/:userId
router.get('/:userId', async (req,res)=>{
  try{
    const profile = await profileService.getProfile(req.params.userId);
    res.json({ success:true, profile });
  }catch(err){
    logger.error('GET /profile/:userId error:', err);
    res.status(400).json({ success:false, error: err.message || 'No se pudo obtener el perfil' });
  }
});

// POST /api/profile/:userId
// body: { firstName, lastName, phone, email }
router.post('/:userId', async (req,res)=>{
  try{
    const out = await profileService.updateProfile(req.params.userId, req.body||{});
    res.json({ success:true, profile: out });
  }catch(err){
    logger.error('POST /profile/:userId error:', err);
    res.status(400).json({ success:false, error: err.message || 'No se pudo actualizar el perfil' });
  }
});

// POST /api/profile/:userId/request-key-change
// body: { newKey, note }
router.post('/:userId/request-key-change', async (req,res)=>{
  try{
    const { newKey, note } = req.body||{};
    const out = await profileService.requestKeyChange(req.params.userId, newKey, note);
    res.json({ success:true, ...out });
  }catch(err){
    logger.error('POST /profile/:userId/request-key-change error:', err);
    res.status(400).json({ success:false, error: err.message || 'No se pudo solicitar cambio de clave' });
  }
});

module.exports = router;
