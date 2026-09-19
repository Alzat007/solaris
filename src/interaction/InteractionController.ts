import gsap from "gsap";
import { InteractionStateMachine } from "./InteractionStateMachine";
import { store } from "./store";
import { particles } from "../particles/ParticleEngine";
import { planets, type PlanetId } from "../data/planets";
import { audio } from "../audio/AudioManager";
class InteractionController {
  machine = new InteractionStateMachine();
  private transition: gsap.core.Timeline | null = null;
  private collapsedAt = 0;
  private pendingBang: ReturnType<typeof setTimeout> | null = null;
  private visited = new Set<PlanetId>();
  private sync() {
    store.set({ mode: this.machine.state });
  }
  ready() {
    if (this.machine.send("READY")) this.sync();
  }
  select(id: PlanetId) {
    if (!this.machine.send("SELECT")) return;
    store.set({
      selected: id,
      mode: this.machine.state,
      welcome: false,
      help: false,
    });
    particles.targetAnchor.set(0, 0, 0);
    particles.targetScale = 1;
    store.set({ heldUniverse: false });
    const first = !this.visited.has(id);
    this.visited.add(id);
    particles.assembly = first ? 1 : 0.55;
    particles.setState("ASSEMBLE");
    audio.play("whoosh");
    this.transition?.kill();
    this.transition = gsap
      .timeline({
        onComplete: () => {
          particles.setState("REST");
          this.machine.send("TRANSITION_END");
          this.sync();
        },
      })
      .to(particles, {
        focus: 1,
        assembly: 0,
        duration: first ? 1.35 : 1.05,
        ease: "power3.inOut",
      });
  }
  next(direction: number) {
    particles.switchDirection = direction;
    const index = planets.findIndex((p) => p.id === store.get().selected);
    this.select(
      planets[(index + direction + planets.length) % planets.length].id,
    );
  }
  return() {
    if (!this.machine.send("RETURN")) return;
    this.transition?.kill();
    store.set({
      selected: null,
      mode: this.machine.state,
      heldUniverse: false,
    });
    particles.targetScale = 1;
    particles.targetAnchor.set(0, 0, 0);
    particles.setState("ASSEMBLE");
    this.transition = gsap
      .timeline({ onComplete: () => particles.setState("REST") })
      .to(particles, {
        focus: 0,
        assembly: 0,
        duration: 1.3,
        ease: "power3.inOut",
      });
    audio.play("whoosh");
  }
  point() {
    if (this.machine.send("POINT")) this.sync();
  }
  info() {
    if (this.machine.send("INFO")) this.sync();
  }
  collapse() {
    if (!this.machine.send("FIST")) return;
    this.transition?.kill();
    this.collapsedAt = performance.now();
    store.set({
      mode: this.machine.state,
      welcome: false,
      heldUniverse: false,
    });
    particles.targetScale = 1;
    particles.targetAnchor.set(0, 0, 0);
    particles.setState("COLLAPSE");
    this.transition = gsap
      .timeline()
      .to(particles, {
        collapse: 1,
        focus: 0,
        duration: 1.75,
        ease: "power2.inOut",
      });
    audio.play("collapse");
  }
  bang() {
    if (this.machine.state !== "COLLAPSE") return;
    const remaining = 1750 - (performance.now() - this.collapsedAt);
    if (remaining > 0) {
      if (!this.pendingBang)
        this.pendingBang = setTimeout(() => {
          this.pendingBang = null;
          this.bang();
        }, remaining + 10);
      return;
    }
    if (!this.machine.send("OPEN")) return;
    this.transition?.kill();
    store.set({ mode: this.machine.state, selected: null });
    particles.setState("EXPLODE");
    audio.play("bang");
    particles.explosion = 0.001;
    particles.burst = 1;
    this.transition = gsap
      .timeline({
        onComplete: () => {
          particles.setState("REST");
          this.machine.send("BANG_END");
          this.sync();
        },
      })
      .to(particles, { collapse: 0, duration: 0.35, ease: "power3.out" }, 0)
      .to(particles, { explosion: 1, duration: 3.8, ease: "none" }, 0)
      .to(particles, { burst: 0, duration: 2.6, ease: "power2.out" }, 0.1)
      .set(particles, { explosion: 0 }, 3.8);
  }
  space() {
    if (this.machine.state === "COLLAPSE") this.bang();
    else this.collapse();
  }
  open() {
    if (this.machine.state === "COLLAPSE") this.bang();
    else this.return();
  }
  scale(value: number, held = false) {
    if (
      this.machine.state === "BIG_BANG" ||
      this.machine.state === "COLLAPSE" ||
      this.machine.state === "INTRO" ||
      this.machine.state === "PLANET_TRANSITION"
    )
      return;
    if (this.machine.send("SCALE")) this.sync();
    particles.targetScale = Math.max(0.14, Math.min(1.75, value));
    if (store.get().heldUniverse !== held) store.set({ heldUniverse: held });
  }
  endScale() {
    if (this.machine.send("SCALE_END")) {
      store.set({ heldUniverse: false });
      particles.targetAnchor.set(0, 0, 0);
      if (particles.targetScale < 0.45) particles.targetScale = 1;
      if (store.get().selected) {
        store.set({ selected: null });
        gsap.to(particles, { focus: 0, duration: 1 });
      }
      this.sync();
    }
  }
  online() {
    particles.burst = 0.7;
    gsap.to(particles, { burst: 0, duration: 1.9 });
    audio.play("online");
  }
}
export const interaction = new InteractionController();
