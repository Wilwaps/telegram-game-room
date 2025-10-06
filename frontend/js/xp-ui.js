(function(){
  const levelEl = document.getElementById('user-level');
  const xpBar = document.getElementById('xp-progress');
  const xpLabel = document.getElementById('xp-label');
  const xpModal = document.getElementById('xp-modal');
  const xpHistoryList = document.getElementById('xp-history-list');
  const xpHistoryEmpty = document.getElementById('xp-history-empty');
  const refreshBtn = document.getElementById('refresh-xp-history');
  const closeBtn = document.getElementById('close-xp-modal');

  function fmt(ts){
    try{ return new Date(ts).toLocaleString(); }catch(e){ return '' }
  }

  function updateXpUI(info){
    if (!info) return;
    const { xp = 0, level = 1, nextLevelXp = null } = info;
    levelEl.textContent = `Nivel ${level}`;
    if (nextLevelXp && nextLevelXp > 0) {
      // Calcular base del nivel actual (umbral anterior)
      // Como no lo recibimos, asumimos progresión lineal entre nivel prev y nextLevelXp.
      // Para una barra consistente: ratio = xp / nextLevelXp cuando level > 1 aproximada.
      const ratio = Math.max(0, Math.min(1, xp / nextLevelXp));
      xpBar.style.width = `${(ratio*100).toFixed(0)}%`;
      xpLabel.textContent = `${xp}/${nextLevelXp} XP`;
    } else {
      // Máximo nivel configurado
      xpBar.style.width = '100%';
      xpLabel.textContent = `${xp} XP`;
    }
  }

  function openXpModal(){
    xpModal.classList.add('open');
    SocketClient.getXpHistory(50, 0);
  }
  function closeXpModal(){ xpModal.classList.remove('open'); }

  // Eventos UI
  if (levelEl) levelEl.addEventListener('click', openXpModal);
  const wrapper = document.querySelector('.xp-wrapper');
  if (wrapper) wrapper.addEventListener('click', openXpModal);
  if (refreshBtn) refreshBtn.addEventListener('click', () => SocketClient.getXpHistory(50, 0));
  if (closeBtn) closeBtn.addEventListener('click', closeXpModal);
  const overlay = xpModal?.querySelector('.modal-overlay');
  if (overlay) overlay.addEventListener('click', closeXpModal);

  // Socket handlers
  SocketClient.on(CONFIG.EVENTS.XP_BALANCE, (payload) => {
    updateXpUI(payload);
  });
  SocketClient.on(CONFIG.EVENTS.XP_UPDATED, (payload) => {
    updateXpUI(payload);
  });
  SocketClient.on(CONFIG.EVENTS.XP_HISTORY, ({items=[]}={}) => {
    if (!items.length){
      xpHistoryEmpty.style.display = 'block';
      xpHistoryList.innerHTML = '';
      return;
    }
    xpHistoryEmpty.style.display = 'none';
    xpHistoryList.innerHTML = items.map((it)=>{
      const sign = it.type === 'lose' ? '-' : '+';
      const color = it.type === 'lose' ? 'var(--color-danger)' : 'var(--color-success)';
      const reason = (it.reason||'xp').replace(/_/g,' ');
      return `<div class="fires-history-item">
        <div class="fires-history-icon">⭐</div>
        <div class="fires-history-details">
          <div class="fires-history-title">${reason}</div>
          <div class="fires-history-meta">${fmt(it.ts)}</div>
        </div>
        <div class="fires-history-amount" style="color:${color}">${sign}${it.amount}</div>
      </div>`
    }).join('');
  });

  // Solicitar XP actual al cargar
  document.addEventListener('DOMContentLoaded', ()=>{
    try{ SocketClient.getXp(); }catch(e){}
  });
})();
