import { gestureConfig as config } from "./gestureConfig";

const clamp = (value: number) =>
  Math.max(config.V_ZOOM_MIN, Math.min(config.V_ZOOM_MAX, value));

/** Stop a dial's accumulated target movement without jumping the rendered
 * scale. Leave only a small, bounded amount for the existing damping to settle.
 * Invalid inputs fall back to the other finite value, then neutral scale. */
export function settleDialScale(target: number, current: number): number {
  const rendered = clamp(
    Number.isFinite(current) ? current : Number.isFinite(target) ? target : 1,
  );
  const requested = Number.isFinite(target) ? clamp(target) : rendered;
  const remaining = requested - rendered;
  return clamp(
    rendered +
      Math.sign(remaining) *
        Math.min(Math.abs(remaining), config.V_ZOOM_RELEASE_SETTLE_MAX),
  );
}
