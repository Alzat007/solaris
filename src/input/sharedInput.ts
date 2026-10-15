import { interaction } from "../interaction/InteractionController";
import { store } from "../interaction/store";
import { rotation } from "../interaction/rotation";
import { particles } from "../particles/ParticleEngine";
import {
  getPlanetAtlasRotation,
  isPlanetAtlasVisible,
  setPlanetAutoRotate,
} from "../exploration/planetAtlasState";
import type { RemoteAction, ControlMessage } from "../remote/controlProtocol";
import { InputOwnership, type InputSource } from "./InputOwnership";
import { scenePointer, type InputTarget } from "./scenePointer";
import { moveTvFocus } from "../platform/tvNavigation";
import { validateActionPayload } from "../remote/controlProtocol";

let point: { x: number; y: number; time: number } | null = null;
let pointerVisible = false;
let rotating = false;
let lastMove = 0;
const now = () => performance.now();
function stopMotion() {
  pointerVisible = false;
  rotation.stop();
  particles.targetRotation = particles.rotation;
  interaction.endScale();
  rotating = false;
}
export const inputOwnership = new InputOwnership(stopMotion);
function canActivate(element: HTMLElement) {
  return (
    element.matches("button,summary,a[href],select") &&
    !element.matches(":disabled") &&
    element.getAttribute("aria-disabled") !== "true" &&
    !element.closest('[inert],[hidden],[aria-hidden="true"]') &&
    element.getClientRects().length > 0
  );
}
function elementTarget(element: HTMLElement | null): InputTarget | null {
  if (!element || !canActivate(element)) return null;
  const id =
    element.dataset.gestureId ?? element.dataset.annotationId ?? element.id;
  if (!id || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) return null;
  return {
    id,
    kind: "ui",
    label: (element.getAttribute("aria-label") ?? element.textContent ?? "")
      .trim()
      .slice(0, 80),
    activate: () => {
      if (!canActivate(element)) return false;
      element.click();
      return true;
    },
  };
}
export function currentInputTargetSnapshot(): {
  target: InputTarget | null;
  source: "pointer" | "focus";
} {
  if (typeof document === "undefined") return { target: null, source: "focus" };
  if (point && now() - point.time < 750) {
    const x = point.x * innerWidth,
      y = point.y * innerHeight;
    const element =
      document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("button,summary,a[href],select") ?? null;
    const target = elementTarget(element);
    if (target) return { target, source: "pointer" };
    if (document.querySelector('[role="dialog"][aria-modal="true"]'))
      return { target: null, source: "pointer" };
    return {
      target: scenePointer.resolve(point.x, point.y),
      source: "pointer",
    };
  }
  return {
    target: elementTarget(document.activeElement as HTMLElement | null),
    source: "focus",
  };
}
export function currentInputTarget(): InputTarget | null {
  return currentInputTargetSnapshot().target;
}
/** Display the same accepted coordinates used for selection, never a second aim. */
export function currentRemotePointer(): Readonly<{
  x: number;
  y: number;
}> | null {
  if (
    !pointerVisible ||
    inputOwnership.owner !== "remote" ||
    !point ||
    now() - point.time >= 750
  )
    return null;
  return { x: point.x, y: point.y };
}
function sceneReady() {
  return (
    !interaction.isLocked() &&
    !store.get().transitioning &&
    !document.querySelector('[role="dialog"][aria-modal="true"]') &&
    [
      "SOLAR_SYSTEM",
      "POINTER",
      "PLANET_OVERVIEW",
      "INFO",
      "UNIVERSE_SCALE",
    ].includes(store.get().mode)
  );
}
export function applyInputAction(
  action: RemoteAction,
  payload: ControlMessage["payload"],
  source: InputSource = "remote",
) {
  const time = now();
  if (!validateActionPayload(action, payload)) return false;
  if (["STOP", "BACK", "ROTATE_END"].includes(action)) {
    inputOwnership.release(action === "ROTATE_END" ? source : undefined);
    if (action !== "BACK") return true;
    const event = new CustomEvent("solaris-back", { cancelable: true });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) interaction.return();
    return true;
  }
  if (!inputOwnership.claim(source, time)) return false;
  pointerVisible = false;
  if (action === "POINTER") {
    if (payload?.x === undefined || payload.y === undefined) return false;
    point = { x: payload.x, y: payload.y, time };
    pointerVisible = source === "remote";
    const target = currentInputTarget();
    if (target?.kind === "ui") {
      const element = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-gesture-id], [data-annotation-id], [id]",
        ),
      ).find(
        (e) =>
          (e.dataset.gestureId ?? e.dataset.annotationId ?? e.id) === target.id,
      );
      if (element && canActivate(element))
        element.focus({ preventScroll: true });
    }
    return true;
  }
  if (action === "SELECT") {
    stopMotion();
    const target = currentInputTarget();
    if (
      !target ||
      (payload?.expectedTargetId && payload.expectedTargetId !== target.id)
    )
      return false;
    return target.activate();
  }
  if (action === "FOCUS") {
    stopMotion();
    point = null;
    return moveTvFocus(document, payload!.direction!);
  }
  if (action === "NEXT_IMAGE" || action === "PREVIOUS_IMAGE") {
    stopMotion();
    const id =
      action === "NEXT_IMAGE" ? "story-gallery-next" : "story-gallery-prev";
    const button = document.querySelector<HTMLButtonElement>(
      `[role="dialog"] button[data-gesture-id="${id}"]`,
    );
    return button && canActivate(button) ? (button.click(), true) : false;
  }
  if (!sceneReady()) {
    stopMotion();
    return false;
  }
  if (action === "ROTATE_START") {
    if (!inputOwnership.hold(source, time)) return false;
    const state = store.get();
    if (state.selected && isPlanetAtlasVisible(state))
      setPlanetAutoRotate(state.selected, false);
    rotation.start();
    rotating = true;
    lastMove = time;
    return true;
  }
  if (action === "ROTATE") {
    if (!rotating) return false;
    const dt = Math.min(0.1, Math.max(0.008, (time - lastMove) / 1000));
    lastMove = time;
    rotation.move((payload?.dx ?? 0) * 0.4, dt);
    const state = store.get();
    if (state.selected && isPlanetAtlasVisible(state))
      getPlanetAtlasRotation(state.selected).dragPitch(
        (payload?.dy ?? 0) * 0.4,
      );
    return true;
  }
  if (action === "ZOOM") {
    const applied = interaction.scale(
      particles.targetScale + (payload?.delta ?? 0),
    );
    interaction.endScale();
    return applied;
  }
  return false;
}
export function clearRemoteInput() {
  inputOwnership.release();
  point = null;
}
