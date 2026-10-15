import { createRoot } from "react-dom/client";
import { ControllerApp } from "./ControllerApp";
import { consumeControllerEntry } from "./controllerEntry";

const entry = consumeControllerEntry(
  window.location,
  (url) => window.history.replaceState(null, "", url),
  import.meta.env.VITE_REMOTE_RELAY_ORIGIN ?? "",
);
createRoot(document.getElementById("root")!).render(
  <ControllerApp entry={entry} />,
);
