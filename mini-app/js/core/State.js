/**
 * 🗂️ STATE MANAGEMENT - Глобальное состояние Telegram Mini App
 * 
 * Централизованное управление всеми данными приложения:
 * - Пользователь и профиль
 * - Цитаты и статистика
 * - Отчеты и достижения
 * - UI состояние и навигация
 * - Кэширование и синхронизация
 * 
 * Реактивная система на основе подписок и событий
 * Размер: ~2KB согласно архитектуре
 */

class AppState {
    constructor() {
        // 📊 Центральное хранилище данных
        this.store = {
            // 👤 Пользователь
            user: {
                profile: null,
                isAuthenticated: false,
                telegramData: null
            },

            // 📝 Цитаты
            quotes: {
                items: [],
                recent: [],
                total: 0,
                loading: false,
                lastUpdate: null
            },

            // 📊 Статистика
            stats: {
                totalQuotes: 0,
                thisWeek: 0,
                currentStreak: 0,
                longestStreak: 0,
                favoriteAuthors: [],
                loading: false
            },

            // 📈 Отчеты
            reports: {
                weekly: [],
                monthly: [],
                current: null,
                loading: false
            },

            // 🏆 Достижения
            achievements: {
                items: [],
                recent: [],
                progress: {},
                loading: false
            },

            // 📚 Каталог
            catalog: {
                books: [],
                categories: [],
                recommendations: [],
                promoCodes: [],
                loading: false
            },

            // 👥 Сообщество
            community: {
                messages: [],
                loading: false
            },

            // 🎨 UI состояние
            ui: {
                currentPage: 'home',
                loading: false,
                theme: 'light',
                bottomNavVisible: true,
                activeModal: null,
                notifications: []
            },

            // 🌐 Сеть и синхронизация
            network: {
                isOnline: navigator.onLine,
                lastSync: null,
                pendingRequests: []
            }
        };

        // 📋 Подписчики на изменения
        this.subscribers = new Map();

        // 🔄 История изменений (для debug)
        this.history = [];
        this.maxHistorySize = 50;

        // 🔍 Debug режим
        this.debug = window.location.hostname === 'localhost';

        // 🎯 Инициализация
        this.init();
    }

    /**
     * 🚀 Инициализация системы состояния
     */
    init() {
        // 🌐 Отслеживаем состояние сети
        this.networkHandlers = {
            online: () => this.setNetwork({ isOnline: true }),
            offline: () => this.setNetwork({ isOnline: false })
        };
        
        window.addEventListener('online', this.networkHandlers.online);
        window.addEventListener('offline', this.networkHandlers.offline);

        // 💾 Загружаем сохраненное состояние
        this.loadPersistedState();

        this.log('🚀 AppState инициализирован');
    }

    /**
     * 🧹 ИСПРАВЛЕНО: Очистка ресурсов для предотвращения утечек памяти
     */
    cleanup() {
        // Удаляем event listeners
        if (this.networkHandlers) {
            window.removeEventListener('online', this.networkHandlers.online);
            window.removeEventListener('offline', this.networkHandlers.offline);
        }

        // Очищаем подписчики
        this.subscribers.clear();

        // Очищаем историю
        this.history = [];

        this.log('🧹 AppState очищен');
    }

    // ===========================================
    // 📋 СИСТЕМА ПОДПИСОК И РЕАКТИВНОСТИ
    // ===========================================

    /**
     * 📻 Подписка на изменения в определенной части состояния
     */
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }
        
        this.subscribers.get(path).add(callback);

        // 🔄 Возвращаем функцию отписки
        return () => {
            const pathSubscribers = this.subscribers.get(path);
            if (pathSubscribers) {
                pathSubscribers.delete(callback);
                if (pathSubscribers.size === 0) {
                    this.subscribers.delete(path);
                }
            }
        };
    }

    /**
     * 📢 Уведомление подписчиков об изменениях
     */
    notify(path, newValue, oldValue) {
        // Уведомляем точные подписки
        if (this.subscribers.has(path)) {
            this.subscribers.get(path).forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error(`[State] Ошибка в подписчике ${path}:`, error);
                }
            });
        }

        // Уведомляем родительские пути
        const parts = path.split('.');
        for (let i = parts.length - 1; i > 0; i--) {
            const parentPath = parts.slice(0, i).join('.');
            if (this.subscribers.has(parentPath)) {
                const parentValue = this.get(parentPath);
                this.subscribers.get(parentPath).forEach(callback => {
                    try {
                        callback(parentValue, null, parentPath);
                    } catch (error) {
                        console.error(`[State] Ошибка в родительском подписчике ${parentPath}:`, error);
                    }
                });
            }
        }
    }

    // ===========================================
    // 📊 ОСНОВНЫЕ МЕТОДЫ РАБОТЫ С СОСТОЯНИЕМ
    // ===========================================

    /**
     * 📖 Получить значение по пути
     */
    get(path) {
        return this.getNestedValue(this.store, path);
    }

    /**
     * ✏️ Установить значение по пути
     */
    set(path, value) {
        const oldValue = this.get(path);
        this.setNestedValue(this.store, path, value);
        
        // 📢 Уведомляем подписчиков
        this.notify(path, value, oldValue);

        // 📝 Записываем в историю
        this.addToHistory('SET', path, value, oldValue);

        // 💾 Сохраняем состояние (для некоторых ключей)
        this.persistState(path);

        this.log(`📝 Set ${path}:`, value);
    }

    /**
     * 🔄 Обновить часть объекта
     */
    update(path, updates) {
        const currentValue = this.get(path) || {};
        const newValue = { ...currentValue, ...updates };
        this.set(path, newValue);
    }

    /**
     * ➕ Добавить элемент в массив
     */
    push(path, item) {
        const currentArray = this.get(path) || [];
        const newArray = [...currentArray, item];
        this.set(path, newArray);
    }

    /**
     * 🗑️ Удалить элемент из массива
     */
    remove(path, predicate) {
        const currentArray = this.get(path) || [];
        const newArray = currentArray.filter(item => !predicate(item));
        this.set(path, newArray);
    }

    /**
     * 🧹 Сбросить часть состояния
     */
    reset(path) {
        const defaultValue = this.getDefaultValue(path);
        this.set(path, defaultValue);
    }

    // ===========================================
    // 👤 УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЕМ
    // ===========================================

    /**
     * 🔑 Установить данные пользователя
     */
    setUser(userData) {
        this.update('user', {
            profile: userData,
            isAuthenticated: true
        });
    }

    /**
     * 📱 Установить Telegram данные
     */
    setTelegramData(telegramData) {
        this.set('user.telegramData', telegramData);
    }

    /**
 * 🚀 Инициализация пользователя из Telegram данных
 * @param {Object} telegramData - Данные от Telegram
 * @returns {boolean} - Успех инициализации
 */
initializeFromTelegram(telegramData) {
    if (!telegramData || !telegramData.id) {
        console.warn('⚠️ State: Нет данных пользователя от Telegram');
        return false;
    }

    const firstName = telegramData.first_name || '';
    const lastName = telegramData.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // 🔧 ИСПРАВЛЕНИЕ: СОХРАНЯЕМ telegramData В STATE!
    this.update('user', {
        profile: {
            id: telegramData.id,
            firstName: firstName,
            lastName: lastName,
            fullName: fullName,
            username: telegramData.username,
            language: telegramData.language_code || 'ru'
        },
        telegramData: telegramData,  // ← ВОТ ЭТО ДОБАВИТЬ!
        isAuthenticated: true
    });

    console.log('✅ State: Пользователь инициализирован с Telegram данными:', {
        id: telegramData.id,
        fullName: fullName,
        firstName: firstName,
        username: telegramData.username
    });

    return true;
}
        
    /**
 * 🆔 НОВОЕ: Получить ID текущего пользователя для API вызовов
 * @returns {number|null} - ID пользователя или null
 */
getCurrentUserId() {
    const profile = this.get('user.profile');
    const telegramData = this.get('user.telegramData');
    
    // 🔍 ПОКАЗЫВАЕМ ЧТО ВНУТРИ
    if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(
            `Profile: ${JSON.stringify(profile)}\n` +
            `TelegramData: ${JSON.stringify(telegramData)}`
        );
    }
    
    // Оригинальная логика
    return profile?.id || telegramData?.id || null;
}

    /**
     * 🚪 Выход пользователя
     */
    logout() {
        this.update('user', {
            profile: null,
            isAuthenticated: false,
            telegramData: null
        });
        
        // Очищаем чувствительные данные
        this.reset('quotes');
        this.reset('stats');
        this.reset('reports');
        this.reset('achievements');
    }

    /**
     * 👤 Получить текущего пользователя
     */
    getUser() {
        return this.get('user.profile');
    }

    /**
     * ✅ Проверить аутентификацию
     */
    isAuthenticated() {
        return this.get('user.isAuthenticated');
    }

    // ===========================================
    // 📝 УПРАВЛЕНИЕ ЦИТАТАМИ
    // ===========================================

    /**
     * 📝 Установить цитаты
     */
    setQuotes(quotes, total = null) {
        this.update('quotes', {
            items: quotes,
            total: total || quotes.length,
            lastUpdate: Date.now(),
            loading: false
        });
    }

    /**
     * ➕ Добавить новую цитату
     */
    addQuote(quote) {
        this.push('quotes.items', quote);
        this.update('quotes', {
            total: this.get('quotes.total') + 1,
            lastUpdate: Date.now()
        });
    }

    /**
     * ✏️ Обновить цитату
     */
    updateQuote(quoteId, updates) {
        const quotes = this.get('quotes.items');
        const updatedQuotes = quotes.map(quote => 
            quote.id === quoteId ? { ...quote, ...updates } : quote
        );
        this.set('quotes.items', updatedQuotes);
    }

    /**
     * 🗑️ Удалить цитату
     */
    removeQuote(quoteId) {
        this.remove('quotes.items', quote => quote.id === quoteId);
        this.update('quotes', {
            total: this.get('quotes.total') - 1,
            lastUpdate: Date.now()
        });
    }

    /**
     * 🕐 Установить последние цитаты
     */
    setRecentQuotes(quotes) {
        this.set('quotes.recent', quotes);
    }

    // ===========================================
    // 📊 УПРАВЛЕНИЕ СТАТИСТИКОЙ
    // ===========================================

    /**
     * 📈 Установить статистику
     */
    setStats(stats) {
        this.update('stats', {
            ...stats,
            loading: false
        });
    }

    /**
     * 🔄 Обновить статистику
     */
    updateStats(updates) {
        this.update('stats', updates);
    }

    // ===========================================
    // 📋 УПРАВЛЕНИЕ ОТЧЕТАМИ
    // ===========================================

    /**
     * 📅 Установить еженедельные отчеты
     */
    setWeeklyReports(reports) {
        this.set('reports.weekly', reports);
    }

    /**
     * 📊 Установить месячные отчеты
     */
    setMonthlyReports(reports) {
        this.set('reports.monthly', reports);
    }

    /**
     * 📈 Установить текущий отчет
     */
    setCurrentReport(report) {
        this.set('reports.current', report);
    }

    // ===========================================
    // 🎨 УПРАВЛЕНИЕ UI
    // ===========================================

    /**
     * 📱 Установить текущую страницу
     */
    setCurrentPage(page) {
        this.set('ui.currentPage', page);
    }

    /**
     * 🎨 Установить тему
     */
    setTheme(theme) {
        this.set('ui.theme', theme);
    }

    /**
     * 🔄 Установить состояние загрузки
     */
    setLoading(isLoading, path = 'ui') {
        this.set(`${path}.loading`, isLoading);
    }

    /**
     * 🔔 Показать навигацию
     */
    showBottomNav() {
        this.set('ui.bottomNavVisible', true);
    }

    /**
     * 🙈 Скрыть навигацию
     */
    hideBottomNav() {
        this.set('ui.bottomNavVisible', false);
    }

    /**
     * 📱 Показать модальное окно
     */
    showModal(modalType, modalData = {}) {
        this.update('ui', {
            activeModal: {
                type: modalType,
                data: modalData
            }
        });
    }

    /**
     * ❌ Закрыть модальное окно
     */
    closeModal() {
        this.set('ui.activeModal', null);
    }

    /**
     * 🔔 УЛУЧШЕНО: Добавить уведомление с улучшенной типизацией
     */
    addNotification(message, type = 'info', duration = 5000) {
        const notification = {
            id: Date.now(),
            message,
            type, // 'success', 'error', 'warning', 'info'
            timestamp: Date.now(),
            duration
        };
        this.push('ui.notifications', notification);

        // Автоматическое удаление уведомления
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, duration);
        }

        return notification.id;
    }

    /**
     * 🎯 НОВОЕ: Добавить уведомление об ошибке API
     */
    addApiErrorNotification(error, context = '') {
        const message = this.formatApiError(error, context);
        return this.addNotification(message, 'error', 8000);
    }

    /**
     * 🛠️ НОВОЕ: Форматировать ошибку API для пользователя
     */
    formatApiError(error, context = '') {
        let message = 'Произошла ошибка';
        
        if (context) {
            message = `Ошибка ${context}`;
        }

        if (error?.response?.data?.message) {
            message = error.response.data.message;
        } else if (error?.message) {
            if (error.message.includes('Network Error')) {
                message = 'Проблемы с подключением к интернету';
            } else if (error.message.includes('timeout')) {
                message = 'Превышено время ожидания';
            } else {
                message = error.message;
            }
        }

        return message;
    }

    /**
     * 🗑️ Удалить уведомление
     */
    removeNotification(notificationId) {
        this.remove('ui.notifications', notification => notification.id === notificationId);
    }

    // ===========================================
    // 🌐 УПРАВЛЕНИЕ СЕТЬЮ
    // ===========================================

    /**
     * 🌐 Установить состояние сети
     */
    setNetwork(networkState) {
        this.update('network', networkState);
    }

    /**
     * 🔄 Обновить время последней синхронизации
     */
    updateLastSync() {
        this.set('network.lastSync', Date.now());
    }

    // ===========================================
    // 🛠️ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ===========================================

    /**
     * 🔍 Получить вложенное значение
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * ✏️ Установить вложенное значение
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!(key in current)) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * 🎯 Получить значение по умолчанию
     */
    getDefaultValue(path) {
        const defaults = {
            'quotes.items': [],
            'quotes.loading': false,
            'stats.loading': false,
            'reports.loading': false,
            'ui.loading': false
        };
        return defaults[path] || null;
    }

    /**
     * 📝 Добавить запись в историю
     */
    addToHistory(action, path, newValue, oldValue) {
        if (!this.debug) return;

        this.history.push({
            timestamp: Date.now(),
            action,
            path,
            newValue,
            oldValue
        });

        // Ограничиваем размер истории
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * 💾 Сохранить состояние в localStorage
     */
    persistState(path) {
        const persistentPaths = ['user.profile', 'ui.theme'];
        
        if (persistentPaths.some(p => path.startsWith(p))) {
            try {
                const dataToSave = {};
                persistentPaths.forEach(p => {
                    const value = this.get(p);
                    if (value !== null) {
                        dataToSave[p] = value;
                    }
                });
                
                localStorage.setItem('reader-app-state', JSON.stringify(dataToSave));
            } catch (error) {
                console.warn('Не удалось сохранить состояние:', error);
            }
        }
    }

    /**
     * 📥 Загрузить сохраненное состояние
     */
    loadPersistedState() {
        try {
            const saved = localStorage.getItem('reader-app-state');
            if (saved) {
                const data = JSON.parse(saved);
                Object.entries(data).forEach(([path, value]) => {
                    this.setNestedValue(this.store, path, value);
                });
                this.log('💾 Состояние загружено из localStorage');
            }
        } catch (error) {
            console.warn('Не удалось загрузить состояние:', error);
        }
    }

    /**
     * 📊 Получить снапшот состояния
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.store));
    }

    /**
     * 🔍 Логирование (только в debug режиме)
     */
    log(message, data = null) {
        if (this.debug) {
            console.log(`[State] ${message}`, data || '');
        }
    }

    /**
     * 🕰️ Получить историю изменений
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * 🛡️ НОВОЕ: Валидация входных данных
     */
    validateInput(data, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
                errors.push(`${field} обязательно для заполнения`);
                continue;
            }
            
            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors.push(`${field} не может превышать ${rule.maxLength} символов`);
            }
            
            if (value && rule.minLength && value.length < rule.minLength) {
                errors.push(`${field} должно содержать минимум ${rule.minLength} символов`);
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors.push(`${field} имеет неверный формат`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 🧹 Очистить историю
     */
    clearHistory() {
        this.history = [];
    }
}

// 🌍 Создаем глобальный экземпляр состояния
const appState = new AppState();

// 🌍 Глобальный экспорт
window.AppState = AppState;
window.appState = appState;

// 📱 Экспорт для модульной системы
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppState;
}
