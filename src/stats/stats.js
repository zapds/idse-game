// Statistics engine. Every number shown in the game is computed here from data —
// nothing is hard-coded. Formulas follow the CS3006 lecture notes.

export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : NaN);

export function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Sample variance divides by n − 1 (Bessel's correction)
export function variance(a, sample = true) {
  const n = a.length;
  if (n < 2) return 0;
  const m = mean(a);
  let ss = 0;
  for (const x of a) ss += (x - m) ** 2;
  return ss / (sample ? n - 1 : n);
}
export const sd = (a, sample = true) => Math.sqrt(variance(a, sample));

// Linear-interpolated quantile (type 7, same as numpy default)
export function quantile(a, q) {
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

// Ranks with ties given the average rank
export function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
export const spearman = (x, y) => pearson(ranks(x), ranks(y));

// Ordinary least squares: b1 = Sxy / Sxx, b0 = ȳ − b1·x̄
export function linreg(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const b1 = sxy / sxx;
  const b0 = my - b1 * mx;
  const fit = lineStats(x, y, b0, b1);
  return { b0, b1, mx, my, sxx, sxy, ...fit };
}

// Fit statistics for ANY line (used to score the player's hand-drawn line)
export function lineStats(x, y, b0, b1) {
  const n = x.length;
  const my = mean(y);
  let sse = 0, sst = 0, sumE = 0;
  for (let i = 0; i < n; i++) {
    const e = y[i] - (b0 + b1 * x[i]);
    sse += e * e; sumE += e; sst += (y[i] - my) ** 2;
  }
  return { sse, sst, sumE, r2: 1 - sse / sst, se: Math.sqrt(sse / (n - 2)) };
}

export function residuals(x, y, b0, b1) { return x.map((xi, i) => y[i] - (b0 + b1 * xi)); }

// ---------- Distributions ----------
const LOG_FACT = [0];
export function logFact(n) {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);
  return LOG_FACT[n];
}
export const poissonPMF = (k, lam) => (k < 0 ? 0 : Math.exp(-lam + k * Math.log(lam) - logFact(k)));
export function poissonCDF(k, lam) { let s = 0; for (let i = 0; i <= k; i++) s += poissonPMF(i, lam); return Math.min(1, s); }
// Upper-tail p-value P(X ≥ k)
export const poissonSF = (k, lam) => (k <= 0 ? 1 : Math.max(0, 1 - poissonCDF(k - 1, lam)));
// Smallest count k* with P(X ≥ k*) ≤ α  → rejection region is X ≥ k*
export function poissonCritical(lam, alpha) { let k = 0; while (poissonSF(k, lam) > alpha) k++; return k; }

export function binomPMF(k, n, p) {
  if (k < 0 || k > n) return 0;
  return Math.exp(logFact(n) - logFact(k) - logFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

// Error function (Abramowitz–Stegun 7.1.26), |error| < 1.5e-7
export function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normalCDF = (x, mu = 0, sigma = 1) => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
export const normalPDF = (x, mu = 0, sigma = 1) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

// t-distribution CDF via regularized incomplete beta (for the playtest paired t-test)
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function lgamma(z) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export function tCDF(t, df) {
  const x = df / (df + t * t);
  const p = 0.5 * ibeta(x, df / 2, 0.5);
  return t > 0 ? 1 - p : p;
}
// Two-sided critical t for 95%
export function tCrit95(df) {
  let lo = 0, hi = 50;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (tCDF(m, df) < 0.975) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// Paired t-test (used by the playtest dashboard: pre-test vs post-test)
export function pairedT(before, after) {
  const d = after.map((a, i) => a - before[i]);
  const n = d.length, md = mean(d), s = sd(d);
  const t = md / (s / Math.sqrt(n));
  const p = 2 * (1 - tCDF(Math.abs(t), n - 1));
  return { n, meanDiff: md, sdDiff: s, t, df: n - 1, p };
}

// Confidence interval for a mean (normal approximation, as in the lecture's CLT recipe)
export function meanCI(a, z = 1.96) {
  const m = mean(a), se = sd(a) / Math.sqrt(a.length);
  return { mean: m, se, lo: m - z * se, hi: m + z * se, half: z * se };
}

export function histogram(values, lo, hi, bins) {
  const counts = new Array(bins).fill(0);
  const w = (hi - lo) / bins;
  for (const v of values) {
    let b = Math.floor((v - lo) / w);
    if (b < 0) b = 0; if (b >= bins) b = bins - 1;
    counts[b]++;
  }
  return { counts, lo, hi, w, bins };
}

export const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
export const pct = (x, d = 1) => (Number.isFinite(x) ? (100 * x).toFixed(d) + '%' : '—');
