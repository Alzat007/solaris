import { validateRelayServiceUrl } from "./controlProtocol";
declare global {
  interface Window {
    __SOLARIS_REMOTE_CONFIG?: { relayUrl?: string; phoneUrl?: string };
  }
}
export function readRemoteConfig() {
  const configured =
    typeof window === "undefined" ? undefined : window.__SOLARIS_REMOTE_CONFIG;
  const relayUrl =
    configured?.relayUrl || import.meta.env.VITE_REMOTE_RELAY_ORIGIN || "";
  const phoneUrl =
    configured?.phoneUrl || import.meta.env.VITE_REMOTE_CONTROLLER_URL || "";
  try {
    validateRelayServiceUrl(relayUrl);
    const phone = new URL(phoneUrl);
    if (
      phone.protocol !== "https:" ||
      phone.username ||
      phone.password ||
      phone.search ||
      phone.hash
    )
      return null;
    return { relayUrl, phoneUrl: phone.href };
  } catch {
    return null;
  }
}
