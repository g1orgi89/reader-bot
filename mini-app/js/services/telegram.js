/**
 * 📱 TELEGRAM WEB APP ИНТЕГРАЦИЯ
 * 
 * Управляет интеграцией с Telegram Web App SDK
 * Обрабатывает темы, haptic feedback, кнопки, пользовательские данные
 * 
 * @filesize 5 KB - Telegram SDK, haptic
 * @author Claude Assistant
 * @version 1.0.0
 */

/**
 * @typedef {Object} TelegramUser
 * @property {number} id - Telegram ID пользователя
 * @property {string} first_name - Имя пользователя
 * @property {string} last_name - Фамилия пользователя
 * @property {string} username - Username пользователя
 * @property {string} language_code - Код языка пользователя
 */

/**
 * @typedef {Object} TelegramTheme
 * @property {string} bg_color - Цвет фона
 * @property {string} text_color - Цвет текста
 * @property {string} hint_color - Цвет подсказок
 * @property {string} link_color - Цвет ссылок
 * @property {string} button_color - Цвет кнопок
 * @property {string} button_text_color - Цвет текста кнопок
 */

/**
 * 📱 Класс для интеграции с Telegram Web App
 * Предоставляет API для работы с возможностями Telegram Mini App
 */
class TelegramService {
    /**
     * @type {Object} - Экземпляр Telegram Web App
     */
    webApp = null;

    /**
     * @type {TelegramUser|null} - Данные пользователя Telegram
     */
    user = null;

    /**
     * @type {string} - Исходные данные инициализации
     */
    initData = '';

    /**
     * @type {TelegramTheme} - Параметры темы Telegram
     */
    themeParams = {};

    /**
     * @type {boolean} - Доступен ли Telegram Web App
     */
    isAvailable = false;

    /**
     * @type {boolean} - Инициализирован ли сервис
     */
    isInitialized = false;

    /**
     * @type {Array<Function>} - Обработчики событий закрытия
     */
    closeCallbacks = [];

    /**
     * 🏗️ Конструктор Telegram сервиса
     */
    constructor() {
        console.log('📱 TelegramService: Инициализация начата');
        
        // Проверяем доступность Telegram Web App
        this.isAvailable = !!(window.Telegram && window.Telegram.WebApp);
        
        if (this.isAvailable) {
            this.webApp = window.Telegram.WebApp;
            console.log('✅ TelegramService: Telegram Web App доступен');
        } else {
            console.warn('⚠️ TelegramService: Telegram Web App недоступен');
        }
    }

    /**
     * 🚀 Инициализация Telegram сервиса
     */
    async init() {
        if (!this.isAvailable) {
            console.warn('⚠️ TelegramService: Пропуск инициализации - Telegram недоступен');
            return;
        }

        try {
            console.log('🔄 TelegramService: Начало инициализации');
            
            // Получаем данные пользователя
            this.user = this.webApp.initDataUnsafe?.user || null;
            this.initData = this.webApp.initData || '';
            
            // Получаем параметры темы
            this.themeParams = this.webApp.themeParams || {};
            
            // Настраиваем интерфейс
            this.setupInterface();
            
            // Настраиваем обработчики событий
            this.setupEventHandlers();
            
            // Применяем тему
            this.applyTheme();
            
            this.isInitialized = true;
            console.log('✅ TelegramService: Инициализация завершена');
            
        } catch (error) {
            console.error('❌ TelegramService: Ошибка инициализации:', error);
            throw error;
        }
    }

    /**
     * 🎨 Настройка интерфейса Telegram
     */
    setupInterface() {
        console.log('🎨 TelegramService: Настройка интерфейса');
        
        // Разворачиваем приложение на весь экран
        this.webApp.expand();
        
        // Включаем вертикальные свайпы
        this.webApp.enableClosingConfirmation();
        
        // Устанавливаем цвет заголовка
        this.webApp.setHeaderColor('bg_color');
        
        // Настраиваем основную кнопку (скрываем по умолчанию)
        this.webApp.MainButton.hide();
        
        // Настраиваем кнопку "Назад" (скрываем по умолчанию)
        this.webApp.BackButton.hide();
        
        console.log('✅ TelegramService: Интерфейс настроен');
    }

    /**
     * 📡 Настройка обработчиков событий Telegram
     */
    setupEventHandlers() {
        console.log('📡 TelegramService: Настройка обработчиков событий');
        
        // Обработка изменения темы
        this.webApp.onEvent('themeChanged', () => {
            console.log('🎨 TelegramService: Тема изменена');
            this.themeParams = this.webApp.themeParams || {};
            this.applyTheme();
        });

        // Обработка изменения viewport
        this.webApp.onEvent('viewportChanged', (event) => {
            console.log('📐 TelegramService: Viewport изменен:', event);
            this.handleViewportChange(event);
        });

        // Обработка основной кнопки
        this.webApp.onEvent('mainButtonClicked', () => {
            console.log('🔘 TelegramService: Основная кнопка нажата');
            this.handleMainButtonClick();
        });

        // Обработка кнопки "Назад"
        this.webApp.onEvent('backButtonClicked', () => {
            console.log('⬅️ TelegramService: Кнопка "Назад" нажата');
            this.handleBackButtonClick();
        });

        console.log('✅ TelegramService: Обработчики событий настроены');
    }

    /**
     * 🎨 Применение темы Telegram к приложению
     */
    applyTheme() {
        if (!this.isAvailable) return;
        
        console.log('🎨 TelegramService: Применение темы');
        
        const root = document.documentElement;
        
        // Применяем цвета темы через CSS переменные
        if (this.themeParams.bg_color) {
            root.style.setProperty('--tg-theme-bg-color', this.themeParams.bg_color);
        }
        if (this.themeParams.text_color) {
            root.style.setProperty('--tg-theme-text-color', this.themeParams.text_color);
        }
        if (this.themeParams.hint_color) {
            root.style.setProperty('--tg-theme-hint-color', this.themeParams.hint_color);
        }
        if (this.themeParams.link_color) {
            root.style.setProperty('--tg-theme-link-color', this.themeParams.link_color);
        }
        if (this.themeParams.button_color) {
            root.style.setProperty('--tg-theme-button-color', this.themeParams.button_color);
        }
        if (this.themeParams.button_text_color) {
            root.style.setProperty('--tg-theme-button-text-color', this.themeParams.button_text_color);
        }

        // Устанавливаем атрибут темы для CSS селекторов
        document.body.setAttribute('data-theme', 'telegram');
        
        console.log('✅ TelegramService: Тема применена');
    }

    /**
     * 🔘 Управление основной кнопкой
     * @param {string} text - Текст кнопки
     * @param {Function} callback - Обработчик нажатия
     * @param {Object} options - Дополнительные опции
     */
    showMainButton(text, callback, options = {}) {
        if (!this.isAvailable) return;
        
        console.log(`🔘 TelegramService: Показ основной кнопки "${text}"`);
        
        const button = this.webApp.MainButton;
        
        // Устанавливаем текст
        button.setText(text);
        
        // Устанавливаем цвет (если указан)
        if (options.color) {
            button.setParams({ color: options.color });
        }
        
        // Устанавливаем состояние загрузки
        if (options.loading) {
            button.showProgress();
        } else {
            button.hideProgress();
        }
        
        // Включаем/отключаем кнопку
        if (options.disabled) {
            button.disable();
        } else {
            button.enable();
        }
        
        // Сохраняем обработчик
        this.mainButtonCallback = callback;
        
        // Показываем кнопку
        button.show();
    }

    /**
     * 🚫 Скрытие основной кнопки
     */
    hideMainButton() {
        if (!this.isAvailable) return;
        
        console.log('🚫 TelegramService: Скрытие основной кнопки');
        this.webApp.MainButton.hide();
        this.mainButtonCallback = null;
    }

    /**
     * ⬅️ Управление кнопкой "Назад"
     * @param {Function} callback - Обработчик нажатия
     */
    showBackButton(callback) {
        if (!this.isAvailable) return;
        
        console.log('⬅️ TelegramService: Показ кнопки "Назад"');
        this.backButtonCallback = callback;
        this.webApp.BackButton.show();
    }

    /**
     * 🚫 Скрытие кнопки "Назад"
     */
    hideBackButton() {
        if (!this.isAvailable) return;
        
        console.log('🚫 TelegramService: Скрытие кнопки "Назад"');
        this.webApp.BackButton.hide();
        this.backButtonCallback = null;
    }

    /**
     * 📳 Haptic Feedback - вибрация
     * @param {string} type - Тип вибрации: 'light', 'medium', 'heavy'
     */
    hapticFeedback(type = 'light') {
        if (!this.isAvailable || !this.webApp.HapticFeedback) return;
        
        try {
            switch (type) {
                case 'light':
                case 'medium':
                case 'heavy':
                    this.webApp.HapticFeedback.impactOccurred(type);
                    break;
                case 'error':
                    this.webApp.HapticFeedback.notificationOccurred('error');
                    break;
                case 'success':
                    this.webApp.HapticFeedback.notificationOccurred('success');
                    break;
                case 'warning':
                    this.webApp.HapticFeedback.notificationOccurred('warning');
                    break;
                default:
                    this.webApp.HapticFeedback.impactOccurred('light');
            }
        } catch (error) {
            console.warn('⚠️ TelegramService: Ошибка haptic feedback:', error);
        }
    }

    /**
     * 🔔 Показ всплывающего уведомления
     * @param {string} message - Текст уведомления
     */
    showAlert(message) {
        if (!this.isAvailable) {
            alert(message); // Fallback для браузера
            return;
        }
        
        this.webApp.showAlert(message);
    }

    /**
     * ❓ Показ диалога подтверждения
     * @param {string} message - Текст вопроса
     * @param {Function} callback - Обработчик ответа (true/false)
     */
    showConfirm(message, callback) {
        if (!this.isAvailable) {
            callback(confirm(message)); // Fallback для браузера
            return;
        }
        
        this.webApp.showConfirm(message, callback);
    }

    /**
     * 🌐 Открытие внешней ссылки
     * @param {string} url - URL для открытия
     * @param {Object} options - Опции открытия
     */
    openLink(url, options = {}) {
        if (!this.isAvailable) {
            window.open(url, '_blank');
            return;
        }
        
        if (options.tryInstantView) {
            this.webApp.openTelegramLink(url);
        } else {
            this.webApp.openLink(url);
        }
    }

    /**
     * 📋 Копирование в буфер обмена
     * @param {string} text - Текст для копирования
     * @param {Function} callback - Обработчик результата
     */
    copyToClipboard(text, callback) {
        if (!this.isAvailable || !this.webApp.writeAccessRequest) {
            // Fallback для браузера
            navigator.clipboard.writeText(text).then(() => {
                callback(true);
            }).catch(() => {
                callback(false);
            });
            return;
        }
        
        this.webApp.writeAccessRequest(text, callback);
    }

    /**
     * 📱 Разворачивание приложения
     */
    expand() {
        if (!this.isAvailable) return;
        this.webApp.expand();
    }

    /**
     * ✅ Уведомление о готовности приложения
     */
    ready() {
        if (!this.isAvailable) return;
        this.webApp.ready();
    }

    /**
     * 🚪 Закрытие приложения
     */
    close() {
        if (!this.isAvailable) return;
        this.webApp.close();
    }

    /**
     * 📡 Регистрация обработчика закрытия
     * @param {Function} callback - Обработчик закрытия
     */
    onClose(callback) {
        this.closeCallbacks.push(callback);
    }

    /**
     * 👤 Получение данных пользователя
     * @returns {TelegramUser|null} - Данные пользователя
     */
    getUser() {
        // Если Telegram недоступен, создаем реалистичного debug пользователя
        if (!this.isAvailable || !this.user) {
            console.log('🧪 TelegramService: Возвращаем debug пользователя');
            return {
                id: 12345,
                first_name: 'Тестер',
                last_name: 'Debug',
                username: 'debug_user',
                language_code: 'ru',
                is_premium: false,
                is_debug: true
            };
        }
        
        return this.user;
    }

    /**
     * 📊 Получение исходных данных инициализации
     * @returns {string} - Строка initData
     */
    getInitData() {
        return this.initData;
    }

    /**
     * 🎨 Получение параметров темы
     * @returns {TelegramTheme} - Параметры темы
     */
    getThemeParams() {
        return this.themeParams;
    }

    /**
     * 📐 Получение размеров viewport
     * @returns {Object} - Объект с размерами
     */
    getViewport() {
        if (!this.isAvailable) {
            return {
                width: window.innerWidth,
                height: window.innerHeight,
                isExpanded: true
            };
        }
        
        return {
            width: this.webApp.viewportWidth,
            height: this.webApp.viewportHeight,
            isExpanded: this.webApp.isExpanded
        };
    }

    /**
     * 🔧 Проверка доступности функций
     * @param {string} feature - Название функции
     * @returns {boolean} - Доступна ли функция
     */
    isFeatureAvailable(feature) {
        if (!this.isAvailable) return false;
        
        switch (feature) {
            case 'hapticFeedback':
                return !!this.webApp.HapticFeedback;
            case 'writeAccess':
                return !!this.webApp.writeAccessRequest;
            case 'mainButton':
                return !!this.webApp.MainButton;
            case 'backButton':
                return !!this.webApp.BackButton;
            default:
                return false;
        }
    }

    /**
     * 🔘 Обработчик нажатия основной кнопки
     */
    handleMainButtonClick() {
        if (this.mainButtonCallback) {
            this.mainButtonCallback();
        }
    }

    /**
     * ⬅️ Обработчик нажатия кнопки "Назад"
     */
    handleBackButtonClick() {
        if (this.backButtonCallback) {
            this.backButtonCallback();
        }
    }

    /**
     * 📐 Обработчик изменения viewport
     * @param {Object} event - Событие изменения viewport
     */
    handleViewportChange(event) {
        // Обновляем CSS переменные для viewport
        const root = document.documentElement;
        root.style.setProperty('--tg-viewport-height', `${event.height}px`);
        root.style.setProperty('--tg-viewport-stable-height', `${event.stableHeight}px`);
        
        // Уведомляем приложение об изменении
        window.dispatchEvent(new CustomEvent('telegram-viewport-changed', {
            detail: event
        }));
    }

    /**
     * 📊 Получение статистики использования
     * @returns {Object} - Объект со статистикой
     */
    getUsageStats() {
        return {
            isAvailable: this.isAvailable,
            isInitialized: this.isInitialized,
            hasUser: !!this.user,
            hasTheme: Object.keys(this.themeParams).length > 0,
            viewport: this.getViewport(),
            features: {
                hapticFeedback: this.isFeatureAvailable('hapticFeedback'),
                writeAccess: this.isFeatureAvailable('writeAccess'),
                mainButton: this.isFeatureAvailable('mainButton'),
                backButton: this.isFeatureAvailable('backButton')
            }
        };
    }

    /**
     * 🧹 Очистка ресурсов сервиса
     */
    destroy() {
        console.log('🧹 TelegramService: Очистка ресурсов');
        
        // Вызываем обработчики закрытия
        this.closeCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('❌ TelegramService: Ошибка в обработчике закрытия:', error);
            }
        });
        
        // Скрываем кнопки
        this.hideMainButton();
        this.hideBackButton();
        
        // Очищаем данные
        this.closeCallbacks = [];
        this.mainButtonCallback = null;
        this.backButtonCallback = null;
        this.isInitialized = false;
        
        console.log('✅ TelegramService: Очистка завершена');
    }
}

// Экспорт для использования в других модулях
window.TelegramService = TelegramService;