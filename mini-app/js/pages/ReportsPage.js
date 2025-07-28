/**
 * 📊 ОТЧЕТЫ - ReportsPage.js
 * 
 * Функциональность:
 * - Еженедельные отчеты с детальной статистикой
 * - Месячные углубленные отчеты  
 * - AI анализ от Анны Бусел
 * - Персональные рекомендации книг
 * - Промокоды и специальные предложения
 * - История всех отчетов с фильтрами
 * - Экспорт отчетов и поделиться
 * 
 * @version 1.0.1 - ИСПРАВЛЕНА ОШИБКА TELEGRAM SHARE
 */

class ReportsPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние страницы
        this.activeTab = 'current'; // current, history, insights
        this.currentPeriod = 'weekly'; // weekly, monthly
        this.selectedReportId = null;
        
        // Данные
        this.currentReport = null;
        this.reportHistory = [];
        this.loading = false;
        
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
    }
    
    /**
     * 📡 Настройка подписок
     */
    setupSubscriptions() {
        // Подписка на изменения отчетов
        const reportsSubscription = this.state.subscribe('reports', (reports) => {
            this.updateReportsUI(reports);
        });
        
        // Подписка на изменения статистики
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.updateStatsUI(stats);
        });
        
        this.subscriptions.push(reportsSubscription, statsSubscription);
    }
    
    /**
     * 📊 Загрузка начальных данных
     */
    async loadInitialData() {
        try {
            this.loading = true;
            this.state.set('reports.loading', true);
            
            // Параллельная загрузка данных
            const [currentReport, reportHistory] = await Promise.all([
                this.loadCurrentReport(),
                this.loadReportHistory()
            ]);
            
            this.currentReport = currentReport;
            this.reportHistory = reportHistory;
            
            // Обновление состояния
            this.state.update('reports', {
                current: currentReport,
                weekly: reportHistory.filter(r => r.type === 'weekly'),
                monthly: reportHistory.filter(r => r.type === 'monthly'),
                loading: false
            });
            
        } catch (error) {
            console.error('❌ Ошибка загрузки отчетов:', error);
            this.showError('Не удалось загрузить отчеты');
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 📈 Загрузка текущего отчета
     */
    async loadCurrentReport() {
        try {
            const reportType = this.currentPeriod;
            const report = await this.api.getReport(reportType, 'current');
            return report;
        } catch (error) {
            console.error('❌ Ошибка загрузки текущего отчета:', error);
            return null;
        }
    }
    
    /**
     * 📚 Загрузка истории отчетов
     */
    async loadReportHistory() {
        try {
            const [weeklyReports, monthlyReports] = await Promise.all([
                this.api.getReports('weekly', { limit: 10 }),
                this.api.getReports('monthly', { limit: 6 })
            ]);
            
            return [...weeklyReports, ...monthlyReports].sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            );
        } catch (error) {
            console.error('❌ Ошибка загрузки истории отчетов:', error);
            return [];
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки
     */
    render() {
        return `
            <div class="reports-page">
                <div class="page-header">📊 Отчеты и анализ</div>
                <div class="content">
                    ${this.renderPeriodSelector()}
                    ${this.renderTabs()}
                    ${this.renderTabContent()}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔄 Рендер селектора периода
     */
    renderPeriodSelector() {
        return `
            <div class="period-selector">
                <button class="period-btn ${this.currentPeriod === 'weekly' ? 'active' : ''}" 
                        data-period="weekly">
                    📅 Неделя
                </button>
                <button class="period-btn ${this.currentPeriod === 'monthly' ? 'active' : ''}" 
                        data-period="monthly">
                    🗓️ Месяц
                </button>
            </div>
        `;
    }
    
    /**
     * 📑 Рендер табов
     */
    renderTabs() {
        return `
            <div class="tabs">
                <button class="tab ${this.activeTab === 'current' ? 'active' : ''}" 
                        data-tab="current">📊 Текущий</button>
                <button class="tab ${this.activeTab === 'history' ? 'active' : ''}" 
                        data-tab="history">📚 История</button>
                <button class="tab ${this.activeTab === 'insights' ? 'active' : ''}" 
                        data-tab="insights">💡 Инсайты</button>
            </div>
        `;
    }
    
    /**
     * 📄 Рендер содержимого активного таба
     */
    renderTabContent() {
        if (this.loading) {
            return this.renderLoadingState();
        }
        
        switch (this.activeTab) {
            case 'current':
                return this.renderCurrentReportTab();
            case 'history':
                return this.renderHistoryTab();
            case 'insights':
                return this.renderInsightsTab();
            default:
                return this.renderCurrentReportTab();
        }
    }
    
    /**
     * ⏳ Рендер состояния загрузки
     */
    renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="loading-spinner">⏳</div>
                <div class="loading-text">Загружаем ваши отчеты...</div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер таба текущего отчета
     */
    renderCurrentReportTab() {
        if (!this.currentReport) {
            return this.renderEmptyReport();
        }
        
        return `
            <div class="tab-content current-report-tab">
                ${this.renderReportHeader(this.currentReport)}
                ${this.renderStatistics(this.currentReport.statistics)}
                ${this.renderAIAnalysis(this.currentReport.aiAnalysis)}
                ${this.renderRecommendations(this.currentReport.recommendations)}
                ${this.renderPromoSection(this.currentReport.promoCode)}
            </div>
        `;
    }
    
    /**
     * 📋 Рендер заголовка отчета
     */
    renderReportHeader(report) {
        const periodText = this.currentPeriod === 'weekly' ? 'за неделю' : 'за месяц';
        const dateRange = this.formatDateRange(report.dateRange);
        
        return `
            <div class="report-header">
                <div class="report-title">
                    <h2>📈 Ваш отчет ${periodText}</h2>
                    <p class="report-period">${dateRange}</p>
                </div>
                <div class="report-actions">
                    <button class="action-btn share-btn" id="shareReportBtn">
                        📤 Поделиться
                    </button>
                    <button class="action-btn export-btn" id="exportReportBtn">
                        💾 Экспорт
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер статистики
     */
    renderStatistics(stats) {
        if (!stats) return '';
        
        const goalProgress = this.calculateGoalProgress(stats);
        
        return `
            <div class="statistics-section">
                <div class="stats-grid">
                    <div class="stat-card primary">
                        <div class="stat-number">${stats.quotesCount || 0}</div>
                        <div class="stat-label">Цитат</div>
                        <div class="stat-change ${this.getChangeClass(stats.quotesChange)}">
                            ${this.formatChange(stats.quotesChange)}
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-number">${stats.uniqueAuthors || 0}</div>
                        <div class="stat-label">Авторов</div>
                        <div class="stat-change ${this.getChangeClass(stats.authorsChange)}">
                            ${this.formatChange(stats.authorsChange)}
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-number">${stats.activeDays || 0}</div>
                        <div class="stat-label">Активных дней</div>
                        <div class="stat-progress">
                            ${this.renderProgressBar(stats.activeDays, 7)}
                        </div>
                    </div>
                    
                    <div class="stat-card goal">
                        <div class="stat-number">${goalProgress}%</div>
                        <div class="stat-label">Цель</div>
                        <div class="goal-status ${goalProgress >= 100 ? 'completed' : ''}">
                            ${goalProgress >= 100 ? '🎉 Выполнено!' : '📈 В процессе'}
                        </div>
                    </div>
                </div>
                
                ${this.renderTopCategories(stats.topCategories)}
                ${this.renderReadingPatterns(stats.readingPatterns)}
            </div>
        `;
    }
    
    /**
     * 📚 Рендер топ категорий
     */
    renderTopCategories(categories) {
        if (!categories || categories.length === 0) return '';
        
        return `
            <div class="top-categories">
                <h3 class="section-title">🏷️ Популярные темы</h3>
                <div class="categories-list">
                    ${categories.slice(0, 5).map((category, index) => `
                        <div class="category-item">
                            <div class="category-rank">${index + 1}</div>
                            <div class="category-name">${category.name}</div>
                            <div class="category-count">${category.count} цитат</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 📖 Рендер паттернов чтения
     */
    renderReadingPatterns(patterns) {
        if (!patterns) return '';
        
        return `
            <div class="reading-patterns">
                <h3 class="section-title">⏰ Паттерны активности</h3>
                <div class="patterns-info">
                    <div class="pattern-item">
                        <span class="pattern-label">Любимое время:</span>
                        <span class="pattern-value">${patterns.favoriteTime || 'Вечер'}</span>
                    </div>
                    <div class="pattern-item">
                        <span class="pattern-label">Средняя длина цитаты:</span>
                        <span class="pattern-value">${patterns.averageLength || 0} символов</span>
                    </div>
                    <div class="pattern-item">
                        <span class="pattern-label">Самый продуктивный день:</span>
                        <span class="pattern-value">${patterns.mostActiveDay || 'Воскресенье'}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🤖 Рендер AI анализа
     */
    renderAIAnalysis(analysis) {
        if (!analysis) return '';
        
        return `
            <div class="ai-analysis">
                <div class="ai-header">
                    <div class="ai-title">
                        <span class="ai-icon">✨</span>
                        <span>Анализ от Анны</span>
                    </div>
                    <div class="ai-avatar">👩‍🎓</div>
                </div>
                
                <div class="ai-content">
                    <div class="ai-summary">
                        <h4>💡 Основные выводы</h4>
                        <p>${analysis.summary || 'Анализ не доступен'}</p>
                    </div>
                    
                    ${analysis.insights ? `
                        <div class="ai-insights">
                            <h4>🔍 Глубокий анализ</h4>
                            <ul class="insights-list">
                                ${analysis.insights.map(insight => 
                                    `<li class="insight-item">${insight}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${analysis.mood ? `
                        <div class="mood-analysis">
                            <h4>🎭 Эмоциональный фон</h4>
                            <div class="mood-indicator ${analysis.mood.type}">
                                <span class="mood-emoji">${analysis.mood.emoji}</span>
                                <span class="mood-text">${analysis.mood.description}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * 📚 Рендер рекомендаций
     */
    renderRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) return '';
        
        return `
            <div class="recommendations-section">
                <div class="recommendations-header">
                    <h3 class="section-title">🎯 Рекомендации от Анны</h3>
                    <p class="section-subtitle">На основе ваших интересов и анализа цитат</p>
                </div>
                
                <div class="recommendations-list">
                    ${recommendations.slice(0, 3).map(book => this.renderBookRecommendation(book)).join('')}
                </div>
                
                <button class="view-all-btn" id="viewAllRecommendationsBtn">
                    📚 Смотреть все рекомендации
                </button>
            </div>
        `;
    }
    
    /**
     * 📖 Рендер рекомендации книги
     */
    renderBookRecommendation(book) {
        return `
            <div class="book-recommendation" data-book-id="${book._id || book.id}">
                <div class="book-cover">
                    ${book.coverImage ? 
                        `<img src="${book.coverImage}" alt="${book.title}" loading="lazy">` :
                        `<div class="book-placeholder">📚</div>`
                    }
                </div>
                
                <div class="book-info">
                    <h4 class="book-title">${book.title}</h4>
                    <p class="book-author">${book.author}</p>
                    <p class="book-reason">${book.recommendationReason || 'Подходит вашим интересам'}</p>
                    
                    <div class="book-meta">
                        <span class="book-rating">⭐ ${book.rating || '4.5'}</span>
                        <span class="book-price">${book.price || 'Бесплатно'}</span>
                    </div>
                </div>
                
                <div class="book-actions">
                    <button class="book-action-btn primary" data-action="view">
                        👁️ Подробнее
                    </button>
                    <button class="book-action-btn secondary" data-action="buy">
                        💳 Купить
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎁 Рендер промо секции
     */
    renderPromoSection(promoCode) {
        if (!promoCode) return '';
        
        return `
            <div class="promo-section">
                <div class="promo-header">
                    <div class="promo-icon">🎁</div>
                    <div class="promo-title">Специально для вас</div>
                </div>
                
                <div class="promo-content">
                    <div class="promo-description">${promoCode.description || 'Персональная скидка на разборы'}</div>
                    
                    <div class="promo-code-block">
                        <div class="promo-label">Промокод:</div>
                        <div class="promo-code" id="promoCodeText">${promoCode.code}</div>
                        <button class="copy-code-btn" id="copyCodeBtn">📋</button>
                    </div>
                    
                    <div class="promo-details">
                        <div class="promo-discount">${promoCode.discount || '20'}% скидка</div>
                        <div class="promo-expires">До ${this.formatDate(promoCode.expiresAt)}</div>
                    </div>
                    
                    <button class="promo-cta-btn" id="usePromoBtn">
                        🛒 Использовать промокод
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 📚 Рендер таба истории
     */
    renderHistoryTab() {
        const reports = this.reportHistory.filter(r => 
            this.currentPeriod === 'all' || r.type === this.currentPeriod
        );
        
        if (reports.length === 0) {
            return this.renderEmptyHistory();
        }
        
        return `
            <div class="tab-content history-tab">
                <div class="history-filters">
                    <select class="period-filter" id="historyPeriodFilter">
                        <option value="all">Все отчеты</option>
                        <option value="weekly" ${this.currentPeriod === 'weekly' ? 'selected' : ''}>Еженедельные</option>
                        <option value="monthly" ${this.currentPeriod === 'monthly' ? 'selected' : ''}>Месячные</option>
                    </select>
                </div>
                
                <div class="reports-list">
                    ${reports.map(report => this.renderHistoryItem(report)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 📄 Рендер элемента истории
     */
    renderHistoryItem(report) {
        const date = this.formatDate(report.createdAt);
        const periodText = report.type === 'weekly' ? 'Неделя' : 'Месяц';
        
        return `
            <div class="history-item" data-report-id="${report._id}">
                <div class="history-header">
                    <div class="history-title">
                        <span class="history-type">${periodText}</span>
                        <span class="history-date">${date}</span>
                    </div>
                    <div class="history-stats">
                        <span class="stat-badge">${report.statistics?.quotesCount || 0} цитат</span>
                    </div>
                </div>
                
                <div class="history-preview">
                    ${report.aiAnalysis?.summary ? 
                        `<p class="preview-text">${report.aiAnalysis.summary.slice(0, 120)}...</p>` :
                        '<p class="preview-text">Отчет готов к просмотру</p>'
                    }
                </div>
                
                <div class="history-actions">
                    <button class="history-action-btn" data-action="view">
                        👁️ Просмотреть
                    </button>
                    <button class="history-action-btn" data-action="share">
                        📤 Поделиться
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 💡 Рендер таба инсайтов
     */
    renderInsightsTab() {
        return `
            <div class="tab-content insights-tab">
                <div class="insights-header">
                    <h2>💡 Персональные инсайты</h2>
                    <p>Долгосрочные тенденции и паттерны вашего чтения</p>
                </div>
                
                ${this.renderProgressChart()}
                ${this.renderReadingTrends()}
                ${this.renderPersonalGrowth()}
                ${this.renderGoalTracking()}
            </div>
        `;
    }
    
    /**
     * 📈 Рендер графика прогресса
     */
    renderProgressChart() {
        return `
            <div class="progress-chart-section">
                <h3 class="section-title">📈 Динамика активности</h3>
                <div class="chart-placeholder">
                    <div class="chart-info">
                        📊 График активности будет доступен после накопления данных
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📖 Рендер трендов чтения
     */
    renderReadingTrends() {
        return `
            <div class="reading-trends-section">
                <h3 class="section-title">📖 Тренды чтения</h3>
                <div class="trends-grid">
                    <div class="trend-card">
                        <div class="trend-title">🕒 Время чтения</div>
                        <div class="trend-value">Вечером</div>
                        <div class="trend-change">+15% к прошлому месяцу</div>
                    </div>
                    
                    <div class="trend-card">
                        <div class="trend-title">📚 Любимый жанр</div>
                        <div class="trend-value">Психология</div>
                        <div class="trend-change">40% всех цитат</div>
                    </div>
                    
                    <div class="trend-card">
                        <div class="trend-title">✍️ Средняя длина</div>
                        <div class="trend-value">85 символов</div>
                        <div class="trend-change">Оптимально для запоминания</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🌱 Рендер личностного роста
     */
    renderPersonalGrowth() {
        return `
            <div class="personal-growth-section">
                <h3 class="section-title">🌱 Личностный рост</h3>
                <div class="growth-indicators">
                    <div class="growth-item">
                        <div class="growth-icon">🎯</div>
                        <div class="growth-content">
                            <div class="growth-title">Фокус на саморазвитии</div>
                            <div class="growth-description">
                                Ваши цитаты показывают активный интерес к личностному росту
                            </div>
                        </div>
                    </div>
                    
                    <div class="growth-item">
                        <div class="growth-icon">💫</div>
                        <div class="growth-content">
                            <div class="growth-title">Эмоциональная зрелость</div>
                            <div class="growth-description">
                                Заметен рост осознанности в выборе мудрых мыслей
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎯 Рендер отслеживания целей
     */
    renderGoalTracking() {
        return `
            <div class="goal-tracking-section">
                <h3 class="section-title">🎯 Отслеживание целей</h3>
                <div class="goals-list">
                    <div class="goal-item">
                        <div class="goal-progress">
                            <div class="goal-title">Еженедельная цель</div>
                            <div class="goal-bar">
                                <div class="goal-fill" style="width: 85%"></div>
                            </div>
                            <div class="goal-text">6 из 7 цитат</div>
                        </div>
                    </div>
                    
                    <div class="goal-item">
                        <div class="goal-progress">
                            <div class="goal-title">Месячная цель</div>
                            <div class="goal-bar">
                                <div class="goal-fill" style="width: 60%"></div>
                            </div>
                            <div class="goal-text">18 из 30 цитат</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📭 Рендер пустого отчета
     */
    renderEmptyReport() {
        return `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-title">Отчет еще не готов</div>
                <div class="empty-text">
                    Добавьте несколько цитат, чтобы получить персональный анализ
                </div>
                <button class="empty-action" onclick="this.app.router.navigate('/diary')">
                    ✍️ Добавить цитаты
                </button>
            </div>
        `;
    }
    
    /**
     * 📭 Рендер пустой истории
     */
    renderEmptyHistory() {
        return `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <div class="empty-title">История отчетов пуста</div>
                <div class="empty-text">
                    Ваши отчеты будут появляться здесь каждую неделю
                </div>
            </div>
        `;
    }
    
    /**
     * 🎯 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Переключение периода
        this.attachPeriodListeners();
        
        // Переключение табов
        this.attachTabListeners();
        
        // Действия с отчетами
        this.attachReportActionListeners();
        
        // Действия с книгами
        this.attachBookActionListeners();
        
        // Промокод
        this.attachPromoListeners();
        
        // История отчетов
        this.attachHistoryListeners();
    }
    
    /**
     * 🔄 Обработчики периода
     */
    attachPeriodListeners() {
        const periodBtns = document.querySelectorAll('.period-btn[data-period]');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const period = btn.dataset.period;
                this.switchPeriod(period);
            });
        });
    }
    
    /**
     * 📑 Обработчики табов
     */
    attachTabListeners() {
        const tabs = document.querySelectorAll('.tab[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    /**
     * 📊 Обработчики действий с отчетами
     */
    attachReportActionListeners() {
        const shareBtn = document.getElementById('shareReportBtn');
        const exportBtn = document.getElementById('exportReportBtn');
        
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareReport());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }
    }
    
    /**
     * 📚 Обработчики действий с книгами
     */
    attachBookActionListeners() {
        const bookActions = document.querySelectorAll('.book-action-btn[data-action]');
        bookActions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const bookCard = btn.closest('.book-recommendation');
                const bookId = bookCard?.dataset.bookId;
                
                if (bookId) {
                    this.handleBookAction(action, bookId);
                }
            });
        });
    }
    
    /**
     * 🎁 Обработчики промокода
     */
    attachPromoListeners() {
        const copyBtn = document.getElementById('copyCodeBtn');
        const useBtn = document.getElementById('usePromoBtn');
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyPromoCode());
        }
        
        if (useBtn) {
            useBtn.addEventListener('click', () => this.usePromoCode());
        }
    }
    
    /**
     * 📚 Обработчики истории
     */
    attachHistoryListeners() {
        const historyItems = document.querySelectorAll('.history-action-btn[data-action]');
        historyItems.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const historyItem = btn.closest('.history-item');
                const reportId = historyItem?.dataset.reportId;
                
                if (reportId) {
                    this.handleHistoryAction(action, reportId);
                }
            });
        });
        
        const periodFilter = document.getElementById('historyPeriodFilter');
        if (periodFilter) {
            periodFilter.addEventListener('change', (e) => {
                this.filterHistory(e.target.value);
            });
        }
    }
    
    /**
     * 🔄 Переключение периода
     */
    async switchPeriod(period) {
        this.currentPeriod = period;
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('light');
        }
        
        // Перезагрузка данных для нового периода
        await this.loadCurrentReport();
        this.rerender();
    }
    
    /**
     * 📑 Переключение таба
     */
    switchTab(tabName) {
        this.activeTab = tabName;
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('light');
        }
        this.rerender();
    }
    
    /**
     * 📤 Поделиться отчетом
     * ИСПРАВЛЕНО: Используем правильные методы Telegram Web App
     */
    shareReport() {
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('medium');
        }
        
        const shareText = `📊 Мой отчет в Reader Bot:\\n• ${this.currentReport?.statistics?.quotesCount || 0} цитат\\n• ${this.currentReport?.statistics?.uniqueAuthors || 0} авторов\\n\\nСобираю мудрость каждый день! 📚`;
        
        // ИСПРАВЛЕНО: Проверяем доступность Telegram Web App shareUrl
        if (window.Telegram?.WebApp?.shareUrl) {
            window.Telegram.WebApp.shareUrl(window.location.href, shareText);
        } else if (navigator.share) {
            // Используем Web Share API если доступен
            navigator.share({
                title: 'Мой отчет в Reader Bot',
                text: shareText,
                url: window.location.href
            });
        } else {
            // Fallback: копирование в буфер
            navigator.clipboard.writeText(shareText);
            this.showSuccess('✅ Отчет скопирован в буфер обмена');
        }
    }
    
    /**
     * 💾 Экспорт отчета
     */
    exportReport() {
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('medium');
        }
        
        // Можно реализовать экспорт в PDF или текстовый файл
        this.showSuccess('💾 Функция экспорта будет доступна в следующем обновлении');
    }
    
    /**
     * 📚 Обработка действий с книгами
     */
    handleBookAction(action, bookId) {
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('light');
        }
        
        switch (action) {
            case 'view':
                this.app.router.navigate(`/catalog?book=${bookId}`);
                break;
            case 'buy':
                // Переход к покупке с промокодом
                this.buyBook(bookId);
                break;
        }
    }
    
    /**
     * 💳 Покупка книги
     */
    buyBook(bookId) {
        // Здесь будет интеграция с системой покупок
        const promoCode = this.currentReport?.promoCode?.code;
        const buyUrl = `https://annabusel.org/catalog/${bookId}${promoCode ? `?promo=${promoCode}` : ''}`;
        
        if (this.telegram && typeof this.telegram.openLink === 'function') {
            this.telegram.openLink(buyUrl);
        } else {
            window.open(buyUrl, '_blank');
        }
    }
    
    /**
     * 📋 Копирование промокода
     */
    copyPromoCode() {
        const promoCodeText = document.getElementById('promoCodeText');
        if (promoCodeText) {
            const code = promoCodeText.textContent;
            navigator.clipboard.writeText(code);
            
            if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
                this.telegram.hapticFeedback('success');
            }
            this.showSuccess('✅ Промокод скопирован!');
        }
    }
    
    /**
     * 🛒 Использование промокода
     */
    usePromoCode() {
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('medium');
        }
        this.app.router.navigate('/catalog?promo=true');
    }
    
    /**
     * 📚 Обработка действий с историей
     */
    handleHistoryAction(action, reportId) {
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('light');
        }
        
        switch (action) {
            case 'view':
                this.viewHistoryReport(reportId);
                break;
            case 'share':
                this.shareHistoryReport(reportId);
                break;
        }
    }
    
    /**
     * 👁️ Просмотр исторического отчета
     */
    async viewHistoryReport(reportId) {
        try {
            const report = await this.api.getReportById(reportId);
            this.currentReport = report;
            this.activeTab = 'current';
            this.rerender();
        } catch (error) {
            console.error('❌ Ошибка загрузки отчета:', error);
            this.showError('Не удалось загрузить отчет');
        }
    }
    
    /**
     * 📤 Поделиться историческим отчетом
     */
    shareHistoryReport(reportId) {
        // Аналогично shareReport, но для исторического отчета
        this.shareReport();
    }
    
    /**
     * 🔧 Вспомогательные методы
     */
    
    calculateGoalProgress(stats) {
        const goal = this.currentPeriod === 'weekly' ? 7 : 30;
        return Math.min(Math.round((stats.quotesCount / goal) * 100), 100);
    }
    
    getChangeClass(change) {
        if (!change) return '';
        return change > 0 ? 'positive' : change < 0 ? 'negative' : '';
    }
    
    formatChange(change) {
        if (!change) return '';
        const sign = change > 0 ? '+' : '';
        return `${sign}${change}`;
    }
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU');
    }
    
    formatDateRange(range) {
        if (!range) return '';
        const start = this.formatDate(range.start);
        const end = this.formatDate(range.end);
        return `${start} - ${end}`;
    }
    
    renderProgressBar(current, total) {
        const percent = Math.round((current / total) * 100);
        return `
            <div class="mini-progress-bar">
                <div class="mini-progress-fill" style="width: ${percent}%"></div>
            </div>
        `;
    }
    
    updateReportsUI(reports) {
        // Обновление UI при изменении отчетов
        if (reports.current && this.activeTab === 'current') {
            this.currentReport = reports.current;
            this.rerender();
        }
    }
    
    updateStatsUI(stats) {
        // Обновление статистики в реальном времени
        const statCards = document.querySelectorAll('.stat-number');
        // Обновление значений...
    }
    
    filterHistory(period) {
        this.currentPeriod = period;
        this.rerender();
    }
    
    rerender() {
        const container = document.querySelector('.reports-page .content');
        if (container) {
            container.innerHTML = `
                ${this.renderPeriodSelector()}
                ${this.renderTabs()}
                ${this.renderTabContent()}
            `;
            this.attachEventListeners();
        }
    }
    
    showSuccess(message) {
        if (this.telegram && typeof this.telegram.showAlert === 'function') {
            this.telegram.showAlert(message);
        } else {
            alert(message);
        }
    }
    
    showError(message) {
        if (this.telegram && typeof this.telegram.showAlert === 'function') {
            this.telegram.showAlert(message);
        } else {
            alert(message);
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
window.ReportsPage = ReportsPage;