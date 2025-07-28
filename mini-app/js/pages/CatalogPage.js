/**
 * 📚 КАТАЛОГ КНИГ - CatalogPage.js
 * 
 * Функциональность:
 * - Каталог книг из админ-панели с фильтрами
 * - Категории и теги для удобной навигации
 * - Детальная информация о книгах
 * - Персональные рекомендации на основе цитат
 * - Система поиска по названию, автору, описанию
 * - Интеграция с промокодами из отчетов
 * - Покупка книг с UTM трекингом
 */

class CatalogPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние страницы
        this.activeView = 'grid'; // grid, list, detail
        this.selectedCategory = 'all';
        this.searchQuery = '';
        this.sortBy = 'featured'; // featured, popular, newest, price
        
        // Фильтры
        this.filters = {
            category: 'all',
            price: 'all', // all, free, paid
            author: '',
            tags: []
        };
        
        // Пагинация
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.hasMore = true;
        
        // Данные
        this.books = [];
        this.categories = [];
        this.selectedBook = null;
        this.recommendations = [];
        this.loading = false;
        
        // URL параметры (например, book=id, promo=true)
        this.urlParams = this.parseURLParams();
        
        // Подписки
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.setupSubscriptions();
        this.loadInitialData();
        this.handleURLParams();
    }
    
    /**
     * 📡 Настройка подписок
     */
    setupSubscriptions() {
        // Подписка на изменения каталога
        const catalogSubscription = this.state.subscribe('catalog', (catalog) => {
            this.updateCatalogUI(catalog);
        });
        
        // Подписка на изменения пользователя для персонализации
        const userSubscription = this.state.subscribe('user.profile', (profile) => {
            this.updatePersonalization(profile);
        });
        
        this.subscriptions.push(catalogSubscription, userSubscription);
    }
    
    /**
     * 📊 Загрузка начальных данных
     */
    async loadInitialData() {
        try {
            this.loading = true;
            this.state.set('catalog.loading', true);
            
            // Параллельная загрузка данных
            const [books, categories, recommendations] = await Promise.all([
                this.loadBooks(),
                this.loadCategories(),
                this.loadRecommendations()
            ]);
            
            this.books = books;
            this.categories = categories;
            this.recommendations = recommendations;
            
            // Обновление состояния
            this.state.update('catalog', {
                books: books,
                categories: categories,
                recommendations: recommendations,
                loading: false
            });
            
        } catch (error) {
            console.error('❌ Ошибка загрузки каталога:', error);
            this.showError('Не удалось загрузить каталог');
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 📚 Загрузка книг
     */
    async loadBooks(reset = false) {
        try {
            if (reset) {
                this.currentPage = 1;
                this.hasMore = true;
            }
            
            const params = {
                page: this.currentPage,
                limit: this.itemsPerPage,
                sort: this.sortBy,
                category: this.selectedCategory !== 'all' ? this.selectedCategory : undefined,
                search: this.searchQuery || undefined,
                ...this.filters
            };
            
            const response = await this.api.getCatalog(params);
            const books = response.items || response || [];
            
            // Обновляем массив книг
            if (reset || this.currentPage === 1) {
                this.books = books;
            } else {
                this.books = [...this.books, ...books];
            }
            
            this.hasMore = books.length === this.itemsPerPage;
            
            return books;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки книг:', error);
            return [];
        }
    }
    
    /**
     * 🏷️ Загрузка категорий
     */
    async loadCategories() {
        try {
            const categories = await this.api.getCategories();
            return [
                { id: 'all', name: 'Все книги', count: 0 },
                ...categories
            ];
        } catch (error) {
            console.error('❌ Ошибка загрузки категорий:', error);
            return [{ id: 'all', name: 'Все книги', count: 0 }];
        }
    }
    
    /**
     * 💡 Загрузка персональных рекомендаций
     */
    async loadRecommendations() {
        try {
            const recommendations = await this.api.getRecommendations();
            return recommendations.slice(0, 6); // Топ 6 рекомендаций
        } catch (error) {
            console.error('❌ Ошибка загрузки рекомендаций:', error);
            return [];
        }
    }
    
    /**
     * 🔗 Обработка URL параметров
     */
    handleURLParams() {
        // Если передан конкретный book ID
        if (this.urlParams.book) {
            this.viewBookDetail(this.urlParams.book);
        }
        
        // Если передан промокод
        if (this.urlParams.promo) {
            this.showPromoBooks();
        }
        
        // Если передана категория
        if (this.urlParams.category) {
            this.selectedCategory = this.urlParams.category;
            this.loadBooks(true);
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки
     */
    render() {
        if (this.activeView === 'detail' && this.selectedBook) {
            return this.renderBookDetail();
        }
        
        return `
            <div class="catalog-page">
                <div class="page-header">📚 Каталог разборов</div>
                <div class="content">
                    ${this.renderSearchAndFilters()}
                    ${this.renderRecommendationsSection()}
                    ${this.renderCatalogContent()}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔍 Рендер поиска и фильтров
     */
    renderSearchAndFilters() {
        return `
            <div class="search-filters-section">
                <div class="search-bar">
                    <input class="search-input" 
                           id="catalogSearchInput"
                           placeholder="Поиск по названию или автору..."
                           value="${this.searchQuery}">
                    <button class="search-btn" id="catalogSearchBtn">🔍</button>
                </div>
                
                <div class="filters-row">
                    <div class="categories-filter">
                        <select class="category-select" id="categorySelect">
                            ${this.categories.map(cat => `
                                <option value="${cat.id}" ${cat.id === this.selectedCategory ? 'selected' : ''}>
                                    ${cat.name} ${cat.count ? `(${cat.count})` : ''}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="sort-filter">
                        <select class="sort-select" id="sortSelect">
                            <option value="featured" ${this.sortBy === 'featured' ? 'selected' : ''}>📌 Рекомендуемые</option>
                            <option value="popular" ${this.sortBy === 'popular' ? 'selected' : ''}>🔥 Популярные</option>
                            <option value="newest" ${this.sortBy === 'newest' ? 'selected' : ''}>🆕 Новинки</option>
                            <option value="price" ${this.sortBy === 'price' ? 'selected' : ''}>💰 По цене</option>
                        </select>
                    </div>
                    
                    <button class="view-toggle-btn" id="viewToggleBtn">
                        ${this.activeView === 'grid' ? '📋' : '⊞'}
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 💡 Рендер секции рекомендаций
     */
    renderRecommendationsSection() {
        if (this.recommendations.length === 0) return '';
        
        return `
            <div class="recommendations-section">
                <div class="section-header">
                    <h3 class="section-title">💡 Рекомендации для вас</h3>
                    <p class="section-subtitle">На основе ваших цитат и интересов</p>
                </div>
                
                <div class="recommendations-carousel">
                    ${this.recommendations.map(book => this.renderRecommendationCard(book)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 🎯 Рендер карточки рекомендации
     */
    renderRecommendationCard(book) {
        return `
            <div class="recommendation-card" data-book-id="${book._id || book.id}">
                <div class="rec-badge">💡 Для вас</div>
                <div class="book-cover-small">
                    ${book.coverImage ? 
                        `<img src="${book.coverImage}" alt="${book.title}" loading="lazy">` :
                        `<div class="cover-placeholder">📚</div>`
                    }
                </div>
                <div class="rec-info">
                    <div class="rec-title">${book.title}</div>
                    <div class="rec-author">${book.author}</div>
                    <div class="rec-reason">${book.recommendationReason || 'Подходит вашим интересам'}</div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📋 Рендер содержимого каталога
     */
    renderCatalogContent() {
        if (this.loading && this.books.length === 0) {
            return this.renderLoadingState();
        }
        
        if (this.books.length === 0) {
            return this.renderEmptyState();
        }
        
        return `
            <div class="catalog-content">
                <div class="catalog-header">
                    <div class="results-info">
                        📚 Найдено: ${this.books.length} разборов
                    </div>
                </div>
                
                <div class="books-container ${this.activeView}-view" id="booksContainer">
                    ${this.books.map(book => 
                        this.activeView === 'grid' ? 
                        this.renderBookCard(book) : 
                        this.renderBookListItem(book)
                    ).join('')}
                </div>
                
                ${this.hasMore ? this.renderLoadMoreButton() : ''}
            </div>
        `;
    }
    
    /**
     * 📖 Рендер карточки книги (сетка)
     */
    renderBookCard(book) {
        const hasDiscount = book.originalPrice && book.price < book.originalPrice;
        const isRecommended = this.recommendations.some(r => (r._id || r.id) === (book._id || book.id));
        
        return `
            <div class="book-card" data-book-id="${book._id || book.id}">
                ${isRecommended ? '<div class="recommended-badge">💡</div>' : ''}
                ${hasDiscount ? '<div class="discount-badge">🔥</div>' : ''}
                
                <div class="book-cover" onclick="this.viewBookDetail('${book._id || book.id}')">
                    ${book.coverImage ? 
                        `<img src="${book.coverImage}" alt="${book.title}" loading="lazy">` :
                        `<div class="cover-placeholder">📚</div>`
                    }
                </div>
                
                <div class="book-info">
                    <h4 class="book-title">${book.title}</h4>
                    <p class="book-author">${book.author}</p>
                    
                    ${book.description ? `
                        <p class="book-description">${book.description.slice(0, 100)}...</p>
                    ` : ''}
                    
                    <div class="book-meta">
                        <div class="book-rating">
                            <span class="rating-stars">${this.renderStars(book.rating || 4.5)}</span>
                            <span class="rating-count">(${book.reviewsCount || 0})</span>
                        </div>
                        
                        <div class="book-stats">
                            <span class="stat-item">📖 ${book.chaptersCount || 0} глав</span>
                            <span class="stat-item">⏱️ ${book.readingTime || '30'} мин</span>
                        </div>
                    </div>
                    
                    <div class="book-price">
                        ${hasDiscount ? `
                            <span class="original-price">${book.originalPrice}₽</span>
                            <span class="current-price">${book.price}₽</span>
                        ` : `
                            <span class="current-price">${book.price || 'Бесплатно'}</span>
                        `}
                    </div>
                    
                    <div class="book-actions">
                        <button class="book-action-btn primary" 
                                data-action="view" 
                                data-book-id="${book._id || book.id}">
                            👁️ Подробнее
                        </button>
                        <button class="book-action-btn secondary" 
                                data-action="buy" 
                                data-book-id="${book._id || book.id}">
                            ${book.price ? '💳 Купить' : '📖 Читать'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📝 Рендер элемента списка книги
     */
    renderBookListItem(book) {
        return `
            <div class="book-list-item" data-book-id="${book._id || book.id}">
                <div class="book-cover-small">
                    ${book.coverImage ? 
                        `<img src="${book.coverImage}" alt="${book.title}" loading="lazy">` :
                        `<div class="cover-placeholder-small">📚</div>`
                    }
                </div>
                
                <div class="book-details">
                    <div class="book-main-info">
                        <h4 class="book-title">${book.title}</h4>
                        <p class="book-author">${book.author}</p>
                        <div class="book-rating-inline">
                            ${this.renderStars(book.rating || 4.5)} (${book.reviewsCount || 0})
                        </div>
                    </div>
                    
                    <div class="book-description-short">
                        ${book.description ? book.description.slice(0, 150) + '...' : ''}
                    </div>
                    
                    <div class="book-bottom-row">
                        <div class="book-price-inline">
                            ${book.price ? `${book.price}₽` : 'Бесплатно'}
                        </div>
                        
                        <div class="book-actions-inline">
                            <button class="action-btn-small" 
                                    data-action="view" 
                                    data-book-id="${book._id || book.id}">
                                Подробнее
                            </button>
                            <button class="action-btn-small primary" 
                                    data-action="buy" 
                                    data-book-id="${book._id || book.id}">
                                ${book.price ? 'Купить' : 'Читать'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📄 Рендер детальной страницы книги
     */
    renderBookDetail() {
        const book = this.selectedBook;
        if (!book) return this.renderEmptyState();
        
        return `
            <div class="book-detail-page">
                <div class="detail-header">
                    <button class="back-btn" id="backToListBtn">
                        ← Назад к каталогу
                    </button>
                    <div class="detail-actions">
                        <button class="share-book-btn" id="shareBookBtn">📤</button>
                        <button class="favorite-book-btn" id="favoriteBookBtn">🤍</button>
                    </div>
                </div>
                
                <div class="book-detail-content">
                    <div class="book-detail-main">
                        <div class="book-cover-large">
                            ${book.coverImage ? 
                                `<img src="${book.coverImage}" alt="${book.title}">` :
                                `<div class="cover-placeholder-large">📚</div>`
                            }
                        </div>
                        
                        <div class="book-detail-info">
                            <h1 class="detail-title">${book.title}</h1>
                            <h2 class="detail-author">Автор: ${book.author}</h2>
                            
                            <div class="detail-rating">
                                <div class="rating-display">
                                    ${this.renderStars(book.rating || 4.5)}
                                    <span class="rating-number">${book.rating || 4.5}</span>
                                    <span class="reviews-count">(${book.reviewsCount || 0} отзывов)</span>
                                </div>
                            </div>
                            
                            <div class="book-stats-detailed">
                                <div class="stat-item">
                                    <span class="stat-icon">📖</span>
                                    <span class="stat-text">${book.chaptersCount || 0} глав</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-icon">⏱️</span>
                                    <span class="stat-text">${book.readingTime || '30 минут'}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-icon">📅</span>
                                    <span class="stat-text">${this.formatDate(book.publishedAt)}</span>
                                </div>
                            </div>
                            
                            <div class="book-price-detailed">
                                ${book.originalPrice && book.price < book.originalPrice ? `
                                    <div class="price-with-discount">
                                        <span class="original-price-large">${book.originalPrice}₽</span>
                                        <span class="current-price-large">${book.price}₽</span>
                                        <span class="discount-percent">-${Math.round((1 - book.price / book.originalPrice) * 100)}%</span>
                                    </div>
                                ` : `
                                    <div class="price-single">
                                        <span class="current-price-large">${book.price || 'Бесплатно'}</span>
                                    </div>
                                `}
                            </div>
                            
                            <div class="detail-actions-main">
                                <button class="detail-action-btn primary" id="buyBookBtn">
                                    ${book.price ? '💳 Купить сейчас' : '📖 Читать бесплатно'}
                                </button>
                                <button class="detail-action-btn secondary" id="previewBookBtn">
                                    👁️ Предпросмотр
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="book-description-full">
                        <h3>📝 Описание</h3>
                        <p>${book.description || 'Описание скоро появится'}</p>
                    </div>
                    
                    ${book.chapters && book.chapters.length > 0 ? `
                        <div class="book-chapters">
                            <h3>📚 Содержание</h3>
                            <div class="chapters-list">
                                ${book.chapters.slice(0, 5).map((chapter, index) => `
                                    <div class="chapter-item">
                                        <span class="chapter-number">${index + 1}</span>
                                        <span class="chapter-title">${chapter.title}</span>
                                        <span class="chapter-duration">${chapter.duration || '5 мин'}</span>
                                    </div>
                                `).join('')}
                                ${book.chapters.length > 5 ? `
                                    <div class="more-chapters">
                                        +${book.chapters.length - 5} глав
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${this.renderPromoCodeSection()}
                    ${this.renderRelatedBooks()}
                </div>
            </div>
        `;
    }
    
    /**
     * 🎁 Рендер секции промокода
     */
    renderPromoCodeSection() {
        const promoCode = this.getAvailablePromoCode();
        if (!promoCode) return '';
        
        return `
            <div class="promo-code-section">
                <div class="promo-header">
                    <span class="promo-icon">🎁</span>
                    <span class="promo-title">У вас есть скидка!</span>
                </div>
                <div class="promo-content">
                    <div class="promo-code-display">
                        <span class="promo-code-text">${promoCode.code}</span>
                        <button class="copy-promo-btn" onclick="this.copyPromoCode('${promoCode.code}')">📋</button>
                    </div>
                    <div class="promo-description">
                        ${promoCode.description} • Скидка ${promoCode.discount}%
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📚 Рендер похожих книг
     */
    renderRelatedBooks() {
        const related = this.getRelatedBooks();
        if (related.length === 0) return '';
        
        return `
            <div class="related-books-section">
                <h3>📚 Похожие разборы</h3>
                <div class="related-books-grid">
                    ${related.slice(0, 4).map(book => `
                        <div class="related-book-card" data-book-id="${book._id || book.id}">
                            <div class="related-book-cover">
                                ${book.coverImage ? 
                                    `<img src="${book.coverImage}" alt="${book.title}" loading="lazy">` :
                                    `<div class="cover-placeholder-small">📚</div>`
                                }
                            </div>
                            <div class="related-book-info">
                                <div class="related-book-title">${book.title}</div>
                                <div class="related-book-author">${book.author}</div>
                                <div class="related-book-price">${book.price || 'Бесплатно'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * ⏳ Рендер состояния загрузки
     */
    renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="loading-spinner">⏳</div>
                <div class="loading-text">Загружаем каталог...</div>
            </div>
        `;
    }
    
    /**
     * 📭 Рендер пустого состояния
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <div class="empty-title">
                    ${this.searchQuery ? 'Ничего не найдено' : 'Каталог пуст'}
                </div>
                <div class="empty-text">
                    ${this.searchQuery ? 
                        `По запросу "${this.searchQuery}" ничего не найдено` :
                        'Книги скоро появятся в каталоге'
                    }
                </div>
                ${this.searchQuery ? `
                    <button class="empty-action" onclick="this.clearSearch()">
                        🗑️ Очистить поиск
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * ⬇️ Рендер кнопки "Загрузить еще"
     */
    renderLoadMoreButton() {
        return `
            <button class="load-more-btn" id="loadMoreBtn">
                📚 Загрузить еще книги
            </button>
        `;
    }
    
    /**
     * 🎯 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Поиск и фильтры
        this.attachSearchListeners();
        
        // Действия с книгами
        this.attachBookActionListeners();
        
        // Рекомендации
        this.attachRecommendationListeners();
        
        // Детальная страница
        this.attachDetailListeners();
        
        // Загрузка еще
        this.attachLoadMoreListener();
    }
    
    /**
     * 🔍 Обработчики поиска
     */
    attachSearchListeners() {
        const searchInput = document.getElementById('catalogSearchInput');
        const searchBtn = document.getElementById('catalogSearchBtn');
        const categorySelect = document.getElementById('categorySelect');
        const sortSelect = document.getElementById('sortSelect');
        const viewToggleBtn = document.getElementById('viewToggleBtn');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }
        
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.changeCategory(e.target.value);
            });
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.changeSorting(e.target.value);
            });
        }
        
        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', () => this.toggleView());
        }
    }
    
    /**
     * 📚 Обработчики действий с книгами
     */
    attachBookActionListeners() {
        const bookActions = document.querySelectorAll('.book-action-btn[data-action], .action-btn-small[data-action]');
        bookActions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const bookId = btn.dataset.bookId;
                
                if (bookId) {
                    this.handleBookAction(action, bookId);
                }
            });
        });
        
        // Клики по карточкам книг для просмотра деталей
        const bookCards = document.querySelectorAll('.book-card, .book-list-item');
        bookCards.forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.bookId;
                if (bookId) {
                    this.viewBookDetail(bookId);
                }
            });
        });
    }
    
    /**
     * 💡 Обработчики рекомендаций
     */
    attachRecommendationListeners() {
        const recCards = document.querySelectorAll('.recommendation-card');
        recCards.forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.bookId;
                if (bookId) {
                    this.viewBookDetail(bookId);
                }
            });
        });
    }
    
    /**
     * 📄 Обработчики детальной страницы
     */
    attachDetailListeners() {
        const backBtn = document.getElementById('backToListBtn');
        const buyBtn = document.getElementById('buyBookBtn');
        const previewBtn = document.getElementById('previewBookBtn');
        const shareBtn = document.getElementById('shareBookBtn');
        const favoriteBtn = document.getElementById('favoriteBookBtn');
        
        if (backBtn) {
            backBtn.addEventListener('click', () => this.backToList());
        }
        
        if (buyBtn) {
            buyBtn.addEventListener('click', () => this.buyCurrentBook());
        }
        
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewCurrentBook());
        }
        
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareCurrentBook());
        }
        
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => this.toggleFavoriteBook());
        }
        
        // Похожие книги
        const relatedCards = document.querySelectorAll('.related-book-card');
        relatedCards.forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.bookId;
                if (bookId) {
                    this.viewBookDetail(bookId);
                }
            });
        });
    }
    
    /**
     * ⬇️ Обработчик загрузки еще
     */
    attachLoadMoreListener() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreBooks());
        }
    }
    
    /**
     * 🔍 Выполнение поиска
     */
    async performSearch() {
        this.telegram.hapticFeedback('light');
        await this.loadBooks(true);
        this.rerender();
    }
    
    /**
     * 🏷️ Смена категории
     */
    async changeCategory(categoryId) {
        this.selectedCategory = categoryId;
        this.telegram.hapticFeedback('light');
        
        await this.loadBooks(true);
        this.rerender();
    }
    
    /**
     * 📊 Смена сортировки
     */
    async changeSorting(sortBy) {
        this.sortBy = sortBy;
        this.telegram.hapticFeedback('light');
        
        await this.loadBooks(true);
        this.rerender();
    }
    
    /**
     * 📋 Переключение вида
     */
    toggleView() {
        this.activeView = this.activeView === 'grid' ? 'list' : 'grid';
        this.telegram.hapticFeedback('light');
        this.rerender();
    }
    
    /**
     * 📚 Обработка действий с книгами
     */
    handleBookAction(action, bookId) {
        this.telegram.hapticFeedback('light');
        
        switch (action) {
            case 'view':
                this.viewBookDetail(bookId);
                break;
            case 'buy':
                this.buyBook(bookId);
                break;
        }
    }
    
    /**
     * 👁️ Просмотр детальной информации о книге
     */
    async viewBookDetail(bookId) {
        try {
            this.telegram.hapticFeedback('medium');
            
            // Найти книгу в текущих данных или загрузить
            let book = this.books.find(b => (b._id || b.id) === bookId);
            
            if (!book) {
                // Загрузить детальную информацию
                book = await this.api.getBookDetails(bookId);
            }
            
            if (book) {
                this.selectedBook = book;
                this.activeView = 'detail';
                this.updateURL({ book: bookId });
                this.rerender();
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки деталей книги:', error);
            this.showError('Не удалось загрузить информацию о книге');
        }
    }
    
    /**
     * 💳 Покупка книги
     */
    buyBook(bookId) {
        const book = this.books.find(b => (b._id || b.id) === bookId) || this.selectedBook;
        if (!book) return;
        
        this.telegram.hapticFeedback('success');
        
        // Формируем URL для покупки с UTM параметрами
        const promoCode = this.getAvailablePromoCode();
        const utmParams = this.buildUTMParams(book, promoCode);
        const buyUrl = this.buildBuyURL(book, utmParams);
        
        // Открываем внешнюю ссылку
        this.telegram.openLink(buyUrl);
        
        // Трекинг покупки
        this.trackPurchaseIntent(book, promoCode);
    }
    
    /**
     * ← Возврат к списку
     */
    backToList() {
        this.activeView = 'grid';
        this.selectedBook = null;
        this.updateURL({});
        this.telegram.hapticFeedback('light');
        this.rerender();
    }
    
    /**
     * 💳 Покупка текущей книги
     */
    buyCurrentBook() {
        if (this.selectedBook) {
            this.buyBook(this.selectedBook._id || this.selectedBook.id);
        }
    }
    
    /**
     * 👁️ Предпросмотр книги
     */
    previewCurrentBook() {
        this.telegram.hapticFeedback('light');
        // Здесь можно показать превью или первую главу
        this.showSuccess('📖 Предпросмотр скоро будет доступен');
    }
    
    /**
     * 📤 Поделиться книгой
     */
    shareCurrentBook() {
        if (!this.selectedBook) return;
        
        this.telegram.hapticFeedback('medium');
        
        const shareText = `📚 Рекомендую разбор "${this.selectedBook.title}" от ${this.selectedBook.author}\n\n${this.selectedBook.description?.slice(0, 100) || 'Интересный разбор книги'}...\n\nПосмотреть в Reader Bot!`;
        
        if (this.telegram.isShareSupported()) {
            this.telegram.shareMessage(shareText);
        } else {
            navigator.clipboard.writeText(shareText);
            this.showSuccess('✅ Ссылка скопирована в буфер обмена');
        }
    }
    
    /**
     * 🤍 Переключение избранного
     */
    toggleFavoriteBook() {
        this.telegram.hapticFeedback('success');
        // Здесь будет логика добавления в избранное
        this.showSuccess('💖 Добавлено в избранное');
    }
    
    /**
     * ⬇️ Загрузка дополнительных книг
     */
    async loadMoreBooks() {
        if (!this.hasMore) return;
        
        this.currentPage++;
        await this.loadBooks();
        this.updateBooksContainer();
    }
    
    /**
     * 🧹 Вспомогательные методы
     */
    
    parseURLParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            book: params.get('book'),
            promo: params.get('promo'),
            category: params.get('category')
        };
    }
    
    updateURL(params) {
        const url = new URL(window.location);
        Object.keys(params).forEach(key => {
            if (params[key]) {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.replaceState({}, '', url);
    }
    
    renderStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return '⭐'.repeat(fullStars) + 
               (hasHalfStar ? '⭐' : '') + 
               '☆'.repeat(emptyStars);
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Недавно';
        return new Date(dateString).toLocaleDateString('ru-RU');
    }
    
    getAvailablePromoCode() {
        // Получаем промокод из состояния (например, из отчетов)
        const reports = this.state.get('reports');
        return reports?.current?.promoCode || null;
    }
    
    getRelatedBooks() {
        if (!this.selectedBook) return [];
        
        // Простой алгоритм поиска похожих книг по автору или теме
        return this.books.filter(book => 
            book.author === this.selectedBook.author ||
            book.category === this.selectedBook.category
        ).filter(book => 
            (book._id || book.id) !== (this.selectedBook._id || this.selectedBook.id)
        );
    }
    
    buildUTMParams(book, promoCode) {
        return {
            utm_source: 'telegram_mini_app',
            utm_medium: 'catalog',
            utm_campaign: 'book_purchase',
            utm_content: book._id || book.id,
            promo_code: promoCode?.code || null
        };
    }
    
    buildBuyURL(book, utmParams) {
        const baseURL = `https://annabusel.org/catalog/${book._id || book.id}`;
        const params = new URLSearchParams(utmParams);
        return `${baseURL}?${params.toString()}`;
    }
    
    trackPurchaseIntent(book, promoCode) {
        // Отправляем аналитику
        if (this.api.trackEvent) {
            this.api.trackEvent('purchase_intent', {
                book_id: book._id || book.id,
                book_title: book.title,
                book_price: book.price,
                promo_code: promoCode?.code || null,
                source: 'mini_app_catalog'
            });
        }
    }
    
    copyPromoCode(code) {
        navigator.clipboard.writeText(code);
        this.telegram.hapticFeedback('success');
        this.showSuccess('✅ Промокод скопирован!');
    }
    
    clearSearch() {
        this.searchQuery = '';
        const searchInput = document.getElementById('catalogSearchInput');
        if (searchInput) searchInput.value = '';
        this.performSearch();
    }
    
    showPromoBooks() {
        // Показать книги с промокодами
        this.sortBy = 'featured';
        this.selectedCategory = 'promo';
        this.loadBooks(true);
    }
    
    updateCatalogUI(catalog) {
        if (catalog.books) {
            this.books = catalog.books;
            this.updateBooksContainer();
        }
    }
    
    updatePersonalization(profile) {
        // Обновить персонализацию на основе профиля
        if (profile) {
            this.loadRecommendations();
        }
    }
    
    updateBooksContainer() {
        const container = document.getElementById('booksContainer');
        if (container) {
            container.innerHTML = this.books.map(book => 
                this.activeView === 'grid' ? 
                this.renderBookCard(book) : 
                this.renderBookListItem(book)
            ).join('');
            
            this.attachBookActionListeners();
        }
    }
    
    rerender() {
        const container = document.querySelector('.catalog-page');
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
    
    showError(message) {
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    /**
     * 🧹 Очистка при уничтожении
     */
    destroy() {
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
    }
}

// 📤 Экспорт класса
window.CatalogPage = CatalogPage;