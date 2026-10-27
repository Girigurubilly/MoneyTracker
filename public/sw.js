/* HK Life Money — cache the app shell so the ledger works offline. */
const CACHE = "hk-life-money-shell-v10";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      const scope = self.registration.scope;
      return cache.addAll([scope, new URL("index.html", scope).href]).catch(() => undefined);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("accounts.google") || url.hostname.includes("googleapis")) return;

  if (req.mode === "navigate") {
    // Network first; SPA fallback to cached index.html for deep links when offline.
    // Shell assets are cloned once on install — do not re-put on every navigation.
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(async () => {
        const cache = await caches.open(CACHE);
        return (
          (await cache.match(new URL("index.html", self.registration.scope))) ||
          (await cache.match(self.registration.scope)) ||
          (await cache.match(req)) ||
          Response.error()
        );
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
