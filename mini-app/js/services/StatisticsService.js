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
        const [main, progress, detailed] = await Promise.all([
            this.getMainStats(),
            this.getUserProgress(),
            this.getDetailedQuoteStats()
        ]);
        return {
            totalQuotes: main.totalQuotes ?? 0,
            weeklyQuotes: progress.weeklyQuotes ?? 0,
            monthlyQuotes: detailed.monthlyQuotes ?? 0,
            favoritesCount: detailed.favoritesCount ?? 0,
            favoriteAuthor: progress.favoriteAuthor ?? '—',
            activityPercent: await this.getActivityPercent() ?? 1
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
                const userId = this._requireUserId();
                const result = await this.api.getActivityPercent(userId);
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

    // -------- event handlers --------
    async onQuoteAdded(detail) {
        try {
            const userId = this._requireUserId();
            console.log('📊 StatisticsService: Quote added, refreshing stats');
            
            // Completely reset cache (invalidate all)
            this.invalidate();
            
            // Load fresh data and then update state and dispatch event
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
        } catch (e) {
            console.debug('onQuoteAdded error:', e);
        }
    }

    async onQuoteDeleted(detail) {
        try {
            const userId = this._requireUserId();
            console.log('📊 StatisticsService: Quote deleted, refreshing stats');
            
            // Completely reset cache (invalidate all)
            this.invalidate();
            
            // Load fresh data and then update state and dispatch event
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
        } catch (e) {
            console.debug('onQuoteDeleted error:', e);
        }
    }

    async onQuoteEdited(detail) {
        try {
            const userId = this._requireUserId();
            console.log('📊 StatisticsService: Quote edited, refreshing stats');
            
            // For edited quotes, we may only need to refresh if favorite status changed
            // But for simplicity, refresh all stats
            this.invalidate();
            
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
        } catch (e) {
            console.debug('onQuoteEdited error:', e);
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
            const main = await this.getMainStats();
            const progress = await this.getUserProgress();
            const prev = this.state.get('stats') || {};
            
            const merged = {
                ...prev,
                ...main,
                currentStreak: progress.currentStreak,
                computedStreak: progress.computedStreak,
                backendStreak: progress.backendStreak,
                streakToYesterday: progress.streakToYesterday,
                isAwaitingToday: progress.isAwaitingToday,
                weeklyQuotes: progress.weeklyQuotes,
                favoriteAuthor: progress.favoriteAuthor,
                loadedAt: Date.now(),
                isFresh: true
            };
            
            this.state.update('stats', merged);
            document.dispatchEvent(new CustomEvent('stats:updated', { detail: merged }));
            console.log('📊 Main stats updated and event dispatched');
        } catch (e) {
            console.debug('refreshMainStatsSilent failed:', e);
        }
    }

    async refreshDiaryStatsSilent() {
        try {
            const diaryStats = await this.getDiaryStats();
            const prev = this.state.get('diaryStats') || {};
            
            const merged = {
                ...prev,
                ...diaryStats,
                loadedAt: Date.now(),
                isFresh: true
            };
            
            this.state.update('diaryStats', merged);
            document.dispatchEvent(new CustomEvent('diary-stats:updated', { detail: merged }));
            console.log('📊 Diary stats updated and event dispatched');
        } catch (e) {
            console.debug('refreshDiaryStatsSilent failed:', e);
        }
    }

    invalidate(keys = []) {
        if (!keys.length) { this.cache.clear(); return; }
        keys.forEach(k => this.cache.delete(k));
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
