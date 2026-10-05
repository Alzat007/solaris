import type { GlobeLabProps } from "./GlobeLab";
window.CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;

// Set the runtime asset base before evaluating the geographic engine module.
export const loadEmbeddedEarth = () => import("./GlobeLab");
export type EmbeddedEarthProps = GlobeLabProps;
