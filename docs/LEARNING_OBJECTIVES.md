# Learning objectives & concept accuracy

HALCYON targets the statistics half of CS3006: **Descriptive Statistics**, **Probability & Inferential Statistics**, and **Regression**. Each objective below maps to a mechanic where the player discovers the idea by acting, and to the formula the game computes live.

## Chapter I · Survey: sampling, the CLT, confidence intervals

By the end, a player can:

| # | Objective | How the game makes the player discover it |
|---|---|---|
| 1.1 | Distinguish **population** and **sample**, and explain **sampling bias** | Voss's 34 near-base samples read ~9–11 kg/m³. The player's own probes far from base read much higher. In the simulator, the near-base sampling distribution sits far from the true mean and **0 of 500** of its CIs catch the truth. |
| 1.2 | Explain that **larger n reduces noise but not bias** | Pushing the near-base n to 100 makes the bell narrower but leaves it centred in the wrong place (lecture: "more students can't fix a biased sample"). |
| 1.3 | Compare **simple random** and **stratified** sampling | Both are available, with drawn sample points shown on the survey map by region. The stratified estimator x̄ₛₜ = Σ Wₕ x̄ₕ uses proportional allocation, with SE = √(Σ Wₕ² sₕ²/nₕ). |
| 1.4 | Predict and explain the **Central Limit Theorem** | Before the first 500-sample run, the player must **predict** the shape of the sample means (logged). The population is visibly right-skewed, yet the means form a bell whose spread matches σ/√n (both shown). |
| 1.5 | Build and interpret a **95% CI** and choose n | The final survey has a power budget. The player sees the expected margin 1.96·s/√n, chooses method and n, and then must make a claim **consistent with the interval**. Claims the interval doesn't support are penalised. |
| 1.6 | Explain **mean > median** under right skew | The population panel shows both. The debrief explains why the skew pulls the mean up. |

## Chapter II · Static: hypothesis testing

| # | Objective | Mechanic |
|---|---|---|
| 2.1 | State **H₀** and **H₁** | The player chooses which claim is H₀ ("nothing special": λ = 3/hr) and gets feedback. H₁: λ > 3/hr (one-sided). |
| 2.2 | Model rare events in a fixed window with **Poisson(λT)** | Null distribution bars P(X = k) = e^(−λT)(λT)^k/k!. The waking alternative (λ = 6/hr) is overlaid. Pulses in the cinematic are a real Poisson process (exponential inter-arrival times). |
| 2.3 | Compute and interpret a **p-value** | p = P(X ≥ k \| H₀), shaded as a tail, with the plain-language reading "if the Rift were quiet, a count this high would happen p of the time". |
| 2.4 | Explain **α**, **Type I/II errors**, **power**, and the trade-off | The player simulates 1,000 quiet and 1,000 waking nights under any α and window. False-alarm rate ≈ α. Power rises with a longer window and falls with a smaller α. The rule is **locked before the data** (pre-registration). The outcome is classified on the 2×2 error table, and a longer window costs relocation time. |

## Chapter III · Geyser Run: linear regression (real data)

| # | Objective | Mechanic |
|---|---|---|
| 3.1 | Read a **scatter plot** (direction, strength, form) | 272 real Old Faithful eruptions: duration (x) vs waiting time (y). |
| 3.2 | Fit **ŷ = b₀ + b₁x** and read its residuals | The player drags two handles. Residuals are drawn as signed segments, or as **squares** (area = e²). |
| 3.3 | Explain why least squares minimises **Σe²**, not Σe | Live Σe and SSE. The player is prompted to make Σe ≈ 0 with an obviously bad line. |
| 3.4 | Compute **b₁ = Sxy/Sxx**, **b₀ = ȳ − b₁x̄**; interpret **R² = 1 − SSE/SST** | The reveal shows x̄, ȳ, Sxx, Sxy, b₁ ≈ 10.73, b₀ ≈ 33.47, R² ≈ 0.811, and the line through (x̄, ȳ). The naive mean-guesser line can be toggled. |
| 3.5 | Use the **residual SD** to quantify prediction risk | Risk ≈ Φ((m + 13 − ŷ)/s). The true eruption time is the LS prediction plus a **bootstrapped real residual**, so a worse line leads to worse decisions. |

## Chapter IV · Blight: confounding and causation (real counts)

| # | Objective | Mechanic |
|---|---|---|
| 4.1 | **Stratify** to compare groups fairly | Split by nothing, by dome size, or by crew shift (a non-confounder, as a control). |
| 4.2 | Recognise **Simpson's paradox** | Overall B 83% > A 78%. Within small domes A 93% > B 87%, and within large domes A 73% > B 69% (real counts, Charig et al. 1986). |
| 4.3 | Identify a **confounder** | A "Who got which filter?" chart shows B went mostly to small domes, which are healthier anyway. The player must explain the reversal. |
| 4.4 | Use **Pearson r / Spearman ρ** and explain **correlation ≠ causation** | Drone visits vs blight severity gives r ≈ 0.7. The event timeline shows blight alarms always come before drone arrivals (**reverse causation**). Choosing "r = 0.7 means 70% caused" is offered as a tempting misconception. |

## Accuracy notes

- The sample variance uses n − 1. CIs use the normal approximation x̄ ± 1.96·s/√n, as in the lecture's CLT recipe.
- Poisson tail probabilities are summed exactly from the PMF (log-factorials). The rejection region is the smallest k* with P(X ≥ k*) ≤ α, and the exact achieved α is shown.
- OLS uses the closed form from the lecture. R² for a hand-drawn line uses the same 1 − SSE/SST, so it can be negative, which is correct for a line worse than the mean.
- The playtest dashboard's paired t-test uses the t-distribution CDF via the regularised incomplete beta function (checked: t = 3.024, df = 2 gives p = 0.094).
