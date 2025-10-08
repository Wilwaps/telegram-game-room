// Nuevo flujo simplificado: Promover a Patrocinador
async function sponsorPromote(){
  try{
    const userId=document.getElementById('sponsor-user-id').value.trim();
    const key=document.getElementById('sponsor-promote-key').value.trim();
    const initialAmount=parseInt(document.getElementById('sponsor-promote-amount').value,10)||0;
    const description=document.getElementById('sponsor-promote-desc').value.trim();
    if(!userId){ return toast('ID Telegram requerido'); }
    const adminUser=document.getElementById('admin-username').value.trim();
    const adminCode=document.getElementById('admin-code').value.trim();
    const payload={ userId, key, description, initialAmount, adminUsername:adminUser, adminCode };
    await fetchJSON('/api/economy/sponsors/add',{ method:'POST', headers:{'x-admin-username':adminUser,'x-admin-code':adminCode}, body: JSON.stringify(payload) });
    toast('Patrocinador promovido');
    // limpiar campos
    document.getElementById('sponsor-promote-key').value='';
    document.getElementById('sponsor-promote-amount').value='';
    document.getElementById('sponsor-promote-desc').value='';
    await loadSponsors();
  }catch(e){ toast('Error al promover patrocinador'); console.error(e); }
}
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
let usersCurrentPage=1;
let usersHasNext=false;
let usersMode='users'; // 'users' | 'anon' | 'sponsors'
let lastUsersItems=[];
let usersPageCursors=['', '0']; // index 1 = page1 cursor
let prefetching=false;

function formatTs(ts){ if(!ts) return '-'; try{ return new Date(ts).toLocaleString(); }catch(_){ return '-'; } }

function renderUsersTables(items){
  const usersTbody=document.querySelector('#users-table tbody');
  const anonTbody=document.querySelector('#anon-table tbody');
  const sponsorsTbody=document.querySelector('#sponsors-table tbody');
  usersTbody.innerHTML='';
  anonTbody.innerHTML='';
  sponsorsTbody.innerHTML='';
  const named=items.filter(i=>!i.isAnon);
  const anon=items.filter(i=>i.isAnon);
  const sponsors=items.filter(i=>i.isSponsor);
  named.forEach(it=>{
    const tr=document.createElement('tr');
    const uname=it.userName?it.userName:`(sin nombre)`;
    tr.innerHTML=`<td>${uname}</td><td>${it.userId}</td><td>${(it.fires||0).toLocaleString()}</td><td><button class="btn btn-primary btn-mini" data-uid="${it.userId}" data-fires="${it.fires||0}">Grant</button></td>`;
    usersTbody.appendChild(tr);
  });
  anon.forEach(it=>{
    const tr=document.createElement('tr');
    const uname=it.userName?it.userName:`(sin nombre)`;
    tr.innerHTML=`<td>${uname}</td><td>${it.userId}</td><td>${(it.fires||0).toLocaleString()}</td><td>${formatTs(it.createdAt)}</td><td>${formatTs(it.lastSeen)}</td>`;
    anonTbody.appendChild(tr);
  });
  // Wire grant fill solo en tabla de usuarios
  usersTbody.querySelectorAll('button.btn-mini').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.getElementById('to-user-id').value=btn.dataset.uid;
      document.getElementById('grant-amount').focus();
    });
  });
  // Toggle de pestañas
  document.getElementById('users-table').classList.toggle('hidden', usersMode!=='users');
  document.getElementById('anon-table').classList.toggle('hidden', usersMode!=='anon');
  document.getElementById('sponsors-table').classList.toggle('hidden', usersMode!=='sponsors');
  // simplificado: solo un formulario de Promover
  document.getElementById('sponsor-promote')?.classList.toggle('hidden', usersMode!=='sponsors');
  document.getElementById('users-next-btn')?.classList.toggle('hidden', usersMode==='sponsors');
  document.getElementById('users-next-pages')?.classList.toggle('hidden', usersMode==='sponsors');
}

async function loadUsersPage(nextCursor='0', pageIndex=1){
  try{
    const url=`/api/economy/users?cursor=${encodeURIComponent(nextCursor)}&limit=50&search=${encodeURIComponent(usersSearchTerm)}`;
    const j=await fetchJSON(url);
    usersCursor=j.cursor||'0';
    usersHasNext = usersCursor !== '0';
    lastUsersItems = j.items||[];
    // guardar cursores por página
    usersPageCursors[pageIndex]=nextCursor;
    usersPageCursors[pageIndex+1]=usersCursor;
    renderUsersTables(lastUsersItems);
    renderNextPages();
    prefetchNext(5);
  }catch(e){ toast('Error cargando usuarios'); console.error(e); }
}

async function refreshUsers(){ usersCurrentPage=1; usersPageCursors=['','0']; await loadUsersPage('0',1); }

function renderNextPages(){
  const el=document.getElementById('users-next-pages');
  if(!el) return;
  el.innerHTML='';
  if(!usersHasNext){ el.textContent=''; return; }
  const max=5;
  const frag=document.createDocumentFragment();
  const label=document.createElement('span'); label.className='muted'; label.textContent='Próximas: ';
  frag.appendChild(label);
  for(let i=1;i<=max;i++){
    const page=usersCurrentPage+i;
    const span=document.createElement('button');
    const known=!!usersPageCursors[page];
    span.className='page-dot'+(known?' clickable':'');
    span.textContent=String(page);
    span.disabled=!known;
    if(known){ span.addEventListener('click',()=>goToPage(page)); }
    frag.appendChild(span);
  }
  el.appendChild(frag);
}

async function goToPage(page){
  const cursor=usersPageCursors[page];
  if(cursor){ usersCurrentPage=page; await loadUsersPage(cursor,page); }
}

async function prefetchNext(n=5){
  if(prefetching) return; prefetching=true;
  try{
    let start=usersCurrentPage;
    for(let i=1;i<=n;i++){
      const p=start+i; if(usersPageCursors[p]) continue;
      const prevCursor=usersPageCursors[p-1]; if(!prevCursor) break;
      const url=`/api/economy/users?cursor=${encodeURIComponent(prevCursor)}&limit=1&search=${encodeURIComponent(usersSearchTerm)}`;
      const j=await fetchJSON(url);
      usersPageCursors[p]=prevCursor;
      usersPageCursors[p+1]=j.cursor||'0';
      if((j.cursor||'0')==='0') break;
    }
  }catch(e){ console.warn('Prefetch cursors fallo',e); }
  finally{ prefetching=false; renderNextPages(); }
}

// XP config (placeholder si no existe backend)
async function loadXpConfig(){ try{ const j=await fetchJSON('/api/xp/config'); const t=j.thresholds||{}; const grid=document.getElementById('xp-grid'); grid.innerHTML=''; const levels=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]; for(const lv of levels){ const val=t[lv]??''; const el=document.createElement('div'); el.className='xp-item'; el.innerHTML=`<label>Nivel ${lv}</label><input type="number" min="0" id="xp-${lv}" value="${val}">`; grid.appendChild(el);} }catch(e){ /* opcional */ console.warn('XP config no disponible',e);} }
async function saveXpConfig(){ try{ const levels=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]; const thresholds={}; for(const lv of levels){ const v=parseInt(document.getElementById(`xp-${lv}`).value,10); if(!Number.isNaN(v)) thresholds[lv]=v; } await fetchJSON('/api/xp/config',{method:'POST',body:JSON.stringify({thresholds})}); toast('Configuración XP guardada'); }catch(e){ console.warn('XP save no disponible',e);} }

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('refresh-token').addEventListener('click', loadSupply);
  const grantBtn=document.getElementById('grant-submit'); if(grantBtn) grantBtn.addEventListener('click', grantFromSupply);
  const searchBtn=document.getElementById('users-search-btn'); if(searchBtn) searchBtn.addEventListener('click', ()=>{ usersSearchTerm=document.getElementById('users-search').value||''; refreshUsers(); });
  const nextBtn=document.getElementById('users-next-btn'); if(nextBtn) nextBtn.addEventListener('click', ()=> { if(usersHasNext){ usersCurrentPage++; loadUsersPage(usersCursor);} });
  const tabUsers=document.getElementById('tab-users');
  const tabAnon=document.getElementById('tab-anon');
  if(tabUsers) tabUsers.addEventListener('click', ()=>{ usersMode='users'; tabUsers.classList.add('active'); tabAnon?.classList.remove('active'); renderUsersTables(lastUsersItems); });
  if(tabAnon) tabAnon.addEventListener('click', ()=>{ usersMode='anon'; tabAnon.classList.add('active'); tabUsers?.classList.remove('active'); document.getElementById('tab-sponsors')?.classList.remove('active'); renderUsersTables(lastUsersItems); });
  const tabSponsors=document.getElementById('tab-sponsors');
  if(tabSponsors) tabSponsors.addEventListener('click', async ()=>{ usersMode='sponsors'; tabSponsors.classList.add('active'); tabUsers?.classList.remove('active'); tabAnon?.classList.remove('active'); await loadSponsors(); });
  // Sponsor Promote (formulario único)
  document.getElementById('sponsor-promote-submit')?.addEventListener('click', sponsorPromote);
  loadSupply();
  refreshUsers();
  // SSE auditoría supply
  startSupplySSE();
  // XP opcional
  const rx=document.getElementById('refresh-xp'); if(rx) rx.addEventListener('click', loadXpConfig);
  const sx=document.getElementById('save-xp'); if(sx) sx.addEventListener('click', saveXpConfig);
  loadXpConfig();
});

// --------- Patrocinadores ---------
async function loadSponsors(){
  try{
    const j=await fetchJSON('/api/economy/sponsors');
    const items=j.sponsors||[];
    const tbody=document.querySelector('#sponsors-table tbody');
    tbody.innerHTML='';
    items.forEach(it=>{
      const tr=document.createElement('tr');
      const uname=it.userName||'(sin nombre)';
      const desc = it.description ? it.description : '';
      const keyBadge = it.hasKey ? '<span class="badge ok">sí</span>' : '<span class="badge warn">no</span>';
      tr.innerHTML=`<td>${uname}</td><td>${it.userId}</td><td>${(it.fires||0).toLocaleString()}</td><td>${desc}</td><td>${keyBadge}</td><td><button class="btn btn-mini" data-action="remove-sponsor" data-uid="${it.userId}">Quitar</button></td>`;
      tbody.appendChild(tr);
    });
    // mostrar formulario simplificado
    document.getElementById('sponsor-promote')?.classList.remove('hidden');
    // wire remove
    tbody.querySelectorAll('button[data-action="remove-sponsor"]').forEach(btn=>{
      btn.addEventListener('click',()=> sponsorRemove(btn.dataset.uid));
    });
    // ocultar otras tablas
    renderUsersTables(lastUsersItems);
  }catch(e){ toast('Error cargando patrocinadores'); console.error(e); }
}

async function sponsorAdd(){
  try{
    const userId=document.getElementById('sponsor-user-id').value.trim();
    if(!userId) return toast('userId requerido');
    const adminUser=document.getElementById('admin-username').value.trim();
    const adminCode=document.getElementById('admin-code').value.trim();
    await fetchJSON('/api/economy/sponsors/add',{method:'POST',headers:{'x-admin-username':adminUser,'x-admin-code':adminCode},body:JSON.stringify({ userId, adminUsername:adminUser, adminCode})});
    toast('Patrocinador agregado');
    await loadSponsors();
  }catch(e){ toast('Error agregando patrocinador'); console.error(e); }
}

async function sponsorAddUnified(){
  try{
    const userId=document.getElementById('sponsor-user-id').value.trim();
    const key=document.getElementById('sponsor-add-key').value.trim();
    const initialAmount=parseInt(document.getElementById('sponsor-add-amount').value,10)||0;
    const description=document.getElementById('sponsor-add-desc').value.trim();
    if(!userId) return toast('userId requerido');
    const adminUser=document.getElementById('admin-username').value.trim();
    const adminCode=document.getElementById('admin-code').value.trim();
    await fetchJSON('/api/economy/sponsors/add',{method:'POST',headers:{'x-admin-username':adminUser,'x-admin-code':adminCode},body:JSON.stringify({ userId, key, description, initialAmount, adminUsername:adminUser, adminCode })});
    toast('Patrocinador creado');
    document.getElementById('sponsor-add-key').value='';
    document.getElementById('sponsor-add-amount').value='';
    document.getElementById('sponsor-add-desc').value='';
    await loadSponsors();
  }catch(e){ toast('Error en alta unificada'); console.error(e); }
}

async function sponsorTransfer(){
  try{
    const from=document.getElementById('sponsor-from').value.trim();
    const to=document.getElementById('sponsor-to-user-id').value.trim();
    const amount=parseInt(document.getElementById('sponsor-amount').value,10);
    const reason=document.getElementById('sponsor-reason').value.trim();
    const sponsorKey=document.getElementById('sponsor-key').value.trim();
    if(!from||!to||!amount) return toast('Datos inválidos');
    await fetchJSON('/api/economy/transfer',{method:'POST',body:JSON.stringify({ fromUserId:from, toUserId:to, amount, reason, sponsorKey })});
    toast('Transferencia realizada');
    await loadSponsors();
  }catch(e){ toast('Error en transferencia'); console.error(e); }
}

async function sponsorRemove(userId){
  try{
    const adminUser=document.getElementById('admin-username').value.trim();
    const adminCode=document.getElementById('admin-code').value.trim();
    await fetchJSON('/api/economy/sponsors/remove',{method:'POST',headers:{'x-admin-username':adminUser,'x-admin-code':adminCode},body:JSON.stringify({ userId, adminUsername:adminUser, adminCode })});
    toast('Patrocinador quitado');
    await loadSponsors();
  }catch(e){ toast('Error al quitar patrocinador'); console.error(e); }
}

async function sponsorSetKey(){
  try{
    const userId=document.getElementById('sponsor-key-user').value.trim();
    const key=document.getElementById('sponsor-new-key').value.trim();
    if(!userId||!key) return toast('userId y clave requeridos');
    const adminUser=document.getElementById('admin-username').value.trim();
    const adminCode=document.getElementById('admin-code').value.trim();
    await fetchJSON('/api/economy/sponsors/set-key',{method:'POST',headers:{'x-admin-username':adminUser,'x-admin-code':adminCode},body:JSON.stringify({ userId, key, adminUsername:adminUser, adminCode })});
    toast('Clave asignada');
    document.getElementById('sponsor-new-key').value='';
  }catch(e){ toast('Error al asignar clave'); console.error(e); }
}

async function sponsorRemoveKey(){
  try{
    const userId=document.getElementById('sponsor-key-user').value.trim();
    const adminUser=document.getElementById('admin-username').value.trim();
    const adminCode=document.getElementById('admin-code').value.trim();
    await fetchJSON('/api/economy/sponsors/remove-key',{method:'POST',headers:{'x-admin-username':adminUser,'x-admin-code':adminCode},body:JSON.stringify({ userId, adminUsername:adminUser, adminCode })});
    toast('Clave removida');
  }catch(e){ toast('Error al quitar clave'); console.error(e); }
}

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
          const fMint=document.getElementById('flt-mint')?.checked!==false;
          const fRev=document.getElementById('flt-revert')?.checked!==false;
          const fInit=document.getElementById('flt-init')?.checked!==false;
          const filtered=data.items.filter(it=>{
            if(it.type==='mint') return fMint;
            if(it.type==='revert') return fRev;
            if(it.type==='init') return fInit;
            return true;
          });
          renderAuditList(target, filtered);
          const auto=document.getElementById('flt-autoscroll');
          if(auto && auto.checked){ target.scrollTop=target.scrollHeight; }
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
