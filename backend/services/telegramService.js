/**
 * ============================================
 * SERVICIO DE TELEGRAM BOT
 * ============================================
 * 
 * Gestiona la integración con Telegram Bot API:
 * - Envío de notificaciones
 * - Compartir resultados
 * - Invitaciones a salas
 * 
 * @module services/telegramService
 */

const TelegramBot = require('node-telegram-bot-api');
const { telegram } = require('../config/config');
const logger = require('../config/logger');

class TelegramService {
  constructor() {
    this.bot = null;
    this.isInitialized = false;
  }

  /**
   * Inicializar bot de Telegram
   */
  initialize() {
    try {
      if (!telegram.botToken) {
        logger.warn('⚠️ Token de Telegram Bot no configurado');
        return;
      }

      this.bot = new TelegramBot(telegram.botToken, {
        polling: false // Usamos webhook o no polling para MiniApps
      });

      this.isInitialized = true;
      logger.info('🤖 Telegram Bot inicializado');

      // Configurar comandos del bot
      this.setupBotCommands();

    } catch (error) {
      logger.error('❌ Error al inicializar Telegram Bot:', error);
    }
  }

  /**
   * Configurar comandos del bot
   */
  async setupBotCommands() {
    try {
      if (!this.bot) {
        return;
      }

      await this.bot.setMyCommands([
        { command: 'start', description: 'Iniciar el bot' },
        { command: 'play', description: 'Abrir sala de juegos' },
        { command: 'stats', description: 'Ver tus estadísticas' },
        { command: 'help', description: 'Ayuda y comandos' }
      ]);

      logger.info('Comandos del bot configurados');

    } catch (error) {
      logger.error('Error al configurar comandos:', error);
    }
  }

  /**
   * Enviar notificación a usuario
   * @param {string} chatId - ID del chat de Telegram
   * @param {string} message - Mensaje a enviar
   * @param {Object} options - Opciones adicionales
   */
  async sendNotification(chatId, message, options = {}) {
    try {
      if (!this.isInitialized || !this.bot) {
        logger.warn('Bot no inicializado, no se puede enviar notificación');
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        ...options
      });

      logger.debug(`Notificación enviada a ${chatId}`);
      return true;

    } catch (error) {
      logger.error(`Error al enviar notificación a ${chatId}:`, error);
      return false;
    }
  }

  /**
   * Enviar invitación a sala
   * @param {string} chatId - ID del chat
   * @param {string} roomCode - Código de la sala
   * @param {string} hostName - Nombre del host
   */
  async sendRoomInvitation(chatId, roomCode, hostName) {
    try {
      if (!this.isInitialized || !this.bot) {
        return false;
      }

      const message = `
🎮 <b>Invitación a Jugar</b>

<b>${hostName}</b> te invita a jugar Tic Tac Toe!

🔑 Código de sala: <code>${roomCode}</code>

Haz clic en el botón para unirte:
      `.trim();

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🎮 Unirse a la Partida',
              url: `https://t.me/${telegram.botUsername}?start=join_${roomCode}`
            }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      logger.info(`Invitación enviada a ${chatId} para sala ${roomCode}`);
      return true;

    } catch (error) {
      logger.error('Error al enviar invitación:', error);
      return false;
    }
  }

  /**
   * Compartir resultado de juego
   * @param {string} chatId - ID del chat
   * @param {Object} gameResult - Resultado del juego
   */
  async shareGameResult(chatId, gameResult) {
    try {
      if (!this.isInitialized || !this.bot) {
        return false;
      }

      const { winner, isDraw, winnerName, duration, moves } = gameResult;

      let message = '🎮 <b>Resultado del Juego</b>\n\n';

      if (isDraw) {
        message += '🤝 <b>¡Empate!</b>\n';
      } else {
        message += `🏆 <b>¡${winnerName} ha ganado!</b>\n`;
      }

      message += `\n⏱️ Duración: ${this.formatDuration(duration)}`;
      message += `\n🎯 Movimientos: ${moves}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🎮 Jugar de Nuevo',
              url: `https://t.me/${telegram.botUsername}?start=play`
            }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      logger.info(`Resultado compartido en ${chatId}`);
      return true;

    } catch (error) {
      logger.error('Error al compartir resultado:', error);
      return false;
    }
  }

  /**
   * Enviar estadísticas de usuario
   * @param {string} chatId - ID del chat
   * @param {Object} stats - Estadísticas del usuario
   */
  async sendUserStats(chatId, stats) {
    try {
      if (!this.isInitialized || !this.bot) {
        return false;
      }

      const winRate = stats.gamesPlayed > 0 
        ? Math.round((stats.wins / stats.gamesPlayed) * 100) 
        : 0;

      const message = `
📊 <b>Tus Estadísticas</b>

🎮 Partidas jugadas: <b>${stats.gamesPlayed}</b>
🏆 Victorias: <b>${stats.wins}</b>
❌ Derrotas: <b>${stats.losses}</b>
🤝 Empates: <b>${stats.draws}</b>

📈 Ratio de victorias: <b>${winRate}%</b>
🔥 Racha actual: <b>${stats.winStreak}</b>
⭐ Mejor racha: <b>${stats.bestWinStreak}</b>
      `.trim();

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🎮 Jugar Ahora',
              url: `https://t.me/${telegram.botUsername}?start=play`
            }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      logger.info(`Estadísticas enviadas a ${chatId}`);
      return true;

    } catch (error) {
      logger.error('Error al enviar estadísticas:', error);
      return false;
    }
  }

  /**
   * Enviar mensaje de bienvenida
   * @param {string} chatId - ID del chat
   * @param {string} userName - Nombre del usuario
   */
  async sendWelcomeMessage(chatId, userName) {
    try {
      if (!this.isInitialized || !this.bot) {
        return false;
      }

      const message = `
👋 <b>¡Hola ${userName}!</b>

Bienvenido a la Sala de Juegos 🎮

Aquí podrás jugar Tic Tac Toe con tus amigos en tiempo real.

<b>Características:</b>
• 🎯 Partidas en tiempo real
• 👥 Multijugador
• 📊 Estadísticas detalladas
• 🏆 Sistema de ranking
• 🎨 Interfaz moderna

¡Comienza a jugar ahora!
      `.trim();

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🎮 Abrir Sala de Juegos',
              web_app: { url: `https://tu-dominio.com` }
            }
          ],
          [
            {
              text: '📊 Ver Estadísticas',
              callback_data: 'stats'
            },
            {
              text: '❓ Ayuda',
              callback_data: 'help'
            }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      logger.info(`Mensaje de bienvenida enviado a ${chatId}`);
      return true;

    } catch (error) {
      logger.error('Error al enviar mensaje de bienvenida:', error);
      return false;
    }
  }

  /**
   * Enviar mensaje de ayuda
   * @param {string} chatId - ID del chat
   */
  async sendHelpMessage(chatId) {
    try {
      if (!this.isInitialized || !this.bot) {
        return false;
      }

      const message = `
❓ <b>Ayuda - Sala de Juegos</b>

<b>Comandos disponibles:</b>
/start - Iniciar el bot
/play - Abrir sala de juegos
/stats - Ver tus estadísticas
/help - Mostrar esta ayuda

<b>¿Cómo jugar?</b>
1️⃣ Abre la sala de juegos
2️⃣ Crea una nueva partida o únete a una existente
3️⃣ Invita a un amigo o espera a que alguien se una
4️⃣ ¡Juega y diviértete!

<b>Reglas del Tic Tac Toe:</b>
• El objetivo es alinear 3 símbolos (X u O)
• Puedes ganar en horizontal, vertical o diagonal
• Si se llena el tablero sin ganador, es empate

¿Necesitas más ayuda? Contáctanos en @soporte
      `.trim();

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML'
      });

      logger.info(`Mensaje de ayuda enviado a ${chatId}`);
      return true;

    } catch (error) {
      logger.error('Error al enviar mensaje de ayuda:', error);
      return false;
    }
  }

  /**
   * Formatear duración en formato legible
   * @param {number} seconds - Segundos
   * @returns {string}
   */
  formatDuration(seconds) {
    if (!seconds || seconds < 0) {
      return '0:00';
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Verificar si el bot está inicializado
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.bot !== null;
  }

  /**
   * Obtener información del bot
   * @returns {Object|null}
   */
  async getBotInfo() {
    try {
      if (!this.isInitialized || !this.bot) {
        return null;
      }

      const info = await this.bot.getMe();
      return info;

    } catch (error) {
      logger.error('Error al obtener información del bot:', error);
      return null;
    }
  }
}

module.exports = new TelegramService();
