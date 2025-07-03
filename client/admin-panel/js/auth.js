/**
 * Модуль аутентификации для админ-панели "Читатель"
 * Упрощенная аутентификация для демонстрации
 */

/**
 * Конфигурация аутентификации
 */
const AUTH_CONFIG = {
    // Демо-логин для тестирования
    DEMO_CREDENTIALS: {
        username: 'anna',
        password: 'reader2025'
    },
    
    // Ключи для localStorage
    STORAGE_KEYS: {
        TOKEN: 'reader_admin_token',
        USER: 'reader_admin_user',
        EXPIRES: 'reader_admin_expires'
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

            if (token && user && expires) {
                const expirationTime = parseInt(expires, 10);
                
                // Проверяем, не истекла ли сессия
                if (Date.now() < expirationTime) {
                    this.token = token;
                    this.currentUser = JSON.parse(user);
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
                // Создаем пользователя и токен
                const user = {
                    username: username,
                    displayName: 'Анна Бусел',
                    role: 'admin',
                    permissions: ['read', 'write', 'admin']
                };
                
                const token = this.generateToken(user);
                const expires = Date.now() + AUTH_CONFIG.SESSION_DURATION;
                
                // Сохраняем сессию
                this.saveSession(token, user, expires);
                
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
     * Генерация токена (демо-реализация)
     */
    generateToken(user) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2);
        return `reader_${timestamp}_${randomStr}`;
    }

    /**
     * Сохранение сессии
     */
    saveSession(token, user, expires) {
        try {
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN, token);
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.EXPIRES, expires.toString());
            
            this.token = token;
            this.currentUser = user;
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
        
        this.token = null;
        this.currentUser = null;
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
     */
    getApiHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
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
            const response = await fetch(url, defaultOptions);
            
            // Если получили 401, значит токен истек
            if (response.status === 401) {
                console.log('📖 Токен истек, требуется повторная авторизация');
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