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
        
        // Pagination state for quotes
        this.quotesOffset = 0;
        this.quotesLimit = 20;
        this.hasMoreQuotes = true;
        
        // Persistent username cache to prevent disappearing
        this.cachedUsername = null;
        
        // Follow status cache for user cards (userId -> boolean)
        this.followStatusCache = {};
        
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
     * @param {Object} user - User object (may be nested in f.user or direct)
     * @param {Object} [f] - Parent object containing user
     * @returns {string|null} userId or null
     */
    extractUserId(user, f = null) {
        if (!user && !f) return null;
        const u = user || f;
        return u.userId || u.id || u._id || u.telegramId || null;
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
     * UPDATED: Теперь явно передаёт userId профиля в API запрос с loading флагами
     */
    async loadFollowers() {
        try {
            // Set loading flag and clear current data before API call
            this.loadingFollowers = true;
            this.followersData = [];
            
            // Force render to show spinner immediately
            this.renderFollowersTabIfActive();
            
            // ВАЖНО: Передаём userId профиля, который сейчас открыт
            console.log(`👥 ProfilePage.loadFollowers: загружаем подписчиков для userId: ${this.userId}`);
            
            const response = await this.api.getFollowers({ 
                limit: 50,
                userId: this.userId  // ← ИСПРАВЛЕНИЕ: явно передаём userId профиля
            });
            
            console.log(`👥 ProfilePage.loadFollowers: получен ответ для userId: ${this.userId}`, response);
            
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
            
            // Store in cache indexed by userId
            this._followersByUserId[this.userId] = processedFollowers;
            
            // Update current display data from cache
            this.followersData = this._followersByUserId[this.userId] || [];
            
            console.log(`✅ ProfilePage: Loaded ${this.followersData.length} followers for userId: ${this.userId}`);
        } catch (error) {
            console.warn('⚠️ Could not load followers:', error);
            // Keep cached data if available, otherwise empty array
            this.followersData = this._followersByUserId[this.userId] || [];
        } finally {
            // Always reset loading flag
            this.loadingFollowers = false;
            
            // Force render to show data or empty state
            this.renderFollowersTabIfActive();
        }
    }
    
    /**
     * 👤 Load following list
     * UPDATED: Теперь явно передаёт userId профиля в API запрос с loading флагами
     */
    async loadFollowing() {
        try {
            // Set loading flag and clear current data before API call
            this.loadingFollowing = true;
            this.followingData = [];
            
            // Force render to show spinner immediately
            this.renderFollowingTabIfActive();
            
            // ВАЖНО: Передаём userId профиля, который сейчас открыт
            console.log(`👤 ProfilePage.loadFollowing: загружаем подписки для userId: ${this.userId}`);
            
            const response = await this.api.getFollowing({ 
                limit: 50,
                userId: this.userId  // ← ИСПРАВЛЕНИЕ: явно передаём userId профиля
            });
            
            console.log(`👤 ProfilePage.loadFollowing: получен ответ для userId: ${this.userId}`, response);
            
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
            
            // Store in cache indexed by userId
            this._followingByUserId[this.userId] = processedFollowing;
            
            // Update current display data from cache
            this.followingData = this._followingByUserId[this.userId] || [];
            
            console.log(`✅ ProfilePage: Loaded ${this.followingData.length} following for userId: ${this.userId}`);
        } catch (error) {
            console.warn('⚠️ Could not load following:', error);
            // Keep cached data if available, otherwise empty array
            this.followingData = this._followingByUserId[this.userId] || [];
        } finally {
            // Always reset loading flag
            this.loadingFollowing = false;
            
            // Force render to show data or empty state
            this.renderFollowingTabIfActive();
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
                             onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
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
     */
    renderStatistics() {
        const stats = this.profileData?.stats || {};
        const totalQuotes = stats.totalQuotes || 0;
        const followers = stats.followers || 0;
        const following = stats.following || 0;
        
        return `
            <div class="profile-statistics">
                <div class="stat-item ${this.activeTab === 'quotes' ? 'active' : ''}" data-action="switch-tab" data-tab="quotes">
                    <div class="stat-value">${totalQuotes}</div>
                    <div class="stat-label">Цитат</div>
                </div>
                <div class="stat-item ${this.activeTab === 'followers' ? 'active' : ''}" data-action="switch-tab" data-tab="followers">
                    <div class="stat-value">${followers}</div>
                    <div class="stat-label">Подписчиков</div>
                </div>
                <div class="stat-item ${this.activeTab === 'following' ? 'active' : ''}" data-action="switch-tab" data-tab="following">
                    <div class="stat-value">${following}</div>
                    <div class="stat-label">Подписок</div>
                </div>
            </div>
        `;
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
     * 👥 Render followers tab
     */
    renderFollowersTab() {
        // Show spinner during loading
        if (this.loadingFollowers) {
            return `
                <div class="profile-tab-content">
                    <div class="loading-spinner-container">
                        <div class="loading-spinner"></div>
                        <p>Загрузка подписчиков...</p>
                    </div>
                </div>
            `;
        }
        
        // Show empty state if no data and not loading
        if (!this.followersData || this.followersData.length === 0) {
            return `
                <div class="profile-tab-content">
                    <div class="empty-state">
                        <p>Пока нет подписчиков</p>
                    </div>
                </div>
            `;
        }
        
        // Render user cards
        const followersHTML = this.followersData.map(user => this.renderUserCard(user)).join('');
        
        return `
            <div class="profile-tab-content">
                <div class="users-list">
                    ${followersHTML}
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Render following tab
     */
    renderFollowingTab() {
        // Show spinner during loading
        if (this.loadingFollowing) {
            return `
                <div class="profile-tab-content">
                    <div class="loading-spinner-container">
                        <div class="loading-spinner"></div>
                        <p>Загрузка подписок...</p>
                    </div>
                </div>
            `;
        }
        
        // Show empty state if no data and not loading
        if (!this.followingData || this.followingData.length === 0) {
            return `
                <div class="profile-tab-content">
                    <div class="empty-state">
                        <p>Пока нет подписок</p>
                    </div>
                </div>
            `;
        }
        
        // Render user cards
        const followingHTML = this.followingData.map(user => this.renderUserCard(user)).join('');
        
        return `
            <div class="profile-tab-content">
                <div class="users-list">
                    ${followingHTML}
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Render user card for followers/following lists
     */
    renderUserCard(user) {
        const name = user.name || user.firstName || 'Пользователь';
        const avatarUrl = user.avatarUrl || user.photoUrl || null;
        const initials = this.getInitials(name);
        const bio = user.bio || '';
        const username = user.telegramUsername || user.username;
        const formattedUsername = username ? `@${username}` : '';
        const userId = this.extractUserId(user);
        
        // Get follow status for this user (we'll need to track this)
        const isFollowing = this.followStatusCache?.[userId] || false;
        
        return `
            <div class="user-card" 
                 data-user-id="${userId}" 
                 data-is-following="${isFollowing}"
                 data-action="navigate-to-profile">
                <div class="user-avatar-container" data-user-id="${userId}">
                    ${avatarUrl ? `
                        <img class="user-avatar-img" src="${avatarUrl}" alt="${name}" 
                             onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                    ` : ''}
                    <div class="user-avatar-fallback">${initials}</div>
                </div>
                <div class="user-info">
                    <div class="user-name" data-user-id="${userId}">${name}</div>
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
     */
    async handleToggleFollow(event) {
        const button = event.currentTarget;
        if (button.disabled) return;
        
        button.disabled = true;
        
        try {
            if (this.followStatus) {
                // Unfollow
                await this.api.unfollowUser(this.userId);
                this.followStatus = false;
                button.textContent = 'Подписаться';
                button.classList.remove('following');
            } else {
                // Follow
                await this.api.followUser(this.userId);
                this.followStatus = true;
                button.textContent = 'Отписаться';
                button.classList.add('following');
            }
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
            // Broadcast follow state change to other components
            this.broadcastFollowStateChange(this.userId, this.followStatus);
            
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
     */
    broadcastFollowStateChange(userId, following) {
        // Dispatch custom event for follow state change
        const event = new CustomEvent('followStateChanged', {
            detail: { userId, following }
        });
        window.dispatchEvent(event);
        
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
                await this.loadFollowers();
            } else {
                // Use cached data
                this.followersData = this._followersByUserId[this.userId];
                console.log(`📦 ProfilePage: Using cached followers (${this.followersData.length}) for userId: ${this.userId}`);
            }
        } else if (newTab === 'following') {
            // Check cache first, only load if not cached
            if (!this._followingByUserId[this.userId] || this._followingByUserId[this.userId].length === 0) {
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
            
            // Update tab content with fade transition
            const tabContent = root.querySelector('.profile-tab-content');
            if (tabContent) {
                // Fade out
                tabContent.style.opacity = '0';
                tabContent.style.transition = 'opacity 0.2s ease-out';
                
                setTimeout(() => {
                    // Update content
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this.renderTabContent();
                    const newContent = tempDiv.firstElementChild;
                    
                    if (newContent && tabContent.parentNode) {
                        tabContent.parentNode.replaceChild(newContent, tabContent);
                        
                        // Re-attach event listeners for new elements
                        this.attachTabContentEventListeners(newContent);
                        
                        // Fade in
                        requestAnimationFrame(() => {
                            newContent.style.opacity = '1';
                        });
                    }
                }, 200);
            }
        }
    }
    
    /**
     * 🔗 Attach event listeners for tab content
     */
    attachTabContentEventListeners(container) {
        // Re-attach event listeners for user cards
        const userCards = container.querySelectorAll('[data-action="navigate-to-profile"]');
        userCards.forEach(card => {
            card.addEventListener('click', (e) => this.handleUserCardClick(e));
        });
        
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
     * 🔄 Force render followers tab if it's currently active
     * Helper method to update UI immediately during loading
     */
    renderFollowersTabIfActive() {
        if (this.activeTab !== 'followers') return;
        
        const root = document.getElementById('profilePageRoot');
        if (!root) return;
        
        const tabContent = root.querySelector('.profile-tab-content');
        if (!tabContent) return;
        
        // Update content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderTabContent();
        const newContent = tempDiv.firstElementChild;
        
        if (newContent && tabContent.parentNode) {
            tabContent.parentNode.replaceChild(newContent, tabContent);
            
            // Re-attach event listeners for new elements
            this.attachTabContentEventListeners(newContent);
        }
    }
    
    /**
     * 🔄 Force render following tab if it's currently active
     * Helper method to update UI immediately during loading
     */
    renderFollowingTabIfActive() {
        if (this.activeTab !== 'following') return;
        
        const root = document.getElementById('profilePageRoot');
        if (!root) return;
        
        const tabContent = root.querySelector('.profile-tab-content');
        if (!tabContent) return;
        
        // Update content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderTabContent();
        const newContent = tempDiv.firstElementChild;
        
        if (newContent && tabContent.parentNode) {
            tabContent.parentNode.replaceChild(newContent, tabContent);
            
            // Re-attach event listeners for new elements
            this.attachTabContentEventListeners(newContent);
        }
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
                
                // Re-render profile card to show the username
                const root = document.getElementById('profilePageRoot');
                if (root) {
                    const profileCard = root.querySelector('.profile-card');
                    if (profileCard) {
                        profileCard.outerHTML = this.renderProfileCard();
                    }
                }
            }
        }
        
        // Update Telegram BackButton visibility
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.show();
        }
        
        // Listen for follow state changes from other components
        this.followStateChangeHandler = (event) => {
            const { userId, following } = event.detail;
            if (userId === this.userId) {
                this.followStatus = following;
                this.updateFollowButton(following);
            }
        };
        window.addEventListener('followStateChanged', this.followStateChangeHandler);
    }
    
    /**
     * 👋 Called when page is hidden
     */
    onHide() {
        console.log('👋 ProfilePage: onHide');
        
        // Hide Telegram BackButton
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.hide();
        }
        
        // Remove follow state change listener
        if (this.followStateChangeHandler) {
            window.removeEventListener('followStateChanged', this.followStateChangeHandler);
            this.followStateChangeHandler = null;
        }
    }
    
    /**
     * 🔄 Update follow button UI
     */
    updateFollowButton(following) {
        const followBtn = document.querySelector('[data-action="toggle-follow"]');
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
