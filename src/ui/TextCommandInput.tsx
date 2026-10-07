import { useEffect, useRef, useState, type FormEvent } from "react";
import { interaction } from "../interaction/InteractionController";
import { store, useSolaris } from "../interaction/store";
import { planetById } from "../data/planets";
import {
  executeTextCommand,
  resolveTextCommand,
  type CommandResult,
  type SceneCommand,
} from "../interaction/textCommands";
import { OrbitIcon } from "./Icons";

export function TextCommandInput() {
  const scene = useSolaris();
  const zh = scene.language === "zh";
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<CommandResult | null>(null);
  const [pending, setPending] = useState<SceneCommand | null>(null);
  const composing = useRef(false);
  const current =
    scene.mode === "SUN_INTERIOR"
      ? zh
        ? "太阳内部"
        : "Inside the Sun"
      : planetById(scene.selected)?.[zh ? "chineseName" : "name"] ||
        (zh ? "太阳系" : "Solar system");
  const target =
    feedback?.command?.type === "select"
      ? planetById(feedback.command.planetId)?.name
      : "the solar system";
  const englishFeedback: Record<CommandResult["status"], string> = {
    invalid: "Enter a planet name or 'back to solar system'.",
    busy: "The scene is changing. Please try again shortly.",
    blocked: "This command is not available in the current scene.",
    already_done: `Already at ${target}.`,
    started: `Travelling to ${target}...`,
    completed: `Arrived at ${target}.`,
    interrupted:
      "The command was interrupted or completion could not be confirmed. Please try again.",
  };

  useEffect(() => {
    if (!pending) return;
    const result = resolveTextCommand(pending, interaction, scene);
    if (result.status !== "started") {
      setFeedback(result);
      setPending(null);
    }
  }, [
    pending,
    scene.mode,
    scene.selected,
    scene.transitioning,
    scene.webglError,
  ]);

  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => {
      setPending(null);
      setFeedback({
        status: "interrupted",
        message: "未确认场景完成，请查看画面后重试。",
      });
    }, 10000);
    return () => window.clearTimeout(timeout);
  }, [pending]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (composing.current) return;
    const result = executeTextCommand(input, interaction, store.get());
    setFeedback(result);
    if (result.status === "started" && result.command)
      setPending(result.command);
  };

  return (
    <form
      className="talk-command"
      aria-label={zh ? "SOLARIS Talk 指令" : "SOLARIS Talk commands"}
      onSubmit={submit}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="talk-heading">
        <label htmlFor="talk-input">SOLARIS Talk</label>
        <span className="talk-mode">{zh ? "本地指令" : "Local commands"}</span>
        <span className="talk-current">
          {zh ? "当前：" : "Current: "}
          {current}
        </span>
      </div>
      <div className="talk-input-row">
        <input
          id="talk-input"
          type="text"
          aria-label={zh ? "场景指令" : "Scene command"}
          aria-describedby="talk-feedback"
          placeholder={zh ? "带我去火星" : "Take me to Mars"}
          autoComplete="off"
          spellCheck={false}
          maxLength={120}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (composing.current ||
                event.nativeEvent.isComposing ||
                event.keyCode === 229)
            )
              event.preventDefault();
          }}
        />
        <button
          type="submit"
          aria-label={zh ? "执行指令" : "Run command"}
          title={zh ? "执行指令" : "Run command"}
          disabled={!input.trim()}
        >
          <OrbitIcon />
        </button>
      </div>
      <div
        id="talk-feedback"
        className="talk-feedback"
        data-status={feedback?.status || "idle"}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback && (zh ? feedback.message : englishFeedback[feedback.status])}
      </div>
    </form>
  );
}
