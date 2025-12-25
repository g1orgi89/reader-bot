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
        
        // Constants
        this.MODAL_CLOSE_DELAY = 100; // ms delay before navigation to ensure modal closes
        
        // Event handlers
        this.boundHandleBackdropClick = this.handleBackdropClick.bind(this);
        this.boundHandleEscape = this.handleEscape.bind(this);
        this.boundHandleBackButton = this.handleBackButton.bind(this);
        
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
     * @param {boolean} [presetFollowStatus] - Optional preset follow status from UI to avoid flicker
     */
    async open(userId, presetFollowStatus = null) {
        if (this.isOpen) return;
        
        this.userId = userId;
        this.isOpen = true;
        
        // Use preset follow status if provided (truthy check to handle false explicitly)
        if (presetFollowStatus !== null && presetFollowStatus !== undefined) {
            this.followStatus = Boolean(presetFollowStatus);
            console.log(`✅ ProfileModal: Using preset follow status: ${this.followStatus} for user ${userId}`);
        }
        
        // Create modal if not exists
        this.createModal();
        
        // Show modal with loading state
        this.renderLoading();
        this.modal.style.display = 'flex';
        this.backdrop.style.display = 'block';
        
        // Add event listeners
        this.backdrop.addEventListener('click', this.boundHandleBackdropClick);
        document.addEventListener('keydown', this.boundHandleEscape);
        
        // Setup Telegram BackButton with single handler (guard against duplicates)
        if (this.telegram?.BackButton) {
            // First remove any existing handler to prevent duplicates
            this.telegram.BackButton.offClick(this.boundHandleBackButton);
            this.telegram.BackButton.show();
            this.telegram.BackButton.onClick(this.boundHandleBackButton);
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
     * ❌ Close modal (idempotent with force option)
     * @param {Object} options - Close options
     * @param {boolean} options.force - Force immediate close without animation
     */
    close(options = {}) {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        // Remove active class for animation
        if (this.modal) this.modal.classList.remove('active');
        if (this.backdrop) this.backdrop.classList.remove('active');
        
        // Remove event listeners (idempotent - safe to call multiple times)
        if (this.backdrop) {
            this.backdrop.removeEventListener('click', this.boundHandleBackdropClick);
        }
        document.removeEventListener('keydown', this.boundHandleEscape);
        
        // Hide Telegram BackButton and remove handler (guard against duplicates)
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.offClick(this.boundHandleBackButton);
            this.telegram.BackButton.hide();
        }
        
        // Hide modal immediately if force, otherwise after animation
        if (options.force) {
            if (this.modal) this.modal.style.display = 'none';
            if (this.backdrop) this.backdrop.style.display = 'none';
        } else {
            setTimeout(() => {
                if (this.modal) this.modal.style.display = 'none';
                if (this.backdrop) this.backdrop.style.display = 'none';
            }, 250);
        }
        
        // Re-enable body scroll
        document.body.classList.remove('modal-open');
        
        console.log('✅ ProfileModal: Closed', options.force ? '(forced)' : '');
    }
    
    /**
     * 🔙 Handle Telegram BackButton click
     */
    handleBackButton() {
        this.close();
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
            
            // Get current user ID for comparison (normalize types to handle number vs string)
            const currentUserId = this.state.getCurrentUserId();
            const isOwnProfile = String(currentUserId) === String(this.userId);
            
            // For own profile, load stats and follow counts
            if (isOwnProfile) {
                try {
                    // Load stats - normalize response structure (stats may be nested in resp.stats)
                    const statsResp = await this.api.getStats(this.userId);
                    if (statsResp) {
                        // Extract flat stats fields from resp.stats or resp itself
                        const statsData = statsResp.stats || statsResp;
                        const normalizedStats = {
                            totalQuotes: statsData.totalQuotes || 0,
                            currentStreak: statsData.currentStreak || 0,
                            longestStreak: statsData.longestStreak || 0,
                            weeklyQuotes: statsData.weeklyQuotes || statsData.thisWeek || 0,
                            thisWeek: statsData.thisWeek || statsData.weeklyQuotes || 0,
                            daysInApp: statsData.daysSinceRegistration || statsData.daysInApp || 0
                        };
                        
                        this.profileData.stats = {
                            ...this.profileData.stats,
                            ...normalizedStats
                        };
                    }
                    
                    // Load follow counts
                    const counts = await this.api.getFollowCounts();
                    if (counts) {
                        this.profileData.stats = {
                            ...this.profileData.stats,
                            followers: counts.followers || 0,
                            following: counts.following || 0
                        };
                    }
                } catch (error) {
                    console.warn('⚠️ Could not load stats for own profile:', error);
                }
            } else {
                // Load follow status for other users
                try {
                    const status = await this.api.getFollowStatus(this.userId);
                    // Support both .isFollowing and .following response formats
                    const apiFollowStatus = status?.isFollowing ?? status?.following ?? false;
                    
                    // Reconcile with preset status - only if preset was actually provided (not null/undefined)
                    if (this.followStatus !== null && this.followStatus !== undefined) {
                        if (this.followStatus !== apiFollowStatus) {
                            console.log(`🔄 ProfileModal: Reconciling follow status - preset: ${this.followStatus}, API: ${apiFollowStatus}`);
                        }
                    }
                    
                    // Always use API status for accuracy after reconciliation
                    this.followStatus = apiFollowStatus;
                } catch (error) {
                    console.warn('⚠️ Could not load follow status:', error);
                    // Keep preset status on error, or default to false
                    if (this.followStatus === null || this.followStatus === undefined) {
                        this.followStatus = false;
                    }
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
        const isOwnProfile = String(currentUserId) === String(this.userId);
        
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
                                 onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)" />
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
        
        // Close button with stopPropagation (remove once: true since modal is re-rendered on each open)
        const closeBtn = this.modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                this.close();
            });
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
        const profileUrl = `/profile?user=${this.userId}`;
        
        // Force close modal immediately to prevent hanging
        this.close({ force: true });
        
        // Small delay to ensure modal closes before navigation
        setTimeout(() => {
            if (this.router && typeof this.router.navigate === 'function') {
                this.router.navigate(profileUrl);
            } else {
                window.location.hash = profileUrl;
            }
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
        }, this.MODAL_CLOSE_DELAY);
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
