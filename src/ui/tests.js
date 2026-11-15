// Pre-test / post-test for playtest evidence of learning.
// Two parallel forms (A, B) testing the same concepts in NEW contexts (transfer, not recall).
// Forms are counterbalanced: each player gets a random form first and the other one after,
// so a measured gain cannot be explained by one form simply being easier.
import { h, openPanel, btn } from './dom.js';
import { game, save, log } from '../state.js';

const CONCEPTS = ['Sampling bias', 'Central Limit Theorem', 'Standard error & n', 'p-value', 'α, Type I / II errors', 'Least squares', 'R²', "Simpson's paradox", 'Correlation ≠ causation'];

export const FORMS = {
  A: [
    { q: 'A food app wants the average delivery rating for the whole city, so it surveys 5,000 users who open the app every day. If it surveyed 50,000 of those daily users instead, the estimate would…',
      o: ['lose its bias, because the sample is now huge', 'become more precise, but still be biased', 'become exactly correct', 'become more biased'], a: 1,
      why: 'More data shrinks random error, not bias. Daily users are not a random sample of everyone, so the average stays off target, just with more confidence.' },
    { q: 'Household incomes in a town are strongly right-skewed. You take many random samples of 50 households each and plot each sample’s average income. The histogram of these averages will look…',
      o: ['right-skewed, like the incomes', 'roughly bell-shaped around the true mean', 'flat (uniform)', 'left-skewed'], a: 1,
      why: 'Central Limit Theorem: averages of reasonably large random samples are approximately normal, whatever the population’s shape.' },
    { q: 'A random sample of 25 gives a 95% confidence interval of ±8. Roughly how large a sample would give about ±4?',
      o: ['50', '100', '400', '12'], a: 1, why: 'Width ∝ 1/√n. Halving the width needs 4× the data: 25 × 4 = 100.' },
    { q: 'A hypothesis test gives p = 0.03. Which statement is correct?',
      o: ['There is a 3% chance the null hypothesis is true', 'If the null hypothesis were true, a result at least this extreme would happen about 3% of the time', 'The effect is 97% likely to be real', 'The effect size is 0.03'], a: 1,
      why: 'A p-value is computed assuming H₀ is true. It is the probability of data this extreme, not the probability that H₀ is true.' },
    { q: 'A factory lowers its significance level from α = 0.05 to α = 0.01 but keeps the same sample size. What happens?',
      o: ['Fewer false alarms, but more real effects missed', 'Fewer false alarms and fewer missed effects', 'More false alarms', 'Nothing changes'], a: 0,
      why: 'Lower α means a stricter rule: Type I errors (false alarms) drop, but Type II errors (misses) rise unless you collect more data.' },
    { q: 'The least squares regression line is the line that…',
      o: ['makes the sum of the residuals as small as possible', 'passes through the most data points', 'makes the sum of the squared residuals as small as possible', 'has the steepest slope'], a: 2,
      why: 'Least squares minimises SSE = Σ(yᵢ − ŷᵢ)². Plain residuals cancel: many bad lines have Σe = 0.' },
    { q: 'A regression model has R² = 0.80. This means…',
      o: ['80% of its predictions are exactly right', 'its total squared error is 80% smaller than always predicting the mean', 'its slope is 0.8', '80% of the points lie on the line'], a: 1,
      why: 'R² = 1 − SSE/SST compares the model with a naive guesser that always predicts ȳ.' },
    { q: 'Hospital X has a higher overall survival rate than Hospital Y. But Y has a higher survival rate for mild cases AND for severe cases. The most likely explanation is…',
      o: ['an arithmetic mistake', 'Y treats a much larger share of severe cases', 'X is the better hospital after all', 'this can never happen'], a: 1,
      why: 'Simpson’s paradox: case severity is a confounder. Mixing groups with different case-mixes can reverse a comparison.' },
    { q: 'Across a city’s fires, the number of firefighters sent is strongly correlated with the amount of damage. The best conclusion is…',
      o: ['firefighters cause fire damage', 'bigger fires cause more firefighters to be sent', 'a correlation of 0.6 means 60% of damage is caused by firefighters', 'correlations are always coincidences'], a: 1,
      why: 'Correlation is not causation. Here the causal arrow runs the other way: fire size drives both.' },
  ],
  B: [
    { q: 'To estimate the average commute time of ALL workers in a city, a researcher surveys people at one metro station at 9 AM. If they doubled the number surveyed at that station, the estimate would…',
      o: ['lose its bias, because the sample is now bigger', 'become more precise, but still be biased', 'become exactly correct', 'become more biased'], a: 1,
      why: 'Only random selection fixes bias. More people from the same unrepresentative place gives a tighter estimate of the wrong number.' },
    { q: 'Waiting times at a help desk are strongly right-skewed. You repeatedly take random samples of 40 waiting times and record each sample’s average. The histogram of these averages will be…',
      o: ['right-skewed, like the waiting times', 'roughly bell-shaped around the true mean', 'flat (uniform)', 'left-skewed'], a: 1,
      why: 'CLT: the sampling distribution of the mean becomes approximately normal as n grows.' },
    { q: 'A random sample of 36 gives a 95% confidence interval of ±6. Roughly how large a sample would give about ±2?',
      o: ['72', '108', '324', '12'], a: 2, why: 'To make the width ⅓ as big you need 3² = 9× the data: 36 × 9 = 324.' },
    { q: 'A drug trial reports p = 0.04 for "the drug lowers blood pressure". Which statement is correct?',
      o: ['There is a 4% chance the drug does not work', 'If the drug had no effect, results at least this extreme would occur about 4% of the time', 'There is a 96% chance the drug works', 'The drug lowers blood pressure by 4%'], a: 1,
      why: 'The p-value assumes H₀ (no effect) is true and asks how surprising the data are.' },
    { q: 'An alarm system raises its significance level from α = 0.01 to α = 0.10 with the same amount of data. What happens?',
      o: ['More false alarms, but fewer real events missed', 'Fewer false alarms and fewer misses', 'Fewer false alarms', 'Nothing changes'], a: 0,
      why: 'A looser rule rejects H₀ more easily: more Type I errors, fewer Type II errors.' },
    { q: 'When fitting a line, why do we add up SQUARED residuals instead of the residuals themselves?',
      o: ['Squaring makes the numbers bigger and easier to read', 'Positive and negative residuals cancel, so even a bad line can sum to zero', 'Squares are always integers', 'It forces the slope to be positive'], a: 1,
      why: 'Σe = 0 for any line through (x̄, ȳ), good or bad. Squares never cancel, so SSE can tell the lines apart.' },
    { q: 'A regression model has R² = 0. This means it…',
      o: ['predicts no better than always guessing the mean', 'fits the data perfectly', 'has a negative slope', 'has every residual equal to zero'], a: 0,
      why: 'R² = 0 ⇔ SSE = SST: the model removes none of the naive guesser’s error.' },
    { q: 'At a university, men were admitted at a higher overall rate than women. Yet inside every department, women were admitted at an equal or higher rate. The most likely explanation is…',
      o: ['the overall numbers must be wrong', 'women applied more often to departments that admit few applicants', 'men are better applicants', 'this is impossible'], a: 1,
      why: 'Simpson’s paradox (the real 1973 UC Berkeley case): department choice is a confounder.' },
    { q: 'Students who visit the library more often tend to have higher grades. Which conclusion is justified?',
      o: ['Library visits cause higher grades', 'The two are associated, and a third factor such as motivation could drive both', 'Higher grades definitely cause library visits', 'r = 0.5 means half of every grade comes from the library'], a: 1,
      why: 'Observational correlation cannot show the direction of cause. Confounders and reverse causation are both possible.' },
  ],
};

export function runTest(kind /* 'pre' | 'post' */) {
  return new Promise((resolve) => {
    const s = game.state;
    let form;
    if (kind === 'pre') { form = Math.random() < 0.5 ? 'A' : 'B'; }
    else form = s.pre?.form === 'A' ? 'B' : 'A';
    const qs = FORMS[form];
    const answers = new Array(qs.length).fill(null);
    const t0 = Date.now();
    const p = openPanel({ tag: kind === 'pre' ? 'Before you launch · 2 minutes' : 'Debrief · final check', title: kind === 'pre' ? 'Calibration check' : 'What did you discover?', wide: false });
    const intro = kind === 'pre'
      ? 'Before the expedition, answer these 9 quick questions. It isn’t graded and there are no penalties, so guess if you’re unsure. They measure what the game teaches.'
      : 'Same ideas, new situations. Answer without looking anything up. Afterwards you’ll see your before/after score and an explanation for each answer.';
    const bar = h('i', { style: { width: '0%' } });
    p.content.append(h('p', { class: 'lead' }, intro), h('div', { class: 'progress', style: { marginBottom: '18px' } }, bar));
    const submit = btn('Submit answers', finish, 'primary'); submit.disabled = true;
    qs.forEach((q, qi) => {
      const opts = h('div', { class: 'opts' });
      q.o.forEach((o, oi) => {
        const b = h('button', { class: 'btn', onclick: () => {
          answers[qi] = oi; [...opts.children].forEach((c, k) => c.classList.toggle('sel', k === oi));
          const done = answers.filter((a) => a !== null).length; bar.style.width = (100 * done / qs.length) + '%'; submit.disabled = done < qs.length;
        } }, `${'abcd'[oi]})  ${o}`);
        opts.append(b);
      });
      p.content.append(h('div', { class: 'q' }, h('div', { class: 'qt' }, h('span', { class: 'qn' }, `Q${qi + 1}`), q.q), opts));
    });
    p.setFooter(h('div', { class: 'note' }, kind === 'pre' ? 'Answer all 9 to begin.' : 'Answer all 9 to see your results.'), submit);

    function finish() {
      const correct = answers.map((a, i) => a === qs[i].a);
      const rec = { form, answers, correct, score: correct.filter(Boolean).length, of: qs.length, ms: Date.now() - t0, concepts: CONCEPTS };
      s[kind] = rec; save(); log(kind + 'test', { form, score: rec.score });
      if (kind === 'pre') { p.close(); resolve(rec); return; }
      // post-test: show explanations
      p.content.replaceChildren();
      p.setTitle('Your results', 'Debrief');
      const pre = s.pre;
      p.content.append(h('div', { class: 'stats', style: { marginBottom: '16px' } },
        h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Before'), h('div', { class: 'v' }, `${pre?.score ?? '—'} / ${qs.length}`)),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, 'After'), h('div', { class: 'v cyan-t' }, `${rec.score} / ${qs.length}`)),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Change'), h('div', { class: 'v ' + ((rec.score - (pre?.score ?? 0)) >= 0 ? 'good-t' : 'bad-t') }, `${rec.score - (pre?.score ?? 0) >= 0 ? '+' : ''}${rec.score - (pre?.score ?? 0)}`))));
      qs.forEach((q, i) => {
        p.content.append(h('div', { class: 'callout ' + (correct[i] ? 'good' : 'bad') },
          h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, `${correct[i] ? '✓' : '✗'} Q${i + 1} · ${CONCEPTS[i]}${pre ? (pre.correct[i] ? '' : correct[i] ? ' · newly correct' : '') : ''}`),
          h('div', { class: 'tiny', style: { color: 'inherit', opacity: 0.85, marginBottom: '4px' } }, `Answer: ${q.o[q.a]}`),
          h('div', {}, q.why)));
      });
      p.setFooter(btn('Continue', () => { p.close(); resolve(rec); }, 'primary'));
    }
  });
}
