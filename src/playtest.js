// Playtest dashboard: load results files from peers → learning gain, paired t-test, per-concept gains,
// decision stats, ratings and comments. Export a CSV for the project report.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/instrument-serif/400.css';
import './style.css';
import { h, btn } from './ui/dom.js';
import { Plot, C, canvasEl } from './ui/charts.js';
import { mean, sd, pairedT, fmt, pct } from './stats/stats.js';
import { archivedSessions } from './state.js';

document.documentElement.style.overflow = 'auto';
document.body.style.overflow = 'auto';
const app = document.getElementById('app');
app.style.cssText = 'max-width:1100px;margin:0 auto;padding:36px 20px 80px';
let records = [];

const CONCEPTS = ['Sampling bias', 'CLT', 'SE & n', 'p-value', 'α / Type I-II', 'Least squares', 'R²', 'Simpson', 'Corr ≠ cause'];

function header() {
  const file = h('input', { type: 'file', accept: '.json,application/json', multiple: true, style: { display: 'none' }, onchange: (e) => loadFiles(e.target.files) });
  const drop = h('div', { class: 'card', style: { textAlign: 'center', padding: '28px', borderStyle: 'dashed', cursor: 'pointer' }, onclick: () => file.click() },
    h('div', { style: { fontSize: '16px' } }, 'Drop results files here (halcyon-*.json), or click to choose'),
    h('div', { class: 'tiny', style: { marginTop: '6px' } }, 'Files stay in your browser. Nothing is uploaded.'));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = 'var(--cyan)'; });
  drop.addEventListener('drop', (e) => { e.preventDefault(); loadFiles(e.dataTransfer.files); });
  return h('div', {},
    h('div', { style: { fontFamily: 'var(--mono)', fontSize: '12px', letterSpacing: '.3em', color: 'var(--amber)' } }, 'HALCYON · PLAYTEST REPORT'),
    h('h1', { style: { fontFamily: 'var(--serif)', fontWeight: 400, fontSize: '52px', margin: '8px 0 6px' } }, 'Evidence of learning'),
    h('p', { class: 'lead' }, 'Each player took a 9-item pre-test, played, then took a parallel post-test (forms A/B counterbalanced). Load their exported files to compute the gain.'),
    drop, file,
    h('div', { class: 'ctl' }, btn('Load sessions saved on this device', () => { add(archivedSessions()); }, 'sm'), btn('Clear', () => { records = []; render(); }, 'ghost sm')));
}

async function loadFiles(files) {
  const out = [];
  for (const f of files) { try { const j = JSON.parse(await f.text()); (Array.isArray(j) ? j : [j]).forEach((r) => r?.game === 'HALCYON' && out.push(r)); } catch { alert('Could not read ' + f.name); } }
  add(out);
}
function add(list) { for (const r of list) if (!records.find((x) => x.sessionId === r.sessionId)) records.push(r); render(); }

const body = h('div');
app.append(header(), body);

function render() {
  body.replaceChildren();
  if (!records.length) { body.append(h('p', { class: 'muted', style: { marginTop: '30px' } }, 'No sessions loaded yet.')); return; }
  const complete = records.filter((r) => r.pre && r.post);
  const pre = complete.map((r) => r.pre.score), post = complete.map((r) => r.post.score);
  const t = complete.length >= 2 ? pairedT(pre, post) : null;
  const gains = complete.map((r) => r.post.score - r.pre.score);
  const normGain = complete.map((r) => (r.post.score - r.pre.score) / Math.max(1, r.pre.of - r.pre.score));

  body.append(h('div', { class: 'stats', style: { marginTop: '24px' } },
    statEl('Players', records.length), statEl('Completed pre+post', complete.length),
    statEl('Mean pre', complete.length ? fmt(mean(pre), 2) + ' / 9' : '—'), statEl('Mean post', complete.length ? fmt(mean(post), 2) + ' / 9' : '—'),
    statEl('Mean gain', complete.length ? (mean(gains) >= 0 ? '+' : '') + fmt(mean(gains), 2) : '—'),
    statEl('Normalised gain ⟨g⟩', complete.length ? fmt(mean(normGain), 2) : '—'),
    statEl('Paired t', t ? `t(${t.df}) = ${fmt(t.t, 2)}` : 'n ≥ 2'), statEl('p (two-sided)', t ? (t.p < 0.001 ? '< 0.001' : fmt(t.p, 3)) : '—')));
  if (t) body.append(h('div', { class: 'callout cyan', html: `Paired t-test on post − pre: mean difference ${fmt(t.meanDiff, 2)} (SD ${fmt(t.sdDiff, 2)}), n = ${t.n}. ${t.p < 0.05 ? 'The improvement is statistically significant at α = 0.05.' : 'Not significant at α = 0.05 with this sample. More playtesters would raise the power.'} ⟨g⟩ is Hake’s normalised gain: the fraction of possible improvement achieved.` }));

  // per-player slope chart + per-concept bars
  const cv1 = canvasEl(280), cv2 = canvasEl(280);
  body.append(h('div', { class: 'grid2 even', style: { marginTop: '16px' } },
    h('div', { class: 'card' }, h('h3', {}, 'Each player: before → after'), cv1),
    h('div', { class: 'card' }, h('h3', {}, '% correct per concept'), cv2, h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: 'rgba(180,140,255,0.6)' } }), 'pre'), h('span', {}, h('i', { style: { background: C.cyan } }), 'post')))));
  requestAnimationFrame(() => {
    const p1 = new Plot(cv1, { height: 280, pad: { l: 40, r: 20, t: 14, b: 30 } }); p1.setDomain(-0.3, 1.3, 0, 9); p1.axes({ xticks: [] });
    p1.text(p1.sx(0), p1.pb + 14, 'pre-test', { px: true, align: 'center', color: C.text }); p1.text(p1.sx(1), p1.pb + 14, 'post-test', { px: true, align: 'center', color: C.text });
    complete.forEach((r) => { const j = (Math.random() - 0.5) * 0.15; p1.line(0, r.pre.score + j, 1, r.post.score + j, { color: r.post.score >= r.pre.score ? C.cyan : C.coral, width: 2, alpha: 0.7 }); p1.points([0, 1], [r.pre.score + j, r.post.score + j], { color: '#fff', r: 3 }); });
    if (complete.length) p1.line(0, mean(pre), 1, mean(post), { color: C.amber, width: 4 });
    const p2 = new Plot(cv2, { height: 280, pad: { l: 62, r: 10, t: 14, b: 66 } }); p2.setDomain(0, 9, 0, 100); p2.axes({ xticks: [], yfmt: (v) => v + '%' });
    for (let q = 0; q < 9; q++) {
      const a = complete.length ? 100 * mean(complete.map((r) => +r.pre.correct[q])) : 0, b = complete.length ? 100 * mean(complete.map((r) => +r.post.correct[q])) : 0;
      p2.bars([{ x0: q + 0.12, x1: q + 0.5, y: a, color: 'rgba(180,140,255,0.6)' }, { x0: q + 0.5, x1: q + 0.88, y: b, color: C.cyan }]);
      const c = p2.ctx; c.save(); c.translate(p2.sx(q + 0.5), p2.pb + 6); c.rotate(-0.6); c.fillStyle = C.text; c.font = '10.5px JetBrains Mono'; c.textAlign = 'right'; c.fillText(CONCEPTS[q], 0, 0); c.restore();
    }
  });

  // gameplay outcomes
  const ev = (k) => { const v = records.map((r) => r.evidence?.[k]).filter(Boolean); return `${v.filter((x) => x === 'good').length} strong · ${v.filter((x) => x === 'mid').length} partial · ${v.filter((x) => x === 'bad').length} weak`; };
  const d = (f) => records.map((r) => f(r.decisions || {})).filter((x) => x !== undefined && x !== null);
  const cltPred = d((x) => x.c1?.cltPrediction);
  const methods = d((x) => x.c1?.method);
  const h0 = d((x) => x.c2?.h0Correct);
  const ls = d((x) => x.c3?.modelUsed);
  const filt = d((x) => x.c4?.filter);
  const splitDome = d((x) => x.c4?.splitsTried?.includes('dome'));
  body.append(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, 'In-game behaviour'),
    h('table', { class: 'data' },
      row('Evidence I · Survey', ev('c1')), row('  CLT prediction "bell" before seeing it', share(cltPred, 'bell')), row('  Chose an unbiased survey method', share(methods.map((m) => m !== 'near'), true)),
      row('Evidence II · Static', ev('c2')), row('  Picked the correct H₀ first time', share(h0, true)),
      row('Evidence III · Geyser', ev('c3')), row('  Trusted the least-squares line', share(ls, 'ls')),
      row('Evidence IV · Blight', ev('c4')), row('  Explored the dome-size split', share(splitDome, true)), row('  Chose Filter A (correct)', share(filt, 'A')),
      row('Endings', ['dawn', 'holds', 'night'].map((e) => `${e}: ${records.filter((r) => r.ending?.ending === e).length}`).join(' · ')),
      row('Median minutes played', records.length ? String([...records.map((r) => r.minutesPlayed || 0)].sort((a, b) => a - b)[Math.floor(records.length / 2)]) : '—'))));

  // ratings & comments
  const fb = records.map((r) => r.feedback).filter((f) => f && !f.skipped);
  const avg = (k) => { const v = fb.map((f) => f[k]).filter((x) => typeof x === 'number'); return v.length ? `${fmt(mean(v), 2)} / 5 (n=${v.length})` : '—'; };
  body.append(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, 'Ratings'),
    h('table', { class: 'data' }, row('Fun', avg('fun')), row('Concepts were clear', avg('clarity')), row('Discovered ideas by playing', avg('discover')), row('My decisions mattered', avg('decisions')))));
  body.append(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, 'What players said'),
    ...records.filter((r) => r.feedback && (r.feedback.learned || r.feedback.confusing)).map((r) => h('div', { class: 'callout', style: { fontSize: '13.5px' } },
      h('b', {}, r.alias || r.sessionId), r.feedback.learned ? h('div', {}, '✓ Learned: ' + r.feedback.learned) : null, r.feedback.confusing ? h('div', { class: 'muted' }, '? Confusing: ' + r.feedback.confusing) : null))));

  // per-player table + CSV
  const tbl = h('table', { class: 'data' }, h('tr', {}, ...['Player', 'Pre form', 'Pre', 'Post', 'Gain', 'I', 'II', 'III', 'IV', 'Ending', 'Min'].map((x) => h('th', {}, x))),
    ...records.map((r) => h('tr', {}, h('td', {}, r.alias || r.sessionId), h('td', {}, r.pre?.form ?? '—'), h('td', {}, r.pre?.score ?? '—'), h('td', {}, r.post?.score ?? '—'),
      h('td', {}, r.pre && r.post ? String(r.post.score - r.pre.score) : '—'), ...['c1', 'c2', 'c3', 'c4'].map((k) => h('td', {}, r.evidence?.[k] ?? '—')), h('td', {}, r.ending?.ending ?? '—'), h('td', {}, r.minutesPlayed ?? '—'))));
  body.append(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, 'Players', btn('Download CSV', () => csv(), 'sm')), tbl));
}

function share(arr, val) { if (!arr.length) return '—'; const k = arr.filter((x) => x === val).length; return `${k}/${arr.length} (${pct(k / arr.length, 0)})`; }
function row(k, v) { return h('tr', {}, h('td', {}, k), h('td', {}, v)); }
function statEl(k, v) { return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '16px' } }, String(v))); }

function csv() {
  const cols = ['sessionId', 'alias', 'preForm', 'pre', 'post', 'gain', ...CONCEPTS.map((c) => 'pre_' + c), ...CONCEPTS.map((c) => 'post_' + c), 'c1', 'c2', 'c3', 'c4', 'ending', 'minutes', 'fun', 'clarity', 'discover', 'decisions', 'learned', 'confusing'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.join(',')].concat(records.map((r) => [r.sessionId, r.alias, r.pre?.form, r.pre?.score, r.post?.score, r.pre && r.post ? r.post.score - r.pre.score : '',
    ...CONCEPTS.map((_, i) => (r.pre ? +r.pre.correct[i] : '')), ...CONCEPTS.map((_, i) => (r.post ? +r.post.correct[i] : '')),
    r.evidence?.c1, r.evidence?.c2, r.evidence?.c3, r.evidence?.c4, r.ending?.ending, r.minutesPlayed, r.feedback?.fun, r.feedback?.clarity, r.feedback?.discover, r.feedback?.decisions, r.feedback?.learned, r.feedback?.confusing].map(esc).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'halcyon-playtest.csv'; a.click();
}
render();
