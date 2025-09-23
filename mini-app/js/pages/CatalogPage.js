/**
 * 📚 КАТАЛОГ - CatalogPage.js (ИСПРАВЛЕНО - БЕЗ ШАПКИ!)
 * 
 * ✅ ИСПОЛЬЗУЕТ ПРАВИЛЬНУЮ СТРУКТУРУ:
 * - Убрана лишняя обертка .page
 * - Контент рендерится прямо как .content (как в ReportsPage)
 * - Правильная работа скролла и навигации
 * 
 * ✅ ИСПРАВЛЕНО: БЕЗ ШАПКИ СВЕРХУ - ЧИСТЫЙ ДИЗАЙН!
 * ✅ ИСПРАВЛЕНО: Устранены дублирующиеся API вызовы как в HomePage и DiaryPage
 */

// 14 витринных категорий каталога (точно как в бэкенде)
const CATALOG_CATEGORIES = [
  'КРИЗИСЫ',
  'Я — ЖЕНЩИНА',
  'ЛЮБОВЬ',
  'ОТНОШЕНИЯ',
  'ДЕНЬГИ',
  'ОДИНОЧЕСТВО',
  'СМЕРТЬ',
  'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'СМЫСЛ ЖИЗНИ',
  'СЧАСТЬЕ',
  'ВРЕМЯ И ПРИВЫЧКИ',
  'ДОБРО И ЗЛО',
  'ОБЩЕСТВО',
  'ПОИСК СЕБЯ'
];

class CatalogPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.query = app.initialState?.query || {};
        
        // ✅ НОВОЕ: Флаги для предотвращения дублирующихся загрузок
        this.catalogLoaded = false;
        this.catalogLoading = false;
        
        // Состояние фильтров (14 категорий + ВСЕ)
        // Set initial filter from query parameters
        this.activeFilter = this.query.category ? this.mapQueryCategoryToFilter(this.query.category) : 'ВСЕ';
        this.searchQuery = '';
        this.showSearch = false;
        
        // Примеры данных (точно из концепта)
        this.userTags = ['Психология', 'Отношения', 'Саморазвитие'];
        this.books = [];
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // ✅ ИСПРАВЛЕНО: Убрана автозагрузка из init()
    }
    
    setupSubscriptions() {
        // Подписки на изменения состояния, если необходимо
    }
    
    async loadCatalogData() {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.catalogLoading) {
            console.log('🔄 CatalogPage: Каталог уже загружается, пропускаем');
            return;
        }
        
        try {
            this.catalogLoading = true;
            console.log('📚 CatalogPage: Загружаем данные каталога...');
            
            // Include category filter if specified in query
            const apiOptions = { limit: 100 };
            if (this.query.category) {
                apiOptions.category = this.query.category;
            }
            
            // Загружаем реальные данные каталога через API
            const response = await this.api.getCatalog(apiOptions);
            
            if (response && response.success && response.books) {
                // Конвертируем API данные в формат для отображения
                this.books = response.books.map(book => this.convertApiBookToDisplayFormat(book));
                console.log('✅ CatalogPage: Загружено книг из API:', this.books.length);
            } else {
                console.warn('⚠️ CatalogPage: Некорректный ответ API, используем заглушки');
                // Fallback на статичные данные
                this.books = [];
            }
            
            this.catalogLoaded = true;
            this.state.set('catalog.lastUpdate', Date.now());
            console.log('✅ CatalogPage: Данные каталога загружены');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных каталога:', error);
            // Fallback на статичные данные при ошибке
            this.books = [];
            console.log('📚 CatalogPage: Каталог пуст из-за ошибки.');
        } finally {
            this.catalogLoading = false;
            this.rerender();
        }
    }
    
    /**
     * 🔄 Конвертация данных API в формат для отображения
     */
    convertApiBookToDisplayFormat(apiBook) {
        return {
            id: apiBook.id,
            title: apiBook.title,
            author: apiBook.author || 'Неизвестный автор',
            description: apiBook.description,
            coverClass: `cover-${(parseInt(apiBook.id) % 6) + 1}`,
            rating: 4.5 + Math.random() * 0.5,
            reviews: Math.floor(Math.random() * 200) + 50,
            duration: `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 9)} часа`,
            match: `${Math.floor(Math.random() * 20) + 80}% подходит`,
            price: this.formatPrice(apiBook.priceRub, apiBook.priceByn, apiBook.price),
            oldPrice: null,
            category: this.mapApiCategoryToFilter(apiBook.categories),
            hasDiscount: false,
            badge: this.generateBadge(apiBook),
            utmLink: apiBook.utmLink,
            bookSlug: apiBook.bookSlug // ← обязательно
        };
    }
    
    /**
     * 💰 Форматирование цены с поддержкой RUB/BYN
     */
    formatPrice(priceRub, priceByn, legacyPrice) {
        // Приоритет: RUB > BYN > legacy price
        if (priceRub && priceRub > 0) {
            return `${priceRub}₽`;
        } else if (priceByn && priceByn > 0) {
            return `${priceByn} BYN`;
        } else if (legacyPrice) {
            // Конвертируем $X в рубли (примерно)
            const dollarAmount = parseInt(legacyPrice.replace('$', ''));
            return `${dollarAmount * 80}₽`; // Примерный курс доллара
        }
        return '800₽'; // Fallback цена
    }
    
    /**
     * 🏷️ Маппинг категорий query в фильтры
     */
    mapQueryCategoryToFilter(queryCategory) {
        if (!queryCategory) return 'ВСЕ';
        
        // Try direct match first
        const directMatch = CATALOG_CATEGORIES.find(c => 
            c.toLowerCase() === queryCategory.toLowerCase()
        );
        if (directMatch) return directMatch;
        
        // Try partial match
        const partialMatch = CATALOG_CATEGORIES.find(c => 
            c.toLowerCase().includes(queryCategory.toLowerCase()) ||
            queryCategory.toLowerCase().includes(c.toLowerCase())
        );
        if (partialMatch) return partialMatch;
        
        // Specific mappings for slugified categories
        const categoryMappings = {
            'кризисы': 'КРИЗИСЫ',
            'я-женщина': 'Я — ЖЕНЩИНА',
            'любовь': 'ЛЮБОВЬ',
            'отношения': 'ОТНОШЕНИЯ',
            'деньги': 'ДЕНЬГИ',
            'одиночество': 'ОДИНОЧЕСТВО',
            'смерть': 'СМЕРТЬ',
            'семейные-отношения': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
            'смысл-жизни': 'СМЫСЛ ЖИЗНИ',
            'счастье': 'СЧАСТЬЕ',
            'время-и-привычки': 'ВРЕМЯ И ПРИВЫЧКИ',
            'добро-и-зло': 'ДОБРО И ЗЛО',
            'общество': 'ОБЩЕСТВО',
            'поиск-себя': 'ПОИСК СЕБЯ',
            'психология-отношений': 'ОТНОШЕНИЯ',
            'психология': 'ПОИСК СЕБЯ'
        };
        
        const mapped = categoryMappings[queryCategory.toLowerCase()];
        return mapped || 'ВСЕ';
    }

    /**
     * 🏷️ Маппинг категорий API в фильтры
     */
    mapApiCategoryToFilter(categories) {
        if (!Array.isArray(categories) || categories.length === 0) return 'ПОИСК СЕБЯ';
        const first = String(categories[0]).trim().toUpperCase();
        const match = CATALOG_CATEGORIES.find(c => c === first);
        return match || 'ПОИСК СЕБЯ';
    }
    
    /**
     * 🏅 Генерация badge на основе данных книги
     */
    generateBadge(apiBook) {
        // Простая логика для генерации badges
        if (apiBook.categories && apiBook.categories.includes('ПОИСК СЕБЯ')) {
            return { type: 'top', text: 'ТОП' };
        }
        
        // Можно добавить больше логики на основе других полей
        return null;
    }
    
    /**
     * 📚 ПРИМЕРЫ КНИГ ИЗ КОНЦЕПТА (обновленные с акциями)
     */
    getExampleBooks() {
        return [
            {
                id: '1',
                title: 'Искусство любить',
                author: 'Эрих Фромм',
                description: 'Подробный разбор классической книги о психологии любви и отношений',
                coverClass: 'cover-1',
                badge: { type: 'top', text: 'ТОП' },
                rating: 4.9,
                reviews: 127,
                duration: '2.5 часа',
                match: '97% подходит',
                oldPrice: '1,200₽',
                price: '960₽',
                discount: '-20%',
                category: 'ЛЮБОВЬ',
                hasDiscount: true
            },
            {
                id: '2',
                title: 'Быть собой',
                author: 'Анна Бусел',
                description: 'Авторский курс по обретению внутренней гармонии и самопринятию',
                coverClass: 'cover-2',
                badge: { type: 'new', text: 'НОВОЕ' },
                rating: 5.0,
                reviews: 43,
                duration: '3 часа',
                match: '94% подходит',
                price: '1,800₽',
                category: 'ПОИСК СЕБЯ'
            },
            {
                id: '3',
                title: 'Письма к молодому поэту',
                author: 'Райнер Рильке',
                description: 'О творчестве, одиночестве и поиске своего пути в жизни',
                coverClass: 'cover-3',
                rating: 4.8,
                reviews: 89,
                duration: '1.5 часа',
                match: '91% подходит',
                price: '800₽',
                category: 'ПОИСК СЕБЯ'
            },
            {
                id: '4',
                title: 'Психология влияния',
                author: 'Роберт Чалдини',
                description: '6 принципов убеждения и их применение в жизни',
                coverClass: 'cover-4',
                badge: { type: 'popular', text: 'ПОПУЛЯРНОЕ' },
                rating: 4.7,
                reviews: 156,
                duration: '4 часа',
                match: '89% подходит',
                price: '1,400₽',
                category: 'ОБЩЕСТВО'
            },
            {
                id: '5',
                title: 'Думай медленно, решай быстро',
                author: 'Даниэль Канеман',
                description: 'Две системы мышления и принятие решений',
                coverClass: 'cover-5',
                rating: 4.6,
                reviews: 98,
                duration: '5 часов',
                match: '85% подходит',
                price: '1,600₽',
                category: 'ОБЩЕСТВО'
            },
            {
                id: '6',
                title: '7 навыков высокоэффективных людей',
                author: 'Стивен Кови',
                description: 'Классика саморазвития и личной эффективности',
                coverClass: 'cover-6',
                rating: 4.8,
                reviews: 234,
                duration: '3.5 часа',
                match: '93% подходит',
                oldPrice: '1,500₽',
                price: '1,000₽',
                discount: '-33%',
                category: 'ВРЕМЯ И ПРИВЫЧКИ',
                hasDiscount: true
            }
        ];
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ИСПРАВЛЕНО!) - БЕЗ ШАПКИ!
     * 
     * 🔧 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: 
     * - Убрана лишняя обертка .page px-3 py-3
     * - Используется .content как в ReportsPage
     * - Это обеспечивает правильную работу скролла и навигации
     */
    render() {
        const isSearchMode = this.showSearch;
        return `
            <div class="content">
                ${isSearchMode ? this.renderSearchMode() : this.renderNormalMode()}
            </div>
        `;
    }
    
    /**
     * 🔥 БАННЕР СКИДОК (для фильтра "Скидки")
     */
    renderDiscountBanner() {
        return `
            <div class="top-promo-banner">
                <div class="top-promo-title">🔥 Распродажа января</div>
                <div class="top-promo-subtitle">Скидки до 40% на популярные разборы</div>
                <div class="top-promo-timer">Только до 31 января</div>
            </div>
        `;
    }
    
    /**
     * 🏠 ОБЫЧНЫЙ РЕЖИМ С ПЕРСОНАЛИЗАЦИЕЙ (ИЗ КОНЦЕПТА)
     */
    renderNormalMode() {
        return `
            ${this.renderPersonalizationCard()}
            ${this.renderFilterTabs()}
            ${this.renderBooksList()}
        `;
    }
    
    /**
     * 🔍 РЕЖИМ ПОИСКА (ИЗ КОНЦЕПТА)
     */
    renderSearchMode() {
        return `
            ${this.renderSearchSection()}
            ${this.renderFilterTabs()}
            ${this.renderSearchResults()}
            ${this.renderPromoSection()}
        `;
    }
    
    /**
     * 🎯 ПЕРСОНАЛИЗАЦИЯ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderPersonalizationCard() {
        return `
            <div class="personalization-card">
                <div class="personalization-title">🎯 Персональные рекомендации</div>
                <div class="personalization-subtitle">На основе ваших цитат и интересов</div>
                <div class="user-tags">
                    ${this.userTags.map(tag => `
                        <span class="user-tag">${tag}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔍 СЕКЦИЯ ПОИСКА (ИЗ КОНЦЕПТА)
     */
    renderSearchSection() {
        return `
            <div class="search-section active">
                <input class="search-input" 
                       id="catalogSearchInput"
                       placeholder="Найти книгу или автора..." 
                       value="${this.searchQuery}">
            </div>
        `;
    }
    
    /**
     * 🏷️ ФИЛЬТРЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderFilterTabs() {
        const tabs = ['ВСЕ', ...CATALOG_CATEGORIES];
        const active = this.activeFilter || 'ВСЕ';
        return `
            <div class="filter-tabs">
                ${tabs.map(tab => `
                    <button class="filter-tab ${tab === active ? 'active' : ''}" data-filter="${tab}">
                        ${tab}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * 📚 СПИСОК КНИГ (ИЗ КОНЦЕПТА)
     */
    renderBooksList() {
        const filteredBooks = this.getFilteredBooks();
        
        if (filteredBooks.length === 0) {
           return ''; // ничего не показываем
        }
        
        return filteredBooks.map(book => this.renderBookCard(book)).join('');
    }
    
    /**
     * 🔍 РЕЗУЛЬТАТЫ ПОИСКА (ИЗ КОНЦЕПТА)
     */
    renderSearchResults() {
        const results = this.books.filter(book => 
            book.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
        
        return `
            <div class="search-results-info">
                Найдено <span class="search-results-count">${results.length}</span> разборов по запросу "${this.searchQuery}"
            </div>
            ${results.map(book => this.renderBookCard(book)).join('')}
        `;
    }
    
    /**
     * 📖 КАРТОЧКА КНИГИ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderBookCard(book) {
        const discountClass = book.hasDiscount ? 'discount-card' : '';
        return `
            <div class="book-card ${discountClass}" data-book-id="${book.id}" data-book-slug="${book.bookSlug || ''}">
                ${book.hasDiscount ? `
                    <div class="discount-badge">${book.discount}</div>
                ` : ''}
                
                <div class="book-main">
                    <div class="book-cover ${book.coverClass}">${book.title}</div>
                    <div class="book-info">
                        <div class="book-header">
                            <div>
                                <div class="book-title">${book.title}</div>
                                <div class="book-author">${book.author}</div>
                            </div>
                            ${book.badge ? `
                                <div class="book-badge ${book.badge.type}">${book.badge.text}</div>
                            ` : ''}
                        </div>
                        <div class="book-description">${book.description}</div>
                        <div class="book-meta">
                            <span class="book-meta-item">⭐ ${book.rating} (${book.reviews})</span>
                            <span class="book-meta-item">📖 ${book.duration}</span>
                            <span class="book-meta-item">🎯 ${book.match}</span>
                        </div>
                    </div>
                </div>
                
                <div class="book-footer">
                    <div class="book-pricing">
                        ${book.oldPrice ? `
                            <div class="book-old-price">${book.oldPrice}</div>
                        ` : ''}
                        <div class="book-price">${book.price}</div>
                    </div>
                    <button class="buy-button ${book.hasDiscount ? 'discount-button' : ''}" 
                            data-book-id="${book.id}">
                        ${book.hasDiscount ? 'Купить со скидкой' : 'Купить разбор'}
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎁 ПРОМО СЕКЦИЯ (ИЗ КОНЦЕПТА)
     */
    renderPromoSection() {
        if (this.searchQuery.toLowerCase().includes('психология')) {
            return `
                <div class="promo-section">
                    <div class="promo-title">🔥 Скидка на психологию</div>
                    <div class="promo-text">Промокод PSYCHO15 дает 15% на все разборы по психологии</div>
                    <button class="promo-button" id="applyPromoBtn">Применить скидку</button>
                </div>
            `;
        }
        return '';
    }
    
    /**
     * 🚫 ПУСТОЕ СОСТОЯНИЕ
     */
    renderEmptyState() {
        return `
            <div class="text-center py-4 px-2">
                <div style="font-size: 48px; margin-bottom: var(--spacing-md);">📚</div>
                <div class="font-semibold text-primary mb-2" style="font-size: var(--font-size-sm);">
                    Разборы не найдены
                </div>
                <div class="text-muted" style="font-size: var(--font-size-xs); line-height: var(--line-height-normal);">
                    Попробуйте выбрать другую категорию или воспользоваться поиском
                </div>
            </div>
        `;
    }
    
    /**
     * 🔧 ФИЛЬТРАЦИЯ КНИГ
     */
    getFilteredBooks() {
        const active = this.activeFilter || 'ВСЕ';
        if (active === 'ВСЕ') return this.books || [];
        return (this.books || []).filter(b => b.category === active);
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
     */
    attachEventListeners() {
        // Фильтры
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.handleFilterChange(e.target.dataset.filter);
            });
        });
        
        // Кнопки покупки
        const buyButtons = document.querySelectorAll('.buy-button');
        buyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleBuyBook(btn.dataset.bookId);
            });
        });
        
        // Поиск
        const searchInput = document.getElementById('catalogSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.rerender();
            });
        }
        
        // Промо кнопка
        const promoBtn = document.getElementById('applyPromoBtn');
        if (promoBtn) {
            promoBtn.addEventListener('click', () => {
                this.handleApplyPromo();
            });
        }
    }
    
    /**
     * 🏷️ СМЕНА ФИЛЬТРА
     */
    handleFilterChange(filterId) {
        this.activeFilter = filterId;
        this.telegram.hapticFeedback('light');
        this.rerender();
    }
    
    /**
     * 💳 ПОКУПКА КНИГИ
     */
    handleBuyBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;
        
        this.telegram.hapticFeedback('success');

        // Fire-and-forget tracking; не блокируем переход
        this.api.trackCatalogClick({ bookSlug: book.bookSlug, bookId: book.id }).catch(() => {});
      
        // Используем реальную UTM ссылку из API если доступна
        const buyUrl = book.utmLink || `https://anna-busel.com/books?utm_source=telegram_bot&utm_medium=mini_app&utm_campaign=catalog&utm_content=${book.id}`;
        this.telegram.openLink(buyUrl);
        
        this.showSuccess(`📚 Переходим к покупке "${book.title}"`);
    }
    
    /**
     * 🎁 ПРИМЕНИТЬ ПРОМОКОД
     */
    handleApplyPromo() {
        this.telegram.hapticFeedback('success');
        this.showSuccess('🎉 Промокод PSYCHO15 применен!');
    }
    
    /**
     * 🔍 ПЕРЕКЛЮЧЕНИЕ ПОИСКА
     */
    toggleSearch() {
        this.showSearch = !this.showSearch;
        if (this.showSearch) {
            this.searchQuery = 'психология'; // Пример из концепта
        } else {
            this.searchQuery = '';
        }
        this.rerender();
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ИСПРАВЛЕНО: БЕЗ ШАПКИ!
     */
    onShow() {
        console.log('📚 CatalogPage: onShow - БЕЗ ШАПКИ!');
      
        // ✅ ИСПРАВЛЕНО: Умная загрузка как в HomePage
        if (!this.catalogLoaded) {
            console.log('🔄 CatalogPage: Первый показ, загружаем данные');
            this.loadCatalogData();
        } else {
            // Проверяем актуальность данных (10 минут)
            const lastUpdate = this.state.get('catalog.lastUpdate');
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            
            if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
                console.log('🔄 CatalogPage: Данные устарели, обновляем');
                this.loadCatalogData();
            } else {
                console.log('✅ CatalogPage: Данные актуальны');
            }
        }
    }
    
    onHide() {
        console.log('📚 CatalogPage: onHide');
        // Ничего не делаем - Router управляет шапками
    }
    
    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
            // Автоматический скролл и подсветка по highlight из router state
            const highlightId = this.app.initialState?.query?.highlight;
            if (highlightId) {
                setTimeout(() => {
                    // Try to find by book ID first, then by slug
                    let el = document.querySelector(`[data-book-id="${highlightId}"]`);
                    if (!el) {
                        el = document.querySelector(`[data-book-slug="${highlightId}"]`);
                    }
                    if (el) {
                        el.classList.add('catalog-item--highlight');
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => el.classList.remove('catalog-item--highlight'), 2500);
                    }
                }, 300);
            }
        }
    }
    
    async rerenderWithFreshData() {
        // Принудительно обновляем данные каталога
        this.catalogLoaded = false;
        await this.loadCatalogData();
        this.rerender();
    }
    
    showSuccess(message) {
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    destroy() {
        // Очистка ресурсов
        
        // ✅ НОВОЕ: Сброс флагов
        this.catalogLoaded = false;
        this.catalogLoading = false;
    }
}

// 📤 Экспорт класса
window.CatalogPage = CatalogPage;
