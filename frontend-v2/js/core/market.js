import { UI } from './ui.js';
import { Socket } from './socket.js';

export const Market = {
  async render(user){
    try{
      const grid = document.getElementById('market-grid');
      if (!grid) return;
      grid.innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
      const r = await fetch('/api/store/catalog');
      const j = await r.json().catch(()=>({success:false,catalog:[]}));
      if (!r.ok || !j.success){ throw new Error(j?.error||('HTTP '+r.status)); }
      const items = Array.isArray(j.catalog)? j.catalog : [];
      if (!items.length){ grid.innerHTML = `<div class="muted">Sin artículos disponibles</div>`; return; }
      grid.innerHTML = '';
      for (const it of items){
        const card = document.createElement('div');
        card.className = 'game-card';
        card.innerHTML = `
          <div class="icon">🛒</div>
          <div class="meta">
            <div class="name">${it.name||it.id}</div>
            <div class="desc">${it.desc||''}</div>
            <div style="display:flex;gap:10px;align-items:center">
              <div class="muted">🔥 ${it.price||0}</div>
              <button class="btn btn-primary" data-item="${it.id}">Canjear</button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      }
      grid.querySelectorAll('button[data-item]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          try{
            btn.disabled = true; btn.classList.add('is-loading');
            const itemId = btn.getAttribute('data-item');
            const requestId = `${(user?.userId)||'dev'}:${itemId}:${Date.now()}`;
            const resp = await fetch('/api/store/redeem', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ userId: String(user?.userId||''), itemId, requestId })
            });
            const data = await resp.json().catch(()=>({success:false}));
            if (!resp.ok || !data.success){ throw new Error(data?.error||('HTTP '+resp.status)); }
            UI.showToast(`Canjeado: ${data?.item?.name||itemId}`, 'success');
            try{ Socket.socket && Socket.socket.emit && Socket.socket.emit('get_fires'); }catch(_){ }
          }catch(e){
            console.error(e);
            UI.showToast('No se pudo canjear', 'error');
          }finally{
            btn.disabled = false; btn.classList.remove('is-loading');
          }
        });
      });
    }catch(e){
      console.error(e);
      UI.showToast('Error cargando Mercado', 'error');
    }
  }
};
