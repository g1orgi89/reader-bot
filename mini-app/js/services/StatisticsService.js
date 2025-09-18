/**
 * 📊 StatisticsService (Iteration 1)
 * Centralized, cached access to user stats & related data.
 */
class StatisticsService {
    constructor({ api, state }) {
        this.api = api;
        this.state = state;
        this.cache = new Map();
        this.inFlight = new Map();
        this.TTL_SHORT = 15000; // 15s
        this.TTL_DEFAULT = 30000; // 30s
        
        // Add event listeners for quote changes (with guard against duplicate binding)
        if (typeof document !== 'undefined' && !window.__statsQuoteEventsBound) {
            document.addEventListener('quotes:changed', (e) => {
                const detail = e.detail || {};
                if (detail.type === 'added') this.onQuoteAdded(detail);
                if (detail.type === 'deleted') this.onQuoteDeleted(detail);
                if (detail.type === 'edited') this.onQuoteEdited?.(detail);
            });
            window.__statsQuoteEventsBound = true;
        }
    }

    async getMainStats() {
        return this._cached(`mainStats:${this._requireUserId()}`, async () => {
            const userId = this._requireUserId();
            const resp = await this.api.getStats(userId);
            const raw = resp?.stats || resp || {};
            return {
                totalQuotes: raw.totalQuotes || 0,
                currentStreak: raw.currentStreak || 0,
                daysInApp: raw.daysSinceRegistration || raw.daysInApp || 0
            };
        }, this.TTL_SHORT);
    }

    async getLatestQuotes(limit = 3) {
        return this._cached(`latestQuotes_${limit}:${this._requireUserId()}`, async () => {
            const userId = this._requireUserId();
            const resp = await this.api.getRecentQuotes(limit, userId);
            const arr = resp?.quotes || resp?.data?.quotes || resp?.data || resp || [];
            if (!Array.isArray(arr)) return [];
            return arr.map(q => ({
                id: q.id || q._id,
                _id: q._id,
                text: q.text || '',
                author: q.author || '',
                createdAt: q.createdAt || q.dateAdded
            }));
        }, this.TTL_SHORT);
    }

    async getTopAnalyses(limit = 3) {
      return this._cached(`topAnalyses_${limit}`, async () => {
        try {
          const resp = await this.api.getTopBooks({ period: '7d' });
          const items = resp?.data || resp || [];
          return items.slice(0, limit).map((b, i) => ({
            id: b.id || b._id || String(i),
            title: b.title || 'Разбор',
            author: b.author || '',
            clicks: b.clicksCount || b.salesCount || 0
          }));
        } catch {
          return [];
        }
      }, this.TTL_DEFAULT);
    }

    async getUserProgress() {
        return this._cached(`userProgress:${this._requireUserId()}`, async () => {
            const userId = this._requireUserId();
            let quotes = [];
            try {
                const resp = await this.api.getQuotes({ limit: 200 }, userId);
                quotes = resp?.quotes || resp?.data?.quotes || resp?.items || [];
            } catch {
                quotes = this.state?.get('quotes.items') || [];
            }
            const now = Date.now();
            const weekAgo = now - 7 * 86400_000;
            const thirtyAgo = now - 30 * 86400_000;
            let weekly = 0;
            const authorFreq = new Map();
            for (const q of quotes) {
                const ts = new Date(q.createdAt || q.dateAdded).getTime();
                if (!ts) continue;
                if (ts >= weekAgo) weekly++;
                if (ts >= thirtyAgo && q.author) {
                    authorFreq.set(q.author, (authorFreq.get(q.author) || 0) + 1);
                }
            }
            const favoriteAuthor = this._top(authorFreq);
            let activityLevel = 'low';
            if (weekly >= 15) activityLevel = 'high';
            else if (weekly >= 5) activityLevel = 'medium';
            const main = await this.getMainStats();
            let streak = main.currentStreak || 0;
            const computedStreak = this._computeStreak(quotes);
            if (computedStreak > streak) streak = computedStreak;
            
            // Enhanced streak calculation with yesterday fallback
            const { streakToYesterday, isAwaitingToday } = this._computeStreakToYesterday(quotes, computedStreak);
            
            return {
                weeklyQuotes: weekly,
                favoriteAuthor,
                activityLevel,
                currentStreak: streak,
                computedStreak,
                backendStreak: main.currentStreak,
                streakToYesterday,
                isAwaitingToday
            };
        }, 25_000);
    }

    _computeStreak(quotes) {
        const dayKey = d => {
            const dt = (d instanceof Date) ? d : new Date(d);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const daysSet = new Set();
        for (const q of quotes) {
            const ts = q.createdAt || q.dateAdded;
            if (!ts) continue;
            daysSet.add(dayKey(ts));
        }
        let streak = 0;
        const cursor = new Date();
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const key = dayKey(cursor);
            if (daysSet.has(key)) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }

    /**
     * Получить комплексную статистику для дневника (блоки "добавить" и "мои цитаты")
     */
    async getDiaryStats() {
        const userId = this._requireUserId();
        const [main, progress, detailed, activityPercent] = await Promise.all([
            this.getMainStats(),
            this.getUserProgress(),
            this.getDetailedQuoteStats(),
            this.getActivityPercent() // Always fetch fresh from API
        ]);
        return {
            totalQuotes: main.totalQuotes ?? 0,
            weeklyQuotes: progress.weeklyQuotes ?? 0,
            monthlyQuotes: detailed.monthlyQuotes ?? 0,
            favoritesCount: detailed.favoritesCount ?? 0,
            favoriteAuthor: progress.favoriteAuthor ?? '—',
            activityPercent: activityPercent ?? 1
        };
    }

    /**
     * Получить детальную статистику по цитатам (включая избранные и месячные)
     */
    async getDetailedQuoteStats() {
        return this._cached(`detailedStats:${this._requireUserId()}`, async () => {
            const userId = this._requireUserId();
            let quotes = [];
            try {
                const resp = await this.api.getQuotes({ limit: 500 }, userId);
                quotes = resp?.quotes || resp?.data?.quotes || resp?.items || [];
            } catch {
                quotes = this.state?.get('quotes.items') || [];
            }
            
            const now = Date.now();
            const thirtyDaysAgo = now - 30 * 86400_000;
            let monthlyQuotes = 0;
            let favoritesCount = 0;
            
            for (const q of quotes) {
                const ts = new Date(q.createdAt || q.dateAdded).getTime();
                if (ts >= thirtyDaysAgo) {
                    monthlyQuotes++;
                }
                if (q.isFavorite || q.favorite) {
                    favoritesCount++;
                }
            }
            
            return {
                monthlyQuotes,
                favoritesCount,
                totalQuotes: quotes.length
            };
        }, this.TTL_SHORT);
    }

    /**
     * Получить процент активности пользователя в сообществе
     */
    async getActivityPercent() {
        return this._cached(`activityPercent:${this._requireUserId()}`, async () => {
            try {
                const result = await this.api.getActivityPercent();
                return result ?? 1;
            } catch (e) {
                console.warn('Failed to get activity percent:', e);
                return 1;
            }
        }, this.TTL_DEFAULT);
    }
    
    // -------- streak enhancement helpers --------
    _computeStreakToYesterday(quotes, computedStreak) {
        if (computedStreak > 0) {
            return { streakToYesterday: 0, isAwaitingToday: false };
        }
        
        const dayKey = d => {
            const dt = (d instanceof Date) ? d : new Date(d);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        
        const daysSet = new Set();
        for (const q of quotes) {
            const ts = q.createdAt || q.dateAdded;
            if (!ts) continue;
            daysSet.add(dayKey(ts));
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        let streakToYesterday = 0;
        const cursor = new Date(yesterday);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const key = dayKey(cursor);
            if (daysSet.has(key)) {
                streakToYesterday++;
                cursor.setDate(cursor.getDate() - 1);
            } else {
                break;
            }
        }
        
        return { 
            streakToYesterday, 
            isAwaitingToday: streakToYesterday > 0 
        };
    }

    // -------- optimistic calculation helpers --------
    
    /**
     * Calculate statistics optimistically from local quotes without API calls
     */
    _calculateOptimisticStats(quotes) {
        const now = Date.now();
        const weekAgo = now - 7 * 86400_000;
        const thirtyAgo = now - 30 * 86400_000;
        let weekly = 0;
        const authorFreq = new Map();
        
        for (const q of quotes) {
            const ts = new Date(q.createdAt || q.dateAdded).getTime();
            if (!ts) continue;
            if (ts >= weekAgo) weekly++;
            if (ts >= thirtyAgo && q.author) {
                authorFreq.set(q.author, (authorFreq.get(q.author) || 0) + 1);
            }
        }
        
        const favoriteAuthor = this._top(authorFreq) || '—';
        const computedStreak = this._computeStreak(quotes);
        const { streakToYesterday, isAwaitingToday } = this._computeStreakToYesterday(quotes, computedStreak);
        
        return {
            totalQuotes: quotes.length,
            weeklyQuotes: weekly,
            favoriteAuthor,
            currentStreak: computedStreak,
            computedStreak,
            streakToYesterday,
            isAwaitingToday
        };
    }
    
    /**
     * Update state optimistically with local calculation
     */
    _updateOptimisticStats() {
        try {
            const quotes = this.state?.get('quotes.items') || [];
            const optimisticStats = this._calculateOptimisticStats(quotes);
            
            // Get current stats to preserve API-only fields
            const currentStats = this.state.get('stats') || {};
            const currentDiaryStats = this.state.get('diaryStats') || {};
            
            // Update main stats with optimistic values + preserve API fields
            const updatedStats = {
                ...currentStats,
                totalQuotes: optimisticStats.totalQuotes,
                weeklyQuotes: optimisticStats.weeklyQuotes,
                thisWeek: optimisticStats.weeklyQuotes, // Mirror for UI compatibility
                favoriteAuthor: optimisticStats.favoriteAuthor,
                currentStreak: Math.max(optimisticStats.currentStreak, currentStats.currentStreak || 0),
                computedStreak: optimisticStats.computedStreak,
                streakToYesterday: optimisticStats.streakToYesterday,
                isAwaitingToday: optimisticStats.isAwaitingToday,
                loading: false,
                loadedAt: Date.now()
            };
            
            // Update diary stats with optimistic values + preserve API fields
            const updatedDiaryStats = {
                ...currentDiaryStats,
                totalQuotes: optimisticStats.totalQuotes,
                weeklyQuotes: optimisticStats.weeklyQuotes,
                favoriteAuthor: optimisticStats.favoriteAuthor,
                loading: false,
                loadedAt: Date.now()
            };
            
            // Set in state
            this.state.set('stats', updatedStats);
            this.state.set('diaryStats', updatedDiaryStats);
            
            // Emit events for UI updates
            document.dispatchEvent(new CustomEvent('stats:updated', { detail: updatedStats }));
            document.dispatchEvent(new CustomEvent('diary-stats:updated', { detail: updatedDiaryStats }));
            
            console.log('📊 Optimistic stats updated:', { main: updatedStats, diary: updatedDiaryStats });
        } catch (e) {
            console.debug('_updateOptimisticStats failed:', e);
        }
    }

    // -------- event handlers --------
    async onQuoteAdded(detail) {
        try {
            const userId = this._requireUserId();
            console.log('📊 StatisticsService: Quote added, optimistic update first');
            
            // 1. Optimistic recalculation first (instant UI update)
            this._updateOptimisticStats();
            
            // 2. Invalidate cache for fresh API data
            this.invalidateAll();
            
            // 3. Silent sync with API (no loading flags)
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
            
            // 4. Refresh activity percent from API
            await this.refreshActivityPercent();
        } catch (e) {
            console.debug('onQuoteAdded error:', e);
        }
    }

    async onQuoteDeleted(detail) {
        try {
            const userId = this._requireUserId();
            console.log('📊 StatisticsService: Quote deleted, optimistic update first');
            
            // 1. Optimistic recalculation first (instant UI update)
            this._updateOptimisticStats();
            
            // 2. Invalidate cache for fresh API data
            this.invalidateAll();
            
            // 3. Silent sync with API (no loading flags)
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
            
            // 4. Refresh activity percent from API
            await this.refreshActivityPercent();
        } catch (e) {
            console.debug('onQuoteDeleted error:', e);
        }
    }

    async onQuoteEdited(detail) {
        try {
            const userId = this._requireUserId();
            console.log('📊 StatisticsService: Quote edited, optimistic update first');
            
            // 1. Optimistic recalculation first (instant UI update)
            this._updateOptimisticStats();
            
            // 2. Invalidate cache for fresh API data
            this.invalidateAll();
            
            // 3. Silent sync with API (no loading flags)
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
            
            // 4. Refresh activity percent from API
            await this.refreshActivityPercent();
        } catch (e) {
            console.debug('onQuoteEdited error:', e);
        }
    }

    /**
     * Warmup initial stats without loading flags - for app startup
     * Ensures weekly and favoriteAuthor are available immediately
     */
    async warmupInitialStats() {
        try {
            console.log('📊 StatisticsService: Warming up initial stats...');
            
            // Do silent refresh of both stats without any loading indicators
            await Promise.all([
                this.refreshMainStatsSilent(),
                this.refreshDiaryStatsSilent()
            ]);
            
            // Refresh activity percent (important for proper display)
            await this.refreshActivityPercent();
            
            console.log('📊 Initial stats warmup completed');
        } catch (e) {
            console.debug('warmupInitialStats failed:', e);
        }
    }

    invalidateForUser(userId) {
        this.invalidate([
            `mainStats:${userId}`,
            `userProgress:${userId}`,
            `detailedStats:${userId}`,
            `activityPercent:${userId}`,
            `latestQuotes_3:${userId}`,
            `latestQuotes_5:${userId}`
        ]);
    }

    async refreshMainStatsSilent() {
        try {
            // NO loading flags for silent refresh
            const main = await this.getMainStats();
            const progress = await this.getUserProgress();
            
            // Create flat stats object with weeklyQuotes → thisWeek mirroring
            const flatStats = {
                totalQuotes: main.totalQuotes || 0,
                currentStreak: progress.currentStreak || 0,
                computedStreak: progress.computedStreak || 0,
                backendStreak: progress.backendStreak || 0,
                streakToYesterday: progress.streakToYesterday || 0,
                isAwaitingToday: progress.isAwaitingToday || false,
                weeklyQuotes: progress.weeklyQuotes || 0,
                thisWeek: progress.weeklyQuotes || 0, // Mirror for UI compatibility
                favoriteAuthor: progress.favoriteAuthor || '—',
                activityLevel: progress.activityLevel || 'low',
                daysInApp: main.daysInApp || 0,
                loadedAt: Date.now(),
                isFresh: true,
                loading: false
            };
            
            // Update state with flat stats object (merge with existing to preserve optimistic updates)
            const currentStats = this.state.get('stats') || {};
            const mergedStats = { ...currentStats, ...flatStats };
            this.state.set('stats', mergedStats);
            
            // Dispatch event with flat stats
            document.dispatchEvent(new CustomEvent('stats:updated', { detail: mergedStats }));
            console.log('📊 Main stats silently updated:', mergedStats);
        } catch (e) {
            console.debug('refreshMainStatsSilent failed:', e);
        }
    }

    async refreshDiaryStatsSilent() {
        try {
            // NO loading flags for silent refresh
            const diaryStats = await this.getDiaryStats();
            
            // Create flat diary stats object
            const flatDiaryStats = {
                totalQuotes: diaryStats.totalQuotes || 0,
                weeklyQuotes: diaryStats.weeklyQuotes || 0,
                monthlyQuotes: diaryStats.monthlyQuotes || 0,
                favoritesCount: diaryStats.favoritesCount || 0,
                favoriteAuthor: diaryStats.favoriteAuthor || '—',
                activityPercent: diaryStats.activityPercent || 1,
                loadedAt: Date.now(),
                isFresh: true,
                loading: false
            };
            
            // Update state with flat diary stats (merge with existing to preserve optimistic updates)
            const currentDiaryStats = this.state.get('diaryStats') || {};
            const mergedDiaryStats = { ...currentDiaryStats, ...flatDiaryStats };
            this.state.set('diaryStats', mergedDiaryStats);
            
            // Dispatch event with flat stats
            document.dispatchEvent(new CustomEvent('diary-stats:updated', { detail: mergedDiaryStats }));
            console.log('📊 Diary stats silently updated:', mergedDiaryStats);
        } catch (e) {
            console.debug('refreshDiaryStatsSilent failed:', e);
        }
    }

    /**
     * Force refresh activity percent from API
     */
    async refreshActivityPercent() {
        try {
            const userId = this._requireUserId();
            // Clear activity percent cache to force fresh API call
            this.cache.delete(`activityPercent:${userId}`);
            
            // Get fresh activity percent from API
            const activityPercent = await this.getActivityPercent();
            
            // Update both stats and diaryStats with the new activityPercent
            const currentStats = this.state.get('stats') || {};
            const currentDiaryStats = this.state.get('diaryStats') || {};
            
            this.state.set('stats', { ...currentStats, activityPercent });
            this.state.set('diaryStats', { ...currentDiaryStats, activityPercent });
            
            console.log('📊 Activity percent refreshed:', activityPercent);
            return activityPercent;
        } catch (e) {
            console.debug('refreshActivityPercent failed:', e);
            return 1; // fallback
        }
    }

    invalidate(keys = []) {
        if (!keys.length) { this.cache.clear(); return; }
        keys.forEach(k => this.cache.delete(k));
    }

    /**
     * Централизованная инвалидация всего кэша после мутаций цитат
     */
    invalidateAll() {
        console.log('📊 StatisticsService: Invalidating all cache');
        this.cache.clear();
        this.inFlight.clear();
    }

    // -------- internal helpers --------
    _requireUserId() {
        const id = this.state?.getCurrentUserId?.();
        if (!id) throw new Error('UserId not ready');
        return id;
    }
    async _cached(key, loader, ttl) {
        const now = Date.now();
        const entry = this.cache.get(key);
        if (entry && (now - entry.time) < ttl) return entry.value;
        if (this.inFlight.has(key)) return this.inFlight.get(key);
        const p = (async () => {
            try {
                const val = await loader();
                this.cache.set(key, { value: val, time: Date.now() });
                return val;
            } finally {
                this.inFlight.delete(key);
            }
        })();
        this.inFlight.set(key, p);
        return p;
    }
    _top(map) {
        let best = null, max = -1;
        for (const [k, v] of map.entries()) { if (v > max) { max = v; best = k; } }
        return best;
    }
}
if (typeof window !== 'undefined') window.StatisticsService = StatisticsService;
// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsService;
}
