/**
 * ============================================
 * ECONOMÍA - FUEGOS (Frontend)
 * ============================================
 */

const Economy = {
  fires: 0,
  history: [],
  historyLimit: 100,
  debug: true,
  welcomeClaimed: true,

  init() {
    if (this.debug) console.log('[Economy] init()');
    // Suscripciones de socket
    SocketClient.on(CONFIG.EVENTS.FIRES_BALANCE, (data) => {
      if (this.debug) console.log('[Economy] FIRES_BALANCE <-', data);
      this.fires = data?.fires ?? 0;
      UI.updateFiresBalance(this.fires);
    });

    SocketClient.on(CONFIG.EVENTS.FIRES_UPDATED, (data) => {
      const prev = this.fires;
      this.fires = data?.fires ?? this.fires;
      UI.updateFiresBalance(this.fires);
      if (this.debug) console.log('[Economy] FIRES_UPDATED <-', data, 'prev=', prev, 'now=', this.fires);
    });

    SocketClient.on(CONFIG.EVENTS.FIRES_HISTORY, (payload) => {
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (this.debug) console.log(`[Economy] FIRES_HISTORY <- items=${items.length}`, payload);
      this.history = items;
      this.renderHistory();
    });

    SocketClient.on(CONFIG.EVENTS.FIRES_TRANSACTION, (tx) => {
      if (this.debug) console.log('[Economy] FIRES_TRANSACTION <-', tx);
      if (!tx) return;
      this.history.unshift(tx);
      if (this.history.length > this.historyLimit) {
        this.history.pop();
      }
      this.renderHistory();
      // Si fue el bono de bienvenida, cerrar modal, ocultar FAB y mostrar mensaje
      if (tx.reason === 'welcome_bonus') {
        UI.hideModal('welcome-modal');
        this.hideWelcomeFab();
        UI.showToast('Has recibido 10 🔥 de bienvenida', 'success');
      }
    });

    // Bienvenida
    SocketClient.on(CONFIG.EVENTS.WELCOME_INFO, (payload) => {
      const { claimed, amount, message } = payload || {};
      if (this.debug) console.log('[Economy] WELCOME_INFO <-', payload);
      this.welcomeClaimed = !!claimed;
      if (!this.welcomeClaimed) {
        this.showWelcomeFab();
        // Pre-render de modal con mensaje
        const msg = document.getElementById('welcome-message');
        if (msg && message) msg.textContent = message;
      } else {
        this.hideWelcomeFab();
      }
    });

    // Solicitar saldo inicial
    this.refresh();

    // Inicializar UI de bienvenida y consultar estado
    this.setupWelcomeUI();
    SocketClient.welcomeStatus();

    // Click en todos los badges de fuegos abre modal
    const firesBadges = document.querySelectorAll('.fires-badge');
    if (firesBadges && firesBadges.length) {
      firesBadges.forEach((badge) => {
        badge.addEventListener('click', () => this.openHistory());
        badge.style.cursor = 'pointer';
        badge.setAttribute('title', 'Ver historial de fuegos');
      });
    }

    // Cerrar modal historial
    const closeBtn = document.getElementById('close-fires-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => UI.hideModal('fires-modal'));
    }
    const firesModal = document.getElementById('fires-modal');
    if (firesModal) {
      const overlay = firesModal.querySelector('.modal-overlay');
      if (overlay) overlay.addEventListener('click', () => UI.hideModal('fires-modal'));
    }
    const refreshBtn = document.getElementById('refresh-fires-history');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => SocketClient.getFiresHistory(50, 0));
    }
  },

  refresh() {
    if (this.debug) console.log('[Economy] GET_FIRES ->');
    SocketClient.getFires();
  },

  openHistory() {
    if (this.debug) console.log('[Economy] OPEN_HISTORY -> GET_FIRES_HISTORY(50,0)');
    SocketClient.getFiresHistory(50, 0);
    UI.showModal('fires-modal');
  },

  renderHistory() {
    const list = document.getElementById('fires-history-list');
    const empty = document.getElementById('fires-history-empty');
    if (!list) return;

    if (!this.history.length) {
      if (this.debug) console.log('[Economy] renderHistory() -> empty');
      if (empty) empty.classList.remove('hidden');
      list.innerHTML = '';
      return;
    }
    if (empty) empty.classList.add('hidden');

    if (this.debug) console.log('[Economy] renderHistory() -> items=', this.history.length);
    list.innerHTML = this.history.map((tx, idx) => {
      if (this.debug && idx < 3) console.log('  [Economy] item', idx, tx);
      return this.renderTxItem(tx);
    }).join('');
  },

  renderTxItem(tx) {
    const sign = tx.type === 'spend' ? '-' : '+';
    const colorClass = tx.type === 'spend' ? 'tx-out' : 'tx-in';
    const reason = (tx.reason || tx.type || '').replace(/_/g, ' ');
    const when = Utils.formatTime ? Utils.formatTime(new Date(tx.ts)) : new Date(tx.ts).toLocaleString();
    return `
      <div class="fires-item ${colorClass}">
        <div class="fires-item-left">
          <div class="fires-item-icon">${tx.type === 'spend' ? '💸' : '🔥'}</div>
          <div class="fires-item-info">
            <div class="fires-item-reason">${Utils.escapeHtml(reason)}</div>
            <div class="fires-item-meta">${when}</div>
          </div>
        </div>
        <div class="fires-item-right">
          <div class="fires-item-amount">${sign}${tx.amount}</div>
          <div class="fires-item-balance">${tx.balance} 🔥</div>
        </div>
      </div>
    `;
  },

  async ensure(amount) {
    return (this.fires >= amount);
  },

  // ======================
  // Bienvenida - UI
  // ======================
  setupWelcomeUI() {
    const fab = document.getElementById('welcome-fab');
    if (fab && !fab.__bound) {
      fab.addEventListener('click', () => {
        const msg = document.getElementById('welcome-message');
        if (msg && !msg.textContent) {
          msg.textContent = 'Necesitas los fuegos para participar en las actividades. No te preocupes qué también hay formas de ganarlos!! Disfruta tu tiempo en este espacio 🎵';
        }
        UI.showModal('welcome-modal');
      });
      fab.__bound = true;
    }

    const claimBtn = document.getElementById('welcome-claim-btn');
    if (claimBtn && !claimBtn.__bound) {
      claimBtn.addEventListener('click', () => {
        claimBtn.disabled = true;
        TelegramApp.hapticFeedback('medium');
        SocketClient.welcomeClaim();
        setTimeout(() => { claimBtn.disabled = false; }, 2000);
      });
      claimBtn.__bound = true;
    }

    const closeBtn = document.getElementById('welcome-close-btn');
    if (closeBtn && !closeBtn.__bound) {
      closeBtn.addEventListener('click', () => UI.hideModal('welcome-modal'));
      closeBtn.__bound = true;
    }
  },

  showWelcomeFab() {
    const fab = document.getElementById('welcome-fab');
    if (fab) fab.classList.remove('hidden');
  },

  hideWelcomeFab() {
    const fab = document.getElementById('welcome-fab');
    if (fab) fab.classList.add('hidden');
  }
};
