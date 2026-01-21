import { sentryVitePlugin } from "@sentry/vite-plugin";
import { serwist } from "@serwist/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tanstackRouter({
    target: "react",
    autoCodeSplitting: true,
  }), react(), serwist({
    swSrc: "src/sw.ts",
    swDest: "sw.js",
    globDirectory: "dist",
    injectionPoint: "self.__SW_MANIFEST",
    rollupFormat: "iife",
  }), sentryVitePlugin({
    org: "sixhuman-es",
    project: "web-app"
  })],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },

  build: {
    sourcemap: true
  }
});