/** Coupled, damped bending strips. Fixed steps keep impulses stable on slow frames. */
export class PaperPhysics {
  constructor(count = 18) {
    this.offsets = new Float64Array(count);
    this.velocities = new Float64Array(count);
    this.twist = 0;
    this.twistVelocity = 0;
    this.accumulator = 0;
  }

  impulse(strength = 1, side = 0) {
    for (let i = 1; i < this.offsets.length; i++) {
      const t = i / (this.offsets.length - 1);
      this.velocities[i] += strength * t * t * .24;
    }
    this.twistVelocity += side * strength * .12;
  }

  step(elapsed) {
    this.accumulator += Math.min(Math.max(elapsed, 0), .08);
    const dt = 1 / 120;
    while (this.accumulator >= dt) {
      const last = this.offsets.length - 1;
      for (let i = 1; i <= last; i++) {
        const t = i / last;
        const next = this.offsets[Math.min(i + 1, last)];
        const coupling = this.offsets[i - 1] + next - 2 * this.offsets[i];
        const force = -(65 - t * 35) * this.offsets[i] + coupling * 95 - this.velocities[i] * 5.8;
        this.velocities[i] += force * dt;
      }
      for (let i = 1; i <= last; i++) this.offsets[i] += this.velocities[i] * dt;
      this.twistVelocity += (-42 * this.twist - 6.4 * this.twistVelocity) * dt;
      this.twist += this.twistVelocity * dt;
      this.accumulator -= dt;
    }
  }

  sample(t) {
    const index = Math.min(1, Math.max(0, t)) * (this.offsets.length - 1);
    const low = Math.floor(index), high = Math.min(low + 1, this.offsets.length - 1);
    return this.offsets[low] + (this.offsets[high] - this.offsets[low]) * (index - low);
  }

  get moving() {
    return Math.abs(this.twistVelocity) + Math.abs(this.twist) > .0001 ||
      this.offsets.some((value, i) => Math.abs(value) + Math.abs(this.velocities[i]) > .0001);
  }

  reset() {
    this.offsets.fill(0); this.velocities.fill(0);
    this.twist = 0; this.twistVelocity = 0; this.accumulator = 0;
  }
}
