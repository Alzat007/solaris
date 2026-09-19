/** Locally synthesized audio. Starts silent; never opens AudioContext before an action. */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  enabled = false;
  async toggle() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
      this.drone = this.context.createOscillator();
      this.drone.type = "sine";
      this.drone.frequency.value = 42;
      const gain = this.context.createGain();
      gain.gain.value = 0.12;
      this.drone.connect(gain).connect(this.master);
      this.drone.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    this.master!.gain.setTargetAtTime(
      this.enabled ? 0.42 : 0,
      this.context.currentTime,
      0.35,
    );
    return this.enabled;
  }
  play(kind: "whoosh" | "collapse" | "bang" | "online") {
    if (!this.context || !this.enabled || !this.master) return;
    const ctx = this.context,
      now = ctx.currentTime,
      duration = kind === "bang" ? 2.4 : kind === "collapse" ? 1.7 : 0.8;
    const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(kind === "bang" ? 3500 : 700, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(kind === "bang" ? 0.42 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start();
    if (kind === "bang" || kind === "collapse") {
      const sub = ctx.createOscillator(),
        sg = ctx.createGain();
      sub.frequency.setValueAtTime(kind === "bang" ? 120 : 70, now);
      sub.frequency.exponentialRampToValueAtTime(25, now + 1.4);
      sg.gain.setValueAtTime(0.45, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      sub.connect(sg).connect(this.master);
      sub.start();
      sub.stop(now + 1.8);
    }
  }
  dispose() {
    void this.context?.close();
    this.context = null;
  }
}
export const audio = new AudioManager();
