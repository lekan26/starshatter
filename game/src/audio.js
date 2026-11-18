// Starshatter — every sound is synthesized live with WebAudio.
// No audio files, no network: a handful of oscillators and noise bursts
// shaped into blips, shatters and jingles. Sound starts only after the
// player's first gesture, as browsers require.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  // Call from a user gesture (click or key). Safe to call often.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // A short tone that slides from one frequency to another.
  tone(freqA, freqB, seconds, type, volume) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  // A burst of filtered noise, for shatters and thuds.
  noise(seconds, volume, cutoff) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
  }

  paddle() {
    this.tone(340, 260, 0.07, 'triangle', 0.5);
  }

  // Pitch climbs with the combo, so a hot streak sounds hot.
  brick(combo) {
    const step = Math.min(combo, 16);
    const base = 520 * Math.pow(1.045, step);
    this.tone(base, base * 1.6, 0.09, 'square', 0.22);
    this.noise(0.08, 0.25, 5200);
  }

  armored() {
    this.tone(220, 180, 0.06, 'square', 0.3);
    this.noise(0.05, 0.2, 3200);
  }

  power() {
    this.tone(660, 990, 0.12, 'sine', 0.4);
    this.tone(990, 1320, 0.12, 'sine', 0.25);
  }

  lance() {
    this.tone(880, 520, 0.05, 'sawtooth', 0.12);
  }

  boltBlock() {
    this.tone(300, 520, 0.08, 'triangle', 0.35);
  }

  lose() {
    this.tone(220, 55, 0.5, 'sawtooth', 0.4);
    this.noise(0.35, 0.3, 900);
  }

  clear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      window.setTimeout(() => this.tone(f, f, 0.16, 'triangle', 0.35), i * 90);
    });
  }

  win() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => {
      window.setTimeout(() => this.tone(f, f * 1.01, 0.22, 'triangle', 0.35), i * 110);
    });
  }

  over() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => {
      window.setTimeout(() => this.tone(f, f * 0.97, 0.28, 'sawtooth', 0.25), i * 150);
    });
  }

  click() {
    this.tone(700, 900, 0.05, 'sine', 0.3);
  }
}
