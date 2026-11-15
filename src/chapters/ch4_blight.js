// CHAPTER IV — BLIGHT
// Concepts: confounding variables, Simpson's paradox (aggregated vs stratified comparison),
// correlation (Pearson r, Spearman ρ) is not causation, reverse causation, and why randomised trials help.
// DATA: the counts mirror a real study, Charig et al. (1986), BMJ, comparing two kidney-stone treatments
// (A = open surgery, B = percutaneous nephrolithotomy) stratified by stone size. Here: filters × dome size.
import { pearson, spearman, fmt, pct, mean } from '../stats/stats.js';
import { h, openPanel, btn, seg, stat, objectives } from '../ui/dom.js';
import { Plot, C, canvasEl } from '../ui/charts.js';
import { talk } from '../ui/dialog.js';
import { game, decide, log } from '../state.js';
import { audio } from '../engine/audio.js';

export const COUNTS = {
  small: { A: { healthy: 81, n: 87 }, B: { healthy: 234, n: 270 } },
  large: { A: { healthy: 192, n: 263 }, B: { healthy: 55, n: 80 } },
};

function buildRows(rng) {
  const rows = [];
  for (const dome of ['small', 'large']) for (const filter of ['A', 'B']) {
    const { healthy, n } = COUNTS[dome][filter];
    for (let i = 0; i < n; i++) rows.push({ dome, filter, healthy: i < healthy ? 1 : 0, shift: rng.random() < 0.5 ? 'Day' : 'Night' });
  }
  return rows;
}
function rate(rows) { return { n: rows.length, k: rows.reduce((s, r) => s + r.healthy, 0), get p() { return this.k / this.n; } }; }

export async function chapter4(ctx) {
  const rng = game.rng;
  const awake = game.state.evidence.c3 === 'good';
  log('c4_start');
  await talk([
    ['voss', 'The greenhouse numbers speak for themselves. Plots on <strong>Filter B</strong>: 83% healthy. <strong>Filter A</strong>: 78%. Swap every dome to B, today. And ban the maintenance drones: blight is worst wherever they fly.'],
    awake ? ['okoro', 'He pooled every dome together. Big domes are older, colder, harder to keep alive. Look at <em>which</em> domes got which filter before you believe a single percentage.']
      : ['tally', 'Okoro’s data core has a note pinned to this file: <em>"Pooled. Check dome size. Check who got which filter."</em>'],
  ]);

  const rows = buildRows(rng);
  const part1 = await simpsonLab(rows);
  const part2 = await droneLab(rng);
  const score = (part1.filter === 'A' ? 2 : 0) + (part1.reason === 0 ? 1 : 0) + (part2.choice === 1 || part2.choice === 3 ? 1 : 0);
  const tier = score >= 4 ? 'good' : score >= 2 ? 'mid' : 'bad';
  decide('c4', { score, tier }); log('c4_done', { score, tier });
  // the greenhouses respond to your decision
  const base = part1.filter === 'A' ? [0.97, 0.96, 0.97, 0.86, 0.85] : [0.88, 0.87, 0.86, 0.66, 0.68];
  const dronePenalty = part2.choice === 0 ? 0.25 : 0;
  ctx.world.setDomeHealth(base.map((v) => Math.max(0.2, v - dronePenalty)));
  audio.chord(tier !== 'bad');
  await new Promise((resolve) => {
    const p = openPanel({ tag: 'Chapter IV · Debrief', title: 'Two ways numbers lie', wide: false });
    p.content.append(
      h('div', { class: 'callout ' + (tier === 'good' ? 'good' : tier === 'mid' ? '' : 'bad'), html: `<div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Evidence IV · ${tier === 'good' ? 'strong' : tier === 'mid' ? 'partial' : 'compromised'}</div>` +
        (part1.filter === 'A' ? '<p style="margin:4px 0">You installed <b>Filter A</b>. Within <i>every</i> dome size it keeps more plots healthy. Over the next sols the green comes back.</p>' : '<p style="margin:4px 0">You installed <b>Filter B</b>. In small domes and in large domes alike, it does worse than A. Blight creeps through the big domes.</p>') +
        (part2.choice === 0 ? '<p style="margin:4px 0">With the drones banned, nobody responds when blight starts. It spreads unchecked.</p>' : '<p style="margin:4px 0">The drones keep flying toward blight, which is what they were built to do.</p>') }),
      h('div', { class: 'card' }, h('h3', {}, 'Codex unlocked · Confounding'),
        h('div', { class: 'formula' }, 'Overall: B 83% > A 78%      Small: A 93% > B 87%      Large: A 73% > B 69%'),
        h('p', { class: 'tiny', style: { marginTop: '8px' } }, 'Simpson’s paradox: a confounder (dome size) is linked to both the "treatment" (which filter) and the outcome (health). Pooling the groups reverses the comparison. These exact counts come from a real 1986 medical study of kidney-stone treatments (Charig et al., BMJ). Correlation alone never tells you which way cause flows.')));
    p.setFooter(btn('Continue', () => { p.close(); resolve(); }, 'primary'));
  });
  return { tier };
}

// ------------------------------------------------------------------ Part 1 — Simpson's paradox
function simpsonLab(rows) {
  return new Promise((resolve) => {
    const p = openPanel({ tag: 'Chapter IV · Greenhouse Ring', title: 'Which filter saves the crops?' });
    p.content.append(objectives([
      'Compare groups fairly by <b>stratifying</b> on a third variable',
      'Recognise <b>Simpson’s paradox</b>: a trend that reverses when groups are combined',
      'Identify a <b>confounder</b>: linked to both the treatment and the outcome',
    ]));
    let split = 'none', splits = new Set(['none']);
    const cv = canvasEl(300); const plot = new Plot(cv, { height: 300, ylabel: '% plots healthy', pad: { l: 50, r: 14, t: 18, b: 44 } });
    const table = h('table', { class: 'data' });
    const mixCv = canvasEl(170); const mix = new Plot(mixCv, { height: 170, pad: { l: 64, r: 14, t: 10, b: 28 } });
    const mixCard = h('div', { class: 'card hidden' }, h('h3', {}, 'Who got which filter?'), mixCv,
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: C.cyan } }), 'Filter A'), h('span', {}, h('i', { style: { background: C.amber } }), 'Filter B')));
    const splitSeg = seg([{ value: 'none', label: 'Filter only (Voss)' }, { value: 'dome', label: 'Filter × Dome size' }, { value: 'shift', label: 'Filter × Crew shift' }], 'none', (v) => { split = v; splits.add(v); log('c4_split', { v }); draw(); });
    const decideBox = h('div', { class: 'card' }, h('h3', {}, 'Decision'),
      h('p', { class: 'lead' }, 'Halcyon can only stock one filter type. Which one goes in every dome?'),
      h('div', { class: 'opt-list' }, btn('Install Filter A everywhere', () => pick('A')), btn('Install Filter B everywhere', () => pick('B'))));
    p.content.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, 'Plot health by filter', splitSeg), cv, table),
      h('div', {}, mixCard, decideBox)));

    function groups() {
      const keys = split === 'none' ? ['All plots'] : split === 'dome' ? ['small', 'large'] : ['Day', 'Night'];
      return keys.map((k) => ({ k, A: rate(rows.filter((r) => r.filter === 'A' && (split === 'none' || r[split] === k))), B: rate(rows.filter((r) => r.filter === 'B' && (split === 'none' || r[split] === k))) }));
    }
    function draw() {
      const G = groups();
      plot.resize(); plot.clear(); plot.setDomain(0, G.length, 50, 100); plot.axes({ xticks: [], yfmt: (v) => v + '%' });
      G.forEach((g, i) => {
        const cx = i + 0.5; const w = Math.min(0.18, 0.36 / G.length * 1.3);
        plot.bars([{ x0: cx - 2 * w, x1: cx - 0.02, y: 100 * g.A.p, color: C.cyan }, { x0: cx + 0.02, x1: cx + 2 * w, y: 100 * g.B.p, color: C.amber }]);
        plot.text(cx - w, 100 * g.A.p + 2, pct(g.A.p, 0), { align: 'center', color: C.cyan, font: '600 12px JetBrains Mono' });
        plot.text(cx + w, 100 * g.B.p + 2, pct(g.B.p, 0), { align: 'center', color: C.amber, font: '600 12px JetBrains Mono' });
        plot.text(plot.sx(cx), plot.pb + 18, g.k === 'small' ? 'Small domes' : g.k === 'large' ? 'Large domes' : g.k === 'All plots' ? 'All plots' : `${g.k} shift`, { px: true, align: 'center', color: C.textHi, font: '12px Space Grotesk' });
        plot.text(plot.sx(cx - w), plot.pb - 10, 'A', { px: true, align: 'center', color: '#0b0a1c', font: 'bold 11px JetBrains Mono' });
        plot.text(plot.sx(cx + w), plot.pb - 10, 'B', { px: true, align: 'center', color: '#0b0a1c', font: 'bold 11px JetBrains Mono' });
      });
      table.replaceChildren(h('tr', {}, h('th', {}, 'Group'), h('th', {}, 'A healthy / n'), h('th', {}, 'B healthy / n'), h('th', {}, 'Better')),
        ...G.map((g) => h('tr', {}, h('td', {}, g.k), h('td', {}, `${g.A.k} / ${g.A.n}`), h('td', {}, `${g.B.k} / ${g.B.n}`), h('td', { class: g.A.p > g.B.p ? 'cyan-t' : 'amber-t' }, g.A.p > g.B.p ? 'A' : 'B'))));
      // treatment mix
      mixCard.classList.toggle('hidden', split !== 'dome');
      if (split === 'dome') {
        mix.resize(); mix.clear(); mix.setDomain(0, 1, 0, 2); mix.axes({ yticks: [], xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => v * 100 + '%', gridY: false });
        [['small', 1.45], ['large', 0.55]].forEach(([d, y]) => {
          const a = COUNTS[d].A.n, b = COUNTS[d].B.n, t = a + b;
          mix.rect(0, y - 0.3, a / t, y + 0.3, C.cyan); mix.rect(a / t, y - 0.3, 1, y + 0.3, C.amber);
          mix.text(4, mix.sy(y), d === 'small' ? 'Small' : 'Large', { px: true, color: C.textHi });
          const hs = (COUNTS[d].A.healthy + COUNTS[d].B.healthy) / t;
          mix.text(mix.sx(0.98), mix.sy(y), `${d} domes: ${pct(hs, 0)} healthy overall`, { px: true, align: 'right', color: '#0b0a1c', font: '600 11px JetBrains Mono' });
        });
      }
    }
    requestAnimationFrame(draw);
    p.setFooter(h('div', { class: 'note', html: 'Try every way of splitting the data before you decide.' }));

    function pick(filter) {
      decide('c4', { filter, splitsTried: [...splits] }); log('c4_filter', { filter });
      audio.blip();
      decideBox.replaceChildren(h('h3', {}, 'One more question'),
        h('p', { class: 'lead' }, `Overall, B looks better (83% vs 78%). In small domes AND in large domes, A does better. How can both be true?`),
        h('div', { class: 'opt-list' },
          btn('B went mostly to small domes, which are healthier anyway. Dome size is a confounder.', () => why(0)),
          btn('It’s random chance: the differences are small', () => why(1)),
          btn('One of the tables must contain an error', () => why(2)),
          btn('Filters A and B interfere when used in the same colony', () => why(3))));
      function why(k) {
        decide('c4', { reason: k }); log('c4_reason', { k });
        p.close(); resolve({ filter, reason: k });
      }
    }
  });
}

// ------------------------------------------------------------------ Part 2 — correlation vs causation
function droneLab(rng) {
  // 48 growing sectors: blight severity drives drone dispatches (the alarm system sends drones to blight)
  const N = 48; const sev = [], visits = [], onset = [], firstVisit = [];
  for (let i = 0; i < N; i++) {
    const s = Math.min(1, Math.max(0, rng.normal(0.38, 0.22) + (rng.random() < 0.15 ? 0.35 : 0)));
    sev.push(+(s * 100).toFixed(1));
    visits.push(rng.poisson(0.6 + 9 * s));
    const t0 = rng.uniform(0, 70); onset.push(t0); firstVisit.push(t0 + rng.uniform(0.5, 9));
  }
  const r = pearson(visits, sev), rho = spearman(visits, sev);
  return new Promise((resolve) => {
    const p = openPanel({ tag: 'Chapter IV · Part 2', title: 'Do the drones spread blight?' });
    p.content.append(objectives([
      'Measure association with <b>Pearson r</b> and <b>Spearman ρ</b>',
      'Explain why <b>correlation does not imply causation</b>, and spot <b>reverse causation</b>',
    ]));
    let view = 'scatter';
    const cv = canvasEl(320); const plot = new Plot(cv, { height: 320, xlabel: 'drone visits to the sector (last 10 sols)', ylabel: 'blight severity (%)' });
    const vSeg = seg([{ value: 'scatter', label: 'Scatter (Voss)' }, { value: 'time', label: 'Event timeline' }], view, (v) => { view = v; log('c4_view', { v }); draw(); });
    const legend = h('div', { class: 'legend' });
    function draw() {
      plot.resize(); plot.clear();
      legend.replaceChildren(...(view === 'scatter'
        ? [h('span', {}, h('i', { style: { background: C.coral } }), 'one growing sector'), h('span', {}, h('i', { style: { background: C.amber, height: '2px' } }), 'trend line')]
        : [h('span', {}, h('i', { style: { background: C.coral } }), 'blight sensor first alarms'), h('span', {}, h('i', { style: { background: C.cyan } }), 'first drone arrives')]));
      if (view === 'scatter') {
        plot.o.xlabel = 'drone visits to the sector (last 10 sols)'; plot.o.ylabel = 'blight severity (%)';
        const xm = Math.max(...visits) + 1; plot.setDomain(-0.5, xm, 0, 100); plot.axes({});
        plot.points(visits, sev, { color: C.coral, r: 4.5 });
        const mx = mean(visits), my = mean(sev); let sxy = 0, sxx = 0; visits.forEach((x, i) => { sxy += (x - mx) * (sev[i] - my); sxx += (x - mx) ** 2; });
        const b1 = sxy / sxx, b0 = my - b1 * mx; plot.clip(() => plot.line(-0.5, b0 + b1 * -0.5, xm, b0 + b1 * xm, { color: C.amber, dash: [6, 4] }));
      } else {
        plot.o.xlabel = 'hours since start of the outbreak window'; plot.o.ylabel = 'sector';
        const K = 14; plot.setDomain(0, 85, 0, K + 1); plot.axes({ yticks: [] });
        for (let i = 0; i < K; i++) {
          const y = K - i; plot.line(0, y, 85, y, { color: 'rgba(190,170,255,0.12)', width: 1 });
          plot.points([onset[i]], [y], { color: C.coral, r: 6, alpha: 1 });
          plot.points([firstVisit[i]], [y], { color: C.cyan, r: 4, alpha: 1 });
          plot.line(onset[i], y, firstVisit[i], y, { color: 'rgba(255,255,255,0.4)', width: 1.5 });
        }
      }
    }
    requestAnimationFrame(draw);
    p.content.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, 'Sectors', vSeg), cv,
        legend),
      h('div', { class: 'card' }, h('h3', {}, 'Association'),
        h('div', { class: 'stats' }, stat('Pearson r', fmt(r, 2)), stat('Spearman rho', fmt(rho, 2)), stat('Sectors', N)),
        h('p', { class: 'lead', style: { marginTop: '12px' }, html: `Voss: <i>"r = ${fmt(r, 2)}. The more drones visit, the worse the blight. Ban them."</i> Look at the event timeline before you decide.` }),
        h('div', { class: 'opt-list' },
          btn('Ban the drones. The correlation proves they spread blight.', () => done(0)),
          btn('Keep the drones. They’re dispatched BECAUSE of blight (reverse causation).', () => done(1)),
          btn(`r = ${fmt(r, 2)} means about ${Math.round(r * 100)}% of the blight is caused by drones`, () => done(2)),
          btn('Keep them for now, and run a randomised trial to test them properly', () => done(3))))));
    p.setFooter(h('div', { class: 'note' }, 'Correlation measures how tightly two things move together. It says nothing about which one pushes the other.'));
    function done(choice) {
      decide('c4', { droneChoice: choice, r, rho }); log('c4_drones', { choice });
      p.close(); resolve({ choice });
    }
  });
}
