/**
 * ============================================
 * GESTIÓN DE UI
 * ============================================
 */

const UI = {
  currentScreen: 'loading-screen',
  toastContainer: null,

  /**
   * Inicializar UI
   */
  init() {
    this.toastContainer = document.getElementById('toast-container');
    this.setupEventListeners();
  },

  /**
   * Actualizar saldo de fuegos (🔥)
   */
  updateFiresBalance(fires) {
    const badge = document.getElementById('fires-count');
    const inline = document.getElementById('fires-inline');
    if (badge) badge.textContent = String(fires ?? 0);
    if (inline) inline.textContent = String(fires ?? 0);
  },

  /**
   * Configurar event listeners globales
   */
  setupEventListeners() {
    // Modal de código
    const codeModal = document.getElementById('code-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelJoinBtn = document.getElementById('cancel-join-btn');

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => this.hideModal('code-modal'));
    }

    if (cancelJoinBtn) {
      cancelJoinBtn.addEventListener('click', () => this.hideModal('code-modal'));
    }

    // Cerrar modal al hacer clic en overlay
    if (codeModal) {
      const overlay = codeModal.querySelector('.modal-overlay');
      if (overlay) {
        overlay.addEventListener('click', () => this.hideModal('code-modal'));
      }
    }
  },

  /**
   * Mostrar pantalla
   */
  showScreen(screenId) {
    console.log('🖥️ Cambiando a pantalla:', screenId);
    
    // Ocultar todas las pantallas
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
      screen.classList.remove('active');
    });

    // Mostrar nueva pantalla
    const newScreen = document.getElementById(screenId);
    if (newScreen) {
      newScreen.classList.add('active');
      this.currentScreen = screenId;
      console.log('✅ Pantalla activa:', screenId);
    } else {
      console.error('❌ Pantalla no encontrada:', screenId);
    }
  },

  /**
   * Mostrar modal
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      TelegramApp.hapticFeedback('light');
    }
  },

  /**
   * Ocultar modal
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  },

  /**
   * Mostrar toast notification
   */
  showToast(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-content">
        <div class="toast-message">${Utils.escapeHtml(message)}</div>
      </div>
    `;

    this.toastContainer.appendChild(toast);

    // Animar entrada
    setTimeout(() => toast.style.opacity = '1', 10);

    // Remover después del tiempo especificado
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  },

  /**
   * Actualizar estadísticas de usuario
   */
  updateUserStats(stats) {
    const winsEl = document.getElementById('wins');
    const lossesEl = document.getElementById('losses');
    const drawsEl = document.getElementById('draws');

    if (winsEl) winsEl.textContent = stats.wins || 0;
    if (lossesEl) lossesEl.textContent = stats.losses || 0;
    if (drawsEl) drawsEl.textContent = stats.draws || 0;
  },

  /**
   * Actualizar información de usuario
   */
  updateUserInfo(user) {
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const userLevelEl = document.getElementById('user-level');

    if (userNameEl) userNameEl.textContent = user.userName;
    if (userLevelEl) {
      const level = Math.floor(Math.sqrt((user.stats?.gamesPlayed || 0) / 10)) + 1;
      userLevelEl.textContent = `Nivel ${level}`;
    }
    if (userAvatarEl && user.userAvatar) {
      userAvatarEl.src = user.userAvatar;
    } else if (userAvatarEl) {
      // Avatar por defecto
      userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.userName)}&background=2481cc&color=fff`;
    }
  },

  /**
   * Renderizar lista de salas
   */
  renderRoomsList(rooms) {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;

    if (rooms.length === 0) {
      roomsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <p class="empty-title">No hay salas disponibles</p>
          <p class="empty-text">Crea una nueva partida para comenzar</p>
        </div>
      `;
      return;
    }

    roomsList.innerHTML = rooms.map(room => `
      <div class="room-card" data-room-code="${room.code}">
        <div class="room-icon">🎮</div>
        <div class="room-info">
          <div class="room-code">${room.code}</div>
          <div class="room-host">Host: ${room.players[0]?.userName || 'Desconocido'}</div>
        </div>
        <div class="room-status ${room.status}">
          <span>${room.status === 'waiting' ? 'Esperando' : 'En juego'}</span>
        </div>
      </div>
    `).join('');

    // Actualizar contadores
    const allCount = document.getElementById('all-count');
    const waitingCount = document.getElementById('waiting-count');
    
    if (allCount) allCount.textContent = rooms.length;
    if (waitingCount) {
      const waiting = rooms.filter(r => r.status === 'waiting').length;
      waitingCount.textContent = waiting;
    }
  },

  /**
   * Mostrar loading
   */
  showLoading(message = 'Cargando...') {
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = message;
    }
    this.showScreen('loading-screen');
  },

  /**
   * Ocultar loading
   */
  hideLoading() {
    // Se ocultará cuando se muestre otra pantalla
  },

  /**
   * Animar elemento
   */
  async animate(element, animationClass) {
    element.classList.add(animationClass);
    await Utils.sleep(CONFIG.UI.ANIMATION_DURATION);
    element.classList.remove(animationClass);
  },

  /**
   * Crear confeti
   */
  createConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const confettiContainer = document.createElement('div');
    confettiContainer.style.position = 'fixed';
    confettiContainer.style.top = '0';
    confettiContainer.style.left = '0';
    confettiContainer.style.width = '100%';
    confettiContainer.style.height = '100%';
    confettiContainer.style.pointerEvents = 'none';
    confettiContainer.style.zIndex = '9999';
    document.body.appendChild(confettiContainer);

    for (let i = 0; i < CONFIG.UI.CONFETTI_COUNT; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'absolute';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.top = '-10px';
      confetti.style.opacity = Math.random();
      confetti.style.animation = `confetti ${2 + Math.random() * 2}s linear forwards`;
      confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
      document.body.removeChild(confettiContainer);
    }, 4000);
  },

  /**
   * Deshabilitar botón
   */
  disableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = true;
      button.style.opacity = '0.5';
    }
  },

  /**
   * Habilitar botón
   */
  enableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = false;
      button.style.opacity = '1';
    }
  },

  /**
   * Actualizar texto de botón
   */
  updateButtonText(buttonId, text) {
    const button = document.getElementById(buttonId);
    if (button) {
      const textEl = button.querySelector('.btn-text');
      if (textEl) {
        textEl.textContent = text;
      } else {
        button.textContent = text;
      }
    }
  }
};

// Hacer UI global
window.UI = UI;
