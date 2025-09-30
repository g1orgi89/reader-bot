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
        
        // Initialize baseline + deltas model for totalQuotes
        this._initializeBaselineDeltas();
        
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

    /**
     * Initialize baseline + deltas model for instant totalQuotes and weeklyQuotes updates
     */
    _initializeBaselineDeltas() {
        const currentStats = this.state.get('stats') || {};
        if (!('baselineTotal' in currentStats)) {
            this.state.update('stats', {
                baselineTotal: currentStats.totalQuotes || 0,
                pendingAdds: 0,
                pendingDeletes: 0,
                baselineWeekly: currentStats.weeklyQuotes || 0,
                pendingWeeklyAdds: 0,
                pendingWeeklyDeletes: 0
            });
        }
    }

    /**
     * Calculate effective total quotes using baseline + deltas model
     */
    _getEffectiveTotal() {
        const stats = this.state.get('stats') || {};
        const baselineTotal = stats.baselineTotal || 0;
        const pendingAdds = stats.pendingAdds || 0;
        const pendingDeletes = stats.pendingDeletes || 0;
        return baselineTotal + pendingAdds - pendingDeletes;
    }

    /**
     * Calculate effective weekly quotes using baseline + deltas model
     */
    _getEffectiveWeekly() {
        const stats = this.state.get('stats') || {};
        const baselineWeekly = stats.baselineWeekly || 0;
        const pendingWeeklyAdds = stats.pendingWeeklyAdds || 0;
        const pendingWeeklyDeletes = stats.pendingWeeklyDeletes || 0;
        return baselineWeekly + pendingWeeklyAdds - pendingWeeklyDeletes;
    }

    /**
     * Update totalQuotes and weeklyQuotes using effectiveTotal and effectiveWeekly calculations
     */
    _updateTotalQuotes() {
        const effectiveTotal = this._getEffectiveTotal();
        const effectiveWeekly = this._getEffectiveWeekly();
        
        this.state.update('stats', { 
            totalQuotes: effectiveTotal,
            weeklyQuotes: effectiveWeekly,
            thisWeek: effectiveWeekly // Mirror for UI compatibility
        });
        
        // Also update diaryStats for consistency
        const currentDiaryStats = this.state.get('diaryStats') || {};
        this.state.set('diaryStats', { 
            ...currentDiaryStats, 
            totalQuotes: effectiveTotal,
            weeklyQuotes: effectiveWeekly
        });
        
        // Emit events for UI updates
        const updatedStats = this.state.get('stats');
        const updatedDiaryStats = this.state.get('diaryStats');
        document.dispatchEvent(new CustomEvent('stats:updated', { detail: updatedStats }));
        document.dispatchEvent(new CustomEvent('diary-stats:updated', { detail: updatedDiaryStats }));
    }

    async getMainStats() {
        return this._cached(`mainStats:${this._requireUserId()}`, async () => {
            const userId = this._requireUserId();
            // Use new scoped stats API with current week and metadata
            const resp = await this.api.getStats(userId, {
                scope: 'week',
                includeWeekMeta: true
            });
            const raw = resp?.stats || resp || {};
            return {
                totalQuotes: raw.totalQuotes || 0,
                currentStreak: raw.currentStreak || 0,
                daysInApp: raw.daysSinceRegistration || raw.daysInApp || 0,
                // NEW: Use weeklyQuotes from backend instead of recomputing
                weeklyQuotes: raw.weeklyQuotes || raw.quotes || 0, // Prefer weeklyQuotes alias, fallback to quotes
                weekMeta: raw.weekMeta || null // Week metadata for display
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
          const resp = await this.api.getTopBooks({ scope: 'week' });
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
            
            // Get main stats to use backend weeklyQuotes instead of rolling calculation
            const main = await this.getMainStats();
            const weeklyQuotes = main.weeklyQuotes || 0;
            
            const now = Date.now();
            const thirtyAgo = now - 30 * 86400_000;
            const authorFreq = new Map();
            
            for (const q of quotes) {
                const ts = new Date(q.createdAt || q.dateAdded).getTime();
                if (!ts) continue;
                // Only calculate author frequency for last 30 days
                if (ts >= thirtyAgo && q.author) {
                    authorFreq.set(q.author, (authorFreq.get(q.author) || 0) + 1);
                }
            }
            
            const favoriteAuthor = this._top(authorFreq);
            let activityLevel = 'low';
            if (weeklyQuotes >= 15) activityLevel = 'high';
            else if (weeklyQuotes >= 5) activityLevel = 'medium';
            
            let streak = main.currentStreak || 0;
            const computedStreak = this._computeStreak(quotes);
            if (computedStreak > streak) streak = computedStreak;
            
            // Enhanced streak calculation with yesterday fallback
            const { streakToYesterday, isAwaitingToday } = this._computeStreakToYesterday(quotes, computedStreak);
            
            return {
                weeklyQuotes, // Use backend ISO week count
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
        this._requireUserId(); // Ensure userId is available
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
        const thirtyAgo = now - 30 * 86400_000;
        
        // Calculate current ISO week key for comparison
        const currentWeekKey = this._getIsoWeekKey(new Date());
        let weekly = 0;
        const authorFreq = new Map();
        
        for (const q of quotes) {
            const ts = new Date(q.createdAt || q.dateAdded).getTime();
            if (!ts) continue;
            
            // Use ISO week comparison instead of rolling 7 days
            const quoteDate = new Date(ts);
            const quoteWeekKey = this._getIsoWeekKey(quoteDate);
            if (quoteWeekKey === currentWeekKey) weekly++;
            
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
     * Get ISO week key for date comparison (proper ISO 8601 implementation)
     * @param {Date} date 
     * @returns {string} Week key like "2024-W01"
     */
    _getIsoWeekKey(date) {
        // Proper ISO 8601 week calculation with Thursday as anchor
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        
        // ISO week starts on Monday, Thursday is always in the same week
        const dayNum = d.getUTCDay() || 7; // Monday = 1, Sunday = 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Move to Thursday of the same week
        
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        const isoYear = d.getUTCFullYear();
        
        return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
    }
    
    /**
     * Update state optimistically with local calculation
     */
    _updateOptimisticStats() {
        try {
            const quotes = this.state?.get('quotes.items') || [];
            const optimisticStats = this._calculateOptimisticStats(quotes);
            // ← ДОБАВЬ ЭТО
            const favoritesCount = quotes.filter(q => q.isFavorite || q.favorite).length;
            // Get current stats to preserve API-only fields
            const currentStats = this.state.get('stats') || {};
            const currentDiaryStats = this.state.get('diaryStats') || {};
            
            // Use effective calculations if baseline+deltas are available, otherwise use optimistic
            const effectiveTotal = this._getEffectiveTotal();
            const effectiveWeekly = this._getEffectiveWeekly();
            const hasBaseline = currentStats.baselineTotal !== undefined;
            
            // Update main stats with effective values when baseline exists, optimistic otherwise
            const updatedStats = {
                ...currentStats,
                totalQuotes: hasBaseline ? effectiveTotal : optimisticStats.totalQuotes,
                weeklyQuotes: hasBaseline ? effectiveWeekly : optimisticStats.weeklyQuotes,
                thisWeek: hasBaseline ? effectiveWeekly : optimisticStats.weeklyQuotes, // Mirror for UI compatibility
                favoriteAuthor: optimisticStats.favoriteAuthor,
                currentStreak: Math.max(optimisticStats.currentStreak, currentStats.currentStreak || 0),
                computedStreak: optimisticStats.computedStreak,
                streakToYesterday: optimisticStats.streakToYesterday,
                isAwaitingToday: optimisticStats.isAwaitingToday,
                favoritesCount,
                loading: false,
                loadedAt: Date.now()
            };
            
            // Update diary stats with effective values when baseline exists, optimistic otherwise
            const updatedDiaryStats = {
                ...currentDiaryStats,
                totalQuotes: hasBaseline ? effectiveTotal : optimisticStats.totalQuotes,
                weeklyQuotes: hasBaseline ? effectiveWeekly : optimisticStats.weeklyQuotes,
                favoriteAuthor: optimisticStats.favoriteAuthor,
                favoritesCount,
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
            this._requireUserId(); // Ensure userId is available
            console.log('📊 StatisticsService: Quote added, applying baseline + deltas');
            
            // 🔧 FIX: Check if quote is in current ISO week before incrementing weekly
            const quoteDate = detail?.quote?.createdAt ? new Date(detail.quote.createdAt) : new Date();
            const currentWeekKey = this._getIsoWeekKey(new Date());
            const quoteWeekKey = this._getIsoWeekKey(quoteDate);
            const isCurrentWeek = quoteWeekKey === currentWeekKey;
            
            // 1. Increase pendingAdds and pendingWeeklyAdds for instant UI update
            const stats = this.state.get('stats') || {};
            this.state.update('stats', {
                pendingAdds: (stats.pendingAdds || 0) + 1,
                // 🔧 FIX: Only increment weekly if quote is in current ISO week
                pendingWeeklyAdds: (stats.pendingWeeklyAdds || 0) + (isCurrentWeek ? 1 : 0)
            });
            
            console.log(`📊 Quote ${isCurrentWeek ? 'IS' : 'IS NOT'} in current week (${currentWeekKey} vs ${quoteWeekKey})`);
            
            // 2. Update totalQuotes and weeklyQuotes instantly using effective calculations
            this._updateTotalQuotes();
            
            // 3. UPDATE OPTIMISTIC STATS (streak, etc.) BEFORE invalidation
            this._updateOptimisticStats();
            
            // 4. Invalidate cache for fresh API data
            this.invalidateAll();
            
            // 5. Silent sync with API (no loading flags)
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
            
            // 6. Refresh activity percent from API
            await this.refreshActivityPercent();
        } catch (e) {
            console.debug('onQuoteAdded error:', e);
        }
    }

    async onQuoteDeleted(detail) {
        try {
            this._requireUserId(); // Ensure userId is available
            console.log('📊 StatisticsService: Quote deleted, processing with baseline + deltas');
            
            const { optimistic, reverted, quote } = detail;
            
            // 🔧 FIX: Check if quote was in current ISO week
            let isCurrentWeek = false;
            if (quote?.createdAt) {
                const quoteDate = new Date(quote.createdAt);
                const currentWeekKey = this._getIsoWeekKey(new Date());
                const quoteWeekKey = this._getIsoWeekKey(quoteDate);
                isCurrentWeek = quoteWeekKey === currentWeekKey;
                console.log(`📊 Deleted quote ${isCurrentWeek ? 'WAS' : 'WAS NOT'} in current week (${currentWeekKey} vs ${quoteWeekKey})`);
            }
            
            if (optimistic) {
                // Optimistic delete: instant -1 by increasing pendingDeletes and pendingWeeklyDeletes
                console.log('📊 Optimistic delete: increasing pendingDeletes and pendingWeeklyDeletes');
                const stats = this.state.get('stats') || {};
                this.state.update('stats', {
                    pendingDeletes: (stats.pendingDeletes || 0) + 1,
                    // 🔧 FIX: Only increment weekly deletes if quote was in current ISO week
                    pendingWeeklyDeletes: (stats.pendingWeeklyDeletes || 0) + (isCurrentWeek ? 1 : 0)
                });
                this._updateTotalQuotes();
                
                // Update optimistic stats (streak, etc.)
                this._updateOptimisticStats();
            } else if (reverted) {
                // Revert failed delete: decrease pendingDeletes and pendingWeeklyDeletes
                console.log('📊 Reverting delete: decreasing pendingDeletes and pendingWeeklyDeletes');
                const stats = this.state.get('stats') || {};
                this.state.update('stats', {
                    pendingDeletes: Math.max(0, (stats.pendingDeletes || 0) - 1),
                    // 🔧 FIX: Only decrement weekly deletes if quote was in current ISO week
                    pendingWeeklyDeletes: Math.max(0, (stats.pendingWeeklyDeletes || 0) - (isCurrentWeek ? 1 : 0))
                });
                this._updateTotalQuotes();
                
                // Update optimistic stats after revert
                this._updateOptimisticStats();
            } else {
                // Regular delete confirmation (after successful API call)
                // No delta changes needed, will be handled in next refresh
                console.log('📊 Delete confirmed, will sync on next refresh');
                
                // Invalidate cache for fresh API data
                this.invalidateAll();
                
                // Silent sync with API (no loading flags)
                await this.refreshMainStatsSilent();
                await this.refreshDiaryStatsSilent();
                
                // Refresh activity percent from API
                await this.refreshActivityPercent();
            }
        } catch (e) {
            console.debug('onQuoteDeleted error:', e);
        }
    }

    async onQuoteEdited(_detail) {
        try {
            this._requireUserId(); // Ensure userId is available
            console.log('📊 StatisticsService: Quote edited, no totalQuotes change needed');
            
            // Quote editing doesn't affect totalQuotes, only other stats like favoriteAuthor
            // No delta changes needed, just refresh from API
            
            // Invalidate cache for fresh API data
            this.invalidateAll();
            
            // Silent sync with API (no loading flags) 
            await this.refreshMainStatsSilent();
            await this.refreshDiaryStatsSilent();
            
            // Refresh activity percent from API
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

            // Get server values as new baselines
            const serverTotalQuotes = main.totalQuotes || 0;
            const serverWeeklyQuotes = main.weeklyQuotes || 0;
            
            // Get current deltas
            const currentStats = this.state.get('stats') || {};
            const currentPendingAdds = currentStats.pendingAdds || 0;
            const currentPendingDeletes = currentStats.pendingDeletes || 0;
            const currentBaselineTotal = currentStats.baselineTotal || 0;
            const currentPendingWeeklyAdds = currentStats.pendingWeeklyAdds || 0;
            const currentPendingWeeklyDeletes = currentStats.pendingWeeklyDeletes || 0;
            const currentBaselineWeekly = currentStats.baselineWeekly || 0;
            
            // Calculate the differences and adjust deltas accordingly
            const serverTotalDiff = serverTotalQuotes - currentBaselineTotal;
            const serverWeeklyDiff = serverWeeklyQuotes - currentBaselineWeekly;
            
            let newPendingAdds = currentPendingAdds;
            let newPendingDeletes = currentPendingDeletes;
            let newPendingWeeklyAdds = currentPendingWeeklyAdds;
            let newPendingWeeklyDeletes = currentPendingWeeklyDeletes;
            
            // Adjust total deltas based on server changes
            if (serverTotalDiff > 0) {
                // Server shows more quotes, reduce pending adds by the difference
                newPendingAdds = Math.max(0, newPendingAdds - serverTotalDiff);
            } else if (serverTotalDiff < 0) {
                // Server shows fewer quotes, reduce pending deletes by absolute difference
                newPendingDeletes = Math.max(0, newPendingDeletes - Math.abs(serverTotalDiff));
            }
            
            // Adjust weekly deltas based on server changes
            if (serverWeeklyDiff > 0) {
                // Server shows more weekly quotes, reduce pending weekly adds by the difference
                newPendingWeeklyAdds = Math.max(0, newPendingWeeklyAdds - serverWeeklyDiff);
            } else if (serverWeeklyDiff < 0) {
                // Server shows fewer weekly quotes, reduce pending weekly deletes by absolute difference
                newPendingWeeklyDeletes = Math.max(0, newPendingWeeklyDeletes - Math.abs(serverWeeklyDiff));
            }
            
            // Set new baselines and corrected deltas
            const baselineTotal = serverTotalQuotes;
            const baselineWeekly = serverWeeklyQuotes;
            const effectiveTotal = baselineTotal + newPendingAdds - newPendingDeletes;
            const effectiveWeekly = baselineWeekly + newPendingWeeklyAdds - newPendingWeeklyDeletes;

            // Create flat stats object with baseline + deltas model
            const flatStats = {
                baselineTotal,
                pendingAdds: newPendingAdds,
                pendingDeletes: newPendingDeletes,
                baselineWeekly,
                pendingWeeklyAdds: newPendingWeeklyAdds,
                pendingWeeklyDeletes: newPendingWeeklyDeletes,
                totalQuotes: effectiveTotal, // Use only effectiveTotal, no Math.max
                weeklyQuotes: effectiveWeekly, // Use only effectiveWeekly, no Math.max
                thisWeek: effectiveWeekly, // Mirror for UI compatibility
                currentStreak: progress.currentStreak || 0,
                computedStreak: progress.computedStreak || 0,
                backendStreak: progress.backendStreak || 0,
                streakToYesterday: progress.streakToYesterday || 0,
                isAwaitingToday: progress.isAwaitingToday || false,
                favoriteAuthor: progress.favoriteAuthor || '—',
                activityLevel: progress.activityLevel || 'low',
                daysInApp: main.daysInApp || 0,
                loadedAt: Date.now(),
                isFresh: true,
                loading: false
            };

            this.state.set('stats', flatStats);

            document.dispatchEvent(new CustomEvent('stats:updated', { detail: flatStats }));
            console.log('📊 Main stats silently updated with baseline + deltas:', flatStats);
        } catch (e) {
            console.debug('refreshMainStatsSilent failed:', e);
            
        }
    }

    async refreshDiaryStatsSilent() {
        try {
            // NO loading flags for silent refresh
            const diaryStats = await this.getDiaryStats();
            
            // Use effective calculations instead of server values
            const effectiveTotal = this._getEffectiveTotal();
            const effectiveWeekly = this._getEffectiveWeekly();
            
            // Get current diary stats to preserve optimistic values
            const currentDiaryStats = this.state.get('diaryStats') || {};
            
            // Create flat diary stats object
            const flatDiaryStats = {
                totalQuotes: effectiveTotal, // Use effectiveTotal for consistency
                weeklyQuotes: effectiveWeekly, // Use effectiveWeekly for consistency
                monthlyQuotes: diaryStats.monthlyQuotes || 0,
                favoritesCount: diaryStats.favoritesCount || 0,
                favoriteAuthor: diaryStats.favoriteAuthor || '—',
                activityPercent: diaryStats.activityPercent || 1,
                loadedAt: Date.now(),
                isFresh: true,
                loading: false
            };
            
            // Update state with flat diary stats (merge with existing to preserve optimistic updates)
            const mergedDiaryStats = { ...currentDiaryStats, ...flatDiaryStats };
            this.state.set('diaryStats', mergedDiaryStats);
            
            // Dispatch event with flat stats
            document.dispatchEvent(new CustomEvent('diary-stats:updated', { detail: mergedDiaryStats }));
            console.log('📊 Diary stats silently updated with effective values:', mergedDiaryStats);
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

// --- OPTIMISTIC GLOBAL LISTENER REPLACEMENT ---
if (typeof document !== 'undefined') {
    let refreshTimeout = null;
    
    document.addEventListener('quotes:changed', (e) => {
        const detail = e.detail || {};
        
        // Only handle if there's no StatisticsService instance to avoid duplication
        // (The instance handlers in constructor already handle added/deleted/edited)
        if (window.statisticsService) {
            // Clear any pending refresh
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
            }
            
            // For non-handled events or as fallback, do optimistic update + debounced refresh
            if (detail.type && !['added', 'deleted', 'edited'].includes(detail.type)) {
                // Unknown event type, update optimistically and refresh
                window.statisticsService._updateOptimisticStats?.();
                
                // Debounced refresh after 100ms
                refreshTimeout = setTimeout(() => {
                    window.statisticsService.refreshMainStatsSilent?.();
                    window.statisticsService.refreshDiaryStatsSilent?.();
                }, 100);
            }
        }
    });
}

/**
 * Пересчитывает статистику по локальному массиву цитат
 * @param {Array<Object>} quotes
 * @returns {Object} stats
 */
window.recomputeAllStatsFromLocal = function(quotes) {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  return {
    totalQuotes: quotes.length,
    weeklyQuotes: quotes.filter(q => now - new Date(q.createdAt).getTime() < weekMs).length,
    monthlyQuotes: quotes.filter(q => now - new Date(q.createdAt).getTime() < monthMs).length,
    favoritesCount: quotes.filter(q => !!q.isFavorite).length,
    favoriteAuthor: (() => {
      const authors = quotes.filter(q => !!q.author).map(q => q.author);
      if (!authors.length) return null;
      return authors.sort((a, b) =>
        authors.filter(v => v === b).length - authors.filter(v => v === a).length
      )[0];
    })()
  };
}

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsService;
}
