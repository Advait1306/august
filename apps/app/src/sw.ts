import { defaultCache } from "@serwist/vite/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Change this attribute's name to your `injectionPoint`.
    // `injectionPoint` is an InjectManifest option.
    // See https://serwist.pages.dev/docs/build/configuring
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

/*
 * SPA Offline Routing Explanation
 * 
 * How it works: The service worker intercepts navigation requests and falls back to cached content when offline.
 * 
 * First Load (Online):
 * 1. Browser requests / from network
 * 2. Network returns index.html + JS/CSS  
 * 3. Service worker installs and precaches index.html, JS, CSS
 * 4. React Router loads and app is now running and cached
 * 
 * Navigation to /mcp (Online):
 * 1. User clicks link to /mcp
 * 2. React Router handles client-side route change (no network request)
 * 3. URL changes to /mcp, page updates
 * 
 * Page Reload on /mcp (Offline):
 * 1. Browser requests GET /mcp (navigation request)
 * 2. Service worker tries fetch('/mcp')
 * 3. Network is unavailable, fetch fails
 * 4. Service worker catches network error and serves cached index.html
 * 5. Browser loads index.html + React Router from cache  
 * 6. React Router sees URL is /mcp and renders MCP page
 * 
 * Key: This service worker acts as a "smart proxy" that serves cached index.html 
 * whenever a specific route fails to load, letting React Router handle client-side routing even offline.
 */

// Handle SPA navigation fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(async () => {
          // When offline, return the cached index.html for SPA routes
          // Try to get the precached index.html
          const indexResponse = await serwist.handleRequest({ request: new Request('/index.html'), event });
          if (indexResponse) {
            return indexResponse;
          }
          
          // Fallback to manually checking cache
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            if (cacheName.includes('precache')) {
              const cache = await caches.open(cacheName);
              const cachedResponse = await cache.match('/index.html') || await cache.match('/');
              if (cachedResponse) {
                return cachedResponse;
              }
            }
          }
          
          return new Response('App not available offline', { status: 404 });
        })
    );
  }
});

serwist.addEventListeners();
