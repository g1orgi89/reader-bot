/**
 * 📊 ОТЧЕТЫ - ReportsPage.js (ИСПРАВЛЕНО - БЕЗ ШАПКИ!)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТУ ИЗ "концепт 5 страниц app.txt":
 * - Точная HTML структура из концепта
 * - CSS классы вместо inline стилей
 * - 4 колонки статистики как в концепте
 * - AI анализ от Анны в классе ai-insight
 * - Промо секция в классе promo-section
 * 
 * ✅ ИСПРАВЛЕНО: БЕЗ ШАПКИ СВЕРХУ - ЧИСТЫЙ ДИЗАЙН!
 */

class ReportsPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Данные отчета (точно из концепта)
        this.reportData = {
            statistics: {
                quotes: 7,
                authors: 5,
                days: 6,
                goal: 85
            },
            topics: "психология, саморазвитие, отношения",
            aiAnalysis: "Ваши цитаты показывают активный поиск внутренней гармонии. Рекомендую углубиться в тему саморазвития.",
            recommendations: "На основе ваших цитат и интересов сообщества"
        };
        
        this.init();
    }
    
    init() {
        this.loadReportData();
    }
    
    async loadReportData() {
        try {
            // Загружаем актуальные данные для отчета
            const stats = await this.api.getStats();
            if (stats) {
                this.reportData.statistics = {
                    quotes: stats.thisWeek || 7,
                    authors: stats.uniqueAuthors || 5,
                    days: stats.activeDays || 6,
                    goal: Math.min(Math.round((stats.thisWeek / 7) * 100), 100) || 85
                };
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных отчета:', error);
            // Используем примеры из концепта как fallback
        }
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!) - БЕЗ ШАПКИ!
     */
    render() {
        return `
            <div class="content">
                ${this.renderWeeklyReport()}
                ${this.renderAIAnalysis()}
                ${this.renderRecommendations()}
            </div>
        `;
    }
    
    /**
     * 📊 ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ (ТОЧНАЯ СТРУКТУРА ИЗ КОНЦЕПТА!)
     */
    renderWeeklyReport() {
        const { quotes, authors, days, goal } = this.reportData.statistics;
        
        return `
            <div class="weekly-report">
                <div class="report-title">📈 Ваш отчет за неделю</div>
                <div class="report-stats-grid">
                    <div class="report-stat">
                        <div class="stat-value">${quotes}</div>
                        <div class="stat-name">Цитат</div>
                    </div>
                    <div class="report-stat">
                        <div class="stat-value">${authors}</div>
                        <div class="stat-name">Авторов</div>
                    </div>
                    <div class="report-stat">
                        <div class="stat-value">${days}</div>
                        <div class="stat-name">Дней</div>
                    </div>
                    <div class="report-stat">
                        <div class="stat-value goal-stat">${goal}%</div>
                        <div class="stat-name">Цель</div>
                    </div>
                </div>
                <div class="report-themes">Темы: ${this.reportData.topics}</div>
            </div>
        `;
    }
    
    /**
     * 💡 AI АНАЛИЗ ОТ АННЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderAIAnalysis() {
        return `
            <div class="ai-insight">
                <div class="ai-title">💡 Анализ от Анны</div>
                <div class="ai-text">${this.reportData.aiAnalysis}</div>
            </div>
        `;
    }
    
    /**
     * 🎯 РЕКОМЕНДАЦИИ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderRecommendations() {
        return `
            <div class="promo-section">
                <div class="promo-title">🎯 Специально для вас</div>
                <div class="promo-text">${this.reportData.recommendations}</div>
                <button class="promo-btn" id="getRecommendationsBtn">Получить рекомендации</button>
            </div>
        `;
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
     */
    attachEventListeners() {
        const getRecommendationsBtn = document.getElementById('getRecommendationsBtn');
        
        if (getRecommendationsBtn) {
            getRecommendationsBtn.addEventListener('click', () => {
                this.handleGetRecommendations();
            });
        }
    }
    
    /**
     * 📚 ПЕРЕХОД К РЕКОМЕНДАЦИЯМ
     */
    handleGetRecommendations() {
        this.telegram.hapticFeedback('medium');
        
        // Переходим на страницу каталога с персональными рекомендациями
        this.app.router.navigate('/catalog?recommendations=true');
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ИСПРАВЛЕНО: БЕЗ ШАПКИ!
     */
    onShow() {
        console.log('📊 ReportsPage: onShow - БЕЗ ШАПКИ!');
        // Ничего не делаем - Router уже скрыл все шапки!
        // Страница отчетов работает без шапки сверху
        
        // Обновляем данные при показе страницы
        this.loadReportData().then(() => {
            this.rerender();
        });
    }
    
    onHide() {
        console.log('📊 ReportsPage: onHide');
        // Ничего не делаем - Router управляет шапками
    }
    
    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
        }
    }
    
    destroy() {
        // Очистка ресурсов
    }
}

// 📤 Экспорт класса
window.ReportsPage = ReportsPage;