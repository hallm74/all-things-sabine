import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath } from "node:url";

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
    server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
  },
});
