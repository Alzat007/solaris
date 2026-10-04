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
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<CommandResult | null>(null);
  const [pending, setPending] = useState<SceneCommand | null>(null);
  const composing = useRef(false);
  const current =
    scene.mode === "SUN_INTERIOR"
      ? "太阳内部"
      : planetById(scene.selected)?.chineseName || "太阳系";

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
      aria-label="SOLARIS Talk 指令"
      onSubmit={submit}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="talk-heading">
        <label htmlFor="talk-input">SOLARIS Talk</label>
        <span className="talk-mode">本地指令</span>
        <span className="talk-current">当前：{current}</span>
      </div>
      <div className="talk-input-row">
        <input
          id="talk-input"
          type="text"
          aria-label="场景指令"
          aria-describedby="talk-feedback"
          placeholder="带我去火星"
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
          aria-label="执行指令"
          title="执行指令"
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
        {feedback?.message}
      </div>
    </form>
  );
}
