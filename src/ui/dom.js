// Tiny DOM helpers + modal panel + cinematic captions.
import { audio } from '../engine/audio.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);

export function btn(label, onClick, cls = '') {
  return h('button', { class: 'btn ' + cls, onclick: (e) => { audio.click(); onClick?.(e); } }, label);
}

// Segmented selector. options: [{value,label}] → returns element with .value
export function seg(options, initial, onChange) {
  const wrap = h('div', { class: 'seg' });
  wrap.value = initial;
  const buttons = options.map((o) => {
    const b = h('button', { class: 'btn sm' + (o.value === initial ? ' sel' : ''), onclick: () => {
      audio.click(); wrap.value = o.value; buttons.forEach((x) => x.classList.toggle('sel', x === b)); onChange?.(o.value);
    } }, o.label);
    return b;
  });
  wrap.append(...buttons);
  wrap.setValue = (v) => { wrap.value = v; buttons.forEach((x, i) => x.classList.toggle('sel', options[i].value === v)); };
  return wrap;
}

export function stat(k, v) {
  const el = h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }));
  el.set = (val) => { el.querySelector('.v').innerHTML = val; };
  el.set(v);
  return el;
}

export function objectives(items) {
  return h('div', { class: 'objectives' }, h('div', { class: 'lbl' }, 'Learning objectives'), h('ul', {}, items.map((t) => h('li', { html: t }))));
}

let panelStack = 0;
export function openPanel({ tag = '', title = '', wide = true, closable = false, onClose } = {}) {
  const wrap = h('div', { id: 'panel-wrap' });
  const content = h('div', { class: 'content' });
  const footer = h('footer');
  const header = h('header', {}, h('div', {}, h('div', { class: 'tag' }, tag), h('h2', {}, title)), h('div', { class: 'sp' }));
  const panel = h('div', { class: 'panel' }, header, content, footer);
  if (!wide) panel.style.width = 'min(760px, 100%)';
  wrap.append(panel);
  document.body.append(wrap);
  panelStack++;
  const api = {
    el: panel, content, footer, header,
    close() { wrap.remove(); panelStack--; onClose?.(); },
    setFooter(...nodes) { footer.replaceChildren(...nodes); },
    setTitle(t, tg) { header.querySelector('h2').textContent = t; if (tg != null) header.querySelector('.tag').textContent = tg; },
  };
  if (closable) header.append(btn('Close ✕', () => api.close(), 'ghost sm'));
  return api;
}
export const panelOpen = () => panelStack > 0;

export function cinematic({ kicker = '', title = '', sub = '', ms = 4200 }) {
  return new Promise((res) => {
    const el = h('div', { id: 'cine' }, h('div', { class: 'inner fade-in' },
      kicker && h('div', { class: 'k' }, kicker), h('div', { class: 't' }, title), sub && h('div', { class: 's', html: sub })));
    document.body.append(el);
    setTimeout(() => { el.style.transition = 'opacity .8s'; el.style.opacity = '0'; setTimeout(() => { el.remove(); res(); }, 800); }, ms);
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
