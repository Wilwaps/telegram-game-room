export const Utils = {
  sleep(ms){ return new Promise(r=>setTimeout(r, ms)); },
  clamp(n, a, b){ return Math.max(a, Math.min(b, n)); },
  randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; },
  el(sel, root=document){ return root.querySelector(sel); },
  els(sel, root=document){ return Array.from(root.querySelectorAll(sel)); },
  create(tag, props={}){ const el = document.createElement(tag); Object.assign(el, props); return el; },
  escapeHtml(s=''){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); },
};
window.UtilsV2 = Utils;
