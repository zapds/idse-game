// Field Manual: how to play, learning objectives, concept codex, data sources. Opens from title or in-game (C).
import { h, openPanel, seg } from './dom.js';

const TABS = {
  play: ['How to play', `
    <h3>Your goal</h3>
    <p>Halcyon, a mining colony of 2,400 people on the moon Veyra, is about to vote on a full evacuation. Director Voss’s report says the moon is played out, the Rift is harmless and the greenhouses need new filters. You drive the survey rover <b>KESTREL-7</b>. Collect <b>four pieces of evidence</b> before the Council votes. Each one comes from a statistics problem you solve <i>by doing</i>, not by reading.</p>
    <h3>Controls</h3>
    <ul>
      <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys: drive · <kbd>Shift</kbd>: boost</li>
      <li><kbd>E</kbd>: interact when you’re at a glowing beacon · <kbd>F</kbd>: drop a probe (Chapter I)</li>
      <li>Drag the mouse to look around · scroll wheel to zoom</li>
      <li><kbd>C</kbd>: this manual · <kbd>N</kbd>: sound on/off · <kbd>Esc</kbd>: menu</li>
      <li>Dialogue: click or press <kbd>Space</kbd> to continue</li>
    </ul>
    <h3>Structure</h3>
    <ol>
      <li><b>Survey</b> (Survey Depot, near base): is the moon really mined out?</li>
      <li><b>Static</b> (Rift Listening Post, east): is the Rift waking up?</li>
      <li><b>Geyser Run</b> (Basin Gate, north): reach Dr. Okoro before her stasis pod fails</li>
      <li><b>Blight</b> (Greenhouse Ring, west of base): which filter saves the crops?</li>
      <li><b>The Council</b> (Council Hall, base centre): the vote. Your evidence decides the ending.</li>
    </ol>
    <h3>Rules & feedback</h3>
    <p>Each piece of evidence is rated <span class="good-t">strong</span>, <span class="amber-t">partial</span> or <span class="bad-t">compromised</span> depending on your decisions. The slots in the top-right track it. Hidden values (the true yield, whether the Rift is waking, when the geyser erupts) are randomised every playthrough, so you can’t memorise answers. You have to reason. Three endings are possible.</p>
    <h3>Playtest mode</h3>
    <p>Before you play there’s a 9-question check, and after you play there’s a parallel 9-question check, so your learning gain can be measured. At the end you can download a results file for the organiser.</p>`],
  goals: ['Learning objectives', `
    <p>By the end of HALCYON a player should be able to:</p>
    <h3>I · Sampling & the CLT</h3>
    <ul><li>Distinguish a <b>population</b> from a <b>sample</b>, and explain why a <b>convenience sample</b> is biased.</li>
    <li>Explain why increasing <b>n</b> reduces random error but <b>not</b> bias.</li>
    <li>Compare <b>simple random</b> and <b>stratified</b> sampling.</li>
    <li>Predict and explain the <b>Central Limit Theorem</b>: means of skewed data are approximately normal with SD σ/√n.</li>
    <li>Build and interpret a <b>95% confidence interval</b> x̄ ± 1.96·s/√n, and choose n to reach a target precision.</li>
    <li>Explain why <b>mean > median</b> in right-skewed data.</li></ul>
    <h3>II · Hypothesis testing</h3>
    <ul><li>Write <b>H₀</b> and <b>H₁</b> for a real question.</li>
    <li>Use a <b>Poisson</b> null distribution for counts of rare events in a fixed window.</li>
    <li>Compute and interpret a <b>p-value</b> as a tail probability under H₀, and decide using <b>α</b>.</li>
    <li>Explain <b>Type I / Type II errors</b>, power, and the trade-off when α or sample size changes.</li></ul>
    <h3>III · Linear regression</h3>
    <ul><li>Fit <b>ŷ = b₀ + b₁x</b> and interpret its slope and intercept.</li>
    <li>Explain why least squares minimises <b>Σe²</b> rather than Σe.</li>
    <li>Compute <b>b₁ = Sxy/Sxx</b>, <b>b₀ = ȳ − b₁x̄</b>, and interpret <b>R² = 1 − SSE/SST</b>.</li>
    <li>Use the <b>residual SD</b> to quantify prediction risk.</li></ul>
    <h3>IV · Confounding & causation</h3>
    <ul><li>Recognise <b>Simpson’s paradox</b>, and identify a <b>confounder</b>.</li>
    <li>Measure association with <b>Pearson r</b> / <b>Spearman ρ</b>, and explain why <b>correlation ≠ causation</b>, including <b>reverse causation</b>.</li></ul>`],
  codex: ['Concept codex', `
    <h3>Sampling</h3><p>A <b>population</b> is everything you care about (here, every deposit on the moon). A <b>sample</b> is the part you measure. A <b>biased</b> method (e.g. only sampling near base) systematically misses part of the population, and a larger biased sample is just a more confident wrong answer. <b>Stratified</b> sampling splits the population into groups (strata) and samples each one: x̄ₛₜ = Σ Wₕ x̄ₕ.</p>
    <h3>Central Limit Theorem</h3><p>For random samples of size n, the sample mean x̄ is approximately <b>Normal(μ, σ/√n)</b>, even if the data are skewed. Its spread, the <b>standard error</b> SE = s/√n, shrinks as n grows: four times the data halves the error. About 95% of intervals x̄ ± 1.96·SE contain μ.</p>
    <h3>Hypothesis tests</h3><p>H₀ is the "nothing special" claim. The <b>p-value</b> is P(result at least as extreme as observed | H₀). Reject H₀ if p ≤ α. <b>Type I error</b>: rejecting a true H₀ (probability α). <b>Type II error</b>: missing a false H₀ (probability β). <b>Power</b> = 1 − β. Counts of rare independent events in a fixed time follow a <b>Poisson(λ)</b> distribution: P(X = k) = e^(−λ) λᵏ / k!.</p>
    <h3>Least squares</h3><p>Residual eᵢ = yᵢ − ŷᵢ. Many lines have Σe = 0, so we minimise <b>SSE = Σe²</b>. The solution is b₁ = Sxy/Sxx and b₀ = ȳ − b₁x̄, and the line passes through (x̄, ȳ). Equivalently b₁ = r·(s_y/s_x). <b>R² = 1 − SSE/SST</b>, where SST is the error of always predicting ȳ.</p>
    <h3>Confounding</h3><p>A <b>confounder</b> influences both the "treatment" and the outcome. <b>Simpson’s paradox</b>: a comparison that holds within every subgroup can reverse when the subgroups are pooled. <b>Correlation ≠ causation</b>: r measures linear association (Spearman ρ measures monotonic association using ranks). Neither one shows direction. Only controlled, randomised experiments isolate cause.</p>`],
  data: ['Data & honesty', `
    <h3>Everything is computed, nothing is scripted</h3>
    <p>Every number in HALCYON is computed live in your browser by the game’s statistics engine (<code>src/stats/stats.js</code>): sample means, SEs, CIs, Poisson p-values, least-squares coefficients, R², Pearson and Spearman correlations, and simulated sampling distributions. Hidden truths are drawn from a random seed each run.</p>
    <h3>Real datasets</h3>
    <ul>
      <li><b>Chapter III</b> uses the real <b>Old Faithful</b> geyser record from Yellowstone National Park: 272 eruptions, duration vs waiting time (R <code>datasets::faithful</code>; Azzalini & Bowman, 1990). The game’s "Old Thessaly" is calibrated on it.</li>
      <li><b>Chapter IV</b> uses the real counts from <b>Charig et al. (1986), BMJ</b>, a comparison of two kidney-stone treatments stratified by stone size and a classic real-world case of Simpson’s paradox. It’s reframed here as filters × dome size, with the numbers unchanged.</li>
      <li>The post-test also cites the real <b>1973 UC Berkeley admissions</b> case (Bickel et al., 1975).</li>
    </ul>
    <h3>Simulated data</h3>
    <p>The crystal-yield field (Chapter I) is a deterministic noise field: right-skewed, and depleted near the base. The population of ${'~5,700'} deposits is fixed, so the "truth" is well defined. Rift pulses (Chapter II) are a genuine Poisson process generated from exponential inter-arrival times. Drone/blight data (Chapter IV, part 2) are simulated with blight <i>causing</i> drone visits, so the causal truth is known.</p>
    <h3>Course mapping</h3>
    <p>CS3006 Introduction to Data Science for Engineers: Descriptive Statistics (skew, mean vs median, correlation, Spearman, Simpson’s paradox), Inferential Statistics (population vs sample, sampling bias, CLT, confidence intervals, Poisson, hypothesis testing, Type I/II errors), Regression (least squares, residuals, SSE, R²).</p>`],
};

export function openManual(start = 'play') {
  const p = openPanel({ tag: 'Field manual', title: 'HALCYON', closable: true });
  const body = h('div', { class: 'manual' });
  const tabs = seg(Object.entries(TABS).map(([k, [label]]) => ({ value: k, label })), start, (v) => show(v));
  tabs.classList.add('tabs');
  const show = (k) => { body.innerHTML = TABS[k][1]; p.content.scrollTop = 0; };
  p.content.append(tabs, body); show(start);
  return p;
}
