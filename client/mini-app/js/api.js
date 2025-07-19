/**
 * Читатель Mini App - API Integration
 * Интеграция с Reader Bot API
 */

class ApiManager {
    constructor() {
        this.baseUrl = this.getApiBaseUrl();
        this.authToken = null;
        this.isAuthenticated = false;
        
        console.log('🔗 API Manager инициализирован:', this.baseUrl);
    }
    
    /**
     * Определение базового URL API
     */
    getApiBaseUrl() {
        // В production будет домен приложения
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000/api/reader';
        }
        
        // Для Telegram Mini App используем относительный путь
        return '/api/reader';
    }
    
    /**
     * Аутентификация через Telegram
     */
    async authenticateWithTelegram(initData, user) {
        try {
            console.log('🔐 Аутентификация через Telegram...');
            
            const response = await this.request('/auth/telegram', {
                method: 'POST',
                body: {
                    initData: initData,
                    user: user
                }
            });
            
            if (response.success && response.token) {
                this.authToken = response.token;
                this.isAuthenticated = true;
                
                console.log('✅ Аутентификация успешна');
                
                // Сохраняем токен для последующих запросов
                this.saveAuthToken(response.token);
                
                return {
                    success: true,
                    user: response.user,
                    token: response.token
                };
            } else {
                throw new Error(response.message || 'Ошибка аутентификации');
            }
        } catch (error) {
            console.error('❌ Ошибка аутентификации:', error);
            
            // Fallback - создаем временную сессию
            return this.createTemporarySession(user);
        }
    }
    
    /**
     * Создание временной сессии для тестирования
     */
    createTemporarySession(user) {
        console.log('🔧 Создание временной сессии...');
        
        const tempToken = `temp_${user.id}_${Date.now()}`;
        this.authToken = tempToken;
        this.isAuthenticated = true;
        
        this.saveAuthToken(tempToken);
        
        return {
            success: true,
            user: user,
            token: tempToken,
            isTemporary: true
        };
    }
    
    /**
     * Сохранение токена аутентификации
     */
    saveAuthToken(token) {
        try {
            localStorage.setItem('reader_auth_token', token);
        } catch (error) {
            console.warn('Не удалось сохранить токен в localStorage:', error);
        }
    }
    
    /**
     * Загрузка сохраненного токена
     */
    loadAuthToken() {
        try {
            const token = localStorage.getItem('reader_auth_token');
            if (token) {
                this.authToken = token;
                this.isAuthenticated = true;
                return token;
            }
        } catch (error) {
            console.warn('Не удалось загрузить токен из localStorage:', error);
        }
        return null;
    }
    
    /**
     * Универсальный метод для API запросов
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        // Добавляем токен аутентификации если есть
        if (this.authToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        // Объединяем опции
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        // Добавляем body если есть
        if (options.body && finalOptions.method !== 'GET') {
            finalOptions.body = JSON.stringify(options.body);
        }
        
        try {
            console.log(`📡 API ${finalOptions.method} ${endpoint}`);
            
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            console.log(`✅ API ${finalOptions.method} ${endpoint} - успешно`);
            
            return data;
        } catch (error) {
            console.error(`❌ API ${finalOptions.method} ${endpoint} - ошибка:`, error);
            
            // Возвращаем mock данные в случае ошибки для тестирования
            return this.getMockResponse(endpoint, finalOptions.method);
        }
    }
    
    /**
     * Mock ответы для тестирования без backend
     */
    getMockResponse(endpoint, method) {
        console.log('🔧 Используем mock данные для:', endpoint);
        
        if (endpoint.includes('/auth/telegram')) {
            return {
                success: true,
                token: 'mock_token_' + Date.now(),
                user: {
                    id: 12345678,
                    telegramId: 12345678,
                    name: 'Тестовый пользователь',
                    username: 'test_user'
                }
            };
        }
        
        if (endpoint.includes('/quotes')) {
            if (method === 'GET') {
                return {
                    success: true,
                    data: [
                        {
                            id: 1,
                            text: 'Жизнь — это то, что с тобой происходит, пока ты строишь планы.',
                            author: 'Джон Леннон',
                            createdAt: new Date().toISOString(),
                            analysis: {
                                category: 'Философия жизни',
                                mood: 'Мудрость',
                                themes: ['планирование', 'жизнь', 'настоящее']
                            }
                        },
                        {
                            id: 2,
                            text: 'Единственное препятствие к познанию — это убеждение, что ты уже знаешь.',
                            author: 'Будда',
                            createdAt: new Date(Date.now() - 86400000).toISOString(),
                            analysis: {
                                category: 'Саморазвитие',
                                mood: 'Вдохновение',
                                themes: ['обучение', 'смирение', 'мудрость']
                            }
                        }
                    ],
                    pagination: {
                        page: 1,
                        limit: 10,
                        total: 2,
                        pages: 1
                    }
                };
            } else if (method === 'POST') {
                return {
                    success: true,
                    data: {
                        id: Date.now(),
                        text: 'Новая цитата',
                        author: 'Автор',
                        createdAt: new Date().toISOString(),
                        analysis: {
                            category: 'Пользовательская',
                            mood: 'Размышление',
                            themes: ['новое', 'творчество']
                        }
                    }
                };
            }
        }
        
        if (endpoint.includes('/stats')) {
            return {
                success: true,
                data: {
                    totalQuotes: 47,
                    weekQuotes: 5,
                    currentStreak: 3,
                    longestStreak: 12,
                    categories: {
                        'Саморазвитие': 15,
                        'Философия': 12,
                        'Любовь': 8,
                        'Мудрость': 7,
                        'Жизнь': 5
                    }
                }
            };
        }
        
        if (endpoint.includes('/reports')) {
            return {
                success: true,
                data: [
                    {
                        id: 1,
                        type: 'weekly',
                        weekStart: new Date(Date.now() - 7 * 86400000).toISOString(),
                        weekEnd: new Date().toISOString(),
                        quotesCount: 5,
                        analysis: 'На этой неделе ваши цитаты говорят о стремлении к внутренней гармонии...',
                        recommendations: [
                            {
                                title: 'Искусство любить',
                                author: 'Эрих Фромм',
                                reason: 'Подходит вашим размышлениям о отношениях'
                            }
                        ],
                        createdAt: new Date().toISOString()
                    }
                ]
            };
        }
        
        if (endpoint.includes('/achievements')) {
            return {
                success: true,
                data: [
                    {
                        id: 'first_quote',
                        title: 'Первая цитата',
                        description: 'Сохранили первую цитату',
                        icon: '🎯',
                        isUnlocked: true,
                        unlockedAt: new Date(Date.now() - 30 * 86400000).toISOString()
                    },
                    {
                        id: 'week_streak',
                        title: 'Неделя мудрости',
                        description: '7 дней подряд добавляете цитаты',
                        icon: '🔥',
                        isUnlocked: false,
                        progress: 3,
                        target: 7
                    }
                ]
            };
        }
        
        // Дефолтный ответ
        return {
            success: false,
            message: 'Mock endpoint не найден',
            data: null
        };
    }
    
    // === МЕТОДЫ ДЛЯ РАБОТЫ С ЦИТАТАМИ ===
    
    /**
     * Получить список цитат
     */
    async getQuotes(params = {}) {
        const query = new URLSearchParams(params).toString();
        const endpoint = `/quotes${query ? '?' + query : ''}`;
        return await this.request(endpoint);
    }
    
    /**
     * Добавить новую цитату
     */
    async addQuote(quoteData) {
        return await this.request('/quotes', {
            method: 'POST',
            body: quoteData
        });
    }
    
    /**
     * Получить анализ цитаты от AI
     */
    async analyzeQuote(text, author = '') {
        return await this.request('/quotes/analyze', {
            method: 'POST',
            body: { text, author }
        });
    }
    
    // === МЕТОДЫ ДЛЯ СТАТИСТИКИ ===
    
    /**
     * Получить статистику пользователя
     */
    async getStats() {
        return await this.request('/stats');
    }
    
    /**
     * Получить отчеты
     */
    async getReports(type = 'weekly') {
        return await this.request(`/reports?type=${type}`);
    }
    
    /**
     * Получить достижения
     */
    async getAchievements() {
        return await this.request('/achievements');
    }
    
    // === МЕТОДЫ ДЛЯ ПОЛЬЗОВАТЕЛЯ ===
    
    /**
     * Получить профиль пользователя
     */
    async getProfile() {
        return await this.request('/profile');
    }
    
    /**
     * Обновить профиль пользователя
     */
    async updateProfile(profileData) {
        return await this.request('/profile', {
            method: 'PUT',
            body: profileData
        });
    }
    
    // === МЕТОДЫ ДЛЯ НАСТРОЕК ===
    
    /**
     * Получить настройки пользователя
     */
    async getSettings() {
        return await this.request('/settings');
    }
    
    /**
     * Обновить настройки
     */
    async updateSettings(settings) {
        return await this.request('/settings', {
            method: 'PUT',
            body: settings
        });
    }
    
    // === УТИЛИТЫ ===
    
    /**
     * Проверка состояния API
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Выход из системы
     */
    logout() {
        this.authToken = null;
        this.isAuthenticated = false;
        
        try {
            localStorage.removeItem('reader_auth_token');
        } catch (error) {
            console.warn('Не удалось удалить токен из localStorage:', error);
        }
        
        console.log('👋 Выход из системы');
    }
    
    /**
     * Проверка авторизации
     */
    isAuth() {
        return this.isAuthenticated && this.authToken;
    }
}

// Создаем глобальный экземпляр
window.apiManager = new ApiManager();

// Экспортируем для ES6 модулей
export default window.apiManager;