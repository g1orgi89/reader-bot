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

// ⏱️ SPOTLIGHT ROTATION CONSTANTS
const SPOTLIGHT_TTL_MS = 10 * 60 * 1000; // 10 minutes (reduced from 1 hour for more variety)
const SPOTLIGHT_NO_REPEAT_HOURS = 4; // 4 hours (reduced from 24 hours for more variety)

// 💾 LIKE STORE PERSISTENCE
const COMMUNITY_LIKE_STORE_KEY = 'community_like_store_v1';
const COMMUNITY_LIKE_VERSION_KEY = 'community_like_version';
const CURRENT_LIKE_VERSION = '2.0.0';

// ⏱️ FLICKER MITIGATION: Delay before warmupInitialStats to avoid UI flipping at first paint
const WARMUP_STATS_DELAY_MS = 2000;

// ✅ FIX C: Spotlight build cooldown to prevent double/triple rebuilds on initial page entry
const SPOTLIGHT_BUILD_COOLDOWN_MS = 400;

// 🏅 Badge asset mapping for achievement display
const COMMUNITY_BADGE_PATHS = {
    alice_badge: '/assets/badges/alice.png'
};

class CommunityPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.statisticsService = app.statistics || window.statisticsService;
        window.communityPage = this;
        
        // Initialize ProfileModal - use singleton from app or fallback
        this.profileModal = (typeof app.getProfileModal === 'function')
            ? app.getProfileModal()
            : (window.profileModal || (window.profileModal = new ProfileModal(app)));
        
        // 🔧 CoverCommentsModal singleton - managed by app instance
        // No need to store local instance, use app.getCoverCommentsModal() when needed
        this._commentsModalLoadPromise = null; // single-flight guard for dynamic loading
        
        // Store bound delegated handler reference for cleanup
        this._delegatedHandlerBound = null;
        
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
        
        // 👥 ПОДПИСКИ (FOLLOW SYSTEM)
        this.feedFilter = 'all'; // 'all' | 'following' | 'covers'
        this.followingQuotes = [];
        this.followingCount = 0;
        this.followStatusCache = this._loadFollowStatusFromStorage(); // userId -> boolean

        // 📸 COVERS (ОБЛОЖКИ)
        this.coversPosts = [];
        this.coversHasMore = false;
        this.coversCursor = null;
        this.coverUploadForm = null; // Upload form component instance
        this._confirmOpen = false; // Telegram popup debounce flag
        this._lastMutationTs = 0; // Track last mutation timestamp for cache-busting
        
        // 💬 COMMENTS CACHE (persist comments by postId)
        this._commentsCache = new Map(); // postId → {comments: [], ts: timestamp}

        // 🌟 SPOTLIGHT CACHE (TTL система для предотвращения мигания)
        this._spotlightCache = {
            ts: 0,
            items: []
        };

        // 🔒 FAVORITE LOCKS (защита от двойного тапа) - using normalizedKey
        this._favoriteLocks = new Set();
        
        // 💚 LIKE STATE (track like status per quote using normalizedKey)
        this._likeState = new Map();
        
        // 🏪 LIKE STORE (single source of truth for like state across all sections)
        // Map<string, {liked: boolean, count: number, pending: number, lastServerCount?: number}>
        this._likeStore = new Map();
        this._likeStoreLoaded = false; // Flag to track if like store was loaded from localStorage

        // Load persisted like store from localStorage
        this._loadLikeStoreFromStorage();
     
        // 🔄 RERENDER SCHEDULER (batching sequential rerenders into single rAF)
        this._rerenderScheduled = false;
        
        // 🔄 DELEGATED EVENT HANDLERS FLAGS (to prevent duplicate listeners)
        this._spotlightRefreshDelegated = false;
        this._popularWeekRefreshDelegated = false;

        // ✅ FIX C: SPOTLIGHT BUILD GUARD (prevent double build/render within cooldown)
        this._spotlightBuildInFlight = false;
        this._lastSpotlightBuildTs = 0;

        // 🔄 PULL-TO-REFRESH STATE
        this._ptrActive = false;
        this._ptrRefreshing = false;
        this._ptrStartY = 0;
        this._ptrCurrentY = 0;
        this._ptrThreshold = 70;
        this._ptrListenersAttached = false;

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
            funFact: false,
            covers: false  // 📸 COVERS: Add loading state for covers feed
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
        
        // Initialize ImageViewer for Covers
        if (typeof ImageViewer !== 'undefined') {
            this.imageViewer = new ImageViewer();
        } else {
            console.warn('⚠️ ImageViewer not loaded');
        }
        
        // 🔧 A) Load persisted mutation timestamp for cache-busting
        this._loadMutationTimestamp();
    }
    
    /**
     * 🔧 Load persisted mutation timestamp from sessionStorage
     * @private
     */
    _loadMutationTimestamp() {
        try {
            const stored = sessionStorage.getItem('covers:lastMutationTs');
            if (stored) {
                const ts = parseInt(stored, 10);
                if (!isNaN(ts) && ts > 0) {
                    this._lastMutationTs = ts;
                    console.log(`🔧 CommunityPage: Loaded mutation timestamp from storage: ${ts}`);
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load mutation timestamp:', error);
        }
    }
    
    /**
     * 🔧 Persist mutation timestamp to sessionStorage
     * @private
     */
    _persistMutationTimestamp() {
        try {
            sessionStorage.setItem('covers:lastMutationTs', String(this._lastMutationTs));
            console.log(`💾 CommunityPage: Persisted mutation timestamp: ${this._lastMutationTs}`);
        } catch (error) {
            console.warn('⚠️ Failed to persist mutation timestamp:', error);
        }
    }

    // PREFETCH: вызывается Router перед первым render — грузим всё параллельно
    async prefetch() {
        if (this.isHydrated) return; // уже есть готовые данные

        console.log('🔄 CommunityPage: Запуск prefetch - включаем fast-first-paint');

        // ✅ FAST-FIRST-PAINT: Set isHydrated immediately so UI shows right away
        this.isHydrated = true;

        // ✅ Run data loads in background without blocking first paint
        Promise.allSettled([
            this._safe(async () => { const r = await this.api.getCommunityStats({ scope: 'week' }); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; this.loaded.stats = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityLatestQuotes({ limit: 3 }); if (r?.success) { this.latestQuotes = r.data || []; this.loaded.latestQuotes = true; } }),
            this._safe(async () => { const r = await this.api.getTopBooks({ scope: 'week', limit: 10 }); if (r?.success) { this.popularBooks = r.data || []; this.loaded.popularBooks = true; } }),
            this._safe(async () => { const r = await this.api.getCatalogRecentClicks({ limit: 3 }); if (r?.success) { this.recentClicks = r.clicks || r.data || []; this.loaded.recentClicks = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityMessage(); if (r?.success) { this.communityMessage = r.data; this.loaded.message = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityTrend(); if (r?.success) { this.communityTrend = r.data; this.loaded.trend = true; } }),
            this._safe(async () => { // Популярные избранные цитаты недели (для топа недели)
                await this.loadPopularFavorites(10);
            }),
            this._safe(async () => { // Популярные цитаты недели (для топа недели)
                await this.loadPopularQuotes(10);
            }),
            this._safe(async () => { // лидерборд + me
                const r = await this.api.getLeaderboard({ scope: 'week', limit: 10 });
                if (r?.success) { this.leaderboard = r.data || []; this.userProgress = r.me || null; this.loaded.leaderboard = true; }
            }),
            this._safe(async () => { const r = await this.api.getCommunityInsights?.({ scope: 'week' }); if (r?.success) { this.communityInsights = r.insights; this.loaded.insights = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityFunFact?.({ scope: 'week' }); if (r?.success) { this.funFact = r.data; this.loaded.funFact = true; } })
        ]).then(() => {
            // ✨ Инициализация spotlight кэша после загрузки основных данных
            return this._safe(async () => {
                await this.getSpotlightItems();
            });
        }).then(() => {
            // 🔄 Reconcile all like data after loads complete
            this._reconcileAllLikeData();
            
            // 🔄 Apply like state to latestQuotes if present
            if (this.latestQuotes?.length) {
                this._applyLikeStateToArray(this.latestQuotes);
            }
            
            // 🔄 Update all like buttons in DOM
            requestAnimationFrame(() => {
                this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
            });
            
            // ✅ After all data loads complete, schedule a single rerender
            console.log('✅ CommunityPage: Prefetch завершен - обновляем UI');
            this._scheduleRerender();

            this._persistLikeStore();
            console.log('💾 CommunityPage: Сохранены данные лайков в localStorage')       
        });
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
        // ✅ Bridge legacy followStateChanged to canonical follow:changed
        this._followStateChangedBridge = (event) => {
            const { userId, following } = event.detail;
            console.log(`[FOLLOW_SYNC] CommunityPage: Bridging followStateChanged to follow:changed for userId=${userId}`);
            // Re-dispatch as canonical event
            window.dispatchEvent(new CustomEvent('follow:changed', {
                detail: { userId, following }
            }));
        };
        window.addEventListener('followStateChanged', this._followStateChangedBridge);
        
        // ✅ Subscribe to unified follow:changed event for real-time sync
        this._followChangedHandler = (event) => {
            const { userId, following } = event.detail;
            console.log(`[FOLLOW_SYNC] CommunityPage: Received follow:changed event for userId=${userId}, following=${following}`);
            this.refreshFollowStatus(userId, following);
        };
        window.addEventListener('follow:changed', this._followChangedHandler);
        
        // ✅ Subscribe to comment:deleted event for cache synchronization
        this._commentDeletedHandler = (event) => {
            const { postId, commentId, remainingCount } = event.detail;
            console.log(`[COMMENT_SYNC] CommunityPage: Comment deleted - postId=${postId}, commentId=${commentId}, count=${remainingCount}`);
            
            // Update comments cache
            const cached = this._commentsCache.get(postId);
            if (cached && cached.comments) {
                // Remove deleted comment from cache
                const updatedComments = cached.comments.filter(c => (c._id || c.id) !== commentId);
                this._commentsCache.set(postId, {
                    comments: updatedComments,
                    ts: Date.now()
                });
                console.log(`[COMMENT_SYNC] CommunityPage: Updated cache for postId=${postId}, new count=${updatedComments.length}`);
            }
            
            // Update comment count in UI card
            const postIndex = this.coversPosts.findIndex(p => (p._id || p.id) === postId);
            if (postIndex !== -1) {
                this.coversPosts[postIndex].commentsCount = remainingCount;
                // Re-render the post card to update the comment count
                const postCard = document.querySelector(`[data-post-id="${postId}"]`);
                if (postCard) {
                    const commentBtn = postCard.querySelector('.cover-card__comments-btn');
                    if (commentBtn) {
                        const countSpan = commentBtn.querySelector('.cover-card__comments-count');
                        if (countSpan) {
                            countSpan.textContent = remainingCount;
                        }
                    }
                }
            }
        };
        window.addEventListener('comment:deleted', this._commentDeletedHandler);
        
        console.log('✅ CommunityPage: Subscriptions set up (bridged followStateChanged + follow:changed + comment:deleted)');
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
     * ОБНОВЛЕНО: Поддержка config-driven initial count и load more
     */
    async loadLatestQuotes(limit = null) {
        if (this.loadingStates.latestQuotes) return;
        
        // Читаем лимит из конфига если не передан
        if (limit === null) {
            const config = window.ConfigManager?.get('feeds.community.feed') || { initialCount: 12 };
            limit = config.initialCount || 12;
        }
        
        try {
            this.loadingStates.latestQuotes = true;
            this.errorStates.latestQuotes = null;
            console.log(`📰 CommunityPage: Загружаем последние цитаты (limit=${limit})...`);
            
            const response = await this.api.getCommunityLatestQuotes({ limit, noCache: true });
            if (response && response.success) {
                // Нормализация: читаем из resp.data, если нет - из resp.quotes/resp.data.quotes/resp
                const rawQuotes = response.data || response.quotes || response.data?.quotes || [];
                
                // ✅ ДЕДУПЛИКАЦИЯ: убираем дубликаты по normalized key (текст + автор)
                this.latestQuotes = this._deduplicateQuotes(rawQuotes);
                
                // Initialize likeStore from server data
                this._initializeLikeStoreFromItems(this.latestQuotes);

                // Apply stored like state to override server data 
                this._applyLikeStateToArray(this.latestQuotes);
                
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
     * 🔥 ЗАГРУЗКА ПОПУЛЯРНЫХ ЦИТАТ СООБЩЕСТВА (ОБНОВЛЕНО)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * ОБНОВЛЕНО: Добавлена нормализация owner для правильной атрибуции
     * @param {number} limit - number of quotes to load
     */
    async loadPopularQuotes(limit = 10) {
        if (this.loadingStates.popularQuotes) return;
        
        try {
            this.loadingStates.popularQuotes = true;
            this.errorStates.popularQuotes = null;
            console.log('🔥 CommunityPage: Загружаем популярные цитаты недели...');
            
            const response = await this.api.getCommunityPopularQuotes({ limit });
            if (response && response.success) {
                // Normalize owner field for each quote
                const rawQuotes = response.data || response.quotes || [];
                const normalizedQuotes = rawQuotes.map(q => this._normalizeOwner(q));
                
                // ✅ ДЕДУПЛИКАЦИЯ: убираем дубликаты по normalized key (текст + автор)
                this.popularQuotes = this._deduplicateQuotes(normalizedQuotes);
                
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
     * ❤️ ЗАГРУЗКА ПОПУЛЯРНЫХ ЦИТАТ ПО ЛАЙКАМ (ТОЛЬКО ТЕКУЩАЯ НЕДЕЛЯ)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * ОБНОВЛЕНО: Добавлена нормализация owner для правильной атрибуции
     * ОБНОВЛЕНО: Изменена сигнатура для поддержки options объекта с noCache
     * @param {number} limit - number of quotes to load
     * @param {{noCache?: boolean}} opts - options object with noCache flag
     */
    async loadPopularFavorites(limit = 10, opts = {}) {
        if (this.loadingStates.popularFavorites) return;
        
        try {
            this.loadingStates.popularFavorites = true;
            this.errorStates.popularFavorites = null;
            console.debug('❤️ CommunityPage.loadPopularFavorites: Загружаем популярные избранные цитаты за неделю...', { limit, noCache: opts.noCache });
            
            // Загружаем избранные только за текущую неделю - без fallback
            const response = await this.api.getCommunityPopularFavorites({ scope: 'week', limit, noCache: opts.noCache });
            if (response && response.success && response.data) {
                // Normalize owner field for each quote
                const normalizedQuotes = response.data.map(q => this._normalizeOwner(q));
                
                // ✅ ДЕДУПЛИКАЦИЯ: убираем дубликаты по normalized key (текст + автор)
                // Дедупликация ПЕРЕД сортировкой, чтобы оставить первую (оригинальную) версию
                const uniqueQuotes = this._deduplicateQuotes(normalizedQuotes);
                
                // Sort by likes descending
                this.popularFavorites = uniqueQuotes.sort((a, b) => {
                    const aLikes = a.favorites || a.count || a.likes || 0;
                    const bLikes = b.favorites || b.count || b.likes || 0;
                    return bLikes - aLikes;
                });
                
                // Initialize likeStore from server data
                this._initializeLikeStoreFromItems(this.popularFavorites);
                
                // Apply stored like state to override server data (for pending actions)
                this._applyLikeStateToArray(this.popularFavorites);
                
                console.debug('✅ CommunityPage.loadPopularFavorites: Популярные избранные цитаты загружены:', this.popularFavorites.length);
            } else {
                this.popularFavorites = [];
                console.debug('ℹ️ CommunityPage.loadPopularFavorites: Нет избранных цитат за текущую неделю');
            }
            
        } catch (error) {
            console.error('❌ CommunityPage.loadPopularFavorites: Ошибка загрузки:', error);
            this.errorStates.popularFavorites = error.message || 'Ошибка загрузки избранных цитат';
            this.popularFavorites = [];
        } finally {
            this.loadingStates.popularFavorites = false;
        }
    }

    /**
     * 📚 ЗАГРУЗКА ПОПУЛЯРНЫХ КНИГ СООБЩЕСТВА (ОБНОВЛЕНО ДЛЯ ТОПА НЕДЕЛИ)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {number} limit - number of books to load
     */
    async loadPopularBooks(limit = 10) {
        if (this.loadingStates.popularBooks) return;
        
        try {
            this.loadingStates.popularBooks = true;
            this.errorStates.popularBooks = null;
            console.log('📚 CommunityPage: Загружаем популярные книги недели...');
            
            const response = await this.api.getCommunityPopularBooks({ limit });
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
     * 🏆 ЗАГРУЗКА ЛИДЕРБОРДА ЗА ПЕРИОД (ОБНОВЛЕНО)
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     * @param {number} limit - number of users to load
     */
    async loadLeaderboard(limit = 10, opts = {}) {
        if (this.loadingStates.leaderboard) return;
        try {
            this.loadingStates.leaderboard = true;
            this.errorStates.leaderboard = null;
            console.debug('🏆 CommunityPage.loadLeaderboard: Загружаем лидерборд за неделю', { limit, noCache: opts.noCache });
            
            const resp = await this.api.getLeaderboard({ limit, noCache: opts.noCache });
            if (resp && resp.success) {
                this.leaderboard = resp.data || [];
                this.userProgress = resp.me || null;
                console.debug('✅ CommunityPage.loadLeaderboard: Лидерборд загружен:', this.leaderboard.length, 'пользователей');
            } else {
                this.leaderboard = [];
                this.userProgress = null;
                console.warn('⚠️ CommunityPage.loadLeaderboard: Некорректный ответ лидерборда');
            }
        } catch (e) {
            this.errorStates.leaderboard = e.message || 'Ошибка загрузки лидеров';
            this.leaderboard = [];
            this.userProgress = null;
            console.error('❌ CommunityPage.loadLeaderboard: Ошибка загрузки лидерборда:', e);
        } finally {
            this.loadingStates.leaderboard = false;
        }
    }

    /**
     * 📊 ЗАГРУЗКА ИНСАЙТОВ СООБЩЕСТВА
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     */
    async loadCommunityInsights() {
        if (this.loadingStates.communityInsights) return;
        
        try {
            this.loadingStates.communityInsights = true;
            this.errorStates.communityInsights = null;
            console.log('📊 CommunityPage: Загружаем инсайты сообщества за неделю');
            
            const response = await this.api.getCommunityInsights();
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
     * ОБНОВЛЕНО: Всегда использует scope=week для недельных блоков
     */
    async loadFunFact() {
        if (this.loadingStates.funFact) return;
        
        try {
            this.loadingStates.funFact = true;
            this.errorStates.funFact = null;
            console.log('🎉 CommunityPage: Загружаем интересный факт за неделю');
            
            const response = await this.api.getCommunityFunFact();
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
     * 👥 ЗАГРУЗКА ЛЕНТЫ ОТ ПОДПИСОК
     * ОБНОВЛЕНО: Поддержка config-driven initial count и load more
     */
    async loadFollowingFeed(limit = null) {
        // Читаем лимит из конфига если не передан
        if (limit === null) {
            const config = window.ConfigManager?.get('feeds.community.following') || { initialCount: 12 };
            limit = config.initialCount || 12;
        }
        
        try {
            console.log(`👥 CommunityPage: Загружаем ленту от подписок (limit=${limit})...`);
            const response = await this.api.getFollowingFeed({ limit });
            if (response && response.success) {
                this.followingFeed = this._deduplicateQuotes(response.data || []);
                
                // ✅ ВЕРНИ ЭТУ СТРОКУ ОБРАТНО:
                this._initializeLikeStoreFromItems(this.followingFeed);
                
                this._applyLikeStateToArray(this.followingFeed);
                
                console.log('✅ CommunityPage: Лента от подписок загружена:', this.followingFeed.length);
            } else {
                this.followingFeed = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки ленты от подписок:', error);
            this.followingFeed = [];
        }
    }
    
    /**
     * 📸 ЗАГРУЗКА ЛЕНТЫ ОБЛОЖЕК (COVERS)
     * @param {boolean} loadMore - Load more posts (use cursor)
     */
    async loadCovers(loadMore = false) {
        // 🔒 Prevent concurrent loads
        if (this.loadingStates.covers) {
            console.log('📸 CommunityPage: Covers already loading, skipping...');
            return;
        }
        
        this.loadingStates.covers = true;
        
        try {
            // Correct feed: for filter 'covers' use 'all'
            const feed = (this.feedFilter === 'covers' || this.feedFilter === 'all') ? 'all' : 'following';
            const cursor = loadMore ? this.coversCursor : null;
            const limit = 20;
            
            // 🔧 CACHE-BUST: Add timestamp if within 120 seconds of last mutation (extended from 30s)
            const now = Date.now();
            const shouldCacheBust = (now - this._lastMutationTs) < 120000; // 120 seconds
            const ts = shouldCacheBust ? now : undefined;
            
            console.log(`📸 CommunityPage: Загружаем обложки (feed=${feed}, cursor=${cursor}, loadMore=${loadMore}, cacheBust=${shouldCacheBust})...`);
            
            const response = await this.api.getCovers({ feed, cursor, limit, ts });
            
            if (response && response.success) {
                const newPosts = response.data || [];
                
                // Map posts to ensure explicit liked (boolean) and likesCount fields
                const mappedPosts = newPosts.map(post => ({
                    ...post,
                    liked: !!post.liked, // Ensure boolean
                    likesCount: post.likesCount || 0 // Ensure number
                }));
                
                if (loadMore) {
                    // Append to existing posts (ensure coversPosts is array, not null)
                    const currentPosts = Array.isArray(this.coversPosts) ? this.coversPosts : [];
                    this.coversPosts = [...currentPosts, ...mappedPosts];
                } else {
                    // Replace posts
                    this.coversPosts = mappedPosts;
                }
                
                this.coversHasMore = response.hasMore || false;
                this.coversCursor = response.nextCursor || null;
                
                console.log(`✅ CommunityPage: Обложки загружены: ${newPosts.length} постов, hasMore=${this.coversHasMore}`);
            } else {
                if (!loadMore) {
                    this.coversPosts = [];
                }
                this.coversHasMore = false;
                this.coversCursor = null;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки обложек:', error);
            if (!loadMore) {
                this.coversPosts = [];
            }
            this.coversHasMore = false;
            this.coversCursor = null;
        } finally {
            this.loadingStates.covers = false;
            
            // 🔒 CRITICAL FIX: Ensure coversPosts is never stuck at null
            if (this.coversPosts === null) {
                this.coversPosts = [];
            }
        }
    }
    
    /**
     * 🔄 COMPOSE COMMUNITY FEED - Компоновка ленты "Все" с вставками
     * Создает структуру с тремя чанками цитат и двумя статическими вставками
     * @param {Array} quotes - Массив цитат для отображения
     * @returns {string} HTML с композицией
     */
    composeCommunityFeed(quotes) {
        const config = window.ConfigManager?.get('feeds.community.feed') || {
            interleavePattern: [3, 'anna', 5, 'trend', 'rest']
        };
        
        const pattern = config.interleavePattern || [3, 'anna', 5, 'trend', 'rest'];
        
        // Разбиваем цитаты на чанки согласно паттерну
        // pattern: [3, 'anna', 5, 'trend', 'rest']
        // chunk1: 0-2 (3 цитаты)
        // anna insert
        // chunk2: 3-7 (5 цитат)
        // trend insert  
        // chunk3: 8-end (остальные)
        
        const chunk1Size = typeof pattern[0] === 'number' ? pattern[0] : 3;
        const chunk2Size = typeof pattern[2] === 'number' ? pattern[2] : 5;
        
        const chunk1 = quotes.slice(0, chunk1Size);
        const chunk2 = quotes.slice(chunk1Size, chunk1Size + chunk2Size);
        const chunk3 = quotes.slice(chunk1Size + chunk2Size);
        
        // Рендерим чанки
        const chunk1Html = this._renderQuoteChunk(chunk1, 'chunk1');
        const chunk2Html = this._renderQuoteChunk(chunk2, 'chunk2');
        const chunk3Html = this._renderQuoteChunk(chunk3, 'chunk3');
        
        // Статические вставки
        const annaInsert = this._renderAnnaMessageInsert();
        const trendInsert = this._renderTrendInsert();
        
        return `
            <div class="community-feed">
                <div class="feed-chunk" data-chunk="chunk1">
                    ${chunk1Html}
                </div>
                
                ${annaInsert}
                
                <div class="feed-chunk" data-chunk="chunk2">
                    ${chunk2Html}
                </div>
                
                ${trendInsert}
                
                <div class="feed-chunk" data-chunk="chunk3">
                    ${chunk3Html}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔄 Рендер чанка цитат
     * @param {Array} quotes - Цитаты для чанка
     * @param {string} chunkId - ID чанка
     * @returns {string} HTML
     */
    _renderQuoteChunk(quotes, chunkId) {
        if (!quotes || quotes.length === 0) {
            return '';
        }
        
        return quotes.map((quote, index) => {
            const quoteText = quote.text || quote.content || '';
            const quoteAuthor = quote.author || 'Неизвестный автор';
            const normalizedKey = this._computeLikeKey(quoteText, quoteAuthor);
            
            // Apply like state from _likeStore
            const storeEntry = this._likeStore.get(normalizedKey);
            const isLiked = storeEntry ? storeEntry.liked : !!quote.likedByMe;
            const favoritesCount = storeEntry ? storeEntry.count : (quote.favorites || quote.count || 0);
            
            return `
                <div class="quote-card" data-quote-id="${quote.id || `${chunkId}-${index}`}">
                    <div class="quote-card__content">
                        <div class="quote-card__text">"${this.escapeHtml(quoteText)}"</div>
                        <div class="quote-card__author">— ${this.escapeHtml(quoteAuthor)}</div>
                        <div class="quote-card__footer">
                            <div class="quote-card__likes">
                                <button type="button" class="quote-card__heart-btn${isLiked ? ' favorited' : ''}"
                                        data-quote-text="${this.escapeHtml(quoteText)}"
                                        data-quote-author="${this.escapeHtml(quoteAuthor)}"
                                        data-favorites="${favoritesCount}"
                                        data-normalized-key="${normalizedKey}"
                                        aria-label="Лайк">
                                    <span class="like-icon">${isLiked ? '❤️' : '♡'}</span> <span class="like-count">${favoritesCount}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * 💬 Рендер вставки "Сообщение от Анны"
     * @returns {string} HTML
     */
    _renderAnnaMessageInsert() {
        const message = this.communityMessage || {
            text: "Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!",
            time: "2 часа назад"
        };
        
        return `
            <div class="feed-insert feed-insert--anna">
                <div class="feed-insert__header">
                    <div class="feed-insert__avatar">👩‍🏫</div>
                    <div class="feed-insert__meta">
                        <div class="feed-insert__title">Сообщение от Анны</div>
                        <div class="feed-insert__time">${this.escapeHtml(message.time)}</div>
                    </div>
                </div>
                <div class="feed-insert__content">
                    ${this.escapeHtml(message.text)}
                </div>
            </div>
        `;
    }
    
    /**
     * 📈 Рендер вставки "Тренд недели"
     * @returns {string} HTML
     */
    _renderTrendInsert() {
        const trend = this.communityTrend || {
            title: "Тренд недели",
            text: 'Тема "Психология отношений" набирает популярность',
            buttonText: "Изучить разборы"
        };
        
        return `
            <div class="feed-insert feed-insert--trend">
                <div class="feed-insert__header">
                    <div class="feed-insert__icon">📈</div>
                    <div class="feed-insert__title">${this.escapeHtml(trend.title)}</div>
                </div>
                <div class="feed-insert__content">
                    ${this.escapeHtml(trend.text)}
                </div>
                <button class="feed-insert__button" id="exploreTrendBtn">
                    ${this.escapeHtml(trend.buttonText || "Изучить")}
                </button>
            </div>
        `;
    }
    
    /**
     * 📄 LOAD MORE: Обработчик для ленты "Все"
     */
    async onClickLoadMore() {
        try {
            this.triggerHapticFeedback('light');
            
            const config = window.ConfigManager?.get('feeds.community.feed') || { loadMoreStep: 6 };
            const step = config.loadMoreStep || 6;
            
            const currentCount = this.latestQuotes?.length || 0;
            const newLimit = currentCount + step;
            
            console.log(`📄 Load More: Загружаем еще цитат (${currentCount} → ${newLimit})`);
            
            // Показываем индикатор загрузки
            const loadMoreBtn = document.querySelector('.js-feed-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = 'Загрузка...';
            }
            
            // Загружаем больше цитат
            await this.loadLatestQuotes(newLimit);
            
            // Обновляем только контейнер ленты
            const feedContainer = document.querySelector('.community-feed');
            if (feedContainer) {
                feedContainer.outerHTML = this.composeCommunityFeed(this.latestQuotes);
                
                // Reconcile like data
                this._reconcileAllLikeData();
                this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
                
                // Reattach listeners
                this.attachQuoteCardListeners();
                this.attachFeedLoadMoreListeners();
            }
            
            this.triggerHapticFeedback('success');
            console.log(`✅ Load More: Загружено ${this.latestQuotes.length} цитат`);
            
        } catch (error) {
            console.error('❌ Error loading more quotes:', error);
            this.showNotification('Ошибка загрузки', 'error');
            
            const loadMoreBtn = document.querySelector('.js-feed-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Показать ещё';
            }
        }
    }
    
    /**
     * 👥 LOAD MORE: Обработчик для ленты "Подписки"
     */
    async onClickFollowingLoadMore() {
        try {
            this.triggerHapticFeedback('light');
            
            const config = window.ConfigManager?.get('feeds.community.following') || { loadMoreStep: 6 };
            const step = config.loadMoreStep || 6;
            
            const currentCount = this.followingFeed?.length || 0;
            const newLimit = currentCount + step;
            
            console.log(`👥 Load More Following: Загружаем еще цитат (${currentCount} → ${newLimit})`);
            
            // Показываем индикатор загрузки
            const loadMoreBtn = document.querySelector('.js-following-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = 'Загрузка...';
            }
            
            // Загружаем больше цитат
            await this.loadFollowingFeed(newLimit);
            
            // Обновляем только список
            const followingContainer = document.querySelector('.following-feed__list');
            if (followingContainer && this.followingFeed) {
                const quotesHtml = this._renderFollowingQuotes(this.followingFeed);
                followingContainer.innerHTML = quotesHtml;
                
                // Reconcile like data
                this._reconcileAllLikeData();
                this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
                
                // Reattach listeners
                this.attachQuoteCardListeners();
                this.attachFollowingLoadMoreListeners();
            }
            
            this.triggerHapticFeedback('success');
            console.log(`✅ Load More Following: Загружено ${this.followingFeed.length} цитат`);
            
        } catch (error) {
            console.error('❌ Error loading more following quotes:', error);
            this.showNotification('Ошибка загрузки', 'error');
            
            const loadMoreBtn = document.querySelector('.js-following-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Показать ещё';
            }
        }
    }
    
    /**
     * 👥 Рендер цитат подписок (helper)
     * @param {Array} quotes - Массив цитат
     * @returns {string} HTML
     */
    _renderFollowingQuotes(quotes) {
        return quotes.map(quote => {
            const owner = quote.owner || quote.user;
            const userId = owner?.userId || owner?.id || owner?._id || '';
            const isFollowing = this.followStatusCache?.get(userId) || false;
            
            // Get avatar HTML and display name
            const avatarHtml = this.getUserAvatarHtml(owner, userId, isFollowing);
            const displayName = this._getDisplayNameRow(owner);
            const timeStr = quote.createdAt ? this.formatRelativeTime(new Date(quote.createdAt)) : '';
            
            // Extract and render badge
            const ownerBadges = owner?.badges || [];
            const badgeMarkup = this.createInlineBadgeMarkup(ownerBadges);
            
            const normalizedKey = this._computeLikeKey(quote.text, quote.author);
            const storeEntry = this._likeStore.get(normalizedKey);
            const isLiked = storeEntry ? storeEntry.liked : !!quote.likedByMe;
            const favoritesCount = storeEntry ? storeEntry.count : (quote.favorites || 0);
            
            return `
                <div class="quote-card" data-quote-id="${quote.id || ''}">
                    <div class="quote-card__header">
                        ${avatarHtml}
                        <div class="quote-card__user">
                            <span class="quote-card__user-name" 
                                  data-user-id="${userId}" 
                                  data-is-following="${isFollowing}"
                                  style="cursor: pointer;">${displayName}${badgeMarkup}</span>
                            ${timeStr ? `<div class="quote-card__time">${timeStr}</div>` : ''}
                        </div>
                    </div>
                    <div class="quote-card__text">"${this.escapeHtml(quote.text)}"</div>
                    <div class="quote-card__author">— ${this.escapeHtml(quote.author || 'Неизвестный автор')}</div>
                    <div class="quote-card__footer">
                        <div class="quote-card__likes">
                            <button type="button" class="quote-card__heart-btn${isLiked ? ' favorited' : ''}"
                                    data-quote-text="${this.escapeHtml(quote.text)}"
                                    data-quote-author="${this.escapeHtml(quote.author || '')}"
                                    data-favorites="${favoritesCount}"
                                    data-normalized-key="${normalizedKey}"
                                    aria-label="Лайк">
                                <span class="like-icon">${isLiked ? '❤️' : '♡'}</span> <span class="like-count">${favoritesCount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * 🔄 Переключение фильтра ленты (Все / Подписки / Обложки)
     * ОБНОВЛЕНО: Полный rerender вкладки Feed для всех фильтров (uniform strategy)
     * @param {string} filter - 'all' или 'following' или 'covers'
     */
    async switchFeedFilter(filter) {
        if (this.feedFilter === filter) return;
        
        this.feedFilter = filter;
        this.triggerHapticFeedback('light');
        
        // Обновляем активную кнопку фильтра
        const filterButtons = document.querySelectorAll('.feed-filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // Prefetch data where needed
        try {
            if (filter === 'following' && (!this.followingFeed || this.followingFeed.length === 0)) {
                await this.loadFollowingFeed();
            }
            if (filter === 'covers' && (!this.coversPosts || this.coversPosts.length === 0)) {
                this.coversPosts = null; // show loading state
                await this.loadCovers();
                if (this.coversPosts === null) this.coversPosts = [];
            }
            if (filter === 'following' && this.followingFeed && this.followingFeed.length > 0) {
                this._applyLikeStateToArray(this.followingFeed);
            }
        } catch (e) {
            console.error('❌ Error preloading data on filter switch:', e);
        }
        
        // Full rerender of the Feed tab after filter change
        this.rerender();
        
        // Reconcile likes and reattach listeners after full rerender
        // Delay ensures DOM is fully rendered before reattaching listeners
        setTimeout(() => {
            this._reconcileAllLikeData();
            this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
            this.attachSpotlightListeners();
            this.attachQuoteCardListeners();
            this.attachCommunityCardListeners();
            this.attachCoverUploadFormListeners();
            this.attachCoversLoadMoreListeners();
        }, 100);
    }
    
    /**
     * 🔗 Привязка обработчиков для spotlight секции
     * @private
     */
    attachSpotlightListeners() {
        // Кнопка обновления
        const refreshBtn = document.getElementById('spotlightRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshSpotlight());
        }
        
        // Лайки в spotlight карточках
        const spotlightSection = document.getElementById('spotlightSection');
        if (spotlightSection) {
            spotlightSection.querySelectorAll('.quote-card__heart-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.addQuoteToFavorites(e));
            });
        }
    }

/**
 * 🔄 Обновить spotlight с учетом текущего фильтра
 * ОБНОВЛЕНО: Проверяет feedFilter и обновляет соответствующую ленту
 * ОБНОВЛЕНО: Обновляет только .spotlight-grid без полной замены секции (no flicker)
 */
async refreshSpotlight() {
    try {
        this.triggerHapticFeedback('medium');

        const refreshBtn = document.getElementById('spotlightRefreshBtn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '↻';
            refreshBtn.disabled = true;
            refreshBtn.setAttribute('aria-disabled', 'true');
            refreshBtn.style.animation = 'spin 1s linear infinite';
        }

        // Запоминаем фильтр в начале метода
        const currentFilter = this.feedFilter;

        if (currentFilter === 'following') {
            console.log('🔄 Обновление ленты подписок...');

            // Показываем лоадер сразу
            this.followingFeed = null;
            const s1 = document.getElementById('spotlightSection');
            if (s1) s1.outerHTML = this.renderFollowingFeed();

            // Ждём свежие данные
            await this.loadFollowingFeed();

            // Possible: юзер успел сменить фильтр — НЕ ТРОГАЕМ DOM
            if (this.feedFilter !== 'following') return;

            // Мутируем лайкстор и applyLikeState для loaded данных (избыточно, но безопасно)
            if (this.followingFeed && this.followingFeed.length > 0) {
                this._initializeLikeStoreFromItems(this.followingFeed);
                this._applyLikeStateToArray(this.followingFeed);
            }

            // Еще раз шашкой рендерим только если фильтр всё ещё "following"
            const s2 = document.getElementById('spotlightSection');
            if (s2 && this.feedFilter === 'following') {
                s2.outerHTML = this.renderFollowingFeed();
                this._reconcileAllLikeData();
                this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
                this.attachSpotlightListeners();
                this.attachQuoteCardListeners();
                this.attachCommunityCardListeners();
            }

            this.triggerHapticFeedback('light');
            console.log('✅ Подписки обновлены');
            return;
        }

        // === Блок "Все" ===
        console.log('🔄 Обновление общей ленты...');
        this._spotlightCache = { ts: 0, items: [] };

        // Получаем свежий микс (forceReload)
        const items = await this.buildSpotlightMix(null, true);

        // Применяем лайкстор
        this._initializeLikeStoreFromItems(items);
        this._applyLikeStateToArray(items);

        // После await также проверяем что фильтр не сменился
        if (this.feedFilter !== 'all') return;

        // PARTIAL обновление только grid — если элемент всё ещё актуален!
        requestAnimationFrame(() => {
            const section = document.getElementById('spotlightSection');
            const grid = section?.querySelector('.spotlight-grid');

            if (grid) {
                grid.innerHTML = this._renderSpotlightCards(items);
                this._reconcileAllLikeData();
                this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
                this.attachQuoteCardListeners();
                this.attachCommunityCardListeners();
            } else if (section) {
                section.outerHTML = this.renderSpotlightSection();
                this._reconcileAllLikeData();
                this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
                this.attachSpotlightListeners();
                this.attachQuoteCardListeners();
                this.attachCommunityCardListeners();
            }
        });

        this.triggerHapticFeedback('light');
        console.log('✅ Spotlight refreshed successfully');

    } catch (error) {
        console.error('❌ Error refreshing spotlight:', error);
        this.showNotification('Ошибка обновления', 'error');
    } finally {
        const btn = document.getElementById('spotlightRefreshBtn');
        if (btn) {
            btn.innerHTML = '↻';
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');
            btn.style.animation = '';
        }
    }
}
    
    /**
     * 🔄 B) Centralized refresh for all community feeds
     * Refreshes appropriate feeds based on current active tab and filter
     */
    async refreshCommunityFeeds() {
        try {
            const currentTab = this.activeTab;
            
            if (currentTab === 'feed') {
                // Refresh based on current feed filter
                if (this.feedFilter === 'covers') {
                    // Refresh Covers feed
                    console.log('🔄 Refreshing Covers feed...');
                    this.coversCursor = null;
                    await this.loadCovers(false);
                    this.rerender();
                    this.attachCoverUploadFormListeners();
                } else {
                    // Refresh Following feed or All feed (Цитаты)
                    // Both use the same refreshSpotlight() method which handles the current filter internally
                    console.log(`🔄 Refreshing ${this.feedFilter === 'following' ? 'Following' : 'All'} feed...`);
                    await this.refreshSpotlight();
                }
            } else if (currentTab === 'top') {
                // Refresh Топ недели: popular quotes + leaderboard
                console.log('🔄 Refreshing Top Week tab...');
                
                // Reload popular favorites quotes
                await this.loadPopularFavorites(10);
                
                // Reload leaderboard
                const leaderboardResponse = await this.api.getLeaderboard({ scope: 'week', limit: 10 });
                if (leaderboardResponse?.success) {
                    this.leaderboard = leaderboardResponse.data || [];
                    this.userProgress = leaderboardResponse.me || null;
                    this.loaded.leaderboard = true;
                }
                
                // Partial update of popular week section and leaderboard
                const popularSection = document.getElementById('popularWeekSection');
                if (popularSection) {
                    popularSection.outerHTML = this.renderPopularQuotesWeekSection();
                }
                
                const leaderboardSection = document.getElementById('leaderboardSection');
                if (leaderboardSection) {
                    leaderboardSection.outerHTML = this.renderLeaderboardSection();
                }
                
                // Reconcile like data and reattach listeners
                this._reconcileAllLikeData();
                this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
                this.attachQuoteCardListeners();
                this.attachCommunityCardListeners();
            }
            
            this.triggerHapticFeedback('light');
            console.log('✅ Community feeds refreshed successfully');
        } catch (error) {
            console.error('❌ Error refreshing community feeds:', error);
            this.showNotification('Ошибка обновления', 'error');
        }
    }
    
    /**
     * ➕ Подписаться на пользователя
     */
    async followUser(userId) {
        try {
            this.triggerHapticFeedback('medium');
            const response = await this.api.followUser(userId);
            if (response && response.success) {
                this.followStatusCache.set(userId, true);
                this._saveFollowStatusToStorage(); // ✅ Сохраняем в localStorage
                
                // ✅ Сбрасываем локальный кэш ленты подписок
                this.followingFeed = null;
                
                this.triggerHapticFeedback('success');
                this.showNotification('Вы подписались!', 'success');
                return true;
            }
        } catch (error) {
            console.error('❌ Ошибка подписки:', error);
            this.triggerHapticFeedback('error');
            this.showNotification('Ошибка подписки', 'error');
        }
        return false;
    }

    /**
     * ➖ Отписаться от пользователя
     */
    async unfollowUser(userId) {
        try {
            this.triggerHapticFeedback('medium');
            const response = await this.api.unfollowUser(userId);
            if (response && response.success) {
                this.followStatusCache.set(userId, false);
                this._saveFollowStatusToStorage(); // ✅ Сохраняем в localStorage
                
                // ✅ Сбрасываем локальный кэш ленты подписок
                this.followingFeed = null;
                
                this.triggerHapticFeedback('light');
                this.showNotification('Вы отписались', 'info');
                return true;
            }
        } catch (error) {
            console.error('❌ Ошибка отписки:', error);
            this.triggerHapticFeedback('error');
            this.showNotification('Ошибка отписки', 'error');
        }
        return false;
    }
    
    /**
     * ✨ SPOTLIGHT CACHE METHODS
     */
    
    /**
     * Проверка свежести кэша spotlight (TTL система)
     */
    isSpotlightFresh(ttlMs = SPOTLIGHT_TTL_MS) { // Use constant default (10 minutes)
        const now = Date.now();
        return (now - this._spotlightCache.ts) < ttlMs;
    }

    /**
     * 📊 EXPOSURE TRACKING HELPERS (for anti-repeat logic)
     */
    
    /**
     * Get exposure store from localStorage
     * @returns {{byQuote: Object, byOwner: Object}} exposure store
     */
    _getExposureStore() {
        try {
            const stored = localStorage.getItem('spotlight_exposure_v1');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to parse exposure store:', e);
        }
        return { byQuote: {}, byOwner: {} };
    }

    /**
     * Save exposure store to localStorage
     * @param {{byQuote: Object, byOwner: Object}} store - exposure store
     */
    _saveExposureStore(store) {
        try {
            localStorage.setItem('spotlight_exposure_v1', JSON.stringify(store));
        } catch (e) {
            console.warn('Failed to save exposure store:', e);
        }
    }

    /**
     * 💾 LIKE STORE PERSISTENCE HELPERS
     */

    /**
     * Load like store from localStorage
     * Initializes _likeStore from persisted data with pending=0
     */
    _loadLikeStoreFromStorage() {
    try {
         // VERSION CHECK: Clear old cache if version changed
        const storedVersion = localStorage.getItem(COMMUNITY_LIKE_VERSION_KEY);
        if (storedVersion !== CURRENT_LIKE_VERSION) {
            console.log('🔄 Clearing old like cache, version:', storedVersion, '→', CURRENT_LIKE_VERSION);
            localStorage.removeItem(COMMUNITY_LIKE_STORE_KEY);
            localStorage.setItem(COMMUNITY_LIKE_VERSION_KEY, CURRENT_LIKE_VERSION);
            this._likeStore.clear();
            // ✅ FIX A/B: Set _likeStoreLoaded=true even when clearing - store is now "loaded" (empty)
            this._likeStoreLoaded = true;
            return;
        }

        const stored = localStorage.getItem(COMMUNITY_LIKE_STORE_KEY);
        if (stored) {
            this._likeStore.clear();
            const entries = JSON.parse(stored);
            if (Array.isArray(entries)) {
                entries.forEach(([key, value]) => {
                    this._likeStore.set(key, {
                        liked: value.liked,
                        count: value.count,
                        pending: 0,
                        lastServerCount: value.lastServerCount || value.count
                    });
                });
                console.log(`💾 Loaded ${entries.length} like entries from localStorage`);
            }
        }
        // ✅ FIX A/B: Set _likeStoreLoaded=true upon successful load (even if empty)
        this._likeStoreLoaded = true;
    } catch (e) {
        console.warn('Failed to load like store from localStorage:', e);
        // ✅ FIX A/B: Set _likeStoreLoaded=true even on error to prevent re-initialization loops
        this._likeStoreLoaded = true;
    }
}
    
    /**
     * 💾 FOLLOW STATUS PERSISTENCE HELPERS
     */
    
    /**
     * Load follow status from localStorage
     * @returns {Map} Map of userId -> isFollowing
     */
    _loadFollowStatusFromStorage() {
        try {
            const stored = localStorage.getItem('reader-follow-status-cache');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (typeof parsed === 'object' && parsed !== null) {
                    console.log(`💾 Loaded ${Object.keys(parsed).length} follow statuses from localStorage`);
                    return new Map(Object.entries(parsed));
                }
            }
        } catch (e) {
            console.warn('Failed to load follow status from localStorage:', e);
        }
        return new Map();
    }

    /**
     * Save follow status to localStorage
     */
    _saveFollowStatusToStorage() {
        try {
            const obj = Object.fromEntries(this.followStatusCache);
            localStorage.setItem('reader-follow-status-cache', JSON.stringify(obj));
        } catch (e) {
            console.warn('Failed to save follow status to localStorage:', e);
        }
    }
    
    /**
     * Persist like store to localStorage
     * Saves current state of _likeStore (excluding pending field)
     */
    _persistLikeStore() {
        try {
            // Convert Map to array of [key, value] pairs, excluding pending field
            const entries = Array.from(this._likeStore.entries()).map(([key, value]) => [
                key,
                {
                    liked: value.liked,
                    count: value.count,
                    lastServerCount: value.lastServerCount
                }
            ]);
            localStorage.setItem(COMMUNITY_LIKE_STORE_KEY, JSON.stringify(entries));
        } catch (e) {
            console.warn('Failed to persist like store to localStorage:', e);
        }
    }

    /**
     * Mark a quote as shown in the exposure store
     * @param {string} quoteId - quote ID or text+author key
     * @param {string} ownerId - owner ID
     */
    _markShown(quoteId, ownerId) {
        const store = this._getExposureStore();
        const now = Date.now();
        
        // Track by quote
        if (!store.byQuote[quoteId]) {
            store.byQuote[quoteId] = { lastShownAt: now, impressions: 0 };
        }
        store.byQuote[quoteId].lastShownAt = now;
        store.byQuote[quoteId].impressions++;
        
        // Track by owner
        if (ownerId) {
            if (!store.byOwner[ownerId]) {
                store.byOwner[ownerId] = { lastShownAt: now, impressions: 0 };
            }
            store.byOwner[ownerId].lastShownAt = now;
            store.byOwner[ownerId].impressions++;
        }
        
        this._saveExposureStore(store);
    }

    /**
     * Check if quote was shown recently (within SPOTLIGHT_NO_REPEAT_HOURS)
     * @param {string} quoteId - quote ID or text+author key
     * @returns {boolean} true if shown within last SPOTLIGHT_NO_REPEAT_HOURS
     */
    _wasShownRecently(quoteId) {
        const store = this._getExposureStore();
        const exposure = store.byQuote[quoteId];
        if (!exposure) return false;
        
        const now = Date.now();
        const hoursSinceShown = (now - exposure.lastShownAt) / (1000 * 60 * 60);
        return hoursSinceShown < SPOTLIGHT_NO_REPEAT_HOURS;
    }

    /**
     * Get owner ID from a quote object
     * @param {Object} quote - quote object
     * @returns {string|null} owner ID
     */
    _getOwnerId(quote) {
        if (!quote) return null;
        const owner = quote.owner || quote.creator || quote.addedBy || quote.user;
        return owner?.id || owner?._id || owner?.userId || null;
    }

    /**
     * 🔑 Получение унифицированного userId из owner объекта
     * @param {Object} owner - объект владельца
     * @returns {string|null} userId
     */
    _getUserId(owner) {
        if (!owner) return null;
        return owner.userId || owner.id || owner._id || owner.telegramId || null;
    }
    
    /**
     * Get owner impressions count
     * @param {string} ownerId - owner ID
     * @returns {number} number of impressions
     */
    _getOwnerImpressions(ownerId) {
        if (!ownerId) return 0;
        const store = this._getExposureStore();
        return store.byOwner[ownerId]?.impressions || 0;
    }

    /**
     * Normalize owner field in a quote object
     * @param {Object} quote - quote object
     * @returns {Object} quote with normalized owner field
     */
    _normalizeOwner(quote) {
        if (!quote) return quote;
        const owner = quote.owner || quote.creator || quote.addedBy || quote.user;
        // Normalize likes field: favorites || count || likes
        const favorites = quote.favorites || quote.count || quote.likes || 0;
        return { ...quote, owner, favorites };
    }

    /**
     * Compute normalized key for a quote (text + author)
     * Uses QuoteNormalizer if available, otherwise falls back to server format
     * @param {string} text - Quote text
     * @param {string} author - Quote author
     * @returns {string} Normalized key in format "normalizedText|||normalizedAuthor"
     */
    _computeNormalizedKey(text, author) {
        return (
            window.QuoteNormalizer?.computeNormalizedKey?.(text, author)
        ) ?? (
            String(text || '').trim().toLowerCase() + '|||' + String(author || '').trim().toLowerCase()
        );
    }

    /**
     * 🔑 Compute like key (wrapper around _computeNormalizedKey)
     * @param {string} text - Quote text
     * @param {string} author - Quote author
     * @returns {string} Normalized key for like store
     */
    _computeLikeKey(text, author) {
        return this._computeNormalizedKey(text, author);
    }

    /**
     * 🔄 Дедупликация цитат по normalized key (текст + автор)
     * Оставляет только первую встречу каждой цитаты (самую раннюю по порядку в массиве)
     * @param {Array} quotes - массив цитат
     * @returns {Array} массив без дубликатов
     */
    _deduplicateQuotes(quotes) {
        if (!Array.isArray(quotes)) return quotes;
        const seen = new Set();
        return quotes.filter(quote => {
            if (!quote || !quote.text) return true; // Keep invalid items as-is
            const key = this._computeLikeKey(quote.text, quote.author);
            if (seen.has(key)) {
                console.debug('🔄 _deduplicateQuotes: Пропускаем дубликат:', key);
                return false;
            }
            seen.add(key);
            return true;
        });
    }
    
    /**
     * 🔄 Apply stored like state to a single item
     * Mutates the item to reflect the current state in likeStore
     * @param {Object} item - Quote item with text and author
     */
    _applyLikeStateToItem(item) {
    if (!item || !item.text) return;
    const key = this._computeLikeKey(item.text, item.author);
    const storeEntry = this._likeStore.get(key);
    
    // ✅ КРИТИЧНО: Приоритет данным из _likeStore (localStorage) над API
    // Rationale: localStorage-backed _likeStore captures optimistic toggles and is reconciled
    // to server counts; UI should not revert to false when backend omits likedByMe.
    
    if (storeEntry) {
        // Локальное хранилище имеет приоритет - применяем сохранённое состояние
        item.likedByMe = storeEntry.liked;
        item.favorites = storeEntry.count;
        item.isLiked = storeEntry.liked;
        item.likeCount = storeEntry.count;
    } else {
        // Нет записи в localStorage - инициализируем из API данных
        const apiLiked = !!item.likedByMe;
        const apiCount = item.favorites ?? 0;
        
        item.isLiked = apiLiked;
        item.likeCount = apiCount;
        
        // Сохраняем в _likeStore для будущей синхронизации
        this._likeStore.set(key, {
            liked: apiLiked,
            count: apiCount,
            pending: 0,
            lastServerCount: apiCount
        });
    }
}

    /**
     * 🔄 Apply stored like state to an array of items
     * @param {Array} items - Array of quote items
     * @returns {Array} Same array (mutated in place)
     */
    _applyLikeStateToArray(items) {
        if (!Array.isArray(items)) return items;
        items.forEach(item => this._applyLikeStateToItem(item));
        return items;
    }

    /**
     * 🔄 Reconcile all like data - runs after data loads to apply stored state
     * Applies to spotlight cache, popularFavorites, popularQuotes, and latestQuotes
     */
    _reconcileAllLikeData() {
        // Apply to spotlight cache
        if (this._spotlightCache.items && this._spotlightCache.items.length > 0) {
            this._applyLikeStateToArray(this._spotlightCache.items);
        }
        
        // Apply to popular favorites
        if (this.popularFavorites && this.popularFavorites.length > 0) {
            this._applyLikeStateToArray(this.popularFavorites);
        }
        
        // Apply to popular quotes
        if (this.popularQuotes && this.popularQuotes.length > 0) {
            this._applyLikeStateToArray(this.popularQuotes);
        }
        
        // Apply to latest quotes
        if (this.latestQuotes && this.latestQuotes.length > 0) {
            this._applyLikeStateToArray(this.latestQuotes);
        }
    }

    /**
     * 🔄 Update all like buttons in DOM for a specific quote key
     * Syncs visual state across all sections (Spotlight + Weekly Top)
     * @param {string} key - Normalized key
     */
    _updateAllLikeButtonsForKey(key) {
        const storeEntry = this._likeStore.get(key);
        if (!storeEntry) return;
        
        // Find all buttons with this normalized key
        const buttons = document.querySelectorAll(`[data-normalized-key="${CSS.escape(key)}"]`);
        
        buttons.forEach(button => {
            const quoteCard = button.closest('.quote-card');
            if (!quoteCard) return;
            
            // Update button visual state
            if (storeEntry.liked) {
                button.classList.add('favorited');
            } else {
                button.classList.remove('favorited');
            }
            
            // Update count in button data attribute
            button.dataset.favorites = storeEntry.count;
            
            // Update icon in button (emoji hearts)
            const likeIconElement = button.querySelector('.like-icon');
            if (likeIconElement) {
                likeIconElement.textContent = storeEntry.liked ? '❤️' : '♡';
            }
            
            // Update count in UI - support both .like-count and legacy .favorites-count
            const likeCountElement = button.querySelector('.like-count') || quoteCard.querySelector('.favorites-count');
            if (likeCountElement) {
                likeCountElement.textContent = storeEntry.count;
            }
        });
    }

    /**
     * 🔄 Sync collections (cached arrays) for a specific key
     * Updates spotlight cache, popularFavorites, popularQuotes, and latestQuotes
     * @param {string} key - Normalized key
     * @param {Function} updater - Function to update the item (item, storeEntry) => void
     */
    _syncCollectionsForKey(key, updater) {
        const storeEntry = this._likeStore.get(key);
        if (!storeEntry) return;
        
        // Update spotlight cache
        if (this._spotlightCache.items && this._spotlightCache.items.length > 0) {
            const spotlightItem = this._spotlightCache.items.find(item => 
                this._computeLikeKey(item.text, item.author) === key
            );
            if (spotlightItem) {
                updater(spotlightItem, storeEntry);
            }
        }
        
        // Update popular favorites
        if (this.popularFavorites && this.popularFavorites.length > 0) {
            const popularItem = this.popularFavorites.find(item => 
                this._computeLikeKey(item.text, item.author) === key
            );
            if (popularItem) {
                updater(popularItem, storeEntry);
            }
        }
        
        // Update popular quotes
        if (this.popularQuotes && this.popularQuotes.length > 0) {
            const popularItem = this.popularQuotes.find(item => 
                this._computeLikeKey(item.text, item.author) === key
            );
            if (popularItem) {
                updater(popularItem, storeEntry);
            }
        }
        
        // Update latest quotes
        if (this.latestQuotes && this.latestQuotes.length > 0) {
            const latestItem = this.latestQuotes.find(item => 
                this._computeLikeKey(item.text, item.author) === key
            );
            if (latestItem) {
                updater(latestItem, storeEntry);
            }
        }
    }

    /**
     * 🔄 Initialize/update likeStore from server data
     * Populates store only if entry doesn't exist or isn't pending
     * ✅ FIX A: When _likeStoreLoaded=true, do NOT overwrite existing entries from API data
     * @param {Array} items - Array of quote items with likedByMe and favorites fields
     */
    _initializeLikeStoreFromItems(items) {
        if (!Array.isArray(items)) return;
        
        items.forEach(item => {
            if (!item || !item.text) return;
            
            const key = this._computeLikeKey(item.text, item.author);
            const existingEntry = this._likeStore.get(key);
            
            // ✅ FIX A: If _likeStoreLoaded=true and entry exists, skip - local store is source of truth
            if (this._likeStoreLoaded && existingEntry) {
                // Do NOT overwrite local entry with API data - local is source of truth
                return;
            }
            
            // Only initialize if entry doesn't exist or is not pending
            if (!existingEntry || existingEntry.pending === 0) {
                const liked = !!item.likedByMe;
                const count = item.favorites || item.count || item.likes || 0;
                
                this._likeStore.set(key, {
                    liked,
                    count,
                    pending: 0,
                    lastServerCount: count
                });
            }
        });
    }

    /**
     * Построение микса spotlight: 12 карточек с чередованием L↔F (50/50)
     * ОБНОВЛЕНО: Конфигурируемое количество, соотношение и фоллбэки
     * @param {number|null} targetCount - Целевое количество (из конфига если null)
     * @param {boolean} forceReload - Принудительная перезагрузка без кеша
     */
    async buildSpotlightMix(targetCount = null, forceReload = false) {
      const cfg = window.ConfigManager?.get('feeds.community.spotlight') || {
        targetCount: 12,
        ratio: { latest: 1, favorites: 1 },
        fallback: ['popularFavorites','popular'],
        ttlMs: 10 * 60 * 1000
      };
      const count = targetCount || cfg.targetCount || 12;
      const ttlMs = cfg.ttlMs || 10 * 60 * 1000;
    
      // Кэш, если свежий и достаточный
      if (!forceReload && this.isSpotlightFresh(ttlMs) && (this._spotlightCache?.items?.length || 0) >= count) {
        this._applyLikeStateToArray(this._spotlightCache.items);
        return this._spotlightCache.items.slice(0, count);
      }
    
      const ratio = cfg.ratio || { latest: 1, favorites: 1 };
      const total = Math.max(1, (ratio.latest || 1) + (ratio.favorites || 1));
      const needLatest = Math.ceil(count * (ratio.latest || 1) / total);
      const needFavs   = count - needLatest;
    
      // Параллельно грузим источники (по логам latest есть, favs часто 0)
      const [latestResp, favsResp] = await Promise.allSettled([
        this.api.getCommunityLatestQuotes({ limit: needLatest + 3, noCache: !!forceReload }),
        this.api.getCommunityRecentFavorites({ limit: needFavs + 5, noCache: !!forceReload })
      ]);
    
      const normalize = (q) => this._normalizeOwner(q);
      const normKey   = (q) => this._computeLikeKey(q.text || q.content || '', q.author || q.authorName || '');
    
      let latest = [];
      let favs   = [];
    
      // Надежный парсинг: data | quotes | data.quotes
      if (latestResp.status === 'fulfilled' && latestResp.value?.success) {
        const arr = latestResp.value.data || latestResp.value.quotes || latestResp.value.data?.quotes || [];
        latest = arr.map(normalize);
      }
      if (favsResp.status === 'fulfilled' && favsResp.value?.success) {
        const arr = favsResp.value.data || favsResp.value.quotes || favsResp.value.data?.quotes || [];
        favs = arr.map(normalize);
      }
    
      // Дедуп внутри
      latest = this._deduplicateQuotes(latest);
      favs   = this._deduplicateQuotes(favs);
    
      // Мягкий дедуп latest против favs — не обнулять latest целиком
      const favKeys = new Set(favs.map(normKey));
      const filteredLatest = latest.filter(q => !favKeys.has(normKey(q)));
      latest = filteredLatest.length ? filteredLatest : latest;
    
      // Применить лайки
      this._applyLikeStateToArray(latest);
      this._applyLikeStateToArray(favs);
    
      // Сборка: L↔F, затем ДОБОР из latest, если favs мало/нет, потом fallback
      const items = [];
      const seen = new Set();
      let li = 0, fi = 0;
    
      // Основной интерлив (чередование latest <-> favorite)
      for (let i = 0; i < count; i++) {
        const useLatest = (i % 2 === 0);
        let q = null;
        let kind = null;
        
        if (useLatest && li < latest.length) { q = latest[li++]; kind = 'latest'; }
        else if (!useLatest && fi < favs.length) { q = favs[fi++]; kind = 'favorite'; }
        else if (li < latest.length) { q = latest[li++]; kind = 'latest'; }
        else if (fi < favs.length) { q = favs[fi++]; kind = 'favorite'; }
        
        if (!q) break;
        
        const key = normKey(q);
        if (seen.has(key)) { i--; continue; }
        seen.add(key);
        
        items.push({
          kind,
          id: q.id || q._id,
          text: q.text || q.content || '',
          author: q.author || q.authorName || '',
          createdAt: q.createdAt,
          favorites: q.favorites || q.count || q.likes || 0,
          owner: q.owner,
          user: q.user || q.owner || null,
          likedByMe: !!q.likedByMe
        });
      } 
        
      // Потом обычный добор из latest, если favs закончились, уже ВНЕ основного цикла!
      while (items.length < count && li < latest.length) {
        const q = latest[li++];
        const key = normKey(q);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          kind: 'latest',
          id: q.id || q._id,
          text: q.text || q.content || '',
          author: q.author || q.authorName || '',
          createdAt: q.createdAt,
          favorites: q.favorites || q.count || q.likes || 0,
          owner: q.owner,
          user: q.user || q.owner || null,
          likedByMe: !!q.likedByMe
        });
      }
    
      // Fallback из популярных до достижения count
      const fillFrom = async (method) => {
        if (items.length >= count) return;
        let resp;
        try {
          if (method === 'popularFavorites') {
            resp = await this.api.getCommunityPopularFavorites({ limit: (count - items.length) + 5, noCache: !!forceReload });
          } else if (method === 'popular') {
            resp = await this.api.getCommunityPopularQuotes({ limit: (count - items.length) + 5, noCache: !!forceReload });
          }
        } catch { resp = null; }
    
        if (resp?.success) {
          let arr = (resp.data || resp.quotes || resp.data?.quotes || []).map(normalize);
          arr = this._deduplicateQuotes(arr);
          this._applyLikeStateToArray(arr);
          for (const q of arr) {
            if (items.length >= count) break;
            const key = normKey(q);
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({
              kind: 'fallback',
              id: q.id || q._id,
              text: q.text || q.content || '',
              author: q.author || q.authorName || '',
              createdAt: q.createdAt,
              favorites: q.favorites || q.count || q.likes || 0,
              owner: q.owner,
              user: q.user || q.owner || null,
              likedByMe: !!q.likedByMe
            });
          }
        }
      };
    
      if (items.length < count) {
        for (const m of (cfg.fallback || [])) {
          if (items.length >= count) break;
          await fillFrom(m);
        }
      }
    
      const finalItems = items.slice(0, count);
      this._spotlightCache = { items: finalItems, ts: Date.now() };
      this._initializeLikeStoreFromItems(finalItems);
      this._applyLikeStateToArray(finalItems);
      return finalItems;
    }
    
    // ЗАМЕНИТЬ текущую реализацию этой функции полностью
    async onClickFollowingLoadMore() {
      try {
        this.triggerHapticFeedback('light');
        const cfg = window.ConfigManager?.get('feeds.community.following') || { loadMoreStep: 6 };
        const step = cfg.loadMoreStep || 6;
        const before = this.followingFeed?.length || 0;
        const next = before + step;
    
        const btn = document.querySelector('.js-following-load-more');
        if (btn) { btn.disabled = true; btn.textContent = 'Загрузка...'; }
    
        // Важно: запрос без кэша, чтобы реально пытаться получить больше
        await this.loadFollowingFeed(next);
    
        const list = document.querySelector('.following-feed__list');
        const after = this.followingFeed?.length || 0;
    
        if (list) {
          list.innerHTML = this._renderFollowingQuotes(this.followingFeed);
          this._reconcileAllLikeData();
          this._likeStore?.forEach?.((_, key) => this._updateAllLikeButtonsForKey(key));
          this.attachQuoteCardListeners();
          this.attachFollowingLoadMoreListeners();
        }
    
        // Если длина не выросла (сервер ограничивает до 10) — отключить кнопку
        if (btn) {
          if (after > before) {
            btn.disabled = false;
            btn.textContent = 'Показать ещё';
          } else {
            btn.textContent = 'Больше нет';
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            btn.classList.add('is-disabled');
          }
        }
    
        this.triggerHapticFeedback('success');
      } catch (e) {
        console.error('Error loading more following quotes:', e);
        this.showNotification('Ошибка загрузки', 'error');
        const btn = document.querySelector('.js-following-load-more');
        if (btn) { btn.disabled = false; btn.textContent = 'Показать ещё'; }
      }
    }

    /**
     * Получение spotlight элементов с учетом кэша
     * ОБНОВЛЕНО: Использует новый buildSpotlightMix с конфигурацией
     */
    async getSpotlightItems() {
        const config = window.ConfigManager?.get('feeds.community.spotlight') || { ttlMs: 10 * 60 * 1000 };
        
        if (this.isSpotlightFresh(config.ttlMs)) {
            // Apply stored like state even to cached items
            this._applyLikeStateToArray(this._spotlightCache.items);
            return this._spotlightCache.items;
        }
        
        // Обновляем кэш используя новый метод
        const items = await this.buildSpotlightMix(null, false);
        
        // Initialize likeStore from server data in spotlight items
        this._initializeLikeStoreFromItems(items);
        
        // Apply stored like state to new items (for pending actions)
        this._applyLikeStateToArray(items);
        
        return items;
    }

    /**
     * 📸 РЕНДЕР ЛЕНТЫ ОБЛОЖЕК (COVERS)
     */
    renderCoversSection() {
        // Initialize upload form if not already created
        if (!this.coverUploadForm) {
            this.coverUploadForm = new CoverUploadForm({
                api: this.api,
                onSuccess: (result) => {
                    console.log('✅ CommunityPage: Photo uploaded successfully, refreshing feed...');
                    this.handleUploadSuccess(result);
                },
                onError: (error) => {
                    console.error('❌ CommunityPage: Upload failed:', error);
                }
            });
        }
        
        const uploadFormHtml = this.coverUploadForm.render();
        
        if (this.coversPosts === null) {
            return `
                <div id="spotlightSection" class="community-spotlight">
                    ${uploadFormHtml}
                    <div class="loading-indicator" style="text-align: center; padding: 40px;">
                        <div class="spinner"></div>
                        <div style="margin-top: 12px; color: var(--text-secondary);">Загрузка...</div>
                    </div>
                </div>
            `;
        }
        
        const emptyStateHtml = (!this.coversPosts || this.coversPosts.length === 0) 
            ? '<div class="empty-following"><div class="empty-following__icon">📸</div><div class="empty-following__title">Лента обложек пуста</div><div class="empty-following__text">Добавьте свою первую обложку! 📸</div></div>'
            : '';
        
        const postsHtml = (this.coversPosts && this.coversPosts.length > 0) 
            ? this.coversPosts.map(post => this.renderCoverCard(post)).join('')
            : '';
        
        return `
            <div id="spotlightSection" class="community-spotlight">
                ${uploadFormHtml}
                ${emptyStateHtml}
                ${postsHtml ? `<div class="spotlight-grid">${postsHtml}</div>` : ''}
                ${this.coversHasMore ? '<div class="feed-load-more"><button class="feed-load-more__btn js-covers-load-more">Показать ещё</button></div>' : ''}
            </div>
        `;
    }
    
    /**
     * 🎴 РЕНДЕР ОДНОЙ COVER CARD
     */
    renderCoverCard(post) {
        const user = post.user || {};
        const userId = user.userId || '';
        const isPinned = post.isPinned || false;
        const caption = post.caption || '';
        const commentsCount = post.commentsCount || 0;
        const createdAt = post.createdAt ? new Date(post.createdAt) : new Date();
        const timeStr = this.formatRelativeTime(createdAt);
        const displayName = this._getDisplayNameRow(user);
        
        // Check if this is the current user's post
        const currentUserId = this.api && typeof this.api.resolveUserId === 'function' ? this.api.resolveUserId() : null;
        const isOwnPost = currentUserId && userId && currentUserId === userId;
        
        const avatarUrl = user.avatarUrl || '';
        const avatarHtml = avatarUrl 
            ? `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(displayName)}" class="cover-card__avatar" data-user-id="${userId}" style="cursor: pointer;">`
            : `<div class="cover-card__avatar" data-user-id="${userId}" style="cursor: pointer; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">👤</div>`;
        
        // Like data
        const likesCount = post.likesCount || 0;
        const liked = post.liked || false;
        
        // Add delete button for own posts
        const deleteButtonHtml = isOwnPost 
            ? '<button class="cover-card__delete-btn" data-action="delete-cover" data-post-id="' + (post._id || post.id) + '" title="Удалить">✕</button>'
            : '';
        
        // 🔧 HOTFIX: Cache-busting for images (avoid stale CDN/browser cache)
        const postId = post._id || post.id;
        const updatedAt = post.updatedAt || post.createdAt;
        const cacheBuster = updatedAt ? `?v=${new Date(updatedAt).getTime()}` : `?t=${postId}`;
        const imageUrlWithCache = this.escapeHtml(post.imageUrl) + cacheBuster;
        
        return `
            <div class="cover-card" data-post-id="${postId}">
                <div class="cover-card__header">
                    ${avatarHtml}
                    <div class="cover-card__user-info">
                        <div class="cover-card__name" data-user-id="${userId}" style="cursor: pointer;">${displayName}</div>
                        <div class="cover-card__date">${timeStr}</div>
                    </div>
                    ${isPinned ? '<div class="cover-card__pin-badge">📌 Закреплено</div>' : ''}
                    ${deleteButtonHtml}
                </div>
                <img src="${imageUrlWithCache}" alt="${this.escapeHtml(caption)}" class="cover-photo" data-action="open-image" data-image-url="${imageUrlWithCache}" data-caption="${this.escapeHtml(caption)}">
                ${caption ? `<div class="cover-card__caption">${this.escapeHtml(caption)}</div>` : ''}
                <div class="cover-card__actions">
                    <button class="cover-card__action-btn cover-card__like-btn${liked ? ' liked' : ''}" 
                            data-action="like-cover" 
                            data-post-id="${postId}"
                            data-liked="${liked}">
                        <span class="like-icon">${liked ? '❤️' : '♡'}</span> <span class="like-count">${likesCount}</span>
                    </button>
                    <button class="cover-card__action-btn" data-action="show-comments" data-post-id="${postId}">
                        💬 ${commentsCount > 0 ? commentsCount : 'Комментарии'}
                    </button>
                </div>
                <div class="cover-card__comments-section" id="comments-${postId}" style="display: none;"></div>
            </div>
        `;
    }

    /**
     * ✨ Рендер секции "Сейчас в сообществе"
     * ✅ FIX C: Added guard to prevent multiple builds/renders within cooldown
     */
    renderSpotlightSection() {
        // Для рендера используем кэшированные данные если есть, иначе показываем скелетон
        const items = this.isSpotlightFresh() ? this._spotlightCache.items : [];
        
        let cards = '';
        
        if (!items || items.length === 0) {
            // ✅ FIX C: Check build guard before triggering background load
            const now = Date.now();
            const withinCooldown = (now - this._lastSpotlightBuildTs) < SPOTLIGHT_BUILD_COOLDOWN_MS;
            
            // Если кэш пуст, инициируем загрузку в фоне (but only if not within cooldown)
            if (!this.isSpotlightFresh() && !this._spotlightBuildInFlight && !withinCooldown) {
                this._spotlightBuildInFlight = true;
                this._lastSpotlightBuildTs = now;
                
                this.getSpotlightItems().then(() => {
                    this._spotlightBuildInFlight = false;
                    // ✅ FIX C: Use single batched rAF update instead of _scheduleRerender
                    // to avoid multiple DOM replacements
                    requestAnimationFrame(() => {
                        const spotlightSection = document.getElementById('spotlightSection');
                        if (spotlightSection) {
                            const newHTML = this._renderSpotlightCards();
                            const gridElement = spotlightSection.querySelector('.spotlight-grid');
                            if (gridElement) {
                                // Update inner content only, not the whole container
                                gridElement.innerHTML = newHTML;
                            } else {
                                // Fallback: replace entire section
                                spotlightSection.outerHTML = this.renderSpotlightSection();
                            }
                            // Reconcile like data after DOM update
                            this._reconcileAllLikeData();
                            this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
                            this.attachQuoteCardListeners();
                            this.attachCommunityCardListeners();
                        }
                    });
                }).catch(error => {
                    this._spotlightBuildInFlight = false;
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
            cards = this._renderSpotlightCards();
        }
        
        // ALWAYS render container (with refresh button) even if no items
        return `
            <div id="spotlightSection" class="community-spotlight">
                <div class="spotlight-grid">
                    ${cards}
                </div>
            </div>
        `;
    }

    /**
     * ✅ UNIFIED: Helper method to render spotlight cards HTML (supports both cached and passed items)
     * @param {Array|null} items - Optional array of items to render. If null, uses cached items.
     * @returns {string} HTML string of spotlight cards
     * @private
     */
    _renderSpotlightCards(items = null) {
        // Use provided items if Array.isArray(items), otherwise use cached items
        const sourceItems = Array.isArray(items) ? items : (this._spotlightCache.items || []);
        
        return sourceItems.map(item => {
            // Render badges strictly by item.kind: 'latest' => Новое, 'favorite' => Избранное, 'fallback' => Популярное
            let badge = '';
            let badgeClass = '';
            if (item.kind === 'latest') {
                badge = 'Новое';
                badgeClass = 'spotlight-card--fresh';
            } else if (item.kind === 'favorite') {
                badge = 'Избранное';
                badgeClass = 'spotlight-card--fav';
            } else if (item.kind === 'fallback') {
                badge = 'Популярное';
                badgeClass = 'spotlight-card--fallback';
            }
            
            // Derive owner = item.owner || item.user
            const owner = item.owner || item.user;
            const userId = owner?.userId || owner?.id || owner?._id || owner?.telegramId || '';
            const isFollowing = this.followStatusCache?.get(userId) || false;
            const userAvatarHtml = this.getUserAvatarHtml(owner, userId, isFollowing);
            const displayName = this._getDisplayNameRow(owner);
            const timeStr = item.createdAt ? this.formatRelativeTime(new Date(item.createdAt)) : '';
            
            // Apply like state by normalized key via _likeStore with _computeLikeKey()
            const normalizedKey = this._computeLikeKey(item.text, item.author);
            const storeEntry = this._likeStore.get(normalizedKey);
            const isLiked = storeEntry ? storeEntry.liked : !!item.likedByMe;
            const likesCount = storeEntry ? storeEntry.count : (item.favorites || 0);
            
            return `
                <div class="quote-card ${badgeClass}" data-kind="${item.kind || ''}" data-quote-id="${item.id || ''}">
                    ${badge ? `<div class="spotlight-badge">${badge}</div>` : ''}
                    
                    <!-- Header с аватаром и именем пользователя -->
                    <div class="quote-card__header" style="cursor: pointer;">
                        ${userAvatarHtml}
                        <div class="quote-card__user">
                            <span class="quote-card__user-name" 
                                  data-user-id="${userId}" 
                                  data-is-following="${isFollowing}"
                                  style="cursor: pointer;">${displayName}</span>
                            ${timeStr ? `<div class="quote-card__time">${timeStr}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Основной контент -->
                    <div class="quote-card__text">"${this.escapeHtml(item.text)}"</div>
                    <div class="quote-card__author">— ${this.escapeHtml(item.author || 'Неизвестный автор')}</div>
                    
                    <!-- Footer с лайками слева и действиями справа -->
                    <div class="quote-card__footer">
                        <div class="quote-card__likes">
                            <button type="button" class="quote-card__heart-btn${isLiked ? ' favorited' : ''}" 
                                    data-quote-id="${item.id || ''}"
                                    data-quote-text="${this.escapeHtml(item.text)}"
                                    data-quote-author="${this.escapeHtml(item.author || 'Неизвестный автор')}"
                                    data-favorites="${likesCount}"
                                    data-normalized-key="${normalizedKey}"
                                    aria-label="Добавить в избранное">
                                <span class="like-icon">${isLiked ? '❤️' : '♡'}</span> <span class="like-count">${likesCount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * ✨ Рендер секции "Сейчас в сообществе" для ленты ПОДПИСОК
     * COMPATIBILITY PROXY: Redirects to renderFollowingFeed()
     * @returns {string} HTML секции spotlight с цитатами от подписок
     */
    renderSpotlightFollowing() {
        return this.renderFollowingFeed();
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
         * 🏅 Создать HTML для инлайн бейджа пользователя
         * @param {Array<string>} badgeList - Список ID бейджей пользователя
         * @returns {string} HTML разметка инлайн бейджа или пустая строка
         */
        createInlineBadgeMarkup(badgeList) {
            if (!badgeList || badgeList.length === 0) return '';
            
            // Показываем только первый (основной) бейдж
            const topBadge = badgeList.find(bid => COMMUNITY_BADGE_PATHS[bid]);
            if (!topBadge) return '';
            
            const assetPath = COMMUNITY_BADGE_PATHS[topBadge];
            const badgeLabel = topBadge === 'alice_badge' 
                ? 'Бейдж «Алиса в стране чудес»'
                : `Бейдж ${topBadge}`;
            
            return `<img src="${assetPath}" alt="${badgeLabel}" title="${badgeLabel}" class="badge-inline" />`;
        }
        
    /**
     * 🖼️ Построение HTML для аватара пользователя с фоллбэком на инициалы
     * @param {Object} user - объект пользователя с полями userId, name, avatarUrl
     * @returns {string} HTML строка с аватаром или инициалами
     */
    getUserAvatarHtml(user, userId = '', isFollowing = false) {
        // Validate userId is safe for data attribute (alphanumeric, dash, underscore only)
        const safeUserId = userId && /^[a-zA-Z0-9_-]+$/.test(userId) ? userId : '';
        const dataAttrs = safeUserId ? `data-user-id="${safeUserId}" data-is-following="${isFollowing}" style="cursor: pointer;"` : '';
        
        if (!user) {
            // Фоллбэк если пользователь отсутствует
            return `<div class="quote-card__user-avatar" ${dataAttrs}>
                <div class="avatar-initials">?</div>
            </div>`;
        }
        
        const name = user.name || 'Пользователь';
        const initials = this.getInitials(name);
        
        if (user.avatarUrl) {
            // Есть аватар - показываем изображение с фоллбэком на инициалы
            return `<div class="quote-card__user-avatar" ${dataAttrs}>
                <img src="${this.escapeHtml(user.avatarUrl)}" 
                     alt="${this.escapeHtml(name)}" 
                     class="avatar-image"
                     onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
                <div class="avatar-initials fallback" style="display:none;">${initials}</div>
            </div>`;
        } else {
            // Нет аватара - показываем инициалы
            return `<div class="quote-card__user-avatar" ${dataAttrs}>
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
     * 📝 Get display name row with username (Name · @username)
     * @param {Object} user - User object with name and telegramUsername
     * @returns {string} Formatted display name
     */
    _getDisplayNameRow(user) {
        if (!user) return 'Пользователь';
        const name = user.name || 'Пользователь';
        const username = user.telegramUsername;
        
        // Check for alice achievement and add badge icon
        const hasAlice = user.achievements?.some(a => a.achievementId === 'alice' || a === 'alice');
        const badgeHtml = hasAlice 
            ? '<img src="/assets/badges/alice.png" alt="Бейдж «Алиса»" title="Бейдж «Алиса в стране чудес»" class="badge-inline" />' 
            : '';
        
        if (username) {
            return `${this.escapeHtml(name)}${badgeHtml} · @${this.escapeHtml(username)}`;
        }
        return `${this.escapeHtml(name)}${badgeHtml}`;
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
                ${this.renderPtrIndicator()}
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
        // 👥 ФИЛЬТР ЛЕНТЫ (Цитаты / Подписки / КнижныйКадр)
        const feedFilterHtml = `
            <div class="feed-filter">
                <button class="feed-filter-btn ${this.feedFilter === 'all' ? 'active' : ''}"
                        data-filter="all">Цитаты</button>
                <button class="feed-filter-btn ${this.feedFilter === 'following' ? 'active' : ''}"
                        data-filter="following">Подписки</button>
                <button class="feed-filter-btn ${this.feedFilter === 'covers' ? 'active' : ''}"
                        data-filter="covers">КнижныйКадр</button>
            </div>
        `;

        // Content changes based on filter
        let contentSection;
        if (this.feedFilter === 'covers') {
            contentSection = this.renderCoversSection();
        } else {
            // Spotlight секция меняется в зависимости от фильтра
            const spotlightSection = this.feedFilter === 'following' 
                ? this.renderFollowingFeed()
                : this.renderSpotlightSection();
                    
            // "Сейчас изучают" секция с последними кликами по каталогу
            const currentlyStudyingSection = this.renderCurrentlyStudyingSection();
            
            // Сообщение от Анны с fallback
            const annaMessageSection = this.renderAnnaMessageSection();
            
            // Тренд недели с fallback
            const trendSection = this.renderTrendSection();
            
            contentSection = `
                <div class="stats-summary">
                    📊 Сегодня: ${this.communityData.activeReaders} активных читателей • ${this.communityData.newQuotes} новых цитат
                </div>
                
                ${spotlightSection}
                
                ${currentlyStudyingSection}
                
                ${annaMessageSection}
                
                ${trendSection}
            `;
        }
        
        return `
            ${feedFilterHtml}
            ${contentSection}
        `;
    }
    
    /**
     * 👥 РЕНДЕР ЛЕНТЫ ОТ ПОДПИСОК
     * ОБНОВЛЕНО: Handles three states (loading/empty/data) and wraps in section#spotlightSection
     */
    renderFollowingFeed() {
        // Handle three states: loading (null), empty ([]), data
        if (this.followingFeed === null) {
            // Loading state
            return `
                <div id="spotlightSection" class="community-spotlight">
                    <div class="spotlight-grid">
                        <div class="loading-indicator" style="text-align: center; padding: 40px;">
                            <div class="spinner"></div>
                            <div style="margin-top: 12px; color: var(--text-secondary);">Загрузка...</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (!this.followingFeed || this.followingFeed.length === 0) {
            // Empty state - NO "Показать ещё" button
            return `
                <div id="spotlightSection" class="community-spotlight">
                    <div class="spotlight-grid">
                        <div class="empty-following">
                            <div class="empty-following__icon">👥</div>
                            <div class="empty-following__title">Лента пуста</div>
                            <div class="empty-following__text">
                                Подпишитесь на интересных читателей, чтобы видеть их цитаты здесь
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    
        // Data state - render quotes via _renderFollowingQuotes
        const quotesHtml = this._renderFollowingQuotes(this.followingFeed);
    
        // NO "Показать ещё" button for Following feed
        return `
            <div id="spotlightSection" class="community-spotlight">
                <div class="spotlight-grid">
                    ${quotesHtml}
                </div>
            </div>
        `;
    }
    
    /**
     * 📰 СЕКЦИЯ ПОСЛЕДНИХ ЦИТАТ СООБЩЕСТВА (ОБНОВЛЕНО ДЛЯ PR-3)
     * ОБНОВЛЕНО: Использует composeCommunityFeed с вставками и Load More
     */
    renderLatestQuotesSection() {
        // Пустое состояние
        if (!Array.isArray(this.latestQuotes) || this.latestQuotes.length === 0) {
            return this.renderEmptyLatest?.() || '';
        }
    
        // Компоновка ленты с вставками
        const feedHtml = this.composeCommunityFeed(this.latestQuotes);
    
        // Управляемость через конфиг
        const config = window.ConfigManager?.get('feeds.community.feed') || { initialCount: 12 };
        const showLoadMore = (this.latestQuotes.length >= (config.initialCount || 12));
    
        // Возвращаем разметку
        return `
            <div class="latest-quotes-section">
                <div class="mvp-community-title">💫 Последние цитаты сообщества</div>
                ${feedHtml}
                ${showLoadMore ? `
                    <div class="feed-load-more">
                        <button class="feed-load-more__btn js-feed-load-more">Показать ещё</button>
                    </div>
                ` : ''}
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
                         onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)" />
                    <div class="leader-avatar-fallback fallback">${initials || 'А'}</div>
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
                <div id="leaderboardSection" class="leaders-week-section">
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
                <div id="leaderboardSection" class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки лидерборда</div>
                    <div class="error-description">${this.errorStates.leaderboard}</div>
                    <button class="error-retry-btn" data-retry="leaderboard" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.leaderboard || this.leaderboard.length === 0) {
            return `
                <div id="leaderboardSection" class="empty-state">
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
            <div id="leaderboardSection" class="leaders-week-section">
                <div class="spotlight-header">
                    <div>
                        <div class="leaders-week-title">🏆 Лидеры недели</div>
                        <div class="leaders-week-subtitle">Самые активные читатели сообщества</div>
                    </div>
                </div>
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
        // Header without refresh button (replaced with pull-to-refresh)
        const header = `
            <div class="spotlight-header">
                <h3 class="popular-quotes-week-title">⭐ Популярные цитаты недели</h3>
            </div>
        `;
    
        if (this.loadingStates.popularFavorites) {
            return `
                <div id="popularWeekSection" class="popular-quotes-week-section">
                    ${header}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем топ цитат...</div>
                    </div>
                </div>
            `;
        }
    
        if (this.errorStates.popularFavorites) {
            return `
                <div id="popularWeekSection" class="popular-quotes-week-section">
                    ${header}
                    <div class="error-state">
                        <div class="error-icon">❌</div>
                        <div class="error-title">Ошибка загрузки цитат</div>
                        <div class="error-description">${this.errorStates.popularFavorites}</div>
                        <button class="error-retry-btn" data-retry="popular-favorites" style="min-height: var(--touch-target-min);">Повторить</button>
                    </div>
                </div>
            `;
        }
    
        // Используем только популярные избранные цитаты недели - без fallback
        // Sort by likes (favorites/count/likes) descending to ensure correct top-3
        const quotes = (this.popularFavorites || [])
            .map(q => ({
                ...q,
                sortKey: q.favorites || q.count || q.likes || 0
            }))
            .sort((a, b) => b.sortKey - a.sortKey);
        
        if (quotes.length === 0) {
            return `
                <div id="popularWeekSection" class="popular-quotes-week-section">
                    ${header}
                    <div class="empty-state">
                        <div class="empty-icon">⭐</div>
                        <div class="empty-title">Пока нет популярных цитат</div>
                        <div class="empty-description">Станьте первым, кто добавит цитату в избранное!</div>
                    </div>
                </div>
            `;
        }
    
        // TOP 3 quotes with Spotlight-style design and working buttons
        const quotesCards = quotes.slice(0, 3).map((quote, _index) => {
            // ✅ FIX A/D: Apply like state from _likeStore first (unified data-attributes)
            const normalizedKey = this._computeLikeKey(quote.text || '', quote.author || '');
            const storeEntry = this._likeStore.get(normalizedKey);
            const isLiked = storeEntry ? storeEntry.liked : !!quote.likedByMe;
            const favorites = storeEntry ? storeEntry.count : (quote.favorites || quote.count || 0);
            
            // Получаем ВЛАДЕЛЬЦА (original uploader) - используем owner, не user
            const owner = quote.owner || quote.user;
            const userId = owner?.userId || owner?.id || owner?._id || '';
            const isFollowing = this.followStatusCache?.get(userId) || false;
            const userAvatarHtml = this.getUserAvatarHtml(owner, userId, isFollowing);
            const userName = owner?.name || 'Пользователь';
            
            return `
                <div class="quote-card popular-quote-card" data-quote-id="${quote.id || ''}">
                    <!-- Header с аватаром и именем пользователя -->
                    <div class="quote-card__header">
                        ${userAvatarHtml}
                        <div class="quote-card__user">
                            <span class="quote-card__user-name"
                                  data-user-id="${userId}" 
                                  data-is-following="${isFollowing}"
                                  style="cursor: pointer;">${this.escapeHtml(userName)}</span>
                        </div>
                    </div>
                    
                    <!-- Основной контент -->
                    <div class="quote-card__text">"${this.escapeHtml(quote.text || '')}"</div>
                    <div class="quote-card__author">— ${this.escapeHtml(quote.author || 'Неизвестный автор')}</div>
                    
                    <!-- Footer с компактными лайками -->
                    <div class="quote-card__footer">
                        <div class="quote-card__likes">
                            <button type="button" class="quote-card__heart-btn${isLiked ? ' favorited' : ''}" 
                                    data-quote-id="${quote.id || ''}"
                                    data-quote-text="${this.escapeHtml(quote.text || '')}"
                                    data-quote-author="${this.escapeHtml(quote.author || 'Неизвестный автор')}"
                                    data-favorites="${favorites}"
                                    data-normalized-key="${normalizedKey}"
                                    aria-label="Лайк">
                                <span class="like-icon">${isLiked ? '❤️' : '♡'}</span> <span class="like-count">${favorites}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    
        return `
            <div id="popularWeekSection" class="popular-quotes-week-section">
                ${header}
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
    
        return `
            <div class="stats-detail-section">
                <div class="stats-detail-title">📚 Интерес к разборам</div>
                ${leader ? `<div class="stats-detail-item">🔥 Лидер недели: "${leader.title}" — ${leader.author}</div>` : ''}
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
 * Временно отключено для продакшена — ничего не рендерит!
 */
renderAchievementsSection() {
    // Блок достижений сообщества временно скрыт. Вернуть — раскомментировать код ниже.
    return '';
    /*
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
    */
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
        this.attachFeedFilterListeners();
        this.attachExploreButton();
        this.attachCurrentlyStudyingListeners();
        this.attachCommunityCardListeners(); // ✅ НОВОЕ: Haptic feedback для карточек
        this.attachRetryButtons(); // ✅ НОВОЕ PR-3
        this.attachQuoteCardListeners(); // ✅ НОВОЕ: Обработчики для карточек цитат
        this.attachUserCardListeners(); // ✅ НОВОЕ: Обработчики для кликов по пользователям
        this.attachProfileModalDelegatedHandler(); // ✅ HOTFIX: Delegated handler for profile modal
        this.attachSpotlightRefreshButton(); // ✅ НОВОЕ: Кнопка обновления spotlight
        this.attachPopularWeekRefreshButton(); // ✅ НОВОЕ: Кнопка обновления популярных цитат недели (теперь обновляет и лидерборд)
        this.attachFeedLoadMoreListeners(); // ✅ НОВОЕ: Load More для ленты "Все"
        this.attachFollowingLoadMoreListeners(); // ✅ НОВОЕ: Load More для ленты "Подписки"
        this.attachCoversLoadMoreListeners(); // 📸 НОВОЕ: Load More для обложек
        this.attachCoverUploadFormListeners(); // ✅ НОВОЕ: Upload form для обложек
        this.attachPullToRefreshListeners(); // 🔄 НОВОЕ: Pull-to-refresh для всех табов
        // attachLeaderboardRefreshButton() удален - кнопка лидерборда больше не существует
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
                   
                        // ✅ НОВОЕ: Снимаем :active после клика
                        setTimeout(() => {
                            event.target.closest('.quote-card__heart-btn, .quote-card__fav-btn')?.blur();
                        }, 100);
                    });
                });

        // Обработчики для кнопок подписки
        const followButtons = document.querySelectorAll('.follow-btn');
        followButtons.forEach(button => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                const userId = button.dataset.userId;
                if (!userId) return;
                
                const isFollowing = button.classList.contains('following');
                
                let success;
                if (isFollowing) {
                    success = await this.unfollowUser(userId);
                } else {
                    success = await this.followUser(userId);
                }
                
                if (success) {
                    // ✅ ИСПРАВЛЕНИЕ: Сначала меняем innerHTML
                    const willBeFollowing = !isFollowing;
                    
                    button.innerHTML = willBeFollowing ? `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    ` : `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <line x1="19" y1="8" x2="19" y2="14"/>
                            <line x1="16" y1="11" x2="22" y2="11"/>
                        </svg>
                    `;
                    
                    // ✅ ПОТОМ добавляем/удаляем класс (не toggle!)
                    if (willBeFollowing) {
                        button.classList.add('following');
                    } else {
                        button.classList.remove('following');
                    }
                    
                    // Принудительный reflow для применения стилей
                    void button.offsetWidth;
                    
                    button.setAttribute('aria-label', 
                        willBeFollowing ? 'Отписаться' : 'Подписаться');
                    
                    setTimeout(() => button.blur(), 100);
                }
            });
        });
    }   
    
    /**
     * 👥 ОБРАБОТЧИКИ ДЛЯ КЛИКОВ ПО ПОЛЬЗОВАТЕЛЯМ (НОВОЕ)
     * Открывает ProfileModal при клике на карточку пользователя
     */
    attachUserCardListeners() {
        const userCards = document.querySelectorAll('.user-card-clickable');
        userCards.forEach(card => {
            card.addEventListener('click', (event) => {
                // Don't open modal if clicking on follow button
                if (event.target.closest('.follow-btn')) {
                    return;
                }
                
                const userId = card.dataset.userId;
                if (!userId) {
                    console.warn('⚠️ User card clicked but no user ID found');
                    return;
                }
                
                // Open profile modal
                console.log('👤 Opening profile modal for user:', userId);
                if (this.profileModal) {
                    this.profileModal.open(userId);
                }
                
                // Haptic feedback
                if (this.telegram?.hapticFeedback) {
                    this.telegram.hapticFeedback('light');
                }
            });
        });
        
        console.log(`✅ Attached ${userCards.length} user card listeners`);
    }
    
    /**
     * 🔍 Get follow status from element (data attribute or class)
     * @param {HTMLElement} element - Element to extract follow status from
     * @returns {boolean} Follow status
     */
    getFollowStatusFromElement(element) {
        if (!element) return false;
        const isFollowingFromData = element.dataset.isFollowing === 'true';
        const isFollowingFromClass = element.classList.contains('following');
        return isFollowingFromData || isFollowingFromClass;
    }
    
    /**
     * 🎯 DELEGATED PROFILE MODAL HANDLER (HOTFIX)
     * Handles clicks on avatars and names with data-user-id to open ProfileModal
     * Works across Community and Following feeds
     */
    attachProfileModalDelegatedHandler() {
        const pageContent = document.getElementById('page-content');
        if (!pageContent) {
            console.warn('⚠️ #page-content not found for delegated handler');
            return;
        }
        
        // Define handler function
        const handler = (event) => {
            // === COVERS ACTIONS ===
            const target = event.target;
            
            // Handle open image
            if (target.dataset.action === 'open-image') {
                event.preventDefault();
                const imageUrl = target.dataset.imageUrl;
                const caption = target.dataset.caption || '';
                if (this.imageViewer && imageUrl) {
                    this.imageViewer.open(imageUrl, caption);
                    this.triggerHapticFeedback('light');
                }
                return;
            }
            
            // Handle delete cover
            if (target.dataset.action === 'delete-cover') {
                event.preventDefault();
                const postId = target.dataset.postId;
                this.handleDeleteCover(postId);
                this.triggerHapticFeedback('medium');
                return;
            }
            
            // Handle show comments
            if (target.dataset.action === 'show-comments') {
                event.preventDefault();
                const postId = target.dataset.postId;
                this.handleShowComments(postId);
                this.triggerHapticFeedback('light');
                return;
            }
            
            // Handle like cover post
            if (target.dataset.action === 'like-cover' || target.closest('[data-action="like-cover"]')) {
                event.preventDefault();
                const likeBtn = target.dataset.action === 'like-cover' ? target : target.closest('[data-action="like-cover"]');
                const postId = likeBtn.dataset.postId;
                this.handleLikeCover(postId, likeBtn);
                this.triggerHapticFeedback('light');
                return;
            }
            
            // Handle add comment
            if (target.dataset.action === 'add-comment') {
                event.preventDefault();
                const postId = target.dataset.postId;
                this.handleAddComment(postId);
                this.triggerHapticFeedback('light');
                return;
            }
            
            // Handle load more covers
            if (target.classList.contains('js-covers-load-more')) {
                event.preventDefault();
                this.loadMoreCovers();
                return;
            }
            
            // === PROFILE MODAL (EXISTING) ===
            // Check if clicked element or its parent has data-user-id
            const clickedElement = event.target.closest('[data-user-id]');
            
            if (!clickedElement) return;
            
            // Don't open modal if clicking on buttons (follow buttons, action buttons, etc.)
            if (event.target.closest('button') || event.target.closest('.follow-btn')) {
                return;
            }
            
            // Don't open modal if clicking on interactive elements that aren't user cards
            if (event.target.closest('.quote-actions') || event.target.closest('[data-action]')) {
                return;
            }
            
            const userId = clickedElement.dataset.userId;
            const isFollowing = this.getFollowStatusFromElement(clickedElement);
            
            if (!userId) {
                console.warn('⚠️ Element clicked with data-user-id but no userId value');
                return;
            }
            
            // Open profile modal with preset follow status
            console.log('👤 Opening profile modal for user:', userId, 'isFollowing:', isFollowing);
            if (this.profileModal) {
                this.profileModal.open(userId, isFollowing);
            }
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
        };
        
        // Store bound handler reference for cleanup
        this._delegatedHandlerBound = handler;
        
        // Use delegated event listener for better performance and dynamic content
        pageContent.addEventListener('click', handler);
        
        console.log('✅ Attached delegated profile modal handler on #page-content');
    }
    
    /**
     * 🔄 REFRESH FOLLOW STATUS (для синхронизации после изменения в ProfileModal)
     * @param {string} userId - ID пользователя
     * @param {boolean} isFollowing - Новый статус подписки
     */
    refreshFollowStatus(userId, isFollowing) {
        console.log(`[FOLLOW_SYNC] CommunityPage.refreshFollowStatus: userId=${userId}, isFollowing=${isFollowing}`);
        
        // Update cache
        this.followStatusCache.set(userId, isFollowing);
        this._saveFollowStatusToStorage();
        
        // Update all follow buttons for this user
        const followButtons = document.querySelectorAll(`.follow-btn[data-user-id="${userId}"]`);
        console.log(`[FOLLOW_SYNC] CommunityPage.refreshFollowStatus: Found ${followButtons.length} follow buttons to update`);
        
        followButtons.forEach(button => {
            if (isFollowing) {
                button.classList.add('following');
                button.setAttribute('aria-label', 'Отписаться');
                button.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
            } else {
                button.classList.remove('following');
                button.setAttribute('aria-label', 'Подписаться');
                button.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <line x1="19" y1="8" x2="19" y2="14"/>
                        <line x1="16" y1="11" x2="22" y2="11"/>
                    </svg>
                `;
            }
        });
        
        console.log(`[FOLLOW_SYNC] CommunityPage.refreshFollowStatus: Updated ${followButtons.length} buttons for userId=${userId}`);
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

    attachFeedFilterListeners() {
        const filterBtns = document.querySelectorAll('.feed-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.switchFeedFilter(filter);
            });
        });
    }
    
    attachExploreButton() {
        const exploreBtn = document.getElementById('exploreBtn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                // Defensive code: ensure link is valid, fallback to /catalog if slug missing
                let link = '/catalog'; // Default fallback
                if (this.communityTrend?.link) {
                    link = this.communityTrend.link;
                } else if (this.communityTrend?.category?.slug) {
                    // Build link from category slug if available
                    link = `/catalog?category=${this.communityTrend.category.slug}`;
                }
                this.app.router.navigate(link);
            });
        }
    }

    /**
     * 🔄 ОБРАБОТЧИК КНОПКИ ОБНОВЛЕНИЯ SPOTLIGHT
     * Uses delegated event handling to survive DOM replacement
     */
    /**
     * 🔄 OBРАБОТЧИК КНОПКИ ОБНОВЛЕНИЯ SPOTLIGHT (DEPRECATED)
     * Replaced with pull-to-refresh functionality
     */
    attachSpotlightRefreshButton() {
        // No-op: кнопка обновления удалена, теперь используется pull-to-refresh
    }

    /**
     * 🔄 ОБРАБОТЧИК КНОПКИ ОБНОВЛЕНИЯ ПОПУЛЯРНЫХ ЦИТАТ НЕДЕЛИ И ЛИДЕРБОРДА (DEPRECATED)
     * Replaced with pull-to-refresh functionality
     */
    attachPopularWeekRefreshButton() {
        // No-op: кнопка обновления удалена, теперь используется pull-to-refresh
    }

    /**
     * 🔄 ОБРАБОТЧИК КНОПКИ ОБНОВЛЕНИЯ ЛИДЕРБОРДА (DEPRECATED - NO-OP)
     * Кнопка обновления лидерборда удалена. Теперь обновление происходит через pull-to-refresh.
     */
    attachLeaderboardRefreshButton() {
        // No-op: кнопка лидерборда больше не существует
        // Обновление лидерборда теперь происходит через pull-to-refresh
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
    
        // Создаём новый обработчик
        this._quoteChangeHandler = (event) => {
            console.log('👥 CommunityPage: Получено событие quotes:changed:', event.detail);
            const d = event?.detail || {};
    
            // ЛАЙК: точечная синхронизация и ВЫХОД без общего rerender
            if (d.origin === 'favoriteToggle' && typeof d.normalizedKey === 'string') {
                try {
                    this._updateAllLikeButtonsForKey(d.normalizedKey);
                    this._syncCollectionsForKey(d.normalizedKey, (item, entry) => {
                        item.likedByMe = entry.liked;
                        item.favorites = entry.count;
                    });
                } catch (e) {
                    console.warn('CommunityPage: favoriteToggle sync failed', e);
                }
                return; // НЕ инвалидируем spotlight, НЕ вызываем _scheduleRerender()
            }
    
            // Общий rerender — только при изменении состава цитат
            const type = d.type;
            const shouldRerender =
                type === 'added' || type === 'deleted' || type === 'removed' || type === 'created';
    
            if (!shouldRerender) {
                // edited без смены состава — точечная синхронизация (если пришёл quote)
                if (d.quote && d.quote.text) {
                    const key = this._computeLikeKey(d.quote.text, d.quote.author);
                    this._syncCollectionsForKey(key, (item) => Object.assign(item, d.quote));
                    this._updateAllLikeButtonsForKey(key);
                }
                return;
            }
    
            // Проверяем, активна ли страница Сообщества
            const isActive = this.app?.router?.currentRoute === '/community' ||
                document.querySelector('.nav-item.active')?.dataset.route === 'community' ||
                document.querySelector('.nav-item.active')?.dataset.page === 'community';
    
            if (!isActive) {
                console.log('👥 CommunityPage: Страница неактивна, пропускаем rerender');
                return;
            }
    
            // Инвалидация spotlight и единичный rerender
            this._spotlightCache.ts = 0;
            this._spotlightCache.items = [];
            this.loadTopAnalyses().then(() => this._scheduleRerender());
        };
    
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
                        const r = await this.api.getLeaderboard({ scope: 'week', limit: 10 }); 
                        if (r?.success) { 
                            this.leaderboard = r.data || []; 
                            this.userProgress = r.me || null; 
                            this.loaded.leaderboard = true; 
                        } 
                    } 
                }),
                this._safe(async () => { 
                    if (!this.loaded.popularQuotes) { 
                        let r = await this.api.getCommunityPopularFavorites({ scope: 'week', limit: 10 }).catch(() => null); 
                        if (!(r && r.success)) r = await this.api.getCommunityPopularQuotes({ scope: 'week', limit: 10 }).catch(() => null); 
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
                this._safe(async () => { if (!this.loaded.stats) { const r = await this.api.getCommunityStats({ scope: 'week' }); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; this.loaded.stats = true; } } }),
                this._safe(async () => { if (!this.loaded.insights && this.api.getCommunityInsights) { const r = await this.api.getCommunityInsights({ scope: 'week' }); if (r?.success) { this.communityInsights = r.insights; this.loaded.insights = true; } } }),
                this._safe(async () => { if (!this.loaded.funFact && this.api.getCommunityFunFact) { const r = await this.api.getCommunityFunFact({ scope: 'week' }); if (r?.success) { this.funFact = r.data; this.loaded.funFact = true; } } })
            ]).then(() => this.rerender());
        }
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ОБНОВЛЕН ДЛЯ PR-3!
     */
    // onShow больше НЕ делает первоначальных загрузок/лоадеров — только фоновые обновления при необходимости
    async onShow() {
        console.log('👥 CommunityPage: onShow - реализация SWR для фоновых обновлений');
        
        // ✅ КРИТИЧНО: Синхронизируем likeStore с UI при каждом показе страницы
        this._reconcileAllLikeData();
        this._likeStore.forEach((_, key) => this._updateAllLikeButtonsForKey(key));
        
        // ✅ FLICKER MITIGATION: Отложенный вызов warmupInitialStats на 2 секунды
        // Это не меняет API behavior, а только откладывает non-like-related updates
        // чтобы избежать UI flipping при первой отрисовке
        if (this.statisticsService && typeof this.statisticsService.warmupInitialStats === 'function') {
            setTimeout(async () => {
                try {
                    await this.statisticsService.warmupInitialStats();
                    console.log('✅ CommunityPage: warmupInitialStats completed (deferred)');
                } catch (error) {
                    console.warn('⚠️ CommunityPage: warmupInitialStats failed:', error);
                }
            }, WARMUP_STATS_DELAY_MS);
        }
        
        // SWR: можно тихо перезагрузить что-то в фоне (не меняя UI) по таймауту/критерию устаревания
        // Например, раз в 10 минут:
        const last = this.state.get('community.lastUpdate') || 0;
        if (Date.now() - last > 10 * 60 * 1000) {
            this.state.set('community.lastUpdate', Date.now());
            console.log('🔄 CommunityPage: Данные устарели - запускаем фоновое обновление');
            // В фоне обновляем ключевые секции, но НЕ трогаем разметку до завершения, затем один общий rerender
            Promise.allSettled([
                this._safe(async () => { const r = await this.api.getCommunityStats({ scope: 'week' }); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; } }),
                this._safe(async () => { const r = await this.api.getCommunityTrend(); if (r?.success) { this.communityTrend = r.data; } }),
                this._safe(async () => { const r = await this.api.getCommunityInsights?.({ scope: 'week' }); if (r?.success) { this.communityInsights = r.insights; } })
            ]).then(() => {
                console.log('✅ CommunityPage: Фоновое обновление завершено');
                this.rerender();
            });
        } else {
            console.log('✅ CommunityPage: Данные актуальны, фоновое обновление не требуется');
        }
    }

    /**
     * 🔄 ЗАГРУЗКА ВСЕХ СЕКЦИЙ (ОБНОВЛЕНА - БЕЗ PERIOD АРГУМЕНТОВ)
     */
    async loadAllSections() {
        console.log('🔄 CommunityPage: Загружаем все секции...');
        
        // Загружаем параллельно для лучшей производительности
        const loadPromises = [
            this.loadLatestQuotes(3), // Только 3 цитаты согласно требованиям
            this.loadPopularFavorites(10), // Популярные избранные цитаты для топа недели
            this.loadPopularBooks(10), // Популярные разборы недели для "Топ недели"
            this.loadRecentClicks(3), // Последние 3 клика для "Сейчас изучают"
            this.loadCommunityMessage(), // Сообщение от Анны
            this.loadCommunityTrend(), // Тренд недели
            this.loadLeaderboard(10), // Лидерборд за неделю
            this.loadCommunityInsights(), // Инсайты сообщества
            this.loadFunFact() // Интересный факт недели
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
     * 🔄 МЕТОДЫ ПОВТОРА ЗАГРУЗКИ ДЛЯ ОБРАБОТКИ ОШИБОК (ОБНОВЛЕНО - БЕЗ PERIOD)
     */
    retryLoadLatestQuotes() {
        this.triggerHapticFeedback('medium');
        this.loadLatestQuotes(5).then(() => this.rerender());
    }

    retryLoadPopularQuotes() {
        this.triggerHapticFeedback('medium');
        this.loadPopularQuotes(10).then(() => this.rerender());
    }

    retryLoadPopularFavorites() {
        this.triggerHapticFeedback('medium');
        this.loadPopularFavorites(10).then(() => this.rerender());
    }

    retryLoadPopularBooks() {
        this.triggerHapticFeedback('medium');
        this.loadPopularBooks(10).then(() => this.rerender());
    }

    retryLoadLeaderboard() {
        this.triggerHapticFeedback('medium');
        this.loadLeaderboard(10).then(() => this.rerender());
    }

    retryLoadRecentClicks() {
        this.triggerHapticFeedback('medium');
        this.loadRecentClicks(5).then(() => this.rerender());
    }

    /**
     * ➕ Add quote to diary from community feed
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
     * ❤️ TOGGLE LIKE/UNLIKE (БЕЗ СОЗДАНИЯ ЦИТАТ В ДНЕВНИКЕ)
     * REFACTORED: Uses centralized likeStore for single source of truth
     */
    async addQuoteToFavorites(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.target.closest('.quote-card__heart-btn, .quote-card__fav-btn');
        if (!button) return;
        
        const quoteCard = button.closest('.quote-card');
        if (!quoteCard) return;
        
        // Получаем данные цитаты из data-атрибутов или из DOM
        const quoteText = button.dataset.quoteText || quoteCard.querySelector('.quote-card__text')?.textContent?.replace(/"/g, '') || '';
        const quoteAuthor = button.dataset.quoteAuthor || quoteCard.querySelector('.quote-card__author')?.textContent?.replace('— ', '') || '';
        
        // Создаем нормализованный ключ
        const key = this._computeLikeKey(quoteText, quoteAuthor);
        
        // Get or initialize store entry
        let storeEntry = this._likeStore.get(key);
        if (!storeEntry) {
            // Initialize from button state
            const currentCount = parseInt(button.dataset.favorites, 10) || 0;
            const currentLiked = button.classList.contains('favorited');
            storeEntry = {
                liked: currentLiked,
                count: currentCount,
                pending: 0,
                lastServerCount: currentCount
            };
            this._likeStore.set(key, storeEntry);
        }
        
        // Check if action is already pending or locked
        if (storeEntry.pending > 0 || this._favoriteLocks.has(key)) {
            console.log('🔒 Action already pending for:', key);
            return;
        }
        
        // Set lock and pending flag
        this._favoriteLocks.add(key);
        storeEntry.pending = 1;
        
        // Determine action (toggle)
        const willLike = !storeEntry.liked;
        const oldLiked = storeEntry.liked;
        const oldCount = storeEntry.count;
        
        try {
            // Haptic feedback
            this.triggerHapticFeedback('medium');
            
            // Optimistically update store
            storeEntry.liked = willLike;
            storeEntry.count = willLike ? oldCount + 1 : Math.max(0, oldCount - 1);
            
            // 💾 Persist optimistic state immediately
            this._persistLikeStore();
            
            // Update ALL buttons instantly across all sections
            this._updateAllLikeButtonsForKey(key);
            
            // Sync all collections (spotlight cache, popularFavorites, popularQuotes, latestQuotes)
            this._syncCollectionsForKey(key, (item, entry) => {
                item.likedByMe = entry.liked;
                item.favorites = entry.count;
            });
            
            // Call API
            let response;
            if (willLike) {
                response = await this.api.likeQuote({
                    text: quoteText,
                    author: quoteAuthor
                });
            } else {
                response = await this.api.unlikeQuote({
                    text: quoteText,
                    author: quoteAuthor
                });
            }
            
            if (response && response.success) {
                // Success feedback
                this.triggerHapticFeedback(willLike ? 'success' : 'light');
                this.showNotification(
                    willLike ? 'Вы поставили лайк цитате!' : 'Лайк снят.',
                    willLike ? 'success' : 'info'
                );

                // Merge favorite into appState
                try {
                  const favorite = response.favorite || response.result?.favorite || null;
                  if (favorite && window.appState) {
                    if (typeof window.appState.updateQuoteById === 'function') {
                      window.appState.updateQuoteById(favorite);
                    } else if (typeof window.appState.set === 'function') {
                      const cur = window.appState.get('quotes.items') || [];
                      const merged = [favorite, ...cur.filter(q =>
                        ((q.id||q._id||q.text) !== (favorite.id||favorite._id||favorite.text))
                      )];
                      window.appState.set('quotes.items', merged);
                    }
                    // уведомление подписчиков — МЕТИМ как toggle лайка и передаём normalizedKey
                    if (typeof document !== 'undefined') {
                      const nk = this._computeLikeKey(
                        favorite.text || quoteText,
                        favorite.author || quoteAuthor
                      );
                      document.dispatchEvent(new CustomEvent('quotes:changed', {
                        detail: {
                          type: 'edited',
                          origin: 'favoriteToggle',   // ВАЖНО: лайковый toggle
                          normalizedKey: nk,          // ключ для точечного обновления
                          quote: favorite
                        }
                      }));
                    }
                  }
                } catch (mergeErr) {
                  console.warn('CommunityPage: failed to merge favorite into appState', mergeErr);
                }
                
                // Reconcile with server count if available
                const serverCount = response.counts?.totalFavoritesForPair;
                if (typeof serverCount === 'number') {
                    storeEntry.count = serverCount;
                    storeEntry.lastServerCount = serverCount;
                    
                    // 💾 Persist reconciled state
                    this._persistLikeStore();
                    
                    // Update all buttons with server count
                    this._updateAllLikeButtonsForKey(key);
                    
                    // Sync collections with server count
                    this._syncCollectionsForKey(key, (item, entry) => {
                        item.favorites = entry.count;
                    });
                }

                // Apply like state to following feed if active
                if (this.feedFilter === 'following') {
                    this._applyLikeStateToArray(this.followingFeed);
                    this._updateAllLikeButtonsForKey(key);
                }
                
                // Update legacy likeState for backward compatibility
                this._likeState.set(key, storeEntry.liked);
                
            } else {
                throw new Error(response?.message || (willLike ? 'Ошибка добавления лайка' : 'Ошибка снятия лайка'));
            }
            
        } catch (error) {
            console.error('❌ Ошибка toggle лайка:', error);
            
            // Rollback optimistic update
            storeEntry.liked = oldLiked;
            storeEntry.count = oldCount;
            
            // Update all buttons to rolled-back state
            this._updateAllLikeButtonsForKey(key);
            
            // Sync collections with rolled-back state
            this._syncCollectionsForKey(key, (item, entry) => {
                item.likedByMe = entry.liked;
                item.favorites = entry.count;
            });
            
            // Show error
            const errorMsg = willLike ? 'Ошибка при добавлении лайка' : 'Ошибка при снятии лайка';
            this.showNotification(errorMsg, 'error');
            this.triggerHapticFeedback('error');
            
        } finally {
            // Release lock and pending flag
            storeEntry.pending = 0;
            
            // 💾 Persist final state
            this._persistLikeStore();
            
            setTimeout(() => {
                this._favoriteLocks.delete(key);
            }, 500);
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
     * 🔗 Attach Load More button listeners for feed
     */
    attachFeedLoadMoreListeners() {
        const loadMoreBtn = document.querySelector('.js-feed-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.onClickLoadMore());
        }
    }
    
    /**
     * 🔗 Attach Load More button listeners for following feed
     */
    attachFollowingLoadMoreListeners() {
        const loadMoreBtn = document.querySelector('.js-following-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.onClickFollowingLoadMore());
        }
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
     * ⏱️ Формат относительного времени (для обложек)
     * @param {Date|number|string} dateInput
     * @returns {string}
     */
    formatRelativeTime(dateInput) {
        try {
            const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
            const now = new Date();
            const diffMs = now - d;
            const mins = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (mins < 60) return `${mins} мин назад`;
            if (hours < 24) return `${hours} ч назад`;
            if (days === 1) return 'вчера';
            if (days < 7) return `${days} дн назад`;

            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        } catch {
            return this.formatDate?.(dateInput) || '';
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
        
        // ✅ Unsubscribe from follow:changed event
        if (this._followChangedHandler) {
            window.removeEventListener('follow:changed', this._followChangedHandler);
            this._followChangedHandler = null;
        }
        
        // ✅ Unsubscribe from legacy bridge
        if (this._followStateChangedBridge) {
            window.removeEventListener('followStateChanged', this._followStateChangedBridge);
            this._followStateChangedBridge = null;
        }
        
        // 🔄 Detach pull-to-refresh listeners
        this.detachPullToRefreshListeners();
    }

    /**
     * 🔄 BATCHED RERENDER - Schedules a rerender to happen in next rAF tick
     * Multiple calls in the same tick will be batched into one rerender
     */
    _scheduleRerender() {
        if (this._rerenderScheduled) {
            return; // Already scheduled
        }
        
        this._rerenderScheduled = true;
        requestAnimationFrame(() => {
            this._rerenderScheduled = false;
            this.rerender();
        });
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
        
        // 🔄 Detach pull-to-refresh listeners
        this.detachPullToRefreshListeners();
        
        // Remove delegated profile modal handler
        try {
            const pageContent = document.getElementById('page-content');
            if (pageContent && this._delegatedHandlerBound) {
                pageContent.removeEventListener('click', this._delegatedHandlerBound);
                console.log('🧹 Removed delegated profile modal handler');
            }
            this._delegatedHandlerBound = null;
        } catch (e) {
            console.warn('⚠️ CommunityPage destroy failed:', e);
        }
        
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
    
    /**
     * 📸 Load more covers (infinite scroll)
     */
    async loadMoreCovers() {
        if (!this.coversHasMore || this.loadingStates.covers) return;
        
        this.loadingStates.covers = true;
        this.triggerHapticFeedback('light');
        
        try {
            await this.loadCovers(true); // true = load more
            this.rerender();
        } catch (error) {
            console.error('❌ Error loading more covers:', error);
        } finally {
            this.loadingStates.covers = false;
        }
    }
    
    /**
     * 📸 Attach cover upload form event listeners
     */
    attachCoverUploadFormListeners() {
        // 🔧 FIX: Always attach listeners if form exists, don't check feedFilter
        // The form is only rendered when feedFilter === 'covers', so this is safe
        if (this.coverUploadForm) {
            this.coverUploadForm.attachEventListeners();
        }
    }
    
    /**
     * 📸 Attach Load More button listener for covers feed
     */
    attachCoversLoadMoreListeners() {
        const loadMoreBtn = document.querySelector('.js-covers-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreCovers());
        }
    }
    
    /**
     * 🔧 Force fresh reload of covers feed after mutation
     * Resets cursor and reloads with cache-bust timestamp
     * @private
     */
    async _reloadCoversAfterMutation() {
        this.coversCursor = null;
        await this.loadCovers(false);
        this.rerender();
        this.attachCoverUploadFormListeners();
    }
    
    /**
     * 📸 Handle successful photo upload
     * @param {Object} result - Upload result from API
     */
    async handleUploadSuccess(result) {
        console.log('📸 CommunityPage: Handling upload success...', result);
        
        // 🔧 Set mutation timestamp for cache-busting and persist
        this._lastMutationTs = Date.now();
        this._persistMutationTimestamp();
        
        // Show success message/toast if available
        if (window.app && window.app.showToast) {
            window.app.showToast('Фото успешно добавлено! 📸', 'success');
        }
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        
        // 🔧 OPTIMISTIC UPDATE: Prepend new post immediately if available
        if (result && result.data) {
            const newPost = result.data;
            
            // Initialize coversPosts if null
            if (!Array.isArray(this.coversPosts)) {
                this.coversPosts = [];
            }
            
            // Prepend new post to the beginning
            this.coversPosts = [newPost, ...this.coversPosts];
            
            // Rerender immediately to show new post (optimistic update)
            // Note: This is separate from _reloadCoversAfterMutation() which does the final server refresh
            this.rerender();
            
            // Rebind upload form listeners after rerender
            this.attachCoverUploadFormListeners();
        }
        
        // 🔧 Force fresh reload after mutation to ensure cross-account visibility
        await this._reloadCoversAfterMutation();
    }
    
    /**
     * 📸 Handle like/unlike cover post
     * @param {string} postId - Post ID
     * @param {HTMLElement} button - Like button element
     */
    async handleLikeCover(postId, button) {
        if (!postId || !button) return;
        
        // 🔒 Prevent double-clicking - check if button is disabled
        if (button.disabled) {
            console.log('⚠️ CommunityPage: Like action already in progress');
            return;
        }
        
        const wasLiked = button.dataset.liked === 'true';
        const likeCountSpan = button.querySelector('.like-count');
        const likeIconSpan = button.querySelector('.like-icon');
        
        // Disable button to prevent double clicks
        button.disabled = true;
        
        // Helper to update icon
        const updateIcon = (liked) => {
            if (likeIconSpan) {
                likeIconSpan.textContent = liked ? '❤️' : '♡';
            }
        };
        
        // Optimistic UI update
        button.dataset.liked = wasLiked ? 'false' : 'true';
        button.classList.toggle('liked', !wasLiked);
        updateIcon(!wasLiked);
        
        const currentCount = parseInt(likeCountSpan?.textContent || '0');
        const newCount = wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
        if (likeCountSpan) {
            likeCountSpan.textContent = newCount;
        }
        
        try {
            // Call API
            const response = await this.api.likeCoverPost(postId);
            
            if (response && response.success) {
                // Update with server response
                button.dataset.liked = response.liked ? 'true' : 'false';
                button.classList.toggle('liked', response.liked);
                updateIcon(response.liked);
                if (likeCountSpan) {
                    likeCountSpan.textContent = response.likesCount || 0;
                }
                
                // Update in local state
                if (Array.isArray(this.coversPosts)) {
                    const post = this.coversPosts.find(p => (p._id || p.id) === postId);
                    if (post) {
                        post.liked = response.liked;
                        post.likesCount = response.likesCount || 0;
                    }
                }
                
                // Show toast notification
                if (window.app && window.app.showToast) {
                    const message = response.liked ? 'Вы поставили лайк фотографии!' : 'Лайк снят.';
                    window.app.showToast(message, 'success');
                }
            }
        } catch (error) {
            console.error('❌ CommunityPage: Failed to like cover:', error);
            
            // Revert optimistic update
            button.dataset.liked = wasLiked ? 'true' : 'false';
            button.classList.toggle('liked', wasLiked);
            updateIcon(wasLiked);
            if (likeCountSpan) {
                likeCountSpan.textContent = currentCount;
            }
            
            if (window.app && window.app.showToast) {
                window.app.showToast('Ошибка сохранения лайка', 'error');
            }
        } finally {
            // Re-enable button
            button.disabled = false;
        }
    }
    
    /**
     * 🔒 Show Telegram confirm popup with debounce protection
     * @param {string} message - Confirmation message
     * @returns {Promise<boolean>} User's choice
     */
    async _confirm(message) {
        // Check if popup is already open
        if (this._confirmOpen) {
            console.log('⚠️ CommunityPage: Confirm popup already open');
            return false;
        }
        
        this._confirmOpen = true;
        
        return new Promise((resolve) => {
            // Subscribe to popup_closed event to reset flag
            const handlePopupClosed = () => {
                this._confirmOpen = false;
                if (window.Telegram?.WebApp) {
                    window.Telegram.WebApp.offEvent('popup_closed', handlePopupClosed);
                }
            };
            
            if (window.Telegram?.WebApp?.showConfirm) {
                if (window.Telegram.WebApp.onEvent) {
                    window.Telegram.WebApp.onEvent('popup_closed', handlePopupClosed);
                }
                window.Telegram.WebApp.showConfirm(message, (confirmed) => {
                    handlePopupClosed();
                    resolve(confirmed);
                });
            } else {
                // Fallback to blocking confirm if Telegram API not available
                const confirmed = confirm(message);
                handlePopupClosed();
                resolve(confirmed);
            }
        });
    }
    
    /**
     * 📸 Handle delete cover post
     * @param {string} postId - Post ID
     */
    async handleDeleteCover(postId) {
        if (!postId) return;
        
        // 🔒 HOTFIX: Prevent multiple concurrent delete prompts
        if (this._deletingCover) {
            console.log('⚠️ CommunityPage: Delete already in progress');
            return;
        }
        
        const confirmed = await this._confirm('Удалить это фото?');
        if (!confirmed) {
            // User cancelled - no side effects
            return;
        }
        
        this._deletingCover = true;
        
        // 🔧 Save original state for rollback
        const originalCoversPosts = this.coversPosts ? [...this.coversPosts] : [];
        
        try {
            console.log('📸 CommunityPage: Deleting cover post:', postId);
            
            // 🔧 OPTIMISTIC DELETE: Remove from local state immediately
            if (Array.isArray(this.coversPosts)) {
                this.coversPosts = this.coversPosts.filter(p => (p._id || p.id) !== postId);
            }
            
            // Remove from DOM immediately
            const card = document.querySelector(`[data-post-id="${postId}"]`);
            if (card) {
                card.remove();
            }
            
            // Call API to delete
            const response = await this.api.deleteCover(postId);
            
            if (response && response.success) {
                // 🔧 Set mutation timestamp for cache-busting and persist
                this._lastMutationTs = Date.now();
                this._persistMutationTimestamp();
                
                // Show success message
                if (window.app && window.app.showToast) {
                    window.app.showToast('Фото удалено', 'success');
                }
                
                // Haptic feedback
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
                
                // 🔧 Force fresh reload after mutation
                await this._reloadCoversAfterMutation();
            } else {
                throw new Error(response?.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('❌ CommunityPage: Failed to delete cover:', error);
            
            // 🔧 ROLLBACK: Restore original state
            this.coversPosts = originalCoversPosts;
            this.rerender();
            
            // Show error message
            if (window.app && window.app.showToast) {
                window.app.showToast('Ошибка удаления фото', 'error');
            }
        } finally {
            this._deletingCover = false;
        }
    }
    
    /**
     * 🔧 Ensure CoverCommentsModal is loaded and ready
     * Uses singleton pattern from app instance
     * Dynamically loads the script if not available
     * @returns {Promise<Object|null>} - Modal singleton instance or null on failure
     */

    /**
     * 📸 Handle show/hide comments for a post (now opens modal)
     * @param {string} postId - Post ID
     */
    async handleShowComments(postId) {
        // Напрямую получаем единственный экземпляр из App.js
        const commentsModal = this.app.getCoverCommentsModal();
        if (commentsModal) {
            const updateCommentCount = (count) => {
                const counter = document.querySelector(`.cover-card[data-post-id="${postId}"] .comment-count`);
                if (counter) counter.textContent = count;
            };
            commentsModal.open(postId, updateCommentCount);
        } else {
            console.error('CRITICAL: Comments Modal instance is not available from App.');
            if (this.app && this.app.telegram && this.app.telegram.showAlert) {
                this.app.telegram.showAlert('Ошибка: не удалось открыть комментарии.');
            }
        }
    }
    
    /**
     * 📸 Load comments for a post
     * @param {string} postId - Post ID
     */
    async loadComments(postId) {
        if (!postId) return;
        
        const commentsSection = document.getElementById(`comments-${postId}`);
        if (!commentsSection) return;
        
        try {
            // Show loading state
            commentsSection.innerHTML = '<div style="padding: 8px; color: var(--text-secondary); font-size: 13px;">Загрузка комментариев...</div>';
            
            // Fetch comments
            const response = await this.api.getCoverComments(postId);
            
            if (response && response.success) {
                const comments = response.data || [];
                
                // Render comments
                const commentsHtml = comments.map(comment => {
                    const user = comment.user || {};
                    const userName = user.name || 'Пользователь';
                    const commentText = comment.text || '';
                    const createdAt = comment.createdAt ? new Date(comment.createdAt) : new Date();
                    const dateStr = this.formatRelativeTime(createdAt);
                    
                    return `
                        <div class="cover-card__comment">
                            <div class="cover-card__comment-author">${this.escapeHtml(userName)}</div>
                            <div class="cover-card__comment-text">${this.escapeHtml(commentText)}</div>
                            <div class="cover-card__comment-date">${dateStr}</div>
                        </div>
                    `;
                }).join('');
                
                // Add input form
                const inputFormHtml = `
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <input 
                            type="text" 
                            id="comment-input-${postId}" 
                            placeholder="Добавить комментарий..." 
                            style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; background: var(--bg-card); color: var(--text-primary);"
                        />
                        <button 
                            data-action="add-comment" 
                            data-post-id="${postId}"
                            style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap;"
                        >
                            Отправить
                        </button>
                    </div>
                `;
                
                commentsSection.innerHTML = commentsHtml + inputFormHtml;
            } else {
                throw new Error(response?.error || 'Failed to load comments');
            }
        } catch (error) {
            console.error('❌ CommunityPage: Failed to load comments:', error);
            commentsSection.innerHTML = '<div style="padding: 8px; color: var(--error-color); font-size: 13px;">Ошибка загрузки комментариев</div>';
        }
    }
    
    /**
     * 📸 Handle add comment to a post
     * @param {string} postId - Post ID
     */
    async handleAddComment(postId) {
        if (!postId) return;
        
        const input = document.getElementById(`comment-input-${postId}`);
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        try {
            // Disable input while sending
            input.disabled = true;
            
            // Send comment
            const response = await this.api.addCoverComment(postId, text);
            
            if (response && response.success) {
                // Clear input
                input.value = '';
                
                // Reload comments to show the new one
                await this.loadComments(postId);
                
                // Update comment count in the post
                const post = this.coversPosts?.find(p => (p._id || p.id) === postId);
                if (post) {
                    post.commentsCount = (post.commentsCount || 0) + 1;
                    // Update the button text
                    const btn = document.querySelector(`[data-action="show-comments"][data-post-id="${postId}"]`);
                    if (btn) {
                        btn.textContent = `💬 ${post.commentsCount}`;
                    }
                }
                
                // Show success message
                if (window.app && window.app.showToast) {
                    window.app.showToast('Комментарий добавлен', 'success');
                }
            } else {
                throw new Error(response?.error || 'Failed to add comment');
            }
        } catch (error) {
            console.error('❌ CommunityPage: Failed to add comment:', error);
            
            // Show error message
            if (window.app && window.app.showToast) {
                window.app.showToast('Ошибка добавления комментария', 'error');
            }
        } finally {
            // Re-enable input
            if (input) {
                input.disabled = false;
            }
        }
    }

    // ========================================
    // 🔄 PULL-TO-REFRESH FUNCTIONALITY
    // ========================================

    /**
     * 🔄 Render PTR indicator element
     * @returns {string} HTML for PTR indicator
     */
    renderPtrIndicator() {
        return `
            <div id="ptrIndicator" class="ptr-indicator" style="display: none; opacity: 0;">
                <div class="loading-spinner"></div>
            </div>
        `;
    }

    /**
     * 🔄 Attach pull-to-refresh event listeners
     */
    attachPullToRefreshListeners() {
        if (this._ptrListenersAttached) {
            return; // Already attached
        }

        const container = document.querySelector('#page-content') || document.querySelector('.content') || window;
        
        // Touch event handlers
        const handleTouchStart = (e) => {
            const scrollTop = container === window ? window.pageYOffset : container.scrollTop;
            
            if (scrollTop <= 0 && !this._ptrRefreshing) {
                this._ptrStartY = e.touches[0].pageY;
                this._ptrActive = true;
            }
        };

        const handleTouchMove = (e) => {
            if (!this._ptrActive || this._ptrRefreshing) {
                return;
            }

            this._ptrCurrentY = e.touches[0].pageY;
            const pullDistance = this._ptrCurrentY - this._ptrStartY;

            if (pullDistance > 0) {
                // Show indicator when pulling down
                const indicator = document.getElementById('ptrIndicator');
                if (indicator && pullDistance > 10) {
                    indicator.style.display = 'flex';
                    indicator.style.opacity = Math.min(pullDistance / this._ptrThreshold, 1);
                }
            }
        };

        const handleTouchEnd = async (e) => {
            if (!this._ptrActive || this._ptrRefreshing) {
                return;
            }

            const pullDistance = this._ptrCurrentY - this._ptrStartY;
            this._ptrActive = false;

            if (pullDistance >= this._ptrThreshold) {
                // Trigger refresh
                await this._triggerPullToRefresh();
            } else {
                // Hide indicator
                this._hidePtrIndicator();
            }

            this._ptrStartY = 0;
            this._ptrCurrentY = 0;
        };

        // Store references for cleanup
        this._ptrHandlers = {
            touchStart: handleTouchStart,
            touchMove: handleTouchMove,
            touchEnd: handleTouchEnd
        };

        // Attach to document for better compatibility
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        this._ptrListenersAttached = true;
        console.log('✅ CommunityPage: Pull-to-refresh listeners attached');
    }

    /**
     * 🔄 Detach pull-to-refresh event listeners
     */
    detachPullToRefreshListeners() {
        if (!this._ptrListenersAttached || !this._ptrHandlers) {
            return;
        }

        document.removeEventListener('touchstart', this._ptrHandlers.touchStart);
        document.removeEventListener('touchmove', this._ptrHandlers.touchMove);
        document.removeEventListener('touchend', this._ptrHandlers.touchEnd);

        this._ptrListenersAttached = false;
        this._ptrHandlers = null;
        console.log('✅ CommunityPage: Pull-to-refresh listeners detached');
    }

    /**
     * 🔄 Show PTR indicator
     */
    _showPtrIndicator() {
        const indicator = document.getElementById('ptrIndicator');
        if (indicator) {
            indicator.style.display = 'flex';
            indicator.style.opacity = '1';
        }
    }

    /**
     * 🔄 Hide PTR indicator
     */
    _hidePtrIndicator() {
        const indicator = document.getElementById('ptrIndicator');
        if (indicator) {
            indicator.style.display = 'none';
            indicator.style.opacity = '0';
        }
    }

    /**
     * 🔄 Trigger pull-to-refresh
     */
    async _triggerPullToRefresh() {
        if (this._ptrRefreshing) {
            return;
        }

        this._ptrRefreshing = true;
        this._showPtrIndicator();
        this.triggerHapticFeedback('medium');

        try {
            await this._refreshCurrentView();
        } catch (error) {
            console.error('❌ CommunityPage: PTR refresh failed:', error);
        } finally {
            this._ptrRefreshing = false;
            this._hidePtrIndicator();
        }
    }

    /**
     * 🔄 Refresh current view based on active tab and filter
     */
    async _refreshCurrentView() {
        console.log(`🔄 CommunityPage: Refreshing ${this.activeTab} tab with filter ${this.feedFilter}`);

        if (this.activeTab === 'feed') {
            // Feed tab - dispatch based on filter
            if (this.feedFilter === 'all') {
                // 🔧 FIX: Read initialCount from feeds.community.feed config for refresh
                const config = window.ConfigManager?.get('feeds.community.feed') || { initialCount: 12 };
                const targetCount = config.initialCount || 12;
                
                // Force rebuild spotlight mix with proper parameters
                this._spotlightCache = { ts: 0, items: [] };
                await this.buildSpotlightMix(targetCount, true); // Use feed config initialCount, forceReload=true
                
                // Optionally refresh background data
                await Promise.allSettled([
                    this._safe(async () => {
                        const r = await this.api.getCatalogRecentClicks({ limit: 3 });
                        if (r?.success) {
                            this.recentClicks = r.clicks || r.data || [];
                            this.loaded.recentClicks = true;
                        }
                    }),
                    this._safe(async () => {
                        const r = await this.api.getCommunityMessage();
                        if (r?.success) {
                            this.communityMessage = r.data;
                            this.loaded.message = true;
                        }
                    }),
                    this._safe(async () => {
                        const r = await this.api.getCommunityTrend();
                        if (r?.success) {
                            this.communityTrend = r.data;
                            this.loaded.trend = true;
                        }
                    })
                ]);
                
                this._scheduleRerender();
            } else if (this.feedFilter === 'following') {
                // Refresh following feed
                await this.loadFollowingFeed();
                this._scheduleRerender();
            } else if (this.feedFilter === 'covers') {
                // Refresh covers - reset cursor and reload
                this.coversCursor = null;
                await this.loadCovers(false);
                this._scheduleRerender();
            }
        } else if (this.activeTab === 'top') {
            // Top Week tab - refresh popular favorites and leaderboard
            await Promise.all([
                this.loadPopularFavorites(10, { noCache: true }),
                this.loadLeaderboard(10, { noCache: true })
            ]);
            this._scheduleRerender();
        } else if (this.activeTab === 'stats') {
            // Stats tab - refresh stats, insights, and fun fact
            await Promise.allSettled([
                this._safe(async () => {
                    const r = await this.api.getCommunityStats({ scope: 'week' });
                    if (r?.success) {
                        this.communityData = { ...this.communityData, ...r.data };
                        this.loaded.stats = true;
                    }
                }),
                this._safe(async () => {
                    const r = await this.api.getCommunityInsights({ scope: 'week' });
                    if (r?.success) {
                        this.communityInsights = r.data;
                        this.loaded.insights = true;
                    }
                }),
                this._safe(async () => {
                    const r = await this.api.getCommunityFunFact({ scope: 'week' });
                    if (r?.success) {
                        this.funFact = r.data;
                        this.loaded.funFact = true;
                    }
                })
            ]);
            this._scheduleRerender();
        }

        console.log('✅ CommunityPage: Refresh complete');
    }
}



// 📤 Экспорт класса
window.CommunityPage = CommunityPage;
