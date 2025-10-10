/**
 * ============================================
 * UTILIDADES DE VALIDACIÓN
 * ============================================
 * 
 * Funciones para validar datos de entrada,
 * generar códigos únicos y sanitizar información.
 * 
 * @module utils/validation
 */

const Joi = require('joi');

/**
 * Generar código único de sala (6 dígitos)
 * @returns {string} Código de sala
 */
function generateRoomCode() {
  const characters = '0123456789';
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters.charAt(randomIndex);
  }
  
  return code;
}

/**
 * Validar código de sala
 * @param {string} code - Código a validar
 * @returns {boolean}
 */
function isValidRoomCode(code) {
  return /^\d{6}$/.test(code);
}

/**
 * Validar ID de usuario de Telegram
 * @param {string|number} userId - ID del usuario
 * @returns {boolean}
 */
function isValidUserId(userId) {
  const id = parseInt(userId, 10);
  return !isNaN(id) && id > 0;
}

/**
 * Sanitizar nombre de usuario
 * @param {string} userName - Nombre a sanitizar
 * @returns {string} Nombre sanitizado
 */
function sanitizeUserName(userName) {
  if (!userName || typeof userName !== 'string') {
    return 'Usuario';
  }
  
  // Remover caracteres especiales y limitar longitud
  return userName
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 50);
}

/**
 * Validar URL de avatar
 * @param {string} url - URL a validar
 * @returns {boolean}
 */
function isValidAvatarUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validar posición en el tablero
 * @param {number} position - Posición (0-8 para Tic Tac Toe)
 * @param {number} boardSize - Tamaño del tablero
 * @returns {boolean}
 */
function isValidPosition(position, boardSize = 9) {
  const pos = parseInt(position, 10);
  return !isNaN(pos) && pos >= 0 && pos < boardSize;
}

/**
 * Schema de validación para crear sala
 */
const createRoomSchema = Joi.object({
  userId: Joi.alternatives().try(
    Joi.string().required(),
    Joi.number().positive().required()
  ),
  userName: Joi.string().min(1).max(50).required(),
  userAvatar: Joi.string().uri().optional().allow(''),
  isPublic: Joi.boolean().optional().default(false),
  gameType: Joi.string().valid('tic-tac-toe', 'connect-four', 'checkers').optional().default('tic-tac-toe')
});

/**
 * Schema de validación para unirse a sala
 */
const joinRoomSchema = Joi.object({
  roomCode: Joi.string().length(6).pattern(/^\d+$/).required(),
  userId: Joi.alternatives().try(
    Joi.string().required(),
    Joi.number().positive().required()
  ),
  userName: Joi.string().min(1).max(50).required(),
  userAvatar: Joi.string().uri().optional().allow('')
});

/**
 * Schema de validación para hacer movimiento
 */
const makeMoveSchema = Joi.object({
  roomCode: Joi.string().length(6).pattern(/^\d+$/).required(),
  position: Joi.number().integer().min(0).max(8).required(),
  userId: Joi.alternatives().try(
    Joi.string().required(),
    Joi.number().positive().required()
  )
});

/**
 * Schema de validación para autenticación
 */
const authenticateSchema = Joi.object({
  userId: Joi.alternatives().try(
    Joi.string().required(),
    Joi.number().positive().required()
  ),
  userName: Joi.string().min(1).max(50).required(),
  userAvatar: Joi.string().uri().optional().allow(''),
  firstName: Joi.string().max(50).optional().allow(''),
  lastName: Joi.string().max(50).optional().allow(''),
  languageCode: Joi.string().length(2).optional().default('es')
});

/**
 * Validar datos con schema de Joi
 * @param {Object} data - Datos a validar
 * @param {Object} schema - Schema de Joi
 * @returns {Object} { valid: boolean, data: Object, errors: Array }
 */
function validateWithSchema(data, schema) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return {
      valid: false,
      data: null,
      errors
    };
  }
  
  return {
    valid: true,
    data: value,
    errors: []
  };
}

/**
 * Validar datos para crear sala
 * @param {Object} data - Datos a validar
 * @returns {Object} Resultado de validación
 */
function validateCreateRoom(data) {
  return validateWithSchema(data, createRoomSchema);
}

/**
 * Validar datos para unirse a sala
 * @param {Object} data - Datos a validar
 * @returns {Object} Resultado de validación
 */
function validateJoinRoom(data) {
  return validateWithSchema(data, joinRoomSchema);
}

/**
 * Validar datos para hacer movimiento
 * @param {Object} data - Datos a validar
 * @returns {Object} Resultado de validación
 */
function validateMakeMove(data) {
  return validateWithSchema(data, makeMoveSchema);
}

/**
 * Validar datos de autenticación
 * @param {Object} data - Datos a validar
 * @returns {Object} Resultado de validación
 */
function validateAuthenticate(data) {
  return validateWithSchema(data, authenticateSchema);
}

/**
 * Escapar caracteres HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Validar y sanitizar mensaje de chat
 * @param {string} message - Mensaje a validar
 * @returns {Object} { valid: boolean, message: string }
 */
function validateChatMessage(message) {
  if (!message || typeof message !== 'string') {
    return { valid: false, message: '' };
  }
  
  const sanitized = message.trim();
  
  if (sanitized.length === 0) {
    return { valid: false, message: '' };
  }
  
  if (sanitized.length > 500) {
    return { valid: false, message: '' };
  }
  
  return {
    valid: true,
    message: escapeHtml(sanitized)
  };
}

/**
 * Generar hash simple para verificación
 * @param {string} data - Datos a hashear
 * @returns {string} Hash
 */
function simpleHash(data) {
  let hash = 0;
  const str = String(data);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Verificar rate limit simple
 * @param {Map} rateLimitMap - Mapa de rate limits
 * @param {string} key - Clave única (ej: userId)
 * @param {number} maxRequests - Máximo de requests
 * @param {number} windowMs - Ventana de tiempo en ms
 * @returns {boolean} True si está dentro del límite
 */
function checkRateLimit(rateLimitMap, key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(key) || [];
  
  // Filtrar requests dentro de la ventana de tiempo
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  // Agregar nuevo request
  recentRequests.push(now);
  rateLimitMap.set(key, recentRequests);
  
  return true;
}

module.exports = {
  generateRoomCode,
  isValidRoomCode,
  isValidUserId,
  sanitizeUserName,
  isValidAvatarUrl,
  isValidPosition,
  validateCreateRoom,
  validateJoinRoom,
  validateMakeMove,
  validateAuthenticate,
  validateChatMessage,
  escapeHtml,
  simpleHash,
  checkRateLimit
};
