// WebAudio synth: no audio files, everything is oscillators + noise.
export class AudioEngine {
  constructor() { this.ctx = null; this.muted = false; this.musicOn = false; this.engineOsc = null; this.engineGain = null; this._musicTimer = 0; this._tune = null; }
  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.35; }
  engine(speedRatio) {
    if (!this.ctx || this.muted) return;
    this.engineOsc.frequency.value = 48 + speedRatio * 130;
    this.engineGain.gain.value = 0.02 + speedRatio * 0.05;
  }
  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }
  noise(dur, vol = 0.25, low = 800) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  shot() { this.noise(0.14, 0.4, 2400); this.blip(180, 0.08, 'square', 0.12); }
  siren(on) { this._siren = on; }
  sirenTick(time) {
    if (!this.ctx || this.muted || !this._siren) return;
    const f = 720 + Math.sin(time * 4.2) * 260;
    this.blip(f, 0.09, 'sine', 0.045);
  }
  pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(990, 0.12), 70); }
  jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 110)); }
  crash() { this.noise(0.3, 0.4, 500); }
  startMusic() { this.musicOn = true; }
  setStation(tune) { this._tune = tune || null; }
  musicTick(dt, time) {
    if (!this.ctx || this.muted || !this.musicOn) return;
    const step = (this._tune && this._tune.step) || 0.42;
    this._musicTimer += dt;
    if (this._musicTimer < step) return; this._musicTimer = 0;
    const tune = this._tune || { bass: [110, 110, 130.8, 98], lead: 440, wave: 'triangle' };
    const beat = Math.floor(time / step) % 4;
    this.blip(tune.bass[beat], 0.3, tune.wave, 0.07);
    if (beat % 2 === 0) this.blip(tune.lead + Math.sin(time) * 60, 0.12, 'sine', 0.03);
  }
}
