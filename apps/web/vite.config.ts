import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      external: ["workbox-config.js"],
    },
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      customViteReactPlugin: true,
      target: process.env.VERCEL ? "vercel" : "node-server",
      spa: {
        enabled: true,
      },
    }),
    viteReact(),
  ],
});
