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
const bingoService = require('./bingoService');
const gameLogic = require('../utils/gameLogic');
const validation = require('../utils/validation');
const Room = require('../models/Room');
const BingoRoom = require('../models/BingoRoom');
const User = require('../models/User');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // socketId -> userId
    this.rateLimitMap = new Map(); // userId -> [timestamps]
    this.economy = economyService;
  }

  // ==========================================
  // AUXILIARES BINGO
  // ==========================================
  generateCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  async processBingoRefunds(room) {
    const refunds = {};
    for (const userId of Object.keys(room.entries)) {
      const amount = room.entries[userId] || 0;
      if (amount > 0) {
        await this.economy.earn(userId, amount, { reason: 'bingo_refund_host_left', roomCode: room.code });
        refunds[userId] = amount;
      }
    }
    return refunds;
  }

  /**
   * Inicializar Socket.io
   * @param {Object} io - Instancia de Socket.io
   */
  initialize(io) {
    this.io = io;
    this.setupSocketHandlers();
    this.startCleanupInterval();
    this.startTurnTimeoutWatcher();
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

      // Hacer pública (idempotente)
      socket.on(constants.SOCKET_EVENTS.BINGO_MAKE_PUBLIC, async ({ roomCode } = {}) => {
        try {
          const code = roomCode || socket.currentBingoRoom;
          if (!code) return this.emitError(socket, 'Sala no encontrada');
          const room = await redisService.getBingoRoom(code);
          if (!room) return this.emitError(socket, 'Sala no encontrada');
          if (room.hostId !== socket.userId) return this.emitError(socket, 'Solo el anfitrión puede cambiar la visibilidad');

          const wasPublic = !!room.isPublic;
          room.isPublic = true;
          await redisService.setBingoRoom(code, room);
          socket.emit(constants.SOCKET_EVENTS.BINGO_ROOM_UPDATED, { room: room.toJSON() });
          if (!wasPublic) {
            // Notificar al lobby unificado
            this.io.emit(constants.SOCKET_EVENTS.ROOM_ADDED, room.toJSON());
          }
          if (!wasPublic) {
            logger.info(`Bingo ${code} ahora es público`);
          }
        } catch (err) {
          logger.error('Error BINGO_MAKE_PUBLIC:', err);
          this.emitError(socket, 'No se pudo actualizar la sala de Bingo');
        }
      });

      socket.on(constants.SOCKET_EVENTS.GET_FIRES_HISTORY, async ({ limit = 50, offset = 0 } = {}) => {
        try {
          const history = await this.economy.getHistory(socket.userId, limit, offset);
          socket.emit(constants.SOCKET_EVENTS.FIRES_HISTORY, { items: history, limit, offset });
        } catch (err) {
          logger.error('Error GET_FIRES_HISTORY:', err);
          this.emitError(socket, 'No se pudo obtener el historial');
        }
      });

      // ==========================================
      // BINGO - SALAS Y JUEGO
      // ==========================================
      socket.on(constants.SOCKET_EVENTS.CREATE_BINGO_ROOM, async ({ isPublic = true, mode = 'line', autoDraw = false, drawIntervalMs = 5000 } = {}) => {
        try {
          const code = this.generateCode();
          const room = new BingoRoom({
            code,
            hostId: socket.userId,
            hostName: socket.userName,
            isPublic,
            mode,
            autoDraw,
            drawIntervalMs
          });
          await redisService.setBingoRoom(code, room);
          socket.join(code);
          socket.currentBingoRoom = code;
          socket.emit(constants.SOCKET_EVENTS.BINGO_ROOM_CREATED, { room: room.toJSON() });
          if (isPublic) {
            this.io.emit(constants.SOCKET_EVENTS.ROOM_ADDED, room.toJSON());
          }
        } catch (err) {
          logger.error('Error CREATE_BINGO_ROOM:', err);
          this.emitError(socket, 'No se pudo crear la sala de Bingo');
        }
      });

      socket.on(constants.SOCKET_EVENTS.JOIN_BINGO, async ({ roomCode, cardsCount = 1 } = {}) => {
        try {
          const room = await redisService.getBingoRoom(roomCode);
          if (!room) return this.emitError(socket, 'Sala no encontrada');
          if (room.status !== 'waiting') return this.emitError(socket, 'La sala ya inició');
          if (room.isFull()) return socket.emit(constants.SOCKET_EVENTS.ROOM_FULL);

          const cost = room.ticketPrice * Math.max(1, parseInt(cardsCount, 10));
          const spendRes = await this.economy.spend(socket.userId, cost, { reason: 'bingo_entry', roomCode });
          // Notificar saldo y transacción al jugador
          const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
          allSockets.filter(s => s.userId === socket.userId).forEach(s => {
            s.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, { fires: spendRes.fires });
            if (spendRes.tx) s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, spendRes.tx);
          });

          // Generar cartones
          const cards = [];
          for (let i = 0; i < cardsCount; i++) {
            cards.push(bingoService.generateCard(socket.userId));
          }
          await redisService.setBingoCards(roomCode, socket.userId, cards);

          // Actualizar sala
          room.entries[socket.userId] = (room.entries[socket.userId] || 0) + cost;
          room.pot += cost;
          const existing = room.getPlayer(socket.userId);
          if (!existing) {
            room.addPlayer(socket.userId, socket.userName, cardsCount);
          } else {
            existing.cardsCount = (existing.cardsCount || 0) + cardsCount;
          }
          await redisService.setBingoRoom(roomCode, room);

          // Unión al canal y notificaciones
          socket.join(roomCode);
          socket.currentBingoRoom = roomCode;
          const cardsNormalized = cards.map(c => ({
            id: c.id,
            userId: c.userId,
            numbers: c.numbers,
            marked: Array.from(c.marked || []),
            patterns: c.patterns || {}
          }));
          socket.emit(constants.SOCKET_EVENTS.BINGO_JOINED, {
            room: room.toJSON(),
            cards: cardsNormalized
          });
          this.io.to(roomCode).emit(constants.SOCKET_EVENTS.PLAYER_JOINED_BINGO, { room: room.toJSON(), userId: socket.userId, userName: socket.userName, cardsCount });
        } catch (err) {
          logger.error('Error JOIN_BINGO:', err);
          this.emitError(socket, err.message || 'No se pudo unir a Bingo');
        }
      });

      socket.on(constants.SOCKET_EVENTS.LEAVE_BINGO, async ({ roomCode } = {}) => {
        try {
          const code = roomCode || socket.currentBingoRoom;
          const room = await redisService.getBingoRoom(code);
          if (!room) return;

          const isHost = room.hostId === socket.userId;

          if (!room.started) {
            // Reembolso individual si aún no inició
            const spent = room.entries[socket.userId] || 0;
            if (spent > 0) {
              await this.economy.earn(socket.userId, spent, { reason: 'bingo_refund_before_start', roomCode: code });
              room.pot -= spent;
              delete room.entries[socket.userId];
            }
          }

          // Remover jugador
          room.removePlayer(socket.userId);
          await redisService.setBingoRoom(code, room);
          socket.leave(code);
          socket.currentBingoRoom = null;
          this.io.to(code).emit(constants.SOCKET_EVENTS.PLAYER_LEFT_BINGO, { userId: socket.userId, userName: socket.userName, room: room.toJSON() });

          // Si el host sale sin ganador: reembolsos y cierre
          if (isHost && !room.winner) {
            const refunds = await this.processBingoRefunds(room);
            await redisService.deleteBingoRoom(code);
            this.io.to(code).emit(constants.SOCKET_EVENTS.HOST_LEFT_BINGO, { refunds });
            // Remover del lobby unificado
            this.io.emit(constants.SOCKET_EVENTS.ROOM_REMOVED, code);
          } else if (room.isEmpty()) {
            await redisService.deleteBingoRoom(code);
            this.io.emit(constants.SOCKET_EVENTS.ROOM_REMOVED, code);
          }
        } catch (err) {
          logger.error('Error LEAVE_BINGO:', err);
        }
      });

      socket.on(constants.SOCKET_EVENTS.START_BINGO, async ({ roomCode } = {}) => {
        try {
          const code = roomCode || socket.currentBingoRoom;
          const room = await redisService.getBingoRoom(code);
          if (!room) return this.emitError(socket, 'Sala no encontrada');
          if (room.hostId !== socket.userId) return this.emitError(socket, 'Solo el anfitrión puede iniciar');
          if (room.started) return this.emitError(socket, 'La partida ya inició');

          const { drawOrder, seed } = bingoService.generateDrawOrder();
          room.drawOrder = drawOrder;
          room.started = true;
          room.startedAt = Date.now();
          await redisService.setBingoRoom(code, room);
          this.io.to(code).emit(constants.SOCKET_EVENTS.BINGO_STARTED, { room: room.toJSON(), seedHash: bingoService.hashSeed(seed) });
          // Guardar seed en caché temporal (auditoría opcional)
          await redisService.setCache(`bingo:seed:${code}`, seed, 7200);
        } catch (err) {
          logger.error('Error START_BINGO:', err);
          this.emitError(socket, 'No se pudo iniciar');
        }
      });

      socket.on(constants.SOCKET_EVENTS.DRAW_NEXT, async ({ roomCode } = {}) => {
        try {
          const code = roomCode || socket.currentBingoRoom;
          const room = await redisService.getBingoRoom(code);
          if (!room) return;
          if (room.hostId !== socket.userId) return;
          if (!room.started) return;

          const index = room.drawnCount;
          if (index >= room.drawOrder.length) return;
          const number = room.drawOrder[index];
          room.drawNumber(number);
          await redisService.setBingoRoom(code, room);
          this.io.to(code).emit(constants.SOCKET_EVENTS.NUMBER_DRAWN, { number, index, total: room.drawOrder.length });
        } catch (err) {
          logger.error('Error DRAW_NEXT:', err);
        }
      });

      socket.on(constants.SOCKET_EVENTS.CLAIM_BINGO, async ({ roomCode, cardId } = {}) => {
        try {
          const code = roomCode || socket.currentBingoRoom;
          const room = await redisService.getBingoRoom(code);
          if (!room || !room.started) return this.emitError(socket, 'Sala inválida');

          const cards = await redisService.getBingoCards(code, socket.userId);
          const card = cards.find(c => c.id === cardId);
          if (!card) return this.emitError(socket, 'Cartón inválido');

          const result = bingoService.validateBingo(card, room.drawnSet, room.mode);
          if (!result.valid) {
            return socket.emit(constants.SOCKET_EVENTS.BINGO_INVALID, { reason: result.reason });
          }

          // Distribución 50/30/20
          const dist = bingoService.calculateDistribution(room.pot);
          const winRes = await this.economy.grantToUser(socket.userId, dist.winner, { reason: 'bingo_winner', roomCode: code });
          const hostRes = await this.economy.grantToUser(room.hostId, dist.host, { reason: 'bingo_host', roomCode: code });
          const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
          // Emitir a ganador
          allSockets.filter(s => s.userId === socket.userId).forEach(s => {
            s.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, { fires: winRes.fires });
            if (winRes.tx) s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, winRes.tx);
          });
          // Emitir a host
          allSockets.filter(s => s.userId === room.hostId).forEach(s => {
            s.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, { fires: hostRes.fires });
            if (hostRes.tx) s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, hostRes.tx);
          });
          // Global pool
          await redisService.client.incrby('global:firePool', dist.global);

          room.finish(socket.userId, cardId);
          await redisService.setBingoRoom(code, room);
          this.io.to(code).emit(constants.SOCKET_EVENTS.BINGO_WINNER, { userId: socket.userId, userName: socket.userName, cardId, distribution: dist });
          this.io.to(code).emit(constants.SOCKET_EVENTS.BINGO_FINISHED, { room: room.toJSON() });
        } catch (err) {
          logger.error('Error CLAIM_BINGO:', err);
          this.emitError(socket, 'No se pudo validar Bingo');
        }
      });

      socket.on(constants.SOCKET_EVENTS.EARN_FIRE, async (amount = 1) => {
        try {
          const result = await this.economy.earn(socket.userId, amount, { reason: 'game_play' });
          socket.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, { fires: result.fires });
          if (result.tx) {
            socket.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, result.tx);
          }
        } catch (err) {
          logger.error('Error EARN_FIRE:', err);
          this.emitError(socket, 'No se pudo acreditar fuegos');
        }
      });

      socket.on(constants.SOCKET_EVENTS.SPEND_FIRES, async ({ amount = 1, reason = 'entry' } = {}) => {
        try {
          const result = await this.economy.spend(socket.userId, amount, { reason });
          socket.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, { fires: result.fires });
          if (result.tx) {
            socket.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, result.tx);
          }
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
          const result = await this.economy.grantToUser(targetUserId, amount, { by: socket.userId, reason: 'transfer_in' });
          // Notificar al destinatario si está conectado
          const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
          allSockets.filter(s => s.userId === targetUserId).forEach(s => {
            s.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, { fires: result.fires });
            if (result.tx) s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, result.tx);
          });
          const myBalance = await this.economy.getFires(socket.userId);
          socket.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, myBalance);
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
      let isNewUser = false;
      
      if (!user) {
        isNewUser = true;
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

      // Bonos deshabilitados: ahora solo se gana por juego PvP o recompensas de Bingo

      // Guardar en mapa local
      socket.userId = validData.userId;
      socket.userName = user.userName;
      socket.userAvatar = user.userAvatar;
      this.connectedUsers.set(socket.id, validData.userId);

      // Obtener estadísticas y saldo de fuegos
      const stats = await redisService.getUserStats(validData.userId);
      const balance = await this.economy.getFires(validData.userId);

      // Enviar confirmación
      socket.emit(constants.SOCKET_EVENTS.AUTHENTICATED, {
        success: true,
        user: user.toJSON(),
        stats
      });

      // Enviar saldo de fuegos
      socket.emit(constants.SOCKET_EVENTS.FIRES_BALANCE, balance);

      // Enviar lista de salas públicas (Tic Tac Toe + Bingo)
      const [tttRooms, bingoRooms] = await Promise.all([
        redisService.getPublicRooms(),
        redisService.getPublicBingoRooms?.() || []
      ]);
      const roomList = [
        ...tttRooms.map(r => r.toJSON()),
        ...(Array.isArray(bingoRooms) ? bingoRooms.map(r => r.toJSON()) : [])
      ];
      socket.emit(constants.SOCKET_EVENTS.ROOMS_LIST, roomList);

      logger.info(`Usuario autenticado: ${validData.userId} (${user.userName}) - Saldo: ${balance.fires} 🔥`);

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
      // Turno inicial aleatorio (50/50)
      room.currentTurn = Math.random() < 0.5 
        ? constants.PLAYER_SYMBOLS.X 
        : constants.PLAYER_SYMBOLS.O;
      room.turnStartTime = Date.now();
      room.lastActivity = Date.now();

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
            message: '¡Empate!',
            duration: room.getGameDuration(),
            moves: room.moves?.length || 0
          });
          // Recompensa de fuegos solo si es PvP (2 jugadores) y Tic Tac Toe
          const isPvp = Array.isArray(room.players) && room.players.length === 2;
          const isTicTacToe = room.gameType === 'tic-tac-toe';
          if (isPvp && isTicTacToe) {
            try {
              const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
              for (const p of room.players) {
                const res = await this.economy.earn(p.userId, 1, { reason: 'draw', roomCode });
                // Emitir transacción a todos los sockets del usuario
                allSockets.filter(s => s.userId === p.userId)
                  .forEach(s => res.tx && s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, res.tx));
              }
              await this.emitFiresToPlayers(room);
            } catch (e) {
              logger.error('Error otorgando/emitiendo fuegos en empate:', e);
            }
          } else {
            logger.debug('Empate no PvP: no se otorgan fuegos');
          }
        } else {
          // Victoria
          this.io.to(roomCode).emit(constants.SOCKET_EVENTS.GAME_OVER, {
            winner: player.userId,
            winnerName: player.userName,
            winningLine: gameStatus.winningLine,
            board: room.board,
            message: `¡${player.userName} ha ganado!`,
            duration: room.getGameDuration(),
            moves: room.moves?.length || 0
          });
          // Recompensa de fuegos solo si es PvP (2 jugadores) y Tic Tac Toe
          const isPvp = Array.isArray(room.players) && room.players.length === 2;
          const isTicTacToe = room.gameType === 'tic-tac-toe';
          if (isPvp && isTicTacToe) {
            try {
              const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
              for (const p of room.players) {
                const res = await this.economy.earn(p.userId, 1, { reason: 'game_finish', roomCode });
                allSockets.filter(s => s.userId === p.userId)
                  .forEach(s => res.tx && s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, res.tx));
              }
              await this.emitFiresToPlayers(room);
            } catch (e) {
              logger.error('Error otorgando/emitiendo fuegos en victoria:', e);
            }
          } else {
            logger.debug('Victoria no PvP: no se otorgan fuegos');
          }
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

      // Idempotencia: si ya es pública, solo notificar actualización al solicitante
      const wasPublic = !!room.isPublic;
      room.isPublic = true;
      await redisService.setRoom(roomCode, room);

      socket.emit(constants.SOCKET_EVENTS.ROOM_UPDATED, room.toJSON());
      if (!wasPublic) {
        this.io.emit(constants.SOCKET_EVENTS.ROOM_ADDED, room.toJSON());
      }

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

      // Bingo: si el host se desconecta sin ganador, cerrar y reembolsar
      if (socket.currentBingoRoom) {
        const code = socket.currentBingoRoom;
        const room = await redisService.getBingoRoom(code);
        if (room) {
          const isHost = room.hostId === socket.userId;
          if (isHost && !room.winner) {
            const refunds = await this.processBingoRefunds(room);
            await redisService.deleteBingoRoom(code);
            this.io.to(code).emit(constants.SOCKET_EVENTS.HOST_LEFT_BINGO, { refunds });
          } else {
            room.removePlayer(socket.userId);
            await redisService.setBingoRoom(code, room);
          }
        }
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

        // Recompensa PVP por partida finalizada por abandono
        try {
          const isPvp = Array.isArray(room.players) && room.players.length === 2;
          if (isPvp) {
            const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
            for (const p of room.players) {
              const res = await this.economy.earn(p.userId, 1, { reason: 'opponent_left_finish', roomCode });
              allSockets.filter(s => s.userId === p.userId)
                .forEach(s => res.tx && s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, res.tx));
            }
            await this.emitFiresToPlayers(room);
          }
        } catch (e) {
          logger.error('Error otorgando/emitiendo fuegos por abandono:', e);
        }

        this.io.to(roomCode).emit(constants.SOCKET_EVENTS.GAME_OVER, {
          winner: remainingPlayer.userId,
          winnerName: remainingPlayer.userName,
          reason: 'opponent_left',
          message: 'Tu oponente abandonó la partida',
          board: room.board,
          duration: room.getGameDuration(),
          moves: room.moves?.length || 0
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
   * Vigilante de timeout de turnos (Tic Tac Toe)
   * Si expira el turno actual, el oponente gana y se cierra la sala.
   */
  startTurnTimeoutWatcher() {
    const TICK_MS = 1000;
    setInterval(async () => {
      try {
        const rooms = await redisService.getAllRooms();
        for (const room of rooms) {
          if (room.status !== constants.ROOM_STATUS.PLAYING) continue;
          if (room.gameType !== 'tic-tac-toe') continue;
          if (!room.isTurnExpired()) continue;

          // Determinar jugador actual y oponente
          const currentSymbol = room.currentTurn;
          const currentPlayer = room.getPlayerBySymbol(currentSymbol);
          const opponent = room.players.find(p => p.userId !== currentPlayer?.userId);
          if (!opponent) continue;

          // Finalizar por timeout
          room.endGame(opponent.userId, null);
          await redisService.setRoom(room.code, room);
          await this.updateGameStats(room);

          // Recompensa PVP
          const isPvp = Array.isArray(room.players) && room.players.length === 2;
          if (isPvp) {
            try {
              const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
              for (const p of room.players) {
                const res = await this.economy.earn(p.userId, 1, { reason: 'timeout', roomCode: room.code });
                allSockets.filter(s => s.userId === p.userId)
                  .forEach(s => res.tx && s.emit(constants.SOCKET_EVENTS.FIRES_TRANSACTION, res.tx));
              }
              await this.emitFiresToPlayers(room);
            } catch (err) {
              logger.error('Error otorgando fuegos por timeout:', err);
            }
          }

          // Notificar resultado y eliminar sala
          this.io.to(room.code).emit(constants.SOCKET_EVENTS.GAME_OVER, {
            winner: opponent.userId,
            winnerName: opponent.userName,
            reason: 'timeout',
            board: room.board,
            duration: room.getGameDuration(),
            moves: room.moves?.length || 0
          });

          await redisService.deleteRoom(room.code);
          if (room.isPublic) {
            this.io.emit(constants.SOCKET_EVENTS.ROOM_REMOVED, room.code);
          }
        }
      } catch (error) {
        logger.error('Error en watcher de timeout:', error);
      }
    }, TICK_MS);
  }

  /**
   * Obtener estadísticas del servidor
   */
  async getServerStats() {
    return await redisService.getServerStats();
  }

  /**
   * Emitir FIRES_UPDATED a los sockets de cada jugador de una sala
   * para reflejar el saldo actualizado inmediatamente en el cliente.
   */
  async emitFiresToPlayers(room) {
    try {
      // Emitir a todos los sockets del servidor filtrando por userId,
      // para cubrir casos donde un jugador ya salió de la sala.
      const allSockets = Array.from(this.io.sockets.sockets?.values?.() || []);
      for (const p of room.players) {
        const balance = await this.economy.getFires(p.userId);
        allSockets
          .filter(s => s.userId === p.userId)
          .forEach(s => s.emit(constants.SOCKET_EVENTS.FIRES_UPDATED, balance));
      }
    } catch (err) {
      logger.error('Error emitiendo FIRES_UPDATED a jugadores:', err);
    }
  }
}

module.exports = new SocketService();
