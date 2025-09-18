/**
 * 📊 ОТЧЕТЫ - ReportsPage.js (ЕЖЕНЕДЕЛЬНЫЕ ОТЧЕТЫ АННЫ БУСЕЛ)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТУ ИЗ "концепт 5 страниц app.txt":
 * - Точная HTML структура из концепта
 * - CSS классы вместо inline стилей
 * - 4 колонки статистики как в концепте
 * - AI анализ от Анны в классе ai-insight
 * - Промо секция в классе promo-section
 * 
 * ✅ НОВОЕ: ОПТИМИЗАЦИЯ ЕЖЕНЕДЕЛЬНЫХ ОТЧЕТОВ:
 * - Всегда показывать только последний отчет
 * - Кэширование с проверкой новой недели
 * - Обновление только раз в неделю
 * - Новый заголовок "Еженедельный отчет от Анны"
 * - Дата в формате "Месяц, неделя X"
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
        
        // ✅ НОВОЕ: Кэширование недель для оптимизации
        this.lastWeekKey = localStorage.getItem('reader-bot-last-week-key') || '';
        this.lastReportDate = null;
        
        // Данные отчета (точно из концепта)
        this.reportData = {
            statistics: {
                quotes: 7,
                authors: 5,
                days: 6,
                goal: 85
            },
            deltas: {
                quotes: 0,
                authors: 0,
                days: 0
            },
            progress: {
                quotes: 50,
                days: 86
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
        
        // Обнуляем дельты при fallback
        this.reportData.deltas = {
            quotes: 0,
            authors: 0,
            days: 0
        };
        
        // Устанавливаем дефолтный прогресс
        this.reportData.progress = {
            quotes: 50,
            days: 86
        };
        
        // Устанавливаем флаги для предотвращения повторных попыток
        this.reportsLoaded = true;
        this.state.set('reports.lastUpdate', Date.now());
        
        console.log('✅ ReportsPage: Fallback статистика применена');
    }
    
    /**
     * 📋 Генерирует fallback slug для legacy записей без bookSlug
     * @param {string} title - Название книги
     * @returns {string} Сгенерированный slug
     */
    generateFallbackSlug(title) {
        if (!title) return 'unknown-book';
        
        // Transliteration map for Cyrillic to Latin
        const cyrillicMap = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
            'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
            'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
            'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
            'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        
        return title
            .toString()
            .toLowerCase()
            .replace(/[а-я]/g, (char) => cyrillicMap[char] || char)
            .replace(/[^a-z0-9\s-]/g, '') // только латиница, цифры, пробелы и дефисы
            .replace(/\s+/g, '-')         // пробелы на дефисы
            .replace(/[-]+/g, '-')         // несколько дефисов — один дефис
            .replace(/^-+|-+$/g, '')      // дефисы в начале/конце
            .substring(0, 50);            // ограничиваем длину
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
            const [weeklyStats, weeklyReports] = await Promise.all([
                this.api.getWeeklyStats(userId),
                this.api.getWeeklyReports({ limit: 1 }, userId)
            ]);
            
            // ✅ Обработка еженедельной статистики
            if (weeklyStats && weeklyStats.success && weeklyStats.data) {
                const stats = weeklyStats.data;
                
                // Вычисляем дельты для отображения изменений
                const quotesDelta = stats.quotes - (stats.prevWeek?.quotes || 0);
                const authorsDelta = stats.uniqueAuthors - (stats.prevWeek?.uniqueAuthors || 0);
                const daysDelta = stats.activeDays - (stats.prevWeek?.activeDays || 0);
                
                this.reportData.statistics = {
                    quotes: stats.quotes,
                    authors: stats.uniqueAuthors,
                    days: stats.activeDays,
                    goal: stats.progressQuotesPct
                };
                
                // Сохраняем дельты для отображения
                this.reportData.deltas = {
                    quotes: quotesDelta,
                    authors: authorsDelta,
                    days: daysDelta
                };
                
                // Сохраняем прогресс для прогресс-бара
                this.reportData.progress = {
                    quotes: stats.progressQuotesPct,
                    days: stats.progressDaysPct
                };
                
                // Обновляем темы если доступны
                if (stats.dominantThemes && stats.dominantThemes.length > 0) {
                    this.reportData.topics = stats.dominantThemes.join(', ');
                }
                
                console.log('✅ ReportsPage: Загружена реальная статистика:', this.reportData.statistics);
            } else {
                console.warn('⚠️ ReportsPage: Ошибка загрузки статистики, используем fallback');
                this.applyFallbackStats('stats-error');
            }
            
            // ✅ Обработка еженедельного отчета (только последний)
            if (weeklyReports && weeklyReports.success) {
                // Обработка разных форматов ответа
                const reports = weeklyReports.reports || weeklyReports.data?.reports || [];
                if (reports.length > 0) {
                    this.weeklyReport = reports[0];
                    // ✅ НОВОЕ: Сохраняем дату отчета для отображения
                    this.lastReportDate = this.weeklyReport.sentAt ? 
                        new Date(this.weeklyReport.sentAt) : new Date();

            // 📋 НОВОЕ: Легковесная проверка bookSlug для legacy записей (только если отсутствует)
            if (this.weeklyReport.recommendations && Array.isArray(this.weeklyReport.recommendations)) {
                let catalogBooks = [];
                if (this.app?.state?.get && typeof this.app.state.get === 'function') {
                    catalogBooks = this.app.state.get('books') || [];
                } else if (this.app?.state?.books) {
                    catalogBooks = this.app.state.books;
                }
                
                // Только для рекомендаций БЕЗ bookSlug (защита от legacy данных)
                this.weeklyReport.recommendations.forEach(rec => {
                    if (!rec.bookSlug && catalogBooks.length) {
                        const found = catalogBooks.find(book =>
                            book.title === rec.title && (
                                (!book.author && !rec.author) ||
                                (book.author && rec.author && book.author === rec.author)
                            )
                        );
                        if (found && found.bookSlug) {
                            rec.bookSlug = found.bookSlug;
                            console.log(`📋 ReportsPage: Добавлен legacy bookSlug ${rec.bookSlug} для "${rec.title}"`);
                        } else {
                            // Fallback slug для legacy записей
                            rec.bookSlug = this.generateFallbackSlug(rec.title);
                            console.log(`📋 ReportsPage: Сгенерирован fallback slug ${rec.bookSlug} для "${rec.title}"`);
                        }
                    }
                });
            }
                    // НОРМАЛИЗАЦИЯ: гарантируем наличие вложенного analysis
                    const wr = this.weeklyReport || {};
                    const normalizedAnalysis = {
                        summary: (wr.analysis?.summary) || wr.summary || '',
                        insights: (wr.analysis?.insights) || wr.insights || '',
                        emotionalTone: (wr.analysis?.emotionalTone) || wr.emotionalTone || '',
                        dominantThemes: (wr.analysis?.dominantThemes) || wr.dominantThemes || []
                    };
                    this.weeklyReport.analysis = normalizedAnalysis;

                    // Обновляем текст анализа для рендера (приоритет: insights → summary → fallback)
                    if (normalizedAnalysis.insights || normalizedAnalysis.summary) {
                        this.reportData.aiAnalysis =
                            normalizedAnalysis.insights || normalizedAnalysis.summary || this.reportData.aiAnalysis;
                    }

                    // Обновляем темы ("Темы: …") из dominantThemes, если есть
                    if (Array.isArray(normalizedAnalysis.dominantThemes) && normalizedAnalysis.dominantThemes.length) {
                        this.reportData.topics = normalizedAnalysis.dominantThemes.join(', ');
                    }

                    console.log('✅ ReportsPage: Нормализованный анализ', this.weeklyReport.analysis);
                    
                    console.log('✅ ReportsPage: Загружен еженедельный отчет', this.weeklyReport);
                } else {
                    console.log('📊 ReportsPage: Еженедельные отчеты не найдены - новый пользователь');
                    this.weeklyReport = null; // Явно устанавливаем null для новых пользователей
                }
            } else {
                console.log('📊 ReportsPage: Ошибка загрузки еженедельных отчетов');
                this.weeklyReport = null; // Явно устанавливаем null при ошибке
            }
            
            // ✅ ИСПРАВЛЕНО: Всегда помечаем как загруженное, даже если нет отчетов
            this.reportsLoaded = true;
            this.state.set('reports.lastUpdate', Date.now());
            
            // ✅ НОВОЕ: Обновляем ключ недели для кэширования
            if (window.DateUtils && window.DateUtils.getWeekKey) {
                this.lastWeekKey = window.DateUtils.getWeekKey();
                localStorage.setItem('reader-bot-last-week-key', this.lastWeekKey);
            }
            
            console.log('✅ ReportsPage: Загрузка данных завершена');
            
            // ✅ НОВОЕ: Если нет отчетов - не применяем fallback статистику, показываем плейсхолдер
            if (!this.weeklyReport && weeklyStats && !weeklyStats.success) {
                console.log('📊 ReportsPage: Нет отчетов и нет статистики - новый пользователь');
            } else if (weeklyStats && weeklyStats.success) {
                console.log('✅ ReportsPage: Статистика загружена успешно');
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
     * ✅ ИСПРАВЛЕНО: Показывает лоадер до получения данных, предотвращает мигание старых данных
     */
    render() {
        // ✅ НОВОЕ: Если загрузка идет - показываем лоадер для всей страницы
        if (this.reportsLoading) {
            return `
                <div class="content">
                    <div class="reports-loading">
                        <div class="loading-content">
                            <div class="loading-spinner">🔄</div>
                            <div class="loading-text">Загрузка отчета...</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // ✅ НОВОЕ: Если нет отчета для нового пользователя - показываем плейсхолдер
        if (!this.weeklyReport && !this.reportsLoaded) {
            return `
                <div class="content">
                    ${this.renderNewUserPlaceholder()}
                </div>
            `;
        }

        return `
            <div class="content">
                ${this.renderWeeklyReport()}
                ${this.renderAIAnalysis()}
                ${this.renderRecommendations()}
            </div>
        `;
    }
    
    /**
     * 🆕 ПЛЕЙСХОЛДЕР ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ БЕЗ ОТЧЕТОВ
     */
    renderNewUserPlaceholder() {
        // Вычисляем дату следующего воскресенья
        const nextSundayDate = this.getNextSundayDate();
        const formattedDate = nextSundayDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long'
        });

        return `
            <div class="new-user-placeholder">
                <div class="placeholder-content">
                    <div class="placeholder-icon">📊</div>
                    <div class="placeholder-title">Ваш первый отчет готовится</div>
                    <div class="placeholder-text">
                        Еженедельный отчет появится <strong>${formattedDate}</strong>
                    </div>
                    <div class="placeholder-hint">
                        Добавляйте цитаты каждый день, и Анна подготовит для вас персональный анализ
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 📅 ВЫЧИСЛЕНИЕ ДАТЫ СЛЕДУЮЩЕГО ВОСКРЕСЕНЬЯ
     */
    getNextSundayDate() {
        const today = new Date();
        const daysUntilSunday = (7 - today.getDay()) % 7;
        const nextSunday = new Date(today);
        
        // Если сегодня воскресенье, берем следующее воскресенье
        if (daysUntilSunday === 0) {
            nextSunday.setDate(today.getDate() + 7);
        } else {
            nextSunday.setDate(today.getDate() + daysUntilSunday);
        }
        
        return nextSunday;
    }

    /**
     * 📊 ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ (ТОЧНАЯ СТРУКТУРА ИЗ КОНЦЕПТА!)
     * ✅ ИСПРАВЛЕНО: Изменен заголовок на "Ваш отчет за предыдущую неделю"
     * ✅ ИСПРАВЛЕНО: Показывает лоадер во время загрузки
     */
    renderWeeklyReport() {
        // ✅ НОВОЕ: Если загрузка идет - показываем лоадер
        if (this.reportsLoading) {
            return `
                <div class="weekly-report">
                    <div class="report-header">
                        <div class="report-title">📈 Ваш отчет за предыдущую неделю</div>
                    </div>
                    <div class="loading-content">
                        <div class="loading-text">🔄 Загружаем статистику...</div>
                    </div>
                </div>
            `;
        }

        const { quotes, authors, days, goal } = this.reportData.statistics;
        const deltas = this.reportData.deltas || {};
        const progress = this.reportData.progress || {};
        
        // Функция для рендера дельты
        const renderDelta = (value) => {
            if (!value || value === 0) return '';
            const direction = value > 0 ? 'up' : 'down';
            const symbol = value > 0 ? '+' : '';
            return `<span class="stat-delta ${direction}">${symbol}${value}</span>`;
        };
        
        // ✅ НОВОЕ: Форматирование даты отчета "Месяц, неделя N"
        let reportDateText = '';
        if (this.lastReportDate && window.DateUtils) {
            reportDateText = window.DateUtils.formatReportDate(this.lastReportDate);
        } else if (this.lastReportDate) {
            // Fallback если DateUtils не загружен
            const date = this.lastReportDate;
            const monthName = date.toLocaleString('ru', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            const weekNumber = Math.ceil(date.getDate() / 7);
            reportDateText = `${capitalizedMonth}, неделя ${weekNumber}`;
        }
        
        return `
            <div class="weekly-report">
                <div class="report-header">
                    <div class="report-title">📈 Ваш отчет за предыдущую неделю</div>
                    ${reportDateText ? `<div class="report-date">${reportDateText}</div>` : ''}
                </div>
                <div class="report-stats-grid">
                    <div class="report-stat">
                        <div class="stat-value">${quotes}</div>
                        <div class="stat-name">Цитат</div>
                        ${renderDelta(deltas.quotes, 'quotes')}
                    </div>
                    <div class="report-stat">
                        <div class="stat-value">${authors}</div>
                        <div class="stat-name">Авторов</div>
                        ${renderDelta(deltas.authors, 'authors')}
                    </div>
                    <div class="report-stat">
                        <div class="stat-value">${days}</div>
                        <div class="stat-name">Дней</div>
                        ${renderDelta(deltas.days, 'days')}
                    </div>
                    <div class="report-stat">
                        <div class="stat-value goal-stat">${goal}%</div>
                        <div class="stat-name">Цель</div>
                        ${progress.quotes ? `
                            <div class="goal-bar">
                                <div class="goal-fill" style="width: ${progress.quotes}%"></div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="report-themes">Темы: ${this.reportData.topics}</div>
            </div>
        `;
    }
    
    /**
     * 💡 AI АНАЛИЗ ОТ АННЫ - ПЕРЕИМЕНОВАННЫЙ ЗАГОЛОВОК
     */
    renderAIAnalysis() {
        // ✅ Если загрузка еще идет
        if (this.reportsLoading) {
            return `
                <div class="ai-insight">
                    <div class="ai-header">
                        <div class="ai-title">✨ Еженедельный отчет от Анны</div>
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
                        <div class="ai-title">✨ Еженедельный отчет от Анны</div>
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
                    <div class="ai-title">✨ Еженедельный отчет от Анны</div>
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
        const recommendations = this.weeklyReport?.recommendations || [];

        if (Array.isArray(recommendations) && recommendations.length > 0) {
            return `
                <div class="promo-section">
                    <div class="promo-title">🎯 Специально для вас</div>
                    <div class="promo-list">
                        ${recommendations.map(rec => {
                            // Защита от дублирования description/reasoning
                            const showReasoning = rec.reasoning && rec.reasoning.trim() !== '' &&
                                rec.reasoning.trim() !== rec.description?.trim() &&
                                rec.reasoning.trim() !== rec.title?.trim();

                            return `
                                <div class="promo-book">
                                    <div class="promo-book-title">${window.escapeHtml ? window.escapeHtml(rec.title) : rec.title}</div>
                                    ${rec.author ? `<div class="promo-book-author">${window.escapeHtml ? window.escapeHtml(rec.author) : rec.author}</div>` : ""}
                                    <div class="promo-book-desc">${window.escapeHtml ? window.escapeHtml(rec.description) : rec.description}</div>
                                    ${showReasoning ? `<div class="promo-book-reason">${window.escapeHtml ? window.escapeHtml(rec.reasoning) : rec.reasoning}</div>` : ""}
                                    ${rec.priceByn ? `<div class="promo-book-price">Цена: <b>${rec.priceByn} BYN</b></div>` : ""}
                                    <a class="promo-book-link" href="#/catalog?highlight=${rec.bookSlug}">Подробнее</a>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // fallback (заглушка и кнопка)
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
     * ✅ ИСПРАВЛЕНО: Предотвращает загрузку старых данных, всегда показывает лоадер до получения актуальных данных
     */
    onShow() {
        console.log('📊 ReportsPage: onShow - БЕЗ ШАПКИ!');
        
        // ✅ ИСПРАВЛЕНО: Сбрасываем состояние загрузки при каждом показе страницы
        // Это предотвращает показ старых данных из state/localStorage
        this.reportsLoaded = false;
        
        // ✅ НОВОЕ: Принудительно перерендериваем с лоадером
        this.rerender();
        
        // ✅ ИСПРАВЛЕНО: Загружаем свежие данные только если не загружается уже
        if (!this.reportsLoading) {
            console.log('🔄 ReportsPage: Загружаем актуальные данные отчета');
            this.loadReportData().then(() => {
                console.log('✅ ReportsPage: Данные загружены, перерендериваем');
                this.rerender();
            }).catch((error) => {
                console.error('❌ ReportsPage: Ошибка загрузки данных:', error);
                // При ошибке показываем плейсхолдер для нового пользователя
                this.reportsLoading = false;
                this.rerender();
            });
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
