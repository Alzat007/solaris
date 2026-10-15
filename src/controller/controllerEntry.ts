import {
  parsePairingFragment,
  validateRelayServiceUrl,
} from "../remote/controlProtocol";

export interface ControllerEntry {
  serviceUrl: string;
  pairing: ReturnType<typeof parsePairingFragment>;
  language: "zh" | "en";
}

export function consumeControllerEntry(
  location: Pick<Location, "hash" | "pathname" | "search">,
  replace: (url: string) => void,
  configuredOrigin: string,
): ControllerEntry {
  const pairing = parsePairingFragment(location.hash);
  const language =
    new URLSearchParams(location.search).get("lang") === "en" ? "en" : "zh";
  const safeSearch = language === "en" ? "?lang=en" : "";
  if (location.hash || location.search !== safeSearch)
    replace(`${location.pathname}${safeSearch}`);
  let serviceUrl = "";
  try {
    serviceUrl = configuredOrigin
      ? validateRelayServiceUrl(configuredOrigin).origin
      : "";
  } catch {
    /* Invalid configuration remains explicitly disconnected. */
  }
  return { serviceUrl, pairing, language };
}
