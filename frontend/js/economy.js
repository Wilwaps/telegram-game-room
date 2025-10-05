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
    });

    // Solicitar saldo inicial
    this.refresh();

    // Click en badge de fuegos abre modal
    const firesBadge = document.querySelector('.fires-badge');
    if (firesBadge) {
      firesBadge.addEventListener('click', () => this.openHistory());
      firesBadge.style.cursor = 'pointer';
      firesBadge.setAttribute('title', 'Ver historial de fuegos');
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
  }
};
