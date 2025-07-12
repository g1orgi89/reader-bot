/**
 * Модуль аутентификации для админ-панели "Читатель"
 * 🔧 ИСПРАВЛЕНО: Используем правильные учетные данные для авторизации на сервере
 */

/**
 * Конфигурация аутентификации
 */
const AUTH_CONFIG = {
    // Учетные данные - ДОЛЖНЫ СОВПАДАТЬ с серверной конфигурацией
    SERVER_CREDENTIALS: {
        // Эти значения должны совпадать с process.env.ADMIN_USERNAME и ADMIN_PASSWORD
        username: 'admin',      // или process.env.ADMIN_USERNAME
        password: 'password123', // или process.env.ADMIN_PASSWORD
        token: 'default-admin-token' // или process.env.ADMIN_TOKEN
    },
    
    // Демо-логин для фронтенда (пользователь вводит эти данные)
    DEMO_CREDENTIALS: {
        username: 'anna',
        password: 'reader2025'
    },
    
    // Ключи для localStorage
    STORAGE_KEYS: {
        TOKEN: 'adminToken',
        USER: 'reader_admin_user',
        EXPIRES: 'reader_admin_expires',
        AUTH_METHOD: 'reader_auth_method' // bearer или basic
    },
    
    // Время жизни сессии (24 часа)
    SESSION_DURATION: 24 * 60 * 60 * 1000,
    
    // Страницы, не требующие аутентификации
    PUBLIC_PAGES: ['login.html']
};

/**
 * Класс для управления аутентификацией
 */
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.authMethod = 'bearer'; // 'bearer' или 'basic'
        this.init();
    }

    /**
     * Инициализация менеджера аутентификации
     */
    init() {
        // Проверяем текущую страницу
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Если это публичная страница, не проверяем аутентификацию
        if (AUTH_CONFIG.PUBLIC_PAGES.includes(currentPage)) {
            return;
        }

        // Проверяем сохраненную сессию
        this.checkSavedSession();
        
        // Если не авторизован, перенаправляем на логин
        if (!this.isAuthenticated()) {
            this.redirectToLogin();
            return;
        }

        // Настраиваем UI для авторизованного пользователя
        this.setupAuthenticatedUI();
    }

    /**
     * Проверка сохраненной сессии
     */
    checkSavedSession() {
        try {
            const token = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN);
            const user = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER);
            const expires = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.EXPIRES);
            const authMethod = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_METHOD) || 'bearer';

            if (token && user && expires) {
                const expirationTime = parseInt(expires, 10);
                
                // Проверяем, не истекла ли сессия
                if (Date.now() < expirationTime) {
                    this.token = token;
                    this.currentUser = JSON.parse(user);
                    this.authMethod = authMethod;
                    console.log('📖 Сессия восстановлена:', this.currentUser.username);
                    return true;
                } else {
                    console.log('📖 Сессия истекла');
                    this.clearSession();
                }
            }
        } catch (error) {
            console.error('📖 Ошибка проверки сессии:', error);
            this.clearSession();
        }
        
        return false;
    }

    /**
     * Аутентификация пользователя
     */
    async login(username, password) {
        try {
            console.log('📖 Попытка входа:', username);
            
            // Демо-проверка (в реальном приложении - запрос к серверу)
            if (this.validateDemoCredentials(username, password)) {
                // Создаем пользователя
                const user = {
                    username: username,
                    displayName: 'Анна Бусел',
                    role: 'admin',
                    permissions: ['read', 'write', 'admin']
                };
                
                // 🔧 ИСПРАВЛЕНО: Используем правильную аутентификацию
                // Вариант 1: Bearer token (рекомендуется)
                const authMethod = 'bearer';
                const token = AUTH_CONFIG.SERVER_CREDENTIALS.token;
                
                // Вариант 2: Basic auth (альтернатива)
                // const authMethod = 'basic';
                // const token = btoa(`${AUTH_CONFIG.SERVER_CREDENTIALS.username}:${AUTH_CONFIG.SERVER_CREDENTIALS.password}`);
                
                const expires = Date.now() + AUTH_CONFIG.SESSION_DURATION;
                
                // Сохраняем сессию
                this.saveSession(token, user, expires, authMethod);
                
                console.log('📖 Успешная авторизация:', user.displayName);
                return { success: true, user };
            } else {
                console.log('📖 Неверные учетные данные');
                return { success: false, error: 'Неверное имя пользователя или пароль' };
            }
        } catch (error) {
            console.error('📖 Ошибка авторизации:', error);
            return { success: false, error: 'Ошибка авторизации' };
        }
    }

    /**
     * Выход из системы
     */
    logout() {
        console.log('📖 Выход из системы');
        this.clearSession();
        this.redirectToLogin();
    }

    /**
     * Проверка авторизации
     */
    isAuthenticated() {
        return this.token !== null && this.currentUser !== null;
    }

    /**
     * Получение текущего пользователя
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Получение токена
     */
    getToken() {
        return this.token;
    }

    /**
     * Валидация демо-учетных данных
     */
    validateDemoCredentials(username, password) {
        return username === AUTH_CONFIG.DEMO_CREDENTIALS.username && 
               password === AUTH_CONFIG.DEMO_CREDENTIALS.password;
    }

    /**
     * Сохранение сессии
     */
    saveSession(token, user, expires, authMethod = 'bearer') {
        try {
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN, token);
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.EXPIRES, expires.toString());
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_METHOD, authMethod);
            
            this.token = token;
            this.currentUser = user;
            this.authMethod = authMethod;
        } catch (error) {
            console.error('📖 Ошибка сохранения сессии:', error);
        }
    }

    /**
     * Очистка сессии
     */
    clearSession() {
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER);
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.EXPIRES);
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_METHOD);
        
        this.token = null;
        this.currentUser = null;
        this.authMethod = 'bearer';
    }

    /**
     * Перенаправление на страницу входа
     */
    redirectToLogin() {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage !== 'login.html') {
            window.location.href = 'login.html';
        }
    }

    /**
     * Настройка UI для авторизованного пользователя
     */
    setupAuthenticatedUI() {
        // Обновляем имя пользователя в заголовке
        const usernameElement = document.getElementById('admin-username');
        if (usernameElement && this.currentUser) {
            usernameElement.textContent = this.currentUser.displayName;
        }

        // Настраиваем кнопку выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    /**
     * Получение заголовков для API запросов
     * 🔧 ИСПРАВЛЕНО: Используем правильный формат Authorization header
     */
    getApiHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            if (this.authMethod === 'bearer') {
                // Bearer token аутентификация
                headers['Authorization'] = `Bearer ${this.token}`;
            } else if (this.authMethod === 'basic') {
                // Basic аутентификация
                headers['Authorization'] = `Basic ${this.token}`;
            }
        }
        
        return headers;
    }

    /**
     * Обертка для fetch с автоматической авторизацией
     */
    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            headers: this.getApiHeaders(),
            ...options
        };

        try {
            console.log('📖 API запрос:', url, 'с заголовками:', defaultOptions.headers);
            
            const response = await fetch(url, defaultOptions);
            
            // Если получили 401, значит токен истек
            if (response.status === 401) {
                console.log('📖 Получен 401, токен истек или неверный, требуется повторная авторизация');
                this.clearSession();
                this.redirectToLogin();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('📖 Ошибка API запроса:', error);
            throw error;
        }
    }

    /**
     * Тестирование соединения с сервером
     */
    async testConnection() {
        try {
            console.log('📖 Тестирование соединения с сервером...');
            const response = await this.authenticatedFetch('/api/reader/health');
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('📖 Соединение с сервером успешно:', data);
                return true;
            } else {
                console.log('📖 Сервер недоступен:', response ? response.status : 'no response');
                return false;
            }
        } catch (error) {
            console.error('📖 Ошибка соединения с сервером:', error);
            return false;
        }
    }
}

// Создаем глобальный экземпляр менеджера аутентификации
const authManager = new AuthManager();

// Глобальные функции для использования в других скриптах
window.authManager = authManager;

/**
 * Глобальная функция для проверки статуса авторизации
 */
function checkAuthStatus() {
    return authManager.isAuthenticated();
}

/**
 * Глобальная функция для получения текущего пользователя
 */
function getCurrentUser() {
    return authManager.getCurrentUser();
}

/**
 * Глобальная функция для выхода
 */
function logout() {
    authManager.logout();
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, authManager };
}