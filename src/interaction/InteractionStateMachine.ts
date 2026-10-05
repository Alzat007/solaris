export type InteractionState =
  | "INTRO"
  | "SOLAR_SYSTEM"
  | "POINTER"
  | "PLANET_TRANSITION"
  | "PLANET_OVERVIEW"
  | "BODY_EXPLORE"
  | "EARTH_CONTINENT_PICKER"
  | "EARTH_COUNTRY_PICKER"
  | "EARTH_CITY_PICKER"
  | "PLANET_REGION_PICKER"
  | "DESCENT_TRANSITION"
  | "LOCATION_OVERVIEW"
  | "INFO_PANEL_OPEN"
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
  | "TRANSITION_CANCEL"
  | "ENTER_BODY_EXPLORE"
  | "RETURN"
  | "INFO"
  | "COLLAPSE"
  | "ENTER_SUN"
  | "OPEN"
  | "BANG_END"
  | "SCALE"
  | "SCALE_END"
  | "BROWSE"
  | "BROWSE_EARTH"
  | "PICK_CONTINENT"
  | "PICK_COUNTRY"
  | "OPEN_HOTSPOT"
  | "CLOSE_HOTSPOT"
  | "ENTER_LOCATION"
  | "LOCATION_READY"
  | "LOCATION_CANCEL"
  | "EXIT_DIRECTORY";
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
  PLANET_TRANSITION: {
    TRANSITION_END: "PLANET_OVERVIEW",
    TRANSITION_CANCEL: "SOLAR_SYSTEM",
  },
  PLANET_OVERVIEW: {
    ...focus,
    ENTER_BODY_EXPLORE: "BODY_EXPLORE",
    INFO: "INFO",
    BROWSE: "PLANET_REGION_PICKER",
    BROWSE_EARTH: "EARTH_CONTINENT_PICKER",
  },
  // 地球连续探索独占相机；切换天体必须先完成返回。
  BODY_EXPLORE: { RETURN: "TRANSITION" },
  INFO: {
    ...focus,
    INFO: "PLANET_OVERVIEW",
    BROWSE: "PLANET_REGION_PICKER",
    BROWSE_EARTH: "EARTH_CONTINENT_PICKER",
  },
  EARTH_CONTINENT_PICKER: {
    PICK_CONTINENT: "EARTH_COUNTRY_PICKER",
    RETURN: "PLANET_OVERVIEW",
    EXIT_DIRECTORY: "PLANET_OVERVIEW",
  },
  EARTH_COUNTRY_PICKER: {
    PICK_COUNTRY: "EARTH_CITY_PICKER",
    RETURN: "EARTH_CONTINENT_PICKER",
  },
  EARTH_CITY_PICKER: {
    ENTER_LOCATION: "DESCENT_TRANSITION",
    RETURN: "EARTH_COUNTRY_PICKER",
  },
  PLANET_REGION_PICKER: {
    ENTER_LOCATION: "DESCENT_TRANSITION",
    RETURN: "PLANET_OVERVIEW",
    EXIT_DIRECTORY: "PLANET_OVERVIEW",
  },
  DESCENT_TRANSITION: {
    LOCATION_READY: "LOCATION_OVERVIEW",
    LOCATION_CANCEL: "PLANET_REGION_PICKER",
  },
  LOCATION_OVERVIEW: {
    LOCATION_CANCEL: "PLANET_REGION_PICKER",
    OPEN_HOTSPOT: "INFO_PANEL_OPEN",
  },
  INFO_PANEL_OPEN: { CLOSE_HOTSPOT: "LOCATION_OVERVIEW" },
  SUN_FOCUS: { TRANSITION_END: "SUN_INTERIOR" },
  SUN_INTERIOR: { RETURN: "TRANSITION" },
  COLLAPSE: {
    TRANSITION_END: "COLLAPSE",
    OPEN: "BIG_BANG",
    RETURN: "TRANSITION",
  },
  BIG_BANG: { BANG_END: "SOLAR_SYSTEM" },
  TRANSITION: {
    TRANSITION_END: "SOLAR_SYSTEM",
    TRANSITION_CANCEL: "PLANET_OVERVIEW",
  },
  UNIVERSE_SCALE: { SCALE_END: "SOLAR_SYSTEM" },
};
export class InteractionStateMachine {
  state: InteractionState = "INTRO";
  private collapseAnimating = false;
  private scaleOrigin: InteractionState = "SOLAR_SYSTEM";
  private locationOrigin: InteractionState = "PLANET_REGION_PICKER";
  private transitionOrigin: InteractionState = "SOLAR_SYSTEM";
  get locked() {
    return (
      [
        "INTRO",
        "PLANET_TRANSITION",
        "DESCENT_TRANSITION",
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
    if (event === "ENTER_LOCATION") this.locationOrigin = this.state;
    if (event === "SELECT" || event === "RETURN")
      this.transitionOrigin = this.state;
    if (event === "COLLAPSE") this.collapseAnimating = true;
    if (this.state === "COLLAPSE" && event === "TRANSITION_END")
      this.collapseAnimating = false;
    this.state =
      event === "SCALE_END"
        ? this.scaleOrigin
        : event === "LOCATION_CANCEL"
          ? this.locationOrigin
          : event === "TRANSITION_CANCEL"
            ? this.transitionOrigin
            : next;
    return true;
  }
}
