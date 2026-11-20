const CACHE = "mihuerta-v6";
const ARCHIVOS = ["./", "./index.html", "./styles.css", "./data.js", "./etiqueta.js", "./calendario.js", "./calc.js", "./clima.js", "./respaldo.js", "./app.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./lib/leaflet/leaflet.js", "./lib/leaflet/leaflet.css"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Red primero (para recibir actualizaciones), caché si no hay internet
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
