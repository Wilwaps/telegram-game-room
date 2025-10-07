import { Registry } from '../../core/registry.js';
import { UI } from '../../core/ui.js';
import { Utils } from '../../core/utils.js';

function genUnique(min, max, count){
  const set = new Set();
  while (set.size < count){ set.add(Utils.randInt(min, max)); }
  return Array.from(set).sort((a,b)=>a-b);
}

function generateCard(){
  const cols = [
    genUnique(1, 15, 5),
    genUnique(16, 30, 5),
    genUnique(31, 45, 5),
    genUnique(46, 60, 5),
    genUnique(61, 75, 5)
  ];
  // Centro libre
  cols[2][2] = 0; // 0 representará FREE
  return { id: 'c_'+Math.random().toString(36).slice(2,8), numbers: cols, marked: new Set([0]) };
}

function validateLine(card){
  const n = card.numbers; const has = (x)=> card.marked.has(x) || x===0;
  // Horizontales
  for (let r=0;r<5;r++){ let ok=true; for (let c=0;c<5;c++){ if (!has(n[c][r])){ ok=false; break; } } if (ok) return true; }
  // Verticales
  for (let c=0;c<5;c++){ let ok=true; for (let r=0;r<5;r++){ if (!has(n[c][r])){ ok=false; break; } } if (ok) return true; }
  // Diagonales
  let ok1=true; for (let i=0;i<5;i++){ if (!has(n[i][i])) { ok1=false; break; } }
  if (ok1) return true;
  let ok2=true; for (let i=0;i<5;i++){ if (!has(n[i][4-i])) { ok2=false; break; } }
  return ok2;
}

const BingoV2 = {
  id: 'bingo',
  name: 'Bingo',
  icon: '🎱',
  desc: 'Marca tus números y canta ¡Bingo! (v2 demo)',

  mount(root, ctx){
    const { UI:ui = UI } = ctx || {};
    const state = { drawn: new Set(), recent: [], card: generateCard(), last: null };
    const disposers = [];

    const wrap = document.createElement('div');
    wrap.className = 'bn-wrap';

    // Panel draw
    const drawPanel = document.createElement('div');
    drawPanel.className = 'bn-panel';
    drawPanel.innerHTML = `<h3 class="bn-title">Números cantados</h3><div class="bn-draw-grid" id="bn-draw-grid"></div><div class="bn-recent" id="bn-recent"></div>`;
    const drawGrid = drawPanel.querySelector('#bn-draw-grid');
    const recentEl = drawPanel.querySelector('#bn-recent');
    wrap.appendChild(drawPanel);

    // Panel cards
    const cardsPanel = document.createElement('div');
    cardsPanel.className = 'bn-panel';
    cardsPanel.innerHTML = `<h3 class="bn-title">Tus cartones</h3><div class="bn-cards" id="bn-cards"></div>`;
    const cardsRoot = cardsPanel.querySelector('#bn-cards');
    wrap.appendChild(cardsPanel);

    // Claim overlay
    const claimOverlay = document.createElement('div');
    claimOverlay.className = 'bn-claim-overlay';
    claimOverlay.innerHTML = `<button class="bn-claim-btn">¡Bingo!</button>`;
    document.body.appendChild(claimOverlay);

    const fab = document.createElement('button');
    fab.className = 'bn-fab';
    fab.textContent = 'Simular número';
    document.body.appendChild(fab);

    const renderDraw = ()=>{
      drawGrid.innerHTML = '';
      for (let n=1;n<=75;n++){
        const d = document.createElement('div');
        d.className = 'bn-number';
        d.textContent = String(n);
        if (state.drawn.has(n)) d.classList.add('active');
        if (state.last === n) d.classList.add('last');
        drawGrid.appendChild(d);
      }
      recentEl.innerHTML = state.recent.map(n=>`<div class="bn-ball">${n}</div>`).join('');
    };

    const renderCard = ()=>{
      cardsRoot.innerHTML = '';
      const c = state.card;
      const cardEl = document.createElement('div');
      cardEl.className = 'bn-card';
      cardEl.innerHTML = `<div class="hdr"><span>Cartón</span></div>`;
      const grid = document.createElement('div');
      grid.className = 'bn-grid';
      for (let r=0;r<5;r++){
        for (let col=0; col<5; col++){
          const num = c.numbers[col][r];
          const cell = document.createElement('div');
          cell.className = 'bn-cell';
          if (num === 0) cell.classList.add('free');
          cell.textContent = num === 0 ? 'FREE' : String(num);
          if (c.marked.has(num)) cell.classList.add('marked');
          if (state.last && num === state.last) cell.classList.add('last-drawn');
          cell.addEventListener('click', (e)=>{
            e.stopPropagation();
            if (num === 0) return;
            if (!state.drawn.has(num)) { ui.showToast('Ese número aún no ha sido cantado', 'warning'); return; }
            if (cell.classList.contains('marked')){ c.marked.delete(num); cell.classList.remove('marked'); }
            else { c.marked.add(num); cell.classList.add('marked'); }
            updateClaim();
          });
          grid.appendChild(cell);
        }
      }
      cardEl.appendChild(grid);
      cardsRoot.appendChild(cardEl);
    };

    const updateClaim = ()=>{
      if (validateLine(state.card)) {
        claimOverlay.classList.add('active');
      } else {
        claimOverlay.classList.remove('active');
      }
    };

    const handleNumberDrawn = (n)=>{
      state.drawn.add(n);
      state.last = n;
      state.recent.unshift(n); state.recent = state.recent.slice(0,5);
      renderDraw();
      renderCard();
      ui.log(`bingo:number_drawn ${n}`, 'info', 'bingo-v2');
    };

    disposers.push(()=>{ document.body.removeChild(fab); });
    disposers.push(()=>{ document.body.removeChild(claimOverlay); });

    fab.addEventListener('click', ()=>{
      // simular siguiente no cantado
      const pool = []; for (let n=1;n<=75;n++){ if (!state.drawn.has(n)) pool.push(n); }
      if (!pool.length) { ui.showToast('No quedan números', 'info'); return; }
      const next = pool[Math.floor(Math.random()*pool.length)];
      handleNumberDrawn(next);
    });

    claimOverlay.querySelector('.bn-claim-btn').addEventListener('click', ()=>{
      claimOverlay.classList.remove('active');
      ui.showToast('¡Bingo (demo)!', 'success');
    });

    // Primer render
    renderDraw();
    renderCard();

    // Montaje en root
    root.innerHTML = '';
    root.appendChild(wrap);

    const plugin = {
      unmount(){ try { disposers.forEach(fn=>fn()); } catch(_){} }
    };
    root.__plugin = plugin;
    return plugin;
  }
};

Registry.register(BingoV2);
