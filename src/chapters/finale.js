// FINALE — The Council votes. The ending is computed from the evidence the player actually produced.
import * as THREE from 'three';
import { h, openPanel, btn, cinematic, sleep } from '../ui/dom.js';
import { talk } from '../ui/dialog.js';
import { game, decide, log, save } from '../state.js';
import { audio } from '../engine/audio.js';
import { fmt, pct } from '../stats/stats.js';
import { THRESHOLD } from './ch1_survey.js';

const PTS = { good: 2, mid: 1, bad: 0 };

export async function finale(ctx) {
  const s = game.state; const ev = s.evidence; const d = s.decisions;
  ctx.rover.controlEnabled = false;
  ctx.setCinematic({ orbit: { x: 0, z: 14, r: 62, y: 26, speed: 0.06, lookY: 6 } });
  await cinematic({ kicker: `${fmt(36 - s.hoursLeft, 1)} hours later`, title: 'The Council of Halcyon', sub: '2,400 people. One vote. Your evidence.', ms: 3600 });

  const lines = [['reyes', 'This session is open. Director Voss moves for full evacuation of Halcyon. Surveyor, you asked to present evidence. Go ahead.']];
  // I — yield
  const c1 = d.c1 || {};
  lines.push(['voss', `The crystal yield is <strong>${fmt(c1.vossMean, 1)} kg/m³</strong>. We need ${THRESHOLD}. Halcyon cannot pay for its own air.`]);
  if (ev.c1 === 'good') lines.push(['tally', `The Director’s 34 samples all came from within 60 m of base, ground that was mined out decades ago. Our <em>${c1.method === 'strat' ? 'stratified' : 'random'}</em> survey of ${c1.n} deposits gives a 95% interval of <em>${fmt(c1.lo, 1)}–${fmt(c1.hi, 1)}</em>, entirely above ${THRESHOLD}. The moon is not empty. The Director’s sample was biased.`]);
  else if (ev.c1 === 'mid') lines.push(['tally', `Our unbiased survey gives ${fmt(c1.est, 1)}, with a 95% interval of ${fmt(c1.lo, 1)}–${fmt(c1.hi, 1)}. That’s higher than the Director’s figure, but the interval is too wide to settle it.`]);
  else lines.push(['tally', `Our survey${c1.method === 'near' ? ', which also stayed near base,' : ''} gives ${fmt(c1.est, 1)}. We can’t contradict the Director on yield.`]);
  // II — rift
  const c2 = d.c2 || {};
  if (c2.outcome === 'true-alarm') lines.push(['reyes', `The Rift opened six hours after your alarm. ${ev.c2 === 'good' ? 'Nobody was hurt.' : 'We lost the eastern hydroponics, but no lives.'} The Council notes your test was set up before the data came in.`]);
  else if (c2.outcome === 'true-quiet') lines.push(['reyes', `You kept the East district calm, and the Rift stayed quiet. ${ev.c2 === 'good' ? 'Your test called it correctly.' : 'Though you ignored your own rule.'}`]);
  else if (c2.outcome === 'type1') lines.push(['voss', 'And the Rift alarm? A whole district in shelters for nothing. Panic, not science.']);
  else lines.push(['voss', 'The Rift opened and the East district was asleep. Where was your test then?']);
  // III — geyser
  const c3 = d.c3 || {};
  if (c3.outcome === 'safe') lines.push(['okoro', 'I’ll speak for myself, thank you. I’m alive because this surveyor fitted a regression line and trusted its margin of error. My data shows the Director’s report pooled numbers it should never have pooled.']);
  else if (c3.outcome === 'caught') lines.push(['tally', 'Dr. Okoro is alive, but her data core was damaged when we were caught in the basin. We recovered only part of her records.']);
  else lines.push(['tally', 'Dr. Okoro is alive but unconscious in the medical bay. Her data core is intact, and it’s on the screen behind me.']);
  // IV — blight
  const c4 = d.c4 || {};
  if (c4.filter === 'A') lines.push(['tally', 'Filter B looked better only because it was mostly installed in the small domes, which are easier to keep healthy. Within <em>every</em> dome size, Filter A wins. The domes are already recovering.']);
  else lines.push(['voss', 'And the greenhouses are still dying, even after the new filters went in.']);
  if (c4.droneChoice === 0) lines.push(['reyes', 'The drone ban has left blight unanswered in three sectors.']);
  await talk(lines);

  const score = ['c1', 'c2', 'c3', 'c4'].reduce((a, k) => a + (PTS[ev[k]] ?? 0), 0);
  const ending = score >= 7 ? 'dawn' : score >= 4 ? 'holds' : 'night';
  s.ending = { score, ending }; save(); log('ending', { score, ending });

  const E = {
    dawn: { k: 'Ending · Dawn over Halcyon', t: 'The Council votes to stay. 9–0.', s: 'Voss’s report is withdrawn. Dr. Okoro takes over the Survey Office. Thessaly rises over a colony that learned to ask <i>how do you know?</i>' },
    holds: { k: 'Ending · Halcyon Holds', t: 'The Council votes to stay. 5–4.', s: 'It’s close. Some of your evidence held, and some didn’t. Halcyon stays, bruised. Voss keeps his seat, and the next report will be read much more carefully.' },
    night: { k: 'Ending · The Long Night', t: 'The Council votes to evacuate.', s: 'The shuttles lift off over a moon still full of crystal. The numbers were wrong. Nobody could show it in time. <i>Play again and the data will be different.</i>' },
  }[ending];
  audio.chord(ending !== 'night');
  await cinematic({ kicker: E.k, title: E.t, sub: E.s, ms: 7000 });
  ctx.setCinematic(null);
  return { score, ending };
}

// Recap: what each chapter taught, with the player's own numbers
export function recapPanel() {
  return new Promise((resolve) => {
    const s = game.state, d = s.decisions, ev = s.evidence;
    const p = openPanel({ tag: 'Mission debrief', title: 'What you discovered' });
    const tierTxt = (t) => `<span class="${t === 'good' ? 'good-t' : t === 'mid' ? 'amber-t' : 'bad-t'}">${t === 'good' ? 'strong' : t === 'mid' ? 'partial' : 'compromised'}</span>`;
    const items = [
      ['I · Survey: sampling, CLT, confidence intervals', ev.c1, `You surveyed with <b>${({ near: 'near-base', random: 'simple random', strat: 'stratified' })[d.c1?.method] || '—'}</b> sampling (n = ${d.c1?.n ?? '—'}), giving a 95% CI of ${fmt(d.c1?.lo, 1)}–${fmt(d.c1?.hi, 1)}. The true mean was ${fmt(d.c1?.truth, 2)}. You predicted the CLT shape would be: <b>${d.c1?.cltPrediction || '—'}</b>.`,
        'A biased method stays biased at any n. Random or stratified selection removes bias, and SE = s/√n controls the noise.'],
      ['II · Static: hypothesis testing', ev.c2, `With α = ${d.c2?.alpha} and ${d.c2?.T} h of listening you counted ${d.c2?.k} pulses (p = ${fmt(d.c2?.pval, 4)}). The Rift was <b>${d.c2?.truthWaking ? 'waking' : 'quiet'}</b>, and your decision was a <b>${({ 'true-alarm': 'correct alarm', 'true-quiet': 'correct stand-down', type1: 'Type I error', type2: 'Type II error' })[d.c2?.outcome] || '—'}</b>.`,
        'A p-value is P(data this extreme | H₀). α is the false-alarm rate you accept. Power rises with more data.'],
      ['III · Geyser Run: linear regression', ev.c3, `You crossed with the <b>${d.c3?.modelUsed === 'ls' ? 'least-squares' : 'hand-drawn'}</b> line (R² = ${fmt(d.c3?.r2, 3)}). It predicted ${fmt(d.c3?.yHat, 1)} min; the real eruption came at ${fmt(d.c3?.yTrue, 1)}. Your hand-drawn line’s R² was ${fmt(d.c3?.manualR2, 3)}.`,
        'Least squares minimises Σe². R² compares the model with always guessing the mean. The residual SD sets your safety margin.'],
      ['IV · Blight: confounding & causation', ev.c4, `You chose <b>Filter ${d.c4?.filter}</b> and ${d.c4?.droneChoice === 0 ? 'banned' : 'kept'} the drones (r = ${fmt(d.c4?.r, 2)}).`,
        'Simpson’s paradox: a confounder can reverse a pooled comparison. Correlation does not imply causation, and the arrow can run backwards.'],
    ];
    p.content.append(...items.map(([t, tier, mine, rule]) => h('div', { class: 'card' },
      h('h3', { html: `${t} <span>${tierTxt(tier)}</span>` }),
      h('p', { class: 'lead', style: { fontSize: '14px' }, html: mine }),
      h('div', { class: 'callout cyan', style: { margin: '6px 0 0', fontSize: '13.5px' } }, rule))));
    p.setFooter(h('div', { class: 'note' }, 'Next: a 2-minute final check and quick feedback. Both feed the playtest report.'), btn('Continue to final check', () => { p.close(); resolve(); }, 'primary'));
  });
}
