/**
 * 👤 PROFILE PAGE - ProfilePage.js
 * 
 * Full-page user profile view with comprehensive user information
 * Supports viewing own profile (?user=me) and other users' profiles (?user=userId)
 * 
 * Features:
 * - User avatar, name, and bio
 * - Reading statistics
 * - Recent quotes
 * - Follow/Unfollow functionality
 * - Edit profile (own profile only)
 * 
 * @version 1.0.0
 */

class ProfilePage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.router = app.router;
        
        // Component state
        this.loading = true;
        this.error = null;
        this.userId = null;
        this.isOwnProfile = false;
        this.profileData = null;
        this.userQuotes = [];
        this.followStatus = false;
        this.subscriptions = [];
        
        // Tab state for Variant 1
        this.activeTab = 'quotes'; // 'quotes' | 'followers' | 'following'
        this.followersData = [];
        this.followingData = [];
        
        /**
         * Cache for followers data indexed by userId
         * Prevents flickering/disappearing when switching between profiles
         * @type {Object<string, Array>}
         */
        this._followersByUserId = {};
        
        /**
         * Cache for following data indexed by userId
         * Prevents flickering/disappearing when switching between profiles
         * @type {Object<string, Array>}
         */
        this._followingByUserId = {};
        
        /**
         * Loading flag for followers data
         * Prevents flickering by showing spinner during load
         * @type {boolean}
         */
        this.loadingFollowers = false;
        
        /**
         * Loading flag for following data
         * Prevents flickering by showing spinner during load
         * @type {boolean}
         */
        this.loadingFollowing = false;
        
        /**
         * Request ID for followers API calls
         * Used to ignore stale responses from previous profile/tab switches
         * @type {number}
         */
        this._followersRequestId = 0;
        
        /**
         * Request ID for following API calls
         * Used to ignore stale responses from previous profile/tab switches
         * @type {number}
         */
        this._followingRequestId = 0;
        
        // Pagination state for quotes
        this.quotesOffset = 0;
        this.quotesLimit = 20;
        this.hasMoreQuotes = true;
        
        // Persistent username cache to prevent disappearing
        this.cachedUsername = null;
        
        // Follow status cache for user cards (userId -> boolean)
        this.followStatusCache = {};
        
        // isActive flag to guard against refresh during destroy
        this.isActive = false;
        
        console.log('✅ ProfilePage: Initialized');
    }
    
    /**
     * 🔄 Prefetch data before rendering
     */
    async prefetch() {
        console.log('🔄 ProfilePage: Prefetching data');
        
        try {
            // Get query parameters
            const query = this.app.initialState?.query || {};
            const userParam = query.user || 'me';
            const tabParam = query.tab || 'quotes';
            
            // Determine user ID
            if (userParam === 'me') {
                this.userId = this.state.getCurrentUserId();
                this.isOwnProfile = true;
            } else {
                this.userId = userParam;
                this.isOwnProfile = false;
            }
            
            // Set active tab from URL parameter
            if (['quotes', 'followers', 'following'].includes(tabParam)) {
                this.activeTab = tabParam;
            }
            
            console.log(`🔍 ProfilePage: Loading profile for ${this.isOwnProfile ? 'own profile' : 'user ' + this.userId}`);
            
            // Restore cached followers/following data for current userId before loading
            this.followersData = this._followersByUserId[this.userId] || [];
            this.followingData = this._followingByUserId[this.userId] || [];
            
            // Load profile data
            await this.loadProfileData();
            
            // Auto-load active tab if it's followers or following
            if (this.activeTab === 'followers') {
                console.log('🔄 ProfilePage: Auto-loading followers tab');
                await this.loadFollowers();
            } else if (this.activeTab === 'following') {
                console.log('🔄 ProfilePage: Auto-loading following tab');
                await this.loadFollowing();
            }
            
        } catch (error) {
            console.error('❌ ProfilePage: Prefetch error:', error);
            this.error = error.message;
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 📊 Load profile data from API
     */
    async loadProfileData() {
        try {
            // Load profile data
            const profileResponse = await this.api.getUserProfile(this.userId);
            this.profileData = profileResponse.user || profileResponse;
            
            // Cache username with strict priority: backend telegramUsername → state → Telegram initData
            // Never overwrite a non-empty cached username with an empty one
            const backendUsername = this.profileData?.telegramUsername;
            const stateUsername = this.state?.get?.('user.profile.username');
            const telegramUsername = this.telegram?.user?.username || 
                                   this.telegram?.webApp?.initDataUnsafe?.user?.username ||
                                   window?.Telegram?.WebApp?.initDataUnsafe?.user?.username;
            
            // Priority: backend → state → telegram, but never overwrite non-empty with empty
            if (backendUsername) {
                this.cachedUsername = backendUsername;
            } else if (!this.cachedUsername && stateUsername) {
                this.cachedUsername = stateUsername;
            } else if (!this.cachedUsername && telegramUsername) {
                this.cachedUsername = telegramUsername;
            }
            
            // If own profile, update state with username
            if (this.isOwnProfile && this.cachedUsername) {
                this.state.set('user.profile.username', this.cachedUsername);
            }
            
            // Load user's quotes with pagination
            await this.loadUserQuotes(this.quotesLimit, this.quotesOffset);
            
            // Load follow status for other users
            if (!this.isOwnProfile) {
                await this.loadFollowStatus();
            } else {
                // Load follow counts for own profile
                await this.loadFollowCounts();
            }
            
        } catch (error) {
            console.error('❌ ProfilePage: Error loading profile data:', error);
            throw error;
        }
    }
    
    /**
     * 🆔 Extract userId from user object with comprehensive fallback chain
     * UPDATED: Extended with fallbacks to followingId, followerId, and userId fields
     * @param {Object} user - User object (may be nested in f.user or direct)
     * @param {Object} [f] - Parent object containing user (fallback source)
     * @returns {string|null} userId or null
     */
    extractUserId(user, f = null) {
        if (!user && !f) return null;
        const u = user || f;
        
        // Priority: userId → id → _id → telegramId → followingId → followerId → f.userId
        return u.userId || 
               u.id || 
               u._id || 
               u.telegramId || 
               (f && f.followingId) || 
               (f && f.followerId) || 
               (f && f.userId) || 
               null;
    }
    
    /**
     * 📊 Load follow counts for own profile
     */
    async loadFollowCounts() {
        try {
            const counts = await this.api.getFollowCounts();
            if (this.profileData) {
                this.profileData.stats = {
                    ...this.profileData.stats,
                    followers: counts.followers || 0,
                    following: counts.following || 0
                };
            }
        } catch (error) {
            console.warn('⚠️ Could not load follow counts:', error);
        }
    }
    
    /**
     * 🗑️ Clear followers/following cache
     * Called on logout or when profile data is no longer valid
     * @param {string} [specificUserId] - Optional userId to clear cache for, if not provided clears all
     */
    clearFollowersCache(specificUserId = null) {
        if (specificUserId) {
            delete this._followersByUserId[specificUserId];
            delete this._followingByUserId[specificUserId];
            console.log(`🗑️ ProfilePage: Cleared cache for userId: ${specificUserId}`);
        } else {
            this._followersByUserId = {};
            this._followingByUserId = {};
            console.log('🗑️ ProfilePage: Cleared all followers/following cache');
        }
    }
    
    /**
     * 👥 Load followers list
     * UPDATED: Защита от гонок через requestId, не перезаписывает кэш пустыми ответами
     */
    async loadFollowers() {
        // Track previous data length to detect changes (outside try-catch for finally block access)
        const previousLength = this.followersData?.length || 0;
        
        try {
            // Increment request ID to invalidate previous requests
            this._followersRequestId++;
            const currentRequestId = this._followersRequestId;
            
            // Set loading flag but DON'T clear current data - show spinner over cached data
            this.loadingFollowers = true;
            
            // Use CSS loading state instead of full re-render
            if (this.activeTab === 'followers') {
                this._setTabLoading(true);
            }
            
            // ВАЖНО: Передаём userId профиля, который сейчас открыт
            console.log(`👥 [FOLLOWERS] Loading for userId: ${this.userId}, requestId: ${currentRequestId}`);
            
            const response = await this.api.getFollowers({ 
                limit: 50,
                userId: this.userId  // ← ИСПРАВЛЕНИЕ: явно передаём userId профиля
            });
            
            // ANTI-RACE: Check if this response is still valid (request ID hasn't changed)
            if (currentRequestId !== this._followersRequestId) {
                console.log(`⚠️ [FOLLOWERS] Ignoring stale response (requestId: ${currentRequestId}, current: ${this._followersRequestId})`);
                return;
            }
            
            console.log(`👥 [FOLLOWERS] Response received for userId: ${this.userId}`, response);
            
            // Backend returns { success: true, data: [...], total, limit, skip }
            const followers = response.data || response.followers || response || [];
            
            // Extract user data from followers with comprehensive userId normalization
            const processedFollowers = followers.map(f => {
                const user = f.user || f;
                return {
                    userId: this.extractUserId(user, f),
                    name: user.name || user.firstName || 'Читатель',
                    avatarUrl: user.avatarUrl || user.photoUrl,
                    bio: user.bio || '',
                    telegramUsername: user.telegramUsername || user.username,
                    ...user
                };
            });
            
            // CACHE PRESERVATION: Only update cache if new data is non-empty OR cache was empty
            const hadPreviousData = this._followersByUserId[this.userId] && this._followersByUserId[this.userId].length > 0;
            const hasNewData = processedFollowers.length > 0;
            
            if (hasNewData || !hadPreviousData) {
                // Update cache: either we got new data, or cache was empty anyway
                this._followersByUserId[this.userId] = processedFollowers;
                console.log(`✅ [FOLLOWERS] Cache updated: ${processedFollowers.length} followers for userId: ${this.userId}`);
            } else {
                // Don't overwrite non-empty cache with empty response
                console.log(`⚠️ [FOLLOWERS] Preserving cache: got empty response but cache has ${this._followersByUserId[this.userId].length} items`);
            }
            
            // Update current display data from cache
            this.followersData = this._followersByUserId[this.userId] || [];
            
        } catch (error) {
            console.warn('⚠️ Could not load followers:', error);
            // Keep cached data if available, otherwise empty array
            this.followersData = this._followersByUserId[this.userId] || [];
        } finally {
            // Track new data length to detect changes
            const newLength = this.followersData?.length || 0;
            
            // Always reset loading flag
            this.loadingFollowers = false;
            
            // Remove CSS loading state
            if (this.activeTab === 'followers') {
                this._setTabLoading(false);
                
                // Only refresh if data length changed
                if (newLength !== previousLength) {
                    this._scheduleTabRefresh();
                }
            }
        }
    }
    
    /**
     * 👤 Load following list
     * UPDATED: Защита от гонок через requestId, не перезаписывает кэш пустыми ответами
     */
    async loadFollowing() {
        // Track previous data length to detect changes (outside try-catch for finally block access)
        const previousLength = this.followingData?.length || 0;
        
        try {
            // Increment request ID to invalidate previous requests
            this._followingRequestId++;
            const currentRequestId = this._followingRequestId;
            
            // Set loading flag but DON'T clear current data - show spinner over cached data
            this.loadingFollowing = true;
            
            // Use CSS loading state instead of full re-render
            if (this.activeTab === 'following') {
                this._setTabLoading(true);
            }
            
            // ВАЖНО: Передаём userId профиля, который сейчас открыт
            console.log(`👤 [FOLLOWING] Loading for userId: ${this.userId}, requestId: ${currentRequestId}`);
            
            const response = await this.api.getFollowing({ 
                limit: 50,
                userId: this.userId  // ← ИСПРАВЛЕНИЕ: явно передаём userId профиля
            });
            
            // ANTI-RACE: Check if this response is still valid (request ID hasn't changed)
            if (currentRequestId !== this._followingRequestId) {
                console.log(`⚠️ [FOLLOWING] Ignoring stale response (requestId: ${currentRequestId}, current: ${this._followingRequestId})`);
                return;
            }
            
            console.log(`👤 [FOLLOWING] Response received for userId: ${this.userId}`, response);
            
            // Backend returns { success: true, data: [...], total, limit, skip }
            const following = response.data || response.following || response || [];
            
            // Extract user data from following with comprehensive userId normalization
            const processedFollowing = following.map(f => {
                const user = f.user || f;
                return {
                    userId: this.extractUserId(user, f),
                    name: user.name || user.firstName || 'Читатель',
                    avatarUrl: user.avatarUrl || user.photoUrl,
                    bio: user.bio || '',
                    telegramUsername: user.telegramUsername || user.username,
                    ...user
                };
            });
            
            // CACHE PRESERVATION: Only update cache if new data is non-empty OR cache was empty
            const hadPreviousData = this._followingByUserId[this.userId] && this._followingByUserId[this.userId].length > 0;
            const hasNewData = processedFollowing.length > 0;
            
            if (hasNewData || !hadPreviousData) {
                // Update cache: either we got new data, or cache was empty anyway
                this._followingByUserId[this.userId] = processedFollowing;
                console.log(`✅ [FOLLOWING] Cache updated: ${processedFollowing.length} following for userId: ${this.userId}`);
            } else {
                // Don't overwrite non-empty cache with empty response
                console.log(`⚠️ [FOLLOWING] Preserving cache: got empty response but cache has ${this._followingByUserId[this.userId].length} items`);
            }
            
            // Update current display data from cache
            this.followingData = this._followingByUserId[this.userId] || [];
            
        } catch (error) {
            console.warn('⚠️ Could not load following:', error);
            // Keep cached data if available, otherwise empty array
            this.followingData = this._followingByUserId[this.userId] || [];
        } finally {
            // Track new data length to detect changes
            const newLength = this.followingData?.length || 0;
            
            // Always reset loading flag
            this.loadingFollowing = false;
            
            // Remove CSS loading state
            if (this.activeTab === 'following') {
                this._setTabLoading(false);
                
                // Only refresh if data length changed
                if (newLength !== previousLength) {
                    this._scheduleTabRefresh();
                }
            }
        }
    }
    
    /**
     * 📚 Load user's quotes with pagination
     */
    async loadUserQuotes(limit = 20, offset = 0, append = false) {
        try {
            let response;
            let quotes = [];
            let paginationInfo = null;
            
            if (this.isOwnProfile) {
                // For own profile, use getQuotes with pagination
                response = await this.api.getQuotes({ limit, offset });
                quotes = response.quotes || [];
                paginationInfo = response.pagination;
            } else {
                // For other users, use public endpoint
                response = await this.api.getUserQuotes(this.userId, { limit, offset });
                quotes = response.items || response.quotes || response || [];
                paginationInfo = response.pagination;
            }
            
            // DON'T filter out quotes - keep all quotes, technical source labels are suppressed in renderQuoteCard
            // Update quotes array
            if (append) {
                this.userQuotes = [...this.userQuotes, ...quotes];
            } else {
                this.userQuotes = quotes;
            }
            
            // Update pagination state using API response
            if (paginationInfo && typeof paginationInfo.total === 'number') {
                // Use pagination.total from API response
                this.hasMoreQuotes = (offset + limit) < paginationInfo.total;
            } else {
                // Fallback to length heuristic if pagination info not available
                this.hasMoreQuotes = quotes.length === limit;
            }
            
            console.log(`✅ ProfilePage: Loaded ${quotes.length} quotes (offset: ${offset}, hasMore: ${this.hasMoreQuotes})`);
        } catch (error) {
            console.warn('⚠️ Could not load user quotes:', error);
            if (!append) {
                this.userQuotes = [];
            }
        }
    }
    
    /**
     * 👥 Load follow status for other user's profile
     */
    async loadFollowStatus() {
        try {
            const status = await this.api.getFollowStatus(this.userId);
            this.followStatus = status?.following || false;
        } catch (error) {
            console.warn('⚠️ Could not load follow status:', error);
            this.followStatus = false;
        }
    }
    
    /**
     * 🎨 Render page HTML
     */
    render() {
        if (this.loading) {
            return this.renderLoading();
        }
        
        if (this.error) {
            return this.renderError();
        }
        
        return `
            <div class="content profile-page" id="profilePageRoot">
                ${this.renderProfileCard()}
                ${this.renderStatistics()}
                ${this.renderTabContent()}
            </div>
        `;
    }
    
    /**
     * 👤 Render profile card
     */
    renderProfileCard() {
        const profile = this.profileData || {};
        const name = profile.name || profile.firstName || 'Пользователь';
        const bio = profile.bio || '';
        
        // Get username with strict priority: cachedUsername → backend → state → Telegram initData
        // Never display empty username, always use the cached non-empty value
        let username = this.cachedUsername || profile.telegramUsername;
        if (!username && this.isOwnProfile) {
            // Try state first, then Telegram initData as fallback
            const stateUsername = this.state?.get?.('user.profile.username');
            const telegramUsername = this.telegram?.user?.username || 
                                   this.telegram?.webApp?.initDataUnsafe?.user?.username ||
                                   window?.Telegram?.WebApp?.initDataUnsafe?.user?.username;
            username = stateUsername || telegramUsername;
            
            // Cache it for future renders if found
            if (username && !this.cachedUsername) {
                this.cachedUsername = username;
            }
        }
        const formattedUsername = username ? `@${username}` : '';
        
        const avatarUrl = this.resolveAvatarUrl();
        const initials = this.getInitials(name);
        
        return `
            <div class="profile-card">
                <div class="profile-avatar-container">
                    ${avatarUrl ? `
                        <img class="profile-avatar-img" src="${avatarUrl}" alt="${name}" 
                             onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)" />
                    ` : ''}
                    <div class="profile-avatar-fallback">${initials}</div>
                </div>
                
                <h2 class="profile-name">${name}</h2>
                ${formattedUsername ? `<p class="profile-username">${formattedUsername}</p>` : ''}
                
                ${bio ? `<p class="profile-bio">${bio}</p>` : ''}
                
                ${!this.isOwnProfile ? `
                    <button class="follow-btn-large ${this.followStatus ? 'following' : ''}" 
                            data-action="toggle-follow" data-user-id="${this.userId}">
                        ${this.followStatus ? 'Отписаться' : 'Подписаться'}
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * 📊 Render statistics section
     * UPDATED: Added data-stat attributes for targeted DOM updates
     */
    renderStatistics() {
        const stats = this.profileData?.stats || {};
        const totalQuotes = stats.totalQuotes || 0;
        const followers = stats.followers || 0;
        const following = stats.following || 0;
        
        return `
            <div class="profile-statistics">
                <div class="stat-item ${this.activeTab === 'quotes' ? 'active' : ''}" data-action="switch-tab" data-tab="quotes" data-stat="quotes">
                    <div class="stat-value">${totalQuotes}</div>
                    <div class="stat-label">Цитат</div>
                </div>
                <div class="stat-item ${this.activeTab === 'followers' ? 'active' : ''}" data-action="switch-tab" data-tab="followers" data-stat="followers">
                    <div class="stat-value">${followers}</div>
                    <div class="stat-label">Подписчиков</div>
                </div>
                <div class="stat-item ${this.activeTab === 'following' ? 'active' : ''}" data-action="switch-tab" data-tab="following" data-stat="following">
                    <div class="stat-value">${following}</div>
                    <div class="stat-label">Подписок</div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🔄 Schedule tab content refresh with debouncing
     * Only refreshes when data length changes to prevent unnecessary re-renders
     * @private
     */
    _scheduleTabRefresh() {
        // Clear any existing debounce timer
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        
        // Debounce refresh by 50ms to prevent multiple rapid updates
        this._refreshTimer = setTimeout(() => {
            this._refreshTabContentNow();
            this._refreshTimer = null;
        }, 50);
    }
    
    /**
     * 🔄 Refresh tab content safely without full page re-render
     * UPDATED: Performs targeted DOM updates instead of replacing entire container
     * Updates only the tab content area to prevent flickering
     * @private
     */
    _refreshTabContentNow() {
        // Diagnostic logging to track updates
        console.log('[PROFILE_REFRESH] _refreshTabContentNow called:', {
            activeTab: this.activeTab,
            followersLength: this.followersData?.length || 0,
            followingLength: this.followingData?.length || 0,
            quotesLength: this.userQuotes?.length || 0,
            loadingFollowers: this.loadingFollowers,
            loadingFollowing: this.loadingFollowing,
            userId: this.userId
        });
        
        const root = document.getElementById('profilePageRoot');
        if (!root) return;
        
        const tabContent = root.querySelector('.profile-tab-content');
        if (!tabContent) return;
        
        // ✅ TARGETED UPDATE: Update only inner content, keep stable container
        if (this.activeTab === 'followers' || this.activeTab === 'following') {
            console.log(`[PROFILE_REFRESH] Updating ${this.activeTab} tab - targeted update to .users-list innerHTML only`);
            
            // Update users list for followers/following tabs
            const usersList = tabContent.querySelector('.users-list');
            const emptyState = tabContent.querySelector('.empty-state');
            
            const data = this.activeTab === 'followers' ? this.followersData : this.followingData;
            
            if (data && data.length > 0) {
                // Update users list HTML
                const usersHTML = data.map(user => this.renderUserCard(user)).join('');
                
                if (usersList) {
                    usersList.innerHTML = usersHTML;
                    console.log(`[PROFILE_REFRESH] Updated .users-list innerHTML with ${data.length} users - NO container rebuild`);
                } else {
                    // Create users list if it doesn't exist
                    const newUsersList = document.createElement('div');
                    newUsersList.className = 'users-list';
                    newUsersList.innerHTML = usersHTML;
                    tabContent.innerHTML = '';
                    tabContent.appendChild(newUsersList);
                    console.log(`[PROFILE_REFRESH] Created new .users-list with ${data.length} users`);
                }
                
                // Hide empty state if present
                if (emptyState) {
                    emptyState.style.display = 'none';
                }
            } else {
                console.log(`[PROFILE_REFRESH] Showing empty state for ${this.activeTab}`);
                // Show empty state
                const emptyStateHTML = `<div class="empty-state"><p>Пока нет ${this.activeTab === 'followers' ? 'подписчиков' : 'подписок'}</p></div>`;
                
                if (emptyState) {
                    emptyState.style.display = 'block';
                } else {
                    tabContent.innerHTML = emptyStateHTML;
                }
                
                // Hide users list if present
                if (usersList) {
                    usersList.style.display = 'none';
                }
            }
            
        } else if (this.activeTab === 'quotes') {
            console.log(`[PROFILE_REFRESH] Updating quotes tab - targeted update to .quotes-list innerHTML only`);
            
            // Update quotes list for quotes tab
            const quotesList = tabContent.querySelector('.quotes-list');
            const loadMoreContainer = tabContent.querySelector('.load-more-container');
            const emptyState = tabContent.querySelector('.empty-state');
            
            if (this.userQuotes && this.userQuotes.length > 0) {
                // Update quotes list HTML
                const quotesHTML = this.userQuotes.map(quote => this.renderQuoteCard(quote)).join('');
                
                if (quotesList) {
                    quotesList.innerHTML = quotesHTML;
                    console.log(`[PROFILE_REFRESH] Updated .quotes-list innerHTML with ${this.userQuotes.length} quotes - NO container rebuild`);
                } else {
                    // Create quotes list if it doesn't exist
                    const newQuotesList = document.createElement('div');
                    newQuotesList.className = 'quotes-list';
                    newQuotesList.innerHTML = quotesHTML;
                    
                    // Insert at beginning of tabContent
                    if (tabContent.firstChild) {
                        tabContent.insertBefore(newQuotesList, tabContent.firstChild);
                    } else {
                        tabContent.appendChild(newQuotesList);
                    }
                    console.log(`[PROFILE_REFRESH] Created new .quotes-list with ${this.userQuotes.length} quotes`);
                }
                
                // Update or create load-more button
                if (this.hasMoreQuotes) {
                    const loadMoreHTML = `
                        <div class="load-more-container">
                            <button class="btn-secondary load-more-btn" data-action="load-more-quotes">
                                Загрузить ещё
                            </button>
                        </div>
                    `;
                    
                    if (loadMoreContainer) {
                        loadMoreContainer.outerHTML = loadMoreHTML;
                    } else {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = loadMoreHTML;
                        tabContent.appendChild(tempDiv.firstElementChild);
                    }
                    
                    // Re-attach event listener for load-more button
                    const newLoadMoreBtn = tabContent.querySelector('[data-action="load-more-quotes"]');
                    if (newLoadMoreBtn) {
                        newLoadMoreBtn.addEventListener('click', (e) => this.handleLoadMoreQuotes(e));
                    }
                } else if (loadMoreContainer) {
                    // Remove load-more button if no more quotes
                    loadMoreContainer.remove();
                }
                
                // Hide empty state if present
                if (emptyState) {
                    emptyState.style.display = 'none';
                }
            } else {
                console.log(`[PROFILE_REFRESH] Showing empty state for quotes`);
                // Show empty state
                const emptyStateHTML = `<div class="empty-state"><p>Пока нет цитат</p></div>`;
                
                if (emptyState) {
                    emptyState.style.display = 'block';
                } else {
                    tabContent.innerHTML = emptyStateHTML;
                }
                
                // Hide quotes list and load-more if present
                if (quotesList) {
                    quotesList.style.display = 'none';
                }
                if (loadMoreContainer) {
                    loadMoreContainer.style.display = 'none';
                }
            }
        }
    }
    
    /**
     * 🔄 Refresh tab content safely without full page re-render (legacy wrapper)
     * Kept for backward compatibility with existing code that may call this method directly
     * New code should use _scheduleTabRefresh() for debounced updates
     * Updates only the tab content area to prevent flickering
     */
    refreshTabContent() {
        this._scheduleTabRefresh();
    }
    
    /**
     * 🔄 Set tab loading state with CSS class instead of rebuilding content
     * Shows/hides overlay spinner without full DOM rebuild
     * @param {boolean} isLoading - Whether the tab is loading
     * @private
     */
    _setTabLoading(isLoading) {
        const root = document.getElementById('profilePageRoot');
        if (!root) return;
        
        const tabContent = root.querySelector('.profile-tab-content');
        if (!tabContent) return;
        
        if (isLoading) {
            tabContent.classList.add('loading');
        } else {
            tabContent.classList.remove('loading');
        }
    }
    
    /**
     * 🔄 Update displayed username without full card rebuild
     * Only updates the username element to prevent flicker
     * @param {string} newUsername - The new username to display
     * @private
     */
    _updateDisplayedUsername(newUsername) {
        const root = document.getElementById('profilePageRoot');
        if (!root) return;
        
        const profileCard = root.querySelector('.profile-card');
        if (!profileCard) return;
        
        // Find or create username element
        let usernameElement = profileCard.querySelector('.profile-username');
        const formattedUsername = newUsername ? `@${newUsername}` : '';
        
        if (formattedUsername) {
            if (!usernameElement) {
                // Create username element if it doesn't exist
                usernameElement = document.createElement('p');
                usernameElement.className = 'profile-username';
                
                // Insert after profile-name
                const nameElement = profileCard.querySelector('.profile-name');
                if (nameElement && nameElement.nextSibling) {
                    nameElement.parentNode.insertBefore(usernameElement, nameElement.nextSibling);
                } else if (nameElement) {
                    nameElement.parentNode.appendChild(usernameElement);
                }
            }
            
            // Update text content
            usernameElement.textContent = formattedUsername;
            usernameElement.style.display = '';
        } else if (usernameElement) {
            // Hide username element if no username
            usernameElement.style.display = 'none';
        }
    }
    
    /**
     * 🔢 Update followers count in DOM without full rebuild
     * Optimistic update for real-time follow sync
     * @param {number} newCount - The new followers count
     * @private
     */
    _updateFollowersCount(newCount) {
        const root = document.getElementById('profilePageRoot');
        if (!root) return;
        
        // Find followers stat element by data-stat attribute or class
        const followersStatValue = root.querySelector('[data-stat="followers"] .stat-value, .stat-followers .stat-value');
        if (followersStatValue) {
            followersStatValue.textContent = newCount;
            console.log(`[FOLLOW_SYNC] ProfilePage._updateFollowersCount: Updated DOM to ${newCount}`);
        } else {
            console.warn(`[FOLLOW_SYNC] ProfilePage._updateFollowersCount: Could not find followers stat element`);
        }
    }
    
    /**
     * 📑 Render tab content based on active tab
     */
    renderTabContent() {
        switch (this.activeTab) {
            case 'quotes':
                return this.renderQuotesTab();
            case 'followers':
                return this.renderFollowersTab();
            case 'following':
                return this.renderFollowingTab();
            default:
                return this.renderQuotesTab();
        }
    }
    
    /**
     * 📚 Render quotes tab
     */
    renderQuotesTab() {
        if (!this.userQuotes || this.userQuotes.length === 0) {
            return `
                <div class="profile-tab-content">
                    <div class="empty-state">
                        <p>Пока нет цитат</p>
                    </div>
                </div>
            `;
        }
        
        const quotesHTML = this.userQuotes.map(quote => this.renderQuoteCard(quote)).join('');
        
        return `
            <div class="profile-tab-content">
                <div class="quotes-list">
                    ${quotesHTML}
                </div>
                ${this.hasMoreQuotes ? `
                    <div class="load-more-container">
                        <button class="btn-secondary load-more-btn" data-action="load-more-quotes">
                            Загрузить ещё
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * 👥 Render followers tab with stable container structure
     * Container persists across updates to prevent flicker
     */
    renderFollowersTab() {
        // Always render stable container structure
        // Loading state and content updates are handled by CSS and targeted DOM updates
        const followersHTML = this.followersData && this.followersData.length > 0
            ? this.followersData.map(user => this.renderUserCard(user)).join('')
            : '';
        
        const hasData = this.followersData && this.followersData.length > 0;
        
        return `
            <div class="profile-tab-content">
                <div class="users-list" style="${hasData ? '' : 'display: none;'}">
                    ${followersHTML}
                </div>
                <div class="empty-state" style="${hasData ? 'display: none;' : ''}">
                    <p>Пока нет подписчиков</p>
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Render following tab with stable container structure
     * Container persists across updates to prevent flicker
     */
    renderFollowingTab() {
        // Always render stable container structure
        // Loading state and content updates are handled by CSS and targeted DOM updates
        const followingHTML = this.followingData && this.followingData.length > 0
            ? this.followingData.map(user => this.renderUserCard(user)).join('')
            : '';
        
        const hasData = this.followingData && this.followingData.length > 0;
        
        return `
            <div class="profile-tab-content">
                <div class="users-list" style="${hasData ? '' : 'display: none;'}">
                    ${followingHTML}
                </div>
                <div class="empty-state" style="${hasData ? 'display: none;' : ''}">
                    <p>Пока нет подписок</p>
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Render user card for followers/following lists
     * UPDATED: Includes data-action="navigate-to-profile" and fallback data attributes
     */
    renderUserCard(user) {
        const name = user.name || user.firstName || 'Пользователь';
        const avatarUrl = user.avatarUrl || user.photoUrl || null;
        const initials = this.getInitials(name);
        const bio = user.bio || '';
        const username = user.telegramUsername || user.username;
        const formattedUsername = username ? `@${username}` : '';
        const userId = this.extractUserId(user);
        
        // Extract additional fallback IDs for navigation reliability
        const followingId = user.followingId || '';
        const followerId = user.followerId || '';
        
        // Get follow status for this user (we'll need to track this)
        const isFollowing = this.followStatusCache?.[userId] || false;
        
        return `
            <div class="user-card" 
                 data-user-id="${userId || ''}" 
                 data-following-id="${followingId}"
                 data-follower-id="${followerId}"
                 data-is-following="${isFollowing}"
                 data-action="navigate-to-profile">
                <div class="user-avatar-container">
                    ${avatarUrl ? `
                        <img class="user-avatar-img" src="${avatarUrl}" alt="${name}" 
                             onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)" />
                    ` : ''}
                    <div class="user-avatar-fallback">${initials}</div>
                </div>
                <div class="user-info">
                    <div class="user-name">${name}</div>
                    ${formattedUsername ? `<div class="user-username">${formattedUsername}</div>` : ''}
                    ${bio ? `<div class="user-bio">${bio}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * 📚 Render recent quotes section (LEGACY - kept for compatibility)
     */
    renderRecentQuotes() {
        if (!this.userQuotes || this.userQuotes.length === 0) {
            return `
                <div class="recent-quotes-section">
                    <h3 class="section-title">Последние цитаты</h3>
                    <div class="empty-state">
                        <p>Пока нет цитат</p>
                    </div>
                </div>
            `;
        }
        
        const quotesHTML = this.userQuotes.map(quote => this.renderQuoteCard(quote)).join('');
        
        return `
            <div class="recent-quotes-section">
                <h3 class="section-title">Последние цитаты</h3>
                <div class="quotes-list">
                    ${quotesHTML}
                </div>
            </div>
        `;
    }
    
    /**
     * 💬 Render single quote card
     */
    renderQuoteCard(quote) {
        // Filter out technical sources
        const technicalSources = ['mini_app', 'test_script', 'test_sctript', 'web', 'api'];
        const shouldShowSource = quote.source && !technicalSources.includes(quote.source.toLowerCase().trim());
        
        return `
            <div class="quote-card" data-quote-id="${quote.id}">
                <blockquote class="quote-text">${quote.text}</blockquote>
                ${quote.author ? `<cite class="quote-author">— ${quote.author}</cite>` : ''}
                ${shouldShowSource ? `<div class="quote-source">${quote.source}</div>` : ''}
            </div>
        `;
    }
    
    /**
     * ⏳ Render loading state
     */
    renderLoading() {
        return `
            <div class="content profile-page loading">
                <div class="loading-spinner-container">
                    <div class="loading-spinner"></div>
                    <p>Загрузка профиля...</p>
                </div>
            </div>
        `;
    }
    
    /**
     * ❌ Render error state
     */
    renderError() {
        return `
            <div class="content profile-page error">
                <div class="error-container">
                    <h2>⚠️ Ошибка загрузки профиля</h2>
                    <p>${this.error}</p>
                    <button class="btn-primary" data-action="retry">
                        🔄 Попробовать снова
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 🔗 Attach event listeners
     */
    attachEventListeners() {
        const root = document.getElementById('profilePageRoot');
        if (!root) return;
        
        // Back button
        const backButton = root.querySelector('[data-action="back"]');
        if (backButton) {
            backButton.addEventListener('click', () => this.handleBack());
        }
        
        // Edit profile button
        const editButton = root.querySelector('[data-action="edit-profile"]');
        if (editButton) {
            editButton.addEventListener('click', () => this.handleEditProfile());
        }
        
        // Follow/Unfollow button
        const followButton = root.querySelector('[data-action="toggle-follow"]');
        if (followButton) {
            followButton.addEventListener('click', (e) => this.handleToggleFollow(e));
        }
        
        // Retry button
        const retryButton = root.querySelector('[data-action="retry"]');
        if (retryButton) {
            retryButton.addEventListener('click', () => this.handleRetry());
        }
        
        // Tab switching buttons
        const tabButtons = root.querySelectorAll('[data-action="switch-tab"]');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => this.handleTabSwitch(e));
        });
        
        // Load more quotes button
        const loadMoreBtn = root.querySelector('[data-action="load-more-quotes"]');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', (e) => this.handleLoadMoreQuotes(e));
        }
        
        // User card clicks (for followers/following)
        const userCards = root.querySelectorAll('[data-action="navigate-to-profile"]');
        userCards.forEach(card => {
            card.addEventListener('click', (e) => this.handleUserCardClick(e));
        });
        
        console.log('✅ ProfilePage: Event listeners attached');
    }
    
    /**
     * ⬅️ Handle back button
     */
    handleBack() {
        if (this.router && typeof this.router.goBack === 'function') {
            this.router.goBack();
        } else {
            window.history.back();
        }
    }
    
    /**
     * ✏️ Handle edit profile
     */
    handleEditProfile() {
        // Navigate to settings page
        if (this.router && typeof this.router.navigate === 'function') {
            this.router.navigate('/settings');
        } else {
            window.location.hash = '/settings';
        }
    }
    
    /**
     * 👥 Handle follow/unfollow toggle
     * UPDATED: Relies solely on ApiService events for state sync, no manual button updates
     */
    async handleToggleFollow(event) {
        const button = event.currentTarget;
        if (button.disabled) return;
        
        button.disabled = true;
        
        try {
            console.log(`[FOLLOW_SYNC] ProfilePage.handleToggleFollow: current followStatus=${this.followStatus}, userId=${this.userId}`);
            
            if (this.followStatus) {
                // Unfollow - ApiService will handle state update and event dispatch
                await this.api.unfollowUser(this.userId);
                console.log(`[FOLLOW_SYNC] ProfilePage.handleToggleFollow: unfollowed user ${this.userId}`);
            } else {
                // Follow - ApiService will handle state update and event dispatch
                await this.api.followUser(this.userId);
                console.log(`[FOLLOW_SYNC] ProfilePage.handleToggleFollow: followed user ${this.userId}`);
            }
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
            // Note: No need to manually update button or call broadcastFollowStateChange
            // ApiService already updates appState and dispatches follow:changed event
            // which will trigger our followChangedHandler to update the UI
            
        } catch (error) {
            console.error('❌ ProfilePage: Error toggling follow status:', error);
            if (this.telegram?.showAlert) {
                this.telegram.showAlert('Ошибка при изменении подписки');
            }
        } finally {
            button.disabled = false;
        }
    }
    
    /**
     * 📢 Broadcast follow state change to other components
     * UPDATED: Only dispatches canonical follow:changed event (legacy bridge handled by receivers)
     */
    broadcastFollowStateChange(userId, following) {
        // ✅ Update centralized follow state
        if (window.appState?.setFollowStatus) {
            window.appState.setFollowStatus(userId, following);
        }
        
        // ✅ Dispatch only canonical follow:changed event
        const followChangedEvent = new CustomEvent('follow:changed', {
            detail: { userId, following }
        });
        window.dispatchEvent(followChangedEvent);
        
        // Also update ProfileModal if available
        if (this.app?.profileModal) {
            this.app.profileModal.updateFollowStatus(userId, following);
        }
        
        // Also update CommunityPage if available
        if (window.communityPage && typeof window.communityPage.refreshFollowStatus === 'function') {
            window.communityPage.refreshFollowStatus(userId, following);
        }
    }
    
    /**
     * 🔄 Handle retry
     */
    async handleRetry() {
        this.loading = true;
        this.error = null;
        
        // Re-render with loading state
        const root = document.getElementById('profilePageRoot');
        if (root) {
            root.innerHTML = this.renderLoading();
        }
        
        // Retry loading
        await this.prefetch();
        
        // Re-render with new data
        if (root) {
            root.innerHTML = this.render();
            this.attachEventListeners();
        }
    }
    
    /**
     * 🔄 Handle tab switch
     * UPDATED: Uses _setTabLoading() for CSS overlay instead of full re-render at start
     */
    async handleTabSwitch(event) {
        const button = event.currentTarget;
        const newTab = button.dataset.tab;
        
        if (this.activeTab === newTab) {
            return; // Already on this tab
        }
        
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // Update active tab
        this.activeTab = newTab;
        
        // Update URL query parameter
        if (this.router && typeof this.router.navigate === 'function') {
            const userParam = this.isOwnProfile ? 'me' : this.userId;
            this.router.navigate(`/profile?user=${userParam}&tab=${newTab}`, { replace: true });
        }
        
        // Load data for the tab if not cached yet
        if (newTab === 'followers') {
            // Check cache first, only load if not cached
            if (!this._followersByUserId[this.userId] || this._followersByUserId[this.userId].length === 0) {
                // Set loading flag with CSS overlay ONLY, no full re-render
                this.loadingFollowers = true;
                this._setTabLoading(true);
                
                // Load data (will call _setTabLoading(false) and conditionally refresh in loadFollowers)
                await this.loadFollowers();
            } else {
                // Use cached data
                this.followersData = this._followersByUserId[this.userId];
                console.log(`📦 ProfilePage: Using cached followers (${this.followersData.length}) for userId: ${this.userId}`);
            }
        } else if (newTab === 'following') {
            // Check cache first, only load if not cached
            if (!this._followingByUserId[this.userId] || this._followingByUserId[this.userId].length === 0) {
                // Set loading flag with CSS overlay ONLY, no full re-render
                this.loadingFollowing = true;
                this._setTabLoading(true);
                
                // Load data (will call _setTabLoading(false) and conditionally refresh in loadFollowing)
                await this.loadFollowing();
            } else {
                // Use cached data
                this.followingData = this._followingByUserId[this.userId];
                console.log(`📦 ProfilePage: Using cached following (${this.followingData.length}) for userId: ${this.userId}`);
            }
        }
        // Note: Don't reload quotes when switching to quotes tab - use existing data
        
        // Update UI efficiently - only update the changed parts
        const root = document.getElementById('profilePageRoot');
        if (root) {
            // Update active state on stat items
            const statItems = root.querySelectorAll('.stat-item');
            statItems.forEach(item => {
                const tab = item.dataset.tab;
                if (tab === newTab) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
            
            // Use refreshTabContent for safe re-render
            this.refreshTabContent();
        }
    }
    
    /**
     * 🔗 Attach event listeners for tab content
     * UPDATED: Simplified to only attach load more button listener
     * User card navigation is handled by delegated handler in onShow()
     */
    attachTabContentEventListeners(container) {
        // Re-attach load more button
        const loadMoreBtn = container.querySelector('[data-action="load-more-quotes"]');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', (e) => this.handleLoadMoreQuotes(e));
        }
    }
    
    /**
     * 📚 Handle load more quotes
     */
    async handleLoadMoreQuotes(event) {
        const button = event.currentTarget;
        if (button.disabled) return;
        
        button.disabled = true;
        button.textContent = 'Загрузка...';
        
        try {
            // Increment offset
            this.quotesOffset += this.quotesLimit;
            
            // Load more quotes
            await this.loadUserQuotes(this.quotesLimit, this.quotesOffset, true);
            
            // Re-render the quotes tab
            const root = document.getElementById('profilePageRoot');
            if (root) {
                const tabContent = root.querySelector('.profile-tab-content');
                if (tabContent) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this.renderTabContent();
                    const newContent = tempDiv.firstElementChild;
                    
                    if (newContent && tabContent.parentNode) {
                        tabContent.parentNode.replaceChild(newContent, tabContent);
                        
                        // Re-attach event listeners
                        this.attachTabContentEventListeners(newContent);
                    }
                }
            }
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
        } catch (error) {
            console.error('❌ ProfilePage: Error loading more quotes:', error);
            if (this.telegram?.showAlert) {
                this.telegram.showAlert('Ошибка при загрузке цитат');
            }
            
            // Restore button state
            button.textContent = 'Загрузить ещё';
        } finally {
            button.disabled = false;
        }
    }
    
    /**
     * 👤 Handle user card click
     */
    handleUserCardClick(event) {
        const card = event.currentTarget;
        const userId = card.dataset.userId;
        
        if (!userId) return;
        
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // Navigate to user's profile
        if (this.router && typeof this.router.navigate === 'function') {
            this.router.navigate(`/profile?user=${userId}`);
        } else {
            window.location.hash = `/profile?user=${userId}`;
        }
    }
    
    /**
     * 🖼️ Resolve avatar URL
     */
    resolveAvatarUrl() {
        if (this.app && typeof this.app.resolveAvatar === 'function') {
            return this.app.resolveAvatar(this.profileData);
        }
        
        // Fallback resolution
        const profile = this.profileData || {};
        return profile.avatarUrl || profile.photoUrl || null;
    }
    
    /**
     * 🔤 Get user initials
     */
    getInitials(name) {
        if (!name) return '?';
        const words = name.trim().split(' ').filter(w => w.length > 0);
        if (words.length === 0) return '?';
        if (words.length === 1) return (words[0][0] || '?').toUpperCase();
        return `${(words[0][0] || '').toUpperCase()}${(words[1][0] || '').toUpperCase()}`;
    }
    
    
    /**
     * 🎯 Called when page is shown
     */
    async onShow() {
        console.log('👁️ ProfilePage: onShow');
        
        // Refresh username from all sources on every show to prevent disappearing
        if (this.isOwnProfile) {
            const backendUsername = this.profileData?.telegramUsername;
            const stateUsername = this.state?.get?.('user.profile.username');
            const telegramUsername = this.telegram?.user?.username || 
                                   this.telegram?.webApp?.initDataUnsafe?.user?.username ||
                                   window?.Telegram?.WebApp?.initDataUnsafe?.user?.username;
            
            // Update cached username with priority: backend → state → telegram
            // Only update if we find a non-empty value
            const newUsername = backendUsername || stateUsername || telegramUsername;
            
            if (newUsername && newUsername !== this.cachedUsername) {
                console.log(`🔄 ProfilePage: Username updated: ${this.cachedUsername} → ${newUsername}`);
                this.cachedUsername = newUsername;
                
                // Update state for consistency
                if (this.cachedUsername) {
                    this.state.set('user.profile.username', this.cachedUsername);
                }
                
                // Use targeted update instead of outerHTML replacement
                this._updateDisplayedUsername(this.cachedUsername);
            }
        }
        
        // Add delegated click handler for user cards
        const root = document.getElementById('profilePageRoot');
        if (root) {
            // Remove any existing handler to prevent duplicates
            if (this._userCardClickHandler) {
                root.removeEventListener('click', this._userCardClickHandler);
            }
            
            // Create and store handler
            this._userCardClickHandler = (e) => {
                // Find closest user-card or follow-list-item element
                const card = e.target.closest('.user-card[data-user-id], .follow-list-item[data-user-id]');
                if (card) {
                    // Ignore clicks on buttons inside the card
                    if (e.target.closest('button')) {
                        return;
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Extract userId with fallback chain
                    const userId = card.dataset.userId || 
                                  card.dataset.followingId ||
                                  card.dataset.followerId;
                    
                    if (!userId) {
                        console.warn('⚠️ [USER-CARD] No userId found on card', card);
                        return;
                    }
                    
                    console.log(`🔗 [USER-CARD] Navigating to profile: ${userId}`);
                    
                    // Haptic feedback
                    if (this.telegram?.hapticFeedback) {
                        this.telegram.hapticFeedback('light');
                    }
                    
                    // Navigate to user's profile
                    if (this.router && typeof this.router.navigate === 'function') {
                        this.router.navigate(`/profile?user=${userId}`);
                    } else {
                        window.location.hash = `/profile?user=${userId}`;
                    }
                }
            };
            
            // Attach delegated handler
            root.addEventListener('click', this._userCardClickHandler);
        }
        
        // ✅ Initialize follow status from centralized state
        if (!this.isOwnProfile && window.appState?.getFollowStatus) {
            const cachedStatus = window.appState.getFollowStatus(this.userId);
            if (cachedStatus !== null) {
                this.followStatus = cachedStatus;
                console.log(`[FOLLOW_SYNC] ProfilePage.onShow: Initialized follow status from appState: ${cachedStatus} for userId=${this.userId}`);
            }
        }
        
        // Mark component as active
        this.isActive = true;
        
        // Update Telegram BackButton visibility
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.show();
        }
        
        // ✅ Bridge legacy followStateChanged to canonical follow:changed
        this.followStateChangedBridge = (event) => {
            const { userId, following } = event.detail;
            console.log(`[FOLLOW_SYNC] ProfilePage: Bridging followStateChanged to follow:changed for userId=${userId}`);
            // Re-dispatch as canonical event
            window.dispatchEvent(new CustomEvent('follow:changed', {
                detail: { userId, following }
            }));
        };
        window.addEventListener('followStateChanged', this.followStateChangedBridge);
        
        // ✅ Subscribe to canonical follow:changed event for real-time sync
        this.followChangedHandler = (event) => {
            const { userId, following } = event.detail;
            console.log(`[FOLLOW_SYNC] ProfilePage: Received follow:changed event for userId=${userId}, following=${following}, isActive=${this.isActive}`);
            
            // Guard against updates during destroy
            if (!this.isActive) {
                console.log(`[FOLLOW_SYNC] ProfilePage: Ignoring follow:changed - component not active`);
                return;
            }
            
            if (String(userId) === String(this.userId)) {
                console.log(`[FOLLOW_SYNC] ProfilePage: Updating follow status to ${following} for current profile userId=${this.userId}`);
                this.followStatus = following;
                this.updateFollowButton(following);
                
                // Optimistically update followers count if not own profile
                if (!this.isOwnProfile && this.profileData?.stats) {
                    const delta = following ? 1 : -1;
                    const currentCount = this.profileData.stats.followers || 0;
                    const newCount = Math.max(0, currentCount + delta);
                    this.profileData.stats.followers = newCount;
                    
                    // Update count in DOM
                    this._updateFollowersCount(newCount);
                    console.log(`[FOLLOW_SYNC] ProfilePage: Optimistically updated followers count to ${newCount} (delta=${delta})`);
                }
            }
        };
        window.addEventListener('follow:changed', this.followChangedHandler);
    }
    
    /**
     * 👋 Called when page is hidden
     */
    onHide() {
        console.log('👋 ProfilePage: onHide');
        
        // Mark component as inactive to guard against stale updates
        this.isActive = false;
        
        // Clear debounce timer to prevent memory leaks
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
        
        // Remove delegated click handler for user cards
        const root = document.getElementById('profilePageRoot');
        if (root && this._userCardClickHandler) {
            root.removeEventListener('click', this._userCardClickHandler);
            this._userCardClickHandler = null;
        }
        
        // Hide Telegram BackButton
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.hide();
        }
        
        // Remove follow state change listeners
        if (this.followStateChangedBridge) {
            window.removeEventListener('followStateChanged', this.followStateChangedBridge);
            this.followStateChangedBridge = null;
        }
        
        // ✅ Remove new follow:changed event listener
        if (this.followChangedHandler) {
            window.removeEventListener('follow:changed', this.followChangedHandler);
            this.followChangedHandler = null;
        }
    }
    
    /**
     * 🔄 Update follow button UI
     * UPDATED: Specifically targets .follow-btn-large for ProfilePage
     */
    updateFollowButton(following) {
        // Target the large follow button in profile card
        const followBtn = document.querySelector('.follow-btn-large[data-action="toggle-follow"]');
        if (followBtn) {
            followBtn.textContent = following ? 'Отписаться' : 'Подписаться';
            if (following) {
                followBtn.classList.add('following');
            } else {
                followBtn.classList.remove('following');
            }
        }
    }
    
    /**
     * 🧹 Cleanup
     */
    destroy() {
        // Clear debounce timer
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
        
        // Remove click handler if still attached
        const root = document.getElementById('profilePageRoot');
        if (root && this._userCardClickHandler) {
            root.removeEventListener('click', this._userCardClickHandler);
            this._userCardClickHandler = null;
        }
        
        // Unsubscribe from state changes
        this.subscriptions.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this.subscriptions = [];
        
        console.log('🧹 ProfilePage: Destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfilePage;
} else {
    window.ProfilePage = ProfilePage;
}
