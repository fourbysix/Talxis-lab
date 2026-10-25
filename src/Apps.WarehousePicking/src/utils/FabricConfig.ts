declare global {
  interface Window {
    FabricConfig?: { iconBaseUrl?: string; fontBaseUrl?: string };
  }
}

window.FabricConfig = { iconBaseUrl: new URL("fonts/", location.href).href, fontBaseUrl: "" };

export {};
