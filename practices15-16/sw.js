const CACHE_NAME = 'app-shell-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/icons/icon-16x16.png',
    '/icons/icon-32x32.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/icons/apple-touch-icon.png',
    '/icons/favicon.ico'
];

// Установка - кэшируем App Shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Активация - очищаем старые кэши
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Перехват запросов
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (url.origin !== self.location.origin) return;
    
    if (url.pathname.startsWith('/content/')) {
        event.respondWith(
            fetch(event.request)
                .then(networkRes => {
                    const resClone = networkRes.clone();
                    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, resClone);
                    });
                    return networkRes;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(cached => cached || caches.match('/content/home.html'));
                })
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    return new Response('Не удалось загрузить ресурс', {
                        status: 404,
                        statusText: 'Not Found'
                    });
                })
        );
    }
});

// Обработчик push-уведомлений
self.addEventListener('push', (event) => {
    let data = { title: 'Новое уведомление', body: '' };
    if (event.data) {
        data = event.data.json();
    }
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-32x32.png',
        vibrate: [200, 100, 200]
    };
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});