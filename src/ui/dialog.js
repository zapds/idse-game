// Dialogue: speaker portraits (procedural SVG), typewriter text, click/space to advance, choices.
import { h } from './dom.js';
import { audio } from '../engine/audio.js';

export const CAST = {
  tally: { name: 'TALLY', role: 'rover AI, KESTREL-7', color: '#5ff2ff' },
  voss: { name: 'DIRECTOR VOSS', role: 'Colony Director', color: '#ff7a59' },
  okoro: { name: 'DR. ILSE OKORO', role: 'Chief Statistician (recorded log)', color: '#ffb86b' },
  reyes: { name: 'CHAIR REYES', role: 'Colony Council', color: '#7dffb2' },
  sys: { name: 'HALCYON NET', role: 'automated', color: '#b48cff' },
};

function portrait(id) {
  const c = CAST[id].color;
  const faces = {
    tally: `<rect width="80" height="80" fill="#0d1a2e"/><circle cx="40" cy="40" r="26" fill="none" stroke="${c}" stroke-width="2" opacity=".4"/>
      <circle cx="40" cy="40" r="18" fill="none" stroke="${c}" stroke-width="3"/><circle class="eye" cx="40" cy="40" r="7" fill="${c}"/>
      <path d="M14 40h6M60 40h6M40 14v6M40 60v6" stroke="${c}" stroke-width="2"/>`,
    voss: `<rect width="80" height="80" fill="#2a1420"/><path d="M18 80c2-16 12-24 22-24s20 8 22 24" fill="#5a2d36"/>
      <rect x="27" y="20" width="26" height="30" rx="11" fill="#e9b9a0"/><path d="M26 26c2-10 26-10 28 0v-6c-4-8-24-8-28 0z" fill="#8f8a92"/>
      <rect x="31" y="33" width="7" height="2.5" fill="#2a1420"/><rect x="43" y="33" width="7" height="2.5" fill="#2a1420"/><path d="M34 43h12" stroke="#7a3b3b" stroke-width="2"/>
      <path d="M33 56l7 6 7-6" fill="none" stroke="${c}" stroke-width="2"/>`,
    okoro: `<rect width="80" height="80" fill="#24180e"/><path d="M16 80c2-17 13-25 24-25s22 8 24 25" fill="#4b3a6b"/>
      <circle cx="40" cy="22" r="15" fill="#2b1d16"/><rect x="28" y="22" width="24" height="28" rx="11" fill="#9a6a4a"/>
      <circle cx="34" cy="34" r="5" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="46" cy="34" r="5" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M39 34h2" stroke="${c}" stroke-width="1.6"/>
      <path d="M35 43q5 3 10 0" stroke="#3b2418" stroke-width="2" fill="none"/><g opacity=".35"><rect y="10" width="80" height="2" fill="#fff"/><rect y="48" width="80" height="1" fill="#fff"/></g>`,
    reyes: `<rect width="80" height="80" fill="#0e2219"/><path d="M17 80c2-16 12-24 23-24s21 8 23 24" fill="#1f5a44"/>
      <rect x="28" y="20" width="24" height="30" rx="11" fill="#c98f6b"/><path d="M26 30c-2-14 30-16 28 0c0-6-6-10-14-10s-12 4-14 10z" fill="#1a1a1a"/>
      <rect x="32" y="33" width="5" height="2.5" fill="#1a1a1a"/><rect x="43" y="33" width="5" height="2.5" fill="#1a1a1a"/><path d="M35 43q5 2 10 0" stroke="#6b3b2b" stroke-width="2" fill="none"/>
      <circle cx="40" cy="62" r="3" fill="${c}"/>`,
    sys: `<rect width="80" height="80" fill="#160f2a"/><path d="M20 50l10-14 8 9 10-18 12 23" fill="none" stroke="${c}" stroke-width="3"/>`,
  };
  return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">${faces[id] || faces.sys}</svg>`;
}

let el = null;
function ensure() {
  if (el) return el;
  el = h('div', { id: 'dialog', class: 'hud-card hidden' },
    h('div', { class: 'portrait' }), h('div', { class: 'body' }, h('div', { class: 'who' }), h('div', { class: 'line' }), h('div', { class: 'choices' })), h('div', { class: 'next' }, 'click / space ▸'));
  el.style.position = 'fixed';
  document.body.append(el);
  return el;
}

let advanceCb = null;
window.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && advanceCb && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); advanceCb(); } });

// say(id, text) — resolves when the player advances. Text may contain <em>/<strong>.
export function say(id, text) {
  const d = ensure();
  d.classList.remove('hidden');
  const who = CAST[id];
  d.querySelector('.portrait').innerHTML = portrait(id);
  d.querySelector('.who').innerHTML = `<b style="color:${who.color}">${who.name}</b><span>${who.role}</span>`;
  d.querySelector('.choices').replaceChildren();
  d.querySelector('.next').style.display = '';
  const line = d.querySelector('.line');
  return new Promise((res) => {
    // typewriter on text nodes while preserving markup
    const tmp = document.createElement('div'); tmp.innerHTML = text;
    const full = tmp.innerHTML; const plainLen = tmp.textContent.length;
    let shown = 0, done = false;
    line.innerHTML = '';
    const tick = () => {
      if (done) return;
      shown += 2;
      if (shown >= plainLen) { line.innerHTML = full; done = true; return; }
      line.innerHTML = truncateHTML(full, shown);
      if (shown % 6 === 0) audio.tone(id === 'tally' ? 1500 : id === 'voss' ? 300 : 620, 0.03, 'square', 0.012);
      requestAnimationFrame(tick);
    };
    tick();
    const advance = () => {
      if (!done) { done = true; line.innerHTML = full; return; }
      advanceCb = null; d.onclick = null; res();
    };
    setTimeout(() => { advanceCb = advance; d.onclick = advance; }, 120);
  });
}

export async function talk(lines) { for (const [id, t] of lines) await say(id, t); hideDialog(); }

// choose(id, text, options[]) → resolves with option index
export function choose(id, text, options) {
  const d = ensure();
  d.classList.remove('hidden');
  const who = CAST[id];
  d.querySelector('.portrait').innerHTML = portrait(id);
  d.querySelector('.who').innerHTML = `<b style="color:${who.color}">${who.name}</b><span>${who.role}</span>`;
  d.querySelector('.line').innerHTML = text;
  d.querySelector('.next').style.display = 'none';
  d.onclick = null; advanceCb = null;
  return new Promise((res) => {
    const ch = d.querySelector('.choices');
    ch.replaceChildren(...options.map((o, i) => h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); audio.blip(); ch.replaceChildren(); res(i); } }, `${i + 1}. ${o}`)));
  });
}

export function hideDialog() { if (el) el.classList.add('hidden'); advanceCb = null; }

function truncateHTML(html, n) {
  let out = '', count = 0, i = 0;
  while (i < html.length && count < n) {
    if (html[i] === '<') { const j = html.indexOf('>', i); out += html.slice(i, j + 1); i = j + 1; continue; }
    if (html[i] === '&') { const j = html.indexOf(';', i); out += html.slice(i, j + 1); i = j + 1; count++; continue; }
    out += html[i++]; count++;
  }
  // close any open tags
  const open = [...out.matchAll(/<(\w+)[^>]*>/g)].map((m) => m[1]);
  const closed = [...out.matchAll(/<\/(\w+)>/g)].map((m) => m[1]);
  for (const c of closed) { const k = open.lastIndexOf(c); if (k >= 0) open.splice(k, 1); }
  return out + open.reverse().filter((t) => !['br', 'img'].includes(t)).map((t) => `</${t}>`).join('');
}
