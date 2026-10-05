window.CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;
void import("./GlobeLab").then(({ mountGlobeLab }) => mountGlobeLab());

declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}
