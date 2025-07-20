/**
 * Читатель Mini App - API Integration
 * Интеграция с Reader Bot API
 * НОВОЕ: Добавлены методы для AI анализа цитат
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
            // В Mini App нет localStorage, используем переменную
            this.storedToken = token;
        } catch (error) {
            console.warn('Не удалось сохранить токен:', error);
        }
    }
    
    /**
     * Загрузка сохраненного токена
     */
    loadAuthToken() {
        try {
            if (this.storedToken) {
                this.authToken = this.storedToken;
                this.isAuthenticated = true;
                return this.storedToken;
            }
        } catch (error) {
            console.warn('Не удалось загрузить токен:', error);
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
            return this.getMockResponse(endpoint, finalOptions.method, options.body);
        }
    }
    
    /**
     * Mock ответы для тестирования без backend
     */
    getMockResponse(endpoint, method, body = null) {
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
        
        // НОВОЕ: Mock для AI анализа цитат
        if (endpoint.includes('/quotes/analyze') && method === 'POST') {
            const { text, author } = body || {};
            return {
                success: true,
                data: this.generateMockAIAnalysis(text, author)
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
                                aiComment: 'Леннон напоминает нам о важности жить настоящим моментом. Ваши размышления о балансе планирования и спонтанности показывают зрелое понимание жизни.',
                                bookRecommendation: {
                                    title: 'Сила настоящего',
                                    author: 'Экхарт Толле',
                                    reason: 'Углубление в философию жизни здесь и сейчас'
                                }
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
                                aiComment: 'Будда указывает на важность ученичества. Ваш выбор этой цитаты говорит о смирении и готовности к познанию. Это путь мудрости.',
                                bookRecommendation: {
                                    title: 'Ум новичка',
                                    author: 'Судзуки Роси',
                                    reason: 'Развитие идей о непредвзятом познании'
                                }
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
                const quoteData = body || {};
                return {
                    success: true,
                    data: {
                        id: Date.now(),
                        text: quoteData.text || 'Новая цитата',
                        author: quoteData.author || '',
                        createdAt: new Date().toISOString(),
                        analysis: this.generateMockAIAnalysis(quoteData.text, quoteData.author)
                    }
                };
            }
        }
        
        // НОВОЕ: Mock данные для каталога
        if (endpoint.includes('/catalog') || endpoint.includes('/books')) {
            return {
                success: true,
                data: {
                    books: [
                        {
                            id: 1,
                            title: "Искусство любить",
                            author: "Эрих Фромм",
                            price: 1200,
                            discountedPrice: 960,
                            cover: null,
                            category: "psychology",
                            description: "Классическая работа о природе любви и человеческих отношений",
                            recommendation: "Ваши цитаты о любви говорят о поиске глубокого понимания отношений",
                            utm: "?utm_source=mini_app&utm_medium=catalog&utm_campaign=reader_bot&utm_content=fromm_art_of_loving",
                            tags: ["любовь", "отношения", "психология"]
                        },
                        {
                            id: 2,
                            title: "Письма к молодому поэту",
                            author: "Райнер Мария Рильке",
                            price: 800,
                            discountedPrice: 680,
                            cover: null,
                            category: "philosophy",
                            description: "Мудрые советы великого поэта о творчестве и жизни",
                            recommendation: "Созвучно вашим записям о внутреннем мире и творчестве",
                            utm: "?utm_source=mini_app&utm_medium=catalog&utm_campaign=reader_bot&utm_content=rilke_letters",
                            tags: ["творчество", "философия", "поэзия"]
                        },
                        {
                            id: 3,
                            title: "Быть собой",
                            author: "Анна Бусел",
                            price: 1500,
                            discountedPrice: 1200,
                            cover: null,
                            category: "selfdevelopment",
                            description: "Практическое руководство по самопознанию и аутентичности",
                            recommendation: "Для углубления в тему самопознания и аутентичности",
                            utm: "?utm_source=mini_app&utm_medium=catalog&utm_campaign=reader_bot&utm_content=busel_be_yourself",
                            tags: ["самопознание", "аутентичность", "саморазвитие"]
                        }
                    ],
                    categories: [
                        { id: 'psychology', name: 'Психология', count: 1 },
                        { id: 'philosophy', name: 'Философия', count: 1 },
                        { id: 'selfdevelopment', name: 'Саморазвитие', count: 1 }
                    ]
                }
            };
        }
        
        // НОВОЕ: Mock данные для промокодов
        if (endpoint.includes('/promocodes')) {
            return {
                success: true,
                data: [
                    {
                        code: 'READER20',
                        discount: 20,
                        description: '20% скидка для читателей',
                        isActive: true,
                        validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
                    },
                    {
                        code: 'PHIL15',
                        discount: 15,
                        description: '15% скидка на философию',
                        isActive: true,
                        validUntil: new Date(Date.now() + 14 * 86400000).toISOString()
                    }
                ]
            };
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

        // НОВОЕ: Mock профиль пользователя
        if (endpoint.includes('/profile')) {
            return {
                success: true,
                data: {
                    id: 12345678,
                    name: 'Марина',
                    username: 'marina_reader',
                    email: 'marina@example.com',
                    interests: ['саморазвитие', 'психология', 'философия'],
                    recentQuoteTopics: ['любовь', 'самопознание', 'отношения'],
                    joinedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
                    settings: {
                        notifications: true,
                        reminderTimes: ['09:00', '19:00'],
                        theme: 'auto'
                    }
                }
            };
        }
        
        // Дефолтный ответ
        return {
            success: false,
            message: 'Mock endpoint не найден',
            data: null
        };
    }

    /**
     * НОВОЕ: Генерация mock AI анализа
     */
    generateMockAIAnalysis(text, author) {
        if (!text) {
            return {
                mood: 'Неопределенное',
                category: 'Общее',
                aiComment: 'Не удалось проанализировать пустую цитату.',
                bookRecommendation: null
            };
        }

        // Определяем категорию по ключевым словам
        const categories = [
            { keywords: ['любовь', 'отношения', 'сердце', 'чувства'], name: 'Любовь и отношения' },
            { keywords: ['мудрость', 'знание', 'истина', 'понимание', 'познание'], name: 'Мудрость и познание' },
            { keywords: ['жизнь', 'бытие', 'существование', 'смысл'], name: 'Философия жизни' },
            { keywords: ['время', 'момент', 'настоящее', 'будущее', 'прошлое'], name: 'Философия времени' },
            { keywords: ['счастье', 'радость', 'успех', 'достижения'], name: 'Счастье и успех' },
            { keywords: ['творчество', 'искусство', 'красота', 'вдохновение'], name: 'Творчество и искусство' },
            { keywords: ['саморазвитие', 'рост', 'изменения', 'улучшение'], name: 'Саморазвитие' }
        ];

        let category = 'Философские размышления';
        for (const cat of categories) {
            if (cat.keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                category = cat.name;
                break;
            }
        }

        // Определяем настроение
        const moods = [
            { keywords: ['глубокий', 'серьезный', 'важный', 'значимый'], name: 'Глубокое размышление' },
            { keywords: ['светлый', 'радостный', 'прекрасный', 'красивый'], name: 'Вдохновение' },
            { keywords: ['мудрый', 'понимание', 'опыт', 'знание'], name: 'Мудрость' },
            { keywords: ['спокойный', 'тихий', 'гармония', 'баланс'], name: 'Спокойствие' },
            { keywords: ['мотивация', 'действие', 'движение', 'цель'], name: 'Мотивация' }
        ];

        let mood = 'Размышление';
        for (const m of moods) {
            if (m.keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                mood = m.name;
                break;
            }
        }

        // Генерируем AI комментарий
        let aiComment;
        let bookRecommendation;

        if (!author) {
            aiComment = `Ваша собственная мысль! Это показывает глубину ваших размышлений в области "${category.toLowerCase()}". Продолжайте развивать эту внутреннюю мудрость — такие инсайты приходят только через личный опыт и осознанность.`;
            bookRecommendation = {
                title: "Быть собой",
                author: "Анна Бусел",
                reason: "Для развития навыков самоанализа и аутентичности"
            };
        } else {
            // Специальные комментарии для известных авторов
            if (author.toLowerCase().includes('фромм')) {
                aiComment = `${author} — мастер анализа человеческих отношений. Эта мысль отражает его глубокое понимание психологии любви. Ваш выбор этой цитаты говорит о стремлении к осознанным отношениям.`;
                bookRecommendation = {
                    title: "Искусство любить",
                    author: "Эрих Фромм",
                    reason: "Полное раскрытие философии любви и отношений"
                };
            } else if (author.toLowerCase().includes('будда') || author.toLowerCase().includes('далай')) {
                aiComment = `Восточная мудрость ${author} актуальна и сегодня. Эта мысль о "${category.toLowerCase()}" показывает ваш интерес к глубинным вопросам бытия и внутреннему развитию.`;
                bookRecommendation = {
                    title: "Ум новичка",
                    author: "Судзуки Роси",
                    reason: "Углубление в буддийскую философию и практики осознанности"
                };
            } else if (author.toLowerCase().includes('сократ') || author.toLowerCase().includes('платон')) {
                aiComment = `Классическая мудрость ${author} не теряет актуальности. Ваш интерес к философии познания говорит о стремлении к истинному знанию и самопознанию.`;
                bookRecommendation = {
                    title: "Апология Сократа",
                    author: "Платон",
                    reason: "Основы западной философии и критического мышления"
                };
            } else if (author.toLowerCase().includes('рильке') || author.toLowerCase().includes('цветаева')) {
                aiComment = `Поэтическая душа ${author} чувствует глубину слов. Ваш выбор говорит о тонком восприятии языка и стремлении к прекрасному.`;
                bookRecommendation = {
                    title: "Письма к молодому поэту",
                    author: "Райнер Мария Рильке",
                    reason: "Развитие поэтического видения мира и творческой чувствительности"
                };
            } else {
                aiComment = `Прекрасный выбор цитаты от ${author}! Эта мысль о "${category.toLowerCase()}" созвучна вашему внутреннему поиску. Такие размышления говорят о желании глубже понять жизнь.`;
                bookRecommendation = {
                    title: "Думай медленно... решай быстро",
                    author: "Даниэль Канеман",
                    reason: "Развитие критического мышления и самоанализа"
                };
            }
        }

        return {
            mood,
            category,
            aiComment,
            bookRecommendation
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
     * НОВОЕ: Получить анализ цитаты от AI
     */
    async analyzeQuote(text, author = '') {
        return await this.request('/quotes/analyze', {
            method: 'POST',
            body: { text, author }
        });
    }
    
    // === НОВЫЕ МЕТОДЫ ДЛЯ КАТАЛОГА ===
    
    /**
     * Получить каталог книг
     */
    async getCatalog(params = {}) {
        const query = new URLSearchParams(params).toString();
        const endpoint = `/catalog${query ? '?' + query : ''}`;
        return await this.request(endpoint);
    }
    
    /**
     * Получить персональные рекомендации книг
     */
    async getPersonalizedBooks() {
        return await this.request('/books/personalized');
    }
    
    /**
     * Получить рекомендации книг на основе AI анализа цитаты
     */
    async getBookRecommendations(quoteText) {
        return await this.request('/books/recommendations', {
            method: 'POST',
            body: { quote: quoteText }
        });
    }
    
    /**
     * Получить детали книги
     */
    async getBookDetails(bookId) {
        return await this.request(`/books/${bookId}`);
    }
    
    /**
     * Получить промокоды пользователя
     */
    async getPromoCodes() {
        return await this.request('/promocodes');
    }
    
    /**
     * Применить промокод
     */
    async applyPromoCode(code, bookId) {
        return await this.request('/promocodes/apply', {
            method: 'POST',
            body: { code, bookId }
        });
    }
    
    /**
     * Трекинг событий (клики, покупки, etc.)
     */
    async trackEvent(eventType, eventData) {
        return await this.request('/analytics/track', {
            method: 'POST',
            body: {
                type: eventType,
                data: eventData,
                timestamp: new Date().toISOString()
            }
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
        this.storedToken = null;
        
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
