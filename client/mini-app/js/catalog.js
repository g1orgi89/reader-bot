/**
 * Catalog Manager - Управление каталогом книг в Mini App
 * Функциональность:
 * - Загрузка персональных рекомендаций
 * - Применение промокодов  
 * - UTM трекинг для ссылок
 * - Фильтрация по категориям
 * - Интеграция с API /api/reader/books
 */

class CatalogManager {
    constructor() {
        this.books = [];
        this.filteredBooks = [];
        this.currentCategory = 'all';
        this.userProfile = null;
        this.promoCodes = [];
        
        // Mock данные для демонстрации
        this.mockBooks = [
            {
                id: 1,
                title: "Искусство любить",
                author: "Эрих Фромм",
                price: 1200,
                discountedPrice: 960, // с READER20
                cover: null, // будет заглушка
                category: "psychology",
                recommendation: "Ваши цитаты о любви говорят о поиске глубокого понимания отношений",
                utm: "?utm_source=mini_app&utm_medium=catalog&utm_campaign=reader_bot&utm_content=fromm_art_of_loving"
            },
            {
                id: 2,
                title: "Письма к молодому поэту",
                author: "Райнер Мария Рильке",
                price: 800,
                discountedPrice: 680, // с PHIL15
                cover: null,
                category: "philosophy",
                recommendation: "Созвучно вашим записям о внутреннем мире и творчестве",
                utm: "?utm_source=mini_app&utm_medium=catalog&utm_campaign=reader_bot&utm_content=rilke_letters"
            },
            {
                id: 3,
                title: "Быть собой",
                author: "Анна Бусел",
                price: 1500,
                discountedPrice: 1200, // с READER20
                cover: null,
                category: "selfdevelopment",
                recommendation: "Для углубления в тему самопознания и аутентичности",
                utm: "?utm_source=mini_app&utm_medium=catalog&utm_campaign=reader_bot&utm_content=busel_be_yourself"
            },
            {
                id: 4,
                title: "Сила настоящего момента",
                author: "Экхарт Толле",
                price: 1000,
                discountedPrice: 800, // с READER20
                cover: null,
                category: "mindfulness",
                recommendation: "Дополнит ваши размышления о присутствии и осознанности",
                utm: "?utm_source=mini_app&utm_medium=catalog&utm_campaign=reader_bot&utm_content=tolle_power_of_now"
            }
        ];
        
        this.mockPromoCodes = [
            {
                code: 'READER20',
                discount: 20,
                description: '20% скидка для читателей'
            },
            {
                code: 'PHIL15',
                discount: 15,
                description: '15% скидка на философию'
            },
            {
                code: 'MONTH25',
                discount: 25,
                description: '25% скидка месяца'
            }
        ];
        
        this.categories = [
            { id: 'psychology', name: 'Психология', icon: '🧠', count: 1 },
            { id: 'philosophy', name: 'Философия', icon: '🤔', count: 1 },
            { id: 'selfdevelopment', name: 'Саморазвитие', icon: '🚀', count: 1 },
            { id: 'mindfulness', name: 'Осознанность', icon: '🧘', count: 1 }
        ];
    }

    /**
     * Инициализация каталога
     */
    async init() {
        console.log('🛒 Инициализация каталога...');
        
        try {
            // Загружаем данные пользователя для персонализации
            await this.loadUserProfile();
            
            // Загружаем промокоды
            await this.loadPromoCodes();
            
            // Загружаем книги
            await this.loadPersonalizedBooks();
            
            // Инициализируем UI
            this.initUI();
            
            console.log('✅ Каталог инициализирован');
        } catch (error) {
            console.warn('⚠️ Ошибка инициализации каталога:', error);
            this.loadMockData();
        }
    }

    /**
     * Загрузка профиля пользователя для персонализации
     */
    async loadUserProfile() {
        try {
            if (window.apiManager) {
                this.userProfile = await window.apiManager.getProfile();
            }
        } catch (error) {
            console.warn('Не удалось загрузить профиль:', error);
            // Используем mock профиль
            this.userProfile = {
                name: 'Марина',
                interests: ['саморазвитие', 'психология'],
                recentQuoteTopics: ['любовь', 'самопознание', 'отношения']
            };
        }
    }

    /**
     * Загрузка промокодов
     */
    async loadPromoCodes() {
        try {
            if (window.apiManager) {
                this.promoCodes = await window.apiManager.getPromoCodes();
            } else {
                throw new Error('API недоступен');
            }
        } catch (error) {
            console.warn('Используем mock промокоды:', error);
            this.promoCodes = this.mockPromoCodes;
        }
    }

    /**
     * Загрузка персональных рекомендаций книг
     */
    async loadPersonalizedBooks() {
        try {
            if (window.apiManager) {
                const response = await window.apiManager.getPersonalizedBooks();
                this.books = response.books || [];
            } else {
                throw new Error('API недоступен');
            }
        } catch (error) {
            console.warn('Используем mock данные книг:', error);
            this.books = this.mockBooks;
        }
        
        this.filteredBooks = [...this.books];
    }

    /**
     * Загрузка всех книг из каталога
     */
    async loadBooks() {
        try {
            if (window.apiManager) {
                const response = await window.apiManager.getCatalog();
                this.books = response.books || [];
            } else {
                throw new Error('API недоступен');
            }
        } catch (error) {
            console.warn('Используем mock данные:', error);
            this.books = this.mockBooks;
        }
        
        this.filteredBooks = [...this.books];
    }

    /**
     * Загрузка mock данных при отсутствии API
     */
    loadMockData() {
        this.books = this.mockBooks;
        this.filteredBooks = [...this.books];
        this.promoCodes = this.mockPromoCodes;
        this.initUI();
    }

    /**
     * Инициализация UI
     */
    initUI() {
        this.renderPersonalRecommendation();
        this.renderPromoCodes();
        this.renderBooks();
        this.renderCategories();
        this.setupEventListeners();
    }

    /**
     * Отрисовка персональной рекомендации
     */
    renderPersonalRecommendation() {
        const header = document.querySelector('.catalog-header .personal-recommendation');
        if (header && this.userProfile) {
            const topics = this.userProfile.recentQuoteTopics || ['саморазвитии'];
            const topicsText = topics.slice(0, 2).join(' и ');
            header.textContent = `На основе ваших записей о ${topicsText}`;
        }
    }

    /**
     * Отрисовка промокодов
     */
    renderPromoCodes() {
        const container = document.querySelector('.promo-codes-compact');
        if (!container) return;

        const activeCodes = this.promoCodes.slice(0, 2); // Показываем только первые 2
        const codesHTML = activeCodes.map(promo => 
            `<span class="promo-code" onclick="window.catalogManager.copyPromoCode('${promo.code}')">${promo.code}</span> (${promo.discount}%)`
        ).join(' • ');

        container.innerHTML = `🎁 Ваши скидки: ${codesHTML}`;
    }

    /**
     * Отрисовка списка книг
     */
    renderBooks() {
        const container = document.getElementById('books-list');
        if (!container) return;

        if (this.filteredBooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <p>Книги не найдены</p>
                    <p>Попробуйте изменить фильтр или вернитесь позже</p>
                </div>
            `;
            return;
        }

        const booksHTML = this.filteredBooks.map(book => this.renderBookCard(book)).join('');
        container.innerHTML = booksHTML;
    }

    /**
     * Отрисовка карточки книги
     */
    renderBookCard(book) {
        const originalPrice = book.price;
        const discountedPrice = book.discountedPrice || book.price;
        const hasDiscount = discountedPrice < originalPrice;

        return `
            <div class="book-card" data-book-id="${book.id}">
                <div class="book-cover" style="background: linear-gradient(135deg, #f5f5f5, #e5e5e5);">
                    📖
                </div>
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">${book.author}</p>
                    ${book.recommendation ? `<p class="book-recommendation-reason">${book.recommendation}</p>` : ''}
                    
                    <div class="book-price">
                        <div>
                            ${hasDiscount ? `<span class="price-original">${originalPrice} руб.</span>` : ''}
                            <span class="price-discounted">${discountedPrice} руб.</span>
                        </div>
                    </div>
                    
                    <div class="book-actions">
                        <button class="anna-button" onclick="window.catalogManager.buyBook(${book.id})">
                            Купить
                        </button>
                        <button class="anna-button secondary" onclick="window.catalogManager.showBookDetails(${book.id})">
                            Подробнее
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Отрисовка категорий
     */
    renderCategories() {
        const container = document.querySelector('.categories-grid');
        if (!container) return;

        // Обновляем счетчики категорий
        this.updateCategoryCounts();

        const categoriesHTML = this.categories.map(category => `
            <a href="#" class="category-item" onclick="window.catalogManager.filterByCategory('${category.id}'); return false;">
                <span class="category-icon">${category.icon}</span>
                <div class="category-name">${category.name}</div>
                <div class="category-count">(${category.count})</div>
            </a>
        `).join('');

        container.innerHTML = categoriesHTML;
    }

    /**
     * Обновление счетчиков категорий
     */
    updateCategoryCounts() {
        this.categories.forEach(category => {
            category.count = this.books.filter(book => book.category === category.id).length;
        });
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Слушатели уже настроены через onclick в HTML
        console.log('📱 Event listeners для каталога настроены');
    }

    /**
     * Фильтрация по категории
     */
    filterByCategory(categoryId) {
        console.log('🔍 Фильтрация по категории:', categoryId);
        
        this.currentCategory = categoryId;
        
        if (categoryId === 'all') {
            this.filteredBooks = [...this.books];
        } else {
            this.filteredBooks = this.books.filter(book => book.category === categoryId);
        }
        
        this.renderBooks();
        
        // Haptic feedback
        if (window.TelegramManager) {
            window.TelegramManager.hapticFeedback('light');
        }
        
        // Показываем toast с результатом
        const categoryName = this.categories.find(c => c.id === categoryId)?.name || 'Все книги';
        this.showToast(`Показано: ${categoryName} (${this.filteredBooks.length})`);
    }

    /**
     * Копирование промокода
     */
    async copyPromoCode(code) {
        try {
            await navigator.clipboard.writeText(code);
            this.showToast(`✅ Промокод ${code} скопирован!`);
            
            // Haptic feedback
            if (window.TelegramManager) {
                window.TelegramManager.hapticFeedback('medium');
            }
            
            // Трекинг использования промокода
            this.trackPromoCodeUsage(code);
            
        } catch (error) {
            console.warn('Не удалось скопировать промокод:', error);
            this.showToast(`Промокод: ${code}`, 'info');
        }
    }

    /**
     * Применение промокода к цене книги
     */
    applyPromoCode(bookId, promoCode) {
        const book = this.books.find(b => b.id === bookId);
        const promo = this.promoCodes.find(p => p.code === promoCode);
        
        if (!book || !promo) return book?.price || 0;
        
        const discountAmount = Math.round(book.price * (promo.discount / 100));
        return book.price - discountAmount;
    }

    /**
     * Покупка книги с UTM трекингом
     */
    buyBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;
        
        console.log('💳 Покупка книги:', book.title);
        
        // Генерируем URL с UTM метками
        const baseUrl = 'https://annabusel.org/bookclub';
        const utmParams = book.utm || this.generateUTMParams(book);
        const fullUrl = baseUrl + utmParams;
        
        // Трекинг клика
        this.trackBookClick(book, 'buy');
        
        // Haptic feedback
        if (window.TelegramManager) {
            window.TelegramManager.hapticFeedback('medium');
        }
        
        // Открываем в браузере или показываем модал
        if (window.TelegramManager && window.TelegramManager.openLink) {
            window.TelegramManager.openLink(fullUrl);
        } else {
            window.open(fullUrl, '_blank');
        }
        
        this.showToast(`🛒 Переход к покупке: ${book.title}`);
    }

    /**
     * Показ деталей книги
     */
    showBookDetails(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;
        
        console.log('📖 Детали книги:', book.title);
        
        // Трекинг просмотра
        this.trackBookClick(book, 'details');
        
        // Показываем модал с деталями
        const modalContent = `
            <div class="book-details-modal">
                <div class="book-details-header">
                    <div class="book-cover" style="background: linear-gradient(135deg, #f5f5f5, #e5e5e5); width: 80px; height: 100px;">
                        📖
                    </div>
                    <div class="book-details-info">
                        <h2 class="anna-h2">${book.title}</h2>
                        <p class="anna-text-gray">${book.author}</p>
                        <div class="book-price">
                            <span class="price-discounted">${book.discountedPrice || book.price} руб.</span>
                        </div>
                    </div>
                </div>
                
                ${book.recommendation ? `
                    <div class="anna-info-block">
                        <h3 class="anna-h3">Почему эта книга для вас:</h3>
                        <p class="anna-text">${book.recommendation}</p>
                    </div>
                ` : ''}
                
                <div class="book-actions" style="margin-top: 24px;">
                    <button class="anna-button large" onclick="window.catalogManager.buyBook(${book.id}); window.app.closeModal();">
                        Купить книгу
                    </button>
                </div>
            </div>
        `;
        
        if (window.app && window.app.showModal) {
            window.app.showModal(modalContent);
        }
        
        // Haptic feedback
        if (window.TelegramManager) {
            window.TelegramManager.hapticFeedback('light');
        }
    }

    /**
     * Генерация UTM параметров
     */
    generateUTMParams(book) {
        const utm = new URLSearchParams({
            utm_source: 'mini_app',
            utm_medium: 'catalog',
            utm_campaign: 'reader_bot',
            utm_content: `${book.author.toLowerCase().replace(/\s+/g, '_')}_${book.title.toLowerCase().replace(/\s+/g, '_')}`,
            utm_term: book.category || 'general'
        });
        
        return '?' + utm.toString();
    }

    /**
     * Трекинг кликов по книгам
     */
    async trackBookClick(book, action) {
        const trackingData = {
            book_id: book.id,
            book_title: book.title,
            book_author: book.author,
            action: action, // 'buy' | 'details'
            category: book.category,
            price: book.price,
            discounted_price: book.discountedPrice,
            user_id: this.userProfile?.id || 'anonymous',
            timestamp: new Date().toISOString(),
            source: 'mini_app_catalog'
        };
        
        try {
            if (window.apiManager) {
                await window.apiManager.trackEvent('book_click', trackingData);
            }
            console.log('📊 Трекинг события:', trackingData);
        } catch (error) {
            console.warn('Ошибка трекинга:', error);
        }
    }

    /**
     * Трекинг использования промокодов
     */
    async trackPromoCodeUsage(code) {
        const trackingData = {
            promo_code: code,
            user_id: this.userProfile?.id || 'anonymous',
            timestamp: new Date().toISOString(),
            source: 'mini_app_catalog'
        };
        
        try {
            if (window.apiManager) {
                await window.apiManager.trackEvent('promo_code_copy', trackingData);
            }
            console.log('📊 Трекинг промокода:', trackingData);
        } catch (error) {
            console.warn('Ошибка трекинга промокода:', error);
        }
    }

    /**
     * Показ toast уведомления
     */
    showToast(message, type = 'success') {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        } else {
            console.log('Toast:', message);
        }
    }

    /**
     * Поиск книг по запросу
     */
    searchBooks(query) {
        if (!query || query.trim() === '') {
            this.filteredBooks = [...this.books];
        } else {
            const searchTerm = query.toLowerCase().trim();
            this.filteredBooks = this.books.filter(book => 
                book.title.toLowerCase().includes(searchTerm) ||
                book.author.toLowerCase().includes(searchTerm) ||
                book.category.toLowerCase().includes(searchTerm) ||
                (book.recommendation && book.recommendation.toLowerCase().includes(searchTerm))
            );
        }
        
        this.renderBooks();
        
        // Toast с результатом поиска
        if (query) {
            this.showToast(`Найдено книг: ${this.filteredBooks.length}`);
        }
    }

    /**
     * Получение рекомендованных книг на основе AI анализа цитат
     */
    async getAIRecommendations(quoteText) {
        try {
            if (window.apiManager) {
                const response = await window.apiManager.getBookRecommendations(quoteText);
                return response.books || [];
            }
        } catch (error) {
            console.warn('Ошибка получения AI рекомендаций:', error);
        }
        
        // Fallback - возвращаем случайную книгу из каталога
        const randomIndex = Math.floor(Math.random() * this.books.length);
        return this.books[randomIndex] ? [this.books[randomIndex]] : [];
    }

    /**
     * Обновление каталога
     */
    async refresh() {
        console.log('🔄 Обновление каталога...');
        
        try {
            await this.loadPersonalizedBooks();
            await this.loadPromoCodes();
            this.renderBooks();
            this.renderPromoCodes();
            this.showToast('✅ Каталог обновлен');
        } catch (error) {
            console.warn('Ошибка обновления каталога:', error);
            this.showToast('⚠️ Ошибка обновления', 'error');
        }
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        this.books = [];
        this.filteredBooks = [];
        this.promoCodes = [];
        this.userProfile = null;
        console.log('🗑️ Каталог очищен');
    }
}

// Создаем глобальный экземпляр
window.CatalogManager = CatalogManager;

// Создаем глобальный менеджер каталога
window.catalogManager = new CatalogManager();

console.log('📚 Catalog Manager загружен');