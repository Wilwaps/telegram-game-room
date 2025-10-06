/**
 * ============================================
 * SERVIDOR PRINCIPAL
 * ============================================
 * 
 * Punto de entrada de la aplicación.
 * Configura Express, Socket.io y todos los servicios.
 * 
 * @module server
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Configuración
const { server, security, constants } = require('./config/config');
const logger = require('./config/logger');

// Servicios
const redisService = require('./services/redisService');
const socketService = require('./services/socketService');
const telegramService = require('./services/telegramService');
const xpService = require('./services/xpService');
const tokenService = require('./services/tokenService');

// ============================================
// INICIALIZACIÓN
// ============================================

const app = express();
const httpServer = http.createServer(app);

// Configurar Socket.io
const io = socketIo(httpServer, {
  cors: {
    origin: security.cors.origin,
    methods: ['GET', 'POST'],
    credentials: security.cors.credentials
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

 

// ============================================
// MIDDLEWARE
// ============================================

// Trust proxy (necesario para Railway y otros servicios con proxy)
app.set('trust proxy', 1);

// Seguridad
app.use(helmet({
  contentSecurityPolicy: false // Deshabilitado para MiniApps
}));

// CORS
app.use(cors(security.cors));

// Compresión
app.use(compression());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: security.rateLimit.windowMs,
  max: security.rateLimit.maxRequests,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Logging de requests
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
});

// Servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================
// RUTAS API
// ============================================

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: server.env,
    services: {
      redis: redisService.isReady(),
      telegram: telegramService.isReady()
    }
  });
});

/**
 * Obtener estadísticas del servidor
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await socketService.getServerStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

/**
 * Obtener salas públicas
 */
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await redisService.getPublicRooms();
    res.json({
      success: true,
      rooms: rooms.map(r => r.toJSON())
    });
  } catch (error) {
    logger.error('Error al obtener salas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener salas'
    });
  }
});

/**
 * Obtener información de sala específica
 */
app.get('/api/rooms/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const room = await redisService.getRoom(code);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala no encontrada'
      });
    }
    
    res.json({
      success: true,
      room: room.toJSON()
    });
  } catch (error) {
    logger.error('Error al obtener sala:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener sala'
    });
  }
});

/**
 * Obtener estadísticas de usuario
 */
app.get('/api/users/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await redisService.getUserStats(userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

/**
 * Tokenomics 🔥 - métricas y configuración
 */
app.get('/api/token/metrics', async (req, res) => {
  try {
    const metrics = await tokenService.getMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    logger.error('Error /api/token/metrics:', error);
    res.status(500).json({ success: false, error: 'Error al obtener métricas' });
  }
});

app.post('/api/token/config', async (req, res) => {
  try {
    const { supplyCap } = req.body || {};
    const cap = await tokenService.setSupplyCap(supplyCap);
    res.json({ success: true, supplyCap: cap });
  } catch (error) {
    logger.error('Error /api/token/config:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar configuración' });
  }
});

/**
 * Configuración de XP (umbrales)
 */
app.get('/api/xp/config', async (req, res) => {
  try {
    const thresholds = await xpService.getThresholds();
    res.json({ success: true, thresholds });
  } catch (error) {
    logger.error('Error /api/xp/config [GET]:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración XP' });
  }
});

app.post('/api/xp/config', async (req, res) => {
  try {
    const { thresholds } = req.body || {};
    const updated = await xpService.setThresholds(thresholds || {});
    res.json({ success: true, thresholds: updated });
  } catch (error) {
    logger.error('Error /api/xp/config [POST]:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar configuración XP' });
  }
});

/**
 * Webhook de Telegram (opcional)
 */
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    // Procesar actualización de Telegram
    logger.info('Webhook de Telegram recibido');
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error en webhook de Telegram:', error);
    res.sendStatus(500);
  }
});

// ============================================
// RUTA PRINCIPAL (SPA)
// ============================================

// Dashboard de administración
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard/index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ============================================
// MANEJO DE ERRORES
// ============================================

/**
 * Manejador de errores 404
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

/**
 * Manejador de errores global
 */
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: server.isDevelopment ? err.message : 'Error interno del servidor',
    ...(server.isDevelopment && { stack: err.stack })
  });
});

// ============================================
// INICIALIZACIÓN DE SERVICIOS
// ============================================

async function initializeServices() {
  try {
    logger.info('🚀 Iniciando servicios...');

    // Conectar a Redis
    await redisService.connect();
    logger.info('✅ Redis conectado');

    // Inicializar Socket.io
    socketService.initialize(io);
    logger.info('✅ Socket.io inicializado');

    // Inicializar Telegram Bot
    telegramService.initialize();
    logger.info('✅ Telegram Bot inicializado');

    logger.info('✅ Todos los servicios iniciados correctamente');

  } catch (error) {
    logger.error('❌ Error al inicializar servicios:', error);
    throw error;
  }
}

// ============================================
// INICIO DEL SERVIDOR
// ============================================

async function startServer() {
  try {
    // Inicializar servicios
    await initializeServices();

    // Iniciar servidor HTTP
    httpServer.listen(server.port, server.host, () => {
      logger.info('');
      logger.info('╔════════════════════════════════════════════╗');
      logger.info('║   🎮 SALA DE JUEGOS - SERVIDOR ACTIVO 🎮  ║');
      logger.info('╚════════════════════════════════════════════╝');
      logger.info('');
      logger.info(`🌐 Servidor: http://${server.host}:${server.port}`);
      logger.info(`🔧 Entorno: ${server.env}`);
      logger.info(`📁 Frontend: ${path.join(__dirname, '../frontend')}`);
      logger.info('');
      logger.info('Servicios activos:');
      logger.info(`  ✅ Redis: ${redisService.isReady() ? 'Conectado' : 'Desconectado'}`);
      logger.info(`  ✅ Socket.io: Activo`);
      logger.info(`  ✅ Telegram Bot: ${telegramService.isReady() ? 'Activo' : 'Inactivo'}`);
      logger.info('');
      logger.info('Presiona Ctrl+C para detener el servidor');
      logger.info('');
    });

  } catch (error) {
    logger.error('❌ Error fatal al iniciar servidor:', error);
    process.exit(1);
  }
}

// ============================================
// MANEJO DE SEÑALES DEL SISTEMA
// ============================================

/**
 * Cierre graceful del servidor
 */
async function gracefulShutdown(signal) {
  logger.info(`\n${signal} recibido, cerrando servidor...`);

  try {
    // Cerrar servidor HTTP
    httpServer.close(() => {
      logger.info('✅ Servidor HTTP cerrado');
    });

    // Desconectar Socket.io
    io.close(() => {
      logger.info('✅ Socket.io cerrado');
    });

    // Desconectar Redis
    await redisService.disconnect();
    logger.info('✅ Redis desconectado');

    logger.info('👋 Servidor cerrado correctamente');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Error durante el cierre:', error);
    process.exit(1);
  }
}

// Capturar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capturar errores no manejados
process.on('uncaughtException', (error) => {
  logger.error('❌ Excepción no capturada:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promesa rechazada no manejada:', reason);
  gracefulShutdown('unhandledRejection');
});

// ============================================
// INICIAR APLICACIÓN
// ============================================

if (require.main === module) {
  startServer();
}

// Exportar para testing
module.exports = { app, httpServer, io };
