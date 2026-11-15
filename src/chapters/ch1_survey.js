// CHAPTER I — SURVEY
// Concepts: population vs sample, sampling bias (convenience sampling), simple random vs stratified sampling,
// skew (mean vs median), the Central Limit Theorem, standard error ∝ 1/√n, 95% confidence intervals.
import * as THREE from 'three';
import { yieldAt, heightAt, insideMap, inRift, inBasin, stratumOf, STRATA } from '../engine/geo.js';
import { mean, median, sd, histogram, meanCI, fmt, quantile } from '../stats/stats.js';
import { h, openPanel, btn, seg, stat, objectives, sleep } from '../ui/dom.js';
import { Plot, C, canvasEl } from '../ui/charts.js';
import { say, talk, choose, hideDialog } from '../ui/dialog.js';
import { game, decide, log, spendHours, save } from '../state.js';
import { audio } from '../engine/audio.js';
import { makeLabel, ring } from '../engine/fx.js';

export const THRESHOLD = 15; // kg/m³ — minimum mean yield for the colony to stay viable
const BUDGET = 200;
const COST = { near: 1, random: 5, strat: 5 };
const NEAR_R = 60;

// ---------- The population: every 6 m × 6 m deposit cell on Veyra's surveyable surface ----------
let POP = null;
export function population() {
  if (POP) return POP;
  const xs = [], zs = [], v = [], st = [];
  for (let x = -300; x <= 300; x += 6) for (let z = -300; z <= 300; z += 6) {
    if (!insideMap(x, z) || inRift(x, z) || inBasin(x, z) || Math.hypot(x, z) < 30) continue;
    xs.push(x); zs.push(z); v.push(yieldAt(x, z)); st.push(stratumOf(x, z));
  }
  const N = v.length;
  const strata = STRATA.map((s, k) => { const idx = []; st.forEach((q, i) => q === k && idx.push(i)); return { ...s, idx, W: idx.length / N }; });
  const nearIdx = []; for (let i = 0; i < N; i++) if (Math.hypot(xs[i], zs[i]) < NEAR_R) nearIdx.push(i);
  POP = { xs, zs, v, st, N, strata, nearIdx, mu: mean(v), med: median(v), sigma: sd(v, false) };
  return POP;
}

// Draw a sample with a given method. Returns { idx, values, est, se, lo, hi }
export function drawSample(method, n, rng) {
  const P = population();
  if (method === 'strat') {
    // proportional allocation, at least 2 per stratum
    let alloc = P.strata.map((s) => Math.max(2, Math.round(s.W * n)));
    let diff = n - alloc.reduce((a, b) => a + b, 0);
    while (diff !== 0) { const k = alloc.indexOf(diff > 0 ? Math.min(...alloc) : Math.max(...alloc)); alloc[k] += Math.sign(diff); diff -= Math.sign(diff); }
    const idx = []; let est = 0, varSum = 0;
    P.strata.forEach((s, k) => {
      const pick = rng.sampleIndices(s.idx.length, alloc[k]).map((j) => s.idx[j]);
      idx.push(...pick);
      const vals = pick.map((i) => P.v[i]);
      est += s.W * mean(vals); varSum += (s.W ** 2) * (sd(vals) ** 2) / vals.length;
    });
    const se = Math.sqrt(varSum);
    return { idx, values: idx.map((i) => P.v[i]), est, se, lo: est - 1.96 * se, hi: est + 1.96 * se, method, n };
  }
  const frame = method === 'near' ? P.nearIdx : null;
  const idx = frame ? rng.sampleIndices(frame.length, n).map((j) => frame[j]) : rng.sampleIndices(P.N, n);
  const values = idx.map((i) => P.v[i]);
  const ci = meanCI(values);
  return { idx, values, est: ci.mean, se: ci.se, lo: ci.lo, hi: ci.hi, method, n };
}

const METHOD_LABEL = { near: 'Near base (Voss)', random: 'Simple random', strat: 'Stratified' };

// ------------------------------------------------------------------ chapter flow
export async function chapter1(ctx) {
  const P = population();
  const rng = game.rng;
  const voss = drawSample('near', 34, rng);
  decide('c1', { vossMean: voss.est, vossN: 34 });
  log('c1_start');

  await talk([
    ['voss', `My survey team took <strong>34 core samples</strong>. Mean crystal yield: <strong>${fmt(voss.est, 1)} kg/m³</strong>. The colony needs at least <strong>${THRESHOLD}</strong> to pay for its own air. The numbers are clear: Halcyon is finished.`],
    ['tally', `Before we accept that, let’s take our own readings. Drive anywhere you like and press <em>F</em> to drop a probe. We have <em>8 probes</em>.`],
    ['tally', `Watch the crystals as you drive. Bright clusters usually mean rich regolith.`],
  ]);

  await fieldProbes(ctx, 8);

  const near = ctx.probes.filter((p) => Math.hypot(p.x, p.z) < 90).map((p) => p.v);
  const far = ctx.probes.filter((p) => Math.hypot(p.x, p.z) >= 90).map((p) => p.v);
  const lines = [['tally', `Eight readings in. Your probes average <em>${fmt(mean(ctx.probes.map((p) => p.v)), 1)} kg/m³</em>, and Voss’s average ${fmt(voss.est, 1)}.`]];
  if (near.length && far.length) lines.push(['tally', `Look at <em>where</em> you took them. Your probes within 90 m of base average <em>${fmt(mean(near), 1)}</em>. Farther out they average <em>${fmt(mean(far), 1)}</em>. Where did Voss’s team sample?`]);
  else if (!far.length) lines.push(['tally', `All your probes were close to base, just like Voss’s. Is the regolith near home typical of the whole moon? Decades of mining happened right here.`]);
  else lines.push(['tally', `All your probes were far from base. Voss’s team never left the base perimeter, and decades of mining happened right here.`]);
  lines.push(['okoro', `<em>[Recorded log]</em> Whoever finds this: the Survey Depot still runs my sampling simulator. Eight probes can’t settle anything, but the simulator can show you how a sampling <em>method</em> behaves before you spend real drones on it.`]);
  await talk(lines);
  decide('c1', { fieldProbes: ctx.probes.map((p) => ({ x: Math.round(p.x), z: Math.round(p.z), v: +p.v.toFixed(2) })) });

  const result = await samplingLab(ctx, voss);
  return result;
}

// ------------------------------------------------------------------ phase 1: drive & probe
function fieldProbes(ctx, total) {
  const { world, rover, hud, input } = ctx;
  ctx.probes = [];
  const box = h('div', { id: 'probebox', class: 'hud-card' });
  const cv = h('canvas');
  const rows = { n: h('b'), last: h('b'), mean: h('b'), med: h('b') };
  box.append(h('h4', {}, 'Field probes'),
    h('div', { class: 'row' }, 'Probes used', rows.n), h('div', { class: 'row' }, 'Last reading', rows.last),
    h('div', { class: 'row' }, 'Sample mean', rows.mean), h('div', { class: 'row' }, 'Sample median', rows.med), cv,
    h('div', { class: 'tiny', style: { marginTop: '4px' } }, 'Press F to drop a probe where the rover stands'));
  hud.root.append(box);
  const plot = new Plot(cv, { height: 70, pad: { l: 6, r: 6, t: 4, b: 12 } });
  const refresh = () => {
    const vals = ctx.probes.map((p) => p.v);
    rows.n.textContent = `${vals.length} / ${total}`;
    rows.last.textContent = vals.length ? fmt(vals[vals.length - 1], 1) + ' kg/m³' : '—';
    rows.mean.textContent = vals.length ? fmt(mean(vals), 1) : '—';
    rows.med.textContent = vals.length ? fmt(median(vals), 1) : '—';
    plot.clear(); plot.setDomain(0, 60, 0, Math.max(3, ...histogram(vals, 0, 60, 12).counts));
    plot.hist(histogram(vals, 0, 60, 12), C.cyan, { alpha: 0.85 });
    plot.vline(THRESHOLD, { color: C.red, dash: [3, 3], width: 1 });
    plot.text(2, 0, '0', { px: true, color: C.text, font: '9px JetBrains Mono' });
  };
  refresh();
  hud.setObjective(`Drive across Veyra and drop <b>${total}</b> probes with <kbd>F</kbd>. Try different areas.`);
  return new Promise((resolve) => {
    const off = ctx.addFrame(() => {
      if (input.hit('KeyF')) {
        const { x, z } = rover.pos;
        if (Math.hypot(x, z) < 34) { hud.toast('No open regolith under the base. Drive further out.'); audio.error(); return; }
        if (inRift(x, z) || inBasin(x, z)) { hud.toast('No crystal-bearing regolith here.'); audio.error(); return; }
        const v = yieldAt(x, z);
        ctx.probes.push({ x, z, v });
        hud.probes.push({ x, z, color: '#ffffff' });
        dropProbeFx(world, x, z, v);
        audio.probe(); log('c1_probe', { x: Math.round(x), z: Math.round(z), v: +v.toFixed(2) });
        refresh();
        if (ctx.probes.length >= total) { off(); setTimeout(() => { box.remove(); resolve(); }, 1400); }
      }
    });
  });
}

function dropProbeFx(world, x, z, v) {
  const y = heightAt(x, z);
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 3, 6), new THREE.MeshStandardMaterial({ color: '#efe9f7', metalness: 0.4, roughness: 0.4 }));
  rod.position.y = 1.5; g.add(rod);
  const col = v < THRESHOLD ? '#ff7a59' : v < 30 ? '#ffd28a' : '#5ff2ff';
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 3 }));
  tip.position.y = 3.1; g.add(tip);
  const label = makeLabel(`${v.toFixed(1)} kg/m³`, { border: col, size: 0.75 }); label.position.y = 5; g.add(label);
  g.position.set(x, y + 14, z); world.scene.add(g);
  let t = 0;
  const obj = { update: (dt) => { t += dt; g.position.y = Math.max(y, y + 14 - t * t * 40); if (g.position.y === y && !obj.landed) { obj.landed = true; ring(world, x, y, z, { color: col, maxR: 9 }); } } };
  world.animated.push(obj);
}

// ------------------------------------------------------------------ phase 2: the sampling lab
function samplingLab(ctx, voss) {
  const P = population();
  const rng = game.rng;
  return new Promise((resolve) => {
    const p = openPanel({ tag: 'Chapter I · Survey Depot', title: 'The Sampling Simulator' });
    let method = 'near', n = 30, last = null, means = [], peek = false, predicted = null, runs = 0, lastCovered = null;
    const tried = new Set();

    p.content.append(objectives([
      'Explain why a <b>biased</b> sample stays wrong no matter how large it gets',
      'Compare <b>convenience</b>, <b>simple random</b> and <b>stratified</b> sampling',
      'See the <b>Central Limit Theorem</b> in action: averages of skewed data form a bell curve',
      'Use <b>SE = s/√n</b> to build a 95% <b>confidence interval</b> and choose a sample size',
    ]));

    // left: map; right: controls
    const mapCv = canvasEl(340);
    const mapPlot = new Plot(mapCv, { height: 340, pad: { l: 4, r: 4, t: 4, b: 4 } });
    const methodSeg = seg([{ value: 'near', label: 'Near base · Voss' }, { value: 'random', label: 'Simple random' }, { value: 'strat', label: 'Stratified (4 regions)' }], method, (v) => { method = v; means = []; lastCovered = null; drawAll(); });
    const nLbl = h('span', { class: 'mono' }, n);
    const nSlider = h('input', { type: 'range', min: 5, max: 100, value: n, oninput: (e) => { n = +e.target.value; nLbl.textContent = n; means = []; lastCovered = null; drawAll(); } });
    const sMean = stat('Sample mean', '—'), sSd = stat('Sample s', '—'), sSe = stat('SE = s/√n', '—'), sCi = stat('95% CI', '—');
    const methodNote = h('div', { class: 'callout cyan', style: { fontSize: '13px' } });
    const right = h('div', { class: 'card' }, h('h3', {}, 'Sampling method'), methodSeg, methodNote,
      h('div', { class: 'ctl' }, h('label', {}, 'Sample size n'), nSlider, nLbl),
      h('div', { class: 'ctl' }, btn('Draw one sample', () => { last = drawSample(method, n, rng); tried.add(method); log('c1_draw', { method, n, est: last.est }); audio.blip(); drawAll(); }, 'primary'),
        btn('Repeat ×500 →', () => runMany(), '')),
      h('div', { class: 'stats' }, sMean, sSd, sSe, sCi));
    const left = h('div', { class: 'card' }, h('h3', {}, 'Survey map', h('span', { class: 'tiny' }, 'dots = sampled deposits')), mapCv,
      h('div', { class: 'legend' }, ...STRATA.map((s) => h('span', {}, h('i', { style: { background: s.color, opacity: 0.6 } }), s.name)), h('span', {}, h('i', { style: { background: '#fff', borderRadius: '50%' } }), 'your field probes')));

    const distCv = canvasEl(230);
    const distPlot = new Plot(distCv, { height: 230, xlabel: 'sample mean yield (kg/m³)', ylabel: 'count' });
    const popCv = canvasEl(230);
    const popPlot = new Plot(popCv, { height: 230, xlabel: 'deposit yield (kg/m³)', ylabel: 'deposits' });
    const peekBtn = btn('Peek at the truth', () => { peek = !peek; peekBtn.textContent = peek ? 'Hide the truth' : 'Peek at the truth'; log('c1_peek', { on: peek }); drawAll(); }, 'sm');
    const dMean = stat('Mean of means', '—'), dSd = stat('Spread of means', '—'), dTheory = stat('σ/√n (theory)', '—'), dCover = stat('CIs catching truth', '—');
    const cltBox = h('div');
    const bottom = h('div', { class: 'grid2 even', style: { marginTop: '14px' } },
      h('div', { class: 'card' }, h('h3', {}, 'Sampling distribution of the mean', h('span', {}, peekBtn)), distCv, h('div', { class: 'stats' }, dMean, dSd, dTheory, dCover), cltBox),
      h('div', { class: 'card' }, h('h3', {}, 'The population', h('span', { class: 'tiny' }, `${P.N.toLocaleString()} deposit cells`)), popCv, h('div', { class: 'tiny', style: { marginTop: '8px' }, html: 'Hidden until you peek. In the field you never see this. The simulator lets you check your methods against it.' })));

    p.content.append(h('div', { class: 'grid2' }, left, right), bottom);
    const reportBtn = btn('File my report →', () => report(), 'primary');
    p.setFooter(h('div', { class: 'note', html: 'Try every method and several sizes. When you’re ready, file your report.' }), reportBtn);

    function noteFor(m) {
      if (m === 'near') return `Voss’s method. Picks deposits within ${NEAR_R} m of base. It’s cheap (1 power per probe) because the drones barely fly.`;
      if (m === 'random') return 'Every deposit on the moon has the same chance of being picked. Costs 5 power per probe because the drones fly anywhere.';
      return 'Splits the moon into 4 regions and samples each in proportion to its area, then combines them with weights. Costs 5 power per probe.';
    }

    async function runMany() {
      if (predicted === null) {
        const k = await choose('tally', `Before we run 500 surveys: deposit yields are <em>right-skewed</em> (most are modest, a few are huge). If we plot the <em>averages</em> of 500 samples of size ${n}, what shape will they make?`,
          ['Right-skewed, just like the deposits', 'A symmetric bell curve', 'Flat: every average equally likely', 'I have no idea']);
        hideDialog();
        predicted = ['skewed', 'bell', 'flat', 'unsure'][k];
        decide('c1', { cltPrediction: predicted }); log('c1_clt_predict', { predicted });
      }
      means = []; let covered = 0; runs++;
      const all = [];
      for (let i = 0; i < 500; i++) { const s = drawSample(method, n, rng); all.push(s); }
      tried.add(method);
      // animate in
      for (let i = 0; i < 500; i += 25) { means.push(...all.slice(i, i + 25).map((s) => s.est)); last = all[i]; drawAll(); await sleep(28); }
      covered = all.filter((s) => s.lo <= P.mu && P.mu <= s.hi).length;
      lastCovered = covered;
      drawAll();
      log('c1_runmany', { method, n, meanOfMeans: mean(means), sdOfMeans: sd(means) });
      if (runs === 1) {
        const ok = predicted === 'bell';
        cltBox.replaceChildren(h('div', { class: 'callout ' + (ok ? 'good' : 'cyan'), html:
          (ok ? '<b>Correct!</b> ' : `You predicted <b>${predicted}</b>. Look again: `) +
          'the deposits are skewed, but the <b>averages</b> form a bell. That is the <b>Central Limit Theorem</b>. Its width is the <b>standard error</b>, σ/√n. Try changing n and watch the bell narrow or widen.' }));
      }
      if (method === 'near' && runs >= 1 && !tried.has('nearHint')) {
        tried.add('nearHint');
        cltBox.append(h('div', { class: 'callout bad', html: '<b>Notice:</b> the near-base bell is narrow, but where is it centred? Peek at the truth, then push n to 100. A bigger biased sample is still a biased sample.' }));
      }
    }

    function drawAll() {
      methodNote.textContent = noteFor(method);
      // stats
      if (last) {
        sMean.set(fmt(last.est, 1)); sSd.set(fmt(sd(last.values), 1)); sSe.set(fmt(last.se, 2));
        sCi.set(`${fmt(last.lo, 1)}<small> – </small>${fmt(last.hi, 1)}`);
      }
      // map
      const mp = mapPlot; const padX = Math.max(4, (mp.W - mp.H) / 2 + 4); mp.o.pad.l = mp.o.pad.r = padX; mp.setDomain(-300, 300, 300, -300); mp.clear();
      const c = mp.ctx;
      // strata background
      const cell = Math.max(2, (mp.pr - mp.pl) / 100); for (let i = 0; i < P.N; i++) { c.fillStyle = STRATA[P.st[i]].color; c.globalAlpha = 0.07 + Math.min(0.25, P.v[i] / 400); c.fillRect(mp.sx(P.xs[i]) - cell / 2, mp.sy(P.zs[i]) - cell / 2, cell, cell); }
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(255,93,108,0.6)'; c.setLineDash([4, 4]); c.beginPath(); c.arc(mp.sx(0), mp.sy(0), (NEAR_R / 600) * (mp.pr - mp.pl), 0, 7); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffb86b'; c.beginPath(); c.arc(mp.sx(0), mp.sy(0), 5, 0, 7); c.fill();
      mp.text(mp.sx(0) + 8, mp.sy(0) - 10, 'BASE', { px: true, color: '#ffb86b', font: '10px JetBrains Mono' });
      if (last) for (const i of last.idx) { const v = P.v[i]; c.fillStyle = v < THRESHOLD ? C.coral : v < 30 ? C.amber : C.cyan; c.beginPath(); c.arc(mp.sx(P.xs[i]), mp.sy(P.zs[i]), 3.4, 0, 7); c.fill(); }
      for (const pr of ctx.probes || []) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(mp.sx(pr.x), mp.sy(pr.z), 5, 0, 7); c.stroke(); }
      // sampling distribution
      const dp = distPlot; dp.clear();
      const H = histogram(means, 0, 40, 64);
      dp.setDomain(0, 40, 0, Math.max(10, ...H.counts) * 1.15);
      dp.axes({ xticks: [0, 5, 10, 15, 20, 25, 30, 35, 40] });
      dp.shadeX(0, THRESHOLD, 'rgba(255,93,108,0.06)');
      dp.hist(H, method === 'near' ? C.coral : method === 'random' ? C.cyan : C.violet, { alpha: 0.9 });
      dp.vline(THRESHOLD, { color: C.red, dash: [5, 4], label: `viability ${THRESHOLD}`, top: false, width: 1.5 });
      dp.vline(voss.est, { color: C.coral, dash: [2, 3], width: 1, label: 'Voss' });
      if (peek) dp.vline(P.mu, { color: C.green, label: `truth μ = ${fmt(P.mu, 1)}` });
      if (means.length > 1) {
        dMean.set(fmt(mean(means), 2)); dSd.set(fmt(sd(means), 2));
        dTheory.set(peek ? fmt(method === 'near' ? sd(P.nearIdx.map((i) => P.v[i]), false) / Math.sqrt(n) : P.sigma / Math.sqrt(n), 2) : '<small>needs σ (peek)</small>');
        dCover.set(lastCovered == null ? '—' : peek ? `${lastCovered}/500` : '<small>peek to check</small>');
      } else { dMean.set('—'); dSd.set('—'); dTheory.set('—'); dCover.set('—'); }
      // population
      const pp = popPlot; pp.clear();
      const PH = histogram(P.v, 0, 80, 64);
      pp.setDomain(0, 80, 0, Math.max(...PH.counts) * 1.1);
      pp.axes({});
      if (peek) {
        pp.hist(PH, C.violet, { alpha: 0.8 });
        pp.vline(P.mu, { color: C.green, label: `mean ${fmt(P.mu, 1)}` });
        pp.vline(P.med, { color: C.amber, label: `median ${fmt(P.med, 1)}`, top: false });
      } else {
        pp.text((pp.pl + pp.pr) / 2, (pp.pt + pp.pb) / 2, '[ hidden: peek at the truth ]', { px: true, align: 'center', color: C.text });
      }
    }
    requestAnimationFrame(() => { [mapPlot, distPlot, popPlot].forEach((q) => q.resize()); drawAll(); });

    // ---------- report ----------
    function report() {
      log('c1_lab_done', { tried: [...tried] });
      p.content.replaceChildren();
      p.setTitle('Your report to the Council', 'Chapter I · Survey');
      let rMethod = 'random', rN = 30, result = null, claim = null;
      const fieldSd = ctx.probes?.length > 2 ? sd(ctx.probes.map((q) => q.v)) : 12;
      const rmSeg = seg([{ value: 'near', label: `Near base · ${COST.near}/probe` }, { value: 'random', label: `Simple random · ${COST.random}/probe` }, { value: 'strat', label: `Stratified · ${COST.strat}/probe` }], rMethod, (v) => { rMethod = v; clampN(); upd(); });
      const rnLbl = h('span', { class: 'mono' }, rN);
      const rnSlider = h('input', { type: 'range', min: 5, max: 200, value: rN, oninput: (e) => { rN = +e.target.value; clampN(); upd(); } });
      const costS = stat('Power cost', '—'), marginS = stat('Expected ±', '—');
      function clampN() { const max = Math.floor(BUDGET / COST[rMethod]); rnSlider.max = max; if (rN > max) rN = max; rnSlider.value = rN; rnLbl.textContent = rN; }
      function upd() { costS.set(`${rN * COST[rMethod]}<small> / ${BUDGET}</small>`); marginS.set(`≈ ${fmt(1.96 * fieldSd / Math.sqrt(rN), 1)}`); }
      clampN(); upd();
      const resultBox = h('div');
      const dispatch = btn('Dispatch survey drones', async () => {
        dispatch.disabled = true; rmSeg.style.pointerEvents = 'none'; rnSlider.disabled = true;
        result = drawSample(rMethod, rN, rng);
        spendHours(rN * (rMethod === 'near' ? 0.01 : 0.06), 'survey drones');
        log('c1_dispatch', { method: rMethod, n: rN, est: result.est, lo: result.lo, hi: result.hi });
        audio.probe();
        resultBox.replaceChildren(h('div', { class: 'card' }, h('h3', {}, 'Drone survey results'),
          h('div', { class: 'stats' }, stat('Estimate', fmt(result.est, 2)), stat('SE', fmt(result.se, 2)), stat('95% CI', `${fmt(result.lo, 1)} – ${fmt(result.hi, 1)}`), stat('Threshold', THRESHOLD)),
          ciStrip(result), h('p', { class: 'lead', style: { marginTop: '12px' } }, 'What will you tell the Council about the moon-wide mean yield?'),
          h('div', { class: 'opt-list' },
            btn(`The mean yield is above ${THRESHOLD}. Halcyon is viable.`, () => finish('above')),
            btn(`The mean yield is below ${THRESHOLD}. Voss is right.`, () => finish('below')),
            btn(`The data can’t tell yet: the interval includes ${THRESHOLD}.`, () => finish('unclear')))));
      }, 'primary');
      p.content.append(
        h('p', { class: 'lead', html: `Voss reported <b>${fmt(voss.est, 1)}</b> from 34 near-base samples. You have <b>${BUDGET} power</b> for one real drone survey. Choose a method and a sample size. The Council will believe a claim only if your <b>95% confidence interval</b> supports it.` }),
        h('div', { class: 'card' }, h('h3', {}, 'Survey plan'), rmSeg,
          h('div', { class: 'ctl' }, h('label', {}, 'Sample size n'), rnSlider, rnLbl),
          h('div', { class: 'stats' }, costS, marginS),
          h('div', { class: 'tiny', style: { marginTop: '8px' } }, `Expected ± uses 1.96 × s/√n, with s = ${fmt(fieldSd, 1)} from your field probes.`),
          h('div', { class: 'ctl' }, dispatch)),
        resultBox);
      p.setFooter(h('div', { class: 'note' }, 'You only get one real survey, so choose carefully.'));

      function finish(c) {
        claim = c;
        const consistent = (c === 'above' && result.lo > THRESHOLD) || (c === 'below' && result.hi < THRESHOLD) || (c === 'unclear' && result.lo <= THRESHOLD && result.hi >= THRESHOLD);
        const unbiased = rMethod !== 'near';
        const caught = result.lo <= P.mu && P.mu <= result.hi;
        let tier = 'bad';
        if (unbiased && consistent && c === 'above') tier = 'good';
        else if (unbiased && (c === 'unclear' || c === 'above')) tier = 'mid';
        decide('c1', { method: rMethod, n: rN, est: result.est, lo: result.lo, hi: result.hi, claim: c, consistent, unbiased, truth: P.mu, caught, tier });
        log('c1_claim', { claim: c, tier });
        audio.chord(tier !== 'bad');
        const fb = [];
        fb.push(`<b>The truth:</b> the moon-wide mean is <b>${fmt(P.mu, 2)} kg/m³</b> (median ${fmt(P.med, 1)}; the right skew pulls the mean above the median). Your interval ${caught ? '<span class="good-t">caught it</span>' : '<span class="bad-t">missed it</span>'}.`);
        if (!unbiased) fb.push('<b>Your method was biased.</b> The near-base deposits were mined out decades ago, so no number of samples from there can represent the whole moon. Voss made exactly this mistake.');
        else if (rMethod === 'strat') fb.push('<b>Stratified sampling</b> guaranteed every region was represented. The regions have different average yields (the mined-out core is much poorer), and stratifying removes that between-region variation, so the SE is usually a little smaller than a simple random sample of the same size.');
        else fb.push('<b>Simple random sampling</b> gave every deposit an equal chance, so the estimate is unbiased. Its precision comes from n: SE = s/√n.');
        if (!consistent) fb.push(`<b>Your claim goes beyond your evidence.</b> Your 95% CI was ${fmt(result.lo, 1)}–${fmt(result.hi, 1)}. ${c === 'above' ? `It includes ${THRESHOLD}, so "above" isn’t established yet. A bigger n would shrink the interval.` : c === 'below' ? `It doesn’t lie entirely below ${THRESHOLD}.` : `It doesn’t include ${THRESHOLD}, so the data CAN tell.`}`);
        if (tier === 'mid' && consistent) fb.push('Honest, but weak: the interval was too wide to convince the Council. With SE ∝ 1/√n, roughly 4× the probes halves the width.');
        p.content.replaceChildren(
          h('div', { class: 'callout ' + (tier === 'good' ? 'good' : tier === 'mid' ? '' : 'bad'), html: `<div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Evidence I · ${tier === 'good' ? 'strong' : tier === 'mid' ? 'partial' : 'compromised'}</div>` + fb.map((f) => `<p style="margin:6px 0">${f}</p>`).join('') }),
          h('div', { class: 'card' }, h('h3', {}, 'Codex unlocked · Sampling & the CLT'),
            h('div', { class: 'formula' }, 'SE = s / √n      95% CI = mean ± 1.96·SE      stratified mean = Σ W_h · mean_h'),
            h('p', { class: 'tiny', style: { marginTop: '8px' } }, 'Bias is a property of the METHOD, not of n. Random selection removes bias. A larger n removes noise. The CLT says sample means are approximately normal even when the data are skewed.')));
        p.setFooter(btn('Continue', () => { p.close(); resolve({ tier }); }, 'primary'));
      }
    }
  });
}

// small visual: CI bar vs threshold
function ciStrip(r) {
  const cv = canvasEl(70);
  requestAnimationFrame(() => {
    const pl = new Plot(cv, { height: 70, pad: { l: 14, r: 14, t: 10, b: 22 } });
    pl.setDomain(0, 40, 0, 1); pl.axes({ yticks: [], xticks: [0, 10, 15, 20, 30, 40], gridY: false });
    pl.vline(THRESHOLD, { color: C.red, dash: [4, 4], width: 1.5 });
    pl.line(r.lo, 0.5, r.hi, 0.5, { color: C.cyan, width: 6 });
    pl.points([r.est], [0.5], { color: '#fff', r: 5, alpha: 1 });
  });
  return cv;
}
