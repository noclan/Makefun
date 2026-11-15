// Sound, synthesised with Web Audio — no audio files, nothing to fetch. Every effect is
// a tiny oscillator/noise recipe, pitch-varied ±6% through the seeded RNG so repeats never
// sound machine-gun identical. The context is created on the first user gesture (browsers
// block audio before one) and ducked to 0.6 while hitstop holds, so impacts read.

export function createAudio(random) {
  let context = null;
  let master = null;
  let duck = 1;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function vary(base) {
    return base * (1 + (random() - 0.5) * 0.12);
  }

  function tone(freq, duration, type, gainValue, slideTo) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(vary(freq), t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, vary(slideTo)), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainValue * duck, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noise(duration, gainValue, lowpass) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue * duck, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    /** Call from any user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    setDuck(value) {
      duck = value;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'square', 0.12);
    },
    loopClose(kills) {
      // Rising zap; bigger surges zap higher.
      tone(220 + kills * 40, 0.28, 'sawtooth', 0.22, 880 + kills * 60);
      noise(0.18, 0.18, 3200);
    },
    kill() {
      tone(180, 0.16, 'triangle', 0.2, 60);
      noise(0.1, 0.12, 1800);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.16, 1320);
    },
    heart() {
      tone(523, 0.14, 'sine', 0.18);
      tone(784, 0.2, 'sine', 0.18);
    },
    hit() {
      tone(110, 0.25, 'sawtooth', 0.28, 55);
      noise(0.2, 0.2, 900);
    },
    dash() {
      noise(0.14, 0.14, 5200);
    },
    waveClear() {
      tone(523, 0.12, 'square', 0.12);
      setTimeout(() => tone(659, 0.12, 'square', 0.12), 90);
      setTimeout(() => tone(784, 0.2, 'square', 0.14), 180);
    },
    bossHit() {
      tone(90, 0.3, 'square', 0.25, 45);
      noise(0.25, 0.2, 1200);
    },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'square', 0.14), i * 120));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.14), i * 140));
    },
  };
}
