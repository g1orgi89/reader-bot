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
     * Initialize baseline + deltas model for instant totalQuotes updates
     */
    _initializeBaselineDeltas() {
        const currentStats = this.state.get('stats') || {};
        if (!('baselineTotal' in currentStats)) {
            this.state.update('stats', {
                baselineTotal: currentStats.totalQuotes || 0,
                pendingAdds: 0,
                pendingDeletes: 0
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
     * Update totalQuotes using only effectiveTotal calculation
     */
    _updateTotalQuotes() {
        const effectiveTotal = this._getEffectiveTotal();
        this.state.update('stats', { totalQuotes: effectiveTotal });
        
        // Also update diaryStats for consistency
        const currentDiaryStats = this.state.get('diaryStats') || {};
        this.state.set('diaryStats', { ...currentDiaryStats, totalQuotes: effectiveTotal });
        
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
            // Get main stats to use backend weeklyQuotes instead of rolling calculation
            const main = await this.getMainStats();
            const weeklyQuotes = main.weeklyQuotes || 0;
            
            const now = Date.now();
            const thirtyAgo = now - 30 * 86400_000;
            const authorFreq = new Map();
            
            // Get quotes from state since we're computing from cache
            const quotes = this.state?.get('quotes.items') || [];
            
            for (const q of quotes) {
                const ts = new Date(q.createdAt || q.dateAdded).getTime();
                if (!ts) continue;
                // Only calculate author frequency for last 30 days
                if (ts >= thirtyAgo && q.author) {
                    authorFreq.set(q.author, (authorFreq.get(q.author) || 0) + 1);
                }
            }
            
            const favoriteAuthor = this._top(authorFreq);
            // Calculate lifetime activity level based on totalQuotes (not just weekly)
            const totalQuotes = main.totalQuotes || 0;
            let activityLevel = 'low';
            let lifetimeLevel = 'начинающий'; // Default for lifetime
            
            // Lifetime activity thresholds based on total quotes
            if (totalQuotes >= 100) {
                lifetimeLevel = 'эксперт';
            } else if (totalQuotes >= 50) {
                lifetimeLevel = 'продвинутый';
            } else if (totalQuotes >= 20) {
                lifetimeLevel = 'активный';
            } else if (totalQuotes >= 10) {
                lifetimeLevel = 'развивающийся';
            }
            
            // Weekly activity for immediate feedback
            if (weeklyQuotes >= 15) {
                activityLevel = 'high';
            } else if (weeklyQuotes >= 5) {
                activityLevel = 'medium';
            }
            
            // FALLBACK BEHAVIOR: Override activityLevel with lifetimeLevel for better UX on Monday
            // Prevents showing "начинающий" for users with 40+ total quotes
            // Also provides better fallback when current ISO week has low data
            if (totalQuotes >= 40 && weeklyQuotes === 0) {
                activityLevel = 'medium'; // Show at least medium for experienced users
            } else if (totalQuotes >= 20 && weeklyQuotes <= 2) {
                // For users with some experience but low current week activity
                activityLevel = Math.max(activityLevel === 'low' ? 'medium' : activityLevel, 'low');
            }
            
            let streak = main.currentStreak || 0;
            const computedStreak = this._computeStreak(quotes);
            if (computedStreak > streak) streak = computedStreak;
            
            // Enhanced streak calculation with yesterday fallback
            const { streakToYesterday, isAwaitingToday } = this._computeStreakToYesterday(quotes, computedStreak);
            
            return {
                weeklyQuotes, // Use backend ISO week count
                favoriteAuthor,
                activityLevel,
                lifetimeLevel, // NEW: lifetime activity level based on totalQuotes
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
            let quotes = [];
            try {
                const resp = await this.api.getQuotes({ limit: 500 }, this._requireUserId());
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
     * Get ISO week key for date comparison (prefer DateUtils if available)
     * @param {Date} date 
     * @returns {string} Week key like "2024-W01"
     */
    _getIsoWeekKey(date) {
        // Use DateUtils for accurate ISO week calculation if available
        if (typeof window !== 'undefined' && window.DateUtils && window.DateUtils.getIsoWeekKey) {
            return window.DateUtils.getIsoWeekKey(date);
        }
        
        // Fallback to proper ISO week calculation
        const d = new Date(date);
        const dayNum = d.getDay() || 7; // Monday = 1, Sunday = 7
        d.setDate(d.getDate() + 4 - dayNum); // Thursday of the same week
        
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const isoWeek = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getFullYear()}-W${String(isoWeek).padStart(2, '0')}`;
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
                favoritesCount,
                loading: false,
                loadedAt: Date.now()
            };
            
            // Update diary stats with optimistic values + preserve API fields
            const updatedDiaryStats = {
                ...currentDiaryStats,
                totalQuotes: optimisticStats.totalQuotes,
                weeklyQuotes: optimisticStats.weeklyQuotes,
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
            console.log('📊 StatisticsService: Quote added, applying baseline + deltas');
            
            // Get current ISO week key for comparison
            const currentWeekKey = this._getIsoWeekKey(new Date());
            let shouldIncrementWeekly = false;
            
            // Check if the added quote is for current week
            if (detail.quote && detail.quote.createdAt) {
                const quoteDate = new Date(detail.quote.createdAt);
                const quoteWeekKey = this._getIsoWeekKey(quoteDate);
                shouldIncrementWeekly = (quoteWeekKey === currentWeekKey);
            } else {
                // If no quote date available, assume it's current week (safe assumption for new quotes)
                shouldIncrementWeekly = true;
            }
            
            // 1. Increase pendingAdds for instant totalQuotes update
            const stats = this.state.get('stats') || {};
            this.state.update('stats', {
                pendingAdds: (stats.pendingAdds || 0) + 1
            });
            
            // 2. Update totalQuotes instantly using effectiveTotal
            this._updateTotalQuotes();
            
            // 3. OPTIMISTIC WEEKLY UPDATE: Increment weeklyQuotes if quote is for current week
            if (shouldIncrementWeekly) {
                const currentWeeklyQuotes = stats.weeklyQuotes || 0;
                this.state.update('stats', {
                    weeklyQuotes: currentWeeklyQuotes + 1,
                    thisWeek: currentWeeklyQuotes + 1 // Mirror for UI compatibility
                });
                
                // Also update diary stats
                this.state.update('diaryStats', {
                    weeklyQuotes: currentWeeklyQuotes + 1
                });
                
                console.log('📊 Optimistically incremented weeklyQuotes:', currentWeeklyQuotes + 1);
            }
            
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
            console.log('📊 StatisticsService: Quote deleted, processing with baseline + deltas');
            
            const { optimistic, reverted, quote } = detail;
            
            // Determine if deleted quote affects current week count
            let shouldDecrementWeekly = false;
            if (quote && quote.createdAt) {
                const currentWeekKey = this._getIsoWeekKey(new Date());
                const quoteDate = new Date(quote.createdAt);
                const quoteWeekKey = this._getIsoWeekKey(quoteDate);
                shouldDecrementWeekly = (quoteWeekKey === currentWeekKey);
            } else if (!quote) {
                // If no quote object available, try to look up from state
                const quoteId = detail.quoteId || detail.id;
                if (quoteId) {
                    const quotes = this.state.get('quotes.items') || [];
                    const foundQuote = quotes.find(q => (q._id || q.id) === quoteId);
                    if (foundQuote && foundQuote.createdAt) {
                        const currentWeekKey = this._getIsoWeekKey(new Date());
                        const quoteDate = new Date(foundQuote.createdAt);
                        const quoteWeekKey = this._getIsoWeekKey(quoteDate);
                        shouldDecrementWeekly = (quoteWeekKey === currentWeekKey);
                    }
                }
            }
            
            if (optimistic) {
                // Optimistic delete: instant -1 by increasing pendingDeletes
                console.log('📊 Optimistic delete: increasing pendingDeletes');
                const stats = this.state.get('stats') || {};
                this.state.update('stats', {
                    pendingDeletes: (stats.pendingDeletes || 0) + 1
                });
                this._updateTotalQuotes();
                
                // OPTIMISTIC WEEKLY UPDATE: Decrement weeklyQuotes if quote is from current week
                if (shouldDecrementWeekly) {
                    const currentWeeklyQuotes = stats.weeklyQuotes || 0;
                    const newWeeklyQuotes = Math.max(0, currentWeeklyQuotes - 1);
                    this.state.update('stats', {
                        weeklyQuotes: newWeeklyQuotes,
                        thisWeek: newWeeklyQuotes // Mirror for UI compatibility
                    });
                    
                    // Also update diary stats
                    this.state.update('diaryStats', {
                        weeklyQuotes: newWeeklyQuotes
                    });
                    
                    console.log('📊 Optimistically decremented weeklyQuotes:', newWeeklyQuotes);
                }
            } else if (reverted) {
                // Revert failed delete: decrease pendingDeletes
                console.log('📊 Reverting delete: decreasing pendingDeletes');
                const stats = this.state.get('stats') || {};
                this.state.update('stats', {
                    pendingDeletes: Math.max(0, (stats.pendingDeletes || 0) - 1)
                });
                this._updateTotalQuotes();
                
                // REVERT WEEKLY UPDATE: Increment weeklyQuotes back if it was decremented
                if (shouldDecrementWeekly) {
                    const currentWeeklyQuotes = stats.weeklyQuotes || 0;
                    this.state.update('stats', {
                        weeklyQuotes: currentWeeklyQuotes + 1,
                        thisWeek: currentWeeklyQuotes + 1 // Mirror for UI compatibility
                    });
                    
                    // Also update diary stats
                    this.state.update('diaryStats', {
                        weeklyQuotes: currentWeeklyQuotes + 1
                    });
                    
                    console.log('📊 Reverted weeklyQuotes increment:', currentWeeklyQuotes + 1);
                }
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

            // Get server totalQuotes as new baseline
            const serverTotalQuotes = main.totalQuotes || 0;
            
            // Get current deltas
            const currentStats = this.state.get('stats') || {};
            const currentPendingAdds = currentStats.pendingAdds || 0;
            const currentPendingDeletes = currentStats.pendingDeletes || 0;
            const currentBaselineTotal = currentStats.baselineTotal || 0;
            
            // Calculate the difference and adjust deltas accordingly
            const serverDiff = serverTotalQuotes - currentBaselineTotal;
            let newPendingAdds = currentPendingAdds;
            let newPendingDeletes = currentPendingDeletes;
            
            // Adjust deltas based on server changes
            if (serverDiff > 0) {
                // Server shows more quotes, reduce pending adds by the difference
                newPendingAdds = Math.max(0, newPendingAdds - serverDiff);
            } else if (serverDiff < 0) {
                // Server shows fewer quotes, reduce pending deletes by absolute difference
                newPendingDeletes = Math.max(0, newPendingDeletes - Math.abs(serverDiff));
            }
            
            // Set new baseline and corrected deltas
            const baselineTotal = serverTotalQuotes;
            const effectiveTotal = baselineTotal + newPendingAdds - newPendingDeletes;

            // Create flat stats object with baseline + deltas model
            const flatStats = {
                baselineTotal,
                pendingAdds: newPendingAdds,
                pendingDeletes: newPendingDeletes,
                totalQuotes: effectiveTotal, // Use only effectiveTotal, no Math.max
                currentStreak: progress.currentStreak || 0,
                computedStreak: progress.computedStreak || 0,
                backendStreak: progress.backendStreak || 0,
                streakToYesterday: progress.streakToYesterday || 0,
                isAwaitingToday: progress.isAwaitingToday || false,
                weeklyQuotes: main.weeklyQuotes || 0, // Use main.weeklyQuotes from backend instead of progress
                thisWeek: main.weeklyQuotes || 0, // Mirror for UI compatibility
                favoriteAuthor: progress.favoriteAuthor || '—',
                activityLevel: progress.activityLevel || 'low',
                lifetimeLevel: progress.lifetimeLevel || 'начинающий', // NEW: lifetime activity level
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
            
            // Use effectiveTotal instead of server totalQuotes
            const effectiveTotal = this._getEffectiveTotal();
            
            // Create flat diary stats object
            const flatDiaryStats = {
                totalQuotes: effectiveTotal, // Use effectiveTotal for consistency
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
            console.log('📊 Diary stats silently updated with effectiveTotal:', mergedDiaryStats);
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

// --- ДОБАВЬ этот блок ниже ---
if (typeof document !== 'undefined') {
    document.addEventListener('quotes:changed', () => {
        if (window.StatisticsService) {
            // Если есть инстанс StatisticsService (например, window.statisticsService или app.statistics)
            // Вызови refresh методов для обновления статистики
            // Обычно инстанс создается как window.statisticsService = new StatisticsService(...)
            if (window.statisticsService) {
                window.statisticsService.refreshMainStatsSilent();
                window.statisticsService.refreshDiaryStatsSilent();
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
