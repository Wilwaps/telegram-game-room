/**
 * ============================================
 * ECONOMÍA - FUEGOS (Frontend)
 * ============================================
 */

const Economy = {
  fires: 0,

  init() {
    // Suscripciones de socket
    SocketClient.on(CONFIG.EVENTS.FIRES_BALANCE, (data) => {
      this.fires = data?.fires ?? 0;
      UI.updateFiresBalance(this.fires);
    });

    SocketClient.on(CONFIG.EVENTS.FIRES_UPDATED, (data) => {
      this.fires = data?.fires ?? this.fires;
      UI.updateFiresBalance(this.fires);
    });

    // Solicitar saldo inicial
    this.refresh();
  },

  refresh() {
    SocketClient.getFires();
  },

  async ensure(amount) {
    return (this.fires >= amount);
  }
};
