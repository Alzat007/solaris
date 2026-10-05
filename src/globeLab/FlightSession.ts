export type FlightMode = "MANUAL" | "AUTO_FLIGHT";

export interface FlightTransport<Snapshot, Destination> {
  capture(): Snapshot;
  restore(snapshot: Snapshot): void;
  stop(): void;
  fly(destination: Destination, complete: () => void): void;
  arrive(destination: Destination): void;
}

/** Only explicit cancel restores the origin; manual takeover retains the current pose. */
export class FlightSession<Snapshot, Destination> {
  mode: FlightMode = "MANUAL";
  private epoch = 0;
  private origin: Snapshot | null = null;
  private destination: Destination | null = null;

  constructor(
    private transport: FlightTransport<Snapshot, Destination>,
    private changed: (mode: FlightMode) => void = () => {},
  ) {}

  start(destination: Destination) {
    if (this.mode === "AUTO_FLIGHT") return false;
    const epoch = ++this.epoch;
    this.origin = this.transport.capture();
    this.destination = destination;
    this.setMode("AUTO_FLIGHT");
    try {
      this.transport.fly(destination, () => {
        if (epoch !== this.epoch) return;
        this.clear();
      });
    } catch (error) {
      this.cancel();
      throw error;
    }
    return true;
  }

  takeover() {
    if (this.mode !== "AUTO_FLIGHT") return false;
    ++this.epoch;
    this.transport.stop();
    this.clear();
    return true;
  }

  cancel() {
    if (this.mode !== "AUTO_FLIGHT" || this.origin === null) return false;
    const origin = this.origin;
    ++this.epoch;
    this.transport.stop();
    this.transport.restore(origin);
    this.clear();
    return true;
  }

  skip() {
    if (this.mode !== "AUTO_FLIGHT" || this.destination === null) return false;
    const destination = this.destination;
    ++this.epoch;
    this.transport.stop();
    this.transport.arrive(destination);
    this.clear();
    return true;
  }

  private clear() {
    this.origin = null;
    this.destination = null;
    this.setMode("MANUAL");
  }

  private setMode(mode: FlightMode) {
    this.mode = mode;
    this.changed(mode);
  }
}
