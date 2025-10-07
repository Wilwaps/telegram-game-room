import { Registry } from '../../core/registry.js';
import { UI } from '../../core/ui.js';
import { Utils } from '../../core/utils.js';

function genTiles(max=6){
  const arr = [];
  for (let a=0;a<=max;a++){
    for (let b=a;b<=max;b++){
      arr.push({ id: `${a}-${b}`, a, b });
    }
  }
  return arr;
}

function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlay(tile, leftEnd, rightEnd){
  if (leftEnd === null && rightEnd === null) return { left:true, right:true };
  const left = (tile.a === leftEnd || tile.b === leftEnd);
  const right = (tile.a === rightEnd || tile.b === rightEnd);
  return { left, right };
}

function orientForEnd(tile, end){
  // retorna [x,y] con el número que toca al extremo hacia afuera
  if (tile.a === end) return { a: tile.b, b: tile.a, flipped:false };
  if (tile.b === end) return { a: tile.a, b: tile.b, flipped:true };
  // no match, devolver tal cual
  return { a: tile.a, b: tile.b, flipped:false };
}

const DominoV2 = {
  id: 'domino',
  name: 'Dominó',
  icon: '🁣',
  desc: 'Coloca fichas que coincidan en los extremos (v2 demo)',

  mount(root, ctx){
    const ui = (ctx && ctx.UI) || UI;

    const state = {
      stock: [],
      hand: [],
      board: [], // [{a,b}] ordenadas de izquierda→derecha
      leftEnd: null,
      rightEnd: null
    };

    const wrap = document.createElement('div');
    wrap.className = 'dm-wrap';

    const boardPanel = document.createElement('div');
    boardPanel.className = 'dm-panel';
    boardPanel.innerHTML = `
      <div class="dm-header">
        <div class="dm-title">Mesa</div>
        <div class="dm-ends">Extremos: <span id="dm-left">-</span> | <span id="dm-right">-</span></div>
      </div>
      <div id="dm-board" class="dm-board"></div>
      <div class="dm-actions">
        <button id="dm-draw" class="btn">Robar</button>
        <button id="dm-reset" class="btn btn-outline">Reiniciar</button>
      </div>
    `;

    const handPanel = document.createElement('div');
    handPanel.className = 'dm-panel';
    handPanel.innerHTML = `
      <div class="dm-title">Tu mano</div>
      <div id="dm-hand" class="dm-hand"></div>
    `;

    wrap.appendChild(boardPanel);
    wrap.appendChild(handPanel);

    const els = {
      board: boardPanel.querySelector('#dm-board'),
      left: boardPanel.querySelector('#dm-left'),
      right: boardPanel.querySelector('#dm-right'),
      drawBtn: boardPanel.querySelector('#dm-draw'),
      resetBtn: boardPanel.querySelector('#dm-reset'),
      hand: handPanel.querySelector('#dm-hand'),
    };

    function renderEnds(){
      els.left.textContent = state.leftEnd === null ? '-' : String(state.leftEnd);
      els.right.textContent = state.rightEnd === null ? '-' : String(state.rightEnd);
    }

    function renderBoard(){
      els.board.innerHTML = '';
      state.board.forEach(t => {
        const tile = document.createElement('div');
        tile.className = 'dm-tile placed';
        tile.innerHTML = `<span>${t.a}</span><span>${t.b}</span>`;
        els.board.appendChild(tile);
      });
    }

    function renderHand(){
      els.hand.innerHTML = '';
      state.hand.forEach((t, idx) => {
        const playable = canPlay(t, state.leftEnd, state.rightEnd);
        const el = document.createElement('button');
        el.className = 'dm-tile';
        if (playable.left || playable.right) el.classList.add('playable');
        el.innerHTML = `<span>${t.a}</span><span>${t.b}</span>`;
        el.addEventListener('click', ()=>{
          // preferimos derecha si ambas son válidas
          if (playable.right){ placeRight(idx); }
          else if (playable.left){ placeLeft(idx); }
          else { ui.showToast('No coincide con ningún extremo', 'warning'); ui.log(`dom:illegal ${t.id}`, 'warn', 'domino-v2'); }
        });
        els.hand.appendChild(el);
      });
    }

    function placeLeft(handIndex){
      const t = state.hand[handIndex];
      if (!t) return;
      const match = canPlay(t, state.leftEnd, state.rightEnd);
      if (!match.left){ ui.showToast('No coincide a la izquierda', 'warning'); ui.log(`dom:illegal_left ${t.id}`, 'warn', 'domino-v2'); return; }
      const orient = (state.leftEnd === null && state.rightEnd === null) ? { a:t.a, b:t.b, flipped:false } : orientForEnd(t, state.leftEnd);
      state.board.unshift({ a: orient.a, b: orient.b });
      state.leftEnd = orient.b; // lo que queda hacia la izquierda
      if (state.rightEnd === null) state.rightEnd = orient.a;
      state.hand.splice(handIndex,1);
      ui.log(`dom:place left ${t.id} -> ends ${state.leftEnd}|${state.rightEnd}`, 'info', 'domino-v2');
      postMove();
    }

    function placeRight(handIndex){
      const t = state.hand[handIndex];
      if (!t) return;
      const match = canPlay(t, state.leftEnd, state.rightEnd);
      if (!match.right){ ui.showToast('No coincide a la derecha', 'warning'); ui.log(`dom:illegal_right ${t.id}`, 'warn', 'domino-v2'); return; }
      const orient = (state.leftEnd === null && state.rightEnd === null) ? { a:t.a, b:t.b, flipped:false } : orientForEnd(t, state.rightEnd);
      state.board.push({ a: orient.a, b: orient.b });
      state.rightEnd = orient.a; // lo que queda hacia la derecha
      if (state.leftEnd === null) state.leftEnd = orient.b;
      state.hand.splice(handIndex,1);
      ui.log(`dom:place right ${t.id} -> ends ${state.leftEnd}|${state.rightEnd}`, 'info', 'domino-v2');
      postMove();
    }

    function postMove(){
      renderBoard();
      renderHand();
      renderEnds();
      if (state.hand.length === 0){ ui.showToast('¡Ganaste! (sin IA en demo)', 'success'); ui.log('dom:win player', 'info', 'domino-v2'); }
    }

    function drawFromStock(){
      if (!state.stock.length){ ui.showToast('No quedan fichas', 'info'); ui.log('dom:stock_empty', 'info', 'domino-v2'); return; }
      const t = state.stock.pop();
      state.hand.push(t);
      ui.log(`dom:draw ${t.id}`, 'info', 'domino-v2');
      renderHand();
    }

    function reset(){
      state.board = [];
      state.leftEnd = null;
      state.rightEnd = null;
      state.stock = shuffle(genTiles());
      state.hand = state.stock.splice(-7, 7);
      ui.log(`dom:init stock=${state.stock.length} hand=7`, 'info', 'domino-v2');
      renderBoard();
      renderHand();
      renderEnds();
    }

    els.drawBtn.addEventListener('click', drawFromStock);
    els.resetBtn.addEventListener('click', reset);

    // Primer arranque
    reset();

    // Montaje final
    root.innerHTML = '';
    root.appendChild(wrap);

    const plugin = { unmount(){ /* nada para limpiar en demo */ } };
    root.__plugin = plugin;
    return plugin;
  }
};

Registry.register(DominoV2);
