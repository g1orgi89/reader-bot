/**
 * 💾 STORAGE DEBUG UTILITIES
 * Comprehensive storage debugging for JWT tokens and auth data
 * 
 * @fileoverview Storage debugging utilities for Reader Bot Mini App
 * @version 1.0.0
 */

/**
 * Storage debugging class
 */
class StorageDebug {
    constructor() {
        this.isInitialized = false;
        this.originalSetItem = null;
        this.originalGetItem = null;
        this.originalRemoveItem = null;
        this.watchedKeys = [
            'authToken',
            'reader_auth_token', 
            'jwt_token',
            'auth_token',
            'token',
            'user_token',
            'telegram_auth_token'
        ];
        
        this.init();
    }
    
    /**
     * Инициализация storage debugging
     */
    init() {
        if (this.isInitialized) return;
        
        try {
            this.setupStorageWatching();
            this.logCurrentStorage();
            this.isInitialized = true;
            
            if (window.DebugUtils?.shouldLog('storage')) {
                window.DebugUtils.log('storage', '💾', 'Storage debugging initialized', {
                    watchedKeys: this.watchedKeys,
                    hasLocalStorage: typeof localStorage !== 'undefined',
                    hasSessionStorage: typeof sessionStorage !== 'undefined'
                });
            }
        } catch (error) {
            console.error('❌ Storage debug initialization failed:', error);
        }
    }
    
    /**
     * Настройка отслеживания изменений в storage
     */
    setupStorageWatching() {
        // Отслеживание localStorage
        if (typeof Storage !== 'undefined' && Storage.prototype.setItem) {
            this.originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = (key, value) => {
                this.logStorageOperation('SET', key, value, 'localStorage');
                return this.originalSetItem.call(this, key, value);
            };
            
            this.originalGetItem = Storage.prototype.getItem;
            Storage.prototype.getItem = function(key) {
                const value = this.originalGetItem ? this.originalGetItem.call(this, key) : this.getItem(key);
                if (this.watchedKeys.includes(key) || key.includes('token') || key.includes('auth')) {
                    this.logStorageOperation('GET', key, value, this === localStorage ? 'localStorage' : 'sessionStorage');
                }
                return value;
            }.bind(this);
            
            this.originalRemoveItem = Storage.prototype.removeItem;
            Storage.prototype.removeItem = (key) => {
                this.logStorageOperation('REMOVE', key, null, 'localStorage');
                return this.originalRemoveItem.call(this, key);
            };
        }
    }
    
    /**
     * Логирование операций с storage
     */
    logStorageOperation(operation, key, value, storageType) {
        // Проверяем, должен ли ключ отслеживаться
        const shouldWatch = this.watchedKeys.includes(key) || 
                           key.includes('token') || 
                           key.includes('auth') ||
                           key.includes('jwt');
        
        if (!shouldWatch) return;
        
        if (window.DebugUtils?.shouldLog('storage')) {
            const logData = {
                operation,
                key,
                storageType,
                hasValue: !!value,
                valueLength: value?.length,
                valuePreview: value && window.DebugUtils.createTokenPreview ? 
                             window.DebugUtils.createTokenPreview(value) : 
                             (value ? `${value.substring(0, 30)}...` : null),
                isTokenKey: key.includes('token'),
                isAuthKey: key.includes('auth')
            };
            
            window.DebugUtils.log('storage', '💾', `Storage ${operation}`, logData);
        }
    }
    
    /**
     * Логирование текущего состояния storage
     */
    logCurrentStorage() {
        if (!window.DebugUtils?.shouldLog('storage')) return;
        
        try {
            const localStorageData = this.getStorageSnapshot('localStorage');
            const sessionStorageData = this.getStorageSnapshot('sessionStorage');
            
            window.DebugUtils.log('storage', '💾', 'Current storage state', {
                localStorage: localStorageData,
                sessionStorage: sessionStorageData,
                totalTokenKeys: localStorageData.tokenKeys.length + sessionStorageData.tokenKeys.length
            });
        } catch (error) {
            console.error('❌ Error logging storage state:', error);
        }
    }
    
    /**
     * Получение снапшота storage
     */
    getStorageSnapshot(storageType) {
        const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
        if (!storage) return { available: false };
        
        const allKeys = Object.keys(storage);
        const tokenKeys = allKeys.filter(key => 
            this.watchedKeys.includes(key) || 
            key.includes('token') || 
            key.includes('auth')
        );
        
        const tokenData = {};
        tokenKeys.forEach(key => {
            const value = storage.getItem(key);
            tokenData[key] = {
                hasValue: !!value,
                length: value?.length,
                preview: value && window.DebugUtils?.createTokenPreview ? 
                        window.DebugUtils.createTokenPreview(value) : 
                        (value ? `${value.substring(0, 30)}...` : null)
            };
        });
        
        return {
            available: true,
            totalKeys: allKeys.length,
            tokenKeys: tokenKeys,
            tokenData: tokenData
        };
    }
    
    /**
     * Поиск токенов во всех storage
     */
    findAllTokens() {
        const tokens = {
            localStorage: {},
            sessionStorage: {},
            total: 0
        };
        
        // localStorage токены
        if (typeof localStorage !== 'undefined') {
            Object.keys(localStorage).forEach(key => {
                if (this.isTokenKey(key)) {
                    const value = localStorage.getItem(key);
                    tokens.localStorage[key] = {
                        value: value,
                        length: value?.length,
                        preview: window.DebugUtils?.createTokenPreview ? 
                                window.DebugUtils.createTokenPreview(value) : 
                                (value ? `${value.substring(0, 30)}...` : null)
                    };
                    tokens.total++;
                }
            });
        }
        
        // sessionStorage токены
        if (typeof sessionStorage !== 'undefined') {
            Object.keys(sessionStorage).forEach(key => {
                if (this.isTokenKey(key)) {
                    const value = sessionStorage.getItem(key);
                    tokens.sessionStorage[key] = {
                        value: value,
                        length: value?.length,
                        preview: window.DebugUtils?.createTokenPreview ? 
                                window.DebugUtils.createTokenPreview(value) : 
                                (value ? `${value.substring(0, 30)}...` : null)
                    };
                    tokens.total++;
                }
            });
        }
        
        return tokens;
    }
    
    /**
     * Проверка, является ли ключ токеном
     */
    isTokenKey(key) {
        return this.watchedKeys.includes(key) || 
               key.includes('token') || 
               key.includes('auth') ||
               key.includes('jwt');
    }
    
    /**
     * Очистка всех токенов (для debug целей)
     */
    clearAllTokens() {
        if (!window.DebugUtils?.shouldLog('storage')) return;
        
        const clearedTokens = [];
        
        // Очистка localStorage
        if (typeof localStorage !== 'undefined') {
            Object.keys(localStorage).forEach(key => {
                if (this.isTokenKey(key)) {
                    localStorage.removeItem(key);
                    clearedTokens.push({ storage: 'localStorage', key });
                }
            });
        }
        
        // Очистка sessionStorage
        if (typeof sessionStorage !== 'undefined') {
            Object.keys(sessionStorage).forEach(key => {
                if (this.isTokenKey(key)) {
                    sessionStorage.removeItem(key);
                    clearedTokens.push({ storage: 'sessionStorage', key });
                }
            });
        }
        
        window.DebugUtils.log('storage', '💾', 'All tokens cleared', {
            clearedCount: clearedTokens.length,
            clearedTokens: clearedTokens
        });
        
        return clearedTokens;
    }
    
    /**
     * Экспорт всех токенов для debugging
     */
    exportTokens() {
        const tokens = this.findAllTokens();
        
        if (window.DebugUtils?.shouldLog('storage')) {
            window.DebugUtils.log('storage', '💾', 'Tokens export', tokens);
        }
        
        return tokens;
    }
    
    /**
     * Импорт токена для testing
     */
    importToken(key, value, storageType = 'localStorage') {
        try {
            const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
            if (!storage) {
                throw new Error(`${storageType} not available`);
            }
            
            storage.setItem(key, value);
            
            if (window.DebugUtils?.shouldLog('storage')) {
                window.DebugUtils.log('storage', '💾', 'Token imported', {
                    key,
                    storageType,
                    valueLength: value?.length,
                    preview: window.DebugUtils.createTokenPreview ? 
                            window.DebugUtils.createTokenPreview(value) : 
                            `${value.substring(0, 30)}...`
                });
            }
            
            return true;
        } catch (error) {
            console.error('❌ Token import failed:', error);
            return false;
        }
    }
    
    /**
     * Мониторинг storage для реального времени
     */
    startRealTimeMonitoring(interval = 5000) {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        this.monitoringInterval = setInterval(() => {
            if (window.DebugUtils?.shouldLog('storage', 'verbose')) {
                this.logCurrentStorage();
            }
        }, interval);
        
        if (window.DebugUtils?.shouldLog('storage')) {
            window.DebugUtils.log('storage', '💾', 'Real-time monitoring started', {
                interval: interval
            });
        }
    }
    
    /**
     * Остановка мониторинга
     */
    stopRealTimeMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            
            if (window.DebugUtils?.shouldLog('storage')) {
                window.DebugUtils.log('storage', '💾', 'Real-time monitoring stopped');
            }
        }
    }
    
    /**
     * Cleanup при выгрузке страницы
     */
    cleanup() {
        this.stopRealTimeMonitoring();
        
        // Восстанавливаем оригинальные методы
        if (this.originalSetItem && typeof Storage !== 'undefined') {
            Storage.prototype.setItem = this.originalSetItem;
            Storage.prototype.getItem = this.originalGetItem;
            Storage.prototype.removeItem = this.originalRemoveItem;
        }
        
        this.isInitialized = false;
    }
}

// Инициализация storage debugging
let storageDebugInstance = null;

function initStorageDebug() {
    if (!storageDebugInstance && window.DEBUG_CONFIG?.ENABLE_STORAGE_DEBUG) {
        storageDebugInstance = new StorageDebug();
        
        // Cleanup при выгрузке страницы
        window.addEventListener('beforeunload', () => {
            if (storageDebugInstance) {
                storageDebugInstance.cleanup();
            }
        });
    }
    
    return storageDebugInstance;
}

// Глобальные helper функции
window.logAllStorage = function() {
    const instance = storageDebugInstance || initStorageDebug();
    if (instance) {
        instance.logCurrentStorage();
    }
};

window.findAllTokens = function() {
    const instance = storageDebugInstance || initStorageDebug();
    return instance ? instance.findAllTokens() : null;
};

window.clearAllTokens = function() {
    const instance = storageDebugInstance || initStorageDebug();
    return instance ? instance.clearAllTokens() : null;
};

window.exportTokens = function() {
    const instance = storageDebugInstance || initStorageDebug();
    return instance ? instance.exportTokens() : null;
};

// Экспорт
window.StorageDebug = StorageDebug;

// Автоматическая инициализация
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStorageDebug);
    } else {
        initStorageDebug();
    }
}

// Модульный экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        StorageDebug,
        initStorageDebug
    };
}