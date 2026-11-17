// HALCYON — entry point: boot, title screen, game loop, chapter orchestration.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './style.css';
import * as THREE from 'three';
import { World } from './engine/world.js';
import { Rover } from './engine/rover.js';
import { Input } from './engine/input.js';
import { audio } from './engine/audio.js';
import { SITES, heightAt } from './engine/geo.js';
import { HUD } from './ui/hud.js';
import { h, btn, cinematic, panelOpen, sleep, openPanel } from './ui/dom.js';
import { talk, hideDialog } from './ui/dialog.js';
import { runTest } from './ui/tests.js';
import { openManual } from './ui/manual.js';
import { feedbackForm, resultsScreen } from './ui/feedback.js';
import { game, startNew, load, resume, save, log, clearSave } from './state.js';
import { chapter1, population } from './chapters/ch1_survey.js';
import { chapter2 } from './chapters/ch2_static.js';
import { chapter3 } from './chapters/ch3_geyser.js';
import { chapter4 } from './chapters/ch4_blight.js';
import { finale, recapPanel } from './chapters/finale.js';

const CHAPTERS = [
  null,
  { id: 'c1', n: 'I', name: 'Survey', site: SITES.depot, color: '#5ff2ff', run: chapter1, obj: 'Drive to the <b>Survey Depot</b> beacon (cyan) and press <kbd>E</kbd>.' },
  { id: 'c2', n: 'II', name: 'Static', site: SITES.post, color: '#ff7a59', run: chapter2, obj: 'Head east to the <b>Rift Listening Post</b> (orange beacon).' },
  { id: 'c3', n: 'III', name: 'Geyser Run', site: SITES.basinGate, color: '#bfe9ff', run: chapter3, obj: 'Drive north to the <b>Basin Gate</b>. Okoro’s beacon is beyond it.' },
  { id: 'c4', n: 'IV', name: 'Blight', site: SITES.domes, color: '#7dffb2', run: chapter4, obj: 'Return to the <b>Greenhouse Ring</b>, west of the base.' },
  { id: 'c5', n: 'V', name: 'The Council', site: { ...SITES.council, x: 0, z: 30, name: 'Council Hall' }, color: '#ffb86b', run: null, obj: 'All evidence gathered. Go to the <b>Council Hall</b> at the centre of the base.' },
];

let quality = 'high';
try { quality = localStorage.getItem('halcyon.quality') || 'high'; } catch {}

const canvas = document.getElementById('gl');
const world = new World(canvas, { quality });
const input = new Input(canvas);
const rover = new Rover(world, input);
const hud = new HUD();
population(); // precompute the survey population
world.followShadow(rover.pos);

let mode = 'title'; // title | play | busy
let cine = null; const cineCam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
const frameFns = new Set();
const ctx = {
  world, rover, hud, input, probes: [],
  addFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
  setCinematic(c) { cine = c; if (!c) cineCam.init = false; },
};

// beacons
const beacons = CHAPTERS.map((c) => (c ? world.addBeacon(c.site.x, c.site.z, c.color) : null));
beacons.forEach((b) => b && (b.active = false));

// ------------------------------------------------------------------ main loop
const clock = new THREE.Timer();
let t = 0, saveTimer = 0;
function loop() {
  clock.update(); const dt = Math.min(0.25, clock.getDelta()); t += dt;
  const dialogOpen = !document.getElementById('dialog')?.classList.contains('hidden') && !!document.getElementById('dialog');
  input.enabled = !panelOpen() && !dialogOpen;
  // fixed sub-steps keep driving & timers real-time even on slow machines
  const steps = Math.max(1, Math.ceil(dt / 0.034)), sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (mode !== 'title') {
      const canDrive = rover.controlEnabled && !panelOpen() && !dialogOpen;
      const was = rover.controlEnabled; rover.controlEnabled = canDrive; rover.update(sdt); rover.controlEnabled = was;
    }
    for (const fn of [...frameFns]) fn(sdt, t);
  }
  if (mode !== 'title') audio.engine(rover.controlEnabled && input.enabled ? rover.speed : 0);
  world.update(Math.min(dt, 0.05), t);
  // camera
  if (cine) {
    let pos, look;
    if (cine.orbit) {
      const o = cine.orbit, a = t * o.speed;
      pos = new THREE.Vector3(o.x + Math.cos(a) * o.r, o.y, o.z + Math.sin(a) * o.r); look = new THREE.Vector3(o.x, o.lookY ?? 0, o.z);
    } else { pos = cine.pos; look = cine.look; }
    if (!cineCam.init) { cineCam.pos.copy(world.camera.position); cineCam.look.copy(look); cineCam.init = true; }
    cineCam.pos.lerp(pos, 1 - Math.exp(-dt * (cine.orbit ? 3 : 1.6))); cineCam.look.lerp(look, 1 - Math.exp(-dt * 3));
    world.camera.position.copy(cineCam.pos); world.camera.lookAt(cineCam.look);
  } else rover.updateCamera(dt, world.camera);
  world.followShadow(rover.pos);
  if (mode !== 'title') { hud.update(rover); checkBeacons(); hotkeys(); }
  saveTimer += dt;
  if (saveTimer > 4 && game.state && mode !== 'title') { saveTimer = 0; Object.assign(game.state.rover, { x: rover.pos.x, z: rover.pos.z, heading: rover.heading, damage: rover.damage }); save(); }
  world.render();
  input.endFrame();
  requestAnimationFrame(loop);
}

function hotkeys() {
  if (input.hit('KeyC') || (!panelOpen() && false)) openManual();
  if (input.hit('KeyN')) toggleMute();
  if (input.hit('Escape') && !panelOpen()) pauseMenu();
}
function toggleMute() { audio.setMuted(!audio.muted); hud.btnMute.textContent = audio.muted ? '✕' : '♪'; try { localStorage.setItem('halcyon.muted', audio.muted ? '1' : '0'); } catch {} }
hud.btnMute.onclick = toggleMute;
hud.btnManual.onclick = () => openManual();
hud.btnMenu.onclick = () => pauseMenu();
try { if (localStorage.getItem('halcyon.muted') === '1') { audio.muted = true; hud.btnMute.textContent = '✕'; } } catch {}

// ------------------------------------------------------------------ beacons / chapters
function currentChapter() { return game.state ? CHAPTERS[game.state.chapter] : null; }
function refreshObjective() {
  const c = currentChapter();
  beacons.forEach((b, i) => b && (b.active = game.state && i === game.state.chapter));
  hud.markers = c ? [{ x: c.site.x, z: c.site.z, color: c.color, label: c.n }] : [];
  if (c) hud.setObjective(c.obj, { x: c.site.x, z: c.site.z, name: c.site.name });
  hud.refreshEvidence();
}

function checkBeacons() {
  const c = currentChapter();
  if (!c || mode !== 'play') { hud.setPrompt(null); return; }
  const d = Math.hypot(rover.pos.x - c.site.x, rover.pos.z - c.site.z);
  if (d < 14 && !panelOpen()) {
    hud.setPrompt(`<kbd>E</kbd> Begin Chapter ${c.n} · <b>${c.name}</b>`);
    if (input.hit('KeyE')) startChapter(game.state.chapter);
  } else hud.setPrompt(null);
}

async function startChapter(k) {
  const c = CHAPTERS[k]; mode = 'busy'; hud.setPrompt(null);
  rover.speed = 0; audio.confirm();
  beacons[k].active = false; hud.markers = [];
  log('chapter_start', { k });
  if (k === 5) return runFinale();
  hud.setObjective(`Chapter ${c.n} · <b>${c.name}</b>: follow TALLY\u2019s instructions.`);
  await cinematic({ kicker: `Chapter ${c.n}`, title: c.name, ms: 2000 });
  let res;
  try { res = await c.run(ctx); }
  catch (err) { console.error(err); hideDialog(); res = { tier: 'mid', error: String(err) }; log('error', { k, err: String(err) }); }
  hideDialog();
  game.state.evidence[c.id] = res.tier;
  game.state.done[c.id] = true; game.state.chapter = k + 1; save();
  hud.toast(`Evidence ${c.n} secured · <b class="${res.tier === 'good' ? 'good-t' : res.tier === 'mid' ? 'amber-t' : 'bad-t'}">${res.tier === 'good' ? 'strong' : res.tier === 'mid' ? 'partial' : 'compromised'}</b>`, 3600);
  ctx.setCinematic(null); rover.controlEnabled = true;
  mode = 'play'; refreshObjective();
}

async function runFinale() {
  const res = await finale(ctx);
  hideDialog();
  ctx.setCinematic({ orbit: { x: 0, z: 0, r: 110, y: 40, speed: 0.03, lookY: 8 } });
  await recapPanel();
  await runTest('post');
  await feedbackForm();
  game.state.chapter = 6; save();
  resultsScreen({ onReplay: () => newGame(game.state.alias), onTitle: () => location.reload() });
}

// ------------------------------------------------------------------ pause
function pauseMenu() {
  if (mode === 'title') return;
  const p = openPanel({ tag: 'Paused', title: 'Halcyon', wide: false, closable: true });
  p.content.append(h('div', { class: 'opt-list' },
    btn('Resume', () => p.close(), 'primary'),
    btn('Field manual', () => { p.close(); openManual(); }),
    btn(`Graphics: ${quality === 'high' ? 'High' : 'Low'} (reloads)`, () => { try { localStorage.setItem('halcyon.quality', quality === 'high' ? 'low' : 'high'); } catch {} location.reload(); }),
    btn('Reset rover to base', () => { rover.teleport(8, -62, 0.68); p.close(); }),
    btn('Save & quit to title', () => { save(); location.reload(); }, 'ghost')),
    h('p', { class: 'tiny', style: { marginTop: '12px' } }, 'Progress saves automatically after each chapter. A chapter left half-way restarts from its beginning.'));
}

// ------------------------------------------------------------------ title & new game
let titleEl = null;
function toTitle() {
  mode = 'title'; hud.show(false); hideDialog();
  document.querySelectorAll('#panel-wrap').forEach((e) => e.remove());
  ctx.setCinematic({ orbit: { x: 0, z: 0, r: 150, y: 46, speed: 0.025, lookY: 10 } });
  if (titleEl) titleEl.remove();
  const saved = load();
  const canContinue = saved && saved.chapter >= 1 && saved.chapter <= 5;
  titleEl = h('div', { id: 'title' },
    h('div', { class: 'kicker' }, 'A statistics expedition · CS3006'),
    h('h1', {}, 'Halcyon'),
    h('div', { class: 'sub' }, 'The numbers say the colony must die. The numbers are lying.'),
    h('div', { class: 'topics' }, ...['sampling bias', 'central limit theorem', 'confidence intervals', 'hypothesis tests', 'type I / II errors', 'least squares', 'R²', 'simpson’s paradox', 'correlation ≠ causation'].map((x) => h('span', { class: 'chip' }, x))),
    h('div', { class: 'menu' },
      canContinue && btn(`Continue: Chapter ${CHAPTERS[saved.chapter].n} · ${CHAPTERS[saved.chapter].name}`, () => continueGame(saved), 'primary'),
      btn('New expedition', () => askAlias(), canContinue ? '' : 'primary'),
      btn('Field manual & learning objectives', () => openManual('play')),
      btn('Playtest dashboard (for organisers)', () => window.open('./playtest.html', '_blank'), 'ghost')),
    h('div', { class: 'foot' }, h('span', {}, 'WASD drive · E interact · F probe · C manual'), h('span', {}, 'Real data: Old Faithful (Yellowstone) · Charig et al. 1986')));
  document.body.append(titleEl);
}

function askAlias() {
  audio.init();
  const p = openPanel({ tag: 'New expedition', title: 'Who’s driving?', wide: false });
  const inp = h('input', { type: 'text', maxlength: 40, placeholder: 'Name or playtest ID (optional)', style: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--line-2)', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', font: '15px var(--font)' } });
  p.content.append(h('p', { class: 'lead' }, 'This label goes on your results file, so the organiser can match feedback. Leave it blank to stay anonymous.'), inp);
  const go = () => { p.close(); newGame(inp.value); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  p.setFooter(btn('Cancel', () => p.close(), 'ghost'), btn('Begin →', go, 'primary'));
  setTimeout(() => inp.focus(), 50);
}

async function newGame(alias = '') {
  audio.init();
  clearSave(); startNew(alias);
  titleEl?.remove(); titleEl = null;
  document.querySelectorAll('#panel-wrap').forEach((e) => e.remove());
  world.setDomeHealth([0.9, 0.88, 0.9, 0.7, 0.72]);
  hud.probes = []; rover.damage = 0;
  rover.teleport(8, -62, 0.68);
  mode = 'busy';
  await intro();
  game.state.chapter = 1; save();
  mode = 'play'; hud.show(true); refreshObjective();
}

function continueGame(s) {
  audio.init();
  resume(s);
  titleEl?.remove(); titleEl = null;
  const r = s.rover || {}; rover.teleport(r.x ?? 8, r.z ?? -62, r.heading ?? 0.68); rover.damage = r.damage || 0;
  world.setDomeHealth(s.done.c4 ? (s.decisions.c4?.filter === 'A' ? [0.97, 0.96, 0.97, 0.86, 0.85] : [0.88, 0.87, 0.86, 0.66, 0.68]) : [0.9, 0.88, 0.9, 0.7, 0.72]);
  ctx.setCinematic(null);
  mode = 'play'; hud.show(true); refreshObjective();
  log('resume', { chapter: s.chapter });
}

async function intro() {
  ctx.setCinematic({ pos: new THREE.Vector3(-60, 40, 120), look: new THREE.Vector3(0, 8, 0) });
  await cinematic({ kicker: 'Year 2291', title: 'Veyra, third moon of Thessaly', ms: 3000 });
  ctx.setCinematic({ pos: new THREE.Vector3(70, 22, 60), look: new THREE.Vector3(0, 6, 0) });
  await cinematic({ kicker: 'Halcyon colony', title: '2,400 people. One vote.', sub: 'Director Voss has filed for full evacuation. The Council votes in <b>36 hours</b>.', ms: 3800 });
  ctx.setCinematic(null);
  hud.show(true); hud.refreshEvidence();
  await talk([
    ['tally', 'Morning, Surveyor. KESTREL-7 is warmed up and I’m TALLY, your onboard analyst. Voss’s evacuation report hit the Council feed an hour ago.'],
    ['sys', '<b>DIRECTOR’S REPORT, SUMMARY:</b> (1) Crystal yield below viability. (2) Rift tremors are normal background. (3) Greenhouse blight: switch to Filter B and ban maintenance drones. <b>Recommendation: evacuate.</b>'],
    ['tally', 'Three claims, all built on numbers. Dr. Okoro, our chief statistician, went silent at the geyser basin two weeks ago. Her last message was: <em>"The numbers are lying, but not the way Voss thinks."</em>'],
    ['tally', 'Drive with <em>W A S D</em>, hold <em>Shift</em> to boost, drag the mouse to look around. Press <em>C</em> any time for the field manual. First stop: the <em>Survey Depot</em> beacon.'],
  ]);
}

// ------------------------------------------------------------------ boot
document.getElementById('loading')?.classList.add('fade');
setTimeout(() => { const l = document.getElementById('loading'); if (l) { l.style.opacity = '0'; setTimeout(() => l.remove(), 800); } }, 300);
window.addEventListener('pointerdown', () => audio.init(), { once: true });
toTitle();
requestAnimationFrame(loop);
if (new URLSearchParams(location.search).has('debug')) window.__h = { ctx, game, startChapter, newGame, refreshObjective, setMode: (m) => (mode = m), auto: (on = true) => { clearInterval(window.__adv); if (on) window.__adv = setInterval(() => document.getElementById('dialog')?.click(), 120); }, probe: async (pts) => { for (const [x, z] of pts) { rover.teleport(x, z, 0); await sleep(300); input.pressed.add('KeyF'); input.keys.add('KeyF'); await sleep(300); input.keys.delete('KeyF'); } } };
