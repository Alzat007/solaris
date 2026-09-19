import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { store } from "../interaction/store";
/** Downgrade only after sustained slow frames; keep allocations stable via drawRange. */
export function PerformanceManager() {
  const meter = useRef({ elapsed: 0, frames: 0, slow: 0, age: 0 });
  const { setDpr } = useThree();
  useFrame((_, dt) => {
    if (document.hidden || dt > 0.25) return;
    const m = meter.current;
    m.age += dt;
    m.elapsed += dt;
    m.frames++;
    if (m.elapsed < 2) return;
    const fps = Math.round(m.frames / m.elapsed);
    store.set({ fps });
    if (m.age > 8) {
      m.slow = fps < 37 ? m.slow + 1 : 0;
      if (m.slow >= 3) {
        const current = store.get().quality;
        const quality = current === "HIGH" ? "MEDIUM" : "LOW";
        store.set({ quality });
        setDpr(quality === "LOW" ? 1 : 1.25);
        m.slow = 0;
      }
    }
    m.elapsed = 0;
    m.frames = 0;
  });
  return null;
}
