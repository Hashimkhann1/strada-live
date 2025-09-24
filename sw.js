// web/sw.js
const CACHE_NAME = 'strada-pos-v1';
const OFFLINE_URL = '/index.html';

// Files to cache immediately
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install - cache core files
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('SW: Static files cached, skipping waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('SW: Install failed:', error);
      })
  );
});

// Activate - take control immediately
self.addEventListener('activate', (event) => {
  console.log('SW: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('SW: Taking control of all clients');
        return self.clients.claim();
      })
  );
});

// Fetch - handle requests
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Don't intercept Firebase/API calls
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          console.log('SW: Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Try network
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone and cache successful responses
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.log('SW: Network failed for:', event.request.url);

            // For navigation requests, always return index.html when offline
            if (event.request.mode === 'navigate' ||
                event.request.destination === 'document' ||
                event.request.headers.get('accept').includes('text/html')) {
              console.log('SW: Returning offline page for navigation');
              return caches.match(OFFLINE_URL);
            }

            // For other requests, let them fail
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});