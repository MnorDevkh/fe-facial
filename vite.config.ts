import { defineConfig, type ProxyOptions } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";

const lanMode = process.env.LAN === "1";

const API_TARGET =
  process.env.API_TARGET ?? "https://facial-detection-api.tepthida.site";

/** Proxy API calls but serve index.html for browser refreshes on SPA routes. */
function spaAwareProxy(overrides: Partial<ProxyOptions> = {}): ProxyOptions {
  const { bypass: customBypass, ...rest } = overrides;

  return {
    target: API_TARGET,
    changeOrigin: true,
    ...rest,
    bypass(req, _res, options) {
      if (customBypass) {
        const result = customBypass(req, _res, options);
        if (result !== undefined) {
          return result;
        }
      }

      const accept = req.headers.accept ?? "";
      const isHtmlNavigation =
        req.method === "GET" &&
        accept.includes("text/html") &&
        !req.url?.includes("?");

      if (isHtmlNavigation) {
        return "/index.html";
      }

      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [react(), ...(lanMode ? [basicSsl()] : [])],
  appType: "spa",
  server: {
    port: 5173,
    host: lanMode || undefined,
    https: lanMode ? {} : undefined,
    proxy: {
      "/health": spaAwareProxy(),
      "/people": spaAwareProxy(),
      "/classes": spaAwareProxy(),
      "/dataset": spaAwareProxy(),
      "/train": spaAwareProxy(),
      "/recognize": spaAwareProxy(),
      "/attendance": spaAwareProxy(),
      "/docs": spaAwareProxy(),
      "/redoc": spaAwareProxy(),
      "/openapi.json": spaAwareProxy(),
    },
  },
});
