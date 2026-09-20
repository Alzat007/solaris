import type { GestureTarget } from "./gestureFeedback";
/** Render-side picking writes one current target; the gesture state machine
 * locks it after stable pointing. HUD and bodies share the index trigger. */
let current: GestureTarget | null = null;
export type TargetScreen = { x: number; y: number; radius: number };
let screenResolver: ((target: GestureTarget) => TargetScreen | null) | null =
  null;
export const gestureTargets = {
  getTargetScreen: (target: GestureTarget): TargetScreen | null =>
    screenResolver?.(target) ?? null,
  registerScreenResolver(
    resolve: (target: GestureTarget) => TargetScreen | null,
  ) {
    screenResolver = resolve;
    return () => {
      if (screenResolver === resolve) screenResolver = null;
    };
  },
  get: () => current,
  set(target: GestureTarget | null) {
    if (current?.kind === target?.kind && current?.id === target?.id) return;
    current = target;
  },
  activateUI(id: string) {
    if (typeof document === "undefined") return false;
    const element = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[data-gesture-id]"),
    ).find((el) => el.dataset.gestureId === id);
    if (
      !element ||
      element.disabled ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getClientRects().length === 0
    )
      return false;
    element.click();
    return true;
  },
};
