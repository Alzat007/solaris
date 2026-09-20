import type { GestureTarget } from "./gestureFeedback";
/** Render-side picking writes one current target; the gesture state machine
 * captures it once at pinch start. This also unifies HUD and body selection. */
let current: GestureTarget | null = null;
export const gestureTargets = {
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
