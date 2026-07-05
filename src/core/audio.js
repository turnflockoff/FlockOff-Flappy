// Procedural chiptune audio: WebAudio square/triangle/noise synth,
// pattern-based music sequencer, synthesized SFX, and a robot voice
// via SpeechSynthesis (with a glitch-tone fallback).

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Build an arpeggio track from chord tones: one eighth note per 2 steps.
function arp(chords, stepsPerBar, bars) {
  const notes = [];
  for (let b = 0; b < bars; b++) {
    const tones = chords[b % chords.length];
    for (let s = 0; s < stepsPerBar; s += 2) {
      notes.push([b * stepsPerBar + s, tones[(s / 2) % tones.length], 2]);
    }
  }
  return notes;
}

function bassLine(roots, stepsPerBar) {
  const notes = [];
  roots.forEach((r, b) => {
    for (let s = 0; s < stepsPerBar; s += 2) notes.push([b * stepsPerBar + s, r, 1]);
  });
  return notes;
}

const SONGS = {
  main: {
    bpm: 132,
    steps: 64,
    tracks: [
      { wave: 'square', vol: 0.10, notes: [
        [0, 72, 2], [2, 76, 2], [4, 79, 4], [8, 76, 2], [10, 72, 2], [12, 74, 4],
        [16, 69, 2], [18, 72, 2], [20, 76, 4], [24, 72, 2], [26, 69, 2], [28, 71, 4],
        [32, 69, 2], [34, 72, 2], [36, 77, 4], [40, 76, 2], [42, 74, 2], [44, 72, 4],
        [48, 71, 2], [50, 74, 2], [52, 79, 2], [54, 74, 2], [56, 71, 2], [58, 67, 2], [60, 74, 4],
      ] },
      { wave: 'square', vol: 0.045, notes: arp([[60, 64, 67, 64], [57, 60, 64, 60], [53, 57, 60, 57], [55, 59, 62, 59]], 16, 4) },
      { wave: 'triangle', vol: 0.16, notes: bassLine([36, 33, 29, 31], 16) },
    ],
    drums: { hat: 2, snare: [4, 12], kick: [0, 8] },
  },
  danger: {
    bpm: 150,
    steps: 32,
    tracks: [
      { wave: 'square', vol: 0.09, notes: [
        [0, 76, 2], [4, 79, 2], [8, 78, 2], [12, 74, 2],
        [16, 76, 2], [20, 71, 2], [24, 72, 2], [28, 70, 3],
      ] },
      { wave: 'square', vol: 0.05, notes: arp([[64, 67, 71, 67], [62, 66, 69, 66]], 16, 2) },
      { wave: 'triangle', vol: 0.18, notes: (() => {
        const n = [];
        for (let s = 0; s < 16; s++) n.push([s, s % 4 === 3 ? 40 : 28, 1]);
        for (let s = 0; s < 8; s++) n.push([16 + s, 31, 1]);
        for (let s = 0; s < 8; s++) n.push([24 + s, 30, 1]);
        return n;
      })() },
    ],
    drums: { hat: 1, snare: [4, 12, 20, 28], kick: [0, 8, 16, 24] },
  },
  hope: {
    bpm: 100,
    steps: 64,
    tracks: [
      { wave: 'square', vol: 0.08, notes: [
        [0, 76, 8], [8, 79, 6], [16, 81, 8], [24, 79, 6],
        [32, 77, 8], [40, 76, 6], [48, 74, 12],
      ] },
      { wave: 'triangle', vol: 0.10, notes: arp([[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], 16, 4) },
      { wave: 'triangle', vol: 0.14, notes: bassLine([36, 31, 33, 29], 16) },
    ],
    drums: null,
  },
};

export class AudioSys {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.song = null;
    this.songName = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.noiseBuf = null;
  }

  // Must be called from a user gesture.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.applySettings();
    // shared noise buffer for drums / sfx
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this._pump(), 90);
    if (this.songName) this._startSong(this.songName);
  }

  applySettings() {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.settings.music ? 0.9 : 0;
    this.sfxGain.gain.value = this.settings.sfx ? 0.9 : 0;
  }

  playSong(name) {
    if (this.songName === name) return;
    this.songName = name;
    if (this.ctx) this._startSong(name);
  }

  stopSong() {
    this.songName = null;
    this.song = null;
  }

  _startSong(name) {
    this.song = SONGS[name] || null;
    this.step = 0;
    if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.06;
  }

  _pump() {
    if (!this.ctx || !this.song) return;
    const spb = 60 / this.song.bpm / 4; // seconds per 16th step
    while (this.nextStepTime < this.ctx.currentTime + 0.22) {
      const s = this.step % this.song.steps;
      for (const tr of this.song.tracks) {
        for (const [st, midi, len] of tr.notes) {
          if (st === s && midi > 0) this._tone(tr.wave, midiHz(midi), this.nextStepTime, len * spb * 0.9, tr.vol, this.musicGain);
        }
      }
      const dr = this.song.drums;
      if (dr) {
        if (dr.hat && s % dr.hat === 0) this._noise(this.nextStepTime, 0.03, 0.025, 6000, this.musicGain);
        if (dr.snare && dr.snare.includes(s % 16)) this._noise(this.nextStepTime, 0.09, 0.06, 1800, this.musicGain);
        if (dr.kick && dr.kick.includes(s % 16)) this._kick(this.nextStepTime);
      }
      this.step++;
      this.nextStepTime += spb;
    }
  }

  _tone(wave, freq, t, dur, vol, dest, slideTo = 0) {
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(t, dur, vol, cutoff, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 1;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest || this.sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.14);
  }

  // ---- SFX ----
  _now() { return this.ctx ? this.ctx.currentTime : 0; }
  _ok() { return !!this.ctx && this.settings.sfx; }

  flap() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone('square', 320, t, 0.07, 0.08, this.sfxGain, 640);
    this._noise(t, 0.05, 0.03, 2500);
  }

  coin() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone('square', 988, t, 0.06, 0.09);
    this._tone('square', 1319, t + 0.06, 0.16, 0.09);
  }

  hit() {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.25, 0.14, 400);
    this._tone('square', 400, t, 0.3, 0.12, this.sfxGain, 60);
  }

  explosion() {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.5, 0.16, 150);
    this._tone('sine', 150, t, 0.4, 0.18, this.sfxGain, 30);
  }

  warning() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone('square', 220, t, 0.09, 0.09);
    this._tone('square', 220, t + 0.14, 0.09, 0.09);
  }

  menu() {
    if (!this._ok()) return;
    this._tone('square', 700, this._now(), 0.05, 0.06);
  }

  denied() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone('square', 160, t, 0.12, 0.08);
    this._tone('square', 120, t + 0.1, 0.16, 0.08);
  }

  purchase() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone('square', 784, t, 0.06, 0.08);
    this._tone('square', 988, t + 0.07, 0.06, 0.08);
    this._tone('square', 1319, t + 0.14, 0.18, 0.08);
  }

  achievement() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone('square', 659, t, 0.08, 0.07);
    this._tone('square', 784, t + 0.09, 0.08, 0.07);
    this._tone('square', 1047, t + 0.18, 0.24, 0.08);
  }

  swoosh() {
    if (!this._ok()) return;
    this._noise(this._now(), 0.2, 0.08, 900);
  }

  glitch() {
    if (!this._ok()) return;
    const t = this._now();
    for (let i = 0; i < 8; i++) {
      this._tone('square', 100 + Math.random() * 1800, t + i * 0.05, 0.04, 0.06);
      this._noise(t + i * 0.05 + 0.02, 0.03, 0.05, 2000);
    }
  }

  portal() {
    if (!this._ok()) return;
    const t = this._now();
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      this._tone('triangle', f, t + i * 0.09, 0.3, 0.09));
  }

  flash() {
    if (!this._ok()) return;
    this._tone('square', 1800, this._now(), 0.05, 0.03, this.sfxGain, 2400);
  }

  robotVoice(text) {
    if (!this.settings.voice) return;
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = 0.1;
        u.rate = 0.75;
        u.volume = this.settings.sfx ? 1 : 0;
        window.speechSynthesis.speak(u);
        return;
      }
    } catch { /* fall through to tones */ }
    if (this._ok()) {
      const t = this._now();
      for (let i = 0; i < text.length; i++) {
        if (text[i] !== ' ') this._tone('square', 90 + (text.charCodeAt(i) % 7) * 22, t + i * 0.07, 0.06, 0.07);
      }
    }
  }
}
