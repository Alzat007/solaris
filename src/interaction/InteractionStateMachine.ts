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
  | "SUN_FOCUS"
  | "SUN_INTERIOR"
  | "TRANSITION";
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
const overview = {
  POINT: "SOLAR_SYSTEM",
  SELECT: "PLANET_TRANSITION",
  COLLAPSE: "COLLAPSE",
  ENTER_SUN: "SUN_FOCUS",
  SCALE: "UNIVERSE_SCALE",
} as const;
const focus = {
  SELECT: "PLANET_TRANSITION",
  RETURN: "TRANSITION",
  ENTER_SUN: "SUN_FOCUS",
  SCALE: "UNIVERSE_SCALE",
} as const;
const transitions: Partial<
  Record<InteractionState, Partial<Record<InteractionEvent, InteractionState>>>
> = {
  INTRO: { READY: "SOLAR_SYSTEM" },
  SOLAR_SYSTEM: overview,
  POINTER: overview,
  PLANET_TRANSITION: { TRANSITION_END: "PLANET_FOCUS" },
  PLANET_FOCUS: { ...focus, INFO: "INFO" },
  INFO: { ...focus, INFO: "PLANET_FOCUS" },
  SUN_FOCUS: { TRANSITION_END: "SUN_INTERIOR" },
  SUN_INTERIOR: { RETURN: "TRANSITION" },
  COLLAPSE: {
    TRANSITION_END: "COLLAPSE",
    OPEN: "BIG_BANG",
    RETURN: "TRANSITION",
  },
  BIG_BANG: { BANG_END: "SOLAR_SYSTEM" },
  TRANSITION: { TRANSITION_END: "SOLAR_SYSTEM" },
  UNIVERSE_SCALE: { SCALE_END: "SOLAR_SYSTEM" },
};
export class InteractionStateMachine {
  state: InteractionState = "INTRO";
  private collapseAnimating = false;
  private scaleOrigin: InteractionState = "SOLAR_SYSTEM";
  get locked() {
    return (
      [
        "INTRO",
        "PLANET_TRANSITION",
        "SUN_FOCUS",
        "TRANSITION",
        "BIG_BANG",
      ].includes(this.state) ||
      (this.state === "COLLAPSE" && this.collapseAnimating)
    );
  }
  can(event: InteractionEvent) {
    if (
      this.state === "COLLAPSE" &&
      this.collapseAnimating &&
      event !== "TRANSITION_END"
    )
      return false;
    return !!transitions[this.state]?.[event];
  }
  send(event: InteractionEvent) {
    if (!this.can(event)) return false;
    const next = transitions[this.state]![event]!;
    if (event === "SCALE")
      this.scaleOrigin = this.state === "POINTER" ? "SOLAR_SYSTEM" : this.state;
    if (event === "COLLAPSE") this.collapseAnimating = true;
    if (this.state === "COLLAPSE" && event === "TRANSITION_END")
      this.collapseAnimating = false;
    this.state = event === "SCALE_END" ? this.scaleOrigin : next;
    return true;
  }
}
