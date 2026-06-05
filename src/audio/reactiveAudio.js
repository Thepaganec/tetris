/** Создаёт короткие синтетические звуки для действий и событий игры. */
export class ReactiveAudio {
  constructor(isMuted) {
    this.isMuted = isMuted;
    this.context = null;
  }

  /** Разблокирует Web Audio после пользовательского жеста. */
  async unlock() {
    if (this.isMuted) return;
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  /** Переключает звук и возвращает новое состояние. */
  setMuted(isMuted) {
    this.isMuted = isMuted;
    if (isMuted && this.context && this.context.state === "running") {
      this.context.suspend();
    }
    return this.isMuted;
  }

  /** Проигрывает звук, соответствующий игровому событию. */
  playEvent(event) {
    if (this.isMuted || !this.context || this.context.state !== "running") return;

    if (event.type === "move") this.playTone(180, 0.035, "triangle", 0.025);
    if (event.type === "rotate") this.playTone(360, 0.05, "square", 0.035);
    if (event.type === "softDrop") this.playTone(120, 0.035, "sawtooth", 0.018);
    if (event.type === "hold") this.playTone(260, 0.08, "triangle", 0.045);
    if (event.type === "hardDrop") this.playImpact(85, 0.18, 0.11);
    if (event.type === "lineClear") this.playLineClear(event.count, event.combo);
    if (event.type === "reactorBurst") this.playImpact(62, 0.42, 0.18);
    if (event.type === "gameOver") this.playImpact(48, 0.5, 0.15);
  }

  playLineClear(count, combo) {
    const base = 300 + count * 80;
    this.playTone(base, 0.1, "triangle", 0.07);
    this.playTone(base * 1.5 + combo * 16, 0.16, "sawtooth", 0.04, 0.025);
    this.playNoise(0.12, 0.06);
  }

  playImpact(frequency, duration, gain) {
    this.playTone(frequency, duration, "sawtooth", gain);
    this.playNoise(duration * 0.65, gain * 0.55);
  }

  playTone(frequency, duration, type, peakGain, delay = 0) {
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.62), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  playNoise(duration, peakGain) {
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    source.buffer = buffer;
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(gain);
    gain.connect(this.context.destination);
    source.start(now);
    source.stop(now + duration);
  }
}
