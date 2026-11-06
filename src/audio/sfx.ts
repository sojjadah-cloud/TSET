/** Tiny synthesized sound engine (WebAudio) – no audio files needed. */
export type SfxKind = 'click' | 'tick' | 'confirm' | 'success' | 'deny' | 'alert' | 'whoosh';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicStarted = false;
  private volume = 0.6;
  private musicVolume = 0.25;

  private ensure() {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  configure(volume: number, music: number) {
    this.volume = volume;
    this.musicVolume = music;
    if (!this.ctx) return;
    this.master!.gain.value = volume;
    this.musicGain!.gain.setTargetAtTime(music * 0.1, this.ctx.currentTime, 0.8);
    if (music > 0 && !this.musicStarted) this.startMusic();
  }

  /** Called from the first user gesture (browser autoplay policy). */
  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.configure(this.volume, this.musicVolume);
  }

  private startMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    this.musicStarted = true;
    // Slow ambient pad with gentle LFO swells.
    const freqs = [110, 164.81, 220, 277.18, 329.63];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.connect(this.musicGain);
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 2) * 4;
      const g = ctx.createGain();
      g.gain.value = 0.1;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.013;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(g).connect(filter);
      o.start();
      lfo.start();
    });
  }

  play(kind: SfxKind) {
    if (this.volume <= 0) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const master = this.master;
    const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, toFreq?: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + start);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + start + dur);
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(gain, t + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(master);
      o.start(t + start);
      o.stop(t + start + dur + 0.05);
    };
    switch (kind) {
      case 'click':
        tone(880, 0, 0.08, 'sine', 0.07);
        break;
      case 'tick':
        tone(1320, 0, 0.05, 'sine', 0.04);
        break;
      case 'confirm':
        tone(523, 0, 0.18, 'sine', 0.11);
        tone(784, 0.09, 0.24, 'sine', 0.09);
        break;
      case 'success':
        tone(659, 0, 0.14, 'triangle', 0.09);
        tone(880, 0.08, 0.14, 'triangle', 0.09);
        tone(1175, 0.16, 0.3, 'sine', 0.07);
        break;
      case 'deny':
        tone(220, 0, 0.18, 'triangle', 0.09, 180);
        break;
      case 'alert':
        tone(740, 0, 0.16, 'sine', 0.09);
        tone(740, 0.22, 0.16, 'sine', 0.09);
        break;
      case 'whoosh':
        tone(300, 0, 0.35, 'sine', 0.04, 900);
        break;
    }
  }
}

export const sfx = new SoundEngine();
