// Sound, all synthesized with WebAudio — no audio files, no network. An
// engine hum that follows the car's speed, two-tone sirens when the heat is
// on, gunshots, pickup blips, a mission jingle, and a slow synthwave bass
// loop for the drive. Everything is guarded: in a headless screenshot run
// there is no user gesture, so the context may stay suspended and every call
// must simply do nothing.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let musicTimer = 0;
  let musicStep = 0;

  const BASSLINE = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4, 55, 0, 55, 65.4, 98, 82.4, 73.4, 65.4];

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function blip(freq, seconds, type, volume) {
    const c = ensure();
    if (!c || muted || c.state !== 'running') return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume || 0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + seconds);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + seconds);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noiseBurst(seconds, volume) {
    const c = ensure();
    if (!c || muted || c.state !== 'running') return;
    try {
      const len = Math.floor(c.sampleRate * seconds);
      const buffer = c.createBuffer(1, len, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = c.createBufferSource();
      source.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(c.destination);
      source.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return muted;
    },
    shot() {
      noiseBurst(0.12, 0.25);
    },
    crash() {
      noiseBurst(0.2, 0.18);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.14);
      setTimeout(() => blip(1318, 0.14, 'sine', 0.12), 70);
    },
    jingle() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.22, 'triangle', 0.14), i * 110);
      });
    },
    // Called every step with the live game state: engine, sirens, music.
    update(g, dt) {
      const c = ensure();
      if (!c || muted || c.state !== 'running') return;
      const p = g.player;
      if (engineOsc && engineGain) {
        const speed = p.car ? Math.abs(p.car.speed) : 0;
        engineOsc.frequency.value = 55 + speed * 0.16;
        engineGain.gain.value = p.car ? 0.035 + Math.min(0.03, speed / 20000) : 0;
      }
      if (sirenOsc && sirenGain) {
        const wanted = g.wanted.stars > 0 && g.cops.length > 0;
        sirenTimer += dt;
        if (sirenTimer > 0.45) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.value = sirenHigh ? 950 : 700;
        }
        sirenGain.gain.value = wanted ? 0.022 : 0;
      }
      // A slow bassline, one note every half second, only while playing.
      musicTimer += dt;
      if (musicTimer > 0.5) {
        musicTimer = 0;
        const note = BASSLINE[musicStep % BASSLINE.length];
        musicStep += 1;
        if (note > 0) blip(note, 0.42, 'triangle', 0.05);
      }
    },
  };
}
