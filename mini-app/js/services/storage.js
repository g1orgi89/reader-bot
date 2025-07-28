/**
 * 💾 STORAGE SERVICE - Локальное хранилище и кэширование
 * 
 * Управление данными в оффлайн режиме:
 * - localStorage для постоянного хранения
 * - sessionStorage для временных данных
 * - Кэширование API ответов
 * - Синхронизация при восстановлении сети
 * - Очистка устаревших данных
 * 
 * Размер: ~2KB согласно архитектуре
 */

class StorageService {
    constructor() {
        // 🔧 Конфигурация хранилища
        this.config = {
            // 🎯 Префиксы для ключей
            prefix: 'reader-app',
            userPrefix: 'user',
            cachePrefix: 'cache',
            tempPrefix: 'temp',

            // ⏱️ Время жизни кэша (в миллисекундах)
            cacheTTL: {
                quotes: 10 * 60 * 1000,      // 10 минут
                stats: 5 * 60 * 1000,        // 5 минут
                reports: 30 * 60 * 1000,     // 30 минут
                catalog: 60 * 60 * 1000,     // 1 час
                profile: 24 * 60 * 60 * 1000 // 24 часа
            },

            // 📊 Максимальные размеры
            maxCacheSize: 50, // Максимум кэшированных запросов
            maxStorageSize: 10 * 1024 * 1024 // 10MB в байтах
        };

        // 🔍 Debug режим
        this.debug = window.location.hostname === 'localhost';

        // 📊 Статистика использования
        this.stats = {
            reads: 0,
            writes: 0,
            hits: 0,
            misses: 0
        };

        // 🚀 Инициализация
        this.init();
    }

    /**
     * 🚀 Инициализация сервиса
     */
    init() {
        // 🧹 Очистка устаревших данных при старте
        this.cleanupExpiredData();

        // 📊 Логирование начального состояния
        this.log('🚀 Storage Service инициализирован', {
            localStorage: this.isAvailable('localStorage'),
            sessionStorage: this.isAvailable('sessionStorage'),
            totalSize: this.getTotalStorageSize()
        });
    }

    // ===========================================
    // 🔧 БАЗОВЫЕ МЕТОДЫ РАБОТЫ С ХРАНИЛИЩЕМ
    // ===========================================

    /**
     * 🔍 Проверка доступности хранилища
     */
    isAvailable(storageType) {
        try {
            const storage = window[storageType];
            const testKey = '__storage_test__';
            storage.setItem(testKey, 'test');
            storage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 🔑 Генерация ключа с префиксом
     */
    generateKey(type, key, userId = null) {
        const parts = [this.config.prefix];
        
        if (userId && type === 'user') {
            parts.push(this.config.userPrefix, userId);
        } else {
            parts.push(this.config[`${type}Prefix`] || type);
        }
        
        parts.push(key);
        return parts.join('_');
    }

    /**
     * 💾 Базовое сохранение данных
     */
    setItem(storageType, key, value, ttl = null) {
        if (!this.isAvailable(storageType)) {
            this.log(`❌ ${storageType} недоступен`);
            return false;
        }

        try {
            const data = {
                value,
                timestamp: Date.now(),
                ttl: ttl ? Date.now() + ttl : null
            };

            const storage = window[storageType];
            storage.setItem(key, JSON.stringify(data));
            
            this.stats.writes++;
            this.log(`💾 Сохранено в ${storageType}:`, { key, size: JSON.stringify(data).length });
            
            return true;
        } catch (error) {
            this.log(`❌ Ошибка сохранения в ${storageType}:`, error);
            
            // 🧹 Если места нет - очищаем старые данные
            if (error.name === 'QuotaExceededError') {
                this.cleanupOldData(storageType);
                // Повторная попытка
                try {
                    window[storageType].setItem(key, JSON.stringify({ value, timestamp: Date.now(), ttl }));
                    return true;
                } catch (retryError) {
                    return false;
                }
            }
            
            return false;
        }
    }

    /**
     * 📖 Базовое получение данных
     */
    getItem(storageType, key) {
        if (!this.isAvailable(storageType)) {
            return null;
        }

        try {
            const storage = window[storageType];
            const item = storage.getItem(key);
            
            if (!item) {
                this.stats.misses++;
                return null;
            }

            const data = JSON.parse(item);
            
            // ⏱️ Проверяем TTL
            if (data.ttl && Date.now() > data.ttl) {
                storage.removeItem(key);
                this.stats.misses++;
                this.log(`⏰ Данные истекли: ${key}`);
                return null;
            }

            this.stats.reads++;
            this.stats.hits++;
            return data.value;
        } catch (error) {
            this.log(`❌ Ошибка чтения из ${storageType}:`, error);
            this.stats.misses++;
            return null;
        }
    }

    /**
     * 🗑️ Удаление данных
     */
    removeItem(storageType, key) {
        if (!this.isAvailable(storageType)) {
            return false;
        }

        try {
            window[storageType].removeItem(key);
            this.log(`🗑️ Удалено из ${storageType}: ${key}`);
            return true;
        } catch (error) {
            this.log(`❌ Ошибка удаления из ${storageType}:`, error);
            return false;
        }
    }

    // ===========================================
    // 💾 МЕТОДЫ ДЛЯ ПОСТОЯННОГО ХРАНЕНИЯ
    // ===========================================

    /**
     * 💾 Сохранить в localStorage
     */
    setLocal(key, value, ttl = null) {
        const storageKey = this.generateKey('local', key);
        return this.setItem('localStorage', storageKey, value, ttl);
    }

    /**
     * 📖 Получить из localStorage
     */
    getLocal(key) {
        const storageKey = this.generateKey('local', key);
        return this.getItem('localStorage', storageKey);
    }

    /**
     * 🗑️ Удалить из localStorage
     */
    removeLocal(key) {
        const storageKey = this.generateKey('local', key);
        return this.removeItem('localStorage', storageKey);
    }

    // ===========================================
    // 🕐 МЕТОДЫ ДЛЯ ВРЕМЕННОГО ХРАНЕНИЯ
    // ===========================================

    /**
     * 🕐 Сохранить в sessionStorage
     */
    setSession(key, value) {
        const storageKey = this.generateKey('temp', key);
        return this.setItem('sessionStorage', storageKey, value);
    }

    /**
     * 📖 Получить из sessionStorage
     */
    getSession(key) {
        const storageKey = this.generateKey('temp', key);
        return this.getItem('sessionStorage', storageKey);
    }

    /**
     * 🗑️ Удалить из sessionStorage
     */
    removeSession(key) {
        const storageKey = this.generateKey('temp', key);
        return this.removeItem('sessionStorage', storageKey);
    }

    // ===========================================
    // 📊 КЭШИРОВАНИЕ API ЗАПРОСОВ
    // ===========================================

    /**
     * 💾 Кэшировать API ответ
     */
    cacheApiResponse(endpoint, method, params, response, customTTL = null) {
        const cacheKey = this.generateCacheKey(endpoint, method, params);
        
        // 🕒 Определяем TTL на основе типа запроса
        let ttl = customTTL;
        if (!ttl) {
            if (endpoint.includes('quotes')) ttl = this.config.cacheTTL.quotes;
            else if (endpoint.includes('stats')) ttl = this.config.cacheTTL.stats;
            else if (endpoint.includes('reports')) ttl = this.config.cacheTTL.reports;
            else if (endpoint.includes('catalog')) ttl = this.config.cacheTTL.catalog;
            else if (endpoint.includes('profile')) ttl = this.config.cacheTTL.profile;
            else ttl = this.config.cacheTTL.quotes; // По умолчанию
        }

        const storageKey = this.generateKey('cache', cacheKey);
        return this.setItem('localStorage', storageKey, {
            endpoint,
            method,
            params,
            response,
            cachedAt: Date.now()
        }, ttl);
    }

    /**
     * 📖 Получить кэшированный API ответ
     */
    getCachedApiResponse(endpoint, method, params) {
        const cacheKey = this.generateCacheKey(endpoint, method, params);
        const storageKey = this.generateKey('cache', cacheKey);
        return this.getItem('localStorage', storageKey);
    }

    /**
     * 🔑 Генерация ключа кэша
     */
    generateCacheKey(endpoint, method, params) {
        const keyData = { endpoint, method, params };
        return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '');
    }

    /**
     * 🗑️ Очистить кэш для конкретного endpoint
     */
    clearApiCache(endpointPattern = null) {
        if (!this.isAvailable('localStorage')) return;

        const storage = localStorage;
        const cachePrefix = this.generateKey('cache', '');
        const keysToRemove = [];

        // 🔍 Находим все ключи кэша
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith(cachePrefix)) {
                if (!endpointPattern) {
                    keysToRemove.push(key);
                } else {
                    try {
                        const data = JSON.parse(storage.getItem(key));
                        if (data.value && data.value.endpoint && data.value.endpoint.includes(endpointPattern)) {
                            keysToRemove.push(key);
                        }
                    } catch (error) {
                        keysToRemove.push(key); // Удаляем поврежденные записи
                    }
                }
            }
        }

        // 🗑️ Удаляем найденные ключи
        keysToRemove.forEach(key => storage.removeItem(key));
        
        this.log(`🧹 Очищен кэш`, { pattern: endpointPattern, removed: keysToRemove.length });
    }

    // ===========================================
    // 👤 ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ
    // ===========================================

    /**
     * 👤 Сохранить данные пользователя
     */
    setUserData(userId, key, value, permanent = true) {
        const storageKey = this.generateKey('user', key, userId);
        const storageType = permanent ? 'localStorage' : 'sessionStorage';
        const ttl = permanent ? this.config.cacheTTL.profile : null;
        return this.setItem(storageType, storageKey, value, ttl);
    }

    /**
     * 👤 Получить данные пользователя
     */
    getUserData(userId, key, checkSession = true) {
        const storageKey = this.generateKey('user', key, userId);
        
        // Сначала проверяем localStorage
        let data = this.getItem('localStorage', storageKey);
        
        // Если не найдено и разрешено - проверяем sessionStorage
        if (!data && checkSession) {
            data = this.getItem('sessionStorage', storageKey);
        }
        
        return data;
    }

    /**
     * 🗑️ Удалить данные пользователя
     */
    removeUserData(userId, key = null) {
        if (key) {
            // Удаляем конкретный ключ
            const storageKey = this.generateKey('user', key, userId);
            this.removeItem('localStorage', storageKey);
            this.removeItem('sessionStorage', storageKey);
        } else {
            // Удаляем все данные пользователя
            this.clearUserData(userId);
        }
    }

    /**
     * 🧹 Очистить все данные пользователя
     */
    clearUserData(userId) {
        const userPrefix = this.generateKey('user', '', userId);
        
        ['localStorage', 'sessionStorage'].forEach(storageType => {
            if (!this.isAvailable(storageType)) return;
            
            const storage = window[storageType];
            const keysToRemove = [];
            
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(userPrefix)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => storage.removeItem(key));
        });
        
        this.log(`🧹 Очищены данные пользователя: ${userId}`);
    }

    // ===========================================
    // 🧹 ОЧИСТКА И ОБСЛУЖИВАНИЕ
    // ===========================================

    /**
     * 🧹 Очистка устаревших данных
     */
    cleanupExpiredData() {
        ['localStorage', 'sessionStorage'].forEach(storageType => {
            if (!this.isAvailable(storageType)) return;
            
            const storage = window[storageType];
            const keysToRemove = [];
            
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(this.config.prefix)) {
                    try {
                        const data = JSON.parse(storage.getItem(key));
                        if (data.ttl && Date.now() > data.ttl) {
                            keysToRemove.push(key);
                        }
                    } catch (error) {
                        // Удаляем поврежденные записи
                        keysToRemove.push(key);
                    }
                }
            }
            
            keysToRemove.forEach(key => storage.removeItem(key));
            
            if (keysToRemove.length > 0) {
                this.log(`🧹 Очищено ${keysToRemove.length} устаревших записей из ${storageType}`);
            }
        });
    }

    /**
     * 🧹 Очистка старых данных при нехватке места
     */
    cleanupOldData(storageType) {
        if (!this.isAvailable(storageType)) return;
        
        const storage = window[storageType];
        const items = [];
        
        // 📊 Собираем все наши записи с временными метками
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith(this.config.prefix)) {
                try {
                    const data = JSON.parse(storage.getItem(key));
                    items.push({
                        key,
                        timestamp: data.timestamp || 0,
                        size: storage.getItem(key).length
                    });
                } catch (error) {
                    items.push({ key, timestamp: 0, size: 0 });
                }
            }
        }
        
        // 🗑️ Удаляем 25% самых старых записей
        items.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = Math.ceil(items.length * 0.25);
        
        for (let i = 0; i < toRemove; i++) {
            storage.removeItem(items[i].key);
        }
        
        this.log(`🧹 Очищено ${toRemove} старых записей для освобождения места`);
    }

    /**
     * 📊 Получить размер используемого хранилища
     */
    getTotalStorageSize() {
        let totalSize = 0;
        
        ['localStorage', 'sessionStorage'].forEach(storageType => {
            if (!this.isAvailable(storageType)) return;
            
            const storage = window[storageType];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(this.config.prefix)) {
                    const item = storage.getItem(key);
                    if (item) {
                        totalSize += item.length;
                    }
                }
            }
        });
        
        return totalSize;
    }

    /**
     * 📊 Получить статистику хранилища
     */
    getStorageStats() {
        const stats = {
            totalSize: this.getTotalStorageSize(),
            items: { localStorage: 0, sessionStorage: 0 },
            cacheItems: 0,
            userItems: 0,
            ...this.stats
        };
        
        ['localStorage', 'sessionStorage'].forEach(storageType => {
            if (!this.isAvailable(storageType)) return;
            
            const storage = window[storageType];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(this.config.prefix)) {
                    stats.items[storageType]++;
                    
                    if (key.includes(this.config.cachePrefix)) {
                        stats.cacheItems++;
                    } else if (key.includes(this.config.userPrefix)) {
                        stats.userItems++;
                    }
                }
            }
        });
        
        return stats;
    }

    /**
     * 🗑️ Полная очистка всех данных приложения
     */
    clearAll() {
        ['localStorage', 'sessionStorage'].forEach(storageType => {
            if (!this.isAvailable(storageType)) return;
            
            const storage = window[storageType];
            const keysToRemove = [];
            
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(this.config.prefix)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => storage.removeItem(key));
        });
        
        this.log('🧹 Все данные приложения очищены');
    }

    /**
     * 🔍 Логирование (только в debug режиме)
     */
    log(message, data = null) {
        if (this.debug) {
            console.log(`[Storage] ${message}`, data || '');
        }
    }
}

// 🌍 Создаем глобальный экземпляр
const storageService = new StorageService();

// 🌍 Глобальный экспорт
window.StorageService = StorageService;
window.storageService = storageService;

// 📱 Экспорт для модульной системы
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageService;
}
