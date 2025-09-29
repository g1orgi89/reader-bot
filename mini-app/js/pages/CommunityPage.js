/**
 * 👥 СООБЩЕСТВО ЧИТАТЕЛЕЙ - CommunityPage.js (ИСПРАВЛЕНО - БЕЗ ШАПКИ!)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТУ ИЗ "концепт 5 страниц app.txt":
 * - 3 таба: 📰 Лента, 🏆 Топ недели, 📊 Статистика
 * - MVP версия сообщества
 * - Точная HTML структура из концепта
 * - Все элементы как в макете
 * 
 * ✅ ИСПРАВЛЕНО: БЕЗ ШАПКИ СВЕРХУ - ЧИСТЫЙ ДИЗАЙН!
 * ✅ ИСПРАВЛЕНО: Устранены дублирующиеся API вызовы как в HomePage и DiaryPage
 */

// 🎛️ FEATURE FLAG: Show/hide + (add-to-diary) button in community sections
const COMMUNITY_SHOW_ADD_BUTTON = false;

class CommunityPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.statisticsService = app.statistics || window.statisticsService;
        
        // Стейт
        this.activeTab = 'feed';
        this.isHydrated = false; // ← первый показ только после префетча
        this.communityData = { activeReaders: 0, newQuotes: 0, totalReaders: 0, totalQuotes: 0, totalAuthors: 0, daysActive: 0 };
        this.latestQuotes = [];
        this.popularQuotes = [];
        this.popularFavorites = [];
        this.popularBooks = [];
        this.recentClicks = [];
        this.leaderboard = [];
        this.userProgress = null;
        this.communityMessage = null;
        this.communityTrend = null;
        this.communityInsights = null;
        this.funFact = null;

        // 🌟 SPOTLIGHT CACHE (TTL система для предотвращения мигания)
        this._spotlightCache = {
            ts: 0,
            items: []
        };

        // 🔒 FAVORITE LOCKS (защита от двойного тапа)
        this._favoriteLocks = new Set();

        // Флаги "данные загружены"
        this.loaded = {
            latestQuotes: false,
            popularQuotes: false,
            popularBooks: false,
            recentClicks: false,
            leaderboard: false,
            stats: false,
            insights: false,
            funFact: false,
            message: false,
            trend: false,
            activityPercent: false
        };
        
        // ✅ LEGACY: Старые флаги для совместимости
        this.communityLoaded = false;
        this.communityLoading = false;
        
        // Данные для "Сейчас изучают" из StatisticsService
        this.topAnalyses = [];

        // ✅ LEGACY: Состояния загрузки для каждой секции (PR-3)
        this.loadingStates = {
            latestQuotes: false,
            popularQuotes: false,
            popularFavorites: false,
            popularBooks: false,
            recentClicks: false,
            leaderboard: false,
            stats: false,
            communityInsights: false,
            funFact: false
        };

        // ✅ LEGACY: Состояния ошибок для каждой секции (PR-3)
        this.errorStates = {
            latestQuotes: null,
            popularQuotes: null,
            popularFavorites: null,
            popularBooks: null,
            recentClicks: null,
            leaderboard: null,
            stats: null,
            communityInsights: null,
            funFact: null
        };
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // ✅ ИСПРАВЛЕНО: Убрана автозагрузка из init()
    }

    // PREFETCH: вызывается Router перед первым render — грузим всё параллельно
    async prefetch() {
        if (this.isHydrated) return; // уже есть готовые данные

        console.log('🔄 CommunityPage: Запуск prefetch - загружаем данные до рендера');

        // Параллельная загрузка без ререндера
        await Promise.allSettled([
            this._safe(async () => { const r = await this.api.getCommunityStats(); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; this.loaded.stats = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityLatestQuotes({ limit: 3 }); if (r?.success) { this.latestQuotes = r.data || []; this.loaded.latestQuotes = true; } }),
            this._safe(async () => { const r = await this.api.getTopBooks({ period: '7d', limit: 10 }); if (r?.success) { this.popularBooks = r.data || []; this.loaded.popularBooks = true; } }),
            this._safe(async () => { const r = await this.api.getCatalogRecentClicks({ limit: 3 }); if (r?.success) { this.recentClicks = r.clicks || r.data || []; this.loaded.recentClicks = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityMessage(); if (r?.success) { this.communityMessage = r.data; this.loaded.message = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityTrend(); if (r?.success) { this.communityTrend = r.data; this.loaded.trend = true; } }),
            this._safe(async () => { // Популярные избранные цитаты с улучшенным fallback
                await this.loadPopularFavorites('7d', 10);
            }),
            this._safe(async () => { // Популярные цитаты (агрегация) как fallback для spotlight
                await this.loadPopularQuotes('7d', 10);
            }),
            this._safe(async () => { // лидерборд + me
                const r = await this.api.getLeaderboard({ period: '7d', limit: 10 });
                if (r?.success) { this.leaderboard = r.data || []; this.userProgress = r.me || null; this.loaded.leaderboard = true; }
            }),
            this._safe(async () => { const r = await this.api.getCommunityInsights?.({ period: '7d' }); if (r?.success) { this.communityInsights = r.insights; this.loaded.insights = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityFunFact?.({ period: '7d' }); if (r?.success) { this.funFact = r.data; this.loaded.funFact = true; } })
        ]);

        // ✨ Инициализация spotlight кэша после загрузки основных данных
        await this._safe(async () => {
            await this.getSpotlightItems();
        });

        this.isHydrated = true; // теперь можно первый раз рендерить
        console.log('✅ CommunityPage: Prefetch завершен - данные готовы');
    }

    // Вспомогательный безопасный запуск
    async _safe(fn) { try { await fn(); } catch { /* ignore errors */ } }
    
    /**
     * Склонение слова "цитата" для корректного отображения
     * @param {number} count - Количество цитат
     * @returns {string} Правильное склонение
     */
    pluralQuotes(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
        if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
        return 'цитат';
    }
    
    setupSubscriptions() {
        // Подписки на изменения состояния, если необходимо
    }
    
    async loadCommunityData() {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.communityLoading) {
            console.log('🔄 CommunityPage: Сообщество уже загружается, пропускаем');
            return;
        }
        
        try {
            this.communityLoading = true;
            console.log('👥 CommunityPage: Загружаем данные сообщества...');
            
            const stats = await this.api.getCommunityStats();
            if (stats && stats.success) {
                this.communityData = { ...this.communityData, ...stats.data };
                this.errorStates.stats = null;
            }
            
            this.communityLoaded = true;
            this.state.set('community.lastUpdate', Date.now());
            console.log('✅ CommunityPage: Данные сообщества загружены');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных сообщества:', error);
            this.errorStates.stats = error.message || 'Ошибка загрузки статистики';
            // Используем данные из концепта как fallback
        } finally {
            this.communityLoading = false;
        }
    }

    /**
     * 📰 ЗАГРУЗКА ПОСЛЕДНИХ ЦИТАТ СООБЩЕСТВА (PR-3)
     */
    async loadLatestQuotes(limit = 5) {
        if (this.loadingStates.latestQuotes) return;
        
        try {
            this.loadingStates.latestQuotes = true;
            this.errorStates.latestQuotes = null;
            console.log('📰 CommunityPage: Загружаем последние цитаты...');
            
            const response = await this.api.getCommunityLatestQuotes({ limit });
            if (response && response.success) {
                // Нормализация: читаем из resp.data, если нет - из resp.quotes/resp.data.quotes/resp
                this.latestQuotes = response.data || response.quotes || response.data?.quotes || [];
                console.log('✅ CommunityPage: Последние цитаты загружены:', this.latestQuotes.length);
            } else {
                this.latestQuotes = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки последних цитат:', error);
            this.errorStates.latestQuotes = error.message || 'Ошибка загрузки цитат';
            this.latestQuotes = [];
        } finally {
            this.loadingStates.latestQuotes = false;
        }
    }

    /**
     * 🔥 ЗАГРУЗКА ПОПУЛЯРНЫХ ЦИТАТ СООБЩЕСТВА (PR-3)
     */
    async loadPopularQuotes(period = '7d', limit = 10) {
        if (this.loadingStates.popularQuotes) return;
        
        try {
            this.loadingStates.popularQuotes = true;
            this.errorStates.popularQuotes = null;
            console.log('🔥 CommunityPage: Загружаем популярные цитаты...');
            
            const response = await this.api.getCommunityPopularQuotes({ period, limit });
            if (response && response.success) {
                this.popularQuotes = response.data || response.quotes || [];
                console.log('✅ CommunityPage: Популярные цитаты загружены:', this.popularQuotes.length);
            } else {
                this.popularQuotes = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки популярных цитат:', error);
            this.errorStates.popularQuotes = error.message || 'Ошибка загрузки популярных цитат';
            this.popularQuotes = [];
        } finally {
            this.loadingStates.popularQuotes = false;
        }
    }

    /**
     * ❤️ ЗАГРУЗКА ПОПУЛЯРНЫХ ЦИТАТ ПО ЛАЙКАМ (НОВОЕ)
     */
    async loadPopularFavorites(period = '7d', limit = 10) {
        if (this.loadingStates.popularFavorites) return;
        
        try {
            this.loadingStates.popularFavorites = true;
            this.errorStates.popularFavorites = null;
            console.log('❤️ CommunityPage: Загружаем популярные избранные цитаты...');
            
            // Попытка загрузить избранные за 7d
            let response = await this.api.getCommunityPopularFavorites({ period, limit });
            if (response && response.success && response.data && response.data.length > 0) {
                this.popularFavorites = response.data;
                console.log('✅ CommunityPage: Популярные избранные цитаты загружены:', this.popularFavorites.length);
                return;
            }
            
            // Fallback 1: Попытка 30d если 7d пустой
            if (period === '7d') {
                console.log('🔄 Fallback 1: пытаемся загрузить избранные за 30d...');
                response = await this.api.getCommunityPopularFavorites({ period: '30d', limit });
                if (response && response.success && response.data && response.data.length > 0) {
                    this.popularFavorites = response.data;
                    console.log('✅ CommunityPage: Популярные избранные цитаты (30d) загружены:', this.popularFavorites.length);
                    return;
                }
            }
            
            // Fallback 2: Обычные популярные цитаты (агрегация)
            console.log('🔄 Fallback 2: загружаем обычные популярные цитаты (агрегация)...');
            await this.loadPopularQuotes('7d', limit);
            if (this.popularQuotes && this.popularQuotes.length > 0) {
                // Используем популярные цитаты как резерв
                this.popularFavorites = this.popularQuotes.map(q => ({
                    text: q.text,
                    author: q.author,
                    favorites: q.favorites || q.count || q.likes || 0
                }));
                console.log('✅ CommunityPage: Используем популярные цитаты как fallback:', this.popularFavorites.length);
                return;
            }
            
            // Fallback 3: Обычные популярные цитаты за 30d если 7d пустые
            console.log('🔄 Fallback 3: загружаем обычные популярные цитаты за 30d...');
            await this.loadPopularQuotes('30d', limit);
            if (this.popularQuotes && this.popularQuotes.length > 0) {
                this.popularFavorites = this.popularQuotes.map(q => ({
                    text: q.text,
                    author: q.author,
                    favorites: q.favorites || q.count || q.likes || 0
                }));
                console.log('✅ CommunityPage: Используем популярные цитаты (30d) как fallback:', this.popularFavorites.length);
                return;
            }
            
            // Если все fallback не сработали
            this.popularFavorites = [];
            console.log('⚠️ CommunityPage: Все fallback не сработали, popularFavorites пуст');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки популярных избранных цитат:', error);
            this.errorStates.popularFavorites = error.message || 'Ошибка загрузки избранных цитат';
            this.popularFavorites = [];
        } finally {
            this.loadingStates.popularFavorites = false;
        }
    }

    /**
     * 📚 ЗАГРУЗКА ПОПУЛЯРНЫХ КНИГ СООБЩЕСТВА (ОБНОВЛЕНО ДЛЯ ТОПА НЕДЕЛИ)
     */
    async loadPopularBooks(period = '7d', limit = 10) {
        if (this.loadingStates.popularBooks) return;
        
        try {
            this.loadingStates.popularBooks = true;
            this.errorStates.popularBooks = null;
            console.log('📚 CommunityPage: Загружаем популярные книги недели...');
            
            // Используем getTopBooks для получения популярных разборов недели
            const response = await this.api.getTopBooks({ period, limit });
            if (response && response.success) {
                // Нормализация: читаем из resp.data или resp.books
                this.popularBooks = response.data || response.books || [];
                console.log('✅ CommunityPage: Популярные книги недели загружены:', this.popularBooks.length);
            } else {
                this.popularBooks = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки популярных книг недели:', error);
            this.errorStates.popularBooks = error.message || 'Ошибка загрузки популярных книг';
            this.popularBooks = [];
        } finally {
            this.loadingStates.popularBooks = false;
        }
    }

    /**
     * 👆 ЗАГРУЗКА ПОСЛЕДНИХ КЛИКОВ ПО КАТАЛОГУ (PR-3)
     */
    async loadRecentClicks(limit = 5) {
        if (this.loadingStates.recentClicks) return;
        
        try {
            this.loadingStates.recentClicks = true;
            this.errorStates.recentClicks = null;
            console.log('👆 CommunityPage: Загружаем последние клики...');
            
            const response = await this.api.getCatalogRecentClicks({ limit });
            if (response && response.success) {
                // Нормализация: читаем из resp.clicks, если нет - из resp.data/items
                this.recentClicks = response.clicks || response.data || response.items || [];
                console.log('✅ CommunityPage: Последние клики загружены:', this.recentClicks.length);
            } else {
                this.recentClicks = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки последних кликов:', error);
            this.errorStates.recentClicks = error.message || 'Ошибка загрузки кликов';
            this.recentClicks = [];
        } finally {
            this.loadingStates.recentClicks = false;
        }
    }

    /**
     * 📚 ЗАГРУЗКА ТОПОВЫХ АНАЛИЗОВ ИЗ STATISTICSSERVICE
     */
    async loadTopAnalyses() {
        if (!this.statisticsService || typeof this.statisticsService.getTopAnalyses !== 'function') {
            console.warn('⚠️ CommunityPage: StatisticsService или getTopAnalyses недоступен');
            return;
        }
        
        try {
            console.log('📚 CommunityPage: Загружаем топовые анализы через StatisticsService...');
            this.topAnalyses = await this.statisticsService.getTopAnalyses(3);
            console.log('✅ CommunityPage: Топовые анализы загружены:', this.topAnalyses);
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки топовых анализов:', error);
            this.topAnalyses = []; // Fallback to empty array
        }
    }

    /**
     * 💬 ЗАГРУЗКА СООБЩЕНИЯ ОТ АННЫ (НОВОЕ)
     */
    async loadCommunityMessage() {
        try {
            console.log('💬 CommunityPage: Загружаем сообщение от Анны...');
            const response = await this.api.getCommunityMessage();
            if (response && response.success && response.data) {
                this.communityMessage = response.data;
                console.log('✅ CommunityPage: Сообщение от Анны загружено');
                return response.data;
            } else {
                // Fallback to static message
                this.communityMessage = {
                    text: "Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!",
                    time: "2 часа назад"
                };
                return this.communityMessage;
            }
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки сообщения от Анны:', error);
            // Fallback to static message
            this.communityMessage = {
                text: "Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!",
                time: "2 часа назад"
            };
            return this.communityMessage;
        }
    }

    /**
     * 📈 ЗАГРУЗКА ТРЕНДА НЕДЕЛИ (НОВОЕ)
     */
    async loadCommunityTrend() {
        try {
            console.log('📈 CommunityPage: Загружаем тренд недели...');
            const response = await this.api.getCommunityTrend();
            if (response && response.success && response.data) {
                this.communityTrend = response.data;
                console.log('✅ CommunityPage: Тренд недели загружен');
                return response.data;
            } else {
                // Fallback to static trend
                this.communityTrend = {
                    title: "Тренд недели",
                    text: 'Тема "Психология отношений" набирает популярность',
                    buttonText: "Изучить разборы"
                };
                return this.communityTrend;
            }
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки тренда недели:', error);
            // Fallback to static trend
            this.communityTrend = {
                title: "Тренд недели",
                text: 'Тема "Психология отношений" набирает популярность',
                buttonText: "Изучить разборы"
            };
            return this.communityTrend;
        }
    }
    
    /**
     * 🏆 ЗАГРУЗКА ЛИДЕРБОРДА ЗА ПЕРИОД (НОВОЕ)
     */
    async loadLeaderboard(limit = 10, period = '7d') {
        if (this.loadingStates.leaderboard) return;
        try {
            this.loadingStates.leaderboard = true;
            this.errorStates.leaderboard = null;
            console.log('🏆 CommunityPage: Загружаем лидерборд за', period);
            const resp = await this.api.getLeaderboard({ period, limit });
            if (resp && resp.success) {
                this.leaderboard = resp.data || [];
                this.userProgress = resp.me || null;
                console.log('✅ CommunityPage: Лидерборд загружен:', this.leaderboard.length, 'пользователей');
            } else {
                this.leaderboard = [];
                this.userProgress = null;
                console.warn('⚠️ CommunityPage: Некорректный ответ лидерборда');
            }
        } catch (e) {
            this.errorStates.leaderboard = e.message || 'Ошибка загрузки лидеров';
            this.leaderboard = [];
            this.userProgress = null;
            console.error('❌ CommunityPage: Ошибка загрузки лидерборда:', e);
        } finally {
            this.loadingStates.leaderboard = false;
        }
    }

    /**
     * 📊 ЗАГРУЗКА ИНСАЙТОВ СООБЩЕСТВА
     */
    async loadCommunityInsights(period = '7d') {
        if (this.loadingStates.communityInsights) return;
        
        try {
            this.loadingStates.communityInsights = true;
            this.errorStates.communityInsights = null;
            console.log('📊 CommunityPage: Загружаем инсайты сообщества за', period);
            
            const response = await this.api.getCommunityInsights({ period });
            if (response && response.success) {
                this.communityInsights = response.insights;
                console.log('✅ CommunityPage: Инсайты загружены:', this.communityInsights);
            } else {
                this.communityInsights = null;
                console.warn('⚠️ CommunityPage: Некорректный ответ инсайтов');
            }
        } catch (e) {
            this.errorStates.communityInsights = e.message || 'Ошибка загрузки инсайтов';
            this.communityInsights = null;
            console.error('❌ CommunityPage: Ошибка загрузки инсайтов:', e);
        } finally {
            this.loadingStates.communityInsights = false;
        }
    }

    /**
     * 🎉 ЗАГРУЗКА ИНТЕРЕСНОГО ФАКТА НЕДЕЛИ
     */
    async loadFunFact(period = '7d') {
        if (this.loadingStates.funFact) return;
        
        try {
            this.loadingStates.funFact = true;
            this.errorStates.funFact = null;
            console.log('🎉 CommunityPage: Загружаем интересный факт за', period);
            
            const response = await this.api.getCommunityFunFact({ period });
            if (response && response.success) {
                this.funFact = response.data;
                console.log('✅ CommunityPage: Интересный факт загружен:', this.funFact);
            } else {
                this.funFact = null;
                console.warn('⚠️ CommunityPage: Некорректный ответ факта');
            }
        } catch (e) {
            this.errorStates.funFact = e.message || 'Ошибка загрузки факта';
            this.funFact = null;
            console.error('❌ CommunityPage: Ошибка загрузки факта:', e);
        } finally {
            this.loadingStates.funFact = false;
        }
    }

    /**
     * ✨ SPOTLIGHT CACHE METHODS
     */
    
    /**
     * Проверка свежести кэша spotlight (TTL система)
     */
    isSpotlightFresh(ttlMs = 3600000) { // 1 час по умолчанию
        const now = Date.now();
        return (now - this._spotlightCache.ts) < ttlMs;
    }

    /**
     * Построение микса spotlight: 1 свежая + 2 недавние избранные
     */
    async buildSpotlightMix() {
        const items = [];
        
        // 1. Добавляем 1 свежую цитату
        if (this.latestQuotes && this.latestQuotes.length > 0) {
            const fresh = this.latestQuotes[0];
            items.push({
                kind: 'fresh',
                id: fresh.id || fresh._id,
                text: fresh.text,
                author: fresh.author,
                createdAt: fresh.createdAt,
                favorites: typeof fresh.favorites === 'number' ? fresh.favorites : 0, // Ensure favorites is numeric >=0
                user: fresh.user || null // Propagate user data if present
            });
        }
        
        // 2. Добавляем до 2 недавних избранных с fallback логикой
        let favoritesSource = [];
        
        try {
            // Попытка использовать новый endpoint для недавних избранных
            const recentResponse = await this.api.getCommunityRecentFavorites({ hours: 48, limit: 3 });
            if (recentResponse && recentResponse.success && recentResponse.data && recentResponse.data.length > 0) {
                favoritesSource = recentResponse.data;
            } else {
                throw new Error('Recent favorites endpoint не доступен или пуст');
            }
        } catch {
            console.log('🔄 Spotlight fallback: используем популярные избранные или агрегацию');
            
            // Fallback 1: popularFavorites
            if (this.popularFavorites && this.popularFavorites.length > 0) {
                favoritesSource = this.popularFavorites;
            } 
            // Fallback 2: popularQuotes (агрегация)
            else if (this.popularQuotes && this.popularQuotes.length > 0) {
                favoritesSource = this.popularQuotes.map(q => ({
                    text: q.text,
                    author: q.author,
                    favorites: q.favorites || q.count || q.likes || 0,
                    user: q.user || null // Propagate user data if available
                }));
            }
        }
        
        // Create enrichment map from popularFavorites for user info fallback
        const enrichmentMap = new Map();
        if (this.popularFavorites && this.popularFavorites.length > 0) {
            this.popularFavorites.forEach(pf => {
                if (pf.user) {
                    const key = `${pf.text.toLowerCase().trim()}||${(pf.author || '').toLowerCase().trim()}`;
                    enrichmentMap.set(key, pf.user);
                }
            });
        }
        
        // Берем первые 2 из избранных (исключая дубликат свежей цитаты)
        let addedFavorites = 0;
        for (const fav of favoritesSource) {
            if (addedFavorites >= 2) break;
            
            // Проверяем, не дублируется ли с fresh цитатой
            const isDuplicate = items.some(item => 
                item.text === fav.text && item.author === fav.author
            );
            
            if (!isDuplicate) {
                // Use returned user directly from fav.user, with enrichment fallback
                let user = fav.user || null;
                
                // If no user but we have enrichment data, try to enrich
                if (!user && enrichmentMap.size > 0) {
                    const enrichmentKey = `${fav.text.toLowerCase().trim()}||${(fav.author || '').toLowerCase().trim()}`;
                    user = enrichmentMap.get(enrichmentKey) || null;
                }
                
                items.push({
                    kind: 'fav',
                    id: fav.id || fav._id,
                    text: fav.text,
                    author: fav.author,
                    favorites: typeof fav.favorites === 'number' ? fav.favorites : 0, // Ensure favorites is numeric >=0
                    user: user // Use enriched user data
                });
                addedFavorites++;
            }
        }
        
        return items.slice(0, 3); // Гарантируем максимум 3 элемента
    }

    /**
     * Получение spotlight элементов с учетом кэша
     */
    async getSpotlightItems() {
        if (this.isSpotlightFresh()) {
            return this._spotlightCache.items;
        }
        
        // Обновляем кэш
        this._spotlightCache.items = await this.buildSpotlightMix();
        this._spotlightCache.ts = Date.now();
        
        return this._spotlightCache.items;
    }

    /**
     * ✨ Рендер секции "Сейчас в сообществе"
     */
    renderSpotlightSection() {
        // Для рендера используем кэшированные данные если есть, иначе показываем скелетон
        const items = this.isSpotlightFresh() ? this._spotlightCache.items : [];
        
        let cards = '';
        
        if (!items || items.length === 0) {
            // Если кэш пуст, инициируем загрузку в фоне
            if (!this.isSpotlightFresh()) {
                this.getSpotlightItems().then(() => {
                    // Обновляем интерфейс после загрузки
                    this.rerender?.();
                }).catch(error => {
                    console.warn('Spotlight загрузка не удалась:', error);
                });
            }
            
            // Показываем скелетон вместо пустой секции
            cards = `
                <div class="quote-card skeleton">
                    <div class="spotlight-badge">Загрузка...</div>
                    <div class="quote-card__header">
                        <div class="quote-card__user-avatar">
                            <div class="avatar-initials">?</div>
                        </div>
                        <div class="quote-card__user">
                            <span class="quote-card__user-name">Загрузка...</span>
                        </div>
                    </div>
                    <div class="quote-card__text">Загружаем свежие цитаты сообщества...</div>
                    <div class="quote-card__author">— Подождите</div>
                    <div class="quote-card__footer">
                        <div class="quote-card__likes">❤ 0</div>
                        <div class="quote-card__actions"></div>
                    </div>
                </div>
            `;
        } else {
            // Отображаем настоящие карточки
            cards = items.map(item => {
                const badge = item.kind === 'fresh' ? 'Новое' : 'Избранное';
                const badgeClass = item.kind === 'fresh' ? 'spotlight-card--fresh' : 'spotlight-card--fav';
                
                // Получаем пользователя из item.user (должно прийти от бэкенда)
                const user = item.user;
                const userAvatarHtml = this.getUserAvatarHtml(user);
                const userName = user?.name || 'Пользователь';
                
                // Лайки для футера
                const likesCount = item.favorites || 0;
                
                return `
                    <div class="quote-card ${badgeClass}" data-quote-id="${item.id || ''}">
                        <div class="spotlight-badge">${badge}</div>
                        
                        <!-- Header с аватаром и именем пользователя -->
                        <div class="quote-card__header">
                            ${userAvatarHtml}
                            <div class="quote-card__user">
                                <span class="quote-card__user-name">${this.escapeHtml(userName)}</span>
                            </div>
                        </div>
                        
                        <!-- Основной контент -->
                        <div class="quote-card__text">"${this.escapeHtml(item.text)}"</div>
                        <div class="quote-card__author">— ${this.escapeHtml(item.author || 'Неизвестный автор')}</div>
                        
                        <!-- Footer с лайками слева и действиями справа -->
                        <div class="quote-card__footer">
                            <div class="quote-card__likes">
                                ❤ <span class="favorites-count">${likesCount}</span>
                            </div>
                            <div class="quote-card__actions">
                                ${COMMUNITY_SHOW_ADD_BUTTON ? `<button class="quote-card__add-btn" 
                                        data-quote-id="${item.id || ''}"
                                        data-quote-text="${this.escapeHtml(item.text)}"
                                        data-quote-author="${this.escapeHtml(item.author || 'Неизвестный автор')}"
                                        aria-label="Добавить цитату в дневник">+</button>` : ''}
                                <button class="quote-card__heart-btn" 
                                        data-quote-id="${item.id || ''}"
                                        data-quote-text="${this.escapeHtml(item.text)}"
                                        data-quote-author="${this.escapeHtml(item.author || 'Неизвестный автор')}"
                                        data-favorites="${likesCount}"
                                        aria-label="Добавить в избранное">♡</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // ALWAYS render container (with refresh button) even if no items
        return `
            <div class="community-spotlight">
                <div class="spotlight-header">
                    <h3 class="spotlight-title">✨ Сейчас в сообществе</h3>
                    <button class="spotlight-refresh-btn" id="spotlightRefreshBtn" 
                            aria-label="Обновить подборку">↻</button>
                </div>
                <div class="spotlight-grid">
                    ${cards}
                </div>
            </div>
        `;
    }

    /**
     * Форматирование даты для spotlight (сегодня/вчера/ч назад)
     */
    formatSpotlightDate(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - d);
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'сегодня';
        if (diffDays === 1) return 'вчера';
        if (diffHours <= 24) return `${diffHours}ч назад`;
        
        return d.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }

    /**
     * Экранирование HTML для безопасности
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 🖼️ Построение HTML для аватара пользователя с фоллбэком на инициалы
     * @param {Object} user - объект пользователя с полями userId, name, avatarUrl
     * @returns {string} HTML строка с аватаром или инициалами
     */
    getUserAvatarHtml(user) {
        if (!user) {
            // Фоллбэк если пользователь отсутствует
            return `<div class="quote-card__user-avatar">
                <div class="avatar-initials">?</div>
            </div>`;
        }
        
        const name = user.name || 'Пользователь';
        const initials = this.getInitials(name);
        
        if (user.avatarUrl) {
            // Есть аватар - показываем изображение с фоллбэком на инициалы
            return `<div class="quote-card__user-avatar">
                <img src="${this.escapeHtml(user.avatarUrl)}" 
                     alt="${this.escapeHtml(name)}" 
                     class="avatar-image"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                <div class="avatar-initials" style="display:none;">${initials}</div>
            </div>`;
        } else {
            // Нет аватара - показываем инициалы
            return `<div class="quote-card__user-avatar">
                <div class="avatar-initials">${initials}</div>
            </div>`;
        }
    }
    
    /**
     * 👤 Получение инициалов из имени (до 2 букв, заглавные)
     * @param {string} name - имя пользователя
     * @returns {string} инициалы (например, "АБ")
     */
    getInitials(name) {
        if (!name || typeof name !== 'string') return '?';
        
        const parts = name.trim().split(/\s+/);
        if (parts.length === 0) return '?';
        
        // Берем первые буквы до 2 частей имени
        const initials = parts
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join('');
            
        return initials || '?';
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!) - БЕЗ ШАПКИ!
     */
    render() {
        if (!this.isHydrated) {
            // Возвращаем пустую строку, Router удерживает предыдущую страницу на экране до готовности
            return '';
        }

        return `
            <div class="content">
                ${this.renderTabs()}
                ${this.renderTabContent()}
            </div>
        `;
    }
    
    /**
     * 📑 ТАБЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderTabs() {
        return `
            <div class="tabs">
                <button class="tab ${this.activeTab === 'feed' ? 'active' : ''}" data-tab="feed">📰 Лента</button>
                <button class="tab ${this.activeTab === 'top' ? 'active' : ''}" data-tab="top">🏆 Топ недели</button>
                <button class="tab ${this.activeTab === 'stats' ? 'active' : ''}" data-tab="stats">📊 Статистика</button>
            </div>
        `;
    }
    
    renderTabContent() {
        switch (this.activeTab) {
            case 'feed':
                return this.renderFeedTab();
            case 'top':
                return this.renderTopTab();
            case 'stats':
                return this.renderStatsTab();
            default:
                return this.renderFeedTab();
        }
    }
    
    /**
     * 📰 ТАБ ЛЕНТА (ОБНОВЛЕН ДЛЯ PR-3 - РЕАЛЬНЫЕ ДАННЫЕ ИЗ API!)
     */
    renderFeedTab() {
        // ✨ НОВОЕ: Spotlight секция (1 свежая + 2 недавние избранные) - заменяет "Последние цитаты"
        const spotlightSection = this.renderSpotlightSection();
        
        // "Сейчас изучают" секция с последними кликами по каталогу
        const currentlyStudyingSection = this.renderCurrentlyStudyingSection();
        
        // Сообщение от Анны с fallback
        const annaMessageSection = this.renderAnnaMessageSection();
        
        // Тренд недели с fallback
        const trendSection = this.renderTrendSection();
        
        return `
            <div class="stats-summary">
                📊 Сегодня: ${this.communityData.activeReaders} активных читателей • ${this.communityData.newQuotes} новых цитат
            </div>
            
            ${spotlightSection}
            
            ${currentlyStudyingSection}
            
            ${annaMessageSection}
            
            ${trendSection}
        `;
    }

    /**
     * 📰 СЕКЦИЯ ПОСЛЕДНИХ ЦИТАТ СООБЩЕСТВА (ОБНОВЛЕНО ДЛЯ PR-3)
     */
    renderLatestQuotesSection() {
        // Если данные загружены, но список пуст - показываем empty state
        if (this.loaded.latestQuotes && (!this.latestQuotes || this.latestQuotes.length === 0)) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-title">Пока нет цитат</div>
                    <div class="empty-description">Станьте первым, кто поделится мудростью!</div>
                </div>
            `;
        }

        // Если данные ещё не загружены — ничего не показываем (без заглушек)
        if (!this.latestQuotes || this.latestQuotes.length === 0) {
            return '';
        }

        const quotesCards = this.latestQuotes.slice(0, 3).map((quote, index) => {
            return `
                <div class="quote-card" data-quote-id="${quote.id || index}">
                    <div class="quote-card__content">
                        <div class="quote-card__text">"${quote.text || quote.content || ''}"</div>
                        <div class="quote-card__author">— ${quote.author || 'Неизвестный автор'}</div>
                        <div class="quote-card__meta">
                            <span class="quote-card__date">${this.formatDate(quote.createdAt || quote.date)}</span>
                            <div class="quote-card__actions">
                                <button class="quote-card__fav-btn" data-quote-id="${quote.id || index}"
                                        data-quote-text="${(quote.text || quote.content || '').replace(/"/g, '&quot;')}"
                                        data-quote-author="${(quote.author || 'Неизвестный автор').replace(/"/g, '&quot;')}"
                                        style="min-height: var(--touch-target-min);" aria-label="Добавить в избранное">♡</button>
                                <button class="quote-card__add-btn" data-quote-id="${quote.id || index}"
                                        data-quote-text="${(quote.text || quote.content || '').replace(/"/g, '&quot;')}"
                                        data-quote-author="${(quote.author || 'Неизвестный автор').replace(/"/g, '&quot;')}"
                                        style="min-height: var(--touch-target-min);" aria-label="Добавить цитату в дневник">
                                  <span class="add-icon">+</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="latest-quotes-section">
                <div class="mvp-community-title">💫 Последние цитаты сообщества</div>
                <div class="quotes-grid">
                    ${quotesCards}
                </div>
            </div>
        `;
    }
    
    /**
     * 📚 СЕКЦИЯ "СЕЙЧАС ИЗУЧАЮТ" (ОБНОВЛЕНО: ПОКАЗЫВАЕТ ПОСЛЕДНИЕ КЛИКИ ПО КАТАЛОГУ)
     */
    renderCurrentlyStudyingSection() {
        if (this.loadingStates.recentClicks) {
            return `
                <div class="mvp-community-item">
                    <div class="mvp-community-title">📚 Сейчас изучают</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем последние разборы...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.recentClicks) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки</div>
                    <div class="error-description">${this.errorStates.recentClicks}</div>
                    <button class="error-retry-btn" data-retry="recent-clicks" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.recentClicks || this.recentClicks.length === 0) {
            return `
                <div class="mvp-community-item">
                    <div class="mvp-community-title">📚 Сейчас изучают</div>
                    <div class="mvp-community-text">Пока нет активности</div>
                    <div class="mvp-community-author">Данные обновляются</div>
                </div>
            `;
        }
        
        const recentClicksCards = this.recentClicks.slice(0, 3).map((click, _index) => `
            <div class="currently-studying-item" data-book-id="${click.book?.id || click.bookId || click.id}" style="margin-bottom: var(--spacing-sm); min-height: var(--touch-target-min);">
                <div class="studying-rank">${_index + 1}</div>
                <div class="studying-content">
                    <div class="studying-title">${click.book?.title || click.bookTitle || click.title || 'Неизвестная книга'}</div>
                    <div class="studying-author">${click.book?.author || click.bookAuthor || click.author || 'Неизвестный автор'}</div>
                    <div class="studying-stats">${this.formatClickTime(click.timestamp || click.clickTime || click.createdAt)}</div>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="currently-studying-section">
                <div class="mvp-community-title">📚 Сейчас изучают</div>
                <div class="currently-studying-list">
                    ${recentClicksCards}
                </div>
            </div>
        `;
    }
    
    /**
     * 💬 СЕКЦИЯ СООБЩЕНИЯ ОТ АННЫ (НОВАЯ С API И FALLBACK)
     */
    renderAnnaMessageSection() {
        const message = this.communityMessage || {
            text: "Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!",
            time: "2 часа назад"
        };

        return `
            <div class="anna-message-block">
                <div class="anna-message-header">💬 Сообщение от Анны</div>
                <div class="anna-message-text">"${message.text}"</div>
                <div class="anna-message-time">${message.time}</div>
            </div>
        `;
    }

    /**
     * 📈 СЕКЦИЯ ТРЕНДА НЕДЕЛИ (НОВАЯ С API И FALLBACK)
     */
    renderTrendSection() {
        const trend = this.communityTrend || {
            title: "Тренд недели",
            text: 'Тема "Психология отношений" набирает популярность',
            buttonText: "Изучить разборы"
        };

        return `
            <div class="promo-section">
                <div class="promo-title">🎯 ${trend.title}</div>
                <div class="promo-text">${trend.text}</div>
                <button class="promo-btn" 
                        id="exploreBtn"
                        style="min-height: var(--touch-target-min);">
                    ${trend.buttonText}
                </button>
            </div>
        `;
    }
    
    /**
     * 🏆 ТАБ ТОП НЕДЕЛИ (REDESIGNED - NEW ORDER AND STRUCTURE!)
     */
    renderTopTab() {
        // New order per requirements:
        // 1. Community stats cards
        // 2. Leaderboard (Top 3)
        // 3. Popular quotes week (Top 3, new design)
        // 4. Popular books week
        // 5. User progress
        
        const statsSection = this.renderCommunityStatsCards();
        const leaderboardSection = this.renderLeaderboardSection();
        const popularQuotesSection = this.renderPopularQuotesWeekSection();
        const popularBooksSection = this.renderPopularBooksSection();
        const userProgressSection = this.renderUserProgressSection();

        return `
            ${statsSection}
            ${leaderboardSection}
            ${popularQuotesSection}
            ${popularBooksSection}
            ${userProgressSection}
        `;
    }

    /**
     * 📊 COMMUNITY STATS CARDS SECTION (SECTION 1)
     */
    renderCommunityStatsCards() {
        return `
            <div class="community-stats-grid">
                <div class="community-stat-card">
                    <div class="community-stat-number">${this.communityData.activeReaders}</div>
                    <div class="community-stat-label">Активных читателей</div>
                </div>
                <div class="community-stat-card">
                    <div class="community-stat-number">${this.communityData.newQuotes}</div>
                    <div class="community-stat-label">Новых цитат</div>
                </div>
            </div>
        `;
    }

    /**
     * 🖼️ Render user avatar with fallback to initials
     */
    renderUserAvatar(avatarUrl, initials) {
        if (avatarUrl) {
            return `
                <div class="leader-avatar">
                    <img class="leader-avatar-img" src="${avatarUrl}" alt="Аватар" 
                         onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                    <div class="leader-avatar-fallback">${initials || 'А'}</div>
                </div>
            `;
        } else {
            return `
                <div class="leader-avatar fallback">
                    <div class="leader-avatar-fallback">${initials || 'А'}</div>
                </div>
            `;
        }
    }
    
    /**
     * 🏆 LEADERBOARD SECTION - TOP 3 ONLY (SECTION 2)
     */
    renderLeaderboardSection() {
        if (this.loadingStates.leaderboard) {
            return `
                <div class="leaders-week-section">
                    <div class="leaders-week-title">🏆 Лидеры недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем лидерборд...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.leaderboard) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки лидерборда</div>
                    <div class="error-description">${this.errorStates.leaderboard}</div>
                    <button class="error-retry-btn" data-retry="leaderboard" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.leaderboard || this.leaderboard.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">🏆</div>
                    <div class="empty-title">Пока нет лидеров</div>
                    <div class="empty-description">Станьте первым в топе читателей!</div>
                </div>
            `;
        }

        // TOP 3 only per requirements
        const leaderboardItems = this.leaderboard.slice(0, 3).map((leader, index) => {
            const position = index + 1;
            const badgeClass = position === 1 ? 'gold' : position === 2 ? 'silver' : 'bronze';
            const count = leader.quotesWeek ?? leader.quotes ?? 0;
            const name = leader.name || 'Анонимный читатель';
            const initials = this.getInitials(name);
            const avatarUrl = leader.avatarUrl; // Assuming API provides avatarUrl

            return `
                <div class="leaderboard-item">
                    <div class="rank-badge ${badgeClass}">${position}</div>
                    ${this.renderUserAvatar(avatarUrl, initials)}
                    <div class="leader-info">
                        <div class="leader-name">${name}</div>
                        <div class="leader-stats">${count} цитат за неделю</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="leaders-week-section">
                <div class="leaders-week-title">🏆 Лидеры недели</div>
                <div class="leaders-week-subtitle">Самые активные читатели сообщества</div>
                <div class="leaderboard-list">
                    ${leaderboardItems}
                </div>
            </div>
        `;
    }

    /**
     * ⭐ POPULAR QUOTES WEEK SECTION - SPOTLIGHT-STYLE DESIGN (SECTION 3)
     */
    renderPopularQuotesWeekSection() {
        if (this.loadingStates.popularFavorites) {
            return `
                <div class="popular-quotes-week-section">
                    <div class="popular-quotes-week-title">⭐ Популярные цитаты недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем топ цитат...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.popularFavorites) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки цитат</div>
                    <div class="error-description">${this.errorStates.popularFavorites}</div>
                    <button class="error-retry-btn" data-retry="popular-favorites" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        // Use popularFavorites if available, otherwise fallback to popularQuotes
        const quotes = this.popularFavorites?.length > 0 ? this.popularFavorites : this.popularQuotes || [];
        
        if (quotes.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <div class="empty-title">Пока нет популярных цитат</div>
                    <div class="empty-description">Станьте первым, кто добавит цитату в избранное!</div>
                </div>
            `;
        }

        // TOP 3 quotes with Spotlight-style design and working buttons
        const quotesCards = quotes.slice(0, 3).map((quote, _index) => {
            const favorites = quote.favorites || quote.count || 0;
            
            // Получаем пользователя из quote.user (должно прийти от бэкенда)
            const user = quote.user;
            const userAvatarHtml = this.getUserAvatarHtml(user);
            const userName = user?.name || 'Пользователь';
            
            return `
                <div class="quote-card popular-quote-card" data-quote-id="${quote.id || ''}">
                    <!-- Header с аватаром и именем пользователя -->
                    <div class="quote-card__header">
                        ${userAvatarHtml}
                        <div class="quote-card__user">
                            <span class="quote-card__user-name">${this.escapeHtml(userName)}</span>
                        </div>
                    </div>
                    
                    <!-- Основной контент -->
                    <div class="quote-card__text">"${this.escapeHtml(quote.text || '')}"</div>
                    <div class="quote-card__author">— ${this.escapeHtml(quote.author || 'Неизвестный автор')}</div>
                    
                    <!-- Footer с лайками слева и действиями справа -->
                    <div class="quote-card__footer">
                        <div class="quote-card__likes">
                            ❤ <span class="favorites-count">${favorites}</span>
                        </div>
                        <div class="quote-card__actions">
                            ${COMMUNITY_SHOW_ADD_BUTTON ? `<button class="quote-card__add-btn" 
                                    data-quote-id="${quote.id || ''}"
                                    data-quote-text="${this.escapeHtml(quote.text || '')}"
                                    data-quote-author="${this.escapeHtml(quote.author || 'Неизвестный автор')}"
                                    aria-label="Добавить цитату в дневник">+</button>` : ''}
                            <button class="quote-card__heart-btn" 
                                    data-quote-id="${quote.id || ''}"
                                    data-quote-text="${this.escapeHtml(quote.text || '')}"
                                    data-quote-author="${this.escapeHtml(quote.author || 'Неизвестный автор')}"
                                    data-favorites="${favorites}"
                                    aria-label="Добавить в избранное">♡</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="popular-quotes-week-section">
                <div class="popular-quotes-week-title">⭐ Популярные цитаты недели</div>
                <div class="popular-quotes-grid">
                    ${quotesCards}
                </div>
            </div>
        `;
    }

    /**
     * 🎯 USER PROGRESS SECTION WITH ACTIVITY PERCENTAGE (SECTION 5)
     */
    renderUserProgressSection() {
        if (!this.userProgress) {
            return `
                <div class="user-progress-section">
                    <div class="progress-header">🎯 Ваш прогресс в топах</div>
                    <div class="progress-stats">Загрузка данных о прогрессе...</div>
                    <div class="progress-bar-white">
                        <div class="progress-fill-white" style="width: 0%;"></div>
                    </div>
                    <div class="progress-description">Ваша позиция обновляется...</div>
                </div>
            `;
        }

        const { position, quotesWeek, percentile, deltaToNext, activityPercent } = this.userProgress;
        
        // Calculate progress bar relative to leader
        const leaderCount = this.leaderboard.length > 0 ? (this.leaderboard[0].quotesWeek ?? this.leaderboard[0].quotes ?? 0) : 1;
        const progressPercent = Math.min(100, Math.round((quotesWeek / Math.max(1, leaderCount)) * 100));
        
        // Progress text
        let progressText;
        if (position === 1) {
            progressText = "Вы лидер недели! Поздравляем! 🎉";
        } else {
            const quotesNeeded = deltaToNext || 1;
            const quotesWord = this.pluralQuotes(quotesNeeded);
            progressText = `Добавьте ещё ${quotesNeeded} ${quotesWord} до следующего места`;
        }

        return `
            <div class="user-progress-section">
                <div class="progress-header">🎯 Ваш прогресс в топах</div>
                <div class="progress-stats">
                    Место: #${position} • За неделю: ${quotesWeek} • Активнее ${percentile || activityPercent || 0}% участников
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-description">${progressText}</div>
            </div>
        `;
    }

    /**
     * ⭐ СЕКЦИЯ ПОПУЛЯРНЫХ ЦИТАТ (НОВАЯ ДЛЯ PR-3)
     */
    renderPopularQuotesSection() {
        if (this.loadingStates.popularQuotes) {
            return `
                <div class="popular-quotes-section">
                    <div class="popular-quotes-title">⭐ Популярные цитаты недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем популярные цитаты...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.popularQuotes) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки цитат</div>
                    <div class="error-description">${this.errorStates.popularQuotes}</div>
                    <button class="error-retry-btn" data-retry="popular-quotes" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.popularQuotes || this.popularQuotes.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <div class="empty-title">Пока нет популярных цитат</div>
                    <div class="empty-description">Добавляйте цитаты чтобы увидеть популярные!</div>
                </div>
            `;
        }

        const quotesItems = this.popularQuotes.slice(0, 3).map(quote => `
            <div class="quote-item">
                <div class="quote-text">"${quote.text}"</div>
                <div class="quote-meta">${quote.author} • добавили ${quote.count || 0} человек</div>
            </div>
        `).join('');

        return `
            <div class="popular-quotes-section">
                <div class="popular-quotes-title">⭐ Популярные цитаты недели</div>
                ${quotesItems}
            </div>
        `;
    }

    /**
     * 📚 СЕКЦИЯ ПОПУЛЯРНЫХ КНИГ (НОВАЯ ДЛЯ PR-3)
     */
    renderPopularBooksSection() {
        if (this.loadingStates.popularBooks) {
            return `
                <div class="popular-books-section">
                    <div class="popular-books-title">📚 Популярные разборы недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем популярные книги...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.popularBooks) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки книг</div>
                    <div class="error-description">${this.errorStates.popularBooks}</div>
                    <button class="error-retry-btn" data-retry="popular-books" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.popularBooks || this.popularBooks.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <div class="empty-title">Пока нет популярных книг</div>
                    <div class="empty-description">Изучайте разборы чтобы увидеть популярные!</div>
                </div>
            `;
        }

        const booksItems = this.popularBooks.slice(0, 3).map((book, index) => `
            <div class="book-item">
                <div class="book-title-line">${index + 1}. "${book.title}" ${book.author}</div>
                <div class="book-interest-line">💫 ${book.clicksCount || 0} человек заинтересовалось</div>
            </div>
        `).join('');

        return `
            <div class="popular-books-section">
                <div class="popular-books-title">📚 Популярные разборы недели</div>
                ${booksItems}
            </div>
        `;
    }
    
    /**
     * 📊 ТАБ СТАТИСТИКА (ИЗ ДОПОЛНИТЕЛЬНОГО КОНЦЕПТА!)
     */
    renderStatsTab() {
        // Интерес к разборам
        const interestSection = this.renderInterestSection();
        
        // Популярные авторы
        const authorsSection = this.renderPopularAuthorsSection();
        
        // Достижения сообщества
        const achievementsSection = this.renderAchievementsSection();
        
        // Рейтинг пользователя
        const userRatingSection = this.renderUserRatingSection();
        
        // Интересный факт
        const factSection = this.renderFunFactSection();
        
        return `
            <div class="community-stats-overview">
                <div class="community-stats-title">📈 Общая статистика сообщества</div>
                <div class="community-stats-2x2-grid">
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.totalReaders.toLocaleString()}</div>
                        <div class="community-stat-small-label">Всего читателей</div>
                    </div>
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.totalQuotes.toLocaleString()}</div>
                        <div class="community-stat-small-label">Цитат собрано</div>
                    </div>
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.totalAuthors}</div>
                        <div class="community-stat-small-label">Авторов</div>
                    </div>
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.daysActive}</div>
                        <div class="community-stat-small-label">Дней работы</div>
                    </div>
                </div>
            </div>
            
            ${interestSection}
            ${authorsSection}
            ${achievementsSection}
            ${userRatingSection}
            ${factSection}
        `;
    }

    /**
     * 📚 СЕКЦИЯ ИНТЕРЕСА К РАЗБОРАМ (ДИНАМИЧЕСКАЯ)
     */
    renderInterestSection() {
        if (!this.communityInsights?.interest) {
            return `
                <div class="stats-detail-section">
                    <div class="stats-detail-title">📚 Интерес к разборам</div>
                    <div class="stats-detail-item">📊 Данные загружаются...</div>
                </div>
            `;
        }

        const interest = this.communityInsights.interest;
        const leader = interest.leader;
        const growthText = interest.growthPct > 0 ? `+${interest.growthPct}%` : 
                          interest.growthPct < 0 ? `${interest.growthPct}%` : '0%';
        
        return `
            <div class="stats-detail-section">
                <div class="stats-detail-title">📚 Интерес к разборам</div>
                ${leader ? `<div class="stats-detail-item">🔥 Лидер недели: "${leader.title}" — ${leader.author}</div>` : ''}
                <div class="stats-detail-item">📈 Рост интереса: ${growthText} к прошлой неделе</div>
                <div class="stats-detail-item">📖 Активно изучают ${interest.activelyStudying} разборов</div>
            </div>
        `;
    }

    /**
     * ✍️ СЕКЦИЯ ПОПУЛЯРНЫХ АВТОРОВ (ДИНАМИЧЕСКАЯ)
     */
    renderPopularAuthorsSection() {
        if (!this.communityInsights?.topAuthors || this.communityInsights.topAuthors.length === 0) {
            return `
                <div class="stats-detail-section">
                    <div class="stats-detail-title">✍️ Популярные авторы в цитатах</div>
                    <div class="stats-detail-item">📊 Данные загружаются...</div>
                </div>
            `;
        }

        const authorsItems = this.communityInsights.topAuthors.slice(0, 5).map((author, index) => {
            const count = author.count;
            const plural = count % 10 === 1 && count % 100 !== 11 ? 'цитата' : 
                          (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) ? 'цитаты' : 'цитат';
            return `<div class="stats-detail-item">${index + 1}. ${author.author} — ${count} ${plural}</div>`;
        }).join('');

        return `
            <div class="stats-detail-section">
                <div class="stats-detail-title">✍️ Популярные авторы в цитатах</div>
                ${authorsItems}
            </div>
        `;
    }

    /**
     * 🏆 СЕКЦИЯ ДОСТИЖЕНИЙ СООБЩЕСТВА (ДИНАМИЧЕСКАЯ)
     */
    renderAchievementsSection() {
        if (!this.communityInsights?.achievements || this.communityInsights.achievements.length === 0) {
            return `
                <div class="stats-detail-section">
                    <div class="stats-detail-title">🏆 Достижения сообщества</div>
                    <div class="stats-detail-item">📊 Данные загружаются...</div>
                </div>
            `;
        }

        const achievementItems = this.communityInsights.achievements.map(achievement => {
            const users = achievement.users;
            const plural = users % 10 === 1 && users % 100 !== 11 ? 'человек' : 
                          (users % 10 >= 2 && users % 10 <= 4 && (users % 100 < 10 || users % 100 >= 20)) ? 'человека' : 'человек';
            let icon = '📖';
            let title = 'Активные читатели';
            
            if (achievement.threshold === '20+') {
                icon = '🔥';
                title = 'Коллекционеры мудрости';
            } else if (achievement.threshold === '10+') {
                icon = '⭐';
                title = 'Философы недели';
            } else if (achievement.threshold === '7+') {
                icon = '💎';
                title = 'Мыслители';
            } else if (achievement.threshold === '5+') {
                icon = '📚';
                title = 'Любители классики';
            } else if (achievement.threshold === '3+') {
                icon = '✨';
                title = 'Вдохновители';
            }
            
            return `<div class="stats-detail-item">${icon} "${title}" — ${users} ${plural}</div>`;
        }).join('');

        return `
            <div class="stats-detail-section">
                <div class="stats-detail-title">🏆 Достижения сообщества</div>
                ${achievementItems}
            </div>
        `;
    }

    /**
     * 📊 СЕКЦИЯ РЕЙТИНГА ПОЛЬЗОВАТЕЛЯ (ДИНАМИЧЕСКАЯ)
     */
    renderUserRatingSection() {
        if (!this.communityInsights?.userRating) {
            return `
                <div class="user-rating-section">
                    <div class="user-rating-title">📊 Ваш рейтинг</div>
                    <div class="user-rating-grid">
                        <div class="user-rating-item">
                            <div class="user-rating-value">—</div>
                            <div class="user-rating-label">Место в топе</div>
                        </div>
                        <div class="user-rating-item">
                            <div class="user-rating-value">—</div>
                            <div class="user-rating-label">Активнее других</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const userRating = this.communityInsights.userRating;
        
        return `
            <div class="user-rating-section">
                <div class="user-rating-title">📊 Ваш рейтинг</div>
                <div class="user-rating-grid">
                    <div class="user-rating-item">
                        <div class="user-rating-value">#${userRating.position}</div>
                        <div class="user-rating-label">Место в топе</div>
                    </div>
                    <div class="user-rating-item">
                        <div class="user-rating-value">${userRating.percentile}%</div>
                        <div class="user-rating-label">Активнее других</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * ✨ СЕКЦИЯ ИНТЕРЕСНОГО ФАКТА (ДИНАМИЧЕСКАЯ)
     */
    renderFunFactSection() {
        const factText = this.funFact || 'Данные загружаются...';
        
        return `
            <div class="fact-section">
                <div class="fact-title">✨ Интересный факт</div>
                <div class="fact-text">${factText}</div>
            </div>
        `;
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ СОБЫТИЙ (ОБНОВЛЕН ДЛЯ PR-3)
     */
    attachEventListeners() {
        this.attachTabListeners();
        this.attachExploreButton();
        this.attachCurrentlyStudyingListeners();
        this.attachCommunityCardListeners(); // ✅ НОВОЕ: Haptic feedback для карточек
        this.attachRetryButtons(); // ✅ НОВОЕ PR-3
        this.attachQuoteCardListeners(); // ✅ НОВОЕ: Обработчики для карточек цитат
        this.attachSpotlightRefreshButton(); // ✅ НОВОЕ: Кнопка обновления spotlight
        this.setupQuoteChangeListeners();
    }

    /**
     * 💬 ОБРАБОТЧИКИ ДЛЯ КАРТОЧЕК ЦИТАТ (НОВОЕ ДЛЯ PR-3)
     */
    attachQuoteCardListeners() {
        // Обработчики для кнопок добавления цитат
        const addButtons = document.querySelectorAll('.quote-card__add-btn');
        addButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                this.addQuoteToJournal(event);
            });
        });

        // Обработчики для кнопок сердечка (избранное) - поддерживаем оба класса
        const heartButtons = document.querySelectorAll('.quote-card__heart-btn, .quote-card__fav-btn');
        heartButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                this.addQuoteToFavorites(event);
            });
        });
    }
    
    /**
     * 📳 ЕДИНЫЙ МЕТОД ДЛЯ HAPTIC FEEDBACK
     * @param {string} type - Тип обратной связи: 'light', 'medium', 'heavy', 'success', 'error'
     */
    triggerHapticFeedback(type = 'light') {
        if (this.telegram?.HapticFeedback) {
            switch (type) {
                case 'light':
                    this.telegram.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    this.telegram.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    this.telegram.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'success':
                    this.telegram.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    this.telegram.HapticFeedback.notificationOccurred('error');
                    break;
                case 'warning':
                    this.telegram.HapticFeedback.notificationOccurred('warning');
                    break;
            }
        }
    }

    attachTabListeners() {
        const tabs = document.querySelectorAll('.tab[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    attachExploreButton() {
        const exploreBtn = document.getElementById('exploreBtn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                const link = this.communityTrend?.link || '/catalog';
                this.app.router.navigate(link);
            });
        }
    }

    /**
     * 🔄 ОБРАБОТЧИК КНОПКИ ОБНОВЛЕНИЯ SPOTLIGHT
     */
    attachSpotlightRefreshButton() {
        const refreshBtn = document.getElementById('spotlightRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                try {
                    // Haptic feedback
                    this.triggerHapticFeedback('medium');
                    
                    // Показываем loading состояние с анимацией
                    refreshBtn.innerHTML = '⟳';
                    refreshBtn.disabled = true;
                    refreshBtn.style.animation = 'spin 1s linear infinite';
                    
                    // Очищаем кэш
                    this._spotlightCache = { ts: 0, items: [] };
                    
                    // Параллельно перезагружаем данные
                    await Promise.all([
                        this.loadLatestQuotes(5),
                        this.loadPopularFavorites('7d', 10)
                    ]);
                    
                    // Пересобираем подборку
                    await this.getSpotlightItems();
                    
                    // Обновляем интерфейс
                    this.rerender();
                    
                } catch (error) {
                    console.error('❌ Ошибка обновления spotlight:', error);
                    this.showNotification('Ошибка обновления', 'error');
                } finally {
                    // Восстанавливаем кнопку
                    if (refreshBtn) {
                        refreshBtn.innerHTML = '↻';
                        refreshBtn.disabled = false;
                        refreshBtn.style.animation = '';
                    }
                }
            });
        }
    }

    /**
     * 📚 ОБРАБОТЧИКИ СЕКЦИИ "СЕЙЧАС ИЗУЧАЮТ" С HAPTIC FEEDBACK
     */
    attachCurrentlyStudyingListeners() {
        const studyingItems = document.querySelectorAll('.currently-studying-item');
        studyingItems.forEach(item => {
            // Добавляем haptic feedback на касание
            item.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
            
            item.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                const bookId = item.dataset.bookId;
                if (bookId) {
                    // Navigate to catalog with selected book
                    this.app.router.navigate(`/catalog?book=${bookId}`);
                }
            });
        });
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ COMMUNITY КАРТОЧЕК С УЛУЧШЕННЫМ HAPTIC FEEDBACK
     */
    attachCommunityCardListeners() {
        // Карточки цитат сообщества
        const communityItems = document.querySelectorAll('.mvp-community-item');
        communityItems.forEach(item => {
            // Haptic feedback на касание
            item.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
            
            // Действие при клике (если нужно)
            item.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                // Здесь можно добавить действия для карточек
            });
        });
        
        // Карточки статистики
        const statCards = document.querySelectorAll('.community-stat-card');
        statCards.forEach(card => {
            card.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
        });
        
        // Элементы лидерборда
        const leaderboardItems = document.querySelectorAll('.leaderboard-item');
        leaderboardItems.forEach(item => {
            item.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
            
            item.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                // Действия для элементов лидерборда
            });
        });
    }

    /**
     * 🔄 ОБРАБОТЧИКИ КНОПОК ПОВТОРА (НОВОЕ ДЛЯ PR-3)
     */
    attachRetryButtons() {
        // Единый обработчик для всех кнопок повтора с data-retry атрибутами
        const retryButtons = document.querySelectorAll('[data-retry]');
        retryButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.triggerHapticFeedback('medium');
                
                const retryType = button.dataset.retry;
                switch (retryType) {
                    case 'latest-quotes':
                        this.retryLoadLatestQuotes();
                        break;
                    case 'recent-clicks':
                        this.retryLoadRecentClicks();
                        break;
                    case 'popular-books':
                        this.retryLoadPopularBooks();
                        break;
                    case 'popular-quotes':
                        this.retryLoadPopularQuotes();
                        break;
                    case 'popular-favorites':
                        this.retryLoadPopularFavorites();
                        break;
                    case 'leaderboard':
                        this.retryLoadLeaderboard();
                        break;
                    default:
                        // Fallback - перезагружаем все
                        this.loadAllSections();
                        break;
                }
            });
        });
    }
    
    /**
     * 🔄 НАСТРОЙКА СЛУШАТЕЛЕЙ ИЗМЕНЕНИЙ ЦИТАТ
     */
    setupQuoteChangeListeners() {
        if (typeof document === 'undefined') return;

        // Снимаем старый обработчик, если был
        if (this._quoteChangeHandler) {
            document.removeEventListener('quotes:changed', this._quoteChangeHandler);
            this._quoteChangeHandler = null;
        }

        // Создаём новый обработчик с проверкой активности страницы
        this._quoteChangeHandler = (event) => {
            console.log('👥 CommunityPage: Получено событие quotes:changed:', event.detail);
            
            // Проверяем, активна ли страница Сообщества
            const isActive = this.app?.router?.currentRoute === '/community' || 
                           document.querySelector('.nav-item.active')?.dataset.route === 'community' ||
                           document.querySelector('.nav-item.active')?.dataset.page === 'community';
            
            if (!isActive) {
                console.log('👥 CommunityPage: Страница неактивна, пропускаем rerender');
                return;
            }
            
            // Refresh top analyses when quotes change
            this.loadTopAnalyses().then(() => {
                this.rerender();
            });
        };
        
        // Добавляем новый обработчик
        document.addEventListener('quotes:changed', this._quoteChangeHandler);
    }
    
    // Переключение вкладок — без промежуточных лоадеров
    switchTab(tabName) {
        this.activeTab = tabName;
        this.triggerHapticFeedback('light');
        this.rerender();
        // Предзагрузка данных для вкладки в фоне (без изменения UI)
        if (tabName === 'top') {
            Promise.allSettled([
                this._safe(async () => { 
                    if (!this.loaded.leaderboard) { 
                        const r = await this.api.getLeaderboard({ period: '7d', limit: 10 }); 
                        if (r?.success) { 
                            this.leaderboard = r.data || []; 
                            this.userProgress = r.me || null; 
                            this.loaded.leaderboard = true; 
                        } 
                    } 
                }),
                this._safe(async () => { 
                    if (!this.loaded.popularQuotes) { 
                        let r = await this.api.getCommunityPopularFavorites({ period: '7d', limit: 10 }).catch(() => null); 
                        if (!(r && r.success)) r = await this.api.getCommunityPopularQuotes({ period: '7d', limit: 10 }).catch(() => null); 
                        if (r?.success) { 
                            const arr = r.data || r.quotes || []; 
                            this.popularQuotes = arr.map(q => ({ 
                                text: q.text, 
                                author: q.author, 
                                favorites: q.favorites || q.count || q.likes || 0,
                                id: q.id,
                                creator: q.creator || q.addedBy
                            })); 
                            this.loaded.popularQuotes = true; 
                        } 
                    } 
                }),
                this._safe(async () => {
                    if (!this.loaded.activityPercent && this.api.getActivityPercent) {
                        const r = await this.api.getActivityPercent();
                        if (typeof r === 'number' || (r?.success && typeof r.activityPercent === 'number')) {
                            const percent = typeof r === 'number' ? r : r.activityPercent;
                            if (this.userProgress) {
                                this.userProgress.activityPercent = percent;
                            } else {
                                this.userProgress = { activityPercent: percent };
                            }
                            this.loaded.activityPercent = true;
                        }
                    }
                })
            ]).then(() => this.rerender());
        } else if (tabName === 'stats') {
            Promise.allSettled([
                this._safe(async () => { if (!this.loaded.stats) { const r = await this.api.getCommunityStats(); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; this.loaded.stats = true; } } }),
                this._safe(async () => { if (!this.loaded.insights && this.api.getCommunityInsights) { const r = await this.api.getCommunityInsights({ period: '7d' }); if (r?.success) { this.communityInsights = r.insights; this.loaded.insights = true; } } }),
                this._safe(async () => { if (!this.loaded.funFact && this.api.getCommunityFunFact) { const r = await this.api.getCommunityFunFact({ period: '7d' }); if (r?.success) { this.funFact = r.data; this.loaded.funFact = true; } } })
            ]).then(() => this.rerender());
        }
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ОБНОВЛЕН ДЛЯ PR-3!
     */
    // onShow больше НЕ делает первоначальных загрузок/лоадеров — только фоновые обновления при необходимости
    async onShow() {
        console.log('👥 CommunityPage: onShow - реализация SWR для фоновых обновлений');
        
        // ✅ НОВОЕ: Вызов warmupInitialStats при входе на экран
        if (this.statisticsService && typeof this.statisticsService.warmupInitialStats === 'function') {
            try {
                await this.statisticsService.warmupInitialStats();
                console.log('✅ CommunityPage: warmupInitialStats completed');
            } catch (error) {
                console.warn('⚠️ CommunityPage: warmupInitialStats failed:', error);
            }
        }
        
        // SWR: можно тихо перезагрузить что-то в фоне (не меняя UI) по таймауту/критерию устаревания
        // Например, раз в 10 минут:
        const last = this.state.get('community.lastUpdate') || 0;
        if (Date.now() - last > 10 * 60 * 1000) {
            this.state.set('community.lastUpdate', Date.now());
            console.log('🔄 CommunityPage: Данные устарели - запускаем фоновое обновление');
            // В фоне обновляем ключевые секции, но НЕ трогаем разметку до завершения, затем один общий rerender
            Promise.allSettled([
                this._safe(async () => { const r = await this.api.getCommunityStats(); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; } }),
                this._safe(async () => { const r = await this.api.getCommunityTrend(); if (r?.success) { this.communityTrend = r.data; } }),
                this._safe(async () => { const r = await this.api.getCommunityInsights?.({ period: '7d' }); if (r?.success) { this.communityInsights = r.insights; } })
            ]).then(() => {
                console.log('✅ CommunityPage: Фоновое обновление завершено');
                this.rerender();
            });
        } else {
            console.log('✅ CommunityPage: Данные актуальны, фоновое обновление не требуется');
        }
    }

    /**
     * 🔄 ЗАГРУЗКА ВСЕХ СЕКЦИЙ (ОБНОВЛЕНА ДЛЯ PR-3)
     */
    async loadAllSections() {
        console.log('🔄 CommunityPage: Загружаем все секции...');
        
        // Загружаем параллельно для лучшей производительности
        const loadPromises = [
            this.loadLatestQuotes(3), // Только 3 цитаты согласно требованиям
            this.loadPopularFavorites('7d', 10), // Популярные избранные цитаты для топа недели
            this.loadPopularBooks('7d', 10), // Популярные разборы недели для "Топ недели"
            this.loadRecentClicks(3), // Последние 3 клика для "Сейчас изучают"
            this.loadCommunityMessage(), // Сообщение от Анны
            this.loadCommunityTrend(), // Тренд недели
            this.loadLeaderboard(10, '7d'), // Лидерборд за неделю
            this.loadCommunityInsights('7d'), // Инсайты сообщества
            this.loadFunFact('7d') // Интересный факт недели
        ];

        try {
            await Promise.allSettled(loadPromises);
            console.log('✅ CommunityPage: Все секции загружены');
            this.rerender();
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки секций:', error);
            this.rerender(); // Показываем что загружено
        }
    }

    /**
     * 🔄 МЕТОДЫ ПОВТОРА ЗАГРУЗКИ ДЛЯ ОБРАБОТКИ ОШИБОК (PR-3)
     */
    retryLoadLatestQuotes() {
        this.triggerHapticFeedback('medium');
        this.loadLatestQuotes(5).then(() => this.rerender());
    }

    retryLoadPopularQuotes() {
        this.triggerHapticFeedback('medium');
        this.loadPopularQuotes('7d', 10).then(() => this.rerender());
    }

    retryLoadPopularFavorites() {
        this.triggerHapticFeedback('medium');
        this.loadPopularFavorites('7d', 10).then(() => this.rerender());
    }

    retryLoadPopularBooks() {
        this.triggerHapticFeedback('medium');
        this.loadPopularBooks('7d', 10).then(() => this.rerender());
    }

    retryLoadLeaderboard() {
        this.triggerHapticFeedback('medium');
        this.loadLeaderboard(10, '7d').then(() => this.rerender());
    }

    retryLoadRecentClicks() {
        this.triggerHapticFeedback('medium');
        this.loadRecentClicks(5).then(() => this.rerender());
    }

    /**
     * ➕ ДОБАВИТЬ ЦИТАТУ В ДНЕВНИК (НОВОЕ ДЛЯ PR-3)
     */
    async addQuoteToJournal(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.target.closest('.quote-card__add-btn');
        if (!button) return;
        
        const quoteCard = button.closest('.quote-card');
        
        if (!quoteCard) return;
        
        try {
            // Haptic feedback
            this.triggerHapticFeedback('medium');
            
            // Получаем данные цитаты из data-атрибутов или из DOM
            const quoteText = button.dataset.quoteText || quoteCard.querySelector('.quote-card__text')?.textContent?.replace(/"/g, '') || '';
            const quoteAuthor = button.dataset.quoteAuthor || quoteCard.querySelector('.quote-card__author')?.textContent?.replace('— ', '') || '';
            
            // Показываем loading состояние
            button.innerHTML = '<span class="loading-spinner-small"></span>';
            button.disabled = true;
            
            // 🔧 GLOBAL DUP CHECK
            const existingQuotes = this.state.get('quotes.items') || window.appState?.get('quotes.items') || [];
            if (window.QuoteUtils && window.QuoteUtils.isDuplicateQuote(existingQuotes, quoteText, quoteAuthor)) {
                this.showNotification('Эта цитата уже есть в вашем дневнике.', 'info');
                button.innerHTML = '<span class="add-icon">+</span>';
                button.disabled = false;
                this.triggerHapticFeedback('light');
                return;
            }
            
            // Добавляем цитату через API
            const response = await this.api.addQuote({
                text: quoteText,
                author: quoteAuthor,
                source: 'community'
            });
            
            if (response && response.success) {
                // Синхронно добавляем в state и индекс (чтобы сразу ловить повторную попытку)
                try {
                    const raw = response.data?.quote || response.data || response.quote || response;
                    if (raw && raw.text) {
                        const normalizedQuote = {
                            ...raw,
                            id: raw.id || raw._id,
                            text: raw.text,
                            author: raw.author || '',
                            source: raw.source || 'community',
                            createdAt: raw.createdAt || new Date().toISOString()
                        };
                        // prepend
                        const currentQuotes = this.state.get('quotes.items') || [];
                        this.state.set('quotes.items', [normalizedQuote, ...currentQuotes]);
                        if (window.QuoteUtils) {
                            window.QuoteUtils.addQuoteToDuplicateIndex(normalizedQuote);
                        }
                        // событие для статистики
                        document.dispatchEvent(new CustomEvent('quotes:changed', { detail: { type: 'added', quote: normalizedQuote } }));
                    }
                } catch (dupSyncErr) {
                    console.warn('Community dup sync skipped:', dupSyncErr);
                }
                
                // Успех - показываем галочку
                button.innerHTML = '<span class="add-icon">✓</span>';
                button.classList.add('added');
                this.triggerHapticFeedback('success');
                
                // Показываем уведомление
                this.showNotification('Цитата добавлена в ваш дневник!', 'success');
                
                // Возвращаем кнопку в исходное состояние через 2 секунды
                setTimeout(() => {
                    button.innerHTML = '<span class="add-icon">+</span>';
                    button.classList.remove('added');
                    button.disabled = false;
                }, 2000);
            } else {
                throw new Error(response?.message || 'Ошибка добавления цитаты');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления цитаты:', error);
            
            // Возвращаем кнопку в исходное состояние
            button.innerHTML = '<span class="add-icon">+</span>';
            button.disabled = false;
            
            // Проверяем лимит и показываем соответствующее сообщение (улучшенная проверка)
            if (error && (error.status === 429 || 
                         error.response?.status === 429 ||
                         /limit|quota|exceed/i.test(error.message || '') || 
                         /limit|quota|exceed/i.test(error?.data?.message || '') ||
                         /limit|quota|exceed/i.test(error?.response?.data?.message || '') ||
                         /Daily limit of 10 quotes exceeded/i.test(error?.response?.data?.error || ''))) {
                this.showNotification('Достигнут дневной лимит: можно сохранять до 10 цитат в сутки.', 'info');
            } else {
                this.showNotification('Ошибка при добавлении цитаты', 'error');
            }
            this.triggerHapticFeedback('error');
        }
    }

    /**
     * ❤️ ДОБАВИТЬ ЦИТАТУ В ИЗБРАННОЕ (С LIVE СЧЕТЧИКОМ ЛАЙКОВ)
     */
    async addQuoteToFavorites(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.target.closest('.quote-card__heart-btn, .quote-card__fav-btn');
        if (!button) return;
        
        const quoteCard = button.closest('.quote-card');
        if (!quoteCard) return;
        
        // Проверяем, не добавлена ли уже цитата в избранное
        if (button.classList.contains('favorited')) {
            return; // Уже в избранном, ничего не делаем
        }
        
        // Получаем данные цитаты из data-атрибутов или из DOM
        const quoteText = button.dataset.quoteText || quoteCard.querySelector('.quote-card__text')?.textContent?.replace(/"/g, '') || '';
        const quoteAuthor = button.dataset.quoteAuthor || quoteCard.querySelector('.quote-card__author')?.textContent?.replace('— ', '') || '';
        
        // Создаем уникальный ключ для защиты от двойного тапа
        const lockKey = `${quoteText.trim()}_${(quoteAuthor || '').trim()}`;
        
        // Проверяем защиту от двойного тапа
        if (this._favoriteLocks.has(lockKey)) {
            console.log('🔒 Duplicate tap prevented for:', lockKey);
            return;
        }
        
        // Устанавливаем блокировку
        this._favoriteLocks.add(lockKey);
        
        // Declare variables outside try block to avoid scope issues
        let currentFavorites = 0;
        let newCount = 0;
        
        try {
            // Haptic feedback
            this.triggerHapticFeedback('medium');
            
            // Проверка на дубликаты: если цитата уже существует в пользовательском состоянии,
            // обновляем существующую вместо создания новой
            const existingQuotes = this.state.get('quotes.items') || [];
            const existingQuote = existingQuotes.find(q => 
                q.text && quoteText && 
                q.text.trim().toLowerCase() === quoteText.trim().toLowerCase() &&
                (q.author || '').trim().toLowerCase() === (quoteAuthor || '').trim().toLowerCase()
            );
            
            if (existingQuote) {
                // Цитата уже существует - обновляем isFavorite вместо создания дубликата
                if (existingQuote.isFavorite) {
                    this.showNotification('Эта цитата уже в избранном!', 'info');
                    this.triggerHapticFeedback('light');
                    // Обновляем UI для показа что цитата уже в избранном
                    button.innerHTML = '❤';
                    button.classList.add('favorited');
                    return;
                }
                
                // Обновляем существующую цитату
                try {
                    const response = await this.api.request('PUT', `/quotes/${existingQuote.id}`, {
                        text: existingQuote.text,
                        author: existingQuote.author,
                        source: existingQuote.source,
                        isFavorite: true
                    });
                    
                    if (response && response.success) {
                        // Обновляем в состоянии
                        const updatedQuotes = existingQuotes.map(q => 
                            q.id === existingQuote.id ? { ...q, isFavorite: true } : q
                        );
                        this.state.set('quotes.items', updatedQuotes);
                        
                        // Обновляем UI
                        button.innerHTML = '❤';
                        button.classList.add('favorited');
                        
                        // Обновляем счетчик лайков если есть
                        const favoritesCountElement = quoteCard.querySelector('.favorites-count');
                        if (favoritesCountElement) {
                            const currentCount = parseInt(favoritesCountElement.textContent, 10) || 0;
                            favoritesCountElement.textContent = currentCount + 1;
                        }
                        
                        this.triggerHapticFeedback('success');
                        this.showNotification('Добавлено в избранное!', 'success');
                        
                        // Update spotlight cache item favorites so rerender does not revert
                        // Find item in this._spotlightCache.items by text+author and ++favorites  
                        if (this._spotlightCache.items && this._spotlightCache.items.length > 0) {
                            const spotlightItem = this._spotlightCache.items.find(item => 
                                item.text === quoteText && item.author === quoteAuthor
                            );
                            if (spotlightItem) {
                                spotlightItem.favorites = (spotlightItem.favorites || 0) + 1;
                                console.log('🌟 Updated spotlight cache item favorites (existing quote):', spotlightItem.favorites);
                            }
                        }
                        
                        // Диспатчим событие для статистики
                        document.dispatchEvent(new CustomEvent('quotes:changed', { 
                            detail: { type: 'edited', quoteId: existingQuote.id, updates: { isFavorite: true } } 
                        }));
                        
                        return;
                    } else {
                        throw new Error(response?.message || 'Ошибка обновления цитаты');
                    }
                } catch (updateError) {
                    console.error('❌ Ошибка обновления существующей цитаты:', updateError);
                    throw updateError;
                }
            }
            
            // Получаем текущий счетчик лайков
            currentFavorites = parseInt(button.dataset.favorites, 10) || 0;
            const favoritesCountElement = quoteCard.querySelector('.favorites-count');
            
            // Мгновенно обновляем UI (оптимистичное обновление)
            button.innerHTML = '❤';
            button.classList.add('favorited');
            newCount = currentFavorites + 1;
            button.dataset.favorites = newCount;
            
            // Обновляем счетчик в .favorites-count спанах
            if (favoritesCountElement) {
                favoritesCountElement.textContent = newCount;
            }
            
            // Добавляем цитату в избранное через API
            const response = await this.api.addQuote({
                text: quoteText,
                author: quoteAuthor,
                source: 'community',
                isFavorite: true
            });
            
            if (response && response.success) {
                try {
                    const raw = response.data?.quote || response.data || response.quote || response;
                    if (raw && raw.text) {
                        const favoriteQuote = {
                            ...raw,
                            id: raw.id || raw._id,
                            text: raw.text,
                            author: raw.author || '',
                            isFavorite: true,
                            source: raw.source || 'community',
                            createdAt: raw.createdAt || new Date().toISOString()
                        };
                        const currentQuotes = this.state.get('quotes.items') || [];
                        this.state.set('quotes.items', [favoriteQuote, ...currentQuotes]);
                        if (window.QuoteUtils) {
                            window.QuoteUtils.addQuoteToDuplicateIndex(favoriteQuote);
                        }
                        document.dispatchEvent(new CustomEvent('quotes:changed', { detail: { type: 'added', quote: favoriteQuote } }));
                    }
                } catch (e) {
                    console.warn('Favorite dup sync failed:', e);
                }
                
                // Успех
                this.triggerHapticFeedback('success');
                this.showNotification('Добавлено в избранное!', 'success');
                
                // Update spotlight cache item favorites so rerender does not revert
                // Find item in this._spotlightCache.items by text+author and ++favorites
                if (this._spotlightCache.items && this._spotlightCache.items.length > 0) {
                    const spotlightItem = this._spotlightCache.items.find(item => 
                        item.text === quoteText && item.author === quoteAuthor
                    );
                    if (spotlightItem) {
                        spotlightItem.favorites = (spotlightItem.favorites || 0) + 1;
                        console.log('🌟 Updated spotlight cache item favorites:', spotlightItem.favorites);
                    }
                }
                
                // Если API вернул актуальное количество лайков, используем его
                if (response.data && typeof response.data.favorites === 'number') {
                    const apiCount = response.data.favorites;
                    button.dataset.favorites = apiCount;
                    
                    // Обновляем счетчик в .favorites-count спанах
                    if (favoritesCountElement) {
                        favoritesCountElement.textContent = apiCount;
                    }
                }
                
            } else {
                throw new Error(response?.message || 'Ошибка добавления в избранное');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления в избранное:', error);
            
            // Откатываем изменения UI при ошибке
            button.innerHTML = '♡';
            button.classList.remove('favorited');
            button.dataset.favorites = currentFavorites;
            
            // Восстанавливаем счетчик в .favorites-count спанах
            const favoritesCountElement = quoteCard.querySelector('.favorites-count');
            if (favoritesCountElement) {
                favoritesCountElement.textContent = currentFavorites;
            }
            
            // Показываем ошибку
            if (error && (error.status === 429 || /limit|quota|exceed/i.test(error.message || '') || /limit|quota/i.test(error?.data?.message || ''))) {
                this.showNotification('Достигнут дневной лимит: можно сохранять до 10 цитат в сутки.', 'info');
            } else {
                this.showNotification('Ошибка при добавлении в избранное', 'error');
            }
            this.triggerHapticFeedback('error');
        } finally {
            // Всегда снимаем блокировку через небольшую задержку
            setTimeout(() => {
                this._favoriteLocks.delete(lockKey);
            }, 1000);
        }
    }

    /**
     * 🎯 ИЗУЧИТЬ ТРЕНД (НОВОЕ ДЛЯ PR-3)
     */
    exploreTrend(event) {
        event.preventDefault();
        this.triggerHapticFeedback('medium');
        
        // Здесь можно добавить логику перехода к изучению тренда
        console.log('🎯 Изучение тренда недели');
        this.showNotification('Функция в разработке', 'info');
    }

    /**
     * 🔔 ПОКАЗАТЬ УВЕДОМЛЕНИЕ
     */
    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        
        // Добавляем на страницу
        document.body.appendChild(notification);
        
        // Показываем
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Убираем через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 🕒 ФОРМАТИРОВАНИЕ ВРЕМЕНИ КЛИКА
     */
    formatClickTime(clickTime) {
        if (!clickTime) return 'недавно';
        
        try {
            const now = new Date();
            const clickDate = new Date(clickTime);
            const diffMs = now - clickDate;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffMins < 60) {
                return `${diffMins} мин назад`;
            } else if (diffHours < 24) {
                return `${diffHours} ч назад`;
            } else if (diffDays < 7) {
                return `${diffDays} дн назад`;
            } else {
                return clickDate.toLocaleDateString('ru-RU');
            }
        } catch {
            return 'недавно';
        }
    }

    /**
     * 📅 ФОРМАТИРОВАНИЕ ДАТЫ
     */
    formatDate(date) {
        if (!date) return '';
        
        try {
            const dateObj = new Date(date);
            const now = new Date();
            const diffMs = now - dateObj;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                return 'сегодня';
            } else if (diffDays === 1) {
                return 'вчера';
            } else if (diffDays < 7) {
                return `${diffDays} дн назад`;
            } else {
                return dateObj.toLocaleDateString('ru-RU');
            }
        } catch {
            return '';
        }
    }
    
    onHide() {
        console.log('👥 CommunityPage: onHide');
        // Cleanup event listeners
        if (this._quoteChangeHandler) {
            document.removeEventListener('quotes:changed', this._quoteChangeHandler);
        }
    }

    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
            
            // ✅ НОВОЕ: Добавляем плавные анимации через CSS классы
            this.triggerContentAnimations();
        }
    }
    
    /**
     * 🎬 ПЛАВНЫЕ АНИМАЦИИ ПОЯВЛЕНИЯ ЧЕРЕЗ CSS КЛАССЫ
     */
    triggerContentAnimations() {
        // Получаем контейнер контента для анимаций
        const contentContainer = document.querySelector('.content');
        if (!contentContainer) return;
        
        // Добавляем класс для запуска анимаций
        setTimeout(() => {
            contentContainer.classList.add('animate-content');
        }, 50); // Небольшая задержка для плавности
        
        // Убираем класс после завершения анимаций
        setTimeout(() => {
            contentContainer.classList.remove('animate-content');
        }, 1000);
    }

    /**
     * 🧹 ОЧИСТКА РЕСУРСОВ
     */
    destroy() {
        console.log('🧹 CommunityPage: Очистка ресурсов');
        // Remove event listeners
        if (this._quoteChangeHandler) {
            document.removeEventListener('quotes:changed', this._quoteChangeHandler);
            this._quoteChangeHandler = null;
        }

        // ✅ НОВОЕ: Сброс флагов
        this.communityLoaded = false;
        this.communityLoading = false;

        // Сброс состояний загрузки
        Object.keys(this.loadingStates).forEach(key => {
            this.loadingStates[key] = false;
        });

        // Сброс состояний ошибок
        Object.keys(this.errorStates).forEach(key => {
            this.errorStates[key] = null;
        });
    }
}

// 📤 Экспорт класса
window.CommunityPage = CommunityPage;
