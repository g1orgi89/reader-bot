/**
 * 📚 КАТАЛОГ - CatalogPage.js (ТОЧНО ПО КОНЦЕПТУ!)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТУ ИЗ "концепт каталог разборов app.txt":
 * - Персонализация с тегами пользователя
 * - Простые фильтры: "Для вас", "Популярное", "Новинки", "Классика", "Скидки"
 * - Карточки книг точно как в концепте
 * - Поиск с результатами
 * - Промо секции со скидками
 * - Скидочные ленты и спеццены
 */

class CatalogPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние фильтров (точно из концепта)
        this.activeFilter = 'for-you'; // for-you, popular, new, classic, sales
        this.searchQuery = '';
        this.showSearch = false;
        
        // Примеры данных (точно из концепта)
        this.userTags = ['Психология', 'Отношения', 'Саморазвитие'];
        this.books = this.getExampleBooks();
        
        this.init();
    }
    
    init() {
        // Инициализация простая, как в концепте
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
                category: 'psychology',
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
                category: 'self-development'
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
                category: 'classic'
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
                category: 'psychology'
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
                category: 'psychology'
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
                category: 'self-development',
                hasDiscount: true
            }
        ];
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!)
     */
    render() {
        const isSearchMode = this.showSearch;
        const isDiscountFilter = this.activeFilter === 'sales';
        
        return `
            <div class="catalog-page">
                ${isDiscountFilter ? this.renderDiscountBanner() : ''}
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
        const filters = [
            { id: 'for-you', text: 'Для вас' },
            { id: 'popular', text: 'Популярное' },
            { id: 'new', text: 'Новинки' },
            { id: 'classic', text: 'Классика' },
            { id: 'sales', text: 'Скидки' }
        ];
        
        return `
            <div class="filter-tabs">
                ${filters.map(filter => `
                    <button class="filter-tab ${filter.id === this.activeFilter ? 'active' : ''}" 
                            data-filter="${filter.id}">
                        ${filter.text}
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
            return this.renderEmptyState();
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
            <div class="book-card ${discountClass}" data-book-id="${book.id}">
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
        const messages = {
            'for-you': 'Мы изучаем ваши предпочтения, чтобы предложить лучшие разборы',
            'popular': 'Популярные разборы временно недоступны',
            'new': 'Новых разборов пока нет, но скоро появятся!',
            'classic': 'Классические разборы в разработке',
            'sales': 'Акций сейчас нет, но следите за обновлениями!'
        };
        
        return `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
                    Разборы не найдены
                </div>
                <div style="font-size: 12px; line-height: 1.4;">
                    ${messages[this.activeFilter] || 'Попробуйте выбрать другой фильтр'}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔧 ФИЛЬТРАЦИЯ КНИГ
     */
    getFilteredBooks() {
        switch (this.activeFilter) {
            case 'for-you':
                return this.books.filter(book => ['psychology', 'self-development'].includes(book.category));
            case 'popular':
                return this.books.filter(book => book.badge?.type === 'popular' || book.reviews > 100);
            case 'new':
                return this.books.filter(book => book.badge?.type === 'new');
            case 'classic':
                return this.books.filter(book => book.category === 'classic');
            case 'sales':
                return this.books.filter(book => book.hasDiscount);
            default:
                return this.books;
        }
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
        
        // Формируем URL для покупки (как в оригинальном коде)
        const buyUrl = `https://annabusel.org/catalog/${bookId}`;\n        this.telegram.openLink(buyUrl);
        
        this.showSuccess(`📚 Переходим к покупке "${book.title}"`);\n    }
    
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
     * 🧹 ОЧИСТКА КНОПОК ПОИСКА (НОВЫЙ МЕТОД!)
     */
    cleanupSearchButtons() {
        const pageHeader = document.getElementById('page-header');
        if (pageHeader) {
            // Удаляем все кнопки поиска, которые могли быть добавлены другими страницами
            const searchButtons = pageHeader.querySelectorAll('.search-button');
            searchButtons.forEach(btn => btn.remove());
            
            // Удаляем другие дополнительные кнопки, кроме основных
            const extraButtons = pageHeader.querySelectorAll('button:not(.back-btn):not(.menu-btn)');
            extraButtons.forEach(btn => btn.remove());
        }
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ
     */
    onShow() {
        const homeHeader = document.getElementById('home-header');
        const pageHeader = document.getElementById('page-header');
        const pageTitle = document.getElementById('pageTitle');
        
        if (homeHeader) homeHeader.style.display = 'none';
        if (pageHeader) pageHeader.style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Каталог разборов';
        
        // ИСПРАВЛЕНО: Сначала очищаем старые кнопки, потом добавляем новые
        this.cleanupSearchButtons();
        
        // Добавляем кнопку поиска в заголовок ТОЛЬКО для каталога
        if (pageHeader) {
            const searchBtn = document.createElement('button');
            searchBtn.className = 'search-button';
            searchBtn.innerHTML = '🔍';
            searchBtn.style.cssText = `
                background: rgba(255,255,255,0.1);
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: background var(--transition-normal);
            `;
            searchBtn.addEventListener('click', () => this.toggleSearch());
            searchBtn.addEventListener('mouseenter', () => {
                searchBtn.style.background = 'rgba(255,255,255,0.2)';
            });
            searchBtn.addEventListener('mouseleave', () => {
                searchBtn.style.background = 'rgba(255,255,255,0.1)';
            });
            pageHeader.appendChild(searchBtn);
        }
    }
    
    onHide() {
        const pageHeader = document.getElementById('page-header');
        if (pageHeader) pageHeader.style.display = 'none';
        
        // ИСПРАВЛЕНО: Убираем кнопки поиска при скрытии страницы
        this.cleanupSearchButtons();
    }
    
    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
        }
    }
    
    showSuccess(message) {
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    destroy() {
        // Очистка ресурсов
        this.cleanupSearchButtons();
    }
}

// 📤 Экспорт класса
window.CatalogPage = CatalogPage;