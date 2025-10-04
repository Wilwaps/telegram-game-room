/**
 * ============================================
 * SISTEMA DE LOGGING
 * ============================================
 * 
 * Configuración de Winston para logging estructurado
 * con diferentes niveles y formatos.
 * 
 * @module logger
 */

const winston = require('winston');
const path = require('path');
const { logging, server } = require('./config');

/**
 * Formato personalizado para logs
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Formato para consola (desarrollo)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

/**
 * Transports de Winston
 */
const transports = [];

// Console transport (siempre activo)
transports.push(
  new winston.transports.Console({
    format: server.isDevelopment ? consoleFormat : customFormat,
    level: logging.level
  })
);

// File transport (solo en producción)
if (server.isProduction) {
  // Log de errores
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: customFormat
    })
  );
  
  // Log combinado
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), logging.file),
      maxsize: 10485760, // 10MB
      maxFiles: parseInt(logging.maxFiles, 10),
      format: customFormat
    })
  );
}

/**
 * Crear instancia de logger
 */
const logger = winston.createLogger({
  level: logging.level,
  format: customFormat,
  transports,
  exitOnError: false
});

/**
 * Métodos auxiliares para logging estructurado
 */
logger.logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logSocketEvent = (event, data = {}) => {
  logger.debug('Socket Event', {
    event,
    ...data
  });
};

logger.logGameEvent = (event, roomCode, data = {}) => {
  logger.info('Game Event', {
    event,
    roomCode,
    ...data
  });
};

/**
 * Stream para Morgan (HTTP logging middleware)
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
