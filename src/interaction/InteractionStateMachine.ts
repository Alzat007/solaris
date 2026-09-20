export type InteractionState =
  | "INTRO"
  | "SOLAR_SYSTEM"
  | "POINTER"
  | "PLANET_TRANSITION"
  | "PLANET_FOCUS"
  | "INFO"
  | "COLLAPSE"
  | "BIG_BANG"
  | "UNIVERSE_SCALE"
  | "SUN_INTERIOR";
export type InteractionEvent =
  | "READY"
  | "POINT"
  | "SELECT"
  | "TRANSITION_END"
  | "RETURN"
  | "INFO"
  | "COLLAPSE"
  | "ENTER_SUN"
  | "OPEN"
  | "BANG_END"
  | "SCALE"
  | "SCALE_END";
const transitions: Partial<
  Record<InteractionState, Partial<Record<InteractionEvent, InteractionState>>>
> = {
  INTRO: { READY: "SOLAR_SYSTEM" },
  SOLAR_SYSTEM: {
    RETURN: "SOLAR_SYSTEM",
    POINT: "POINTER",
    SELECT: "PLANET_TRANSITION",
    COLLAPSE: "COLLAPSE",
    ENTER_SUN: "SUN_INTERIOR",
    SCALE: "UNIVERSE_SCALE",
  },
  POINTER: {
    SELECT: "PLANET_TRANSITION",
    RETURN: "SOLAR_SYSTEM",
    COLLAPSE: "COLLAPSE",
    ENTER_SUN: "SUN_INTERIOR",
    SCALE: "UNIVERSE_SCALE",
  },
  PLANET_TRANSITION: { TRANSITION_END: "PLANET_FOCUS" },
  PLANET_FOCUS: {
    SELECT: "PLANET_TRANSITION",
    RETURN: "SOLAR_SYSTEM",
    INFO: "INFO",
    COLLAPSE: "COLLAPSE",
    ENTER_SUN: "SUN_INTERIOR",
    SCALE: "UNIVERSE_SCALE",
  },
  INFO: {
    SCALE: "UNIVERSE_SCALE",
    INFO: "PLANET_FOCUS",
    SELECT: "PLANET_TRANSITION",
    RETURN: "SOLAR_SYSTEM",
    COLLAPSE: "COLLAPSE",
    ENTER_SUN: "SUN_INTERIOR",
  },
  COLLAPSE: { ENTER_SUN: "SUN_INTERIOR", RETURN: "SOLAR_SYSTEM" },
  SUN_INTERIOR: { RETURN: "SOLAR_SYSTEM", COLLAPSE: "COLLAPSE" },
  BIG_BANG: { BANG_END: "SOLAR_SYSTEM" },
  UNIVERSE_SCALE: {
    SCALE_END: "SOLAR_SYSTEM",
    RETURN: "SOLAR_SYSTEM",
    COLLAPSE: "COLLAPSE",
    ENTER_SUN: "SUN_INTERIOR",
    SELECT: "PLANET_TRANSITION",
  },
};
export class InteractionStateMachine {
  state: InteractionState = "INTRO";
  private scaleOrigin: InteractionState = "SOLAR_SYSTEM";
  can(event: InteractionEvent) {
    return !!transitions[this.state]?.[event];
  }
  send(event: InteractionEvent) {
    const next = transitions[this.state]?.[event];
    if (!next) return false;
    if (event === "SCALE") {
      this.scaleOrigin = this.state === "POINTER" ? "SOLAR_SYSTEM" : this.state;
    }
    this.state = event === "SCALE_END" ? this.scaleOrigin : next;
    return true;
  }
}
