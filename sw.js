// web/sw.js
const CACHE_NAME = 'strada-pos-offline-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/main.dart.js',
  '/flutter_service_worker.js',
  '/assets/FontManifest.json',
  '/assets/AssetManifest.json',
  '/assets/fonts/MaterialIcons-Regular.otf',
  // Add your app's critical assets
];

// Install - Cache core assets for offline use
self.addEventListener('install', (event) => {
  console.log('SW: Installing and caching core assets...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('SW: Core assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('SW: Failed to cache core assets:', error);
      })
  );
});

// Activate - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Taking control of all clients');
      return self.clients.claim();
    })
  );
});

// Fetch - Serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Firebase/external API calls - let them fail naturally
  if (request.url.includes('firestore.googleapis.com') ||
      request.url.includes('firebase') ||
      request.url.includes('googleapis.com')) {
    return; // Let Firebase handle its own offline behavior
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('SW: Serving from cache:', request.url);
          return cachedResponse;
        }

        // Try network first for non-critical assets
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('SW: Network failed for:', request.url);

            // For navigation requests, return index.html from cache
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }

            // For other requests, throw the error
            throw error;
          });
      })
  );
});

// Message handling for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(CORE_ASSETS);
      })
    );
  }
});