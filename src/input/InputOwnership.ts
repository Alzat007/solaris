export type InputSource = "local" | "tv" | "remote";

/** Active local input preempts a remote hold; stale packets cannot reacquire it. */
export class InputOwnership {
  owner: InputSource | null = null;
  private localUntil = 0;
  private lastRemote = 0;
  private held: InputSource | null = null;
  constructor(private stopMotion: () => void) {}
  claim(source: InputSource, now: number) {
    if (source === "remote" && now < this.localUntil) return false;
    if (source === "remote" && this.held && this.held !== "remote")
      return false;
    if (this.owner && this.owner !== source) this.stopMotion();
    this.owner = source;
    if (source === "remote") this.lastRemote = now;
    return true;
  }
  preempt(now: number) {
    this.stopMotion();
    this.owner = "local";
    this.held = null;
    this.localUntil = now + 450;
  }
  hold(source: InputSource, now: number) {
    if (!this.claim(source, now)) return false;
    this.held = source;
    return true;
  }
  release(source?: InputSource) {
    if (source && this.owner !== source) return;
    this.stopMotion();
    this.owner = null;
    this.held = null;
  }
  checkTimeout(now: number, maximumSilence = 350) {
    if (this.owner === "remote" && now - this.lastRemote > maximumSilence) {
      this.release();
      return true;
    }
    return false;
  }
}
