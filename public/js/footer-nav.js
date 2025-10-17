(function(){
  try{
    if (document.getElementById('appFooterNav')) return;
    var path = location.pathname || '/';
    function isActive(key){
      if (key==='profile') return path.startsWith('/profile');
      if (key==='juegos') return path.startsWith('/games');
      if (key==='raffles') return path.startsWith('/raffles');
      return false;
    }
    // estilos base para .nav-item (si no existen en la página)
    if (!document.getElementById('footer-nav-style')){
      var st = document.createElement('style');
      st.id = 'footer-nav-style';
      st.textContent = '.nav-item:hover{background-color:var(--tw-bg-accent);color:var(--tw-bg-background-dark)}.nav-item{transition:background-color .2s,color .2s}.nav-item .material-symbols-outlined{display:block;margin:0 auto .25rem}';
      (document.head||document.documentElement).appendChild(st);
    }

    var nav = document.createElement('nav');
    nav.id = 'appFooterNav';
    nav.className = 'fixed bottom-0 left-0 right-0 bg-card border-t border-glass px-2 py-1';
    var inner = document.createElement('div');
    inner.className = 'flex justify-around text-xs text-center text-text/80';
    function item(href, icon, label, key, styleVars){
      var a = document.createElement('a');
      a.className = 'nav-item flex-1 p-2 rounded-lg' + (isActive(key)?' bg-accent/20 text-accent shadow-[0_0_10px_#22d3ee]':'');
      if (styleVars) a.setAttribute('style', styleVars);
      a.href = href;
      var s1 = document.createElement('span'); s1.className = 'material-symbols-outlined'; s1.textContent = icon;
      var s2 = document.createElement('span'); s2.textContent = label;
      a.appendChild(s1); a.appendChild(s2);
      return a;
    }
    inner.appendChild(item('/profile','person','Perfil','profile','--tw-bg-accent:#facc15; --tw-bg-background-dark:#0B0E14'));
    inner.appendChild(item('/games','door_open','Lobby','lobby','--tw-bg-accent:#22d3ee; --tw-bg-background-dark:#0B0E14'));
    inner.appendChild(item('/games','sports_esports','Juegos','juegos','--tw-bg-accent:#22d3ee; --tw-bg-background-dark:#0B0E14'));
    inner.appendChild(item('/raffles','confirmation_number','Rifas','raffles','--tw-bg-accent:#facc15; --tw-bg-background-dark:#0B0E14'));
    inner.appendChild(item('#','storefront','Mercado',null,'--tw-bg-accent:#a78bfa; --tw-bg-background-dark:#0B0E14'));
    inner.appendChild(item('#','groups','Rol',null,'--tw-bg-accent:#a78bfa; --tw-bg-background-dark:#0B0E14'));
    inner.appendChild(item('#','schedule','Próximo',null,'--tw-bg-accent:#a78bfa; --tw-bg-background-dark:#0B0E14'));
    nav.appendChild(inner);
    document.body.appendChild(nav);
  }catch(_){ }
})();
