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
const supplyService = require('./services/supplyService');
const economyRoutes = require('./routes/economy');
const xpRoutes = require('./routes/xp');
const brawlEvents = require('./games/brawl/events');

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
app.use(helmet({ contentSecurityPolicy: false }));

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
  maxRequests: security.rateLimit.maxRequests,
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

// Control de caché: no cachear HTML para evitar pantallas viejas en producción
app.use((req, res, next) => {
  try {
    if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
    }
  } catch (_) {}
  next();
});

// Servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas API
app.use('/api/economy', economyRoutes);
app.use('/api/xp', xpRoutes);

// ============================================
// RUTA PRINCIPAL (SPA)
// ============================================

// Dashboard de administración (no cachear)
app.get('/dashboard', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  res.sendFile(path.join(__dirname, '../frontend/dashboard/index.html'));
});

// Vista de Brawl (arena)
app.get('/brawl', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/brawl/index.html'));
});

app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
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

    // Inicializar namespace de Brawl
    brawlEvents.initialize(io);
    logger.info('✅ Brawl namespace inicializado');

    // Inicializar Telegram Bot
    telegramService.initialize();
    logger.info('✅ Telegram Bot inicializado');

    // Inicializar Supply (idempotente)
    try {
      await supplyService.initIfNeeded();
      logger.info('✅ Supply inicializado');
    } catch (e) {
      logger.error('❌ Error al inicializar Supply:', e);
    }

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
