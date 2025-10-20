(function(){
  const st = { limit: 50, offset: 0, order: 'desc' };
  function $(id){ return document.getElementById(id); }
  function fmt(n){ try{ return new Intl.NumberFormat().format(n ?? 0); }catch(_){ return String(n||0); } }
  function fmtTS(ts){ try{ const d = (ts instanceof Date)? ts : new Date(ts); return d.toLocaleString(); }catch(_){ return '-'; } }
  function short(s, max=64){ const t=String(s??''); return t.length>max? t.slice(0,max-3)+'...' : t; }
  function readFilters(){
    const type = $('supdb-type')?.value || '';
    const user_ext = $('supdb-user')?.value || '';
    const event_id = $('supdb-event')?.value || '';
    const fromVal = $('supdb-from')?.value || '';
    const toVal = $('supdb-to')?.value || '';
    const limit = parseInt($('supdb-limit')?.value || '50', 10) || 50;
    st.limit = Math.max(1, Math.min(1000, limit));
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (user_ext) params.set('user_ext', user_ext);
    if (event_id) params.set('event_id', event_id);
    if (fromVal){ try{ params.set('from', new Date(fromVal).toISOString()); }catch(_){ /* ignore */ } }
    if (toVal){ try{ params.set('to', new Date(toVal).toISOString()); }catch(_){ /* ignore */ } }
    params.set('limit', String(st.limit));
    params.set('offset', String(st.offset));
    params.set('order', st.order);
    return params.toString();
  }
  async function loadSupplyTxsDb(){
    const info = $('supdb-info'); if(info) info.textContent='';
    const tb = $('supdb-rows'); if(tb) tb.innerHTML='<tr><td colspan="8" class="muted">Cargando...</td></tr>';
    try{
      const qs = readFilters();
      const r = await fetch('/api/economy/supply/txs-db?'+qs);
      const j = await r.json();
      if(!(j && j.success)){ if(tb) tb.innerHTML='<tr><td colspan="8">Error</td></tr>'; return; }
      const items = j.items||[];
      if(tb){
        tb.innerHTML='';
        for(const it of items){
          const tr = document.createElement('tr');
          const metaStr = short(typeof it.meta==='object'? JSON.stringify(it.meta) : (it.meta||''), 80);
          tr.innerHTML = `
            <td style="white-space:nowrap">${fmtTS(it.ts)}</td>
            <td>${it.type||'-'}</td>
            <td style="text-align:right">${fmt(Number(it.amount||0))}</td>
            <td style="font-family:monospace">${it.user_ext||''}</td>
            <td>${it.event_id??''}</td>
            <td>${it.reference||''}</td>
            <td>${it.actor||''}</td>
            <td><code>${metaStr}</code></td>
          `;
          tb.appendChild(tr);
        }
      }
      // paginación básica
      const hasPrev = st.offset > 0;
      const hasNext = (items.length >= st.limit);
      const bPrev = $('supdb-prev'); if(bPrev) bPrev.disabled = !hasPrev;
      const bNext = $('supdb-next'); if(bNext) bNext.disabled = !hasNext;
      if(info){ info.textContent = `Mostrando ${items.length} / límite ${st.limit} (offset ${st.offset})`; }
    }catch(_){ if(tb) tb.innerHTML='<tr><td colspan="8">Error de red</td></tr>'; }
  }
  function onSearch(){ st.offset = 0; loadSupplyTxsDb(); }
  function onPrev(){ st.offset = Math.max(0, st.offset - st.limit); loadSupplyTxsDb(); }
  function onNext(){ st.offset = st.offset + st.limit; loadSupplyTxsDb(); }
  function onExport(){ const qs = readFilters(); const url = '/api/economy/supply/txs-db/export.csv?'+qs; window.open(url, '_blank'); }
  document.addEventListener('DOMContentLoaded', ()=>{
    if(!$('supdb-rows')) return;
    const bS=$('supdb-search'); if(bS) bS.addEventListener('click', onSearch);
    const bE=$('supdb-export'); if(bE) bE.addEventListener('click', onExport);
    const bP=$('supdb-prev'); if(bP) bP.addEventListener('click', onPrev);
    const bN=$('supdb-next'); if(bN) bN.addEventListener('click', onNext);
    loadSupplyTxsDb();
  });
})();
