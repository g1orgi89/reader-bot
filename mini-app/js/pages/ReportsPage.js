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
 * ✅ ИСПРАВЛЕНО: Устранены дублирующиеся API вызовы как в HomePage и DiaryPage
 */

class ReportsPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // ✅ НОВОЕ: Флаги для предотвращения дублирующихся загрузок
        this.reportsLoaded = false;
        this.reportsLoading = false;
        
        // ✅ НОВОЕ: Хранение еженедельного отчета
        this.weeklyReport = null;
        
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
        
        // ✅ НОВОЕ: Маппинг эмоциональных тонов
        this.emotionalToneEmojis = {
            'позитивный': '😊',
            'нейтральный': '😌',
            'задумчивый': '🤔',
            'вдохновляющий': '✨',
            'меланхоличный': '😔',
            'энергичный': '⚡',
            'размышляющий': '💭',
            'вдохновленный': '🌟'
        };
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // ✅ ИСПРАВЛЕНО: Убрана автозагрузка из init()
    }
    
    setupSubscriptions() {
        // Подписки на изменения состояния, если необходимо
    }

    /**
     * 🔄 Ожидание валидного userId для предотвращения гонки условий
     * @param {number} timeout - Максимальное время ожидания в миллисекундах
     * @returns {Promise<string>} - Валидный userId
     */
    async waitForValidUserId(timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            let userId = this.state.getCurrentUserId();
            
            // ✅ FIX: Accept numeric string userId and coerce to number
            if (typeof userId === 'string' && /^\d+$/.test(userId)) {
                userId = parseInt(userId, 10);
            }
            
            // Проверяем что userId валидный и не равен demo-user
            if (userId && userId !== 'demo-user' && typeof userId === 'number') {
                console.log('✅ ReportsPage: Получен валидный userId:', userId);
                return userId;
            }
            
            // Try TelegramService.getUser()
            if (this.telegram && typeof this.telegram.getUser === 'function') {
                try {
                    const telegramUser = this.telegram.getUser();
                    if (telegramUser && telegramUser.id && telegramUser.id !== 'demo-user') {
                        console.log('✅ ReportsPage: Получен userId из TelegramService:', telegramUser.id);
                        return telegramUser.id;
                    }
                } catch (error) {
                    console.warn('⚠️ ReportsPage: Ошибка получения пользователя из TelegramService:', error);
                }
            }
            
            // Также принимаем demo-user только в debug режиме
            if (userId === 'demo-user' && this.state.get('debugMode')) {
                console.log('🧪 ReportsPage: Используем demo-user в debug режиме');
                return userId;
            }
            
            // Ждем 100ms перед следующей проверкой
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Dev fallbacks before giving up
        console.warn('⏰ ReportsPage: Timeout waiting for userId, trying dev fallbacks');
        
        // URL parameter fallback
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('userId')) {
            const urlUserId = urlParams.get('userId');
            console.log('✅ ReportsPage: Используем userId из URL:', urlUserId);
            return urlUserId;
        }
        
        // localStorage fallback
        if (localStorage.getItem('APP_DEV_USER_ID')) {
            const storageUserId = localStorage.getItem('APP_DEV_USER_ID');
            console.log('✅ ReportsPage: Используем userId из localStorage:', storageUserId);
            return storageUserId;
        }
        
        // Timeout reached, return demo-user for fallback
        console.warn('⏰ ReportsPage: All fallbacks exhausted, using demo-user fallback');
        return 'demo-user';
    }

    /**
     * 📊 Применение fallback статистики
     * @param {string} reason - Причина применения fallback
     */
    applyFallbackStats(reason) {
        console.warn(`📊 ReportsPage: Применяем fallback статистику (${reason})`);
        
        this.reportData.statistics = {
            quotes: 7,
            authors: 5,
            days: 6,
            goal: 85
        };
        
        // Устанавливаем флаги для предотвращения повторных попыток
        this.reportsLoaded = true;
        this.state.set('reports.lastUpdate', Date.now());
        
        console.log('✅ ReportsPage: Fallback статистика применена');
    }
    
    async loadReportData() {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.reportsLoading || this.reportsLoaded) {
            console.log('🔄 ReportsPage: Отчеты уже загружаются или загружены, пропускаем');
            return;
        }
        
        try {
            this.reportsLoading = true;
            console.log('📊 ReportsPage: Загружаем данные отчета...');
            
            // ✅ Ждем валидный userId
            const userId = await this.waitForValidUserId();
            
            // ✅ Если получили demo-user после timeout - применяем fallback
            if (userId === 'demo-user') {
                console.warn('⚠️ ReportsPage: Получен demo-user, применяем fallback статистику');
                this.applyFallbackStats('demo-user');
                return;
            }
            
            // ✅ Загружаем данные с explicit userId
            console.log('📡 ReportsPage: Загружаем статистику для userId:', userId);
            const [stats, weeklyReports] = await Promise.all([
                this.api.getStats(userId),
                this.api.getWeeklyReports({ limit: 1 }, userId)
            ]);
            
            // ✅ Обработка статистики
            if (stats && stats.success) {
                this.reportData.statistics = {
                    quotes: stats.stats?.totalQuotes || stats.thisWeek || 7,
                    authors: stats.stats?.favoriteAuthors?.length || stats.uniqueAuthors || 5,
                    days: stats.stats?.currentStreak || stats.activeDays || 6,
                    goal: Math.min(Math.round(((stats.stats?.totalQuotes || stats.thisWeek || 7) / 7) * 100), 100) || 85
                };
            }
            
            // ✅ Обработка еженедельного отчета
            if (weeklyReports && weeklyReports.success) {
                // Обработка разных форматов ответа
                const reports = weeklyReports.reports || weeklyReports.data?.reports || [];
                if (reports.length > 0) {
                    this.weeklyReport = reports[0];
                    
                    // ✅ Обновляем AI анализ из еженедельного отчета для обратной совместимости
                    const analysis = this.weeklyReport.analysis;
                    if (analysis) {
                        // Приоритет для backward compatibility: summary → insights
                        this.reportData.aiAnalysis = analysis.summary || analysis.insights || this.reportData.aiAnalysis;
                    }
                    
                    console.log('✅ ReportsPage: Загружен еженедельный отчет', this.weeklyReport);
                } else {
                    console.log('📊 ReportsPage: Еженедельные отчеты не найдены, используем fallback');
                }
            } else {
                console.log('📊 ReportsPage: Ошибка загрузки еженедельных отчетов, используем fallback');
            }
            
            if (stats && stats.success) {
                this.reportsLoaded = true;
                this.state.set('reports.lastUpdate', Date.now());
                console.log('✅ ReportsPage: Данные отчета загружены');
            } else {
                this.applyFallbackStats('invalid-response');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных отчета:', error);
            
            // ✅ Обработка разных типов ошибок
            if (error.message && error.message.includes('404')) {
                this.applyFallbackStats('404');
            } else {
                this.applyFallbackStats('error');
            }
        } finally {
            this.reportsLoading = false;
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
     * 💡 AI АНАЛИЗ ОТ АННЫ (ТОЧНО ИЗ КОНЦЕПТА!) - ОБНОВЛЕНО ДЛЯ ЕЖЕНЕДЕЛЬНЫХ ОТЧЕТОВ
     */
    renderAIAnalysis() {
        // ✅ Если загрузка еще идет
        if (this.reportsLoading) {
            return `
                <div class="ai-insight">
                    <div class="ai-header">
                        <div class="ai-title">✨ Анализ от Анны</div>
                    </div>
                    <div class="ai-text ai-loading">🔄 Анализируем ваши цитаты...</div>
                </div>
            `;
        }
        
        // ✅ Получаем данные анализа с правильной иерархией fallback
        let analysisText = '';
        if (this.weeklyReport?.analysis) {
            // Приоритет: insights → summary → legacy aiAnalysis
            analysisText = this.weeklyReport.analysis.insights || 
                          this.weeklyReport.analysis.summary || 
                          this.reportData.aiAnalysis;
        } else {
            analysisText = this.reportData.aiAnalysis;
        }
        
        // ✅ Если нет данных для анализа
        if (!analysisText || analysisText.trim() === '') {
            return `
                <div class="ai-insight">
                    <div class="ai-header">
                        <div class="ai-title">✨ Анализ от Анны</div>
                    </div>
                    <div class="ai-text ai-empty">📝 Пока недостаточно данных для анализа. Добавьте больше цитат, и я смогу предоставить персональный анализ!</div>
                </div>
            `;
        }
        
        // ✅ Безопасное экранирование HTML
        const safeAnalysisText = window.escapeHtml ? window.escapeHtml(analysisText) : analysisText;
        
        // ✅ Получаем эмоциональный тон из еженедельного отчета
        const emotionalTone = this.weeklyReport?.analysis?.emotionalTone;
        const toneEmoji = emotionalTone ? this.emotionalToneEmojis[emotionalTone] : null;
        
        // ✅ Формируем chip с эмоциональным тоном
        const toneChip = emotionalTone ? `
            <div class="ai-tone-chip">
                ${toneEmoji ? `${toneEmoji} ` : ''}${window.escapeHtml ? window.escapeHtml(emotionalTone) : emotionalTone}
            </div>
        ` : '';
        
        return `
            <div class="ai-insight">
                <div class="ai-header">
                    <div class="ai-title">✨ Анализ от Анны</div>
                    ${toneChip}
                </div>
                <div class="ai-text">${safeAnalysisText}</div>
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
        
        // ✅ ИСПРАВЛЕНО: Умная загрузка - не загружаем если уже загружено или загружается
        if (!this.reportsLoaded && !this.reportsLoading) {
            console.log('🔄 ReportsPage: Первый показ, загружаем данные');
            this.loadReportData().then(() => {
                this.rerender();
            });
        } else if (this.reportsLoaded && !this.reportsLoading) {
            // Проверяем актуальность данных (10 минут)
            const lastUpdate = this.state.get('reports.lastUpdate');
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            
            if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
                console.log('🔄 ReportsPage: Данные устарели, обновляем');
                this.loadReportData().then(() => {
                    this.rerender();
                });
            } else {
                console.log('✅ ReportsPage: Данные актуальны');
            }
        } else {
            console.log('🔄 ReportsPage: Загрузка уже в процессе, ожидаем');
        }
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
        
        // ✅ НОВОЕ: Сброс флагов
        this.reportsLoaded = false;
        this.reportsLoading = false;
    }
}

// 📤 Экспорт класса
window.ReportsPage = ReportsPage;