/**
 * ============================================
 * SERVICIO DE SOCKET.IO
 * ============================================
 * 
 * Gestiona todas las conexiones WebSocket y eventos
 * en tiempo real del juego multijugador.
 * 
 * @module services/socketService
 */

const { constants } = require('../config/config');
const logger = require('../config/logger');
const redisService = require('./redisService');
const economyService = require('./economyService');
const gameLogic = require('../utils/gameLogic');
const validation = require('../utils/validation');
const Room = require('../models/Room');
const User = require('../models/User');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // socketId -> userId
    this.rateLimitMap = new Map(); // userId -> [timestamps]
    this.economy = economyService;
  }

  /**
   * Inicializar Socket.io
   * @param {Object} io - Instancia de Socket.io
   */
  initialize(io) {
    this.io = io;
    this.setupSocketHandlers();
    this.startCleanupInterval();
    logger.info('🔌 Socket.io inicializado');
  }

  /**
   * Configurar manejadores de eventos de Socket.io
   */
  setupSocketHandlers() {
    this.io.on(constants.SOCKET_EVENTS.CONNECTION, (socket) => {
      logger.info(`✅ Cliente conectado: ${socket.id}`);

      // ==========================================
      // AUTENTICACIÓN
      // ==========================================
      socket.on(constants.SOCKET_EVENTS.AUTHENTICATE, async (userData) => {
        await this.handleAuthenticate(socket, userData);
      });

      // ==========================================
      // GESTIÓN DE SALAS
      // ==========================================
      socket.on(constants.SOCKET_EVENTS.CREATE_ROOM, async (data) => {
        await this.handleCreateRoom(socket, data);
      });

      socket.on(constants.SOCKET_EVENTS.JOIN_ROOM, async (roomCode) => {
        await this.handleJoinRoom(socket, roomCode);
      });

      socket.on(constants.SOCKET_EVENTS.LEAVE_ROOM, async (roomCode) => {
        await this.handleLeaveRoom(socket, roomCode);
      });

      socket.on(constants.SOCKET_EVENTS.CLOSE_ROOM, async (roomCode) => {
        await this.handleCloseRoom(socket, roomCode);
      });
      
      socket.on(constants.SOCKET_EVENTS.MAKE_PUBLIC, async (roomCode) => {
        await this.handleMakePublic(socket, roomCode);
      });

      // ==========================================
      // JUEGO
      // ==========================================
      socket.on(constants.SOCKET_EVENTS.MAKE_MOVE, async (data) => {
        await this.handleMakeMove(socket, data);
      });

      socket.on(constants.SOCKET_EVENTS.PLAY_AGAIN, async (data) => {
        const roomCode = typeof data === 'string' ? data : data.roomCode;
        await this.handlePlayAgain(socket, roomCode);
      });

      // ==========================================
      // ECONOMÍA - FUEGOS
      // ==========================================
      socket.on(constants.SOCKET_EVENTS.GET_FIRES, async () => {
        try {
          const balance = await this.economy.getFires(socket.userId);
          socket.emit(constants.SOCKET_EVENTS.FIRES_BALANCE, balance);
        } catch (err) {
          logger.error('Error GET_FIRES:', err);
          this.emitError(socket, 'No se pudo obtener el saldo');
        }
      });

      socket.on(constants.SOCKET_EVENTS.EARN_FIRE, async (amount = 1) => {
        try {
          const result = await this.economy.earn(socket.userId, amount, { reason: 'game_play' });
          socket.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, result);
        } catch (err) {
          logger.error('Error EARN_FIRE:', err);
          this.emitError(socket, 'No se pudo acreditar fuegos');
        }
      });

      socket.on(constants.SOCKET_EVENTS.SPEND_FIRES, async ({ amount = 1, reason = 'entry' } = {}) => {
        try {
          const result = await this.economy.spend(socket.userId, amount, { reason });
          socket.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, result);
        } catch (err) {
          logger.error('Error SPEND_FIRES:', err);
          this.emitError(socket, err.message || 'No se pudieron descontar fuegos');
        }
      });

      socket.on(constants.SOCKET_EVENTS.TRANSFER_FIRES, async ({ targetUserId, amount } = {}) => {
        try {
          // Solo admin por username
          if (!socket.userName || socket.userName !== constants.ADMIN.USERNAME) {
            return this.emitError(socket, 'No autorizado');
          }
          if (!targetUserId || !amount) {
            return this.emitError(socket, 'Parámetros inválidos');
          }
          const result = await this.economy.grantToUser(targetUserId, amount, { by: socket.userId });
          // Notificar al destinatario si está conectado
          const targetSocket = [...this.connectedUsers.values()].find(s => s.userId === targetUserId);
          if (targetSocket) {
            targetSocket.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, result);
          }
          socket.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, await this.economy.getFires(socket.userId));
        } catch (err) {
          logger.error('Error TRANSFER_FIRES:', err);
          this.emitError(socket, 'No se pudo transferir');
        }
      });

      // ==========================================
      // DESCONEXIÓN
      // ==========================================
      socket.on(constants.SOCKET_EVENTS.DISCONNECT, async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  // ==========================================
  // MANEJADORES DE EVENTOS
  // ==========================================

  /**
   * Manejar autenticación de usuario
   */
  async handleAuthenticate(socket, userData) {
    try {
      // Validar datos
      const validation_result = validation.validateAuthenticate(userData);
      if (!validation_result.valid) {
        return this.emitError(socket, 'Datos de autenticación inválidos');
      }

      const validData = validation_result.data;

      // Crear o actualizar usuario
      let user = await redisService.getUser(validData.userId);
      
      if (!user) {
        user = new User({
          userId: validData.userId,
          userName: validation.sanitizeUserName(validData.userName),
          userAvatar: validData.userAvatar || '',
          firstName: validData.firstName || '',
          lastName: validData.lastName || '',
          languageCode: validData.languageCode || 'es'
        });
      }

      user.updateSession(socket.id);
      await redisService.setUser(validData.userId, user);

      // Guardar en mapa local
      socket.userId = validData.userId;
      socket.userName = user.userName;
      socket.userAvatar = user.userAvatar;
      this.connectedUsers.set(socket.id, validData.userId);

      // Obtener estadísticas
      const stats = await redisService.getUserStats(validData.userId);

      // Enviar confirmación
      socket.emit(constants.SOCKET_EVENTS.AUTHENTICATED, {
        success: true,
        user: user.toJSON(),
        stats
      });

      // Enviar lista de salas públicas
      const rooms = await redisService.getPublicRooms();
      socket.emit(constants.SOCKET_EVENTS.ROOMS_LIST, rooms.map(r => r.toJSON()));

      logger.info(`Usuario autenticado: ${validData.userId} (${user.userName})`);

    } catch (error) {
      logger.error('Error en autenticación:', error);
      this.emitError(socket, 'Error al autenticar usuario');
    }
  }

  /**
   * Manejar creación de sala
   */
  async handleCreateRoom(socket, data = {}) {
    try {
      // Verificar autenticación
      if (!socket.userId) {
        return this.emitError(socket, 'Usuario no autenticado');
      }

      // Verificar rate limit
      if (!validation.checkRateLimit(this.rateLimitMap, socket.userId, 5, 60000)) {
        return this.emitError(socket, 'Demasiadas solicitudes, espera un momento');
      }

      // Crear sala
      const room = new Room({
        host: socket.userId,
        isPublic: data.isPublic || false,
        gameType: data.gameType || 'tic-tac-toe'
      });

      // Agregar host como jugador
      room.addPlayer({
        userId: socket.userId,
        userName: socket.userName,
        userAvatar: socket.userAvatar,
        socketId: socket.id
      });

      // Guardar en Redis
      await redisService.setRoom(room.code, room);

      // Unir socket a la sala
      socket.join(room.code);
      socket.currentRoom = room.code;

      // Enviar confirmación
      socket.emit(constants.SOCKET_EVENTS.ROOM_CREATED, room.toJSON());

      // Si es pública, notificar a todos
      if (room.isPublic) {
        this.io.emit(constants.SOCKET_EVENTS.ROOM_ADDED, room.toJSON());
      }

      logger.info(`Sala creada: ${room.code} por ${socket.userId}`);

    } catch (error) {
      logger.error('Error al crear sala:', error);
      this.emitError(socket, 'Error al crear sala');
    }
  }

  /**
   * Manejar unirse a sala
   */
  async handleJoinRoom(socket, roomCode) {
    try {
      // Verificar autenticación
      if (!socket.userId) {
        return this.emitError(socket, 'Usuario no autenticado');
      }

      // Validar código de sala
      if (!validation.isValidRoomCode(roomCode)) {
        return this.emitError(socket, 'Código de sala inválido');
      }

      // Obtener sala
      const room = await redisService.getRoom(roomCode);
      if (!room) {
        return this.emitError(socket, 'Sala no encontrada');
      }

      // Verificar que no esté llena
      if (room.isFull()) {
        return this.emitError(socket, 'Sala llena');
      }

      // Verificar que no esté en juego
      if (room.status === constants.ROOM_STATUS.PLAYING) {
        return this.emitError(socket, 'Partida en curso');
      }

      // Verificar que no sea el mismo usuario
      if (room.getPlayer(socket.userId)) {
        return this.emitError(socket, 'Ya estás en esta sala');
      }

      // Agregar jugador
      room.addPlayer({
        userId: socket.userId,
        userName: socket.userName,
        userAvatar: socket.userAvatar,
        socketId: socket.id
      });

      // Iniciar juego automáticamente
      room.startGame();

      // Guardar cambios
      await redisService.setRoom(roomCode, room);

      // Unir socket a la sala
      socket.join(roomCode);
      socket.currentRoom = roomCode;

      // Notificar a ambos jugadores
      this.io.to(roomCode).emit(constants.SOCKET_EVENTS.GAME_START, {
        room: room.toJSON(),
        message: '¡Que comience el juego!'
      });

      // Actualizar lista de salas si es pública
      if (room.isPublic) {
        this.io.emit(constants.SOCKET_EVENTS.ROOM_UPDATED, room.toJSON());
      }

      logger.info(`${socket.userId} se unió a sala ${roomCode}`);

    } catch (error) {
      logger.error('Error al unirse a sala:', error);
      this.emitError(socket, 'Error al unirse a sala');
    }
  }

  /**
   * Manejar movimiento en el juego
   */
  async handleMakeMove(socket, data) {
    try {
      // Verificar autenticación
      if (!socket.userId) {
        return this.emitError(socket, 'Usuario no autenticado');
      }

      const { roomCode, cellIndex } = data;

      logger.info(`Movimiento solicitado - Usuario: ${socket.userId}, Sala: ${roomCode}, Celda: ${cellIndex}`);

      // Obtener sala
      const room = await redisService.getRoom(roomCode);
      if (!room) {
        logger.error(`Sala no encontrada en Redis: ${roomCode}`);
        // Intentar obtener desde socket.currentRoom como fallback
        const fallbackRoom = socket.currentRoom ? await redisService.getRoom(socket.currentRoom) : null;
        if (fallbackRoom) {
          logger.info(`Sala encontrada via socket.currentRoom: ${socket.currentRoom}`);
          return this.handleMakeMove(socket, { roomCode: socket.currentRoom, cellIndex });
        }
        return this.emitError(socket, 'Sala no encontrada');
      }

      // Verificar que el juego esté activo
      if (room.status !== constants.ROOM_STATUS.PLAYING) {
        return this.emitError(socket, 'El juego no está activo');
      }

      // Verificar turno
      if (!room.isPlayerTurn(socket.userId)) {
        return this.emitError(socket, 'No es tu turno');
      }

      // Validar movimiento
      if (!gameLogic.isValidMove(room.board, cellIndex)) {
        return this.emitError(socket, 'Movimiento inválido');
      }

      // Obtener jugador
      const player = room.getPlayer(socket.userId);
      if (!player) {
        return this.emitError(socket, 'Jugador no encontrado');
      }

      // Realizar movimiento
      room.makeMove(cellIndex, player.symbol);

      // Verificar estado del juego
      const gameStatus = gameLogic.checkGameStatus(room.board);

      if (gameStatus.finished) {
        // Juego terminado
        room.endGame(
          gameStatus.winner ? player.userId : null,
          gameStatus.winningLine
        );

        await redisService.setRoom(roomCode, room);

        // Actualizar estadísticas
        await this.updateGameStats(room);

        if (gameStatus.isDraw) {
          // Empate
          this.io.to(roomCode).emit(constants.SOCKET_EVENTS.GAME_DRAW, {
            board: room.board,
            message: '¡Empate!'
          });
        } else {
          // Victoria
          this.io.to(roomCode).emit(constants.SOCKET_EVENTS.GAME_OVER, {
            winner: player.userId,
            winnerName: player.userName,
            winningLine: gameStatus.winningLine,
            board: room.board,
            message: `¡${player.userName} ha ganado!`
          });
        }

        logger.logGameEvent('game_finished', roomCode, {
          winner: player.userId,
          isDraw: gameStatus.isDraw
        });

      } else {
        // Juego continúa - cambiar turno
        room.switchTurn();
        await redisService.setRoom(roomCode, room);

        // Notificar movimiento
        this.io.to(roomCode).emit(constants.SOCKET_EVENTS.MOVE_MADE, {
          cellIndex,
          symbol: player.symbol,
          currentTurn: room.currentTurn,
          board: room.board
        });
      }

    } catch (error) {
      logger.error('Error al hacer movimiento:', error);
      this.emitError(socket, 'Error al realizar movimiento');
    }
  }

  /**
   * Manejar solicitud de revancha
   */
  async handlePlayAgain(socket, roomCode) {
    try {
      if (!socket.userId) {
        return this.emitError(socket, 'Usuario no autenticado');
      }

      logger.info(`Revancha solicitada - Usuario: ${socket.userId}, Sala: ${roomCode}`);

      // Intentar obtener sala
      let room = await redisService.getRoom(roomCode);
      
      // Si no se encuentra, intentar con socket.currentRoom
      if (!room && socket.currentRoom) {
        logger.warn(`Sala ${roomCode} no encontrada, intentando con socket.currentRoom: ${socket.currentRoom}`);
        room = await redisService.getRoom(socket.currentRoom);
        roomCode = socket.currentRoom;
      }

      if (!room) {
        logger.error(`Sala no encontrada para revancha: ${roomCode}`);
        return this.emitError(socket, 'Sala no encontrada');
      }

      // Agregar solicitud de revancha
      const allReady = room.addRematchRequest(socket.userId);
      logger.info(`Revancha: ${room.rematchRequests.length}/${room.players.length} jugadores listos`);

      await redisService.setRoom(roomCode, room);

      // Notificar solicitud
      const player = room.getPlayer(socket.userId);
      this.io.to(roomCode).emit(constants.SOCKET_EVENTS.REMATCH_REQUESTED, {
        userId: socket.userId,
        userName: player?.userName || 'Jugador',
        ready: room.rematchRequests.length,
        total: room.players.length
      });

      // Si ambos están listos, reiniciar juego
      if (allReady) {
        logger.info(`Ambos jugadores listos, reiniciando juego en sala ${roomCode}`);
        room.resetGame();
        
        // Guardar con TTL extendido para evitar expiración
        await redisService.setRoom(roomCode, room, 7200); // 2 horas
        
        logger.info(`Sala guardada después de reset. Status: ${room.status}, Revancha requests: ${room.rematchRequests.length}`);

        this.io.to(roomCode).emit(constants.SOCKET_EVENTS.GAME_RESTART, {
          room: room.toJSON(),
          message: '¡Nueva partida comenzando!'
        });

        logger.info(`Juego reiniciado en sala ${roomCode}`);
      }

    } catch (error) {
      logger.error('Error al solicitar revancha:', error);
      this.emitError(socket, 'Error al solicitar revancha');
    }
  }

  /**
   * Manejar salida de sala
   */
  async handleLeaveRoom(socket, roomCode) {
    try {
      await this.removePlayerFromRoom(socket, roomCode);
    } catch (error) {
      logger.error('Error al salir de sala:', error);
      this.emitError(socket, 'Error al salir de sala');
    }
  }

  /**
   * Manejar cierre de sala (solo host)
   */
  async handleCloseRoom(socket, roomCode) {
    try {
      if (!socket.userId) {
        return this.emitError(socket, 'Usuario no autenticado');
      }

      const room = await redisService.getRoom(roomCode);
      if (!room) {
        return this.emitError(socket, 'Sala no encontrada');
      }

      // Verificar que sea el host
      if (!room.isHost(socket.userId)) {
        return this.emitError(socket, 'Solo el host puede cerrar la sala');
      }

      // Notificar a todos
      this.io.to(roomCode).emit(constants.SOCKET_EVENTS.ROOM_CLOSED, {
        message: 'La sala ha sido cerrada por el host'
      });

      // Eliminar sala
      await redisService.deleteRoom(roomCode);

      // Notificar eliminación si es pública
      if (room.isPublic) {
        this.io.emit(constants.SOCKET_EVENTS.ROOM_REMOVED, roomCode);
      }

      logger.info(`Sala ${roomCode} cerrada por ${socket.userId}`);

    } catch (error) {
      logger.error('Error al cerrar sala:', error);
      this.emitError(socket, 'Error al cerrar sala');
    }
  }

  /**
   * Manejar hacer sala pública
   */
  async handleMakePublic(socket, roomCode) {
    try {
      if (!socket.userId) {
        return this.emitError(socket, 'Usuario no autenticado');
      }

      const room = await redisService.getRoom(roomCode);
      if (!room) {
        return this.emitError(socket, 'Sala no encontrada');
      }

      if (!room.isHost(socket.userId)) {
        return this.emitError(socket, 'Solo el host puede cambiar la visibilidad');
      }

      room.isPublic = true;
      await redisService.setRoom(roomCode, room);

      socket.emit(constants.SOCKET_EVENTS.ROOM_UPDATED, room.toJSON());
      this.io.emit(constants.SOCKET_EVENTS.ROOM_ADDED, room.toJSON());

      logger.info(`Sala ${roomCode} ahora es pública`);

    } catch (error) {
      logger.error('Error al hacer sala pública:', error);
      this.emitError(socket, 'Error al actualizar sala');
    }
  }

  /**
   * Manejar desconexión
   */
  async handleDisconnect(socket) {
    try {
      logger.info(`❌ Cliente desconectado: ${socket.id}`);

      if (socket.currentRoom) {
        await this.removePlayerFromRoom(socket, socket.currentRoom);
      }

      if (socket.userId) {
        const user = await redisService.getUser(socket.userId);
        if (user) {
          user.disconnect();
          await redisService.setUser(socket.userId, user);
        }
      }

      this.connectedUsers.delete(socket.id);

    } catch (error) {
      logger.error('Error en desconexión:', error);
    }
  }

  // ==========================================
  // MÉTODOS AUXILIARES
  // ==========================================

  /**
   * Remover jugador de sala
   */
  async removePlayerFromRoom(socket, roomCode) {
    const room = await redisService.getRoom(roomCode);
    if (!room) {
      return;
    }

    // Notificar salida
    this.io.to(roomCode).emit(constants.SOCKET_EVENTS.PLAYER_LEFT, {
      userId: socket.userId,
      userName: socket.userName
    });

    socket.leave(roomCode);
    socket.currentRoom = null;

    // Si el juego estaba activo, el otro jugador gana
    if (room.status === constants.ROOM_STATUS.PLAYING && room.players.length === 2) {
      const remainingPlayer = room.players.find(p => p.userId !== socket.userId);
      
      if (remainingPlayer) {
        room.endGame(remainingPlayer.userId, null);
        await this.updateGameStats(room, true);

        this.io.to(roomCode).emit(constants.SOCKET_EVENTS.GAME_OVER, {
          winner: remainingPlayer.userId,
          winnerName: remainingPlayer.userName,
          reason: 'opponent_left',
          message: 'Tu oponente abandonó la partida'
        });
      }
    }

    // Verificar si el que se va es el host
    const wasHost = room.host === socket.userId;
    
    // Eliminar jugador
    room.removePlayer(socket.userId);
    
    if (room.isEmpty()) {
      // Sala vacía - eliminar inmediatamente
      logger.info(`Sala ${roomCode} vacía, eliminando...`);
      await redisService.deleteRoom(roomCode);
      if (room.isPublic) {
        this.io.emit(constants.SOCKET_EVENTS.ROOM_REMOVED, roomCode);
      }
    } else {
      // Hay jugadores restantes
      if (wasHost) {
        // Transferir host al primer jugador restante
        const newHost = room.players[0];
        room.host = newHost.userId;
        logger.info(`Host transferido de ${socket.userId} a ${newHost.userId} en sala ${roomCode}`);
        
        // Notificar cambio de host
        this.io.to(roomCode).emit(constants.SOCKET_EVENTS.ROOM_UPDATED, room.toJSON());
        
        // Notificar a todos en la sala
        this.io.to(roomCode).emit('host_transferred', {
          newHostId: newHost.userId,
          newHostName: newHost.userName,
          message: `${newHost.userName} es ahora el anfitrión`
        });
      }
      
      // Guardar sala actualizada
      await redisService.setRoom(roomCode, room);
    }
  }

  /**
   * Actualizar estadísticas del juego
   */
  async updateGameStats(room, isAbandon = false) {
    const [player1, player2] = room.players;

    if (room.winner) {
      const winner = room.players.find(p => p.userId === room.winner);
      const loser = room.players.find(p => p.userId !== room.winner);

      if (winner) {
        await redisService.incrementUserStat(winner.userId, 'wins');
        await redisService.incrementUserStat(winner.userId, 'gamesPlayed');
        await redisService.updateWinStreak(winner.userId, true);
      }
      
      if (loser) {
        await redisService.incrementUserStat(loser.userId, 'losses');
        await redisService.incrementUserStat(loser.userId, 'gamesPlayed');
        await redisService.updateWinStreak(loser.userId, false);
      }
    } else {
      // Empate
      if (player1) {
        await redisService.incrementUserStat(player1.userId, 'draws');
        await redisService.incrementUserStat(player1.userId, 'gamesPlayed');
        await redisService.updateWinStreak(player1.userId, false);
      }
      if (player2) {
        await redisService.incrementUserStat(player2.userId, 'draws');
        await redisService.incrementUserStat(player2.userId, 'gamesPlayed');
        await redisService.updateWinStreak(player2.userId, false);
      }
    }
  }

  /**
   * Emitir error al cliente
   */
  emitError(socket, message) {
    socket.emit(constants.SOCKET_EVENTS.ERROR, { message });
    logger.warn(`Error enviado a ${socket.id}: ${message}`);
  }

  /**
   * Iniciar intervalo de limpieza
   */
  startCleanupInterval() {
    // Limpiar salas expiradas cada 5 minutos
    setInterval(async () => {
      try {
        await redisService.cleanupExpiredRooms();
        logger.debug('Limpieza automática ejecutada');
      } catch (error) {
        logger.error('Error en limpieza automática:', error);
      }
    }, 300000); // 5 minutos
  }

  /**
   * Obtener estadísticas del servidor
   */
  async getServerStats() {
    return await redisService.getServerStats();
  }
}

module.exports = new SocketService();
