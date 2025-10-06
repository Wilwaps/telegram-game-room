/**
 * ============================================
 * SERVICIO DE DOMINÓ (4 jugadores, doble-seis)
 * ============================================
 */
const { constants } = require('../config/config');
const logger = require('../config/logger');
const redisService = require('./redisService');
const economyService = require('./economyService');
const DominoRoom = require('../models/DominoRoom');

function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function generateTiles() {
  const tiles = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: `${a}-${b}`, a, b });
    }
  }
  return tiles; // 28
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tileSum(t) { return t.a + t.b; }
function isDouble(t) { return t.a === t.b; }

module.exports = {
  generateCode,

  /** Crear sala Dominó */
  async createRoom(hostUser, { isPublic = false, mode = 'friendly', stake = 1 } = {}) {
    const code = generateCode(6);
    const room = new DominoRoom({ code, host: hostUser.userId, isPublic, mode, stake });
    room.addPlayer({ userId: hostUser.userId, userName: hostUser.userName });
    await redisService.setDominoRoom(code, room);
    return room;
  },

  async getRoom(code) { return await redisService.getDominoRoom(code); },

  async joinRoom(code, user) {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.players.length >= 4) throw new Error('Sala llena');
    if (room.status !== 'waiting') throw new Error('La partida ya inició');
    room.addPlayer({ userId: user.userId, userName: user.userName });
    await redisService.setDominoRoom(code, room);
    return room;
  },

  async leaveRoom(code, userId) {
    const room = await redisService.getDominoRoom(code);
    if (!room) return null;
    const wasHost = room.host === userId;
    room.removePlayer(userId);
    if (room.isEmpty()) {
      await redisService.deleteDominoRoom(code);
      return null;
    }
    if (wasHost) {
      const sorted = [...room.players].sort((a,b)=>a.joinTime-b.joinTime);
      if (sorted.length) room.host = sorted[0].userId;
    }
    await redisService.setDominoRoom(code, room);
    return room;
  },

  async setMode(code, userId, mode) {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.host !== userId) throw new Error('Solo el anfitrión puede cambiar el modo');
    room.mode = (mode === 'normal') ? 'normal' : 'friendly';
    await redisService.setDominoRoom(code, room);
    return room;
  },

  async setStake(code, userId, stake) {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.host !== userId) throw new Error('Solo el anfitrión puede cambiar el stake');
    const s = Math.max(1, Math.min(10, parseInt(stake,10)||1));
    room.stake = s;
    await redisService.setDominoRoom(code, room);
    return room;
  },

  async setReady(code, userId, ready=true) {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    room.setReady(userId, !!ready);
    await redisService.setDominoRoom(code, room);
    return room;
  },

  async canStart(code) {
    const room = await redisService.getDominoRoom(code);
    if (!room) return false;
    if (room.players.length !== 4) return false;
    if (!room.players.every(p => p.isReady)) return false;
    return true;
  },

  async collectEntriesIfNeeded(room) {
    if (room.mode !== 'normal') return { ok: true, pot: 0 };
    const stake = room.stake;
    let pot = 0;
    for (const p of room.players) {
      const already = parseInt(room.entries[p.userId] || 0, 10);
      if (already >= stake) { pot += stake; continue; }
      const delta = stake - already;
      const res = await economyService.spend(p.userId, delta, { reason: 'domino_entry', roomCode: room.code });
      room.entries[p.userId] = stake;
      pot += stake;
    }
    await redisService.setDominoRoom(room.code, room);
    return { ok: true, pot };
  },

  /** Iniciar partida: repartir 7 a cada jugador y determinar apertura */
  async startMatch(code) {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.status !== 'waiting') throw new Error('Estado inválido');
    if (room.players.length !== 4) throw new Error('Se requieren 4 jugadores');

    // Cobro entradas si aplica
    await this.collectEntriesIfNeeded(room);

    const tiles = shuffle(generateTiles());
    // Reparto 7
    const hands = {};
    for (let i = 0; i < 4; i++) {
      const p = room.players[i];
      hands[p.userId] = tiles.slice(i*7, i*7+7);
    }
    room.hands = hands;
    room.boneyard = tiles.slice(28); // vacío en 4J

    // Encontrar apertura: mayor doble; si ninguno, mayor suma
    let openerId = null; let openerTile = null;
    for (const p of room.players) {
      const doubles = hands[p.userId].filter(isDouble).sort((a,b)=>b.a-a.a);
      if (doubles.length && (!openerTile || (isDouble(openerTile) && doubles[0].a > openerTile.a))) {
        openerId = p.userId; openerTile = doubles[0];
      }
    }
    if (!openerTile) {
      for (const p of room.players) {
        const sorted = hands[p.userId].slice().sort((a,b)=>tileSum(b)-tileSum(a));
        if (sorted.length && (!openerTile || tileSum(sorted[0]) > tileSum(openerTile))) {
          openerId = p.userId; openerTile = sorted[0];
        }
      }
    }

    // Autoplay de apertura: colocar la ficha
    room.board = { tiles: [{ ...openerTile, orientation: 'flat' }], leftOpen: openerTile.a, rightOpen: openerTile.b };
    room.hands[openerId] = room.hands[openerId].filter(t => t.id !== openerTile.id);
    room.turnUserId = room.players.find(p => p.userId !== openerId).userId; // jugador siguiente
    room.openingPlayerId = openerId;
    room.roundId += 1;
    room.status = 'playing';

    await redisService.setDominoRoom(room.code, room);
    return room;
  },
  
  /**
   * Jugar una ficha
   * @param {string} code
   * @param {string} userId
   * @param {string} tileId "a-b"
   * @param {'left'|'right'} end
   */
  async play(code, userId, tileId, end = 'right') {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.status !== 'playing') throw new Error('La partida no está en curso');
    if (room.turnUserId !== userId) throw new Error('No es tu turno');
    if (!Array.isArray(room.hands[userId])) throw new Error('Mano inválida');

    const hand = room.hands[userId];
    const tile = hand.find(t => t.id === tileId);
    if (!tile) throw new Error('Ficha no encontrada en tu mano');

    const placeLeft = end === 'left';
    const { leftOpen, rightOpen } = room.board;

    let canPlace = false;
    let oriented = { ...tile };
    if (room.board.tiles.length === 0) {
      // Primera ficha de la ronda (no debería pasar aquí normalmente)
      room.board.tiles.push({ ...tile, endPlaced: 'start' });
      room.board.leftOpen = tile.a;
      room.board.rightOpen = tile.b;
      canPlace = true;
    } else if (placeLeft) {
      if (tile.a === leftOpen) {
        oriented = { ...tile, a: tile.b, b: tile.a }; // girar para conectar por 'a'
        canPlace = true;
      } else if (tile.b === leftOpen) {
        oriented = { ...tile };
        canPlace = true;
      }
      if (canPlace) {
        room.board.tiles.unshift({ ...oriented, endPlaced: 'left' });
        room.board.leftOpen = oriented.a; // nuevo extremo izquierdo
      }
    } else {
      if (tile.a === rightOpen) {
        oriented = { ...tile };
        canPlace = true;
      } else if (tile.b === rightOpen) {
        oriented = { ...tile, a: tile.b, b: tile.a }; // girar para conectar por 'b'
        canPlace = true;
      }
      if (canPlace) {
        room.board.tiles.push({ ...oriented, endPlaced: 'right' });
        room.board.rightOpen = oriented.b; // nuevo extremo derecho
      }
    }

    if (!canPlace) throw new Error('Movimiento inválido');

    // Remover de la mano
    room.hands[userId] = hand.filter(t => t.id !== tileId);
    room.passesInRow = 0;
    room.lastActivity = Date.now();

    // Verificar fin de ronda (jugador sin fichas)
    let roundEnded = false;
    let roundWinner = null;
    if (room.hands[userId].length === 0) {
      roundEnded = true;
      roundWinner = userId;
    }

    // Siguiente turno
    if (!roundEnded) {
      const idx = room.players.findIndex(p => p.userId === userId);
      const next = room.players[(idx + 1) % room.players.length];
      room.turnUserId = next.userId;
    }

    await redisService.setDominoRoom(code, room);

    return { room, roundEnded, roundWinner };
  },

  /**
   * Robar ficha (si hay cementerio)
   */
  async draw(code, userId) {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.status !== 'playing') throw new Error('La partida no está en curso');
    if (room.turnUserId !== userId) throw new Error('No es tu turno');

    if (!Array.isArray(room.boneyard) || room.boneyard.length === 0) {
      throw new Error('No hay fichas para robar');
    }

    const tile = room.boneyard.pop();
    room.hands[userId] = [...(room.hands[userId] || []), tile];
    room.lastActivity = Date.now();

    await redisService.setDominoRoom(code, room);
    return { room, tile };
  },

  /**
   * Pasar turno
   */
  async pass(code, userId) {
    const room = await redisService.getDominoRoom(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.status !== 'playing') throw new Error('La partida no está en curso');
    if (room.turnUserId !== userId) throw new Error('No es tu turno');

    room.passesInRow = (room.passesInRow || 0) + 1;
    room.lastActivity = Date.now();

    let roundEnded = false;
    if (room.passesInRow >= room.players.length) {
      // Ronda bloqueada
      roundEnded = true;
    } else {
      // Siguiente jugador
      const idx = room.players.findIndex(p => p.userId === userId);
      const next = room.players[(idx + 1) % room.players.length];
      room.turnUserId = next.userId;
    }

    await redisService.setDominoRoom(code, room);
    return { room, roundEnded };
  }
};
