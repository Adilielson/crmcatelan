import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
  vite: {
    optimizeDeps: {
      include: [
        "@tanstack/router-core",
        "@tanstack/router-core/ssr/client",
        "@tanstack/history",
        "seroval",
        "h3-v2",
      ],
    },
  },
});