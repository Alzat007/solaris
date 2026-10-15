const handlers: { priority: number; handle: () => boolean }[] = [];
export function registerInputBack(handle: () => boolean, priority = 0) {
  const entry = { priority, handle };
  handlers.push(entry);
  return () => {
    const index = handlers.indexOf(entry);
    if (index >= 0) handlers.splice(index, 1);
  };
}
export function handleInputBack() {
  return [...handlers]
    .sort((a, b) => b.priority - a.priority)
    .some((entry) => entry.handle());
}
