import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath } from "node:url";

import sources from "./src/lib/directory-sources.json";

export default defineConfig({
  site:
    process.env.SITE_MODE === "production"
      ? "https://allthingssabine.com"
      : "https://demo.allthingssabine.com",
  integrations: [
    react(),
    ...(process.env.SITE_MODE === "production" ? [sitemap()] : []),
  ],
  server: { host: "127.0.0.1", port: 4337 },
  vite: {
    ssr: { noExternal: ["@astrojs/react"] },
    server: {
      fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
      proxy: { "/api/calendar": {target: process.env.PUBLIC_API_ORIGIN || "https://hallm-menus-api.fly.dev", changeOrigin: true}, "/api/submissions": {target: process.env.PUBLIC_API_ORIGIN || "https://hallm-menus-api.fly.dev", changeOrigin: true}, "/api/directory-submissions/events": {target: process.env.PUBLIC_API_ORIGIN || "https://hallm-menus-api.fly.dev", changeOrigin: true}, ...Object.fromEntries(Object.entries(sources).map(([kind, source]) => [`/api/directories/${kind}`, {target: new URL(source.url).origin, changeOrigin: true, rewrite: (requestPath) => new URL(source.url).pathname + (requestPath.includes("?") ? requestPath.slice(requestPath.indexOf("?")) : "")}])) }
    },
  },
});
