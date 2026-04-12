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

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

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

self.addEventListener('push', (event) => {
    let data = { title: 'Новое уведомление', body: '', reminderId: null };
    if (event.data) {
        data = event.data.json();
    }
    
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-32x32.png',
        vibrate: [200, 100, 200],
        data: { reminderId: data.reminderId }
    };
    
    if (data.reminderId) {
        options.actions = [
            { action: 'snooze', title: 'Отложить на 5 минут' }
        ];
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const action = event.action;
    
    event.notification.close();
    
    if (action === 'snooze') {
        const reminderId = notification.data.reminderId;
        console.log('Откладывание напоминания, ID:', reminderId);
        console.log('Тип reminderId:', typeof reminderId);
        
        const url = new URL('/snooze', self.location.origin);
        url.searchParams.set('reminderId', reminderId);
        
        event.waitUntil(
            fetch(url.toString(), { method: 'POST' })
                .then(response => {
                    console.log('Ответ сервера:', response.status);
                    return response.json();
                })
                .then(data => console.log('Результат:', data))
                .catch(err => console.error('Ошибка fetch:', err))
        );
    }
});