(function(){
  // SPA-lite App Shell
  const sameOrigin = (u)=>{ try{ const url=new URL(u, location.origin); return url.origin===location.origin; }catch(_){ return false; } };
  const cache = new Map();
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

  function reexecuteScripts(container){
    try{
      const scripts = container.querySelectorAll('script');
      scripts.forEach((old)=>{
        const s = document.createElement('script');
        // copy attributes
        for (const attr of old.attributes){ s.setAttribute(attr.name, attr.value); }
        if (old.src){ s.src = old.src; s.defer = false; s.async = false; }
        else { s.textContent = old.textContent || ''; }
        old.replaceWith(s);
      });
    }catch(_){ }
  }

  async function fetchDoc(url){
    const key = url;
    if (cache.has(key)) return cache.get(key);
    const p = fetch(url, { headers: { 'X-Requested-With': 'AppShell' } })
      .then(r=>{ if(!r.ok) throw new Error('http_'+r.status); return r.text(); })
      .catch(()=>null);
    cache.set(key, p);
    return p;
  }

  function extractPage(html){
    try{
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const cand = doc.querySelector('#page') || doc.querySelector('main') || doc.body;
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
      const rootEl = ensureRoot(); if (!rootEl) { location.href = url; return; }
      const raw = await fetchDoc(url);
      if (!raw) { location.href = url; return; }
      const page = extractPage(raw);
      if (!page) { location.href = url; return; }
      // swap content
      rootEl.innerHTML = page.html;
      document.title = page.title;
      reexecuteScripts(rootEl);
      // ejecutar scripts inline externos al contenedor original (p.ej. bloques al final del body)
      try{ (page.extraInline||[]).forEach(code=>{ const s=document.createElement('script'); s.textContent=code||''; rootEl.appendChild(s); }); }catch(_){ }
      if (push) history.pushState({ url }, page.title, url);
      // focus to top for better UX
      try{ window.scrollTo({ top: 0, behavior: 'instant' }); }catch(_){ window.scrollTo(0,0); }
    }catch(_){ location.href = url; }
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

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
