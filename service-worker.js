/**
 * ==============================================================================
 * SERVICE WORKER: SOPORTE PWA OFFLINE & CACHE INTELIGENTE
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * ==============================================================================
 */

const CACHE_NAME = 'ccms-erp-v2.6.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/alquiler.html',
  '/gestion/index.html',
  '/gestion/login.html',
  '/gestion/onboarding.html',
  '/gestion/css/dashboard.css',
  '/gestion/js/security.js',
  '/gestion/js/auth-guard.js',
  '/gestion/js/financial-engine.js',
  '/gestion/js/venezuela-legal.js',
  '/gestion/js/seniat-engine.js',
  '/gestion/js/bank-reconciliation.js',
  '/gestion/js/tenant-loader.js',
  '/gestion/js/supabase-client.js',
  '/gestion/js/notifications.js',
  '/favicon_2k.png',
  '/apple-touch-icon_2k.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Fallo al precachear algunos assets:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  // No interceptar peticiones externas (APIs, CDNs, Supabase)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        if (cachedResponse) return cachedResponse;
        // Si no hay red ni cache y es HTML, retornar login/index de respaldo
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/gestion/login.html') || caches.match('/index.html');
        }
        throw err;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

