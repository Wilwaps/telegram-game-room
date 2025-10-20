(function(){
  const STATE_KEY = 'music_state_v1';
  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const fmt = (n)=> new Intl.NumberFormat().format(n ?? 0);

  let playlist = [];
  let idx = 0;
  let audio = null;
  let isReady = false;
  let playing = false;
  let progressTimer = null;

  function loadState(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY)||'{}') } catch(_) { return {} }
  }
  function saveState(){
    try {
      const st = { idx, time: audio?audio.currentTime:0, playing };
      localStorage.setItem(STATE_KEY, JSON.stringify(st));
    } catch(_){}
  }

  function createUI(){
    // Asegurar Material Symbols
    try {
      const has = Array.from(document.styleSheets||[]).some(ss=>{
        try { return (ss&&ss.href||'').includes('fonts.googleapis.com/css2?family=Material+Symbols+Outlined'); } catch(_){ return false }
      });
      if (!has) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined';
        document.head.appendChild(link);
      }
    } catch(_){}
    // Styles
    const css = document.createElement('style');
    css.textContent = `
      .mx-floating { position: fixed; top: 4px; right: 10px; z-index: 1000; display:flex; gap:8px; align-items:center; }
      .mx-btn { width: 24px; height: 24px; background: rgba(18,26,43,.9); border-radius: 9999px; border: 2px solid #22d3ee; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 12px rgba(34,211,238,.18); cursor: pointer; transition: transform .18s ease, background .18s ease; }
      .mx-btn .material-symbols-outlined { font-size: 16px; line-height: 1; }
      .mx-btn:hover { transform: translateY(-1px); background: rgba(34,211,238,.15); }
      .mx-inbox-dot { position:absolute; top:-4px; right:-4px; width:10px; height:10px; background:#ef4444; border-radius:9999px; box-shadow: 0 0 8px rgba(239,68,68,.8); display:none; }
      .mx-panel { position: fixed; left: 0; right: 0; bottom: 0; z-index: 999; transform: translateY(100%); height: 82%; background: rgba(11,14,20,.9); backdrop-filter: blur(8px); border-top-left-radius: 14px; border-top-right-radius: 14px; border-top: 1px solid rgba(34,211,238,.35); box-shadow: 0 -12px 25px rgba(34,211,238,.12); color: #e6edf3; display: flex; flex-direction: column; transition: transform .3s ease; pointer-events: none; }
      .mx-panel.open { transform: translateY(0); pointer-events: auto; }
      .mx-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
      .mx-cover { width: 56px; height: 56px; border-radius: 10px; background-size: cover; background-position: center; flex-shrink: 0; }
      .mx-title { font-weight: 800; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mx-sub { color: #9fb1c6; font-size: 12px; }
      .mx-controls { display: flex; align-items: center; gap: 8px; margin-left: auto; }
      .mx-icon { color: #e6fbff; opacity: .8; cursor: pointer; }
      .mx-body { padding: 8px 12px; overflow: auto; }
      .mx-track { display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; }
      .mx-track:hover { background: rgba(255,255,255,.06); }
      .mx-track .mx-tcover { width: 40px; height: 40px; border-radius: 8px; background-size: cover; background-position:center; flex-shrink: 0; }
      .mx-track .mx-tmain { flex:1; overflow:hidden; }
      .mx-track .mx-ttitle { font-weight:700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mx-track .mx-tartist { color:#9fb1c6; font-size: 12px; white-space: nowrap; overflow:hidden; text-overflow:ellipsis; }
      .mx-progress { display:flex; align-items:center; gap:8px; padding: 8px 12px; }
      .mx-range { width:100%; }
      .mx-vol { width:100px; }
    `;
    document.head.appendChild(css);

    // Floating button
    const root = document.createElement('div');
    root.className = 'mx-floating';
    root.innerHTML = `
      <button id="mxInboxBtn" class="mx-btn" title="Mensajes" style="position:relative;">
        <span class="material-symbols-outlined" style="color:#22d3ee;">mail</span>
        <span id="mxInboxDot" class="mx-inbox-dot"></span>
      </button>
      <button id="mxBtn" class="mx-btn" title="Música">
        <span class="material-symbols-outlined" style="color:#22d3ee;">music_note</span>
      </button>
      <div id="mxPanel" class="mx-panel" aria-hidden="true">
        <div class="mx-header">
          <div id="mxCover" class="mx-cover"></div>
          <div style="min-width:0;">
            <div id="mxTitle" class="mx-title">—</div>
            <div id="mxSub" class="mx-sub">—</div>
          </div>
          <div class="mx-controls">
            <span id="mxPrev" class="material-symbols-outlined mx-icon">skip_previous</span>
            <span id="mxPlay" class="material-symbols-outlined mx-icon">play_arrow</span>
            <span id="mxNext" class="material-symbols-outlined mx-icon">skip_next</span>
            <span id="mxToggle" class="material-symbols-outlined mx-icon">close</span>
          </div>
        </div>
        <div class="mx-progress">
          <span id="mxCur" style="font-size:12px; color:#9fb1c6; min-width:34px; text-align:right;">0:00</span>
          <input id="mxSeek" class="mx-range" type="range" min="0" max="1000" value="0"/>
          <span id="mxDur" style="font-size:12px; color:#9fb1c6; min-width:34px;">0:00</span>
          <span class="material-symbols-outlined mx-icon">volume_up</span>
          <input id="mxVol" class="mx-vol" type="range" min="0" max="1" step="0.01" value="0.8"/>
        </div>
        <div id="mxBody" class="mx-body"></div>
      </div>
    `;
    document.body.appendChild(root);

    const btn = q('#mxBtn');
    const panel = q('#mxPanel');
    const toggle = q('#mxToggle');
    const play = q('#mxPlay');
    const prev = q('#mxPrev');
    const next = q('#mxNext');
    const seek = q('#mxSeek');
    const vol = q('#mxVol');
    const inboxBtn = q('#mxInboxBtn');
    const inboxDot = q('#mxInboxDot');

    function open(){ panel.classList.add('open'); panel.setAttribute('aria-hidden','false'); }
    function close(){ panel.classList.remove('open'); panel.setAttribute('aria-hidden','true'); }

    btn.addEventListener('click', ()=> panel.classList.contains('open') ? close() : open());
    toggle.addEventListener('click', ()=> panel.classList.contains('open') ? close() : open());

    play.addEventListener('click', ()=>{ if (!audio) return; if(audio.paused){ audio.play(); } else { audio.pause(); } });
    prev.addEventListener('click', ()=> switchTrack(((idx-1)+playlist.length)%playlist.length));
    next.addEventListener('click', ()=> switchTrack((idx+1)%playlist.length));
    seek.addEventListener('input', ()=>{ if(audio && audio.duration){ audio.currentTime = (seek.value/1000)*audio.duration; }});
    vol.addEventListener('input', ()=>{ if(audio){ audio.volume = parseFloat(vol.value||'0.8'); }});

    // Inbox modal (simple)
    const modal = document.createElement('div');
    modal.id = 'mxInboxModal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:1001; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.45)';
    modal.innerHTML = `
      <div style="max-width:480px; width:92%; background:rgba(18,26,43,.95); border:1px solid rgba(34,211,238,.3); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.45); overflow:hidden;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.08)">
          <div style="font-weight:800; color:#e6edf3">Mensajes</div>
          <button id="mxInboxClose" class="mx-btn" style="width:20px; height:20px;"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div id="mxInboxList" style="max-height:60vh; overflow:auto; padding:10px 12px; font-size:12px; color:#e6edf3"></div>
      </div>`;
    document.body.appendChild(modal);

    function getCookie(name){
      const m = document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]*)')); return m? decodeURIComponent(m[1]) : '';
    }
    function getUserId(){
      const uid = getCookie('uid') || getCookie('uidp');
      return uid ? ('anon:'+uid) : (localStorage.getItem('anon_uid')||'anon:guest');
    }
    function resolveUID(){
      try { if (window.AppUser && typeof window.AppUser.resolveUserId==='function') return window.AppUser.resolveUserId(); } catch(_){ }
      return getUserId();
    }
    async function refreshBalance(){
      try{
        const uid = resolveUID(); if (!uid) return;
        fetch(`/api/profile/${encodeURIComponent(uid)}`).then(r=>r.json()).then(j=>{
          if (j && j.success && j.user){
            const fEl = document.getElementById('firesVal'); if (fEl) fEl.textContent = fmt(Number(j.user.fires||0));
            const cEl = document.getElementById('coinsVal'); if (cEl) cEl.textContent = fmt(Number(j.user.coins||0));
            const cur = document.getElementById('currentFiresVal'); if (cur) cur.textContent = String(Number(j.user.fires||0));
          }
        }).catch(()=>{});
      }catch(_){ }
    }
    async function pollUnread(){
      try{
        const uid = resolveUID(); if (!uid) return;
        const r = await fetch(`/api/messages/unread-count/${encodeURIComponent(uid)}`);
        const j = await r.json(); const n = (j&&j.success)? Number(j.count||0) : 0;
        if (n>0) { inboxDot && (inboxDot.style.display='block'); }
        else { inboxDot && (inboxDot.style.display='none'); }
      }catch(_){ /* noop */ }
    }
    async function openInbox(){
      try{
        const uid = resolveUID(); if (!uid) return;
        const r = await fetch(`/api/messages/inbox/${encodeURIComponent(uid)}?limit=50`);
        const j = await r.json();
        const list = q('#mxInboxList'); if (!list) return; list.innerHTML='';
        const items = (j&&j.success&&Array.isArray(j.items))? j.items : [];
        if (items.length===0) list.innerHTML = '<div style="color:#9fb1c6">Sin mensajes</div>';
        for (const m of items){
          const el = document.createElement('div'); el.style.cssText='border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px; margin:6px 0; background:rgba(255,255,255,.03)';
          const meta = m && m.meta || {};
          const isOffer = String(meta.type||'') === 'welcome_offer';
          const btnHtml = isOffer ? `<div style="margin-top:6px;"><button class="mx-accept-offer" data-event-id="${meta.eventId||''}" style="padding:6px 10px; border-radius:8px; background:#22d3ee; color:#0B0E14; font-weight:700; font-size:12px;">Aceptar bono</button></div>` : '';
          el.innerHTML = `<div style="color:#9fb1c6; font-size:11px">${new Date(m.ts).toLocaleString()}</div><div>${(m.text||'')}</div>${btnHtml}`;
          if (isOffer){
            const b = el.querySelector('.mx-accept-offer');
            if (b){
              b.addEventListener('click', async ()=>{
                try{
                  b.disabled = true;
                  const evId = b.getAttribute('data-event-id') || (meta.eventId||null);
                  const resp = await fetch('/api/welcome/accept',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: resolveUID(), eventId: evId }) });
                  const jj = await resp.json();
                  if (resp.ok && jj && jj.success){
                    b.textContent = 'Aceptado';
                    try { refreshBalance(); } catch(_){ }
                    modal.style.display='none';
                  } else {
                    b.disabled = false;
                    alert('No se pudo activar el bono');
                  }
                }catch(_){ b.disabled=false; alert('Error de red'); }
              });
            }
          }
          list.appendChild(el);
        }
        await fetch('/api/messages/read-all',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: uid }) });
        if (inboxDot) inboxDot.style.display='none';
        modal.style.display='flex';
      }catch(_){ /* noop */ }
    }
    inboxBtn && inboxBtn.addEventListener('click', openInbox);
    document.getElementById('mxInboxClose')?.addEventListener('click', ()=>{ modal.style.display='none'; });
    setInterval(pollUnread, 10000); pollUnread();
  }

  function mmss(s){ s=Math.max(0,Math.floor(s||0)); const m=Math.floor(s/60); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`; }

  function renderList(){
    const body = q('#mxBody');
    body.innerHTML = '';
    playlist.forEach((t,i)=>{
      const row = document.createElement('div'); row.className='mx-track';
      row.innerHTML = `
        <div class="mx-tcover" style="background-image:url('${t.cover||''}')"></div>
        <div class="mx-tmain">
          <div class="mx-ttitle">${t.title||'-'}</div>
          <div class="mx-tartist">${t.artist||''}</div>
        </div>
        <span class="material-symbols-outlined mx-icon">${i===idx && playing? 'pause':'play_arrow'}</span>
      `;
      row.addEventListener('click', ()=>{
        if (i===idx){ if (audio.paused) audio.play(); else audio.pause(); }
        else switchTrack(i);
      });
      body.appendChild(row);
    });
  }

  function renderNow(){
    const t = playlist[idx]; if (!t) return;
    q('#mxCover').style.backgroundImage = `url('${t.cover||''}')`;
    q('#mxTitle').textContent = t.title||'-';
    q('#mxSub').textContent = t.artist||'';
    renderList();
  }

  function bindAudio(){
    const seek = q('#mxSeek');
    const cur = q('#mxCur');
    const dur = q('#mxDur');
    const play = q('#mxPlay');
    const st = loadState();

    audio.addEventListener('loadedmetadata', ()=>{
      dur.textContent = mmss(audio.duration||0);
      if (typeof st.time==='number' && st.idx===idx){ audio.currentTime = Math.min(audio.duration-0.25, Math.max(0, st.time||0)); }
    });
    audio.addEventListener('play', ()=>{ playing=true; play.textContent='pause'; saveState(); renderList(); });
    audio.addEventListener('pause', ()=>{ playing=false; play.textContent='play_arrow'; saveState(); renderList(); });
    audio.addEventListener('ended', ()=>{ switchTrack((idx+1)%playlist.length); });

    clearInterval(progressTimer);
    progressTimer = setInterval(()=>{
      if (!audio || !audio.duration) return;
      cur.textContent = mmss(audio.currentTime||0);
      dur.textContent = mmss(audio.duration||0);
      seek.value = String(Math.floor((audio.currentTime/(audio.duration||1))*1000));
    }, 500);
  }

  function switchTrack(i){
    idx = i;
    const t = playlist[idx]; if (!t) return;
    if (audio){ audio.pause(); }
    audio = new Audio(t.url);
    const st = loadState();
    audio.volume = parseFloat(q('#mxVol').value||'0.8');
    bindAudio();
    renderNow();
    if (st && st.idx===idx && st.playing===false){ audio.pause(); } else { audio.play().catch(()=>{}); }
    saveState();
  }

  async function init(){
    try{
      createUI();
      const r = await fetch('/api/music/playlist');
      const j = await r.json();
      playlist = (j&&j.success && Array.isArray(j.items)) ? j.items : [];
      if (playlist.length===0) return;
      const st = loadState();
      idx = (typeof st.idx==='number' && st.idx>=0 && st.idx<playlist.length)? st.idx : 0;
      switchTrack(idx);
      isReady = true;
    }catch(_){ /* noop */ }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
