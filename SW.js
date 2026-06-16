/*
 * Tourenplan Pro — Service Worker
 * Strategie: Network-First für Navigation
 * → Installierte PWA holt IMMER die neueste Version vom Server
 * → Offline-Fallback aus Cache
 *
 * GitHub Pages Setup:
 * 1. Tourenplan-Pro.html  →  ins Repository laden
 * 2. sw.js                →  ins gleiche Repository laden (selber Ordner)
 * Fertig — Auto-Update funktioniert ab sofort.
 */

const CACHE = 'tourenplan-offline-v3.1.0';

/* ── Install: sofort aktivieren, kein Warten ─────────────── */
self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

/* ── Activate: alten Cache löschen, Kontrolle übernehmen ─── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: Network-First für HTML-Navigation ─────────────── */
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return; // Nur Seitenaufrufe abfangen

  e.respondWith(
    fetch(e.request, { cache: 'no-store' }) // Immer frisch vom Server
      .then(response => {
        // Für Offline-Fallback cachen
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }

        // Versionscheck: Hat der Server eine neuere APP_VERSION?
        response.clone().text().then(html => {
          const m = html.match(/APP_VERSION='([^']+)'/);
          if (!m) return;
          const serverVersion = m[1];

          // Alle aktiven Clients informieren
          self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'SW_VERSION_CHECK', v: serverVersion });
            });
          });
        }).catch(() => {});

        return response;
      })
      .catch(() => {
        // Offline: aus Cache laden
        return caches.match(e.request)
          .then(cached => cached || new Response(
            '<h2>Offline</h2><p>Bitte Internetverbindung prüfen.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          ));
      })
  );
});

/* ── Message: Skip Waiting auf Anfrage der App ───────────── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
