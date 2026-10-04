import { planets, type PlanetId } from "../data/planets";
import type { InteractionController } from "./InteractionController";
import type { UIState } from "./store";

export type SceneCommand =
  | { type: "select"; planetId: PlanetId }
  | { type: "return" };

export interface CommandResult {
  status:
    | "invalid"
    | "busy"
    | "blocked"
    | "already_done"
    | "started"
    | "completed"
    | "interrupted";
  message: string;
  command?: SceneCommand;
}

const planetNames = new Map(
  planets.flatMap((planet) => [
    [planet.chineseName, planet.id] as const,
    [planet.name.toLowerCase(), planet.id] as const,
  ]),
);
const isOverview = (state: UIState) =>
  (state.mode === "SOLAR_SYSTEM" || state.mode === "POINTER") &&
  state.selected === null;
const isFocused = (state: UIState, planetId: PlanetId) =>
  (state.mode === "PLANET_FOCUS" || state.mode === "INFO") &&
  state.selected === planetId;
const planetName = (planetId: PlanetId) =>
  planets.find((planet) => planet.id === planetId)!.chineseName;
const started = (command: SceneCommand): CommandResult => ({
  status: "started",
  message:
    command.type === "select"
      ? `正在前往${planetName(command.planetId)}`
      : "正在返回太阳系",
  command,
});
const interrupted = (command: SceneCommand): CommandResult => ({
  status: "interrupted",
  message: "命令已中断，请重新发送",
  command,
});

export function parseTextCommand(text: string): SceneCommand | null {
  if (text.length > 120 || /[\u0000-\u001f\u007f\u2028\u2029]/.test(text))
    return null;
  const normalized = text.trim().toLowerCase().replace(/ +/g, " ");
  if (normalized === "返回太阳系" || normalized === "back to solar system")
    return { type: "return" };
  const name = normalized.replace(
    /^(?:带我去|前往|去)\s*|^(?:go to|take me to|show me) /,
    "",
  );
  const planetId = planetNames.get(name);
  return planetId ? { type: "select", planetId } : null;
}

export function executeTextCommand(
  text: string,
  controller: InteractionController,
  state: UIState,
): CommandResult {
  const command = parseTextCommand(text);
  if (!command)
    return { status: "invalid", message: "请输入行星名称或返回太阳系" };
  if (state.webglError)
    return {
      status: "blocked",
      message: "画面暂时不可用，请恢复后再试",
      command,
    };
  if (state.transitioning || controller.isLocked())
    return { status: "busy", message: "画面正在切换，请稍后再试", command };
  if (state.mode !== controller.machine.state)
    return {
      status: "blocked",
      message: "画面状态正在更新，请稍后再试",
      command,
    };
  if (state.mode === "UNIVERSE_SCALE")
    return { status: "blocked", message: "请先结束缩放，再发送命令", command };
  if (command.type === "select") {
    if (state.mode === "SUN_INTERIOR")
      return {
        status: "blocked",
        message: "请先从太阳内部返回太阳系",
        command,
      };
    if (state.mode === "COLLAPSE")
      return {
        status: "blocked",
        message: "请先从坍缩画面返回太阳系",
        command,
      };
    if (isFocused(state, command.planetId))
      return {
        status: "already_done",
        message: `当前已在${planetName(command.planetId)}`,
        command,
      };
  } else if (isOverview(state)) {
    return { status: "already_done", message: "当前已在太阳系", command };
  }
  const accepted =
    command.type === "select"
      ? controller.select(command.planetId)
      : controller.return();
  return accepted
    ? started(command)
    : { status: "blocked", message: "当前画面无法执行这个命令", command };
}

export function resolveTextCommand(
  command: SceneCommand,
  controller: InteractionController,
  state: UIState,
): CommandResult {
  if (state.webglError)
    return {
      status: "interrupted",
      message: "画面暂时不可用，命令已中断",
      command,
    };
  if (state.mode !== controller.machine.state) return interrupted(command);
  if (state.transitioning || controller.isLocked()) {
    const waiting =
      command.type === "select"
        ? state.mode === "PLANET_TRANSITION" &&
          state.selected === command.planetId
        : state.mode === "TRANSITION" && state.selected === null;
    return waiting ? started(command) : interrupted(command);
  }
  const completed =
    command.type === "select"
      ? isFocused(state, command.planetId)
      : isOverview(state);
  if (!completed) return interrupted(command);
  return {
    status: "completed",
    message:
      command.type === "select"
        ? `已抵达${planetName(command.planetId)}`
        : "已返回太阳系",
    command,
  };
}
