const CACHE_NAME = 'reader-app-v1.0.0';
const OFFLINE_URL = './offline.html';

// Статические ресурсы для кэширования
const STATIC_RESOURCES = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/main.css',
  './css/mobile.css',
  './css/components.css',
  './js/telegram.js',
  './js/api.js',
  './js/app.js',
  // Иконки будут добавлены когда дизайнер предоставит
];

// API endpoints для кэширования
const API_CACHE_PATTERNS = [
  /\/api\/reader\/quotes/,
  /\/api\/reader\/stats/,
  /\/api\/reader\/profile/,
  /\/api\/reader\/achievements/,
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('Service Worker: Skip waiting');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Cache installation failed:', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Claiming clients');
        return self.clients.claim();
      })
  );
});

// Перехват запросов
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Игнорировать non-GET запросы для кэширования
  if (request.method !== 'GET') {
    return;
  }

  // Обработка навигационных запросов
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Если оффлайн, показываем кэшированную страницу или offline.html
          return caches.match('./index.html') || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Стратегия кэширования для статических ресурсов
  if (STATIC_RESOURCES.some(resource => request.url.includes(resource))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then(response => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
    return;
  }

  // Стратегия кэширования для API запросов
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Если оффлайн, возвращаем кэшированный ответ
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Возвращаем fallback данные для критических API
              return createOfflineFallback(request);
            });
        })
    );
    return;
  }

  // Для всех остальных запросов - обычное поведение
  event.respondWith(fetch(request));
});

// Background Sync для отложенных действий
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-quotes') {
    event.waitUntil(syncQuotes());
  }
});

// Push уведомления (заготовка для будущего)
self.addEventListener('push', event => {
  console.log('Service Worker: Push message received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Новое уведомление от Читателя',
      icon: './assets/icon-192.png',
      badge: './assets/badge-72.png',
      tag: data.tag || 'general',
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Открыть',
          icon: './assets/action-open.png'
        },
        {
          action: 'dismiss',
          title: 'Закрыть',
          icon: './assets/action-dismiss.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Читатель', options)
    );
  }
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

// Функции-помощники

/**
 * Создает fallback ответ для offline режима
 */
function createOfflineFallback(request) {
  const url = new URL(request.url);
  
  // Fallback для статистики
  if (url.pathname.includes('/stats')) {
    return new Response(JSON.stringify({
      totalQuotes: 0,
      weekQuotes: 0,
      streakDays: 0,
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Fallback для цитат
  if (url.pathname.includes('/quotes')) {
    return new Response(JSON.stringify({
      quotes: [],
      total: 0,
      offline: true,
      message: 'Данные недоступны в офлайн режиме'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Общий fallback
  return new Response(JSON.stringify({
    error: 'Offline',
    message: 'Данные недоступны без подключения к интернету'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Синхронизация цитат в фоновом режиме
 */
async function syncQuotes() {
  try {
    // Получаем несинхронизированные цитаты из IndexedDB
    const unsyncedQuotes = await getUnsyncedQuotes();
    
    for (const quote of unsyncedQuotes) {
      try {
        const response = await fetch('/api/reader/quotes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(quote)
        });
        
        if (response.ok) {
          await markQuoteAsSynced(quote.id);
          console.log('Service Worker: Quote synced successfully:', quote.id);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync quote:', quote.id, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Sync quotes failed:', error);
  }
}

/**
 * Получает несинхронизированные цитаты (заглушка)
 */
async function getUnsyncedQuotes() {
  // TODO: Реализовать работу с IndexedDB
  return [];
}

/**
 * Помечает цитату как синхронизированную (заглушка)
 */
async function markQuoteAsSynced(quoteId) {
  // TODO: Реализовать работу с IndexedDB
  console.log('Marking quote as synced:', quoteId);
}

// Обработка ошибок
self.addEventListener('error', event => {
  console.error('Service Worker: Global error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker: Unhandled promise rejection:', event.reason);
});

// Периодическая очистка кэша
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
        .then(() => {
          console.log('Service Worker: Cache cleared');
          return self.clients.claim();
        })
    );
  }
});

console.log('Service Worker: Script loaded');