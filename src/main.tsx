import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./ui/styles.css";
import { store } from "./interaction/store";
const initialLanguage = new URLSearchParams(location.search).get("lang");
if (initialLanguage === "zh" || initialLanguage === "en")
  store.set({ language: initialLanguage });
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
