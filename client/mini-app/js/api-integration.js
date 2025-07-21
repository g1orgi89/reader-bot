/**
 * API INTEGRATION LAYER - Адаптер между ApiManager и ReaderApp
 * 
 * ЦЕЛЬ: Обеспечить совместимость между api.js (ApiManager) и app.js (ReaderApp)
 * РЕШАЕТ: Несоответствия в названиях методов и структуре данных
 * 
 * @version 1.0
 * @author Reader Bot Integration Team
 */

class ReaderAPI {
    constructor() {
        // Подключаем к глобальному ApiManager
        this.apiManager = window.apiManager;
        this.isReady = false;
        
        if (!this.apiManager) {
            console.error('❌ ApiManager не найден! Убедитесь, что api.js загружен');
            throw new Error('ApiManager не инициализирован');
        }
        
        console.log('🔗 ReaderAPI Integration Layer инициализирован');
        this.isReady = true;
    }
    
    /**
     * АУТЕНТИФИКАЦИЯ
     */
    async authenticateWithTelegram(initData, user) {
        return await this.apiManager.authenticateWithTelegram(initData, user);
    }
    
    isAuthenticated() {
        return this.apiManager.isAuth();
    }
    
    /**
     * СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ
     * Адаптер: app.js вызывает getUserStats(), но в api.js это getStats()
     */
    async getUserStats() {
        const response = await this.apiManager.getStats();
        
        if (response.success && response.data) {
            return response.data;
        }
        
        // Возвращаем совместимую структуру
        return {
            totalQuotes: 0,
            weekQuotes: 0,
            streakDays: 0,
            longestStreak: 0,
            categories: {}
        };
    }
    
    /**
     * РАБОТА С ЦИТАТАМИ
     */
    
    /**
     * Получить недавние цитаты
     * Адаптер: создаем метод getRecentQuotes из getQuotes
     */
    async getRecentQuotes(limit = 3) {
        const response = await this.apiManager.getQuotes({ 
            limit: limit, 
            sort: 'createdAt',
            order: 'desc' 
        });
        
        if (response.success && response.data) {
            return Array.isArray(response.data) ? response.data : response.data.quotes || [];
        }
        
        return [];
    }
    
    /**
     * Получить все цитаты пользователя
     */
    async getAllQuotes() {
        const response = await this.apiManager.getQuotes();
        
        if (response.success && response.data) {
            return Array.isArray(response.data) ? response.data : response.data.quotes || [];
        }
        
        return [];
    }
    
    /**
     * Сохранить цитату с AI анализом
     */
    async saveQuote(quoteData) {
        try {
            // Сначала получаем AI анализ
            const analysisResponse = await this.apiManager.analyzeQuote(
                quoteData.text, 
                quoteData.author || ''
            );
            
            let aiAnalysis = null;
            if (analysisResponse.success && analysisResponse.data) {
                aiAnalysis = analysisResponse.data;
            }
            
            // Затем сохраняем цитату
            const saveResponse = await this.apiManager.addQuote({
                ...quoteData,
                analysis: aiAnalysis
            });
            
            if (saveResponse.success && saveResponse.data) {
                return {
                    success: true,
                    quote: saveResponse.data,
                    aiAnalysis: this.formatAIAnalysis(aiAnalysis)
                };
            }
            
            throw new Error(saveResponse.message || 'Ошибка сохранения');
            
        } catch (error) {
            console.error('❌ Ошибка сохранения цитаты:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Форматирование AI анализа для UI
     */
    formatAIAnalysis(analysis) {
        if (!analysis) {
            return 'Цитата сохранена! Анализ будет доступен позже.';
        }
        
        const { mood, category, aiComment, bookRecommendation } = analysis;
        
        let formatted = `✨ ${mood} • ${category}\n\n${aiComment}`;
        
        if (bookRecommendation) {
            formatted += `\n\n📚 Рекомендация от Анны:\n"${bookRecommendation.title}" - ${bookRecommendation.reason}`;
        }
        
        return formatted;
    }
    
    /**
     * КАТАЛОГ КНИГ
     */
    
    /**
     * Получить каталог книг
     */
    async getBookCatalog() {
        const response = await this.apiManager.getCatalog();
        
        if (response.success && response.data) {
            // Адаптируем структуру данных для UI
            if (response.data.books) {
                return response.data.books.map(book => ({
                    ...book,
                    // Добавляем ссылку с UTM метками
                    link: `https://annabusel.org/books/${book.id}${book.utm || ''}`,
                    // Форматируем цену
                    price: this.formatPrice(book.price, book.discountedPrice)
                }));
            }
        }
        
        return [];
    }
    
    /**
     * Получить персональные рекомендации
     */
    async getPersonalizedBooks() {
        const response = await this.apiManager.getPersonalizedBooks();
        
        if (response.success && response.data) {
            return response.data;
        }
        
        return [];
    }
    
    /**
     * ОТЧЕТЫ
     */
    
    /**
     * Получить отчеты пользователя
     */
    async getReports(type = 'weekly') {
        const response = await this.apiManager.getReports(type);
        
        if (response.success && response.data) {
            return response.data;
        }
        
        return [];
    }
    
    /**
     * ДОСТИЖЕНИЯ
     */
    async getAchievements() {
        const response = await this.apiManager.getAchievements();
        
        if (response.success && response.data) {
            return response.data;
        }
        
        return [];
    }
    
    /**
     * ПРОМОКОДЫ
     */
    async getPromoCodes() {
        const response = await this.apiManager.getPromoCodes();
        
        if (response.success && response.data) {
            return response.data;
        }
        
        return [];
    }
    
    /**
     * ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
     */
    
    async getProfile() {
        const response = await this.apiManager.getProfile();
        
        if (response.success && response.data) {
            return response.data;
        }
        
        return null;
    }
    
    async updateProfile(profileData) {
        return await this.apiManager.updateProfile(profileData);
    }
    
    /**
     * НАСТРОЙКИ
     */
    
    async getSettings() {
        const response = await this.apiManager.getSettings();
        
        if (response.success && response.data) {
            return response.data;
        }
        
        return {
            notifications: true,
            reminderTimes: ['09:00', '19:00'],
            theme: 'auto'
        };
    }
    
    async updateSettings(settings) {
        return await this.apiManager.updateSettings(settings);
    }
    
    /**
     * АНАЛИТИКА
     */
    
    async trackEvent(eventType, eventData) {
        return await this.apiManager.trackEvent(eventType, eventData);
    }
    
    /**
     * УТИЛИТЫ
     */
    
    /**
     * Форматирование цены
     */
    formatPrice(price, discountedPrice) {
        if (!price) return 'Уточняется';
        
        if (discountedPrice && discountedPrice < price) {
            return `${discountedPrice}₽ ~${price}₽~`;
        }
        
        return `${price}₽`;
    }
    
    /**
     * Проверка здоровья API
     */
    async healthCheck() {
        return await this.apiManager.healthCheck();
    }
    
    /**
     * REAL-TIME МЕТОДЫ для интерактивности
     */
    
    /**
     * Получить AI анализ цитаты в реальном времени
     * Для использования при вводе текста
     */
    async getLiveAnalysis(text, author = '') {
        if (!text || text.length < 10) {
            return null;
        }
        
        try {
            const response = await this.apiManager.analyzeQuote(text, author);
            
            if (response.success && response.data) {
                return {
                    preview: true,
                    mood: response.data.mood,
                    category: response.data.category,
                    hint: this.generatePreviewHint(response.data)
                };
            }
        } catch (error) {
            console.warn('Live analysis failed:', error);
        }
        
        return null;
    }
    
    /**
     * Генерация подсказки для превью
     */
    generatePreviewHint(analysis) {
        const { mood, category } = analysis;
        
        const hints = [
            `Настроение: ${mood}`,
            `Категория: ${category}`,
            'Получите полный анализ после сохранения!'
        ];
        
        return hints[Math.floor(Math.random() * hints.length)];
    }
    
    /**
     * Поиск по цитатам
     */
    async searchQuotes(query, filters = {}) {
        const params = {
            search: query,
            ...filters
        };
        
        const response = await this.apiManager.getQuotes(params);
        
        if (response.success && response.data) {
            return Array.isArray(response.data) ? response.data : response.data.quotes || [];
        }
        
        return [];
    }
    
    /**
     * ВАЛИДАЦИЯ ДАННЫХ
     */
    
    validateQuote(quoteData) {
        const errors = [];
        
        if (!quoteData.text || quoteData.text.trim().length < 5) {
            errors.push('Текст цитаты должен содержать минимум 5 символов');
        }
        
        if (quoteData.text && quoteData.text.length > 500) {
            errors.push('Текст цитаты не может быть длиннее 500 символов');
        }
        
        if (quoteData.author && quoteData.author.length > 100) {
            errors.push('Имя автора не может быть длиннее 100 символов');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * ДЕБАГ И МОНИТОРИНГ
     */
    
    getConnectionInfo() {
        return {
            isReady: this.isReady,
            isAuthenticated: this.isAuthenticated(),
            apiManagerAvailable: !!this.apiManager,
            baseUrl: this.apiManager?.baseUrl,
            mockMode: this.apiManager?.getMockResponse ? true : false
        };
    }
    
    async testConnection() {
        try {
            const health = await this.healthCheck();
            const stats = await this.getUserStats();
            
            return {
                success: true,
                health: health,
                stats: !!stats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Инициализация глобального экземпляра
window.ReaderAPI = ReaderAPI;

// Автоинициализация при загрузке
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            // Ждем, пока apiManager будет готов
            const initReaderAPI = () => {
                if (window.apiManager) {
                    window.readerAPI = new ReaderAPI();
                    console.log('✅ ReaderAPI Integration готов к работе');
                    
                    // Dispatchим событие готовности
                    window.dispatchEvent(new CustomEvent('readerAPIReady', {
                        detail: { readerAPI: window.readerAPI }
                    }));
                } else {
                    // Повторяем через 100ms
                    setTimeout(initReaderAPI, 100);
                }
            };
            
            initReaderAPI();
            
        } catch (error) {
            console.error('❌ Ошибка инициализации ReaderAPI:', error);
        }
    });
}

console.log('🔗 ReaderAPI Integration Layer загружен');