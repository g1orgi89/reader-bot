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
            
            // Determine user ID
            if (userParam === 'me') {
                this.userId = this.state.getCurrentUserId();
                this.isOwnProfile = true;
            } else {
                this.userId = userParam;
                this.isOwnProfile = false;
            }
            
            console.log(`🔍 ProfilePage: Loading profile for ${this.isOwnProfile ? 'own profile' : 'user ' + this.userId}`);
            
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
            
            // If own profile, also try to update state
            if (this.isOwnProfile) {
                this.state.set('user.profile', this.profileData);
            }
            
            // Load user's quotes
            await this.loadUserQuotes();
            
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
     * 👥 Load followers list
     */
    async loadFollowers() {
        try {
            const response = await this.api.getFollowers({ limit: 50 });
            this.followersData = response.followers || response || [];
            console.log(`✅ ProfilePage: Loaded ${this.followersData.length} followers`);
        } catch (error) {
            console.warn('⚠️ Could not load followers:', error);
            this.followersData = [];
        }
    }
    
    /**
     * 👤 Load following list
     */
    async loadFollowing() {
        try {
            const response = await this.api.getFollowing({ limit: 50 });
            this.followingData = response.following || response || [];
            console.log(`✅ ProfilePage: Loaded ${this.followingData.length} following`);
        } catch (error) {
            console.warn('⚠️ Could not load following:', error);
            this.followingData = [];
        }
    }
    
    /**
     * 📚 Load user's recent quotes
     */
    async loadUserQuotes(limit = 10) {
        try {
            const quotes = await this.api.getUserQuotes(this.userId, { limit });
            this.userQuotes = quotes || [];
        } catch (error) {
            console.warn('⚠️ Could not load user quotes:', error);
            this.userQuotes = [];
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
                ${this.renderHeader()}
                ${this.renderProfileCard()}
                ${this.renderStatistics()}
                ${this.renderTabContent()}
            </div>
        `;
    }
    
    /**
     * 📋 Render page header
     */
    renderHeader() {
        const title = this.isOwnProfile ? '👤 Мой профиль' : '👤 Профиль';
        
        return `
            <div class="page-header profile-header-sticky">
                <button class="back-button" data-action="back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                <h1 class="page-title">${title}</h1>
                ${this.isOwnProfile ? `
                    <button class="edit-profile-button" data-action="edit-profile">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                ` : ''}
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
        const username = profile.telegramUsername ? `@${profile.telegramUsername}` : '';
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
                ${username ? `<p class="profile-username">${username}</p>` : ''}
                
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
            </div>
        `;
    }
    
    /**
     * 👥 Render followers tab
     */
    renderFollowersTab() {
        if (!this.followersData || this.followersData.length === 0) {
            return `
                <div class="profile-tab-content">
                    <div class="empty-state">
                        <p>Пока нет подписчиков</p>
                    </div>
                </div>
            `;
        }
        
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
        if (!this.followingData || this.followingData.length === 0) {
            return `
                <div class="profile-tab-content">
                    <div class="empty-state">
                        <p>Пока нет подписок</p>
                    </div>
                </div>
            `;
        }
        
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
        
        return `
            <div class="user-card" data-user-id="${user.userId || user.id}">
                <div class="user-avatar-container">
                    ${avatarUrl ? `
                        <img class="user-avatar-img" src="${avatarUrl}" alt="${name}" 
                             onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                    ` : ''}
                    <div class="user-avatar-fallback">${initials}</div>
                </div>
                <div class="user-info">
                    <div class="user-name">${name}</div>
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
        
        // User card clicks (for followers/following)
        const userCards = root.querySelectorAll('.user-card');
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
        
        // Load data for the tab if not loaded yet
        if (newTab === 'followers' && this.followersData.length === 0) {
            await this.loadFollowers();
        } else if (newTab === 'following' && this.followingData.length === 0) {
            await this.loadFollowing();
        } else if (newTab === 'quotes' && this.userQuotes.length <= 10) {
            // Load all quotes when switching to quotes tab
            await this.loadUserQuotes(50);
        }
        
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
                        
                        // Re-attach event listeners for new user cards
                        const userCards = newContent.querySelectorAll('.user-card');
                        userCards.forEach(card => {
                            card.addEventListener('click', (e) => this.handleUserCardClick(e));
                        });
                        
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
