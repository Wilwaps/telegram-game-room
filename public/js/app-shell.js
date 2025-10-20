(function(){
  // SPA-lite App Shell
  const sameOrigin = (u)=>{ try{ const url=new URL(u, location.origin); return url.origin===location.origin; }catch(_){ return false; } };
  const cache = new Map();
  let navCtl = null;
  let root = null;

  function ensureRoot(){
    if (root && document.body.contains(root)) return root;
    root = document.querySelector('#app-root');
    if (!root){
      root = document.querySelector('main');
      if (root) root.id = 'app-root';
    }
    return root;
  }

  function injectScriptOnce(id, src){ try{ var h=document.getElementById(id); if (h) return h; var s=document.createElement('script'); s.id=id; s.src=src; s.defer=true; (document.head||document.documentElement).appendChild(s); return s; }catch(_){ return null; } }
  function injectCssOnce(id, href){ try{ var h=document.getElementById(id); if (h) return h; var l=document.createElement('link'); l.id=id; l.rel='stylesheet'; l.href=href; (document.head||document.documentElement).appendChild(l); return l; }catch(_){ return null; } }
  function hasDriver(){ try{ return !!(window&&window.driver&&window.driver.js&&window.driver.js.driver); }catch(_){ return false; } }
  function ensureDriverLoaded(){ try{ injectCssOnce('drivercss-link','/css/driver.css'); if (hasDriver()) return Promise.resolve(true); return new Promise(function(resolve){ var s=injectScriptOnce('driverjs-loader','https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js'); if (!s) return resolve(false); s.addEventListener('load', function(){ resolve(hasDriver()); }); }); }catch(_){ return Promise.resolve(false); } }
  try{ document.addEventListener('AppShell:afterNavigate', function(){ try{ ensureDriverLoaded().then(function(){ try{ if (window.DriverTours && typeof window.DriverTours.runToursForRoute==='function'){ window.DriverTours.runToursForRoute(location.pathname); } }catch(_){ } }); }catch(_){ } }); }catch(_){ }

  function reexecuteScripts(container){
    try{
      const scripts = container.querySelectorAll('script');
      scripts.forEach((old)=>{
        // Evitar recargar scripts externos (src) ya presentes globalmente
        if (old.src) { try { old.remove(); } catch(_){} return; }
        const s = document.createElement('script');
        for (const attr of old.attributes){ s.setAttribute(attr.name, attr.value); }
        s.textContent = old.textContent || '';
        old.replaceWith(s);
      });
    }catch(_){ }
  }

  async function fetchDoc(url, signal){
    try{
      // Cache efímero (8s) para navegación inmediata / prefetch
      const TTL = 8000;
      const now = Date.now();
      const hit = cache.get(url);
      if (hit && (now - (hit.ts||0) < TTL) && typeof hit.text === 'string') return hit.text;
      const r = await fetch(url, { headers: { 'X-Requested-With': 'AppShell', 'Cache-Control': 'no-cache' }, signal });
      if (!r.ok) throw new Error('http_'+r.status);
      const text = await r.text();
      try{ cache.set(url, { text, ts: now }); }catch(_){ }
      return text;
    }catch(_){ return null; }
  }

  function extractPage(html){
    try{
      const doc = new DOMParser().parseFromString(html, 'text/html');
      let cand = doc.querySelector('#page') || doc.querySelector('main') || doc.body;
      try{
        const m = doc.querySelector('main');
        if (m){
          const ids = ['fabCreate','raffleCreateFab','createOverlay','roomView','claimModal','gameOverOverlay'];
          const outside = ids.some(id=>{ const el=doc.getElementById(id); return el && !m.contains(el); });
          if (outside) cand = doc.body; // Incluir overlays/fab que viven fuera de <main>
        }
      }catch(_){ }
      // recoger scripts inline que estén fuera del contenedor extraído (páginas que ponen JS al final del body)
      const extraInline = [];
      try{
        const allInline = Array.from(doc.querySelectorAll('script:not([src])'));
        for (const s of allInline){ if (!cand.contains(s)) extraInline.push(s.textContent||''); }
      }catch(_){ }
      return { html: cand.innerHTML, title: doc.title || document.title, extraInline };
    }catch(_){ return null; }
  }

  async function navigate(url, push=true){
    try{
      if (!sameOrigin(url)) { location.href = url; return; }
      // Evitar navegación redundante a misma URL (sin considerar hash)
      try{
        const dest = new URL(url, location.href);
        const cur = new URL(location.href);
        if (dest.origin===cur.origin && dest.pathname===cur.pathname && dest.search===cur.search) {
          try{ document.dispatchEvent(new CustomEvent('AppShell:afterNavigate', { detail: { url } })); }catch(_){ }
          try{ window.scrollTo({ top: 0, behavior: 'instant' }); }catch(_){ window.scrollTo(0,0); }
          return;
        }
      }catch(_){ }
      const rootEl = ensureRoot(); if (!rootEl) { location.href = url; return; }
      // Limpiar restos de vistas anteriores fuera del contenedor raíz (FAB/overlays de Bingo, etc.)
      try{
        const strayIds = ['fabCreate','raffleCreateFab','createOverlay','roomView','claimModal','gameOverOverlay','sheetOverlay','createSheet'];
        strayIds.forEach(id=>{
          const el = document.getElementById(id);
          if (el && !rootEl.contains(el)) { try{ el.remove(); }catch(_){} }
        });
      }catch(_){ }
      try{ if (navCtl) { try{ navCtl.abort(); }catch(_){ } } }catch(_){ }
      navCtl = new AbortController();
      const raw = await fetchDoc(url, navCtl.signal);
      if (!raw) { location.href = url; return; }
      const page = extractPage(raw);
      if (!page) { location.href = url; return; }
      // swap content
      rootEl.innerHTML = page.html;
      document.title = page.title;
      reexecuteScripts(rootEl);
      // ejecutar scripts inline externos al contenedor original (p.ej. bloques al final del body)
      try{
        const codes = page.extraInline||[];
        for (const code of codes){ Promise.resolve().then(()=>{ const s=document.createElement('script'); s.textContent=code||''; rootEl.appendChild(s); }); }
      }catch(_){ }
      if (push) history.pushState({ url }, page.title, url);
      try{ document.dispatchEvent(new CustomEvent('AppShell:afterNavigate', { detail: { url } })); }catch(_){ }
      // focus to top for better UX
      try{ window.scrollTo({ top: 0, behavior: 'instant' }); }catch(_){ window.scrollTo(0,0); }
    }catch(err){ if (!(err && err.name==='AbortError')) { location.href = url; } }
  }

  function onClick(e){
    try{
      if (e.defaultPrevented) return;
      let a = e.target;
      while (a && a.tagName !== 'A'){ a = a.parentElement; }
      if (!a) return;
      const href = a.getAttribute('href')||'';
      const target = a.getAttribute('target')||'';
      if (!href || href.startsWith('#') || target==='_blank') return;
      if (!sameOrigin(href)) return;
      e.preventDefault();
      navigate(href, true);
    }catch(_){ }
  }

  function onPop(){ navigate(location.pathname + location.search + location.hash, false); }

  function preloadFooterLinks(){
    try{
      const ids = ['profile','lobby','juegos','raffles','market'];
      const nav = document.getElementById('appFooterNav'); if (!nav) return;
      const links = nav.querySelectorAll('a[href]');
      links.forEach(a=>{ const href=a.getAttribute('href'); if (sameOrigin(href)) fetchDoc(href); });
    }catch(_){ }
  }

  // init
  function init(){
    ensureRoot();
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    preloadFooterLinks();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
  try{ ensureDriverLoaded().then(function(){ try{ if (window.DriverTours && typeof window.DriverTours.runToursForRoute==='function'){ window.DriverTours.runToursForRoute(location.pathname); } }catch(_){ } }); }catch(_){ }
})();
