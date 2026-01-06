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
        
        // Track if BackButton handler is attached to prevent duplicates
        this.backButtonAttached = false;
        
        // Instance ID for lifecycle tracking
        this.instanceId = (window.__PM_INSTANCE_SEQ = (window.__PM_INSTANCE_SEQ || 0) + 1);
        
        // Initialize global BackButton handler registry
        if (!window.__PM_BACKBTN_HANDLERS) {
            window.__PM_BACKBTN_HANDLERS = new Set();
        }
        
        console.log(`✅ ProfileModal: Initialized instance=${this.instanceId}`);
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
        
        console.log(`✅ ProfileModal: DOM elements created for instance=${this.instanceId}`);
    }
    
    /**
     * 🧹 Ensure singleton DOM - remove duplicate modal/backdrop nodes
     * Guards against multiple modal instances in the DOM
     */
    _ensureSingletonDom() {
        try {
            const modals = document.querySelectorAll('.profile-modal');
            const backdrops = document.querySelectorAll('.profile-modal-backdrop');
            
            if (modals.length > 1) {
                modals.forEach(m => {
                    if (m !== this.modal) {
                        m.remove();
                    }
                });
                console.warn(`🧹 Removed ${modals.length - 1} duplicate .profile-modal`);
            }
            
            if (backdrops.length > 1) {
                backdrops.forEach(b => {
                    if (b !== this.backdrop) {
                        b.remove();
                    }
                });
                console.warn(`🧹 Removed ${backdrops.length - 1} duplicate .profile-modal-backdrop`);
            }
            
            console.log(`🔎 Modal DOM counts: modal=${document.querySelectorAll('.profile-modal').length}, backdrop=${document.querySelectorAll('.profile-modal-backdrop').length}`);
        } catch (e) {
            console.warn('⚠️ ensureSingletonDom failed:', e);
        }
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
        
        // Ensure singleton DOM - remove any duplicate nodes
        this._ensureSingletonDom();
        
        // Show modal with loading state
        this.renderLoading();
        this.modal.style.display = 'flex';
        this.backdrop.style.display = 'block';
        
        // Add event listeners
        this.backdrop.addEventListener('click', this.boundHandleBackdropClick);
        document.addEventListener('keydown', this.boundHandleEscape);
        
        // ✅ Subscribe to follow:changed event for real-time sync
        this._followChangedHandler = (event) => {
            const { userId: changedUserId, following } = event.detail;
            console.log(`[FOLLOW_SYNC] ProfileModal: Received follow:changed event for userId=${changedUserId}, following=${following}, this.isOpen=${this.isOpen}, this.userId=${this.userId}`);
            // Only update if this modal is open and matches the changed user
            if (this.isOpen && String(changedUserId) === String(this.userId)) {
                console.log(`[FOLLOW_SYNC] ProfileModal: Updating button for user ${changedUserId} to ${following}`);
                this.followStatus = following;
                this.updateFollowButton(following);
            }
        };
        window.addEventListener('follow:changed', this._followChangedHandler);
        
        // ✨ Listen for status updates from HomePage
        this._statusUpdatedHandler = (event) => {
            if (this.isOpen && this.profileData) {
                const currentUserId = this.state.getCurrentUserId();
                const isOwnProfile = String(currentUserId) === String(this.userId);
                if (isOwnProfile) {
                    const newStatus = event.detail?.status;
                    this.profileData.status = newStatus;
                    this._updateDisplayedStatus(newStatus);
                    console.log('✅ ProfileModal: Status updated from HomePage event');
                }
            }
        };
        window.addEventListener('status:updated', this._statusUpdatedHandler);
        
        // Setup Telegram BackButton with guard against duplicate handlers
        if (this.telegram?.BackButton) {
            if (!this.backButtonAttached) {
                this.telegram.BackButton.onClick(this.boundHandleBackButton);
                this.backButtonAttached = true;
                // Register in global handler set
                window.__PM_BACKBTN_HANDLERS.add(this.boundHandleBackButton);
            }
            this.telegram.BackButton.show();
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
        
        console.log(`👤 ProfileModal.open instance=${this.instanceId} user=${userId}`);
    }
    
    /**
     * ❌ Close modal
     * @param {Object} options - Close options
     * @param {boolean} options.force - Force immediate close without animation
     */
    close(options = {}) {
        const { force = false } = options;
        
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        // Remove event listeners
        if (this.backdrop) {
            this.backdrop.removeEventListener('click', this.boundHandleBackdropClick);
        }
        document.removeEventListener('keydown', this.boundHandleEscape);
        
        // ✅ Unsubscribe from follow:changed event
        if (this._followChangedHandler) {
            window.removeEventListener('follow:changed', this._followChangedHandler);
            this._followChangedHandler = null;
        }
        
        // Remove status update listener
        if (this._statusUpdatedHandler) {
            window.removeEventListener('status:updated', this._statusUpdatedHandler);
            this._statusUpdatedHandler = null;
        }
        
        // Hide Telegram BackButton and remove handler from global registry
        if (this.telegram?.BackButton) {
            if (this.backButtonAttached) {
                try {
                    this.telegram.BackButton.offClick(this.boundHandleBackButton);
                    // Remove from global handler set
                    window.__PM_BACKBTN_HANDLERS?.delete(this.boundHandleBackButton);
                } catch (_) {
                    // Ignore errors
                }
                this.backButtonAttached = false;
            }
            this.telegram.BackButton.hide();
        }
        
        if (force) {
            // Immediate close without animation
            if (this.modal) {
                this.modal.classList.remove('active');
                this.modal.style.display = 'none';
            }
            if (this.backdrop) {
                this.backdrop.classList.remove('active');
                this.backdrop.style.display = 'none';
            }
            document.body.classList.remove('modal-open');
        } else {
            // Animated close
            if (this.modal) {
                this.modal.classList.remove('active');
            }
            if (this.backdrop) {
                this.backdrop.classList.remove('active');
            }
            
            // Hide modal after animation
            setTimeout(() => {
                if (this.modal) this.modal.style.display = 'none';
                if (this.backdrop) this.backdrop.style.display = 'none';
            }, 250);
            
            // Re-enable body scroll
            document.body.classList.remove('modal-open');
        }
        
        console.log(`✅ ProfileModal: Closed ${force ? '(force)' : ''} instance=${this.instanceId}`);
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
            
            // Get current user ID for comparison with proper type normalization
            const currentUserId = this.state.getCurrentUserId();
            const isOwnProfile = String(currentUserId) === String(this.userId);
            
            // For own profile, load stats and follow counts
            if (isOwnProfile) {
                try {
                    // Load stats if not already present
                    const statsResponse = await this.api.getStats(this.userId);
                    
                    // Normalize stats response - handle both flat and nested structures
                    let normalizedStats = {};
                    if (statsResponse) {
                        // If stats are nested in a stats property, extract them
                        const stats = statsResponse.stats || statsResponse;
                        
                        // Map to flat structure
                        normalizedStats = {
                            totalQuotes: stats.totalQuotes || 0,
                            currentStreak: stats.currentStreak || 0,
                            longestStreak: stats.longestStreak || 0,
                            weeklyQuotes: stats.weeklyQuotes || stats.thisWeek || 0,
                            thisWeek: stats.thisWeek || stats.weeklyQuotes || 0
                        };
                    }
                    
                    // Merge with existing stats
                    this.profileData.stats = {
                        ...this.profileData.stats,
                        ...normalizedStats
                    };
                    
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
                // ✅ UPDATED: Check appState first to avoid flicker
                const cachedStatus = window.appState?.getFollowStatus(this.userId);
                if (cachedStatus !== null && cachedStatus !== undefined) {
                    this.followStatus = cachedStatus;
                    console.log(`[FOLLOW_SYNC] ProfileModal: Using cached follow status from appState: ${cachedStatus} for user ${this.userId}`);
                } else {
                    // Fallback to API if not in appState
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
                        
                        // Use API status and update appState
                        this.followStatus = apiFollowStatus;
                        if (window.appState?.setFollowStatus) {
                            window.appState.setFollowStatus(this.userId, apiFollowStatus);
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not load follow status:', error);
                        // Keep preset status on error, or default to false
                        if (this.followStatus === null || this.followStatus === undefined) {
                            this.followStatus = false;
                        }
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
        const status = profile.status || ''; // Real status only
        const username = profile.telegramUsername ? `@${profile.telegramUsername}` : '';
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
                
                <div class="profile-modal-header">
                    <div class="profile-modal-left">
                        <div class="profile-modal-avatar-container">
                            ${avatarUrl ? `
                                <img class="profile-modal-avatar-img" src="${avatarUrl}" alt="${name}" 
                                     onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)" />
                            ` : ''}
                            <div class="profile-modal-avatar-fallback">${initials}</div>
                        </div>
                        
                        <div class="profile-modal-info">
                            <h2 id="profileModalTitle" class="profile-modal-name">${name}</h2>
                            ${username ? `<p class="profile-modal-username">${username}</p>` : ''}
                            ${status ? `<p class="profile-modal-status user-status">${status}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="profile-modal-actions">
                        <button class="profile-action-btn" data-action="open-tab" data-tab="quotes" title="Цитаты">📖</button>
                        <button class="profile-action-btn" data-action="open-tab" data-tab="followers" title="Подписчики">👥</button>
                        <button class="profile-action-btn" data-action="open-tab" data-tab="following" title="Подписки">➕</button>
                    </div>
                </div>
                
                <div class="profile-modal-body">
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
                    
                    <div class="profile-modal-actions-bottom">
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
        
        // Action buttons to open profile with specific tab
        const tabButtons = this.modal.querySelectorAll('[data-action="open-tab"]');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                this.handleOpenTab(tab);
            });
        });
        
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
            console.log(`[FOLLOW_SYNC] ProfileModal.handleToggleFollow: current followStatus=${this.followStatus}`);
            
            if (this.followStatus) {
                // Unfollow
                await this.api.unfollowUser(this.userId);
                // No need to update local state - api will dispatch follow:changed which updates via handler
                console.log(`[FOLLOW_SYNC] ProfileModal.handleToggleFollow: unfollowed user ${this.userId}`);
            } else {
                // Follow
                await this.api.followUser(this.userId);
                // No need to update local state - api will dispatch follow:changed which updates via handler
                console.log(`[FOLLOW_SYNC] ProfileModal.handleToggleFollow: followed user ${this.userId}`);
            }
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
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
     * 🔄 Update displayed status without full modal rebuild
     * @param {string|null} newStatus - The new status to display (null or empty string hides the status)
     * @private
     */
    _updateDisplayedStatus(newStatus) {
        if (!this.modal) return;
        
        // Find or create status element
        let statusElement = this.modal.querySelector('.profile-modal-status');
        
        if (newStatus) {
            if (!statusElement) {
                // Create status element if it doesn't exist
                statusElement = document.createElement('p');
                statusElement.className = 'profile-modal-status user-status';
                
                // Insert after profile-modal-username or profile-modal-name
                const usernameElement = this.modal.querySelector('.profile-modal-username');
                const nameElement = this.modal.querySelector('.profile-modal-name');
                const insertAfter = usernameElement || nameElement;
                
                if (insertAfter && insertAfter.nextSibling) {
                    insertAfter.parentNode.insertBefore(statusElement, insertAfter.nextSibling);
                } else if (insertAfter) {
                    insertAfter.parentNode.appendChild(statusElement);
                }
            }
            
            // Update text content
            statusElement.textContent = newStatus;
            statusElement.style.display = '';
        } else if (statusElement) {
            // Hide status element if no status
            statusElement.style.display = 'none';
        }
    }
    
    /**
     * 🔄 Update follow button state (alias for updateFollowStatus for consistency)
     * Used by follow:changed event handler
     */
    updateFollowButton(following) {
        this.updateFollowStatus(this.userId, following);
    }
    
    /**
     * 🔍 Handle open specific tab on full profile
     */
    handleOpenTab(tab) {
        const profileUrl = `/profile?user=${this.userId}&tab=${tab}`;
        
        // Close modal first with force option for immediate effect
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
     * 🔍 Handle open full profile
     */
    handleOpenFullProfile() {
        const profileUrl = `/profile?user=${this.userId}`;
        
        // Close modal first with force option for immediate effect
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
