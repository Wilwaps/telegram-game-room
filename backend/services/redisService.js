/**
 * ============================================
 * SERVICIO DE REDIS
 * ============================================
 * 
 * Gestiona todas las operaciones con Redis:
 * - Conexión y desconexión
 * - Operaciones CRUD de salas
 * - Operaciones CRUD de usuarios
 * - Caché y estadísticas
 * 
 * @module services/redisService
 */

const Redis = require('ioredis');
const { redis, constants } = require('../config/config');
const logger = require('../config/logger');
const Room = require('../models/Room');
const User = require('../models/User');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Conectar a Redis
   */
  async connect() {
    try {
      // Detectar URL desde variables comunes de proveedores (Railway/Upstash/Heroku)
      const urlFromEnv =
        process.env.REDIS_URL ||
        process.env.REDIS_PUBLIC_URL ||
        process.env.REDIS_TLS_URL ||
        process.env.REDIS_INTERNAL_URL ||
        process.env.REDIS_PRIVATE_URL ||
        process.env.UPSTASH_REDIS_URL;

      if (urlFromEnv) {
        const useTLS = urlFromEnv.startsWith('rediss://');
        this.client = new Redis(urlFromEnv, {
          retryStrategy: redis.retryStrategy,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          tls: useTLS ? {} : undefined,
        });
      } else {
        // Usar configuración individual para desarrollo local
        this.client = new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
          db: redis.db,
          retryStrategy: redis.retryStrategy,
          lazyConnect: true,
          maxRetriesPerRequest: 3
        });
      }

      // Eventos de conexión
      this.client.on('connect', () => {
        logger.info('✅ Conectado a Redis');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        logger.error('❌ Error de Redis:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('⚠️ Conexión a Redis cerrada');
        this.isConnected = false;
      });

      await this.client.connect();
      
      // Verificar conexión
      await this.client.ping();
      logger.info('🔌 Redis listo para operaciones');

    } catch (error) {
      logger.error('❌ Error al conectar a Redis:', error);
      throw error;
    }
  }

  /**
   * Desconectar de Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      logger.info('👋 Desconectado de Redis');
    }
  }

  /**
   * Verificar si está conectado
   * @returns {boolean}
   */
  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  // ============================================
  // OPERACIONES DE SALAS
  // ============================================

  /**
   * Guardar sala en Redis
   * @param {string} roomCode - Código de la sala
   * @param {Room} room - Instancia de Room
   * @param {number} ttl - Time to live en segundos
   */
  async setRoom(roomCode, room, ttl = redis.ttl.room) {
    try {
      const key = `${constants.REDIS_PREFIXES.ROOM}${roomCode}`;
      const data = JSON.stringify(room.toJSON ? room.toJSON() : room);
      
      await this.client.setex(key, ttl, data);
      
      // Si es pública, agregar a índice de salas públicas
      if (room.isPublic) {
        await this.client.sadd('public_rooms', roomCode);
      }
      
      logger.debug(`Sala guardada en Redis: ${roomCode}`);
    } catch (error) {
      logger.error(`Error al guardar sala ${roomCode}:`, error);
      throw error;
    }
  }

  /**
   * Obtener sala de Redis
   * @param {string} roomCode - Código de la sala
   * @returns {Room|null}
   */
  async getRoom(roomCode) {
    try {
      const key = `${constants.REDIS_PREFIXES.ROOM}${roomCode}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }
      
      const roomData = JSON.parse(data);
      return Room.fromJSON(roomData);
    } catch (error) {
      logger.error(`Error al obtener sala ${roomCode}:`, error);
      return null;
    }
  }

  /**
   * Eliminar sala de Redis
   * @param {string} roomCode - Código de la sala
   */
  async deleteRoom(roomCode) {
    try {
      const key = `${constants.REDIS_PREFIXES.ROOM}${roomCode}`;
      await this.client.del(key);
      await this.client.srem('public_rooms', roomCode);
      
      logger.debug(`Sala eliminada de Redis: ${roomCode}`);
    } catch (error) {
      logger.error(`Error al eliminar sala ${roomCode}:`, error);
      throw error;
    }
  }

  /**
   * Obtener todas las salas públicas
   * @returns {Array<Room>}
   */
  async getPublicRooms() {
    try {
      const roomCodes = await this.client.smembers('public_rooms');
      const rooms = [];
      
      for (const code of roomCodes) {
        const room = await this.getRoom(code);
        if (room && room.status === constants.ROOM_STATUS.WAITING) {
          rooms.push(room);
        } else if (!room) {
          // Limpiar código inválido
          await this.client.srem('public_rooms', code);
        }
      }
      
      return rooms;
    } catch (error) {
      logger.error('Error al obtener salas públicas:', error);
      return [];
    }
  }

  /**
   * Obtener todas las salas (para administración)
   * @returns {Array<Room>}
   */
  async getAllRooms() {
    try {
      const pattern = `${constants.REDIS_PREFIXES.ROOM}*`;
      const keys = await this.client.keys(pattern);
      const rooms = [];
      
      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const roomData = JSON.parse(data);
          rooms.push(Room.fromJSON(roomData));
        }
      }
      
      return rooms;
    } catch (error) {
      logger.error('Error al obtener todas las salas:', error);
      return [];
    }
  }

  /**
   * Verificar si una sala existe
   * @param {string} roomCode - Código de la sala
   * @returns {boolean}
   */
  async roomExists(roomCode) {
    try {
      const key = `${constants.REDIS_PREFIXES.ROOM}${roomCode}`;
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Error al verificar sala ${roomCode}:`, error);
      return false;
    }
  }

  // ============================================
  // OPERACIONES DE USUARIOS
  // ============================================

  /**
   * Guardar usuario en Redis
   * @param {string} userId - ID del usuario
   * @param {User} user - Instancia de User
   * @param {number} ttl - Time to live en segundos
   */
  async setUser(userId, user, ttl = redis.ttl.session) {
    try {
      const key = `${constants.REDIS_PREFIXES.USER}${userId}`;
      const data = JSON.stringify(user.toJSON ? user.toJSON() : user);
      
      await this.client.setex(key, ttl, data);
      logger.debug(`Usuario guardado en Redis: ${userId}`);
    } catch (error) {
      logger.error(`Error al guardar usuario ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener usuario de Redis
   * @param {string} userId - ID del usuario
   * @returns {User|null}
   */
  async getUser(userId) {
    try {
      const key = `${constants.REDIS_PREFIXES.USER}${userId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }
      
      const userData = JSON.parse(data);
      return User.fromJSON(userData);
    } catch (error) {
      logger.error(`Error al obtener usuario ${userId}:`, error);
      return null;
    }
  }

  /**
   * Eliminar usuario de Redis
   * @param {string} userId - ID del usuario
   */
  async deleteUser(userId) {
    try {
      const key = `${constants.REDIS_PREFIXES.USER}${userId}`;
      await this.client.del(key);
      logger.debug(`Usuario eliminado de Redis: ${userId}`);
    } catch (error) {
      logger.error(`Error al eliminar usuario ${userId}:`, error);
      throw error;
    }
  }

  // ============================================
  // ESTADÍSTICAS DE USUARIOS
  // ============================================

  /**
   * Obtener estadísticas de usuario
   * @param {string} userId - ID del usuario
   * @returns {Object}
   */
  async getUserStats(userId) {
    try {
      const key = `${constants.REDIS_PREFIXES.STATS}${userId}`;
      const data = await this.client.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) {
        return {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winStreak: 0,
          bestWinStreak: 0
        };
      }
      
      // Convertir strings a números
      return {
        gamesPlayed: parseInt(data.gamesPlayed || 0, 10),
        wins: parseInt(data.wins || 0, 10),
        losses: parseInt(data.losses || 0, 10),
        draws: parseInt(data.draws || 0, 10),
        winStreak: parseInt(data.winStreak || 0, 10),
        bestWinStreak: parseInt(data.bestWinStreak || 0, 10)
      };
    } catch (error) {
      logger.error(`Error al obtener estadísticas de ${userId}:`, error);
      return {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        bestWinStreak: 0
      };
    }
  }

  /**
   * Incrementar estadística de usuario
   * @param {string} userId - ID del usuario
   * @param {string} stat - Nombre de la estadística
   * @param {number} amount - Cantidad a incrementar
   */
  async incrementUserStat(userId, stat, amount = 1) {
    try {
      const key = `${constants.REDIS_PREFIXES.STATS}${userId}`;
      await this.client.hincrby(key, stat, amount);
      
      // Establecer TTL si es nueva
      const ttl = await this.client.ttl(key);
      if (ttl === -1) {
        await this.client.expire(key, redis.ttl.session);
      }
      
      logger.debug(`Estadística ${stat} incrementada para ${userId}`);
    } catch (error) {
      logger.error(`Error al incrementar estadística ${stat} de ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Actualizar racha de victorias
   * @param {string} userId - ID del usuario
   * @param {boolean} won - Si ganó la partida
   */
  async updateWinStreak(userId, won) {
    try {
      const key = `${constants.REDIS_PREFIXES.STATS}${userId}`;
      
      if (won) {
        await this.client.hincrby(key, 'winStreak', 1);
        
        // Actualizar mejor racha si es necesario
        const currentStreak = parseInt(await this.client.hget(key, 'winStreak') || 0, 10);
        const bestStreak = parseInt(await this.client.hget(key, 'bestWinStreak') || 0, 10);
        
        if (currentStreak > bestStreak) {
          await this.client.hset(key, 'bestWinStreak', currentStreak);
        }
      } else {
        await this.client.hset(key, 'winStreak', 0);
      }
    } catch (error) {
      logger.error(`Error al actualizar racha de ${userId}:`, error);
      throw error;
    }
  }

  // ============================================
  // CACHÉ
  // ============================================

  /**
   * Guardar en caché
   * @param {string} key - Clave del caché
   * @param {*} value - Valor a cachear
   * @param {number} ttl - Time to live en segundos
   */
  async setCache(key, value, ttl = redis.ttl.cache) {
    try {
      const cacheKey = `${constants.REDIS_PREFIXES.CACHE}${key}`;
      const data = JSON.stringify(value);
      await this.client.setex(cacheKey, ttl, data);
    } catch (error) {
      logger.error(`Error al guardar caché ${key}:`, error);
    }
  }

  /**
   * Obtener de caché
   * @param {string} key - Clave del caché
   * @returns {*|null}
   */
  async getCache(key) {
    try {
      const cacheKey = `${constants.REDIS_PREFIXES.CACHE}${key}`;
      const data = await this.client.get(cacheKey);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Error al obtener caché ${key}:`, error);
      return null;
    }
  }

  /**
   * Eliminar de caché
   * @param {string} key - Clave del caché
   */
  async deleteCache(key) {
    try {
      const cacheKey = `${constants.REDIS_PREFIXES.CACHE}${key}`;
      await this.client.del(cacheKey);
    } catch (error) {
      logger.error(`Error al eliminar caché ${key}:`, error);
    }
  }

  // ============================================
  // UTILIDADES
  // ============================================

  /**
   * Limpiar salas expiradas
   */
  async cleanupExpiredRooms() {
    try {
      const publicRooms = await this.client.smembers('public_rooms');
      
      for (const code of publicRooms) {
        const exists = await this.roomExists(code);
        if (!exists) {
          await this.client.srem('public_rooms', code);
        }
      }
      
      logger.debug('Limpieza de salas expiradas completada');
    } catch (error) {
      logger.error('Error al limpiar salas expiradas:', error);
    }
  }

  /**
   * Obtener estadísticas del servidor
   * @returns {Object}
   */
  async getServerStats() {
    try {
      const allRooms = await this.getAllRooms();
      const publicRooms = await this.getPublicRooms();
      
      const activeRooms = allRooms.filter(r => r.status === constants.ROOM_STATUS.PLAYING);
      const waitingRooms = allRooms.filter(r => r.status === constants.ROOM_STATUS.WAITING);
      
      return {
        totalRooms: allRooms.length,
        publicRooms: publicRooms.length,
        activeGames: activeRooms.length,
        waitingRooms: waitingRooms.length,
        totalPlayers: allRooms.reduce((sum, room) => sum + room.players.length, 0)
      };
    } catch (error) {
      logger.error('Error al obtener estadísticas del servidor:', error);
      return {
        totalRooms: 0,
        publicRooms: 0,
        activeGames: 0,
        waitingRooms: 0,
        totalPlayers: 0
      };
    }
  }

  /**
   * Limpiar toda la base de datos (solo para desarrollo)
   */
  async flushAll() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No se puede ejecutar flushAll en producción');
    }
    
    await this.client.flushdb();
    logger.warn('⚠️ Base de datos Redis limpiada');
  }
}

module.exports = new RedisService();
