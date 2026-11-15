// Game state + playtest telemetry. Saved to localStorage (if available) and exportable as JSON
// so a playtest organiser can collect results from several peers.
import { RNG } from './stats/rng.js';

const KEY = 'halcyon.save.v1';
const LOG_KEY = 'halcyon.sessions.v1';

export function newState(alias = '') {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  return {
    version: 1,
    sessionId: Math.random().toString(36).slice(2, 10),
    alias: alias.trim().slice(0, 40),
    seed,
    startedAt: new Date().toISOString(),
    hoursLeft: 36, // hours until the Council vote
    chapter: 0,    // highest chapter unlocked (1..5)
    done: {},      // chapter id → true
    evidence: {},  // c1..c4 → 'good' | 'mid' | 'bad'
    decisions: {}, // per chapter detailed decisions & numbers
    events: [],    // timestamped telemetry
    pre: null, post: null, feedback: null, ending: null,
    rover: { x: 8, z: -62, heading: 0.68, damage: 0 },
  };
}

export const game = { state: null, rng: null };

export function startNew(alias) { game.state = newState(alias); game.rng = new RNG(game.state.seed); save(); return game.state; }

export function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    const s = JSON.parse(raw); if (s.version !== 1) return null; return s;
  } catch { return null; }
}
export function resume(s) { game.state = s; game.rng = new RNG(s.seed ^ (s.events.length * 2654435761)); }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(game.state)); } catch { /* storage unavailable: play continues */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }

export function log(type, data = {}) {
  if (!game.state) return;
  game.state.events.push({ t: Date.now(), type, ...data });
  save();
}

export function decide(chapter, data) {
  game.state.decisions[chapter] = { ...(game.state.decisions[chapter] || {}), ...data };
  save();
}

export function spendHours(h, why) { game.state.hoursLeft = Math.max(0, +(game.state.hoursLeft - h).toFixed(2)); log('time', { hours: h, why }); }

// Archive finished sessions on this device (useful for in-class playtesting on one laptop)
export function archiveSession() {
  try {
    const all = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const i = all.findIndex((s) => s.sessionId === game.state.sessionId);
    const rec = exportRecord();
    if (i >= 0) all[i] = rec; else all.push(rec);
    localStorage.setItem(LOG_KEY, JSON.stringify(all));
  } catch {}
}
export function archivedSessions() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } }

export function exportRecord() {
  const s = game.state;
  return {
    game: 'HALCYON', version: s.version, sessionId: s.sessionId, alias: s.alias, startedAt: s.startedAt, finishedAt: new Date().toISOString(),
    pre: s.pre, post: s.post, evidence: s.evidence, decisions: s.decisions, ending: s.ending, feedback: s.feedback,
    minutesPlayed: Math.round((Date.now() - new Date(s.startedAt).getTime()) / 60000),
    events: s.events,
  };
}

export function download(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
