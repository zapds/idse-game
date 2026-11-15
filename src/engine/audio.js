// Procedural audio with WebAudio: ambient pad, engine hum, UI blips, seismic thumps, geyser roar.
class AudioEngine {
  constructor() { this.ctx = null; this.muted = false; this.vol = 0.7; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.vol; this.master.connect(this.ctx.destination);
    // reverb-ish delay bus
    this.fx = this.ctx.createDelay(1); this.fx.delayTime.value = 0.32;
    const fb = this.ctx.createGain(); fb.gain.value = 0.35; this.fx.connect(fb); fb.connect(this.fx);
    const fxOut = this.ctx.createGain(); fxOut.gain.value = 0.25; this.fx.connect(fxOut); fxOut.connect(this.master);
    this._ambient(); this._engine();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.1); }
  _noiseBuf() {
    if (this._nb) return this._nb;
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this._nb = b);
  }
  _ambient() {
    const c = this.ctx; const g = c.createGain(); g.gain.value = 0.06; g.connect(this.master);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 2; f.connect(g);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05; const lg = c.createGain(); lg.gain.value = 380; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    [55, 82.4, 110, 164.8, 220.5].forEach((fr, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = fr; o.detune.value = (i - 2) * 6;
      const og = c.createGain(); og.gain.value = 0.35 / (i + 1); o.connect(og); og.connect(f); o.start();
    });
    // wind
    const n = c.createBufferSource(); n.buffer = this._noiseBuf(); n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 0.6;
    const ng = c.createGain(); ng.gain.value = 0.05; n.connect(nf); nf.connect(ng); ng.connect(this.master); n.start();
    this.ambientGain = g;
  }
  _engine() {
    const c = this.ctx; this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 40;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    this.engGain = c.createGain(); this.engGain.gain.value = 0; this.engOsc.connect(f); f.connect(this.engGain); this.engGain.connect(this.master); this.engOsc.start();
  }
  engine(speed) {
    if (!this.ctx) return; const s = Math.min(1, Math.abs(speed) / 27);
    this.engOsc.frequency.setTargetAtTime(38 + s * 70, this.ctx.currentTime, 0.1);
    this.engGain.gain.setTargetAtTime(0.012 + s * 0.05, this.ctx.currentTime, 0.1);
  }
  tone(freq, dur = 0.12, type = 'sine', vol = 0.15, slide = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); g.connect(this.fx); o.start(t); o.stop(t + dur + 0.05);
  }
  blip() { this.tone(880, 0.08, 'triangle', 0.08); }
  click() { this.tone(1400, 0.04, 'square', 0.03); }
  confirm() { this.tone(660, 0.1, 'triangle', 0.1); setTimeout(() => this.tone(990, 0.16, 'triangle', 0.1), 90); }
  error() { this.tone(220, 0.2, 'sawtooth', 0.08, -80); }
  probe() { this.tone(300, 0.25, 'sine', 0.18, 600); setTimeout(() => this.tone(1200, 0.1, 'triangle', 0.08), 220); }
  thump(strength = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.5 * strength, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.8);
    this.noise(0.4, 300, 0.12 * strength);
  }
  noise(dur = 1, freq = 800, vol = 0.2, q = 0.8) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = this._noiseBuf();
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.3, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t); n.stop(t + dur + 0.1);
  }
  geyser() { this.noise(6, 500, 0.35, 0.4); this.noise(5, 160, 0.4, 0.6); }
  chord(good = true) {
    const notes = good ? [523, 659, 784, 1046] : [392, 466, 554];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.9, 'triangle', 0.07), i * 110));
  }
}
export const audio = new AudioEngine();
