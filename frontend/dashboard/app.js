async function fetchJSON(url, opts={}){
  const r=await fetch(url,{headers:{'Content-Type':'application/json', ...(opts.headers||{})},...opts});
  if(!r.ok){ const t=await r.text().catch(()=>" "); throw new Error(`HTTP ${r.status} ${t}`); }
  return await r.json();
}
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2500); }

// Supply metrics
async function loadSupply(){
  try{
    const j=await fetchJSON('/api/economy/supply');
    const s=j.summary;
    document.getElementById('supply-cap').textContent=(s.max||0).toLocaleString();
    document.getElementById('minted').textContent=(s.mintTotal||0).toLocaleString();
    document.getElementById('reserve').textContent=(s.reserveRemaining||0).toLocaleString();
    document.getElementById('circulation').textContent=(s.circulating||0).toLocaleString();
  }catch(e){ toast('Error cargando supply'); console.error(e); }
}

// Grant desde supply (admin)
async function grantFromSupply(){
  try{
    const adminUser=(document.getElementById('admin-username').value||'').trim();
    const adminCode=(document.getElementById('admin-code').value||'').trim();
    const toUserId=(document.getElementById('to-user-id').value||'').trim();
    const amount=parseInt(document.getElementById('grant-amount').value,10)||0;
    const reason=(document.getElementById('grant-reason').value||'admin_grant').trim();
    if(!adminUser||!adminCode||!toUserId||amount<=0){ toast('Datos inválidos'); return; }
    const j=await fetchJSON('/api/economy/grant-from-supply',{
      method:'POST',
      headers:{'x-admin-username':adminUser,'x-admin-code':adminCode},
      body:JSON.stringify({ toUserId, amount, reason })
    });
    toast('Grant aplicado');
    await loadSupply();
    await refreshUsers();
  }catch(e){ toast('Error al aplicar grant'); console.error(e); }
}

// Listado de usuarios con paginación
let usersCursor='0';
let usersSearchTerm='';
function renderUsers(items){
  const tbody=document.querySelector('#users-table tbody');
  tbody.innerHTML='';
  items.forEach(it=>{
    const tr=document.createElement('tr');
    const uname=it.userName?it.userName:`(sin nombre)`;
    tr.innerHTML=`<td>${uname}</td><td>${it.userId}</td><td>${(it.fires||0).toLocaleString()}</td><td><button class="btn btn-primary btn-mini" data-uid="${it.userId}" data-fires="${it.fires||0}">Grant</button></td>`;
    tbody.appendChild(tr);
  });
  // Wire grant fill
  tbody.querySelectorAll('button.btn-mini').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.getElementById('to-user-id').value=btn.dataset.uid;
      document.getElementById('grant-amount').focus();
    });
  });
}

async function loadUsersPage(nextCursor='0'){
  try{
    const url=`/api/economy/users?cursor=${encodeURIComponent(nextCursor)}&limit=50&search=${encodeURIComponent(usersSearchTerm)}`;
    const j=await fetchJSON(url);
    usersCursor=j.cursor||'0';
    renderUsers(j.items||[]);
  }catch(e){ toast('Error cargando usuarios'); console.error(e); }
}

async function refreshUsers(){ await loadUsersPage('0'); }

// XP config (placeholder si no existe backend)
async function loadXpConfig(){ try{ const j=await fetchJSON('/api/xp/config'); const t=j.thresholds||{}; const grid=document.getElementById('xp-grid'); grid.innerHTML=''; const levels=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]; for(const lv of levels){ const val=t[lv]??''; const el=document.createElement('div'); el.className='xp-item'; el.innerHTML=`<label>Nivel ${lv}</label><input type="number" min="0" id="xp-${lv}" value="${val}">`; grid.appendChild(el);} }catch(e){ /* opcional */ console.warn('XP config no disponible',e);} }
async function saveXpConfig(){ try{ const levels=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]; const thresholds={}; for(const lv of levels){ const v=parseInt(document.getElementById(`xp-${lv}`).value,10); if(!Number.isNaN(v)) thresholds[lv]=v; } await fetchJSON('/api/xp/config',{method:'POST',body:JSON.stringify({thresholds})}); toast('Configuración XP guardada'); }catch(e){ console.warn('XP save no disponible',e);} }

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('refresh-token').addEventListener('click', loadSupply);
  const grantBtn=document.getElementById('grant-submit'); if(grantBtn) grantBtn.addEventListener('click', grantFromSupply);
  const searchBtn=document.getElementById('users-search-btn'); if(searchBtn) searchBtn.addEventListener('click', ()=>{ usersSearchTerm=document.getElementById('users-search').value||''; refreshUsers(); });
  const nextBtn=document.getElementById('users-next-btn'); if(nextBtn) nextBtn.addEventListener('click', ()=> loadUsersPage(usersCursor));
  loadSupply();
  refreshUsers();
  // SSE auditoría supply
  startSupplySSE();
  // XP opcional
  const rx=document.getElementById('refresh-xp'); if(rx) rx.addEventListener('click', loadXpConfig);
  const sx=document.getElementById('save-xp'); if(sx) sx.addEventListener('click', saveXpConfig);
  loadXpConfig();
});

// ---------- SSE: Auditoría de Supply en tiempo real ----------
function startSupplySSE(){
  try{
    const target=document.getElementById('sse-audit');
    if(!target) return;
    const es=new EventSource('/api/economy/supply/stream');
    es.onmessage=(ev)=>{
      try{
        const data=JSON.parse(ev.data||'{}');
        if(data.summary){
          // Refrescar métricas visibles
          const s=data.summary;
          const el=(id,val)=>{ const e=document.getElementById(id); if(e) e.textContent=(val||0).toLocaleString(); };
          el('supply-cap', s.max);
          el('minted', s.mintTotal);
          el('reserve', s.reserveRemaining);
          el('circulation', s.circulating);
        }
        if(Array.isArray(data.items)){
          renderAuditList(target, data.items);
        }
      }catch(e){ console.warn('SSE parse error', e); }
    };
    es.onerror=(e)=>{ console.warn('SSE error', e); };
  }catch(e){ console.warn('No se pudo iniciar SSE', e); }
}

function renderAuditList(container, items){
  const fmt=(n)=> new Date(n).toLocaleTimeString();
  const rows=items.map(it=>{
    const type=it.type||'-';
    const amount=it.amount!=null? it.amount: '';
    const by=it.by||'';
    const reason=it.reason||'';
    const ts=fmt(it.ts||Date.now());
    return `<div class="audit-item"><div class="audit-time">${ts}</div><div class="audit-type">${type}</div><div class="audit-amount">${amount}</div><div class="audit-meta">${by} ${reason? '· '+reason: ''}</div></div>`;
  }).join('');
  container.innerHTML=rows||'<div class="muted">Sin eventos recientes</div>';
}
