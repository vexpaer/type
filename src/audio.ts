/** Short, procedural mechanical sounds; no requests, samples or autoplay. */
export class TypingAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = false;
  activate() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.gain.value = 0.25; this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(1, this.context.sampleRate * .12, this.context.sampleRate);
      const channel = this.noise.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }
  strike(retro: boolean, returnKey = false, delay = 0) {
    if (!this.enabled) return;
    this.activate();
    const ctx = this.context!, now = ctx.currentTime + delay;
    const source = ctx.createBufferSource(); source.buffer = this.noise;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = retro ? 1600 + Math.random() * 650 : 850; filter.Q.value = .7;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(retro ? .5 : .17, now); gain.gain.exponentialRampToValueAtTime(.001, now + (retro ? .055 : .025));
    source.connect(filter); filter.connect(gain); gain.connect(this.master!); source.start(now); source.stop(now + .07);
    if (retro) {
      const oscillator = ctx.createOscillator(), body = ctx.createGain(); oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(returnKey ? 140 : 190 + Math.random() * 50, now); oscillator.frequency.exponentialRampToValueAtTime(65, now + .045);
      body.gain.setValueAtTime(.16, now); body.gain.exponentialRampToValueAtTime(.001, now + .09); oscillator.connect(body); body.connect(this.master!); oscillator.start(now); oscillator.stop(now + .1);
    }
    if (retro && returnKey) this.bell(delay);
  }
  bell(delay = 0) {
    if (!this.enabled || !this.context) return;
    const ctx = this.context, now = ctx.currentTime + delay;
    for (const [frequency, volume] of [[1720, .1], [3451, .025]]) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(); oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + .65); oscillator.connect(gain); gain.connect(this.master!); oscillator.start(now); oscillator.stop(now + .7);
    }
  }
}
