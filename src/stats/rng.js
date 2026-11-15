// Seeded random number generation + samplers for the distributions used in the game.
// Everything random in HALCYON flows through here, so a run can be reproduced from its seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.seed = seed >>> 0;
    this.u = mulberry32(this.seed);
    this._spare = null;
  }
  random() { return this.u(); }
  uniform(a, b) { return a + (b - a) * this.u(); }
  int(a, b) { return a + Math.floor(this.u() * (b - a + 1)); } // inclusive
  pick(arr) { return arr[Math.floor(this.u() * arr.length)]; }
  // Standard normal via Box–Muller
  normal(mu = 0, sigma = 1) {
    if (this._spare !== null) { const s = this._spare; this._spare = null; return mu + sigma * s; }
    let u = 0, v = 0;
    while (u === 0) u = this.u();
    v = this.u();
    const r = Math.sqrt(-2 * Math.log(u));
    this._spare = r * Math.sin(2 * Math.PI * v);
    return mu + sigma * r * Math.cos(2 * Math.PI * v);
  }
  lognormal(mu, sigma) { return Math.exp(this.normal(mu, sigma)); }
  // Poisson: Knuth for small lambda, normal approximation fallback for large
  poisson(lambda) {
    if (lambda < 40) {
      const L = Math.exp(-lambda);
      let k = 0, p = 1;
      do { k++; p *= this.u(); } while (p > L);
      return k - 1;
    }
    return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
  }
  exponential(rate) { return -Math.log(1 - this.u()) / rate; }
  // Fisher–Yates partial shuffle: k distinct indices from 0..n-1
  sampleIndices(n, k) {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.u() * (n - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, k);
  }
}

export const globalRng = new RNG();
