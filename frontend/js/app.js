/**
 * ============================================
 * APLICACIÓN PRINCIPAL
 * ============================================
 * 
 * Punto de entrada de la aplicación.
 * Inicializa todos los módulos y gestiona el flujo.
 */

const App = {
  initialized: false,
  user: null,

  /**
   * Inicializar aplicación
   */
  async init() {
    try {
      console.log('🚀 Iniciando aplicación...');

      // Mostrar splash por 1.5 segundos
      await this.showSplash();

      // Inicializar Telegram WebApp
      TelegramApp.init();

      // Inicializar UI
      UI.init();

      // Obtener datos del usuario
      this.user = TelegramApp.getUser();
      console.log('Usuario:', this.user);

      // Validar que estamos en Telegram (modo dev: crear usuario fake)
      if (!this.user || !this.user.userId) {
        console.warn('⚠️ No se detectó Telegram WebApp, usando usuario de prueba');
        this.user = {
          userId: 'dev_' + Math.random().toString(36).substr(2, 9),
          userName: 'Usuario Dev',
          firstName: 'Dev',
          lastName: 'User',
          languageCode: 'es'
        };
      }

      // Mostrar pantalla de autenticación
      UI.showScreen('auth-screen');
      await this.delay(500);

      // Conectar al servidor
      await SocketClient.connect();
      await this.delay(300);

      // Autenticar usuario
      SocketClient.authenticate(this.user);

      // Esperar autenticación
      await this.waitForAuthentication();

      // Transición a pantalla de carga
      UI.showLoading('Preparando tu sala de juegos...');
      await this.delay(800);

      // Inicializar módulos
      this.initModules();

      // Mostrar lobby
      UI.showScreen('lobby-screen');
      UI.hideLoading();

      // Verificar parámetros de URL
      this.handleUrlParams();

      this.initialized = true;
      console.log('✅ Aplicación inicializada correctamente');

    } catch (error) {
      console.error('❌ Error al inicializar aplicación:', error);
      this.handleInitError(error);
    }
  },

  /**
   * Esperar autenticación
   */
  waitForAuthentication() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout de autenticación'));
      }, 10000);

      SocketClient.on('authenticated', (data) => {
        clearTimeout(timeout);
        console.log('✅ Usuario autenticado');
        
        // Actualizar información del usuario
        UI.updateUserInfo(data.user);
        UI.updateUserStats(data.stats);
        
        resolve(data);
      });
    });
  },

  /**
   * Inicializar módulos
   */
  initModules() {
    console.log('Inicializando módulos...');
    
    // Economía primero para disponer de saldo 🔥 en el lobby
    if (typeof Economy !== 'undefined') {
      Economy.init();
    }

    Lobby.init();
    WaitingRoom.init();
    if (typeof Bingo !== 'undefined') {
      Bingo.init();
    }
    Game.init();
    Result.init();

    console.log('✅ Módulos inicializados');

    // Fallback adicional: asegurar salida de pantallas de carga
    setTimeout(() => {
      try {
        const splash = document.getElementById('splash-screen');
        const loading = document.getElementById('loading-screen');
        if (splash) { splash.classList.remove('active'); splash.style.display = 'none'; }
        if (loading) { loading.classList.remove('active'); }
      } catch(_){ }
    }, 500);
  },

  /**
   * Manejar parámetros de URL
   */
  handleUrlParams() {
    const params = Utils.getUrlParams();

    // Verificar si hay código de sala en URL
    if (params.room) {
      const roomCode = params.room.toUpperCase();
      if (Utils.isValidRoomCode(roomCode)) {
        const isDomino = (params.game && String(params.game).toLowerCase() === 'domino');
        console.log('Uniéndose a sala desde URL:', roomCode, 'tipo:', isDomino ? 'domino' : 'tic-tac-toe');
        setTimeout(() => {
          if (isDomino) {
            SocketClient.joinDomino(roomCode);
          } else {
            SocketClient.joinRoom(roomCode);
          }
        }, 500);
        return;
      }
    }

    // Verificar parámetro de inicio de Telegram
    const startParam = TelegramApp.getStartParam();
    if (startParam) {
      console.log('Start param:', startParam);
      
      // Formato: join_ROOMCODE
      if (startParam.startsWith('join_')) {
        const roomCode = startParam.substring(5).toUpperCase();
        if (Utils.isValidRoomCode(roomCode)) {
          console.log('Uniéndose a sala desde start param:', roomCode);
          setTimeout(() => {
            SocketClient.joinRoom(roomCode);
          }, 500);
          return;
        }
      }
    }
    // Si no hay parámetros, mostrar lobby
    Lobby.show();
  },

  /**
   * Mostrar splash screen
   */
  async showSplash() {
    return new Promise((resolve) => {
      const splash = document.getElementById('splash-screen');
      // Fallback de seguridad por si quedara activo por cache
      setTimeout(() => {
        try {
          if (splash) {
            splash.classList.remove('active');
            splash.style.display = 'none';
          }
        } catch(_){ }
        resolve();
      }, 1500);
    });
  },

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Manejar error de inicialización
   */
  handleInitError(error) {
    console.error('Error de inicialización:', error);
    
    // Mostrar en pantalla de auth si estamos ahí
    const authScreen = document.getElementById('auth-screen');
    if (authScreen && authScreen.classList.contains('active')) {
      const authMessage = authScreen.querySelector('.auth-message');
      const authTitle = authScreen.querySelector('.auth-title');
      if (authMessage) authMessage.textContent = error.message || 'Error al conectar';
      if (authTitle) authTitle.textContent = '❌ Error';
    } else {
      // Mostrar en loading screen
      const loadingText = document.getElementById('loading-text');
      const loadingSubtext = document.getElementById('loading-subtext');
      
      if (loadingText) {
        loadingText.textContent = '❌ Error';
      }
      
      if (loadingSubtext) {
        loadingSubtext.textContent = error.message || 'No se pudo conectar al servidor';
      }
    }
    
    UI.showToast(
      error.message || 'Error al inicializar la aplicación',
      'error',
      5000
    );
    
    TelegramApp.hapticFeedback('error');
  },

  /**
   * Manejar visibilidad de la página
   */
  handleVisibilityChange() {
    if (document.hidden) {
      console.log('Aplicación en segundo plano');
    } else {
      console.log('Aplicación en primer plano');
      
      // Reconectar si es necesario
      if (!SocketClient.isConnected()) {
        console.log('Reconectando...');
        UI.showToast('Reconectando...', 'info');
      }
    }
  },

  /**
   * Manejar antes de cerrar
   */
  handleBeforeUnload(event) {
    // Si hay una partida activa, confirmar
    if (Game.currentRoom && Game.gameStartTime) {
      event.preventDefault();
      event.returnValue = '¿Seguro que quieres salir? Perderás la partida.';
      return event.returnValue;
    }
  },

  /**
   * Limpiar recursos
   */
  cleanup() {
    console.log('Limpiando recursos...');
    
    // Detener temporizadores
    if (Game.timerInterval) {
      Game.stopTimer();
    }

    // Desconectar socket
    SocketClient.disconnect();

    console.log('✅ Recursos limpiados');
  }
};

// ============================================
// INICIALIZACIÓN
// ============================================

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
} else {
  App.init();
}

// Manejar cambios de visibilidad
document.addEventListener('visibilitychange', () => {
  App.handleVisibilityChange();
});

// Manejar antes de cerrar
window.addEventListener('beforeunload', (event) => {
  App.handleBeforeUnload(event);
});

// Limpiar al cerrar
window.addEventListener('unload', () => {
  App.cleanup();
});

// Manejar errores globales
window.addEventListener('error', (event) => {
  console.error('Error global:', event.error);
  TelegramApp.hapticFeedback('error');
});

// Manejar promesas rechazadas
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promesa rechazada:', event.reason);
});

// Hacer App global para debugging
window.App = App;

console.log('📱 Aplicación cargada');
