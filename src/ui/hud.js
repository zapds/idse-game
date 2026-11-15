// Heads-up display: objective, evidence slots, clock, minimap, speed, prompts, toasts.
import { h } from './dom.js';
import { heightAt, SITES, riftX, inBasin } from '../engine/geo.js';
import { game } from '../state.js';

const MAP_PX = 512, MAP_WORLD = 640;

export class HUD {
  constructor() {
    this.root = h('div', { id: 'hud', class: 'hidden' });
    this.objective = h('div', { id: 'objective', class: 'hud-card' }, h('div', { class: 'lbl' }, 'Objective'), h('div', { class: 'txt' }), h('div', { class: 'dist' }));
    this.slots = ['I', 'II', 'III', 'IV'].map((n) => h('div', { class: 'slot', title: 'Evidence' }, n));
    this.evidence = h('div', { id: 'evidence', class: 'hud-card' }, h('div', { class: 'lbl' }, 'Evidence'), h('div', { class: 'slots' }, this.slots));
    this.clock = h('div', { id: 'clock', class: 'hud-card' }, h('div', { class: 'lbl' }, 'Council vote in'), h('div', { class: 'val' }));
    this.btnManual = h('button', { class: 'hud-card iconbtn', title: 'Field manual (C)' }, '?');
    this.btnMute = h('button', { class: 'hud-card iconbtn', title: 'Sound (N)' }, '♪');
    this.btnMenu = h('button', { class: 'hud-card iconbtn', title: 'Menu (Esc)' }, '≡');
    this.topright = h('div', { id: 'topright' }, this.clock, this.evidence, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, this.btnManual, this.btnMute, this.btnMenu));
    this.mapCv = h('canvas', { width: 400, height: 400 });
    this.minimap = h('div', { id: 'minimap', class: 'hud-card' }, this.mapCv);
    this.speedVal = h('div', { class: 'v' }, '0');
    this.speedo = h('div', { id: 'speedo', class: 'hud-card' }, h('div', {}, this.speedVal, h('div', { class: 'u' }, 'KM/H')),
      h('div', { class: 'keys', html: '<kbd>W A S D</kbd> drive &nbsp;<kbd>Shift</kbd> boost<br><kbd>E</kbd> interact &nbsp;<kbd>drag</kbd> look &nbsp;<kbd>C</kbd> manual' }));
    this.prompt = h('div', { id: 'prompt', class: 'hud-card hidden pulse' });
    this.toastBox = h('div', { id: 'toast' });
    this.root.append(this.objective, this.topright, this.minimap, this.speedo, this.prompt, this.toastBox);
    document.body.append(this.root);
    this.mapCtx = this.mapCv.getContext('2d');
    this.mapImg = this._renderMap();
    this.markers = []; // {x,z,color}
    this.probes = [];  // {x,z,v}
    this.target = null;
  }
  show(v = true) { this.root.classList.toggle('hidden', !v); }
  setObjective(text, target = null) { this.objective.querySelector('.txt').innerHTML = text; this.target = target; this.objective.querySelector('.dist').textContent = ''; }
  setPrompt(html) { if (!html) { this.prompt.classList.add('hidden'); this._p = null; return; } if (this._p !== html) { this.prompt.innerHTML = html; this._p = html; } this.prompt.classList.remove('hidden'); }
  toast(text, ms = 2600, color) {
    const t = h('div', { class: 'toast hud-card', style: { '--d': ms / 1000 + 's', borderColor: color || '' } }); t.innerHTML = text; this.toastBox.append(t);
    setTimeout(() => t.remove(), ms + 600);
  }
  refreshEvidence() {
    const ev = game.state?.evidence || {};
    ['c1', 'c2', 'c3', 'c4'].forEach((k, i) => { this.slots[i].className = 'slot ' + (ev[k] || ''); });
    const hl = game.state?.hoursLeft ?? 36; const hh = Math.floor(hl), mm = Math.round((hl - hh) * 60);
    this.clock.querySelector('.val').textContent = `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m`;
  }

  _renderMap() {
    const cv = document.createElement('canvas'); cv.width = cv.height = MAP_PX; const c = cv.getContext('2d');
    const img = c.createImageData(MAP_PX, MAP_PX);
    for (let j = 0; j < MAP_PX; j++) for (let i = 0; i < MAP_PX; i++) {
      const x = (i / MAP_PX - 0.5) * MAP_WORLD, z = (j / MAP_PX - 0.5) * MAP_WORLD;
      const hgt = heightAt(x, z);
      let r = 70 + hgt * 2.2, g = 56 + hgt * 1.8, b = 110 + hgt * 2.2;
      if (Math.abs(x - riftX(z)) < 12) { r = 120; g = 45; b = 50; }
      if (inBasin(x, z)) { r = 120; g = 170; b = 210; }
      const k = (j * MAP_PX + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // base footprint
    c.fillStyle = 'rgba(255,200,140,0.8)'; const p = (x) => (x / MAP_WORLD + 0.5) * MAP_PX;
    c.beginPath(); c.arc(p(0), p(0), 6, 0, 7); c.fill();
    c.beginPath(); c.arc(p(SITES.domes.x), p(SITES.domes.z), 5, 0, 7); c.fillStyle = 'rgba(125,255,178,0.8)'; c.fill();
    return cv;
  }

  drawMap(rx, rz, heading) {
    const c = this.mapCtx, S = 400, view = 240; // world units across
    const scale = S / view, k = MAP_PX / MAP_WORLD;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, 7); c.clip();
    c.fillStyle = '#120f2a'; c.fillRect(0, 0, S, S);
    const sx = ((rx / MAP_WORLD + 0.5) * MAP_PX) - view * k / 2, sz = ((rz / MAP_WORLD + 0.5) * MAP_PX) - view * k / 2;
    c.globalAlpha = 0.9; c.drawImage(this.mapImg, sx, sz, view * k, view * k, 0, 0, S, S); c.globalAlpha = 1;
    const toPx = (x, z) => [S / 2 + (x - rx) * scale, S / 2 + (z - rz) * scale];
    for (const p of this.probes) { const [px, pz] = toPx(p.x, p.z); c.fillStyle = p.color || '#5ff2ff'; c.beginPath(); c.arc(px, pz, 4, 0, 7); c.fill(); }
    for (const m of this.markers) {
      let [px, pz] = toPx(m.x, m.z); const dx = px - S / 2, dz = pz - S / 2, d = Math.hypot(dx, dz);
      const edge = S / 2 - 14; if (d > edge) { px = S / 2 + (dx / d) * edge; pz = S / 2 + (dz / d) * edge; }
      c.fillStyle = m.color; c.strokeStyle = '#0b0a1c'; c.lineWidth = 2;
      c.beginPath(); c.arc(px, pz, 8, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#0b0a1c'; c.font = 'bold 10px JetBrains Mono, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.label || '', px, pz + 0.5);
    }
    // rover arrow
    c.translate(S / 2, S / 2); c.rotate(-heading + Math.PI);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fill();
    c.restore();
    // ring
    c.strokeStyle = 'rgba(190,170,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 1, 0, 7); c.stroke();
    c.fillStyle = '#a69fc9'; c.font = '600 14px JetBrains Mono, monospace'; c.textAlign = 'center'; c.fillText('N', S / 2, 18);
  }

  update(rover) {
    this.speedVal.textContent = Math.round(Math.abs(rover.speed) * 3.6);
    this.drawMap(rover.pos.x, rover.pos.z, rover.heading);
    if (this.target) {
      const d = Math.hypot(this.target.x - rover.pos.x, this.target.z - rover.pos.z);
      this.objective.querySelector('.dist').textContent = d > 12 ? `▸ ${Math.round(d)} m to ${this.target.name || 'waypoint'}` : '';
    }
  }
}
