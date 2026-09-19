export type InteractionState =
  | "INTRO"
  | "SOLAR_SYSTEM"
  | "POINTER"
  | "PLANET_TRANSITION"
  | "PLANET_FOCUS"
  | "INFO"
  | "COLLAPSE"
  | "BIG_BANG"
  | "UNIVERSE_SCALE";
export type InteractionEvent =
  | "READY"
  | "POINT"
  | "SELECT"
  | "TRANSITION_END"
  | "RETURN"
  | "INFO"
  | "FIST"
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
    FIST: "COLLAPSE",
    SCALE: "UNIVERSE_SCALE",
  },
  POINTER: {
    SELECT: "PLANET_TRANSITION",
    RETURN: "SOLAR_SYSTEM",
    FIST: "COLLAPSE",
    SCALE: "UNIVERSE_SCALE",
  },
  PLANET_TRANSITION: { TRANSITION_END: "PLANET_FOCUS" },
  PLANET_FOCUS: {
    SELECT: "PLANET_TRANSITION",
    RETURN: "SOLAR_SYSTEM",
    INFO: "INFO",
    FIST: "COLLAPSE",
    SCALE: "UNIVERSE_SCALE",
  },
  INFO: {
    INFO: "PLANET_FOCUS",
    SELECT: "PLANET_TRANSITION",
    RETURN: "SOLAR_SYSTEM",
    FIST: "COLLAPSE",
  },
  COLLAPSE: { OPEN: "BIG_BANG" },
  BIG_BANG: { BANG_END: "SOLAR_SYSTEM" },
  UNIVERSE_SCALE: {
    SCALE_END: "SOLAR_SYSTEM",
    RETURN: "SOLAR_SYSTEM",
    FIST: "COLLAPSE",
    SELECT: "PLANET_TRANSITION",
  },
};
export class InteractionStateMachine {
  state: InteractionState = "INTRO";
  can(event: InteractionEvent) {
    return !!transitions[this.state]?.[event];
  }
  send(event: InteractionEvent) {
    const next = transitions[this.state]?.[event];
    if (!next) return false;
    this.state = next;
    return true;
  }
}
