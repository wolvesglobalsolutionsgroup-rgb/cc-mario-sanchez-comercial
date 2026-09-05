/**
 * ==============================================================================
 * SERVICE WORKER: SOPORTE PWA & ACTUALIZACIÓN INMEDIATA (NETWORK-FIRST)
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * ==============================================================================
 */

const CACHE_NAME = 'ccms-erp-v2.7.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/alquiler.html',
  '/gestion/',
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
  '/gestion/js/ayuda-content.js',
  '/gestion/js/app.js',
  '/favicon_2k.png',
  '/apple-touch-icon_2k.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network-First: Siempre intenta obtener la versión más reciente de la red
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  // No interceptar peticiones externas (APIs, CDNs, Supabase)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback a caché solo si no hay conexión a internet
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/gestion/login.html') || caches.match('/gestion/index.html') || caches.match('/index.html');
          }
        });
      })
  );
});


