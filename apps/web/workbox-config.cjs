const path = require("path");

// Use different paths based on build target
const isVercel = process.env.VERCEL;
const publicDir = isVercel
  ? path.join(__dirname, ".vercel", "output", "static")
  : path.join(__dirname, ".output", "public");
const swDestDir = isVercel
  ? path.join(__dirname, ".vercel", "output", "static")
  : path.join(__dirname, ".output", "public");

  console.log(publicDir)
  

module.exports = {
  globDirectory: publicDir,
  globPatterns: [
    "**/*.{css,html,png,jpg,jpeg,svg,webp,ico,woff,woff2}",
    "assets/**/*.js",
  ],
  globIgnores: ["**/node_modules/**/*", "sw.js", "workbox-*.js"],
  swDest: path.join(swDestDir, "sw.js"),
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-fonts-stylesheets",
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com/,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 3,
      },
    },
  ],
};
