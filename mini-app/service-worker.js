/**
 * Service Worker для Reader Bot Mini App
 * Обеспечивает offline функции, кэширование и PWA возможности
 * 
 * @fileoverview Service Worker для Progressive Web App функциональности
 * @version 1.0.0
 */

// Версия кэша - изменяется при обновлении приложения
const CACHE_VERSION = 'reader-bot-v1.0.0';
const CACHE_NAME = `reader-bot-cache-${CACHE_VERSION}`;

// Статические файлы для кэширования при установке
const STATIC_CACHE_FILES = [
    '/',
    '/index.html',
    '/css/main.css',
    '/css/mobile.css',
    '/js/app.js',
    '/js/telegram.js',
    '/js/api.js',
    '/config/app-config.js',
    '/config/api-endpoints.js',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
    '/manifest.json'
];

// API endpoints для кэширования данных
const API_CACHE_PATTERNS = [
    '/api/reader/quotes',
    '/api/reader/reports', 
    '/api/reader/achievements',
    '/api/reader/profile'
];

// Offline страница
const OFFLINE_PAGE = '/offline.html';

// Время жизни кэша (в миллисекундах) - используется для будущих возможностей
// eslint-disable-next-line no-unused-vars
const CACHE_EXPIRY = {
    STATIC: 24 * 60 * 60 * 1000,     // 24 часа для статических файлов
    API: 10 * 60 * 1000,             // 10 минут для API данных
    IMAGES: 7 * 24 * 60 * 60 * 1000  // 7 дней для изображений
};

/**
 * Событие установки Service Worker
 */
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker: Установка...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Кэширование статических файлов');
                return cache.addAll(STATIC_CACHE_FILES);
            })
            .then(() => {
                console.log('✅ Service Worker: Установка завершена');
                // Принудительно активировать новый Service Worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Ошибка установки:', error);
            })
    );
});

/**
 * Событие активации Service Worker
 */
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: Активация...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Удаляем старые кэши
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName.startsWith('reader-bot-cache-')) {
                            console.log('🗑️ Service Worker: Удаление старого кэша:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Активация завершена');
                // Принять управление всеми клиентами
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Ошибка активации:', error);
            })
    );
});

/**
 * Событие перехвата fetch запросов с comprehensive JWT debugging
 */
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Игнорируем не-GET запросы для кэширования (но логируем API запросы)
    if (request.method !== 'GET' && !url.pathname.startsWith('/api/reader/')) {
        return;
    }
    
    // Игнорируем запросы к внешним ресурсам (кроме API)
    if (url.origin !== location.origin) {
        return;
    }
    
    // 🔧 SERVICE WORKER DEBUG для API requests
    if (url.pathname.startsWith('/api/reader/')) {
        console.log('🔧 [SERVICE WORKER DEBUG]', {
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.url,
            pathname: url.pathname,
            
            // Headers analysis
            requestHeaders: Object.fromEntries(request.headers.entries()),
            hasAuthorizationHeader: request.headers.has('authorization'),
            authHeaderValue: request.headers.get('authorization') ? 
                           `${request.headers.get('authorization').substring(0, 50)}...` : null,
            
            // Service Worker context
            serviceWorkerVersion: CACHE_VERSION,
            cacheStrategyUsed: 'network-first',
            
            // Request analysis
            hasBody: request.method === 'POST' || request.method === 'PUT',
            contentType: request.headers.get('content-type'),
            
            // Auth specific checks
            isAuthEndpoint: url.pathname.includes('/auth/'),
            isProtectedEndpoint: url.pathname.includes('/quotes') || 
                               url.pathname.includes('/reports') || 
                               url.pathname.includes('/profile') ||
                               url.pathname.includes('/community')
        });
    }
    
    event.respondWith(handleFetchRequest(request, url));
});

/**
 * Обработка fetch запросов с различными стратегиями кэширования и JWT debugging
 * @param {Request} request - Запрос
 * @param {URL} url - URL запроса
 * @returns {Promise<Response>} Ответ
 */
async function handleFetchRequest(request, url) {
    const pathname = url.pathname;
    
    try {
        // Специальная обработка для API requests с JWT
        if (isApiRequest(pathname)) {
            return await handleApiRequestWithAuth(request, url);
        }
        
        // Стратегия для статических файлов: Cache First
        if (isStaticResource(pathname)) {
            return await cacheFirst(request);
        }
        
        // Стратегия для изображений: Cache First
        if (isImageRequest(pathname)) {
            return await cacheFirst(request);
        }
        
        // Стратегия для HTML страниц: Network First
        if (isHTMLRequest(request)) {
            return await networkFirstWithOfflinePage(request);
        }
        
        // По умолчанию: Network First
        return await networkFirst(request);
        
    } catch (error) {
        console.error('❌ Service Worker: Ошибка fetch:', error);
        
        // Fallback для HTML запросов - показать offline страницу
        if (isHTMLRequest(request)) {
            return await getOfflinePage();
        }
        
        throw error;
    }
}

/**
 * Специальная обработка API запросов с JWT аутентификацией
 * @param {Request} request - Запрос
 * @param {URL} url - URL запроса
 * @returns {Promise<Response>} Ответ
 */
async function handleApiRequestWithAuth(request, url) {
    try {
        // 🔧 SW AUTH TOKEN DEBUG
        const authToken = await getAuthToken();
        
        console.log('🔧 [SW AUTH TOKEN DEBUG]', {
            timestamp: new Date().toISOString(),
            endpoint: url.pathname,
            method: request.method,
            authTokenFromStorage: !!authToken,
            tokenLength: authToken?.length,
            tokenPreview: authToken ? `${authToken.substring(0, 30)}...` : null,
            requestNeedsAuth: isProtectedEndpoint(url.pathname),
            
            // Request headers analysis
            originalHasAuth: request.headers.has('authorization'),
            originalAuthHeader: request.headers.has('authorization') ? 
                              `${request.headers.get('authorization').substring(0, 50)}...` : null,
            
            // Decision making
            willAddAuthHeader: authToken && !request.headers.has('authorization'),
            authRequired: isProtectedEndpoint(url.pathname)
        });

        // Clone request and add auth header if needed
        if (authToken && !request.headers.has('authorization') && isProtectedEndpoint(url.pathname)) {
            const modifiedRequest = new Request(request, {
                headers: {
                    ...Object.fromEntries(request.headers.entries()),
                    'Authorization': `Bearer ${authToken}`
                }
            });

            console.log('🔧 [SW AUTH HEADER ADDED]', {
                timestamp: new Date().toISOString(),
                endpoint: url.pathname,
                originalHadAuth: request.headers.has('authorization'),
                modifiedHasAuth: modifiedRequest.headers.has('authorization'),
                addedAuthHeader: true,
                tokenPreview: `${authToken.substring(0, 30)}...`
            });

            // Use network first strategy with modified request
            return await networkFirstWithAuthHandling(modifiedRequest, url);
        }
        
        // For requests that already have auth or don't need it
        return await networkFirstWithAuthHandling(request, url);
        
    } catch (error) {
        console.error('🔧 [SW ERROR DEBUG]', {
            timestamp: new Date().toISOString(),
            errorMessage: error.message,
            errorType: error.constructor.name,
            url: request.url,
            method: request.method,
            endpoint: url.pathname
        });
        throw error;
    }
}

/**
 * Network First с обработкой auth ошибок
 * @param {Request} request - Запрос (возможно модифицированный)
 * @param {URL} url - URL запроса
 * @returns {Promise<Response>} Ответ
 */
async function networkFirstWithAuthHandling(request, url) {
    const cache = await caches.open(CACHE_NAME);
    
    try {
        console.log('🌐 SW Network First with Auth:', url.pathname);
        const networkResponse = await fetch(request);
        
        // 🔧 SW RESPONSE DEBUG
        console.log('🔧 [SW RESPONSE DEBUG]', {
            timestamp: new Date().toISOString(),
            endpoint: url.pathname,
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            ok: networkResponse.ok,
            
            // Auth specific analysis
            isAuthError: networkResponse.status === 401,
            isServerError: networkResponse.status >= 500,
            isForbidden: networkResponse.status === 403,
            
            // Response headers
            responseHeaders: Object.fromEntries(networkResponse.headers.entries()),
            hasAuthChallenge: networkResponse.headers.has('www-authenticate')
        });
        
        // Кэшируем успешные ответы (но не auth endpoints)
        if (networkResponse.ok && !url.pathname.includes('/auth/')) {
            cache.put(request, networkResponse.clone());
        }
        
        // Особая обработка auth ошибок
        if (networkResponse.status === 401) {
            console.error('🔧 [SW AUTH ERROR]', {
                timestamp: new Date().toISOString(),
                endpoint: url.pathname,
                message: 'Authentication failed',
                possibleCauses: [
                    'JWT token expired',
                    'JWT token invalid',
                    'Token not sent in headers',
                    'Backend auth middleware error'
                ],
                recommendations: [
                    'Check token in storage',
                    'Check if token is being sent',
                    'Check backend logs',
                    'Try re-authentication'
                ]
            });
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('💾 SW Network failed, trying cache:', url.pathname);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('🔧 [SW CACHE FALLBACK]', {
                timestamp: new Date().toISOString(),
                endpoint: url.pathname,
                fallbackReason: 'Network error',
                errorMessage: error.message
            });
            return cachedResponse;
        }
        
        throw error;
    }
}

/**
 * Проверка, требует ли endpoint аутентификации
 * @param {string} pathname - Путь URL
 * @returns {boolean} Требует ли аутентификации
 */
function isProtectedEndpoint(pathname) {
    const protectedPaths = [
        '/quotes',
        '/reports', 
        '/profile',
        '/community',
        '/stats',
        '/achievements'
    ];
    
    return protectedPaths.some(path => pathname.includes(path));
}

/**
 * Стратегия Cache First
 * Сначала проверяет кэш, затем сеть
 */
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        console.log('💾 Cache First: Возврат из кэша:', request.url);
        return cachedResponse;
    }
    
    console.log('🌐 Cache First: Запрос в сеть:', request.url);
    const networkResponse = await fetch(request);
    
    // Кэшируем успешные ответы
    if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
}

/**
 * Стратегия Network First
 * Сначала пытается получить из сети, затем из кэша
 */
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    
    try {
        console.log('🌐 Network First: Запрос в сеть:', request.url);
        const networkResponse = await fetch(request);
        
        // Кэшируем успешные ответы
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('💾 Network First: Fallback на кэш:', request.url);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

/**
 * Стратегия Network First с offline страницей
 */
async function networkFirstWithOfflinePage(request) {
    try {
        return await networkFirst(request);
    } catch (error) {
        return await getOfflinePage();
    }
}

/**
 * Получить offline страницу
 */
async function getOfflinePage() {
    const cache = await caches.open(CACHE_NAME);
    const offlinePage = await cache.match(OFFLINE_PAGE);
    
    if (offlinePage) {
        return offlinePage;
    }
    
    // Создаем простую offline страницу если нет кэшированной
    return new Response(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline - Reader Bot</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    text-align: center;
                    padding: 50px 20px;
                    background: #f7fafc;
                    color: #2d3748;
                }
                .offline-container {
                    max-width: 400px;
                    margin: 0 auto;
                }
                .offline-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                h1 { color: #667eea; }
                button {
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    cursor: pointer;
                    margin-top: 20px;
                }
                button:hover { background: #5a67d8; }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <div class="offline-icon">📱</div>
                <h1>Вы не в сети</h1>
                <p>Проверьте подключение к интернету и попробуйте снова.</p>
                <p>Некоторые функции могут быть недоступны в режиме offline.</p>
                <button onclick="window.location.reload()">Попробовать снова</button>
            </div>
        </body>
        </html>
    `, {
        headers: { 'Content-Type': 'text/html' }
    });
}

/**
 * Проверка типов ресурсов
 */
function isStaticResource(pathname) {
    return pathname.endsWith('.css') || 
           pathname.endsWith('.js') || 
           pathname.endsWith('.woff') || 
           pathname.endsWith('.woff2') ||
           pathname.includes('/assets/');
}

function isApiRequest(pathname) {
    return pathname.startsWith('/api/') || 
           API_CACHE_PATTERNS.some(pattern => pathname.includes(pattern));
}

function isImageRequest(pathname) {
    return pathname.endsWith('.png') || 
           pathname.endsWith('.jpg') || 
           pathname.endsWith('.jpeg') || 
           pathname.endsWith('.gif') || 
           pathname.endsWith('.webp') || 
           pathname.endsWith('.svg');
}

function isHTMLRequest(request) {
    return request.headers.get('Accept')?.includes('text/html');
}

/**
 * Событие синхронизации в фоне
 */
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Background Sync:', event.tag);
    
    if (event.tag === 'sync-quotes') {
        event.waitUntil(syncQuotes());
    }
    
    if (event.tag === 'sync-reports') {
        event.waitUntil(syncReports());
    }
});

/**
 * Получить JWT токен из storage для аутентификации с comprehensive debugging
 */
async function getAuthToken() {
    try {
        let token = null;
        const storageAttempts = [];
        
        // 1. Проверяем sessionStorage
        try {
            if (typeof sessionStorage !== 'undefined') {
                token = sessionStorage.getItem('reader_auth_token');
                storageAttempts.push({
                    storage: 'sessionStorage',
                    key: 'reader_auth_token',
                    found: !!token,
                    tokenLength: token?.length
                });
                if (token) {
                    console.log('🔧 [SW STORAGE DEBUG] Token found in sessionStorage');
                    return token;
                }
            }
        } catch (sessionError) {
            storageAttempts.push({
                storage: 'sessionStorage',
                error: sessionError.message
            });
        }
        
        // 2. Проверяем localStorage  
        try {
            if (typeof localStorage !== 'undefined') {
                token = localStorage.getItem('reader_auth_token');
                storageAttempts.push({
                    storage: 'localStorage',
                    key: 'reader_auth_token',
                    found: !!token,
                    tokenLength: token?.length
                });
                if (token) {
                    console.log('🔧 [SW STORAGE DEBUG] Token found in localStorage');
                    return token;
                }
            }
        } catch (localError) {
            storageAttempts.push({
                storage: 'localStorage',
                error: localError.message
            });
        }
        
        // 3. Проверяем альтернативные ключи
        const alternativeKeys = ['authToken', 'jwt_token', 'auth_token', 'token'];
        for (const key of alternativeKeys) {
            try {
                // sessionStorage
                if (typeof sessionStorage !== 'undefined') {
                    const altToken = sessionStorage.getItem(key);
                    if (altToken) {
                        storageAttempts.push({
                            storage: 'sessionStorage',
                            key: key,
                            found: true,
                            tokenLength: altToken.length,
                            alternative: true
                        });
                        console.log(`🔧 [SW STORAGE DEBUG] Token found in sessionStorage with alternative key: ${key}`);
                        return altToken;
                    }
                }
                
                // localStorage
                if (typeof localStorage !== 'undefined') {
                    const altToken = localStorage.getItem(key);
                    if (altToken) {
                        storageAttempts.push({
                            storage: 'localStorage',
                            key: key,
                            found: true,
                            tokenLength: altToken.length,
                            alternative: true
                        });
                        console.log(`🔧 [SW STORAGE DEBUG] Token found in localStorage with alternative key: ${key}`);
                        return altToken;
                    }
                }
            } catch (error) {
                storageAttempts.push({
                    storage: 'both',
                    key: key,
                    error: error.message,
                    alternative: true
                });
            }
        }
        
        // Логируем все попытки поиска токена
        console.log('🔧 [SW STORAGE DEBUG] Token search complete', {
            timestamp: new Date().toISOString(),
            totalAttempts: storageAttempts.length,
            storageAttempts: storageAttempts,
            tokenFound: false,
            recommendedActions: [
                'Check if user is authenticated',
                'Check if token was properly saved after auth',
                'Check API service setAuthToken method',
                'Check frontend auth flow'
            ]
        });
        
        return null;
    } catch (error) {
        console.error('🔧 [SW STORAGE ERROR]', {
            timestamp: new Date().toISOString(),
            errorMessage: error.message,
            errorType: error.constructor.name,
            stackTrace: error.stack?.substring(0, 200)
        });
        return null;
    }
}

/**
 * Синхронизация цитат при восстановлении соединения с comprehensive debugging
 */
async function syncQuotes() {
    try {
        console.log('🔄 Синхронизация цитат...');
        
        // Получаем несинхронизированные цитаты из IndexedDB
        const pendingQuotes = await getPendingQuotes();
        
        console.log('🔧 [SW SYNC DEBUG]', {
            timestamp: new Date().toISOString(),
            pendingQuotesCount: pendingQuotes.length,
            syncStarted: true
        });

        for (const quote of pendingQuotes) {
            try {
                // 🔧 SW SYNC QUOTE DEBUG
                const authToken = await getAuthToken();
                
                console.log('🔧 [SW SYNC QUOTE DEBUG]', {
                    timestamp: new Date().toISOString(),
                    quoteId: quote.id,
                    hasAuthToken: !!authToken,
                    tokenLength: authToken?.length,
                    tokenPreview: authToken ? `${authToken.substring(0, 30)}...` : null,
                    quoteText: quote.text?.substring(0, 50) + '...'
                });
                
                // Подготавливаем заголовки
                const headers = { 'Content-Type': 'application/json' };
                if (authToken) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }
                
                console.log('🔧 [SW SYNC REQUEST DEBUG]', {
                    timestamp: new Date().toISOString(),
                    endpoint: '/api/reader/quotes',
                    method: 'POST',
                    headers: Object.keys(headers),
                    hasAuthHeader: !!headers['Authorization'],
                    quoteId: quote.id
                });
                
                // Используем правильный endpoint для Reader API
                const response = await fetch('/api/reader/quotes', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(quote)
                });
                
                console.log('🔧 [SW SYNC RESPONSE DEBUG]', {
                    timestamp: new Date().toISOString(),
                    quoteId: quote.id,
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    isAuthError: response.status === 401
                });
                
                if (response.ok) {
                    await removePendingQuote(quote.id);
                    console.log('✅ Цитата синхронизирована:', quote.id);
                } else {
                    console.error('❌ Ошибка синхронизации цитаты:', {
                        quoteId: quote.id,
                        status: response.status,
                        statusText: response.statusText
                    });
                }
            } catch (error) {
                console.error('❌ Ошибка синхронизации цитаты:', {
                    quoteId: quote.id,
                    error: error.message,
                    errorType: error.constructor.name
                });
            }
        }
        
        console.log('🔧 [SW SYNC COMPLETE]', {
            timestamp: new Date().toISOString(),
            totalQuotes: pendingQuotes.length,
            syncCompleted: true
        });
        
    } catch (error) {
        console.error('❌ Ошибка синхронизации цитат:', {
            error: error.message,
            errorType: error.constructor.name,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Синхронизация отчетов
 */
async function syncReports() {
    try {
        console.log('🔄 Синхронизация отчетов...');
        
        // Обновляем кэш отчетов
        const cache = await caches.open(CACHE_NAME);
        
        const reportUrls = [
            '/api/reports/weekly/current',
            '/api/reports/monthly/current'
        ];
        
        for (const url of reportUrls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    cache.put(url, response.clone());
                }
            } catch (error) {
                console.error('❌ Ошибка синхронизации отчета:', url, error);
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка синхронизации отчетов:', error);
    }
}

/**
 * Обработка push уведомлений
 */
self.addEventListener('push', (event) => {
    console.log('📨 Service Worker: Push уведомление получено');
    
    const options = {
        body: 'У вас есть новые цитаты для анализа!',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        tag: 'reader-bot-notification',
        requireInteraction: false,
        actions: [
            {
                action: 'open',
                title: 'Открыть приложение'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ]
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            options.body = data.body || options.body;
            options.title = data.title || 'Reader Bot';
        } catch (error) {
            console.error('❌ Ошибка парсинга push данных:', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification('Reader Bot', options)
    );
});

/**
 * Обработка кликов по уведомлениям
 */
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Service Worker: Клик по уведомлению');
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' })
                .then((clients) => {
                    // Если приложение уже открыто, фокусируемся на нем
                    for (const client of clients) {
                        if (client.url.includes(self.location.origin)) {
                            return client.focus();
                        }
                    }
                    
                    // Иначе открываем новое окно
                    return self.clients.openWindow('/');
                })
        );
    }
});

/**
 * Утилиты для работы с IndexedDB (заглушки)
 * В реальном приложении здесь будет полная реализация
 */
async function getPendingQuotes() {
    // TODO: Реализовать получение несинхронизированных цитат из IndexedDB
    return [];
}

async function removePendingQuote(quoteId) {
    // TODO: Реализовать удаление синхронизированной цитаты из IndexedDB
    console.log('Удаление синхронизированной цитаты:', quoteId);
}

/**
 * Обработка сообщений от основного приложения
 */
self.addEventListener('message', (event) => {
    console.log('💬 Service Worker: Сообщение получено:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});

console.log('🚀 Service Worker загружен, версия:', CACHE_VERSION);