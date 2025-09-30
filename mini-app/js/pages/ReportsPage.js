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
        
        // ✅ НОВОЕ: Хранение предыдущего отчета для дельт
        this.previousWeeklyReport = null;
        
        // ✅ НОВОЕ: Кэширование недель для оптимизации
        this.lastWeekKey = localStorage.getItem('reader-bot-last-week-key') || '';
        this.lastReportDate = null;
        
        // ✅ НОВОЕ: Флаги состояния для отслеживания fallback
        this.isFallback = false;
        this.needsReload = false;
        
        // Данные отчета (точно из концепта)
        this.reportData = {
            statistics: null, // Remove hardcoded values - will be calculated from actual data
            deltas: {
                quotes: 0,
                authors: 0,
                days: 0
            },
            progress: {
                quotes: 0,
                days: 0
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
     * 📊 Удален applyFallbackStats - теперь используем null для отсутствия статистики
     */
    
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
    
    /**
     * 🔍 Проверка валидности weeklyReport
     * @param {Object} report - Объект отчета для проверки
     * @returns {boolean} true если отчет валидный
     */
    isValidReport(report) {
        if (!report || typeof report !== 'object') {
            console.log('🔍 isValidReport: Отчет не является объектом');
            return false;
        }
        
        // Проверяем обязательные поля
        const hasRequiredFields = report.weekNumber && 
                                 report.year && 
                                 Array.isArray(report.quotes);
                                 
        if (!hasRequiredFields) {
            console.log('🔍 isValidReport: Отсутствуют обязательные поля', {
                weekNumber: !!report.weekNumber,
                year: !!report.year,
                quotes: Array.isArray(report.quotes)
            });
            return false;
        }
        
        // Проверяем, что отчет не слишком старый (максимум 4 недели)
        const reportDate = report.sentAt ? new Date(report.sentAt) : new Date();
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        
        if (reportDate < fourWeeksAgo) {
            console.log('🔍 isValidReport: Отчет слишком старый', reportDate);
            return false;
        }
        
        console.log('🔍 isValidReport: Отчет валидный');
        return true;
    }
    
    /**
     * 📦 Получение ключа недели для конкретного отчета
     * @param {Object} report - Отчет для которого нужен ключ
     * @returns {string} ISO week key for the report
     */
    getReportWeekKey(report) {
        if (!report) return null;
        
        if (report.weekNumber && report.year) {
            return `${report.year}-W${String(report.weekNumber).padStart(2, '0')}`;
        }
        
        // Fallback - текущий ключ недели
        return this.getCurrentWeekKey();
    }

    /**
     * 📦 Получение текущего ключа недели для кэширования (NEW: ISO week based)
     * @returns {string} ISO week key for caching
     */
    getCurrentWeekKey() {
        if (window.DateUtils && window.DateUtils.getIsoWeekKey) {
            return window.DateUtils.getIsoWeekKey();
        }
        
        // Fallback если DateUtils недоступен - используем ISO week calculation
        const now = new Date();
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const isoWeek = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        const isoYear = d.getUTCFullYear();
        
        return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
    }

    /**
     * 📅 NEW: Prefetch week context before showing page
     * @returns {Promise<void>}
     */
    async prefetch() {
        try {
            console.log('📅 ReportsPage: Prefetching week context...');
            
            // Check if we need to refresh week context
            if (!this.state.isWeekContextLoaded() || this.state.shouldRefreshWeekContext()) {
                this.state.setWeekContextLoading(true);
                
                const userId = await this.waitForValidUserId();
                const weekContext = await this.api.getWeekContext(userId);
                
                if (weekContext.success) {
                    this.state.setWeekContext(weekContext);
                    console.log('📅 Week context loaded:', weekContext);
                } else {
                    console.warn('⚠️ Failed to load week context:', weekContext.error);
                }
            }
            
        } catch (error) {
            console.error('❌ Error prefetching week context:', error);
            this.state.setWeekContextLoading(false);
        }
    }

    /**
     * 📅 NEW: Get formatted label for previous week
     * @returns {string} Formatted week range label
     */
    getPreviousWeekLabel() {
        const weekContext = this.state.getWeekContext();
        
        if (weekContext && weekContext.previous) {
            return weekContext.previous.label;
        }
        
        // Fallback to current date-based calculation
        if (window.DateUtils && window.DateUtils.formatIsoWeekLabel) {
            const weekInfo = window.DateUtils.getISOWeekInfo();
            // Previous week
            let prevWeek = weekInfo.isoWeek - 1;
            let prevYear = weekInfo.isoYear;
            
            if (prevWeek < 1) {
                prevYear = weekInfo.isoYear - 1;
                prevWeek = 52; // Simplified - most years have 52 weeks
            }
            
            return window.DateUtils.formatIsoWeekLabel(prevWeek, prevYear);
        }
        
        return 'предыдущую неделю';
    }
    
    /**
     * 💾 Сохранение отчета в localStorage
     * @param {Object} report - Отчет для сохранения
     * @param {string} weekKey - Ключ недели
     */
    saveReportToCache(report, weekKey) {
        try {
            const cacheData = {
                report,
                weekKey,
                timestamp: Date.now()
            };
            localStorage.setItem('reader-bot-weekly-report-cache', JSON.stringify(cacheData));
            console.log('💾 Отчет сохранен в кэш для недели:', weekKey);
        } catch (error) {
            console.warn('⚠️ Ошибка сохранения в кэш:', error);
        }
    }
    
    /**
     * 📥 Загрузка отчета из localStorage
     * @param {string} currentWeekKey - Текущий ключ недели
     * @returns {Object|null} Закэшированный отчет или null
     */
    loadReportFromCache(currentWeekKey) {
        try {
            const cached = localStorage.getItem('reader-bot-weekly-report-cache');
            if (!cached) {
                console.log('💾 Кэш пуст');
                return null;
            }
            
            const cacheData = JSON.parse(cached);
            
            // Проверяем, что кэш для текущей недели
            if (cacheData.weekKey !== currentWeekKey) {
                console.log('💾 Кэш для другой недели, очищаем', {
                    cached: cacheData.weekKey,
                    current: currentWeekKey
                });
                localStorage.removeItem('reader-bot-weekly-report-cache');
                return null;
            }
            
            // Проверяем валидность отчета
            if (!this.isValidReport(cacheData.report)) {
                console.log('💾 Кэшированный отчет невалидный, очищаем');
                localStorage.removeItem('reader-bot-weekly-report-cache');
                return null;
            }
            
            console.log('💾 Загружен валидный отчет из кэша для недели:', currentWeekKey);
            return cacheData.report;
            
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки из кэша:', error);
            localStorage.removeItem('reader-bot-weekly-report-cache');
            return null;
        }
    }
    
    /**
     * 📊 НОВОЕ: Вычисляет статистику только из данных weeklyReport (заморозка данных)
     * Это обеспечивает отображение "замороженной" статистики на момент создания отчета
     */
    calculateStatisticsFromWeeklyReport() {
        // If no weeklyReport, set statistics to null (don't render the block)
        if (!this.weeklyReport) {
            console.warn('⚠️ ReportsPage: Нет weeklyReport - статистика будет null');
            this.reportData.statistics = null;
            return;
        }

        // ✅ ПРИОРИТЕТ 1: Используем сохраненные метрики, если доступны
        if (this.weeklyReport.metrics) {
            console.log('✅ ReportsPage: Используем сохраненные метрики');
            
            const metrics = this.weeklyReport.metrics;
            
            // Устанавливаем статистику из сохраненных метрик
            this.reportData.statistics = {
                quotes: metrics.quotes,
                authors: metrics.uniqueAuthors,
                days: metrics.activeDays,
                goal: metrics.progressQuotesPct
            };
            
            // Устанавливаем прогресс из метрик
            this.reportData.progress = {
                quotes: metrics.progressQuotesPct,
                days: metrics.progressDaysPct
            };
            
            console.log('📊 ReportsPage: Статистика из метрик:', this.reportData.statistics);
        } else if (this.weeklyReport.quotes && Array.isArray(this.weeklyReport.quotes)) {
            // ✅ ПРИОРИТЕТ 2: Пересчитываем из quotes с createdAt
            console.log('⚠️ ReportsPage: Метрики отсутствуют, пересчитываем из quotes');

            const quotes = this.weeklyReport.quotes;
            
            // Количество цитат - используем quotesCount если есть, иначе длину массива
            const quotesCount = this.weeklyReport.quotesCount || quotes.length;
            
            // Вычисляем количество уникальных авторов из цитат отчета
            const uniqueAuthors = new Set(
                quotes
                    .filter(quote => quote.author && quote.author.trim())
                    .map(quote => quote.author.trim())
            ).size;
            
            // Вычисляем количество активных дней из цитат отчета
            const activeDays = new Set(
                quotes
                    .filter(quote => quote.createdAt)
                    .map(quote => new Date(quote.createdAt).toISOString().split('T')[0])
            ).size;
            
            // Устанавливаем цель прогресса (по умолчанию 30 цитат как в продакшн требованиях)
            const targetQuotes = 30;
            const progressQuotesPct = Math.min(Math.round((quotesCount / targetQuotes) * 100), 100);
            
            // Устанавливаем статистику из weeklyReport данных
            this.reportData.statistics = {
                quotes: quotesCount,
                authors: uniqueAuthors,
                days: activeDays,
                goal: progressQuotesPct
            };
            
            // Устанавливаем прогресс
            this.reportData.progress = {
                quotes: progressQuotesPct,
                days: Math.min(Math.round((activeDays / 7) * 100), 100) // 7 дней в неделе
            };
            
            console.log('📊 ReportsPage: Статистика пересчитана из quotes:', this.reportData.statistics);
        } else {
            // ✅ ПРИОРИТЕТ 3: Нет данных - устанавливаем null (блок не будет отображаться)
            console.warn('⚠️ ReportsPage: Нет данных для расчета статистики - устанавливаем null');
            this.reportData.statistics = null;
            return;
        }
        
        // ✅ НОВОЕ: Вычисляем дельты если есть предыдущий отчет
        this.calculateDeltas();
        
        console.log('✅ ReportsPage: Статистика обновлена:', this.reportData.statistics);
    }
    
    /**
     * 📊 Вычисление дельт между текущим и предыдущим отчетом
     * Включает поддержку legacy отчетов без metrics
     */
    calculateDeltas() {
        // Если нет текущей статистики или предыдущего отчета - обнуляем дельты
        if (!this.reportData.statistics || !this.previousWeeklyReport) {
            this.reportData.deltas = {
                quotes: 0,
                authors: 0,
                days: 0
            };
            return;
        }

        // Если у обоих отчетов есть метрики - используем их
        if (this.weeklyReport.metrics && this.previousWeeklyReport.metrics) {
            const currentMetrics = this.weeklyReport.metrics;
            const prevMetrics = this.previousWeeklyReport.metrics;
            
            this.reportData.deltas = {
                quotes: currentMetrics.quotes - prevMetrics.quotes,
                authors: currentMetrics.uniqueAuthors - prevMetrics.uniqueAuthors,
                days: currentMetrics.activeDays - prevMetrics.activeDays
            };
            
            console.log('📊 ReportsPage: Дельты вычислены из метрик:', this.reportData.deltas);
            return;
        }

        // ✅ НОВОЕ: Legacy поддержка - если у предыдущего отчета есть quotes но нет metrics
        if (this.previousWeeklyReport.quotes && !this.previousWeeklyReport.metrics) {
            console.log('📊 ReportsPage: Вычисляем metrics для предыдущего отчета (legacy поддержка)');
            
            const prevQuotes = this.previousWeeklyReport.quotes || [];
            const prevQuotesCount = this.previousWeeklyReport.quotesCount || prevQuotes.length;
            
            const prevUniqueAuthors = new Set(
                prevQuotes
                    .filter(quote => quote.author && quote.author.trim())
                    .map(quote => quote.author.trim())
            ).size;
            
            const prevActiveDays = new Set(
                prevQuotes
                    .filter(quote => quote.createdAt)
                    .map(quote => new Date(quote.createdAt).toISOString().split('T')[0])
            ).size;

            // Получаем текущие метрики
            const currentQuotes = this.reportData.statistics.quotes;
            const currentAuthors = this.reportData.statistics.authors;
            const currentDays = this.reportData.statistics.days;

            this.reportData.deltas = {
                quotes: currentQuotes - prevQuotesCount,
                authors: currentAuthors - prevUniqueAuthors,
                days: currentDays - prevActiveDays
            };
            
            console.log('📊 ReportsPage: Дельты вычислены для legacy отчета:', this.reportData.deltas);
            return;
        }

        // В остальных случаях обнуляем дельты
        this.reportData.deltas = {
            quotes: 0,
            authors: 0,
            days: 0
        };
    }
    
    /**
     * 🔄 Принудительное обновление данных после генерации отчета
     * Этот метод должен вызываться после успешной генерации нового отчета
     */
    async refreshAfterGeneration() {
        try {
            console.log('🔄 ReportsPage: Начинаем refreshAfterGeneration');
            
            // Ждем валидный userId
            const userId = await this.waitForValidUserId();
            
            if (userId === 'demo-user') {
                console.log('🔄 Demo-user, пропускаем refreshAfterGeneration');
                return;
            }
            
            // Принудительно загружаем свежие данные (без кэша)
            console.log('📡 refreshAfterGeneration: Загружаем еженедельные отчеты для userId:', userId);
            const weeklyReports = await this.api.getWeeklyReports({ limit: 2 }, userId);
            
            if (weeklyReports && weeklyReports.success) {
                const reports = weeklyReports.reports || weeklyReports.data?.reports || [];
                if (reports.length > 0) {
                    // Обновляем отчеты
                    this.weeklyReport = reports[0];
                    this.previousWeeklyReport = reports.length > 1 ? reports[1] : null;
                    
                    // Обрабатываем новый отчет
                    this.processWeeklyReport();
                    
                    // Сохраняем в кэш с правильным ключом недели
                    const reportWeekKey = this.getReportWeekKey(this.weeklyReport);
                    if (reportWeekKey) {
                        this.saveReportToCache(this.weeklyReport, reportWeekKey);
                    }
                    
                    // Перерисовываем интерфейс
                    this.rerender();
                    
                    console.log('✅ refreshAfterGeneration: Данные успешно обновлены');
                } else {
                    console.warn('⚠️ refreshAfterGeneration: Нет отчетов после генерации');
                }
            } else {
                console.error('❌ refreshAfterGeneration: Ошибка загрузки отчетов');
            }
            
        } catch (error) {
            console.error('❌ refreshAfterGeneration: Ошибка:', error);
        }
    }
    
    /**
     * 🔧 Обработка weeklyReport (извлечение из старого метода для переиспользования)
     */
    processWeeklyReport() {
        if (!this.weeklyReport) return;
        
        // ✅ ИСПРАВЛЕНО: Вычисляем статистику ТОЛЬКО из weeklyReport данных
        this.calculateStatisticsFromWeeklyReport();

        // ✅ НОВОЕ: Если установлен флаг needsReload, инициируем тихую перезагрузку
        if (this.needsReload && !this.reportsLoading) {
            console.log('🔄 ReportsPage: Инициируем тихую перезагрузку из-за частичного отчета');
            this.needsReload = false;
            setTimeout(() => {
                this.loadReportData();
            }, 2000); // Задержка 2 сек перед повторной попыткой
        }

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
    }
    
    async loadReportData(currentWeekKey = null) {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.reportsLoading) {
            console.log('🔄 ReportsPage: Отчеты уже загружаются, пропускаем');
            return;
        }
        
        try {
            this.reportsLoading = true;
            console.log('📊 ReportsPage: Загружаем данные отчета...');
            
            // ✅ Ждем валидный userId
            const userId = await this.waitForValidUserId();
            
            // ✅ Если получили demo-user после timeout - устанавливаем null статистику
            if (userId === 'demo-user') {
                console.warn('⚠️ ReportsPage: Получен demo-user, статистика будет null');
                this.reportData.statistics = null;
                // ✅ ИСПРАВЛЕНО: Устанавливаем флаги перед выходом
                this.reportsLoaded = true;
                this.reportsLoading = false;
                return;
            }
            
            // ✅ ИСПРАВЛЕНО: Загружаем ТОЛЬКО еженедельные отчеты (убрали getWeeklyStats)
            // ✅ НОВОЕ: Загружаем 2 отчета для вычисления дельт
            console.log('📡 ReportsPage: Загружаем еженедельные отчеты для userId:', userId);
            const weeklyReports = await this.api.getWeeklyReports({ limit: 2 }, userId);
            
            // ✅ CORRECTED: Fixed report ordering - reports[0] is most recent, reports[1] is previous
            // as per API DESC ordering by sentAt
            if (weeklyReports && weeklyReports.success) {
                const reports = weeklyReports.reports || weeklyReports.data?.reports || [];
                if (reports.length > 1) {
                    this.weeklyReport = reports[0];        // Most recent report (current)
                    this.previousWeeklyReport = reports[1]; // Previous report (for deltas)
                } else if (reports.length === 1) {
                    this.weeklyReport = reports[0];         // Only one report available
                    this.previousWeeklyReport = null;
                } else {
                    this.weeklyReport = null;
                    this.previousWeeklyReport = null;
                }

            this.lastReportDate = this.weeklyReport && this.weeklyReport.sentAt
                ? new Date(this.weeklyReport.sentAt)
                : new Date();

            this.processWeeklyReport();

            // ✅ ИСПРАВЛЕНО: Используем ключ недели самого отчета, а не текущий
            if (this.isValidReport(this.weeklyReport)) {
                const reportWeekKey = this.getReportWeekKey(this.weeklyReport);
                if (reportWeekKey) {
                    this.saveReportToCache(this.weeklyReport, reportWeekKey);
                    console.log(`💾 Отчет сохранен с ключом: ${reportWeekKey}`);
                }
            }

            console.log('✅ ReportsPage: Загружен еженедельный отчет', this.weeklyReport);
            if (this.previousWeeklyReport) {
                console.log('📊 ReportsPage: Загружен предыдущий отчет для дельт', this.previousWeeklyReport);
            }
            } else {
                console.log('📊 ReportsPage: Еженедельные отчеты не найдены - новый пользователь');
                this.weeklyReport = null;
                this.previousWeeklyReport = null;
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
            
            // ✅ ИСПРАВЛЕНО: Показываем плейсхолдер только если нет weeklyReport
            if (!this.weeklyReport) {
                console.log('📊 ReportsPage: Нет отчетов - новый пользователь или еще не создан отчет');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных отчета:', error);
            
            // ✅ При ошибке API пытаемся показать последний валидный отчет из кэша
            if (currentWeekKey) {
                console.log('🔄 Пытаемся восстановить из кэша при ошибке API');
                const fallbackReport = this.loadReportFromCache(currentWeekKey);
                if (fallbackReport) {
                    console.log('✅ Восстановлен отчет из кэша при ошибке API');
                    this.weeklyReport = fallbackReport;
                    this.processWeeklyReport();
                    this.reportsLoaded = true;
                    // ✅ ИСПРАВЛЕНО: Устанавливаем правильные флаги для показа кэшированного отчета
                    this.reportsLoading = false;
                    return; // Успешно восстановили из кэша
                }
            }
            
            // ✅ Если кэш тоже пуст - устанавливаем null статистику
            this.weeklyReport = null;
            this.reportData.statistics = null;
        } finally {
            this.reportsLoading = false;
            this.rerender();
        }
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!) - БЕЗ ШАПКИ!
     * ✅ ИСПРАВЛЕНО: Отчет показывается сразу если есть, лоадер только при отсутствии отчета
     * ✅ ИСПРАВЛЕНО: Обертка в .reports-page вместо .content
     */
    render() {
        let contentHtml = '';
        
        // 1. Если идет загрузка — показываем лоадер
        if (this.reportsLoading) {
            contentHtml = `
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
        // 2. Если есть отчет — показываем его
        else if (this.weeklyReport) {
            contentHtml = this.renderWeeklyReport()
                + this.renderAIAnalysis()
                + this.renderRecommendations();
        }
        // 3. Если загрузка завершена и отчета нет — показываем плейсхолдер
        else if (this.reportsLoaded && !this.weeklyReport) {
            contentHtml = this.renderNewUserPlaceholder();
        }
        // 4. В остальных случаях — пусто
        else {
            contentHtml = '';
        }
        
        // 🔧 FIX: Wrap in .reports-page instead of .content to avoid conflicts
        return `<div class="reports-page">${contentHtml}</div>`;
    }

    /**
     * 🆕 ПЛЕЙСХОЛДЕР ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ БЕЗ ОТЧЕТОВ
     * NEW: Uses week context to show appropriate waiting message
     */
    renderNewUserPlaceholder() {
        const weekContext = this.state.getWeekContext();
        
        // Check if we're waiting for previous week report
        if (weekContext && weekContext.previous && !weekContext.previous.hasReport) {
            const previousWeekLabel = this.getPreviousWeekLabel();
            
            return `
                <div class="new-user-placeholder">
                    <div class="placeholder-content">
                        <div class="placeholder-icon">📊</div>
                        <div class="placeholder-title">Готовим ваш отчет</div>
                        <div class="placeholder-text">
                            Анализируем цитаты за <strong>${previousWeekLabel}</strong>
                        </div>
                        <div class="placeholder-hint">
                            Отчет появится в ближайшее время
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Default placeholder for new users
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
     */
    renderWeeklyReport() {
        // ✅ ИСПРАВЛЕНИЕ: Убрана проверка на reportsLoading - метод вызывается только при наличии отчета
        
        // ✅ ИСПРАВЛЕНО: Если нет weeklyReport - не рендерим ничего (плейсхолдер рендерится выше)
        if (!this.weeklyReport) {
            return '';
        }

        // ✅ НОВОЕ: Если нет статистики - не рендерим блок статистики
        if (!this.reportData.statistics) {
            console.warn('⚠️ ReportsPage: Нет статистики для отображения');
            return this.renderWeeklyReportWithoutStats();
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
        
        // ✅ NEW: ISO week date formatting using weekMeta from API response
        let reportDateText = '';
        if (this.weeklyReport && this.weeklyReport.weekMeta) {
            // Use weekMeta from the API response - this provides the exact Mon-Sun range
            reportDateText = this.weeklyReport.weekMeta.label;
        } else if (this.weeklyReport && this.weeklyReport.weekNumber && this.weeklyReport.year) {
            // Use ISO week from the report data
            if (window.DateUtils && window.DateUtils.formatIsoWeekLabel) {
                reportDateText = window.DateUtils.formatIsoWeekLabel(
                    this.weeklyReport.weekNumber, 
                    this.weeklyReport.year
                );
            } else {
                // Fallback for ISO week
                reportDateText = `Неделя ${this.weeklyReport.weekNumber}, ${this.weeklyReport.year}`;
            }
        } else if (this.lastReportDate) {
            // Legacy fallback using month-based logic (deprecated)
            if (window.DateUtils && window.DateUtils.formatReportDate) {
                reportDateText = window.DateUtils.formatReportDate(this.lastReportDate);
            } else {
                const date = this.lastReportDate;
                const monthName = date.toLocaleString('ru', { month: 'long' });
                const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                const weekNumber = Math.ceil(date.getDate() / 7);
                reportDateText = `${capitalizedMonth}, неделя ${weekNumber}`;
            }
        }
        
        // ✅ НОВОЕ: Динамический заголовок на основе данных отчета
        let reportTitle = '📈 Ваш отчет';
        if (this.weeklyReport && this.weeklyReport.weekMeta && this.weeklyReport.weekMeta.label) {
            reportTitle = `📈 Ваш отчет: ${this.weeklyReport.weekMeta.label}`;
        } else if (reportDateText) {
            reportTitle = `📈 Ваш отчет: ${reportDateText}`;
        } else {
            reportTitle = '📈 Ваш отчет за предыдущую неделю';
        }
        
        return `
            <div class="weekly-report">
                <div class="report-header">
                    <div class="report-title">${reportTitle}</div>
                    ${reportDateText && !reportTitle.includes(reportDateText) ? `<div class="report-date">${reportDateText}</div>` : ''}
                    ${this.isFallback || this.needsReload ? `<div class="report-updating">🔄 Обновляем отчёт...</div>` : ''}
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
     * 📊 Рендер еженедельного отчета без блока статистики (когда данных нет)
     */
    renderWeeklyReportWithoutStats() {
        // ✅ NEW: ISO week date formatting using weekMeta from API response
        let reportDateText = '';
        if (this.weeklyReport && this.weeklyReport.weekMeta) {
            // Use weekMeta from the API response - this provides the exact Mon-Sun range
            reportDateText = this.weeklyReport.weekMeta.label;
        } else if (this.weeklyReport && this.weeklyReport.weekNumber && this.weeklyReport.year) {
            // Use ISO week from the report data
            if (window.DateUtils && window.DateUtils.formatIsoWeekLabel) {
                reportDateText = window.DateUtils.formatIsoWeekLabel(
                    this.weeklyReport.weekNumber, 
                    this.weeklyReport.year
                );
            } else {
                // Fallback for ISO week
                reportDateText = `Неделя ${this.weeklyReport.weekNumber}, ${this.weeklyReport.year}`;
            }
        } else {
            reportDateText = 'Еженедельный отчет';
        }

        return `
            <div class="weekly-report">
                <div class="report-header">
                    <div class="report-title">📈 ${reportDateText}</div>
                </div>
                <div class="report-message">
                    <p>📊 Данные статистики недоступны</p>
                    <p>Отчет будет обновлен при появлении данных.</p>
                </div>
                <div class="report-themes">Темы: ${this.reportData.topics}</div>
            </div>
        `;
    }
    
    /**
     * 💡 AI АНАЛИЗ ОТ АННЫ - ПЕРЕИМЕНОВАННЫЙ ЗАГОЛОВОК
     */
    renderAIAnalysis() {
        // ✅ ИСПРАВЛЕНИЕ: Убрана проверка на reportsLoading - метод вызывается только при наличии отчета
        
        // ✅ ИСПРАВЛЕНО: Если нет weeklyReport - не рендерим ничего
        if (!this.weeklyReport) {
            return '';
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
        // ✅ ИСПРАВЛЕНО: Если нет weeklyReport - не рендерим ничего
        if (!this.weeklyReport) {
            return '';
        }

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

        // fallback (заглушка и кнопка) - только если есть weeklyReport но нет рекомендаций
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
   async onShow() {
       console.log('📊 ReportsPage: onShow - Starting with prefetch and ISO week logic');
       
       try {
           // ✅ НОВОЕ: Добавляем CSS классы для правильного отображения
           const container = document.getElementById('page-content');
           if (container) {
               container.classList.add('content', 'reports-page');
           }
           
           // 📅 NEW: Prefetch week context first
           await this.prefetch();
           
           // ✅ ИСПРАВЛЕНИЕ: Гарантированно сбрасываем ключевые флаги при каждом входе на страницу
           this.reportsLoading = false;
           this.reportsLoaded = false;
           
           // NEW: Use ISO week key for caching
           const currentWeekKey = this.getCurrentWeekKey();
           console.log('🔑 Текущий ISO week key:', currentWeekKey);
           
           // Store ISO week key for backward compatibility with cache mechanism
           this.isoWeekKey = currentWeekKey;
           this.lastWeekKey = currentWeekKey; // Keep for internal compatibility
           
           // ✅ ИСПРАВЛЕНО: Попробуем загрузить из кэша, но проверим ключ отчета
           let cachedReport = this.loadReportFromCache(currentWeekKey);
           
           // Если кэшированный отчет есть, но у него другой ключ недели, загружаем с правильным ключом
           if (cachedReport && this.getReportWeekKey(cachedReport) !== currentWeekKey) {
               console.log('💾 Кэшированный отчет для другой недели, ищем правильный');
               cachedReport = this.loadReportFromCache(this.getReportWeekKey(cachedReport));
           }
           
           if (cachedReport) {
               console.log('⚡ Показываем кэшированный отчет с ISO week key');
               this.weeklyReport = cachedReport;
               this.calculateStatisticsFromWeeklyReport();
               this.reportsLoaded = true;
               this.reportsLoading = false;
               this.rerender();
               
               // Silent refresh in background
               console.log('🔄 Запускаем тихий refresh с ISO week key');
               this.silentRefresh(currentWeekKey);
           } else {
               console.log('💾 Кэш пуст, загружаем данные с ISO week key');
               this.reportsLoaded = false;
               
               if (!this.weeklyReport) {
                   this.rerender(); // Show loader only if no report exists
               }
               
               // Load data with ISO week key
               await this.loadReportData(currentWeekKey);
               console.log('✅ ReportsPage: Данные загружены с ISO week key');
           }
           
       } catch (error) {
           console.error('❌ Error in ReportsPage onShow:', error);
           this.reportsLoading = false;
           this.rerender();
       }
   }
            
    /**
     * 🔄 Тихий refresh данных в фоне
     * @param {string} currentWeekKey - Текущий ключ недели
     */
    async silentRefresh(currentWeekKey) {
        try {
            console.log('🔄 Начинаем тихий refresh');
            
            // Ждем валидный userId
            const userId = await this.waitForValidUserId();
            
            if (userId === 'demo-user') {
                console.log('🔄 Demo-user, пропускаем тихий refresh');
                return;
            }
            
            // Загружаем свежие данные с API
            console.log('📡 Тихий refresh: Загружаем еженедельные отчеты для userId:', userId);
            const weeklyReports = await this.api.getWeeklyReports({ limit: 1 }, userId);
            
            if (weeklyReports && weeklyReports.success) {
                const reports = weeklyReports.reports || weeklyReports.data?.reports || [];
                if (reports.length > 0) {
                    const freshReport = reports[0];
                    
                    // Проверяем валидность свежего отчета
                    if (this.isValidReport(freshReport)) {
                        console.log('✅ Получен свежий валидный отчет, сохраняем в кэш');
                        
                        // Сохраняем в кэш
                        this.saveReportToCache(freshReport, currentWeekKey);
                        
                        // Обновляем текущие данные только если они отличаются
                        if (!this.weeklyReport || 
                            this.weeklyReport._id !== freshReport._id ||
                            this.weeklyReport.sentAt !== freshReport.sentAt) {
                            
                            console.log('🔄 Обновляем отображение свежими данными');
                            this.weeklyReport = freshReport;
                            this.processWeeklyReport();
                            this.rerender();
                        } else {
                            console.log('🔄 Данные не изменились, обновление не требуется');
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Ошибка тихого refresh (не критично):', error);
            // При ошибке тихого refresh не показываем пользователю ошибку
            // Просто логируем и продолжаем показывать кэшированные данные
        }
    }
    
    onHide() {
        console.log('📊 ReportsPage: onHide');
        
        // ✅ ИСПРАВЛЕНО: Только сбрасываем флаг загрузки, НЕ зануляем weeklyReport для мгновенного возврата
        this.reportsLoading = false;
        
        // ✅ НОВОЕ: Очистка контейнера и удаление событий
        const container = document.getElementById('page-content');
        if (container) {
            // Удаляем все обработчики событий
            const buttons = container.querySelectorAll('button, a, [onclick]');
            buttons.forEach(btn => {
                btn.replaceWith(btn.cloneNode(true));
            });
        }
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
        
        // ✅ НОВОЕ: Сброс всех ключевых флагов и данных
        this.reportsLoaded = false;
        this.reportsLoading = false;
        this.weeklyReport = null;
    }
}

// 📤 Экспорт класса
window.ReportsPage = ReportsPage;
