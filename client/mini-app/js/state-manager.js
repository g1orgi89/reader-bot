/**
 * STATE MANAGER - Централизованное управление состоянием Mini App
 * 
 * ФУНКЦИИ:
 * - Синхронизация состояния между UI и API
 * - Кэширование данных для offline работы
 * - Real-time обновления
 * - Loading states management
 * - Error handling с user-friendly сообщениями
 * 
 * @version 1.0
 * @author Reader Bot Team
 */

class StateManager {
    constructor() {
        this.state = {
            // User data
            user: {
                profile: null,
                isAuthenticated: false,
                settings: null
            },
            
            // Content data
            quotes: {
                list: [],
                recentQuotes: [],
                totalCount: 0,
                lastUpdated: null,
                searchResults: [],
                filters: {
                    activeFilter: 'all',
                    searchQuery: '',
                    category: 'all'
                }
            },
            
            // Statistics
            stats: {
                totalQuotes: 0,
                weekQuotes: 0,
                streakDays: 0,
                longestStreak: 0,
                categories: {},
                lastUpdated: null
            },
            
            // Books catalog
            books: {
                list: [],
                categories: [],
                recommendations: [],
                lastUpdated: null
            },
            
            // Reports
            reports: {
                weekly: [],
                monthly: [],
                lastUpdated: null
            },
            
            // Achievements
            achievements: {
                list: [],
                unlockedCount: 0,
                lastUpdated: null
            },
            
            // App state
            app: {
                currentPage: 'home',
                isLoading: false,
                loadingOperations: new Set(),
                errors: [],
                notifications: [],
                isOnline: navigator.onLine,
                lastSync: null
            },
            
            // Cache settings
            cache: {
                maxAge: 5 * 60 * 1000, // 5 minutes
                quotesMaxAge: 2 * 60 * 1000, // 2 minutes for quotes
                statsMaxAge: 30 * 1000 // 30 seconds for stats
            }
        };
        
        this.listeners = new Map();
        this.apiClient = null;
        this.storage = new StorageManager();
        
        console.log('🗃️ StateManager инициализирован');
        
        // Инициализация
        this.init();
    }
    
    /**
     * Инициализация менеджера состояния
     */
    async init() {
        try {
            // Восстановление состояния из кэша
            await this.restoreFromCache();
            
            // Настройка online/offline обработки
            this.setupNetworkHandling();
            
            // Автосинхронизация
            this.setupAutoSync();
            
            console.log('✅ StateManager готов к работе');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации StateManager:', error);
        }
    }
    
    /**
     * Установка API клиента
     */
    setAPIClient(apiClient) {
        this.apiClient = apiClient;
        console.log('🔗 API клиент подключен к StateManager');
    }
    
    // =====================================
    // УПРАВЛЕНИЕ СОСТОЯНИЕМ
    // =====================================
    
    /**
     * Получение текущего состояния
     */
    getState(path = null) {
        if (path) {
            return this.getNestedValue(this.state, path);
        }
        return this.state;
    }
    
    /**
     * Обновление состояния
     */
    setState(path, value, options = {}) {
        const { 
            silent = false, 
            persist = true, 
            merge = false 
        } = options;
        
        const oldValue = this.getNestedValue(this.state, path);
        
        if (merge && typeof oldValue === 'object' && typeof value === 'object') {
            value = { ...oldValue, ...value };
        }
        
        this.setNestedValue(this.state, path, value);
        
        // Persist в кэш
        if (persist) {
            this.persistToCache(path, value);
        }
        
        // Уведомление слушателей
        if (!silent) {
            this.notifyListeners(path, value, oldValue);
        }
        
        console.log(`🔄 State updated: ${path}`, { oldValue, newValue: value });
    }
    
    /**
     * Подписка на изменения состояния
     */
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        
        this.listeners.get(path).add(callback);
        
        // Возвращаем функцию отписки
        return () => {
            this.listeners.get(path)?.delete(callback);
        };
    }
    
    /**
     * Уведомление слушателей
     */
    notifyListeners(path, newValue, oldValue) {
        // Уведомляем точных слушателей
        const exactListeners = this.listeners.get(path);
        if (exactListeners) {
            exactListeners.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('❌ Ошибка в listener:', error);
                }
            });
        }
        
        // Уведомляем родительские слушатели
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentListeners = this.listeners.get(parentPath);
            
            if (parentListeners) {
                const parentValue = this.getNestedValue(this.state, parentPath);
                parentListeners.forEach(callback => {
                    try {
                        callback(parentValue, null, parentPath);
                    } catch (error) {
                        console.error('❌ Ошибка в parent listener:', error);
                    }
                });
            }
        }
    }
    
    // =====================================
    // LOADING STATES MANAGEMENT
    // =====================================
    
    /**
     * Установка loading состояния
     */
    setLoading(operation, isLoading = true) {
        const operations = this.state.app.loadingOperations;
        
        if (isLoading) {
            operations.add(operation);
        } else {
            operations.delete(operation);
        }
        
        const globalLoading = operations.size > 0;
        
        this.setState('app.isLoading', globalLoading, { silent: true });
        this.setState(`app.loading.${operation}`, isLoading);
        
        console.log(`⏳ Loading state: ${operation} = ${isLoading}, global = ${globalLoading}`);
    }
    
    /**
     * Проверка loading состояния
     */
    isLoading(operation = null) {
        if (operation) {
            return this.state.app.loadingOperations.has(operation);
        }
        return this.state.app.isLoading;
    }
    
    /**
     * Wrapper для async операций с loading state
     */
    async withLoading(operation, asyncFunction) {
        this.setLoading(operation, true);
        
        try {
            const result = await asyncFunction();
            return result;
        } finally {
            this.setLoading(operation, false);
        }
    }
    
    // =====================================
    // ERROR HANDLING
    // =====================================
    
    /**
     * Добавление ошибки
     */
    addError(error, context = null) {
        const errorObj = {
            id: Date.now(),
            message: this.getUserFriendlyError(error),
            context: context,
            timestamp: new Date(),
            originalError: error
        };
        
        const errors = [...this.state.app.errors, errorObj];
        this.setState('app.errors', errors);
        
        console.error('❌ Error added:', errorObj);
        
        // Автоудаление через 10 секунд
        setTimeout(() => {
            this.removeError(errorObj.id);
        }, 10000);
        
        return errorObj.id;
    }
    
    /**
     * Удаление ошибки
     */
    removeError(errorId) {
        const errors = this.state.app.errors.filter(err => err.id !== errorId);
        this.setState('app.errors', errors);
    }
    
    /**
     * Получение user-friendly сообщения об ошибке
     */
    getUserFriendlyError(error) {
        if (typeof error === 'string') {
            return error;
        }
        
        if (error.message) {
            // Карта технических ошибок на понятные сообщения
            const errorMap = {
                'Network Error': 'Проблемы с подключением к интернету',
                'Failed to fetch': 'Не удалось загрузить данные. Проверьте подключение',
                'Unauthorized': 'Требуется повторная авторизация',
                'Forbidden': 'Недостаточно прав доступа',
                'Not Found': 'Запрашиваемые данные не найдены',
                'Internal Server Error': 'Временные проблемы на сервере',
                'timeout': 'Превышено время ожидания ответа'
            };
            
            for (const [key, friendlyMessage] of Object.entries(errorMap)) {
                if (error.message.includes(key)) {
                    return friendlyMessage;
                }
            }
            
            return error.message;
        }
        
        return 'Произошла неизвестная ошибка';
    }
    
    // =====================================
    // DATA SYNCHRONIZATION
    // =====================================
    
    /**
     * Синхронизация данных с API
     */
    async syncData(forceRefresh = false) {
        if (!this.apiClient) {
            console.warn('⚠️ API клиент не подключен');
            return;
        }
        
        if (!this.state.app.isOnline) {
            console.warn('⚠️ Приложение в offline режиме');
            return;
        }
        
        console.log('🔄 Начинаем синхронизацию данных...');
        
        try {
            // Параллельная загрузка основных данных
            await Promise.allSettled([
                this.syncUserStats(forceRefresh),
                this.syncRecentQuotes(forceRefresh),
                this.syncBooksCatalog(forceRefresh)
            ]);
            
            this.setState('app.lastSync', new Date());
            console.log('✅ Синхронизация завершена');
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            this.addError(error, 'sync');
        }
    }
    
    /**
     * Синхронизация статистики пользователя
     */
    async syncUserStats(forceRefresh = false) {
        const lastUpdated = this.state.stats.lastUpdated;
        const maxAge = this.state.cache.statsMaxAge;
        
        if (!forceRefresh && lastUpdated && (Date.now() - lastUpdated < maxAge)) {
            console.log('📊 Статистика актуальна, пропускаем загрузку');
            return;
        }
        
        await this.withLoading('stats', async () => {
            try {
                const stats = await this.apiClient.getUserStats();
                
                this.setState('stats', {
                    ...stats,
                    lastUpdated: Date.now()
                });
                
                console.log('📊 Статистика обновлена:', stats);
                
            } catch (error) {
                console.error('❌ Ошибка загрузки статистики:', error);
                throw error;
            }
        });
    }
    
    /**
     * Синхронизация недавних цитат
     */
    async syncRecentQuotes(forceRefresh = false) {
        const lastUpdated = this.state.quotes.lastUpdated;
        const maxAge = this.state.cache.quotesMaxAge;
        
        if (!forceRefresh && lastUpdated && (Date.now() - lastUpdated < maxAge)) {
            console.log('📝 Цитаты актуальны, пропускаем загрузку');
            return;
        }
        
        await this.withLoading('quotes', async () => {
            try {
                const quotes = await this.apiClient.getRecentQuotes(10);
                
                this.setState('quotes.recentQuotes', quotes);
                this.setState('quotes.lastUpdated', Date.now());
                
                console.log('📝 Недавние цитаты обновлены:', quotes.length);
                
            } catch (error) {
                console.error('❌ Ошибка загрузки цитат:', error);
                throw error;
            }
        });
    }
    
    /**
     * Синхронизация каталога книг
     */
    async syncBooksCatalog(forceRefresh = false) {
        const lastUpdated = this.state.books.lastUpdated;
        const maxAge = this.state.cache.maxAge;
        
        if (!forceRefresh && lastUpdated && (Date.now() - lastUpdated < maxAge)) {
            console.log('📚 Каталог актуален, пропускаем загрузку');
            return;
        }
        
        await this.withLoading('books', async () => {
            try {
                const books = await this.apiClient.getBookCatalog();
                
                this.setState('books.list', books);
                this.setState('books.lastUpdated', Date.now());
                
                console.log('📚 Каталог книг обновлен:', books.length);
                
            } catch (error) {
                console.error('❌ Ошибка загрузки каталога:', error);
                throw error;
            }
        });
    }
    
    /**
     * Добавление новой цитаты (optimistic update)
     */
    async addQuote(quoteData) {
        if (!this.apiClient) {
            throw new Error('API клиент не подключен');
        }
        
        // Optimistic update - добавляем в UI сразу
        const optimisticQuote = {
            id: `temp_${Date.now()}`,
            ...quoteData,
            createdAt: new Date().toISOString(),
            isOptimistic: true
        };
        
        const currentQuotes = this.state.quotes.recentQuotes;
        this.setState('quotes.recentQuotes', [optimisticQuote, ...currentQuotes]);
        
        // Обновляем статистику optimistically
        const currentStats = this.state.stats;
        this.setState('stats.totalQuotes', currentStats.totalQuotes + 1);
        this.setState('stats.weekQuotes', currentStats.weekQuotes + 1);
        
        try {
            await this.withLoading('addQuote', async () => {
                const result = await this.apiClient.saveQuote(quoteData);
                
                if (result.success) {
                    // Заменяем optimistic quote на реальный
                    const quotes = this.state.quotes.recentQuotes.map(q => 
                        q.id === optimisticQuote.id ? result.quote : q
                    );
                    this.setState('quotes.recentQuotes', quotes);
                    
                    // Обновляем реальную статистику
                    await this.syncUserStats(true);
                    
                    console.log('✅ Цитата успешно добавлена:', result.quote);
                    return result;
                } else {
                    throw new Error(result.error || 'Ошибка сохранения');
                }
            });
            
        } catch (error) {
            // Rollback optimistic update
            const quotes = this.state.quotes.recentQuotes.filter(q => q.id !== optimisticQuote.id);
            this.setState('quotes.recentQuotes', quotes);
            
            this.setState('stats.totalQuotes', currentStats.totalQuotes);
            this.setState('stats.weekQuotes', currentStats.weekQuotes);
            
            this.addError(error, 'addQuote');
            throw error;
        }
    }
    
    // =====================================
    // CACHING & STORAGE
    // =====================================
    
    /**
     * Сохранение в кэш
     */
    async persistToCache(path, value) {
        try {
            await this.storage.set(`state_${path}`, {
                value: value,
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить в кэш:', error);
        }
    }
    
    /**
     * Восстановление из кэша
     */
    async restoreFromCache() {
        try {
            const criticalPaths = [
                'user.profile',
                'stats',
                'quotes.recentQuotes',
                'books.list'
            ];
            
            for (const path of criticalPaths) {
                try {
                    const cached = await this.storage.get(`state_${path}`);
                    
                    if (cached && this.isCacheValid(cached.timestamp, path)) {
                        this.setNestedValue(this.state, path, cached.value);
                        console.log(`🔄 Восстановлено из кэша: ${path}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Не удалось восстановить ${path}:`, error);
                }
            }
            
        } catch (error) {
            console.warn('⚠️ Ошибка восстановления кэша:', error);
        }
    }
    
    /**
     * Проверка валидности кэша
     */
    isCacheValid(timestamp, path) {
        const maxAge = this.getCacheMaxAge(path);
        return (Date.now() - timestamp) < maxAge;
    }
    
    /**
     * Получение максимального времени жизни кэша для пути
     */
    getCacheMaxAge(path) {
        if (path.startsWith('stats')) {
            return this.state.cache.statsMaxAge;
        } else if (path.startsWith('quotes')) {
            return this.state.cache.quotesMaxAge;
        } else {
            return this.state.cache.maxAge;
        }
    }
    
    // =====================================
    // NETWORK HANDLING
    // =====================================
    
    /**
     * Настройка обработки сети
     */
    setupNetworkHandling() {
        window.addEventListener('online', () => {
            console.log('🌐 Соединение восстановлено');
            this.setState('app.isOnline', true);
            
            // Автоматическая синхронизация при восстановлении соединения
            setTimeout(() => {
                this.syncData(true);
            }, 1000);
        });
        
        window.addEventListener('offline', () => {
            console.log('🔌 Соединение потеряно');
            this.setState('app.isOnline', false);
        });
        
        // Начальная проверка
        this.setState('app.isOnline', navigator.onLine);
    }
    
    /**
     * Настройка автосинхронизации
     */
    setupAutoSync() {
        // Синхронизация каждые 2 минуты
        setInterval(() => {
            if (this.state.app.isOnline) {
                this.syncData();
            }
        }, 2 * 60 * 1000);
        
        // Синхронизация при фокусе на приложении
        window.addEventListener('focus', () => {
            if (this.state.app.isOnline) {
                const lastSync = this.state.app.lastSync;
                const timeSinceLastSync = lastSync ? Date.now() - lastSync.getTime() : Infinity;
                
                // Если прошло больше минуты с последней синхронизации
                if (timeSinceLastSync > 60 * 1000) {
                    this.syncData();
                }
            }
        });
    }
    
    // =====================================
    // UTILITY METHODS
    // =====================================
    
    /**
     * Получение вложенного значения по пути
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    /**
     * Установка вложенного значения по пути
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }
    
    /**
     * Debug информация
     */
    getDebugInfo() {
        return {
            stateSize: JSON.stringify(this.state).length,
            listenersCount: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
            loadingOperations: Array.from(this.state.app.loadingOperations),
            errorsCount: this.state.app.errors.length,
            isOnline: this.state.app.isOnline,
            lastSync: this.state.app.lastSync,
            cacheInfo: {
                statsAge: this.state.stats.lastUpdated ? Date.now() - this.state.stats.lastUpdated : null,
                quotesAge: this.state.quotes.lastUpdated ? Date.now() - this.state.quotes.lastUpdated : null,
                booksAge: this.state.books.lastUpdated ? Date.now() - this.state.books.lastUpdated : null
            }
        };
    }
}

/**
 * STORAGE MANAGER - Обертка для работы с хранилищем
 */
class StorageManager {
    constructor() {
        this.useMemoryFallback = false;
        this.memoryStorage = new Map();
        
        // Проверяем доступность localStorage
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
        } catch (error) {
            console.warn('⚠️ localStorage недоступен, используем memory fallback');
            this.useMemoryFallback = true;
        }
    }
    
    async get(key) {
        if (this.useMemoryFallback) {
            return this.memoryStorage.get(key);
        }
        
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.warn(`⚠️ Ошибка чтения ${key}:`, error);
            return null;
        }
    }
    
    async set(key, value) {
        if (this.useMemoryFallback) {
            this.memoryStorage.set(key, value);
            return;
        }
        
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`⚠️ Ошибка записи ${key}:`, error);
        }
    }
    
    async remove(key) {
        if (this.useMemoryFallback) {
            this.memoryStorage.delete(key);
            return;
        }
        
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn(`⚠️ Ошибка удаления ${key}:`, error);
        }
    }
    
    async clear() {
        if (this.useMemoryFallback) {
            this.memoryStorage.clear();
            return;
        }
        
        try {
            // Удаляем только наши ключи
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('state_')) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn('⚠️ Ошибка очистки storage:', error);
        }
    }
}

// Создаем глобальный экземпляр
window.StateManager = StateManager;

// Автоинициализация
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.stateManager = new StateManager();
        
        // Ждем готовности API клиента
        window.addEventListener('readerAPIReady', (event) => {
            window.stateManager.setAPIClient(event.detail.readerAPI);
        });
        
        console.log('✅ StateManager готов к использованию');
    });
}

console.log('🗃️ StateManager модуль загружен');