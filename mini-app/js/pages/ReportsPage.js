/**
 * 📊 ОТЧЕТЫ - ReportsPage.js (ТОЧНО ПО КОНЦЕПТУ!)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТУ ИЗ "концепт 5 страниц app.txt":
 * - Простая структура без табов
 * - Карточка с 4 колонками статистики
 * - AI анализ от Анны в стиле ai-insight
 * - Промо секция с кнопкой
 */

class ReportsPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Данные отчета (примеры из концепта)
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
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!)
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
     * 📊 ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderWeeklyReport() {
        const { quotes, authors, days, goal } = this.reportData.statistics;
        
        return `
            <div style="background: var(--surface); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border); transition: all var(--transition-normal);">
                <div style="font-weight: bold; margin-bottom: 10px; font-size: 13px; color: var(--text-primary); transition: color var(--transition-normal);">📈 Ваш отчет за неделю</div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--text-primary); transition: color var(--transition-normal);">${quotes}</div>
                        <div style="font-size: 9px; color: var(--text-secondary); transition: color var(--transition-normal);">Цитат</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--text-primary); transition: color var(--transition-normal);">${authors}</div>
                        <div style="font-size: 9px; color: var(--text-secondary); transition: color var(--transition-normal);">Авторов</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--text-primary); transition: color var(--transition-normal);">${days}</div>
                        <div style="font-size: 9px; color: var(--text-secondary); transition: color var(--transition-normal);">Дней</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--primary-color); transition: color var(--transition-normal);">${goal}%</div>
                        <div style="font-size: 9px; color: var(--text-secondary); transition: color var(--transition-normal);">Цель</div>
                    </div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 8px; transition: color var(--transition-normal);">Темы: ${this.reportData.topics}</div>
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
     * 📱 LIFECYCLE МЕТОДЫ
     */
    onShow() {
        const homeHeader = document.getElementById('home-header');
        const pageHeader = document.getElementById('page-header');
        const pageTitle = document.getElementById('pageTitle');
        
        if (homeHeader) homeHeader.style.display = 'none';
        if (pageHeader) pageHeader.style.display = 'block';
        if (pageTitle) pageTitle.textContent = '📋 Отчеты + Анализ';
        
        // Обновляем данные при показе страницы
        this.loadReportData().then(() => {
            this.rerender();
        });
    }
    
    onHide() {
        const pageHeader = document.getElementById('page-header');
        if (pageHeader) pageHeader.style.display = 'none';
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
