// Minimal crisp canvas plotting used by all the labs.
export const C = {
  grid: 'rgba(190,170,255,0.10)', axis: 'rgba(190,170,255,0.35)', text: '#a69fc9', textHi: '#ece8ff',
  cyan: '#5ff2ff', amber: '#ffb86b', coral: '#ff7a59', violet: '#b48cff', green: '#7dffb2', red: '#ff5d6c', white: '#ffffff',
};

export class Plot {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.o = { pad: { l: 46, r: 14, t: 14, b: 34 }, xlabel: '', ylabel: '', height: 260, ...opts };
    this.resize();
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth || this.cv.parentElement?.clientWidth || 500;
    const hgt = this.o.height;
    this.cv.style.height = hgt + 'px';
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(hgt * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = hgt;
  }
  setDomain(xmin, xmax, ymin, ymax) { Object.assign(this.o, { xmin, xmax, ymin, ymax }); }
  get pl() { return this.o.pad.l; } get pr() { return this.W - this.o.pad.r; }
  get pt() { return this.o.pad.t; } get pb() { return this.H - this.o.pad.b; }
  sx(x) { return this.pl + ((x - this.o.xmin) / (this.o.xmax - this.o.xmin)) * (this.pr - this.pl); }
  sy(y) { return this.pb - ((y - this.o.ymin) / (this.o.ymax - this.o.ymin)) * (this.pb - this.pt); }
  ix(px) { return this.o.xmin + ((px - this.pl) / (this.pr - this.pl)) * (this.o.xmax - this.o.xmin); }
  iy(py) { return this.o.ymin + ((this.pb - py) / (this.pb - this.pt)) * (this.o.ymax - this.o.ymin); }
  clear() { this.ctx.clearRect(0, 0, this.W, this.H); }

  axes({ xticks, yticks, xfmt = (v) => v, yfmt = (v) => v, gridY = true, gridX = false } = {}) {
    const c = this.ctx; c.save();
    c.font = '11px "JetBrains Mono", monospace'; c.fillStyle = C.text; c.strokeStyle = C.grid; c.lineWidth = 1;
    const xt = xticks ?? niceTicks(this.o.xmin, this.o.xmax, 6);
    const yt = yticks ?? niceTicks(this.o.ymin, this.o.ymax, 5);
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const v of yt) { const y = this.sy(v); if (gridY) { c.beginPath(); c.moveTo(this.pl, y); c.lineTo(this.pr, y); c.stroke(); } c.fillText(yfmt(v), this.pl - 6, y); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const v of xt) { const x = this.sx(v); if (gridX) { c.beginPath(); c.moveTo(x, this.pt); c.lineTo(x, this.pb); c.stroke(); } c.fillText(xfmt(v), x, this.pb + 6); }
    c.strokeStyle = C.axis; c.beginPath(); c.moveTo(this.pl, this.pt); c.lineTo(this.pl, this.pb); c.lineTo(this.pr, this.pb); c.stroke();
    if (this.o.xlabel) { c.fillStyle = C.text; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(this.o.xlabel, this.pr, this.H - 1); }
    if (this.o.ylabel) { c.save(); c.translate(11, this.pt); c.rotate(-Math.PI / 2); c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(this.o.ylabel, 0, 0); c.restore(); }
    c.restore();
  }

  // bars: array of {x0,x1,y,color}
  bars(list, { alpha = 1, stroke = null } = {}) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha;
    for (const b of list) {
      const x0 = this.sx(b.x0), x1 = this.sx(b.x1), y = this.sy(b.y), y0 = this.sy(Math.max(this.o.ymin, 0));
      c.fillStyle = b.color; c.fillRect(x0 + 0.5, Math.min(y, y0), Math.max(1, x1 - x0 - 1), Math.abs(y0 - y));
      if (stroke) { c.strokeStyle = stroke; c.strokeRect(x0 + 0.5, Math.min(y, y0), Math.max(1, x1 - x0 - 1), Math.abs(y0 - y)); }
    }
    c.restore();
  }
  hist(h, color, { alpha = 1, scale = 1 } = {}) {
    this.bars(h.counts.map((n, i) => ({ x0: h.lo + i * h.w, x1: h.lo + (i + 1) * h.w, y: n * scale, color })), { alpha });
  }
  points(xs, ys, { color = C.cyan, r = 3, alpha = 0.85 } = {}) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.fillStyle = typeof color === 'string' ? color : null;
    for (let i = 0; i < xs.length; i++) { if (typeof color === 'function') c.fillStyle = color(i); c.beginPath(); c.arc(this.sx(xs[i]), this.sy(ys[i]), r, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  line(x0, y0, x1, y1, { color = C.amber, width = 2, dash = null, alpha = 1 } = {}) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(this.sx(x0), this.sy(y0)); c.lineTo(this.sx(x1), this.sy(y1)); c.stroke(); c.restore();
  }
  path(xs, ys, { color = C.cyan, width = 2, fill = null } = {}) {
    const c = this.ctx; c.save(); c.strokeStyle = color; c.lineWidth = width; c.beginPath();
    xs.forEach((x, i) => (i ? c.lineTo(this.sx(x), this.sy(ys[i])) : c.moveTo(this.sx(x), this.sy(ys[i]))));
    if (fill) { c.lineTo(this.sx(xs[xs.length - 1]), this.sy(0)); c.lineTo(this.sx(xs[0]), this.sy(0)); c.closePath(); c.fillStyle = fill; c.fill(); }
    else c.stroke();
    c.restore();
  }
  vline(x, { color = C.amber, label = '', dash = null, width = 2, top = true } = {}) {
    if (x < this.o.xmin || x > this.o.xmax) return;
    const c = this.ctx; c.save(); c.strokeStyle = color; c.lineWidth = width; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(this.sx(x), this.pt); c.lineTo(this.sx(x), this.pb); c.stroke();
    if (label) { c.setLineDash([]); c.font = '600 11px "JetBrains Mono", monospace'; c.fillStyle = color; c.textAlign = this.sx(x) > this.W * 0.8 ? 'right' : 'left'; c.textBaseline = 'top'; c.fillText(label, this.sx(x) + (c.textAlign === 'right' ? -5 : 5), top ? this.pt + 2 : this.pb - 16); }
    c.restore();
  }
  hline(y, opts = {}) { this.line(this.o.xmin, y, this.o.xmax, y, opts); }
  shadeX(x0, x1, color = 'rgba(255,122,89,0.15)') { const c = this.ctx; c.fillStyle = color; c.fillRect(this.sx(Math.max(x0, this.o.xmin)), this.pt, this.sx(Math.min(x1, this.o.xmax)) - this.sx(Math.max(x0, this.o.xmin)), this.pb - this.pt); }
  rect(x0, y0, x1, y1, fill, stroke) {
    const c = this.ctx; const X0 = this.sx(x0), X1 = this.sx(x1), Y0 = this.sy(y0), Y1 = this.sy(y1);
    if (fill) { c.fillStyle = fill; c.fillRect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0)); }
    if (stroke) { c.strokeStyle = stroke; c.strokeRect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0)); }
  }
  text(x, y, s, { color = C.textHi, align = 'left', base = 'middle', font = '12px "JetBrains Mono", monospace', px = false } = {}) {
    const c = this.ctx; c.save(); c.fillStyle = color; c.font = font; c.textAlign = align; c.textBaseline = base;
    c.fillText(s, px ? x : this.sx(x), px ? y : this.sy(y)); c.restore();
  }
  clip(fn) { const c = this.ctx; c.save(); c.beginPath(); c.rect(this.pl, this.pt, this.pr - this.pl, this.pb - this.pt); c.clip(); fn(); c.restore(); }
}

export function niceTicks(lo, hi, n = 5) {
  const span = hi - lo; if (!(span > 0)) return [lo];
  const step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const err = step0 / mag; const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

// Make a canvas element sized to its container
export function canvasEl(height = 260) {
  const cv = document.createElement('canvas'); cv.className = 'chart'; cv.style.height = height + 'px'; return cv;
}
