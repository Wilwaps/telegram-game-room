/**
 * ============================================
 * GESTIÓN DE UI
 * ============================================
 */

const UI = {
  currentScreen: 'loading-screen',
  toastContainer: null,
  logContainer: null,

  /**
   * Inicializar UI
   */
  init() {
    this.toastContainer = document.getElementById('toast-container');
    if (!this.toastContainer) this.createToastContainer();
    this.ensureLogOverlay();
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
    // Salas de espera (TicTacToe / Bingo)
    const waiting = document.getElementById('fires-count-waiting');
    if (waiting) waiting.textContent = String(fires ?? 0);
    const bingo = document.getElementById('fires-count-bingo');
    if (bingo) bingo.textContent = String(fires ?? 0);
    try { this.log(`fires balance: ${fires}`, 'debug', 'economy'); } catch(_) {}
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
    try { this.log(`showScreen -> ${screenId}`, 'info', 'ui'); } catch(_) {}
    
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
      // Seguridad: retirar splash/loading por si quedaron activos
      try {
        const splash = document.getElementById('splash-screen');
        const loading = document.getElementById('loading-screen');
        if (splash) { splash.classList.remove('active'); splash.style.display = 'none'; }
        if (loading) { loading.classList.remove('active'); }
      } catch(_){ }
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
    if (!this.toastContainer) this.createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-content">
        <div class="toast-message">${Utils.escapeHtml(message)}</div>
      </div>
    `;
    this.toastContainer.appendChild(toast);
    try { this.log(`toast: ${message} [${type}]`, 'info', 'ui'); } catch(_) {}
    // Animar entrada
    setTimeout(() => toast.style.opacity = '1', 10);
    // Cerrar al hacer clic
    toast.addEventListener('click', () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    });
    // Remover después del tiempo especificado
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
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

    roomsList.innerHTML = rooms.map(room => {
      const type = room.gameType || 'tic-tac-toe';
      const icon = type === 'bingo' ? '🎱' : '🎮';
      const host = room.hostName || (room.players && room.players[0]?.userName) || 'Desconocido';
      const statusText = room.status === 'waiting' ? 'Esperando' : (room.status === 'playing' ? 'En juego' : 'Finalizada');
      return `
        <div class="room-card" data-room-code="${room.code}" data-game-type="${type}">
          <div class="room-icon">${icon}</div>
          <div class="room-info">
            <div class="room-code">${room.code}</div>
            <div class="room-host">Host: ${host}</div>
          </div>
          <div class="room-status ${room.status}">
            <span>${statusText}</span>
          </div>
        </div>
      `;
    }).join('');

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

// Crear contenedor de toasts si falta
UI.createToastContainer = function() {
  try {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
    this.toastContainer = c;
  } catch (e) {
    console.error('createToastContainer error:', e);
  }
};

// Overlay de log en tiempo real (ligero)
UI.ensureLogOverlay = function() {
  try {
    let el = document.getElementById('realtime-log');
    if (!el) {
      el = document.createElement('div');
      el.id = 'realtime-log';
      el.style.position = 'fixed';
      el.style.right = '8px';
      el.style.bottom = '8px';
      el.style.maxHeight = '30vh';
      el.style.width = 'min(90vw, 360px)';
      el.style.overflow = 'auto';
      el.style.background = 'rgba(0,0,0,0.55)';
      el.style.color = '#fff';
      el.style.fontSize = '11px';
      el.style.lineHeight = '1.35';
      el.style.padding = '8px';
      el.style.borderRadius = '8px';
      el.style.zIndex = '9999';
      el.style.backdropFilter = 'blur(2px)';
      // visible segun preferencia (por defecto visible)
      const stored = localStorage.getItem('ui.log.visible');
      const visible = stored === null ? true : (stored === 'true');
      el.style.display = visible ? 'block' : 'none';
      document.body.appendChild(el);
    }
    this.logContainer = el;

    // Botón flotante toggle
    let btn = document.getElementById('realtime-log-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'realtime-log-toggle';
      btn.textContent = '📝 Logs';
      btn.title = 'Mostrar/Ocultar logs';
      btn.style.position = 'fixed';
      btn.style.right = '8px';
      btn.style.bottom = '8px';
      btn.style.zIndex = '10000';
      btn.style.background = 'rgba(0,0,0,0.55)';
      btn.style.color = '#fff';
      btn.style.border = '1px solid rgba(255,255,255,0.18)';
      btn.style.borderRadius = '999px';
      btn.style.padding = '8px 12px';
      btn.style.fontWeight = '700';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => this.toggleLog());
      document.body.appendChild(btn);
    }
    // Sincronizar etiqueta según visibilidad actual
    const visibleNow = (this.logContainer && this.logContainer.style.display !== 'none');
    btn.textContent = visibleNow ? '🧹 Ocultar log' : '📝 Logs';
  } catch (e) {
    console.error('ensureLogOverlay error:', e);
  }
};

// Log en tiempo real + consola
UI.log = function(message, level = 'info', source = 'app') {
  try {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] [${source}] ${message}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    if (!this.logContainer) this.ensureLogOverlay();
    // Mostrar último N
    if (this.logContainer) {
      const row = document.createElement('div');
      row.textContent = line;
      this.logContainer.appendChild(row);
      // Auto recortar si excede 200 líneas
      const maxLines = 200;
      while (this.logContainer.childNodes.length > maxLines) {
        this.logContainer.removeChild(this.logContainer.firstChild);
      }
      // Auto-scroll
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
  } catch(_) {}
};

// Alternar visibilidad del overlay de log
UI.setLogVisible = function(visible) {
  try {
    this.ensureLogOverlay();
    if (this.logContainer) {
      this.logContainer.style.display = visible ? 'block' : 'none';
    }
    // Persistir preferencia y sincronizar botón
    try { localStorage.setItem('ui.log.visible', String(visible)); } catch(_){ }
    const btn = document.getElementById('realtime-log-toggle');
    if (btn) btn.textContent = visible ? '🧹 Ocultar log' : '📝 Logs';
  } catch(_){ }
};

UI.toggleLog = function() {
  const visible = this.logContainer && this.logContainer.style.display !== 'none';
  this.setLogVisible(!visible);
};

// Utilidad: insertar dinámicamente un badge de fuegos en headers de salas de espera
// containerSelector: CSS selector del contenedor (ej: '#waiting-room-screen .waiting-header')
// countId: id a asignar al span contador (ej: 'fires-count-waiting')
UI.ensureFiresBadge = function(containerSelector, countId) {
  try {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById(countId)) return; // ya existe
    const badge = document.createElement('div');
    badge.className = 'fires-badge';
    badge.title = 'Fuegos disponibles';
    const icon = document.createElement('span');
    icon.className = 'fires-icon';
    icon.textContent = '🔥';
    const count = document.createElement('span');
    count.className = 'fires-count';
    count.id = countId;
    count.textContent = String((window.Economy && Economy.fires) || 0);
    badge.appendChild(icon);
    badge.appendChild(count);
    // Insertar al final del header
    container.appendChild(badge);
    // Click abre historial
    badge.addEventListener('click', () => {
      try { window.Economy && Economy.openHistory(); } catch(_) {}
    });
  } catch (e) {
    console.error('ensureFiresBadge error:', e);
  }
};

// Hacer UI global
window.UI = UI;
