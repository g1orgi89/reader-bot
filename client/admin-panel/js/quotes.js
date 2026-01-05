/**
 * JavaScript для управления цитатами в админ-панели "Читатель"
 * Адаптировано из Shrooms Support Bot
 */

/**
 * @typedef {Object} QuoteData
 * @property {string} id - ID цитаты
 * @property {string} text - Текст цитаты
 * @property {string|null} author - Автор цитаты
 * @property {string} category - Категория
 * @property {string} sentiment - Настроение (positive/neutral/negative)
 * @property {Object} user - Данные пользователя
 * @property {string} createdAt - Дата создания
 * @property {Array<string>} themes - Темы цитаты
 */

/**
 * Основной класс для управления цитатами
 */
class QuotesManager {
    constructor() {
        this.currentPage = 1;
        this.currentLimit = 20;
        this.filters = {
            period: '7d',
            category: 'all',
            author: 'all',
            search: ''
        };
        this.charts = {};
        this.isLoading = false;
        this.apiPrefix = '/api/reader'; // ИСПРАВЛЕНО: используем правильный API prefix
        
        this.init();
    }

    /**
     * Инициализация страницы цитат
     */
    async init() {
        console.log('📝 Инициализация QuotesManager');
        
        try {
            // Загрузка начальных данных
            await this.loadData();
            
            // Настройка обработчиков событий
            this.setupEventListeners();
            
            // Инициализация графиков
            this.initializeCharts();
            
            console.log('✅ QuotesManager успешно инициализирован');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации QuotesManager:', error);
            this.showNotification('error', 'Ошибка загрузки данных цитат');
        }
    }

    /**
     * Загрузка всех данных
     */
    async loadData() {
        this.setLoading(true);
        
        try {
            // Параллельная загрузка данных
            const [quotesData, statisticsData, analyticsData] = await Promise.all([
                this.fetchQuotes(),
                this.fetchStatistics(),
                this.fetchAnalytics()
            ]);

            // Обновляем интерфейс
            this.updateQuotesTable(quotesData);
            this.updateStatistics(statisticsData);
            this.updateCharts(analyticsData);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Получение списка цитат с сервера
     * @returns {Promise<Object>} Данные цитат
     */
    async fetchQuotes() {
        const params = new URLSearchParams({
            page: this.currentPage,
            limit: this.currentLimit,
            ...this.filters
        });

        const response = await fetch(`${this.apiPrefix}/quotes?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Ошибка получения цитат');
        }

        return data.data;
    }

    /**
     * Получение статистики цитат
     * @returns {Promise<Object>} Статистика
     */
    async fetchStatistics() {
        const response = await fetch(`${this.apiPrefix}/quotes/statistics?period=${this.filters.period}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Ошибка получения статистики');
        }

        return data.data;
    }

    /**
     * Получение аналитических данных
     * @returns {Promise<Object>} Аналитика
     */
    async fetchAnalytics() {
        const response = await fetch(`${this.apiPrefix}/quotes/analytics?period=${this.filters.period}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Ошибка получения аналитики');
        }

        return data.data;
    }

    /**
     * Обновление таблицы цитат
     * @param {Object} quotesData - Данные цитат
     */
    updateQuotesTable(quotesData) {
        const tbody = document.querySelector('#quotes-table tbody');
        if (!tbody) return;

        if (!quotesData.quotes || quotesData.quotes.length === 0) {
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="8">📖 Цитаты не найдены</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = quotesData.quotes.map(quote => {
            const shortText = this.truncateText(quote.text, 60);
            const authorDisplay = quote.author ? 
                `<span class="author-name">${quote.author}</span>` : 
                '<span class="no-author">Без автора</span>';
            
            const sentimentBadge = this.getSentimentBadge(quote.sentiment);
            const categoryBadge = this.getCategoryBadge(quote.category);
            const timeAgo = this.getTimeAgo(quote.createdAt);

            return `
                <tr class="quote-row" data-quote-id="${quote.id}" onclick="quotesManager.viewQuote('${quote.id}')">
                    <td class="col-id">${quote.id}</td>
                    <td class="col-quote">
                        <div class="quote-text" title="${this.escapeHtml(quote.text)}">
                            "${shortText}"
                        </div>
                        ${quote.themes && quote.themes.length > 0 ? 
                            `<div class="quote-themes">${quote.themes.slice(0, 2).map(theme => 
                                `<span class="theme-tag">${theme}</span>`
                            ).join('')}</div>` : ''
                        }
                    </td>
                    <td class="col-author">${authorDisplay}</td>
                    <td class="col-category">${categoryBadge}</td>
                    <td class="col-user">
                        <div class="user-info">
                            <span class="user-name">${quote.user.name}</span>
                            <span class="user-username">${quote.user.username}</span>
                        </div>
                    </td>
                    <td class="col-sentiment">${sentimentBadge}</td>
                    <td class="col-date">
                        <div class="date-info">
                            <span class="time-ago">${timeAgo}</span>
                            <span class="full-date">${this.formatDate(quote.createdAt)}</span>
                        </div>
                    </td>
                    <td class="col-actions">
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); quotesManager.viewQuote('${quote.id}')" title="Просмотр">
                                👁️
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); quotesManager.editQuote('${quote.id}')" title="Редактировать">
                                ✏️
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); quotesManager.analyzeQuote('${quote.id}')" title="AI анализ">
                                🔍
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); quotesManager.deleteQuote('${quote.id}')" title="Удалить">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Обновляем пагинацию
        this.updatePagination(quotesData.pagination);
    }

    /**
     * Обновление статистических карточек
     * @param {Object} statistics - Статистика
     */
    updateStatistics(statistics) {
        const elements = {
            'total-quotes-stat': statistics.totalQuotes?.toLocaleString() || '—',
            'active-authors-stat': statistics.totalAuthors?.toLocaleString() || '—',
            'popular-category-stat': statistics.popularCategory || '—',
            'daily-average-stat': statistics.dailyAverage?.toFixed(1) || '—'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Обновляем изменения
        if (statistics.changeStats) {
            this.updateStatChanges(statistics.changeStats);
        }
    }

    /**
     * Обновление графиков
     * @param {Object} analytics - Аналитические данные
     */
    updateCharts(analytics) {
        if (analytics.categories) {
            this.updateCategoriesChart(analytics.categories);
        }
        
        if (analytics.timeline) {
            this.updateTimelineChart(analytics.timeline);
        }
        
        if (analytics.topAuthors) {
            this.updateTopAuthorsList(analytics.topAuthors);
        }
    }

    /**
     * Инициализация графиков
     */
    initializeCharts() {
        // График категорий
        const categoriesCtx = document.getElementById('categoriesChart');
        if (categoriesCtx) {
            this.charts.categories = new Chart(categoriesCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: []
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                }
            });
        }

        // График временной динамики
        const timelineCtx = document.getElementById('quotesTimelineChart');
        if (timelineCtx) {
            this.charts.timeline = new Chart(timelineCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Цитаты',
                        data: [],
                        borderColor: '#d4af37',
                        backgroundColor: 'rgba(212, 175, 55, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Обновление графика категорий
     * @param {Object} categoriesData - Данные категорий
     */
    updateCategoriesChart(categoriesData) {
        if (!this.charts.categories || !categoriesData) return;

        this.charts.categories.data.labels = categoriesData.labels;
        this.charts.categories.data.datasets[0].data = categoriesData.data;
        this.charts.categories.data.datasets[0].backgroundColor = categoriesData.colors;
        this.charts.categories.update();
    }

    /**
     * Обновление графика временной динамики
     * @param {Object} timelineData - Данные временной динамики
     */
    updateTimelineChart(timelineData) {
        if (!this.charts.timeline || !timelineData) return;

        this.charts.timeline.data.labels = timelineData.labels;
        this.charts.timeline.data.datasets[0].data = timelineData.data;
        this.charts.timeline.update();
    }

    /**
     * Обновление списка топ авторов
     * @param {Array} topAuthors - Топ авторы
     */
    updateTopAuthorsList(topAuthors) {
        const container = document.getElementById('top-authors-list');
        if (!container || !topAuthors) return;

        container.innerHTML = topAuthors.map((author, index) => `
            <div class="top-author-item">
                <span class="rank">${index + 1}</span>
                <div class="author-info">
                    <span class="name">${author.name}</span>
                    <span class="percentage">${author.percentage}%</span>
                </div>
                <span class="count">${author.count}</span>
            </div>
        `).join('');
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Фильтры
        const periodFilter = document.getElementById('period-filter');
        const categoryFilter = document.getElementById('category-filter');
        const authorFilter = document.getElementById('author-filter');
        const searchInput = document.getElementById('search-quotes');

        if (periodFilter) {
            periodFilter.addEventListener('change', (e) => {
                this.filters.period = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.filters.category = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        if (authorFilter) {
            authorFilter.addEventListener('change', (e) => {
                this.filters.author = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadData();
                }, 500); // Debounce поиска
            });
        }

        // Экспорт
        const exportBtn = document.getElementById('export-quotes');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportQuotes());
        }

        // Пагинация
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousPage());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }

        // Закрытие модального окна
        const closeBtn = document.getElementById('close-quote-details');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Клик вне модального окна
        const overlay = document.getElementById('quote-details-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal();
                }
            });
        }
    }

    /**
     * Просмотр детальной информации о цитате
     * @param {string} quoteId - ID цитаты
     */
    async viewQuote(quoteId) {
        try {
            console.log('📝 Просмотр цитаты:', quoteId);

            const modal = document.getElementById('quote-details-overlay');
            const content = document.getElementById('quote-details-content');
            const title = document.getElementById('quote-details-title');

            if (!modal || !content) return;

            // Показываем модальное окно с загрузкой
            title.textContent = `📝 Цитата ${quoteId}`;
            content.innerHTML = '<div class="loading">📖 Загрузка деталей...</div>';
            modal.style.display = 'flex';

            // Загружаем детальную информацию
            const response = await fetch(`${this.apiPrefix}/quotes/${quoteId}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки информации о цитате');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Ошибка получения данных');
            }

            // Отображаем детальную информацию
            this.renderQuoteDetails(data.data);

        } catch (error) {
            console.error('❌ Ошибка просмотра цитаты:', error);
            this.showNotification('error', error.message);
            this.closeModal();
        }
    }

    /**
     * Отображение детальной информации о цитате
     * @param {Object} quote - Данные цитаты
     */
    renderQuoteDetails(quote) {
        const content = document.getElementById('quote-details-content');
        if (!content) return;

        content.innerHTML = `
            <div class="quote-profile">
                <div class="quote-main">
                    <div class="quote-text-full">
                        "${quote.text}"
                    </div>
                    ${quote.author ? 
                        `<div class="quote-author">— ${quote.author}</div>` : 
                        '<div class="quote-author no-author">Автор неизвестен</div>'
                    }
                    ${quote.source ? 
                        `<div class="quote-source">Источник: ${quote.source}</div>` : ''
                    }
                </div>
                
                <div class="quote-meta">
                    <div class="meta-section">
                        <h4>📊 Анализ</h4>
                        <div class="meta-data">
                            <div class="meta-item">
                                <label>Категория:</label>
                                ${this.getCategoryBadge(quote.category)}
                            </div>
                            <div class="meta-item">
                                <label>Настроение:</label>
                                ${this.getSentimentBadge(quote.sentiment)}
                            </div>
                            ${quote.themes && quote.themes.length > 0 ? `
                                <div class="meta-item">
                                    <label>Темы:</label>
                                    <div class="themes-list">
                                        ${quote.themes.map(theme => 
                                            `<span class="theme-tag">${theme}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            ${quote.meta ? `
                                <div class="meta-item">
                                    <label>Статистика:</label>
                                    <span>${quote.meta.wordCount} слов, ${quote.meta.characterCount} символов</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="meta-section">
                        <h4>👤 Пользователь</h4>
                        <div class="meta-data">
                            <div class="meta-item">
                                <label>Имя:</label>
                                <span>${quote.user.name}</span>
                            </div>
                            <div class="meta-item">
                                <label>Telegram:</label>
                                <span>${quote.user.telegramUsername}</span>
                            </div>
                            <div class="meta-item">
                                <label>Email:</label>
                                <span>${quote.user.email}</span>
                            </div>
                            <div class="meta-item">
                                <label>Дата отправки:</label>
                                <span>${this.formatFullDate(quote.meta.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${quote.aiAnalysis ? `
                        <div class="meta-section">
                            <h4>🤖 AI Анализ</h4>
                            <div class="ai-analysis">
                                <p><strong>Инсайты:</strong> ${quote.aiAnalysis.insights}</p>
                                ${quote.aiAnalysis.recommendation ? 
                                    `<p><strong>Рекомендация:</strong> ${quote.aiAnalysis.recommendation}</p>` : ''
                                }
                                <div class="confidence-score">
                                    <label>Уверенность анализа:</label>
                                    <span class="confidence-badge">${Math.round(quote.aiAnalysis.confidence * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="quote-actions">
                    <button class="btn btn-primary" onclick="quotesManager.addToKnowledgeBase('${quote.id}')">
                        📚 Добавить в базу знаний
                    </button>
                    <button class="btn btn-secondary" onclick="quotesManager.findSimilarQuotes('${quote.id}')">
                        🔍 Похожие цитаты
                    </button>
                    <button class="btn btn-secondary" onclick="quotesManager.editQuote('${quote.id}')">
                        ✏️ Редактировать
                    </button>
                    <button class="btn btn-danger" onclick="quotesManager.deleteQuote('${quote.id}')">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Редактирование цитаты
     * @param {string} quoteId - ID цитаты
     */
    async editQuote(quoteId) {
        console.log('✏️ Редактирование цитаты:', quoteId);
        this.showNotification('info', `Функция редактирования будет добавлена в следующей версии`);
    }

    /**
     * AI анализ цитаты
     * @param {string} quoteId - ID цитаты
     */
    async analyzeQuote(quoteId) {
        try {
            console.log('🤖 Запуск AI анализа цитаты:', quoteId);

            const response = await fetch(`${this.apiPrefix}/quotes/${quoteId}/analyze`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Ошибка запуска анализа');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Ошибка анализа');
            }

            this.showNotification('success', `AI анализ цитаты ${quoteId} запущен`);

        } catch (error) {
            console.error('❌ Ошибка AI анализа:', error);
            this.showNotification('error', error.message);
        }
    }

    /**
     * Удаление цитаты
     * @param {string} quoteId - ID цитаты
     */
    async deleteQuote(quoteId) {
        if (!confirm(`Вы уверены, что хотите удалить цитату ${quoteId}?`)) {
            return;
        }

        try {
            console.log('🗑️ Удаление цитаты:', quoteId);

            const response = await fetch(`${this.apiPrefix}/quotes/${quoteId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: 'Удалено администратором'
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка удаления цитаты');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Ошибка удаления');
            }

            this.showNotification('success', `Цитата ${quoteId} успешно удалена`);
            this.loadData(); // Перезагружаем данные

        } catch (error) {
            console.error('❌ Ошибка удаления цитаты:', error);
            this.showNotification('error', error.message);
        }
    }

    /**
     * Экспорт цитат
     */
    async exportQuotes() {
        try {
            console.log('📊 Экспорт цитат');

            const response = await fetch(`${this.apiPrefix}/quotes/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    format: 'csv',
                    ...this.filters
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка экспорта');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Ошибка экспорта');
            }

            this.showNotification('success', `Экспорт запущен: ${data.data.filename}`);

        } catch (error) {
            console.error('❌ Ошибка экспорта:', error);
            this.showNotification('error', error.message);
        }
    }

    /**
     * Поиск похожих цитат
     * @param {string} quoteId - ID цитаты
     */
    async findSimilarQuotes(quoteId) {
        try {
            console.log('🔍 Поиск похожих цитат для:', quoteId);

            const response = await fetch(`${this.apiPrefix}/quotes/search/similar/${quoteId}`);

            if (!response.ok) {
                throw new Error('Ошибка поиска');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Ошибка поиска');
            }

            // Показываем результаты в уведомлении
            const count = data.data.similarQuotes.length;
            this.showNotification('info', `Найдено ${count} похожих цитат`);

        } catch (error) {
            console.error('❌ Ошибка поиска похожих цитат:', error);
            this.showNotification('error', error.message);
        }
    }

    /**
     * Добавление цитаты в базу знаний
     * @param {string} quoteId - ID цитаты
     */
    async addToKnowledgeBase(quoteId) {
        console.log('📚 Добавление в базу знаний:', quoteId);
        this.showNotification('info', 'Функция будет добавлена в следующей версии');
    }

    // ==================== ПАГИНАЦИЯ ====================

    /**
     * Обновление пагинации
     * @param {Object} pagination - Данные пагинации
     */
    updatePagination(pagination) {
        if (!pagination) return;

        // Обновляем информацию о записях
        const rangeElement = document.getElementById('pagination-range');
        const totalElement = document.getElementById('pagination-total');
        const currentElement = document.getElementById('pagination-current');

        if (rangeElement) {
            const start = (pagination.currentPage - 1) * this.currentLimit + 1;
            const end = Math.min(pagination.currentPage * this.currentLimit, pagination.totalCount);
            rangeElement.textContent = `${start}-${end}`;
        }

        if (totalElement) {
            totalElement.textContent = pagination.totalCount.toLocaleString();
        }

        if (currentElement) {
            currentElement.textContent = `Страница ${pagination.currentPage} из ${pagination.totalPages}`;
        }

        // Обновляем кнопки
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) {
            prevBtn.disabled = !pagination.hasPrev;
        }

        if (nextBtn) {
            nextBtn.disabled = !pagination.hasNext;
        }
    }

    /**
     * Переход к предыдущей странице
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadData();
        }
    }

    /**
     * Переход к следующей странице
     */
    nextPage() {
        this.currentPage++;
        this.loadData();
    }

    // ==================== УТИЛИТЫ ====================

    /**
     * Установка состояния загрузки
     * @param {boolean} loading - Состояние загрузки
     */
    setLoading(loading) {
        this.isLoading = loading;
        
        const tbody = document.querySelector('#quotes-table tbody');
        if (tbody && loading) {
            tbody.innerHTML = `
                <tr class="table-loading">
                    <td colspan="8">📖 Загрузка цитат...</td>
                </tr>
            `;
        }
    }

    /**
     * Получение значка настроения
     * @param {string} sentiment - Настроение
     * @returns {string} HTML значка
     */
    getSentimentBadge(sentiment) {
        const sentimentMap = {
            'positive': '<span class="sentiment-badge sentiment-positive">😊 Позитивный</span>',
            'neutral': '<span class="sentiment-badge sentiment-neutral">😐 Нейтральный</span>',
            'negative': '<span class="sentiment-badge sentiment-negative">😔 Негативный</span>'
        };
        return sentimentMap[sentiment] || '<span class="sentiment-badge sentiment-neutral">❓ Неопределен</span>';
    }

    /**
     * Получение значка категории
     * @param {string} category - Категория
     * @returns {string} HTML значка
     */
    getCategoryBadge(category) {
        const categoryMap = {
            'Саморазвитие': '🌱',
            'Любовь': '💕',
            'Мудрость': '🧠',
            'Философия': '🤔',
            'Творчество': '🎨',
            'Мотивация': '⚡',
            'Отношения': '👥'
        };
        
        const icon = categoryMap[category] || '📝';
        return `<span class="category-badge">${icon} ${category}</span>`;
    }

    /**
     * Обрезка текста
     * @param {string} text - Текст
     * @param {number} maxLength - Максимальная длина
     * @returns {string} Обрезанный текст
     */
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Экранирование HTML
     * @param {string} text - Текст
     * @returns {string} Экранированный текст
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Форматирование времени "назад"
     * @param {string} dateString - Дата в ISO формате
     * @returns {string} Относительное время
     */
    getTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) return 'Только что';
        if (diffHours < 24) return `${diffHours} ч назад`;
        if (diffDays < 7) return `${diffDays} дн назад`;
        return this.formatDate(dateString);
    }

    /**
     * Форматирование даты
     * @param {string} dateString - Дата в ISO формате
     * @returns {string} Отформатированная дата
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Полное форматирование даты и времени
     * @param {string} dateString - Дата в ISO формате
     * @returns {string} Полная дата и время
     */
    formatFullDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Закрытие модального окна
     */
    closeModal() {
        const modal = document.getElementById('quote-details-overlay');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Показ уведомления
     * @param {string} type - Тип уведомления
     * @param {string} message - Сообщение
     */
    showNotification(type, message) {
        const container = document.getElementById('notification-container');
        if (!container) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '📝'}</span>
                <span class="notification-message">${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(notification);

        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * Обновление изменений статистики
     * @param {Object} changeStats - Статистика изменений
     */
    updateStatChanges(changeStats) {
        const elements = {
            'quotes-change': changeStats.quotesChange,
            'authors-change': changeStats.authorsChange, 
            'avg-change': changeStats.avgChange
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value) {
                element.textContent = value;
                element.className = value.startsWith('+') ? 'stat-change positive' : 
                                   value.startsWith('-') ? 'stat-change negative' : 
                                   'stat-change neutral';
            }
        });
    }
}

// Глобальная переменная для доступа к менеджеру цитат
let quotesManager;

/**
 * Инициализация страницы цитат
 */
function initQuotesPage() {
    console.log('📝 Инициализация страницы цитат');
    quotesManager = new QuotesManager();
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuotesManager };
}