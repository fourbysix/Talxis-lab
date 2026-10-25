import { defineConfig, type Plugin } from "vite";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import react from "@vitejs/plugin-react";
import { powerApps } from '@microsoft/power-apps-vite';

function fluentIconFonts(): Plugin {
  const iconNames = createRequire(import.meta.url).resolve("@fluentui/font-icons-mdl2/lib/data/AllIconNames.json");
  const fontsDir = path.resolve(path.dirname(iconNames), "../../fonts");
  return {
    name: "fluent-icon-fonts",
    configureServer(server) {
      server.middlewares.use("/fonts", (request, response, next) => {
        const file = path.join(fontsDir, path.basename(request.url ?? ""));
        if (!fs.existsSync(file)) return next();
        response.setHeader("Content-Type", "font/woff");
        fs.createReadStream(file).pipe(response);
      });
    },
    generateBundle() {
      for (const file of fs.readdirSync(fontsDir)) {
        this.emitFile({ type: "asset", fileName: `fonts/${file}`, source: fs.readFileSync(path.join(fontsDir, file)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    powerApps(),
    fluentIconFonts(),
  ],
  server: { port: 5173 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
