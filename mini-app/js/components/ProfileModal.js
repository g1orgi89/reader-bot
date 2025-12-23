/**
 * 🎭 PROFILE MODAL - ProfileModal.js
 * 
 * Lightweight preview modal for user profiles
 * Opened from Community feed when clicking on user cards
 * Provides quick overview with option to open full profile page
 * 
 * Features:
 * - User avatar and basic info
 * - Quick stats (quotes, followers, following)
 * - Follow/Unfollow button
 * - "Open Full Profile" action to navigate to /profile page
 * 
 * @version 1.0.0
 */

class ProfileModal {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.router = app.router;
        
        // Modal state
        this.isOpen = false;
        this.userId = null;
        this.profileData = null;
        this.followStatus = false;
        this.loading = false;
        
        // DOM elements
        this.modal = null;
        this.backdrop = null;
        
        // Event handlers
        this.boundHandleBackdropClick = this.handleBackdropClick.bind(this);
        this.boundHandleEscape = this.handleEscape.bind(this);
        
        console.log('✅ ProfileModal: Initialized');
    }
    
    /**
     * 🏗️ Create modal DOM elements
     */
    createModal() {
        if (this.modal) return; // Already created
        
        // Create backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'modal-backdrop profile-modal-backdrop';
        this.backdrop.style.display = 'none';
        
        // Create modal
        this.modal = document.createElement('div');
        this.modal.className = 'modal profile-modal';
        this.modal.style.display = 'none';
        this.modal.setAttribute('role', 'dialog');
        this.modal.setAttribute('aria-modal', 'true');
        this.modal.setAttribute('aria-labelledby', 'profileModalTitle');
        
        // Add to document
        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.modal);
        
        console.log('✅ ProfileModal: DOM elements created');
    }
    
    /**
     * 🚀 Open modal for specific user
     * @param {string|number} userId - User ID to display
     */
    async open(userId) {
        if (this.isOpen) return;
        
        this.userId = userId;
        this.isOpen = true;
        
        // Create modal if not exists
        this.createModal();
        
        // Show modal with loading state
        this.renderLoading();
        this.modal.style.display = 'flex';
        this.backdrop.style.display = 'block';
        
        // Add event listeners
        this.backdrop.addEventListener('click', this.boundHandleBackdropClick);
        document.addEventListener('keydown', this.boundHandleEscape);
        
        // Setup Telegram BackButton
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.show();
            this.telegram.BackButton.onClick(() => this.close());
        }
        
        // Add active class for animation
        requestAnimationFrame(() => {
            this.modal.classList.add('active');
            this.backdrop.classList.add('active');
        });
        
        // Prevent body scroll
        document.body.classList.add('modal-open');
        
        // Load profile data
        await this.loadProfile();
        
        console.log('✅ ProfileModal: Opened for user', userId);
    }
    
    /**
     * ❌ Close modal
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        // Remove active class for animation
        this.modal.classList.remove('active');
        this.backdrop.classList.remove('active');
        
        // Remove event listeners
        this.backdrop.removeEventListener('click', this.boundHandleBackdropClick);
        document.removeEventListener('keydown', this.boundHandleEscape);
        
        // Hide Telegram BackButton
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.offClick(() => this.close());
            this.telegram.BackButton.hide();
        }
        
        // Hide modal after animation
        setTimeout(() => {
            if (this.modal) this.modal.style.display = 'none';
            if (this.backdrop) this.backdrop.style.display = 'none';
        }, 250);
        
        // Re-enable body scroll
        document.body.classList.remove('modal-open');
        
        console.log('✅ ProfileModal: Closed');
    }
    
    /**
     * 📊 Load profile data
     */
    async loadProfile() {
        this.loading = true;
        
        try {
            // Load profile data from API
            const profileResponse = await this.api.getUserProfile(this.userId);
            this.profileData = profileResponse.user || profileResponse;
            
            // Load follow status
            const currentUserId = this.state.getCurrentUserId();
            if (currentUserId && currentUserId !== this.userId) {
                try {
                    const status = await this.api.getFollowStatus(this.userId);
                    this.followStatus = status?.following || false;
                } catch (error) {
                    console.warn('⚠️ Could not load follow status:', error);
                    this.followStatus = false;
                }
            }
            
            // Render with loaded data
            this.render();
            
        } catch (error) {
            console.error('❌ ProfileModal: Error loading profile:', error);
            this.renderError(error.message);
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 🎨 Render modal content
     */
    render() {
        if (!this.modal || !this.profileData) return;
        
        const profile = this.profileData;
        const name = profile.name || profile.firstName || 'Пользователь';
        const bio = profile.bio || '';
        const avatarUrl = this.resolveAvatarUrl();
        const initials = this.getInitials(name);
        
        const stats = profile.stats || {};
        const totalQuotes = stats.totalQuotes || 0;
        const followers = stats.followers || 0;
        const following = stats.following || 0;
        
        const currentUserId = this.state.getCurrentUserId();
        const isOwnProfile = currentUserId === this.userId;
        
        this.modal.innerHTML = `
            <div class="modal-content profile-modal-content">
                <button class="modal-close" aria-label="Закрыть">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                
                <div class="profile-modal-body">
                    <div class="profile-modal-avatar-container">
                        ${avatarUrl ? `
                            <img class="profile-modal-avatar-img" src="${avatarUrl}" alt="${name}" 
                                 onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                        ` : ''}
                        <div class="profile-modal-avatar-fallback">${initials}</div>
                    </div>
                    
                    <h2 id="profileModalTitle" class="profile-modal-name">${name}</h2>
                    
                    ${bio ? `<p class="profile-modal-bio">${bio}</p>` : ''}
                    
                    <div class="profile-modal-stats">
                        <div class="profile-modal-stat">
                            <div class="stat-value">${totalQuotes}</div>
                            <div class="stat-label">Цитат</div>
                        </div>
                        <div class="profile-modal-stat">
                            <div class="stat-value">${followers}</div>
                            <div class="stat-label">Подписчиков</div>
                        </div>
                        <div class="profile-modal-stat">
                            <div class="stat-value">${following}</div>
                            <div class="stat-label">Подписок</div>
                        </div>
                    </div>
                    
                    <div class="profile-modal-actions">
                        ${!isOwnProfile ? `
                            <button class="btn-follow ${this.followStatus ? 'following' : ''}" 
                                    data-action="toggle-follow">
                                ${this.followStatus ? 'Отписаться' : 'Подписаться'}
                            </button>
                        ` : ''}
                        
                        <button class="btn-view-profile" data-action="open-full-profile">
                            Открыть профиль
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Attach event listeners
        this.attachEventListeners();
    }
    
    /**
     * ⏳ Render loading state
     */
    renderLoading() {
        if (!this.modal) return;
        
        this.modal.innerHTML = `
            <div class="modal-content profile-modal-content loading">
                <div class="loading-spinner"></div>
                <p>Загрузка профиля...</p>
            </div>
        `;
    }
    
    /**
     * ❌ Render error state
     */
    renderError(message) {
        if (!this.modal) return;
        
        this.modal.innerHTML = `
            <div class="modal-content profile-modal-content error">
                <h3>⚠️ Ошибка</h3>
                <p>${message}</p>
                <button class="btn-primary" data-action="close">Закрыть</button>
            </div>
        `;
        
        // Attach close button listener
        const closeBtn = this.modal.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
    }
    
    /**
     * 🔗 Attach event listeners
     */
    attachEventListeners() {
        if (!this.modal) return;
        
        // Close button
        const closeBtn = this.modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Follow/Unfollow button
        const followBtn = this.modal.querySelector('[data-action="toggle-follow"]');
        if (followBtn) {
            followBtn.addEventListener('click', () => this.handleToggleFollow());
        }
        
        // Open full profile button
        const viewProfileBtn = this.modal.querySelector('[data-action="open-full-profile"]');
        if (viewProfileBtn) {
            viewProfileBtn.addEventListener('click', () => this.handleOpenFullProfile());
        }
    }
    
    /**
     * 🎬 Handle backdrop click
     */
    handleBackdropClick(event) {
        if (event.target === this.backdrop) {
            this.close();
        }
    }
    
    /**
     * ⌨️ Handle escape key
     */
    handleEscape(event) {
        if (event.key === 'Escape' && this.isOpen) {
            this.close();
        }
    }
    
    /**
     * 👥 Handle follow/unfollow toggle
     */
    async handleToggleFollow() {
        const followBtn = this.modal.querySelector('[data-action="toggle-follow"]');
        if (!followBtn || followBtn.disabled) return;
        
        followBtn.disabled = true;
        
        try {
            if (this.followStatus) {
                // Unfollow
                await this.api.unfollowUser(this.userId);
                this.followStatus = false;
                followBtn.textContent = 'Подписаться';
                followBtn.classList.remove('following');
            } else {
                // Follow
                await this.api.followUser(this.userId);
                this.followStatus = true;
                followBtn.textContent = 'Отписаться';
                followBtn.classList.add('following');
            }
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
            // Broadcast follow state change
            this.broadcastFollowStateChange(this.userId, this.followStatus);
            
        } catch (error) {
            console.error('❌ ProfileModal: Error toggling follow:', error);
            if (this.telegram?.showAlert) {
                this.telegram.showAlert('Ошибка при изменении подписки');
            }
        } finally {
            followBtn.disabled = false;
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
        
        // Also update CommunityPage if available
        if (window.communityPage && typeof window.communityPage.refreshFollowStatus === 'function') {
            window.communityPage.refreshFollowStatus(userId, following);
        }
    }
    
    /**
     * 🔄 Update follow status from external source
     */
    updateFollowStatus(userId, following) {
        if (this.userId === userId && this.isOpen) {
            this.followStatus = following;
            const followBtn = this.modal?.querySelector('[data-action="toggle-follow"]');
            if (followBtn) {
                followBtn.textContent = following ? 'Отписаться' : 'Подписаться';
                if (following) {
                    followBtn.classList.add('following');
                } else {
                    followBtn.classList.remove('following');
                }
            }
        }
    }
    
    /**
     * 🔍 Handle open full profile
     */
    handleOpenFullProfile() {
        // Close modal
        this.close();
        
        // Navigate to full profile page
        const profileUrl = `/profile?user=${this.userId}`;
        
        if (this.router && typeof this.router.navigate === 'function') {
            this.router.navigate(profileUrl);
        } else {
            window.location.hash = profileUrl;
        }
        
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
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
     * 🧹 Cleanup and destroy modal
     */
    destroy() {
        this.close();
        
        // Remove DOM elements
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }
        
        this.modal = null;
        this.backdrop = null;
        
        console.log('🧹 ProfileModal: Destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileModal;
} else {
    window.ProfileModal = ProfileModal;
}
