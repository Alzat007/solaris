import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";

export type StoryPanelPhase = "opening" | "open" | "closing" | "closed";
export interface StoryPanelControls {
  id: string;
  close: () => void;
  reopen: () => void;
}

export function useReducedStoryMotion() {
  const [reduced, setReduced] = useState(false);
  useLayoutEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useStoryPanelMotion({
  id,
  backdrop,
  onClosed,
  bindControls,
  ready = true,
}: {
  id: string;
  backdrop: RefObject<HTMLDivElement | null>;
  onClosed: () => void;
  bindControls?: (controls: StoryPanelControls) => () => void;
  ready?: boolean;
}) {
  const [phase, setPhase] = useState<StoryPanelPhase>("opening");
  const api = useRef<StoryPanelControls | null>(null);
  const reveal = useRef<(() => void) | null>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const closed = useRef(onClosed);
  closed.current = onClosed;
  useLayoutEffect(() => {
    const element = backdrop.current;
    if (!element) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const progress = { panel: 0, background: 0 };
    let direction: "opening" | "closing" = "opening";
    let tween: gsap.core.Timeline | null = null;
    let generation = 0;
    let alive = true;
    const paint = () => {
      element.style.setProperty("--story-progress", String(progress.panel));
      element.style.setProperty(
        "--story-softening",
        String(progress.background),
      );
      element.dataset.panelProgress = String(progress.panel);
      element.dataset.reducedMotion = String(query.matches);
    };
    const move = (opening: boolean, force = false) => {
      const next = opening ? "opening" : "closing";
      if (!force && direction === next) return;
      direction = next;
      const epoch = ++generation;
      tween?.kill();
      setPhase(next);
      if (opening && !readyRef.current && progress.panel === 0) return;
      const target = opening ? 1 : 0;
      if (query.matches) {
        progress.panel = target;
        progress.background = target;
        paint();
        setPhase(opening ? "open" : "closed");
        if (!opening) closed.current();
        return;
      }
      const duration = opening ? 0.28 : 0.18;
      tween = gsap.timeline({
        onUpdate: paint,
        onComplete: () => {
          if (!alive || epoch !== generation) return;
          setPhase(opening ? "open" : "closed");
          if (!opening) closed.current();
        },
      });
      tween.to(
        progress,
        {
          panel: target,
          duration: duration * Math.max(0.1, Math.abs(target - progress.panel)),
          ease: "power3.out",
        },
        0,
      );
      tween.to(
        progress,
        {
          background: target,
          duration:
            (opening ? 0.22 : 0.18) *
            Math.max(0.1, Math.abs(target - progress.background)),
          ease: "power2.out",
        },
        0,
      );
    };
    // No ancestor opacity/filter: the glass must still sample the live scene.
    paint();
    const controls = { id, close: () => move(false), reopen: () => move(true) };
    api.current = controls;
    const showPrepared = () => {
      if (direction === "opening" && progress.panel === 0) move(true, true);
    };
    reveal.current = showPrepared;
    const unbind = bindControls?.(controls);
    const preferenceChanged = () => move(direction === "opening", true);
    query.addEventListener("change", preferenceChanged);
    move(true, true);
    return () => {
      alive = false;
      generation++;
      tween?.kill();
      unbind?.();
      query.removeEventListener("change", preferenceChanged);
      if (api.current === controls) api.current = null;
      if (reveal.current === showPrepared) reveal.current = null;
    };
  }, [id, backdrop, bindControls]);
  useLayoutEffect(() => {
    if (ready) reveal.current?.();
  }, [id, ready]);
  return { phase, requestClose: () => api.current?.close() };
}
