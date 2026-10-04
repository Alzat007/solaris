export type FocusDirection = "left" | "right" | "up" | "down";

export interface FocusRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function isTvMode(search: string): boolean {
  return new URLSearchParams(search).get("tv") === "1";
}

// Prefer the closest control in the requested half-plane; never wrap at edges.
export function findNextFocusIndex(
  items: readonly FocusRect[],
  currentIndex: number,
  direction: FocusDirection,
): number {
  if (!items.length) return -1;
  if (currentIndex < 0 || currentIndex >= items.length) return 0;
  const current = items[currentIndex];
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const centerX = current.left + current.width / 2;
  const centerY = current.top + current.height / 2;
  let best = currentIndex;
  let bestScore = Infinity;
  items.forEach((candidate, index) => {
    if (index === currentIndex) return;
    const dx = candidate.left + candidate.width / 2 - centerX;
    const dy = candidate.top + candidate.height / 2 - centerY;
    const primary = (horizontal ? dx : dy) * sign;
    if (primary <= 1) return;
    const perpendicular = Math.abs(horizontal ? dy : dx);
    const score = primary + perpendicular * 3;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

const directions: Readonly<Record<string, FocusDirection>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const selector =
  'button, summary, input:not([type="hidden"]), textarea, select, a[href], [tabindex]';
const installed = new WeakMap<Document, () => void>();

export function installTvNavigation(
  root: HTMLElement,
  onBack: () => boolean | void,
): () => void {
  const document = root.ownerDocument;
  const window = document.defaultView;
  if (!window || !isTvMode(window.location.search)) return () => {};
  installed.get(document)?.();
  let editingSelect: HTMLElement | null = null;

  function stopSelectEditing() {
    editingSelect?.removeAttribute("data-tv-editing");
    editingSelect = null;
  }

  function controls(): HTMLElement[] {
    const modal = root.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    return Array.from((modal ?? root).querySelectorAll<HTMLElement>(selector)).filter(
      (element) => {
        if (
          element.tabIndex < 0 ||
          element.matches(":disabled") ||
          element.getAttribute("aria-disabled") === "true" ||
          element.closest('[hidden], [inert], [aria-hidden="true"]')
        )
          return false;
        for (
          let closed = element.closest<HTMLElement>("details:not([open])");
          closed;
          closed = closed.parentElement?.closest<HTMLElement>("details:not([open])") ?? null
        ) {
          if (!closed.querySelector<HTMLElement>(":scope > summary")?.contains(element))
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
          window!.getComputedStyle(element).visibility !== "hidden";
      },
    );
  }

  function focus(element: HTMLElement | undefined) {
    if (editingSelect && element !== editingSelect) stopSelectEditing();
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function consume(event: Event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function moveSelect(select: HTMLSelectElement, step: number) {
    const options = Array.from(select.options);
    const start = select.selectedIndex < 0 && step < 0 ? options.length : select.selectedIndex;
    for (let index = start + step; index >= 0 && index < options.length; index += step) {
      const option = options[index];
      if (option.disabled || option.hidden || option.parentElement?.matches("optgroup:disabled"))
        continue;
      select.selectedIndex = index;
      select.dispatchEvent(new window!.Event("input", { bubbles: true }));
      select.dispatchEvent(new window!.Event("change", { bubbles: true }));
      return;
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229)
      return;
    const back = event.key === "Escape" || event.key === "GoBack" ||
      event.key === "BrowserBack" || event.keyCode === 4;
    if (back) {
      consume(event);
      if (!event.repeat) {
        if (editingSelect) stopSelectEditing();
        else onBack();
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const active = document.activeElement as HTMLElement | null;
    const select = active?.matches("select");
    if (select && event.key === "Enter") {
      consume(event);
      if (!event.repeat) {
        if (editingSelect === active) stopSelectEditing();
        else {
          stopSelectEditing();
          editingSelect = active;
          active!.setAttribute("data-tv-editing", "true");
        }
      }
      return;
    }
    const editing = active?.matches("input, textarea") ||
      (select && editingSelect === active) ||
      active?.isContentEditable;
    const direction = directions[event.key];
    if (direction) {
      // Native select popups do not consistently handle D-pad keys in TV WebViews.
      if (select && editingSelect === active && (direction === "up" || direction === "down")) {
        consume(event);
        moveSelect(active as HTMLSelectElement, direction === "up" ? -1 : 1);
        return;
      }
      if (editing && (
        active?.matches("textarea") || active?.isContentEditable ||
        (!select && (direction === "left" || direction === "right"))
      )) return;
      consume(event);
      const elements = controls();
      const currentIndex = elements.indexOf(active!);
      const next = findNextFocusIndex(
        elements.map((element) => element.getBoundingClientRect()),
        currentIndex,
        direction,
      );
      focus(elements[next]);
    } else if (event.key === "Enter" && !editing) {
      consume(event);
      if (event.repeat) return;
      const elements = controls();
      if (active && elements.includes(active)) active.click();
      else focus(elements[0]);
    }
  }

  function nativeBack(event: Event) {
    event.stopImmediatePropagation();
    if (editingSelect) {
      stopSelectEditing();
      event.preventDefault();
    } else if (onBack() !== false) event.preventDefault();
  }

  function focusout(event: Event) {
    if (event.target === editingSelect) stopSelectEditing();
  }

  const observer = new window.MutationObserver(() => {
    if (editingSelect && document.activeElement !== editingSelect)
      stopSelectEditing();
    const elements = controls();
    if (!elements.includes(document.activeElement as HTMLElement))
      focus(elements[0]);
  });
  const capture = { capture: true };
  document.addEventListener("keydown", keydown, capture);
  document.addEventListener("focusout", focusout, capture);
  window.addEventListener("solaris-back", nativeBack, capture);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "disabled", "aria-disabled", "aria-hidden", "open"],
  });
  focus(controls()[0]);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.removeEventListener("keydown", keydown, capture);
    document.removeEventListener("focusout", focusout, capture);
    window.removeEventListener("solaris-back", nativeBack, capture);
    observer.disconnect();
    stopSelectEditing();
    if (installed.get(document) === cleanup) installed.delete(document);
  };
  installed.set(document, cleanup);
  return cleanup;
}
