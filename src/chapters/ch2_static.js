// CHAPTER II — STATIC
// Concepts: null & alternative hypotheses, null distribution (Poisson for rare events in a fixed time),
// p-value as a tail probability, significance level α, rejection region,
// Type I (false alarm) vs Type II (missed effect) errors, power, and the α ↔ power trade-off.
import * as THREE from 'three';
import { poissonPMF, poissonSF, poissonCritical, fmt, pct } from '../stats/stats.js';
import { h, openPanel, btn, seg, stat, objectives, sleep, cinematic } from '../ui/dom.js';
import { Plot, C, canvasEl } from '../ui/charts.js';
import { talk, choose, hideDialog } from '../ui/dialog.js';
import { game, decide, log, spendHours } from '../state.js';
import { audio } from '../engine/audio.js';
import { ring } from '../engine/fx.js';
import { SITES, riftX, heightAt } from '../engine/geo.js';

export const LAMBDA0 = 3;   // background micro-tremor pulses per hour (10 years of records)
export const LAMBDA1 = 6;   // rate when the Rift is waking
const SEC_PER_HOUR = 7;     // real seconds per listening hour
const FISSURE = new THREE.Color('#ff7a45');

export async function chapter2(ctx) {
  const rng = game.rng;
  const waking = rng.random() < 0.5; // hidden truth for this playthrough
  decide('c2', { truthWaking: waking });
  log('c2_start');
  await talk([
    ['okoro', '<em>[Recorded log]</em> The Rift has hummed since before we landed: about <strong>3 micro-tremors an hour</strong>, ten years of records. If it ever <em>wakes</em>, the rate climbs before the big one. The East district sits on its lip.'],
    ['voss', 'Tremors are noise. If you sound an alarm, the East district is relocated in the middle of a storm because of a few blips. Don’t you dare cry wolf.'],
    ['tally', 'Both mistakes cost something. We need a rule that decides <em>before</em> we see the data. Let’s set up a hypothesis test.'],
  ]);

  const settings = await setupPanel(rng);
  // listen
  spendHours(settings.T, 'listening');
  const k = await listen(ctx, settings, waking ? LAMBDA1 : LAMBDA0, rng);
  return await resultPanel(ctx, settings, k, waking);
}

// ------------------------------------------------------------------ setup & simulator
function setupPanel(rng) {
  return new Promise((resolve) => {
    const p = openPanel({ tag: 'Chapter II · Rift Listening Post', title: 'Is the Rift waking?' });
    p.content.append(objectives([
      'State a <b>null hypothesis</b> (nothing unusual) and an <b>alternative</b>',
      'Use the <b>Poisson</b> distribution to model rare events in a fixed time window',
      'Read a <b>p-value</b> as a tail probability under H₀, and compare it with <b>α</b>',
      'Discover the trade-off between <b>Type I errors</b> (false alarms) and <b>Type II errors</b> (misses), and how more data raises <b>power</b>',
    ]));
    const step = h('div'); p.content.append(step);
    p.setFooter(h('div', { class: 'note' }, 'Step 1 of 2: choose the null hypothesis.'));

    step.append(h('div', { class: 'card' }, h('h3', {}, 'Step 1 · Which claim is the null hypothesis H₀?'),
      h('p', { class: 'lead' }, 'A hypothesis test assumes one claim is true and asks whether the data make that claim look unbelievable.'),
      h('div', { class: 'opt-list' },
        btn(`"The Rift is quiet: pulses arrive at the usual rate, λ = ${LAMBDA0} per hour."`, () => h0(true)),
        btn(`"The Rift is waking: pulses arrive faster than ${LAMBDA0} per hour."`, () => h0(false)))));

    function h0(correct) {
      decide('c2', { h0Correct: correct }); log('c2_h0', { correct });
      step.replaceChildren(h('div', { class: 'callout ' + (correct ? 'good' : 'cyan'), html: (correct ? '<b>Right.</b> ' : '<b>Not quite.</b> ') +
        `H₀ is the "nothing special is happening" claim, the one we can compute probabilities under: <b>H₀: λ = ${LAMBDA0}/hr</b>. The alternative is what we’re looking for evidence of: <b>H₁: λ > ${LAMBDA0}/hr</b> (one-sided, upper tail).` }));
      configure();
    }

    function configure() {
      let alpha = 0.05, T = 2;
      const trials = [];
      const aSeg = seg([{ value: 0.1, label: 'α = 0.10' }, { value: 0.05, label: 'α = 0.05' }, { value: 0.01, label: 'α = 0.01' }], alpha, (v) => { alpha = v; draw(); });
      const tSeg = seg([{ value: 1, label: '1 hour' }, { value: 2, label: '2 hours' }, { value: 4, label: '4 hours' }], T, (v) => { T = v; draw(); });
      const cv = canvasEl(250); const plot = new Plot(cv, { height: 250, xlabel: 'pulses counted in the window', ylabel: 'P(count | H₀)' });
      const kS = stat('Reject H₀ if count ≥', '—'), aS = stat('Exact α', '—'), eS = stat('Expected if quiet', '—');
      const simOut = h('div');
      const table = h('table', { class: 'data' });
      const sim = async (truthWaking) => {
        const lam = (truthWaking ? LAMBDA1 : LAMBDA0) * T; const kStar = poissonCritical(LAMBDA0 * T, alpha);
        let rej = 0; const N = 1000; for (let i = 0; i < N; i++) if (rng.poisson(lam) >= kStar) rej++;
        const rate = rej / N;
        trials.push({ alpha, T, kind: truthWaking ? 'waking' : 'quiet', rate });
        log('c2_sim', { alpha, T, waking: truthWaking, rate });
        audio.blip();
        simOut.replaceChildren(h('div', { class: 'callout ' + (truthWaking ? 'cyan' : ''), html: truthWaking
          ? `In 1,000 simulated <b>waking</b> nights (λ = ${LAMBDA1}/hr), your rule raised the alarm <b>${pct(rate)}</b> of the time. That is the test’s <b>power</b>. The other <b>${pct(1 - rate)}</b> are <b>Type II errors</b>: real danger missed.`
          : `In 1,000 simulated <b>quiet</b> nights (λ = ${LAMBDA0}/hr), your rule raised the alarm <b>${pct(rate)}</b> of the time. These are <b>Type I errors</b> (false alarms), and the rate stays at or below α = ${alpha}.` }));
        renderTable();
      };
      function renderTable() {
        const rows = {};
        for (const t of trials) { const key = `${t.alpha}|${t.T}`; rows[key] = rows[key] || { alpha: t.alpha, T: t.T }; rows[key][t.kind] = t.rate; }
        table.replaceChildren(h('tr', {}, h('th', {}, 'Rule'), h('th', {}, 'False alarms (quiet)'), h('th', {}, 'Power (waking)')),
          ...Object.values(rows).map((r) => h('tr', {}, h('td', {}, `α=${r.alpha}, ${r.T}h`), h('td', { class: 'amber-t' }, r.quiet != null ? pct(r.quiet) : '—'), h('td', { class: 'cyan-t' }, r.waking != null ? pct(r.waking) : '—'))));
      }
      function draw() {
        const lam = LAMBDA0 * T, kStar = poissonCritical(lam, alpha);
        const kmax = Math.ceil(LAMBDA1 * T + 4 * Math.sqrt(LAMBDA1 * T));
        kS.set(kStar); aS.set(fmt(poissonSF(kStar, lam), 4)); eS.set(fmt(lam, 0));
        plot.resize(); plot.clear();
        const pm = []; for (let k = 0; k <= kmax; k++) pm.push(poissonPMF(k, lam));
        plot.setDomain(-0.5, kmax + 0.5, 0, Math.max(...pm) * 1.18);
        plot.axes({ xticks: Array.from({ length: Math.floor(kmax / 2) + 1 }, (_, i) => i * 2), yfmt: (v) => v.toFixed(2) });
        plot.bars(pm.map((v, k) => ({ x0: k - 0.42, x1: k + 0.42, y: v, color: k >= kStar ? C.coral : C.violet })));
        // waking distribution overlay
        const xs = [], ys = []; for (let k = 0; k <= kmax; k++) { xs.push(k); ys.push(poissonPMF(k, LAMBDA1 * T)); }
        plot.path(xs, ys, { color: C.cyan, width: 2 });
        plot.vline(kStar - 0.5, { color: C.coral, dash: [5, 4], label: `reject region: ≥ ${kStar}` });
      }
      step.append(h('div', { class: 'grid2', style: { marginTop: '14px' } },
        h('div', { class: 'card' }, h('h3', {}, `Null distribution · Poisson(λ = ${LAMBDA0} × hours)`), cv, h('div', { class: 'stats' }, eS, kS, aS),
          h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: C.violet } }), 'counts if H₀ is true'), h('span', {}, h('i', { style: { background: C.coral } }), 'rejection region (total ≤ α)'), h('span', {}, h('i', { style: { background: C.cyan, height: '3px' } }), `counts if the Rift is waking (λ = ${LAMBDA1}/hr)`))),
        h('div', { class: 'card' }, h('h3', {}, 'Step 2 · Choose your rule'),
          h('div', { class: 'ctl' }, h('label', {}, 'Significance α'), aSeg), h('div', { class: 'ctl' }, h('label', {}, 'Listen for'), tSeg),
          h('div', { class: 'callout', html: `<b>Time matters.</b> If the Rift is waking, the quake is expected within about <b>7 hours</b>, and relocating the East district takes <b>4 hours</b>. Every hour you listen is an hour you can’t spend relocating.` }),
          h('h3', { style: { marginTop: '14px' } }, 'Test your rule before you use it'),
          h('div', { class: 'ctl' }, btn('Simulate 1,000 quiet nights', () => sim(false), 'sm'), btn('Simulate 1,000 waking nights', () => sim(true), 'sm')),
          simOut, table)));
      requestAnimationFrame(draw);
      p.setFooter(h('div', { class: 'note', html: 'Step 2 of 2. You must <b>commit</b> to α and the window <b>before</b> seeing any data. Choosing them afterwards would be cheating, even by accident.' }),
        btn('Lock rule & start listening', () => {
          const kStar = poissonCritical(LAMBDA0 * T, alpha);
          decide('c2', { alpha, T, kStar, simsRun: trials.length }); log('c2_lock', { alpha, T });
          p.close(); resolve({ alpha, T, kStar });
        }, 'primary'));
    }
  });
}

// ------------------------------------------------------------------ the listening cinematic
async function listen(ctx, { T, alpha, kStar }, rate, rng) {
  const { world, rover, hud } = ctx;
  // park the rover at the post and frame the canyon
  rover.teleport(SITES.post.x + 4, SITES.post.z + 10, Math.PI / 2);
  rover.controlEnabled = false;
  const rz = SITES.post.z;
  ctx.setCinematic({ pos: new THREE.Vector3(riftX(rz + 60) - 34, 30, rz + 60), look: new THREE.Vector3(riftX(rz - 20), -18, rz - 20) });
  await cinematic({ kicker: 'Listening', title: `${T} hour${T > 1 ? 's' : ''} at the Rift`, sub: `Rule locked: alarm if ≥ <b>${kStar}</b> pulses (α = ${alpha})`, ms: 2600 });

  // generate Poisson-process arrival times
  const times = []; let t = 0; for (;;) { t += rng.exponential(rate); if (t > T) break; times.push(t); }
  const total = T * SEC_PER_HOUR;
  const box = h('div', { id: 'timerbox', class: 'hud-card' });
  const big = h('div', { class: 'big' }, '0'); const bar = h('i'); const lbl = h('div', { class: 'lbl' }, 'pulses detected');
  const trace = h('canvas', { width: 520, height: 60, style: { width: '260px', height: '60px', display: 'block', marginTop: '8px' } });
  const clock = h('div', { class: 'tiny mono' }, '00:00');
  box.append(lbl, big, trace, h('div', { class: 'bar' }, bar), clock);
  hud.root.append(box);
  const tctx = trace.getContext('2d'); const sig = new Float32Array(260); let sigI = 0, amp = 0;
  let count = 0, el = 0;
  await new Promise((res) => {
    const off = ctx.addFrame((dt) => {
      el += dt; const hrs = (el / total) * T;
      while (count < times.length && times[count] <= hrs) {
        count++; big.textContent = count; amp = 1;
        audio.thump(0.8); rover.shake = 0.5;
        const z = rz + (rng.random() - 0.5) * 90; ring(world, riftX(z), heightAt(riftX(z), z) + 2, z, { color: '#ff7a59', maxR: 30, life: 1.6, width: 0.25 }); world.fissure.material.color.set('#ffd2a0');
        world.seismoHeads.forEach((hd) => hd.material.emissiveIntensity = 6);
        world.riftGlow.intensity = 14;
        big.style.color = count >= kStar ? '#ff7a59' : '';
      }
      world.seismoHeads.forEach((hd) => hd.material.emissiveIntensity = Math.max(1.2, hd.material.emissiveIntensity - dt * 8));
      world.riftGlow.intensity = Math.max(3, world.riftGlow.intensity - dt * 20); world.fissure.material.color.lerp(FISSURE, Math.min(1, dt * 3));
      amp *= Math.exp(-dt * 4);
      sig[sigI++ % 260] = (Math.random() - 0.5) * (0.08 + amp * 1.6);
      tctx.clearRect(0, 0, 520, 60); tctx.strokeStyle = '#5ff2ff'; tctx.lineWidth = 2; tctx.beginPath();
      for (let i = 0; i < 260; i++) { const v = sig[(sigI + i) % 260]; tctx.lineTo(i * 2, 30 + v * 26); } tctx.stroke();
      bar.style.width = Math.min(100, (100 * el) / total) + '%';
      const mins = Math.floor(hrs * 60); clock.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} / ${String(T).padStart(2, '0')}:00`;
      if (el >= total) { off(); res(); }
    });
  });
  await sleep(900);
  box.remove();
  log('c2_count', { k: count });
  return count;
}

// ------------------------------------------------------------------ decision & outcome
function resultPanel(ctx, { alpha, T, kStar }, k, waking) {
  return new Promise((resolve) => {
    const lam = LAMBDA0 * T; const pval = poissonSF(k, lam);
    const p = openPanel({ tag: 'Chapter II · Decision', title: `${k} pulses in ${T} hour${T > 1 ? 's' : ''}` });
    const cv = canvasEl(240); const plot = new Plot(cv, { height: 240, xlabel: 'pulses counted', ylabel: 'P(count | H₀)' });
    const kmax = Math.max(k + 3, Math.ceil(lam + 5 * Math.sqrt(lam)));
    requestAnimationFrame(() => {
      plot.resize(); const pm = []; for (let i = 0; i <= kmax; i++) pm.push(poissonPMF(i, lam));
      plot.setDomain(-0.5, kmax + 0.5, 0, Math.max(...pm) * 1.2); plot.axes({ yfmt: (v) => v.toFixed(2) });
      plot.bars(pm.map((v, i) => ({ x0: i - 0.42, x1: i + 0.42, y: v, color: i >= k ? C.amber : 'rgba(180,140,255,0.45)' })));
      plot.vline(k, { color: '#fff', label: `observed ${k}` });
      plot.vline(kStar - 0.5, { color: C.coral, dash: [5, 4], label: `your threshold ${kStar}`, top: false });
    });
    p.content.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, 'Where does your count fall under H₀?'), cv,
        h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: C.amber } }), `shaded: P(X ≥ ${k}) = the p-value`))),
      h('div', { class: 'card' }, h('h3', {}, 'The evidence'),
        h('div', { class: 'stats' }, stat('Observed', k), stat('Expected if quiet', fmt(lam, 0)), stat('p-value', `<span class="${pval <= alpha ? 'amber-t' : ''}">${pval < 0.0001 ? '< 0.0001' : fmt(pval, 4)}</span>`), stat('Your α', alpha)),
        h('div', { class: 'formula', style: { marginTop: '12px' } }, `p = P(X ≥ ${k} | λ = ${lam}) = 1 − Σ(i = 0…${k - 1}) e^(−${lam}) · ${lam}^i / i!`),
        h('p', { class: 'lead', style: { marginTop: '12px' }, html: `If the Rift were quiet, a count of ${k} or more would happen <b>${pct(pval)}</b> of the time. Your rule: reject H₀ if p ≤ α.` }),
        h('div', { class: 'opt-list' },
          btn('Sound the alarm: reject H₀ and relocate the East district', () => decideNow(true), 'warn'),
          btn('Stand down: fail to reject H₀', () => decideNow(false))))));
    p.setFooter(h('div', { class: 'note' }, 'Decide. The Rift won’t wait.'));

    function decideNow(alarm) {
      const ruleSays = pval <= alpha;
      const followed = alarm === ruleSays;
      let kind, tier;
      if (alarm && waking) kind = 'true-alarm'; else if (!alarm && !waking) kind = 'true-quiet'; else if (alarm && !waking) kind = 'type1'; else kind = 'type2';
      if (kind === 'true-alarm') tier = T >= 4 ? 'mid' : followed ? 'good' : 'mid';
      else if (kind === 'true-quiet') tier = followed ? 'good' : 'mid';
      else if (kind === 'type1') tier = followed ? 'mid' : 'bad';
      else tier = 'bad';
      decide('c2', { k, pval, alarm, followedRule: followed, outcome: kind, tier });
      log('c2_decision', { alarm, kind, tier });
      audio.chord(tier !== 'bad');
      const story = {
        'true-alarm': T >= 4
          ? 'Six hours later the Rift tears open. The East district is mostly evacuated, but your long listening window ate into the relocation time and the eastern hydroponics bay is lost.'
          : 'Six hours later the Rift tears open with a roar you feel through the rover’s wheels. The East district is empty. Everyone is safe.',
        'true-quiet': 'The night passes. The Rift hums its usual hum. Nobody was dragged out into a storm for nothing.',
        type1: 'The East district spends a freezing night in the storm shelters. The Rift stays quiet. Voss calls it panic.',
        type2: 'Five hours later the Rift tears open. The East district was asleep. The emergency crews save most people, but not all of the homes.',
      }[kind];
      const lesson = {
        'true-alarm': `Correct rejection. The Rift <b>was</b> waking (λ = ${LAMBDA1}/hr). ${followed ? 'Your rule caught it.' : 'Your own rule said "stand down" and you overrode it. You were right, but by luck rather than by evidence.'}`,
        'true-quiet': `Correct. The Rift was quiet (λ = ${LAMBDA0}/hr). ${followed ? 'Your rule kept the colony calm.' : 'You overrode your own rule.'}`,
        type1: `<b>Type I error (false alarm).</b> The Rift was quiet, yet the count looked extreme. ${followed ? `Your rule allows this about ${pct(alpha, 0)} of the time: that is exactly what α means. A smaller α makes this rarer but misses more real danger.` : 'Your rule said "stand down" and you alarmed anyway.'}`,
        type2: `<b>Type II error (missed effect).</b> The Rift was waking, but ${followed ? `the count wasn’t extreme enough under your rule. With α = ${alpha} and ${T} h of listening, the test’s power was only about ${pct(poissonSF(kStar, LAMBDA1 * T), 0)}. More listening time or a larger α raises power.` : 'your own rule said to alarm and you stood down.'}`,
      }[kind];
      p.content.replaceChildren(
        h('div', { class: 'callout ' + (tier === 'good' ? 'good' : tier === 'mid' ? '' : 'bad'), html: `<div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Evidence II · ${tier === 'good' ? 'strong' : tier === 'mid' ? 'partial' : 'compromised'}</div><p style="margin:4px 0">${story}</p><p style="margin:8px 0 0">${lesson}</p>` }),
        h('table', { class: 'data', style: { margin: '12px 0' } },
          h('tr', {}, h('th', {}, ''), h('th', {}, 'Rift quiet (H₀ true)'), h('th', {}, 'Rift waking (H₀ false)')),
          h('tr', {}, h('td', {}, 'Alarm (reject H₀)'), h('td', { class: kind === 'type1' ? 'bad-t' : '' }, 'Type I error · prob = α'), h('td', { class: kind === 'true-alarm' ? 'good-t' : '' }, 'Correct · prob = power')),
          h('tr', {}, h('td', {}, 'Stand down'), h('td', { class: kind === 'true-quiet' ? 'good-t' : '' }, 'Correct · prob = 1 − α'), h('td', { class: kind === 'type2' ? 'bad-t' : '' }, 'Type II error · prob = β'))),
        h('div', { class: 'card' }, h('h3', {}, 'Codex unlocked · Hypothesis testing'),
          h('div', { class: 'formula' }, 'p-value = P(result at least this extreme | H₀)      reject H₀ if p ≤ α      P(Type I) = α      power = 1 − β'),
          h('p', { class: 'tiny', style: { marginTop: '8px' } }, 'A p-value is not the probability that H₀ is true. Lowering α trades false alarms for misses. Only more data (a longer window) lowers both.')));
      p.setFooter(btn('Continue', () => { p.close(); ctx.setCinematic(null); ctx.rover.controlEnabled = true; resolve({ tier }); }, 'primary'));
    }
  });
}
