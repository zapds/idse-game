// CHAPTER III — GEYSER RUN
// Concepts: scatter plots, the linear model ŷ = b₀ + b₁x, residuals, why we square them (Σe cancels),
// SSE and least squares (b₁ = Sxy/Sxx, b₀ = ȳ − b₁x̄), R² vs the naive mean-guesser,
// residual spread as prediction uncertainty, and using a model to make a risky decision.
// DATA: the real Old Faithful (Yellowstone) record — 272 eruptions (R datasets::faithful).
import * as THREE from 'three';
import { ERUPTIONS as X, WAITING as Y } from '../stats/faithful.js';
import { linreg, lineStats, residuals, mean, fmt, pct, normalCDF } from '../stats/stats.js';
import { h, openPanel, btn, seg, stat, objectives, sleep, cinematic } from '../ui/dom.js';
import { Plot, C, canvasEl } from '../ui/charts.js';
import { talk, say, hideDialog } from '../ui/dialog.js';
import { game, decide, log, spendHours } from '../state.js';
import { audio } from '../engine/audio.js';
import { SITES, heightAt } from '../engine/geo.js';
import { ring } from '../engine/fx.js';

const CROSS_MIN = 13;        // minutes to cross the basin at cruising speed
const SEC_PER_MIN = 0.6;     // real seconds per game minute during the run
const BATTERY_MIN = 30;      // outpost stasis battery, minutes from now

export async function chapter3(ctx) {
  const LS = linreg(X, Y);
  log('c3_start');
  await talk([
    ['tally', 'Okoro’s beacon is across the Cryogeyser Basin. When <em>Old Thessaly</em> erupts, the whole basin floods with scalding vapour. Nothing caught in it comes out working.'],
    ['okoro', '<em>[Recorded log]</em> Thessaly keeps the same rhythm as Earth’s Old Faithful, so I calibrated it on Yellowstone’s real record: <strong>272 eruptions</strong>. Long eruptions are followed by long rests. If you can turn an eruption’s length into a predicted wait, you can time a crossing.'],
    ['okoro', '<em>[Recorded log]</em> I’m in the lower hab, in stasis. The battery won’t last forever. If you’re hearing this… hurry. But don’t be stupid about it.'],
  ]);
  const fit = await regressionLab(LS);
  const res = await crossingDecision(ctx, fit, LS);
  return res;
}

// ------------------------------------------------------------------ the regression lab
function regressionLab(LS) {
  return new Promise((resolve) => {
    const p = openPanel({ tag: 'Chapter III · Basin Gate', title: 'Predict the geyser' });
    p.content.append(objectives([
      'Read a <b>scatter plot</b>: direction, strength, form',
      'Fit a line <b>ŷ = b₀ + b₁x</b> by hand and see its <b>residuals</b>',
      'Discover why least squares minimises <b>Σe²</b>, not Σe',
      'Judge fit with <b>R² = 1 − SSE/SST</b> against a naive mean-guesser',
    ]));
    // handles: y at x=1.5 and x=5.5; start with a poor flat line
    const XA = 1.5, XB = 5.5;
    let ya = 72, yb = 72, showSq = false, showNaive = false, revealed = false, drags = 0;
    const cv = canvasEl(400);
    const plot = new Plot(cv, { height: 400, xlabel: 'eruption length x (min)', ylabel: 'wait until next eruption y (min)', pad: { l: 50, r: 16, t: 14, b: 36 } });
    const sE = stat('Σ residuals', '—'), sSSE = stat('SSE = Σe²', '—'), sSST = stat('Naive SST', '—'), sR2 = stat('Your R²', '—'), sLine = stat('Your line', '—');
    const meter = h('div', { class: 'progress', style: { height: '8px', marginTop: '10px' } }, h('i', { style: { width: '0%' } }));
    const lsBox = h('div');
    const useBox = h('div', { class: 'opt-list', style: { marginTop: '12px' } });
    const togSq = seg([{ value: false, label: 'Residual lines' }, { value: true, label: 'Squared errors' }], false, (v) => { showSq = v; draw(); });
    const togN = seg([{ value: false, label: 'Hide naive guesser' }, { value: true, label: 'Show naive guesser' }], false, (v) => { showNaive = v; draw(); });

    p.content.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, 'Old Faithful · 272 real eruptions', h('span', { class: 'tiny' }, 'drag the two ◆ handles')), cv,
        h('div', { class: 'ctl' }, togSq, togN)),
      h('div', {},
        h('div', { class: 'card' }, h('h3', {}, 'Your model'), h('div', { class: 'stats' }, sLine, sE, sSSE, sSST, sR2),
          h('div', { class: 'tiny', style: { marginTop: '10px' } }, 'Error removed vs. the naive guesser (always predicts ȳ):'), meter,
          h('div', { class: 'callout cyan', style: { fontSize: '13px' }, html: 'Try this: drag the line so <b>Σ residuals ≈ 0</b> while it’s still obviously wrong. Is Σe a good way to score a line?' })),
        h('div', { class: 'card' }, h('h3', {}, 'Least squares'), lsBox, useBox))));
    lsBox.append(btn('Ask TALLY for the least-squares line', () => reveal(), 'sm'));

    const b = () => { const b1 = (yb - ya) / (XB - XA); return { b1, b0: ya - b1 * XA }; };
    function draw() {
      plot.resize(); plot.clear(); plot.setDomain(1.3, 5.7, 38, 100); plot.axes({ gridX: true });
      const { b0, b1 } = b(); const st = lineStats(X, Y, b0, b1);
      plot.clip(() => {
        if (showNaive) {
          const my = mean(Y); plot.hline(my, { color: C.violet, dash: [6, 4], width: 2 });
          plot.text(5.65, my + 1.5, `naive: always ${fmt(my, 1)}`, { align: 'right', color: C.violet, font: '11px JetBrains Mono' });
        }
        for (let i = 0; i < X.length; i++) {
          const yh = b0 + b1 * X[i], e = Y[i] - yh;
          if (showSq) {
            // a true on-screen square: width in x-units that matches |e| in pixels
            const pyPerY = (plot.pb - plot.pt) / (plot.o.ymax - plot.o.ymin), pxPerX = (plot.pr - plot.pl) / (plot.o.xmax - plot.o.xmin);
            const w = (Math.abs(e) * pyPerY) / pxPerX;
            plot.rect(X[i], yh, X[i] + w, Y[i], 'rgba(255,122,89,0.08)', 'rgba(255,122,89,0.22)');
          } else plot.line(X[i], Y[i], X[i], yh, { color: e > 0 ? C.cyan : C.coral, width: 1, alpha: 0.45 });
        }
        if (revealed) plot.line(1.3, LS.b0 + LS.b1 * 1.3, 5.7, LS.b0 + LS.b1 * 5.7, { color: C.green, width: 2, dash: [8, 5] });
      });
      plot.points(X, Y, { color: '#e8e2ff', r: 2.6, alpha: 0.85 });
      plot.clip(() => plot.line(1.3, b0 + b1 * 1.3, 5.7, b0 + b1 * 5.7, { color: C.amber, width: 3 }));
      for (const [hx, hy] of [[XA, ya], [XB, yb]]) {
        const c = plot.ctx, px = plot.sx(hx), py = plot.sy(hy);
        c.save(); c.translate(px, py); c.rotate(Math.PI / 4); c.fillStyle = C.amber; c.strokeStyle = '#0b0a1c'; c.lineWidth = 2; c.fillRect(-7, -7, 14, 14); c.strokeRect(-7, -7, 14, 14); c.restore();
      }
      if (revealed) { plot.points([LS.mx], [LS.my], { color: C.green, r: 6, alpha: 1 }); plot.text(LS.mx + 0.07, LS.my - 3, '(mean x, mean y)', { color: C.green }); }
      sLine.set(`<span style="font-size:14px">ŷ = ${fmt(b0, 1)} + ${fmt(b1, 2)}x</span>`);
      sE.set(`<span class="${Math.abs(st.sumE) < 50 ? 'good-t' : ''}">${fmt(st.sumE, 0)}</span>`);
      sSSE.set(Math.round(st.sse).toLocaleString()); sSST.set(Math.round(st.sst).toLocaleString());
      sR2.set(`<span class="${st.r2 > 0.78 ? 'good-t' : st.r2 < 0 ? 'bad-t' : ''}">${fmt(st.r2, 3)}</span>`);
      meter.firstChild.style.width = Math.max(0, Math.min(100, st.r2 * 100)) + '%';
      return st;
    }
    // dragging
    let dragging = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.style.touchAction = 'none'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => {
      const [mx, my] = pos(e);
      const da = Math.hypot(mx - plot.sx(XA), my - plot.sy(ya)), db = Math.hypot(mx - plot.sx(XB), my - plot.sy(yb));
      dragging = da < db ? 'a' : 'b'; if (Math.min(da, db) > 40) dragging = mx < (plot.pl + plot.pr) / 2 ? 'a' : 'b';
      cv.setPointerCapture(e.pointerId); move(e); drags++;
    });
    const move = (e) => {
      if (!dragging) return; const [, my] = pos(e); const v = Math.max(30, Math.min(110, plot.iy(my)));
      if (dragging === 'a') ya = v; else yb = v; draw();
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', () => { if (dragging) { const st = lineStats(X, Y, b().b0, b().b1); log('c3_drag', { b0: b().b0, b1: b().b1, sse: st.sse }); } dragging = null; });

    function reveal() {
      if (revealed) return; revealed = true; audio.confirm();
      const mine = lineStats(X, Y, b().b0, b().b1);
      decide('c3', { manualB0: b().b0, manualB1: b().b1, manualSSE: mine.sse, manualR2: mine.r2, dragsBeforeReveal: drags });
      log('c3_reveal', { manualSSE: mine.sse });
      lsBox.replaceChildren(
        h('div', { class: 'formula' }, `mean x = ${fmt(LS.mx, 3)}   mean y = ${fmt(LS.my, 2)}   Sxx = ${fmt(LS.sxx, 1)}   Sxy = ${fmt(LS.sxy, 1)}`),
        h('div', { class: 'formula', style: { marginTop: '6px' } }, `b₁ = Sxy/Sxx = ${fmt(LS.b1, 3)}    b₀ = mean y − b₁·mean x = ${fmt(LS.b0, 2)}`),
        h('div', { class: 'stats' }, stat('LS SSE (minimum)', Math.round(LS.sse).toLocaleString()), stat('LS R²', fmt(LS.r2, 3)), stat('Residual SD s', fmt(LS.se, 2) + '<small> min</small>'), stat('Your SSE vs min', `+${pct(mine.sse / LS.sse - 1, 0)}`)),
        h('p', { class: 'tiny', style: { marginTop: '8px' }, html: `Each extra minute of eruption adds about <b>${fmt(LS.b1, 1)} min</b> to the wait. The line passes through (x̄, ȳ), and its residuals sum to 0, but so do the residuals of many bad lines. Only <b>SSE</b> picks out this one. R² = ${fmt(LS.r2, 2)}: it removes ${pct(LS.r2, 0)} of the naive guesser’s squared error.` }));
      useBox.replaceChildren(h('div', { class: 'tiny' }, 'Which model will you trust with the crossing?'),
        btn(`Use my hand-drawn line (R² = ${fmt(mine.r2, 3)})`, () => done('manual')),
        btn(`Use the least-squares line (R² = ${fmt(LS.r2, 3)})`, () => done('ls'), 'primary'));
      draw();
    }
    useBox.append(h('div', { class: 'tiny' }, 'Fit your own line first, or reveal least squares to compare.'), btn('Use my hand-drawn line', () => done('manual')));
    function done(which) {
      const line = which === 'ls' ? { b0: LS.b0, b1: LS.b1 } : b();
      const st = lineStats(X, Y, line.b0, line.b1);
      decide('c3', { modelUsed: which, b0: line.b0, b1: line.b1, r2: st.r2, revealed });
      p.close(); resolve({ ...line, se: st.se, r2: st.r2, which });
    }
    requestAnimationFrame(draw);
    p.setFooter(h('div', { class: 'note', html: 'Positive residual = waited longer than predicted (cyan); negative = erupted sooner (coral).' }));
  });
}

// ------------------------------------------------------------------ the crossing
async function crossingDecision(ctx, fit, LS) {
  const rng = game.rng;
  // the eruption that just ended: a real duration from the record (long eruptions)
  const longs = X.filter((x) => x >= 3.8 && x <= 4.8);
  const x0 = rng.pick(longs);
  const lsPred = LS.b0 + LS.b1 * x0;
  const slack = rng.uniform(5, 10);
  const m = Math.max(5, Math.round(lsPred - CROSS_MIN - slack)); // minutes already elapsed since it ended
  // the true next eruption: LS prediction + a real residual (bootstrap), conditioned on not having happened yet
  const res = residuals(X, Y, LS.b0, LS.b1);
  let yTrue = 0; for (let g = 0; g < 200; g++) { yTrue = lsPred + rng.pick(res); if (yTrue > m + 2) break; }
  const yHat = fit.b0 + fit.b1 * x0;
  const risk = normalCDF((m + CROSS_MIN - yHat) / fit.se);
  decide('c3', { x0, m, yHat, yTrue, risk });

  const choice = await new Promise((resolve) => {
    const p = openPanel({ tag: 'Chapter III · The crossing', title: 'Go now, or wait?', wide: false });
    const cv = canvasEl(170); const pl = new Plot(cv, { height: 170, xlabel: 'minutes since the last eruption began', ylabel: '' , pad: { l: 14, r: 14, t: 12, b: 32 } });
    requestAnimationFrame(() => {
      pl.resize(); pl.setDomain(0, 110, 0, 1); pl.axes({ yticks: [], gridY: false });
      // predictive density of next eruption under the chosen model
      const xs = [], ys = []; for (let t = 0; t <= 110; t += 0.5) { xs.push(t); ys.push(Math.exp(-0.5 * ((t - yHat) / fit.se) ** 2)); }
      pl.shadeX(m, m + CROSS_MIN, 'rgba(95,242,255,0.10)');
      pl.path(xs, ys.map((v) => v * 0.85), { color: C.amber, width: 2 });
      pl.vline(m, { color: '#fff', label: 'now' });
      pl.vline(m + CROSS_MIN, { color: C.cyan, dash: [4, 4], label: 'safe if across by here', top: false });
      pl.vline(yHat, { color: C.amber, dash: [2, 3], label: `ŷ = ${fmt(yHat, 1)}` });
    });
    p.content.append(
      h('p', { class: 'lead', html: `Old Thessaly\u2019s last eruption lasted <b>${x0} min</b>, and it began <b>${m} minutes ago</b>. Crossing the basin takes about <b>${CROSS_MIN} minutes</b> at cruising speed. Okoro’s stasis battery has about <b>${BATTERY_MIN} minutes</b> left, which isn’t enough to wait out another eruption.` }),
      h('div', { class: 'stats' },
        stat('Your model predicts', `${fmt(yHat, 1)}<small> min</small>`), stat('Time left (predicted)', `${fmt(yHat - m, 1)}<small> min</small>`),
        stat('Residual SD s', `${fmt(fit.se, 1)}<small> min</small>`), stat('Risk it erupts mid-crossing', `<span class="${risk > 0.2 ? 'bad-t' : risk > 0.08 ? 'amber-t' : 'good-t'}">${pct(risk, 0)}</span>`)),
      cv,
      h('div', { class: 'formula', style: { marginTop: '8px' } }, `risk ≈ P(next eruption < ${m}+${CROSS_MIN}) = Φ((${m + CROSS_MIN} − ${fmt(yHat, 1)}) / ${fmt(fit.se, 1)})`),
      h('div', { class: 'tiny', style: { marginTop: '6px' } }, `Using ${fit.which === 'ls' ? 'the least-squares line' : 'your hand-drawn line'}. The risk assumes residuals are roughly normal with SD s. A worse line means worse predictions AND a wider s.`));
    p.setFooter(
      btn('Wait for the eruption, then cross safely', () => { p.close(); resolve('wait'); }),
      btn('Cross now. Drive fast.', () => { p.close(); resolve('go'); }, 'primary'));
  });
  decide('c3', { choice }); log('c3_choice', { choice, risk });

  const { world, rover, hud } = ctx;
  const B = SITES.basin;
  const inZone = () => Math.hypot(rover.pos.x - B.x, rover.pos.z - B.z) < B.r + 6;
  const atOutpost = () => Math.hypot(rover.pos.x - SITES.outpost.x, rover.pos.z - SITES.outpost.z) < 18;
  rover.teleport(SITES.basinGate.x, SITES.basinGate.z + 2, Math.PI);
  let outcome;

  if (choice === 'go') {
    hud.setObjective('Cross the basin to Okoro’s Outpost <b>before Thessaly erupts</b>. Hold <kbd>Shift</kbd> to boost.', SITES.outpost);
    const box = h('div', { id: 'timerbox', class: 'hud-card' });
    const big = h('div', { class: 'big' }), bar = h('i');
    box.append(h('div', { class: 'lbl' }, 'minutes since last eruption began'), big, h('div', { class: 'bar' }, bar), h('div', { class: 'tiny mono' }, `your model: next at ≈ ${fmt(yHat, 1)} min`));
    hud.root.append(box);
    rover.controlEnabled = true;
    let el = 0, erupted = false;
    outcome = await new Promise((res) => {
      const off = ctx.addFrame((dt) => {
        el += dt; const tg = m + el / SEC_PER_MIN;
        big.textContent = tg.toFixed(1);
        bar.style.width = Math.min(100, (100 * (tg - m)) / Math.max(1, yHat - m)) + '%';
        big.style.color = tg > yHat - 3 ? '#ff7a59' : '';
        if (!erupted && tg >= yTrue) {
          erupted = true; world.steam.erupt(9); audio.geyser(); rover.shake = 1.2;
          ring(world, B.x, heightAt(B.x, B.z), B.z, { color: '#bfe9ff', maxR: 80, life: 2.5, width: 0.15 });
          if (inZone()) { rover.damage = 0.6; rover.speed = -8; off(); box.remove(); res('caught'); return; }
          if (!atOutpost()) { off(); box.remove(); res('blocked'); return; }
        }
        if (atOutpost()) { off(); box.remove(); res('safe'); }
      });
    });
  } else {
    outcome = 'wait';
  }

  if (outcome === 'wait' || outcome === 'blocked') {
    rover.controlEnabled = false;
    ctx.setCinematic({ pos: new THREE.Vector3(B.x + 70, 30, B.z + 60), look: new THREE.Vector3(B.x, 10, B.z) });
    await cinematic({ kicker: 'Waiting at the gate', title: `Thessaly erupts at ${fmt(yTrue, 1)} min`, sub: `Your model predicted ${fmt(yHat, 1)}. The residual was ${fmt(yTrue - yHat, 1)} min.`, ms: 2600 });
    world.steam.erupt(9); audio.geyser();
    await sleep(6500);
    ctx.setCinematic(null); rover.controlEnabled = true;
    hud.setObjective('The basin is clear. Drive to Okoro’s Outpost.', SITES.outpost);
    await new Promise((res) => { const off = ctx.addFrame(() => { if (atOutpost()) { off(); res(); } }); });
  } else if (outcome === 'caught') {
    hud.toast('⚠ CAUGHT IN THE ERUPTION. Hull damage 60%.', 3500, '#ff5d6c');
    await sleep(1500);
    hud.setObjective('Damaged, but moving. Limp to Okoro’s Outpost.', SITES.outpost);
    await new Promise((res) => { const off = ctx.addFrame(() => { if (atOutpost()) { off(); res(); } }); });
  }
  spendHours(outcome === 'safe' ? 0.4 : 1.6, 'basin crossing');

  rover.controlEnabled = false; rover.speed = 0;
  const tier = outcome === 'safe' ? 'good' : outcome === 'caught' ? 'bad' : 'mid';
  decide('c3', { outcome, tier }); log('c3_outcome', { outcome, tier });
  audio.chord(tier !== 'bad');

  if (outcome === 'safe') {
    await talk([
      ['tally', `We’re through! Thessaly erupted at <em>${fmt(yTrue, 1)} min</em>. Your model said ${fmt(yHat, 1)}. That residual of ${fmt(yTrue - yHat, 1)} min is why we needed a safety margin.`],
      ['okoro', '…the stasis pod is cycling open. You came. You actually ran the numbers and came.'],
      ['okoro', 'Listen: Voss’s blight report pooled the small domes and the big ones together. I have the per-dome data. Take me to the greenhouses.'],
    ]);
  } else if (outcome === 'caught') {
    await talk([
      ['tally', `The eruption came at <em>${fmt(yTrue, 1)} min</em>, but your model said ${fmt(yHat, 1)}. We were inside the basin when it hit. Hull integrity is at 40%.`],
      ['tally', 'Okoro is alive in the pod, but the vapour fried half of her data core. We’ll limp home with what’s left.'],
    ]);
  } else {
    await talk([
      outcome === 'blocked'
        ? ['tally', `Thessaly erupted at <em>${fmt(yTrue, 1)} min</em> (predicted ${fmt(yHat, 1)}) before we were across, but we weren’t inside the basin yet, so we’re safe. We had to wait it out, though, and her battery ran out.`]
        : ['tally', `Thessaly erupted at <em>${fmt(yTrue, 1)} min</em> (predicted ${fmt(yHat, 1)}). We waited, so we’re safe, but her battery ran out while we sat at the gate.`],
      ['tally', 'The pod switched to emergency mode. Okoro is alive but unconscious. Her data core is intact: it has per-dome greenhouse records.'],
    ]);
  }
  hideDialog();
  const p = openPanel({ tag: 'Chapter III · Debrief', title: 'Models make decisions', wide: false });
  p.content.append(
    h('div', { class: 'callout ' + (tier === 'good' ? 'good' : tier === 'mid' ? '' : 'bad'), html: `<div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Evidence III · ${tier === 'good' ? 'strong' : tier === 'mid' ? 'partial' : 'compromised'}</div>` +
      `Model used: <b>${fit.which === 'ls' ? 'least squares' : 'hand-drawn'}</b> (R² = ${fmt(fit.r2, 3)}). Predicted wait <b>${fmt(yHat, 1)}</b>, actual <b>${fmt(yTrue, 1)}</b> min. ` +
      (choice === 'go' ? `You accepted a <b>${pct(risk, 0)}</b> risk. ` : `You refused a <b>${pct(risk, 0)}</b> risk. `) +
      (fit.which !== 'ls' ? `With least squares, the predicted risk would have been ${pct(normalCDF((m + CROSS_MIN - lsPred) / LS.se), 0)}.` : '') }),
    h('div', { class: 'card' }, h('h3', {}, 'Codex unlocked · Linear regression'),
      h('div', { class: 'formula' }, 'ŷ = b₀ + b₁x    b₁ = Sxy/Sxx    b₀ = mean(y) − b₁·mean(x)    R² = 1 − SSE/SST'),
      h('p', { class: 'tiny', style: { marginTop: '8px' } }, 'Least squares picks the line with the smallest total squared residual. A prediction is only as good as its spread: the residual SD tells you how much margin to leave. The line is fitted for eruptions of 1.6–5.1 min, so don’t trust it far outside that range (extrapolation).')));
  await new Promise((r) => p.setFooter(btn('Continue', () => { p.close(); r(); }, 'primary')));
  rover.controlEnabled = true;
  return { tier, outcome };
}
