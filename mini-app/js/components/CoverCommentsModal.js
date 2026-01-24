/**
 * 💬 COVER COMMENTS MODAL - CoverCommentsModal.js
 * 
 * Modal for viewing and interacting with comments on cover posts
 * Features:
 * - Display comments with avatars, names, and relative timestamps
 * - Like/unlike comments with optimistic updates
 * - Reply to comments (nested threads)
 * - Clickable avatars/names open ProfileModal
 * - Pagination support
 * 
 * @version 1.0.0
 */

class CoverCommentsModal {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.profileModal = app.profileModal || (window.profileModal || (window.profileModal = new ProfileModal(app)));
        
        // Modal state
        this.isOpen = false;
        this.postId = null;
        this.comments = [];
        this.hasMore = false;
        this.cursor = null;
        this.loading = false;
        
        // DOM elements
        this.modal = null;
        this.backdrop = null;
        
        // Event handlers
        this.boundHandleBackdropClick = this.handleBackdropClick.bind(this);
        this.boundHandleEscape = this.handleEscape.bind(this);
        this.boundHandleBackButton = this.handleBackButton.bind(this);
        
        // Track if BackButton handler is attached
        this.backButtonAttached = false;
        
        console.log('✅ CoverCommentsModal: Initialized');
    }
    
    /**
     * 🏗️ Create modal DOM elements
     */
    createModal() {
        if (this.modal) return; // Already created
        
        // Create backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'modal-backdrop cover-comments-backdrop';
        this.backdrop.style.display = 'none';
        
        // Create modal
        this.modal = document.createElement('div');
        this.modal.className = 'modal cover-comments-modal';
        this.modal.style.display = 'none';
        this.modal.setAttribute('role', 'dialog');
        this.modal.setAttribute('aria-modal', 'true');
        this.modal.setAttribute('aria-labelledby', 'coverCommentsModalTitle');
        
        // Add to document
        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.modal);
        
        console.log('✅ CoverCommentsModal: DOM elements created');
    }
    
    /**
     * 📂 Open modal and load comments
     * @param {string} postId - Post ID to load comments for
     */
    async open(postId) {
        if (!postId) return;
        
        this.postId = postId;
        this.comments = [];
        this.hasMore = false;
        this.cursor = null;
        
        // Create modal if needed
        this.createModal();
        
        // Show modal
        this.isOpen = true;
        this.backdrop.style.display = 'block';
        this.modal.style.display = 'block';
        
        // Render loading state
        this.render();
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Load comments
        await this.loadComments();
        
        // Trigger haptic feedback
        if (this.telegram?.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred('light');
        }
    }
    
    /**
     * 🚪 Close modal
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        if (this.backdrop) this.backdrop.style.display = 'none';
        if (this.modal) this.modal.style.display = 'none';
        
        // Detach event listeners
        this.detachEventListeners();
        
        // Trigger haptic feedback
        if (this.telegram?.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred('light');
        }
    }
    
    /**
     * 📡 Load comments from API
     */
    async loadComments(append = false) {
        if (this.loading) return;
        
        this.loading = true;
        this.render();
        
        try {
            const response = await this.api.getCoverComments(this.postId, {
                cursor: this.cursor,
                limit: 20
            });
            
            if (response.success) {
                const newComments = response.data || [];
                
                if (append) {
                    this.comments = [...this.comments, ...newComments];
                } else {
                    this.comments = newComments;
                }
                
                this.hasMore = response.hasMore || false;
                this.cursor = response.nextCursor || null;
                
                this.loading = false;
                this.render();
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            this.loading = false;
            this.render();
        }
    }
    
    /**
     * 🎨 Render modal content
     */
    render() {
        if (!this.modal) return;
        
        const commentsHtml = this.comments.length > 0
            ? this.comments.map(comment => this.renderComment(comment)).join('')
            : '<div class="cover-comments-empty">Пока нет комментариев</div>';
        
        const loadingHtml = this.loading
            ? '<div class="cover-comments-loading"><div class="spinner"></div></div>'
            : '';
        
        const loadMoreHtml = this.hasMore && !this.loading
            ? '<button class="cover-comments-load-more" data-action="load-more">Показать ещё</button>'
            : '';
        
        this.modal.innerHTML = `
            <div class="cover-comments-content">
                <div class="cover-comments-header">
                    <h3 id="coverCommentsModalTitle" class="cover-comments-title">Комментарии</h3>
                    <button class="cover-comments-close" data-action="close" aria-label="Закрыть">✕</button>
                </div>
                <div class="cover-comments-list">
                    ${commentsHtml}
                    ${loadingHtml}
                    ${loadMoreHtml}
                </div>
                <div class="cover-comments-input-wrapper">
                    <input type="text" class="cover-comments-input" placeholder="Написать комментарий..." data-action="comment-input">
                    <button class="cover-comments-send" data-action="send-comment">Отправить</button>
                </div>
            </div>
        `;
        
        // Attach delegated listeners
        this.attachDelegatedListeners();
    }
    
    /**
     * 🎴 Render a single comment
     */
    renderComment(comment) {
        const user = comment.user || {};
        const userName = user.name || 'Пользователь';
        const telegramUsername = user.telegramUsername;
        const displayName = telegramUsername ? `${userName} · @${telegramUsername}` : userName;
        const avatarUrl = user.avatarUrl || '';
        const userId = user.userId;
        const isLiked = comment.isLiked || false;
        const likesCount = comment.likesCount || 0;
        const createdAt = comment.createdAt ? new Date(comment.createdAt) : new Date();
        const timeStr = this.formatRelativeTime(createdAt);
        const commentId = comment._id || comment.id;
        const isReply = comment.parentId != null;
        
        const avatarHtml = avatarUrl 
            ? `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(userName)}" class="comment-avatar" data-user-id="${userId}">`
            : `<div class="comment-avatar" data-user-id="${userId}" style="background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">👤</div>`;
        
        return `
            <div class="cover-comment ${isReply ? 'cover-comment--reply' : ''}" data-comment-id="${commentId}">
                ${avatarHtml}
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-name" data-user-id="${userId}">${this.escapeHtml(displayName)}</span>
                        <span class="comment-time">${timeStr}</span>
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                    <div class="comment-actions">
                        <button class="comment-action-btn comment-like-btn ${isLiked ? 'liked' : ''}" 
                                data-action="like-comment" 
                                data-comment-id="${commentId}"
                                data-post-id="${this.postId}">
                            ${isLiked ? '❤️' : '🤍'} ${likesCount > 0 ? likesCount : ''}
                        </button>
                        <button class="comment-action-btn comment-reply-btn" 
                                data-action="reply-comment" 
                                data-comment-id="${commentId}">
                            Ответить
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * ⏱️ Format relative time
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин назад`;
        if (hours < 24) return `${hours} ч назад`;
        if (days === 1) return 'вчера';
        if (days < 7) return `${days} дн назад`;
        
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
    
    /**
     * 🔒 Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 🎯 Attach delegated event listeners
     */
    attachDelegatedListeners() {
        if (!this.modal) return;
        
        this.modal.addEventListener('click', async (event) => {
            const target = event.target;
            const action = target.dataset.action;
            
            if (action === 'close') {
                this.close();
            } else if (action === 'load-more') {
                await this.loadComments(true);
            } else if (action === 'send-comment') {
                await this.sendComment();
            } else if (action === 'like-comment') {
                const commentId = target.dataset.commentId;
                const postId = target.dataset.postId;
                await this.likeComment(commentId, postId, target);
            } else if (action === 'reply-comment') {
                const commentId = target.dataset.commentId;
                this.replyToComment(commentId);
            } else if (target.dataset.userId) {
                // Open profile modal
                event.preventDefault();
                const userId = target.dataset.userId;
                if (this.profileModal && typeof this.profileModal.open === 'function') {
                    this.profileModal.open(userId);
                }
            }
        });
        
        // Handle Enter key in input
        const input = this.modal.querySelector('[data-action="comment-input"]');
        if (input) {
            input.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.sendComment();
                }
            });
        }
    }
    
    /**
     * 📤 Send a new comment
     */
    async sendComment() {
        const input = this.modal.querySelector('[data-action="comment-input"]');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        // Get parentId if replying
        const parentId = input.dataset.replyTo || null;
        
        try {
            const response = await this.api.addCoverComment(this.postId, text, parentId);
            
            if (response.success) {
                // Clear input
                input.value = '';
                input.dataset.replyTo = '';
                input.placeholder = 'Написать комментарий...';
                
                // Reload comments
                await this.loadComments();
                
                // Trigger haptic feedback
                if (this.telegram?.HapticFeedback) {
                    this.telegram.HapticFeedback.notificationOccurred('success');
                }
            }
        } catch (error) {
            console.error('Error sending comment:', error);
            
            // Trigger error haptic
            if (this.telegram?.HapticFeedback) {
                this.telegram.HapticFeedback.notificationOccurred('error');
            }
        }
    }
    
    /**
     * ❤️ Like/unlike a comment
     */
    async likeComment(commentId, postId, buttonElement) {
        const comment = this.comments.find(c => (c._id || c.id) === commentId);
        if (!comment) return;
        
        // Store original state
        const originalLiked = comment.isLiked || false;
        const originalCount = comment.likesCount || 0;
        
        // Optimistic update
        comment.isLiked = !originalLiked;
        comment.likesCount = comment.isLiked ? originalCount + 1 : Math.max(0, originalCount - 1);
        
        // Update UI
        buttonElement.classList.toggle('liked', comment.isLiked);
        buttonElement.innerHTML = `${comment.isLiked ? '❤️' : '🤍'} ${comment.likesCount > 0 ? comment.likesCount : ''}`;
        
        try {
            const response = await this.api.likeCoverComment(postId, commentId);
            
            if (response.success) {
                // Reconcile with server
                comment.isLiked = response.liked;
                comment.likesCount = response.likesCount;
                
                buttonElement.classList.toggle('liked', comment.isLiked);
                buttonElement.innerHTML = `${comment.isLiked ? '❤️' : '🤍'} ${comment.likesCount > 0 ? comment.likesCount : ''}`;
                
                // Trigger haptic feedback
                if (this.telegram?.HapticFeedback) {
                    this.telegram.HapticFeedback.impactOccurred('light');
                }
            }
        } catch (error) {
            console.error('Error liking comment:', error);
            
            // Rollback
            comment.isLiked = originalLiked;
            comment.likesCount = originalCount;
            buttonElement.classList.toggle('liked', originalLiked);
            buttonElement.innerHTML = `${originalLiked ? '❤️' : '🤍'} ${originalCount > 0 ? originalCount : ''}`;
        }
    }
    
    /**
     * 💬 Reply to a comment
     */
    replyToComment(commentId) {
        const input = this.modal.querySelector('[data-action="comment-input"]');
        if (!input) return;
        
        const comment = this.comments.find(c => (c._id || c.id) === commentId);
        if (!comment) return;
        
        const userName = comment.user?.name || 'Пользователь';
        
        input.dataset.replyTo = commentId;
        input.placeholder = `Ответить ${userName}...`;
        input.focus();
        
        // Trigger haptic feedback
        if (this.telegram?.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred('light');
        }
    }
    
    /**
     * 📌 Attach event listeners
     */
    attachEventListeners() {
        // Backdrop click to close
        if (this.backdrop) {
            this.backdrop.addEventListener('click', this.boundHandleBackdropClick);
        }
        
        // Escape key to close
        document.addEventListener('keydown', this.boundHandleEscape);
        
        // Telegram back button
        if (this.telegram?.BackButton && !this.backButtonAttached) {
            this.telegram.BackButton.onClick(this.boundHandleBackButton);
            this.telegram.BackButton.show();
            this.backButtonAttached = true;
        }
    }
    
    /**
     * 🗑️ Detach event listeners
     */
    detachEventListeners() {
        if (this.backdrop) {
            this.backdrop.removeEventListener('click', this.boundHandleBackdropClick);
        }
        
        document.removeEventListener('keydown', this.boundHandleEscape);
        
        // Telegram back button
        if (this.telegram?.BackButton && this.backButtonAttached) {
            this.telegram.BackButton.offClick(this.boundHandleBackButton);
            this.telegram.BackButton.hide();
            this.backButtonAttached = false;
        }
    }
    
    /**
     * 🖱️ Handle backdrop click
     */
    handleBackdropClick() {
        this.close();
    }
    
    /**
     * ⌨️ Handle Escape key
     */
    handleEscape(event) {
        if (event.key === 'Escape' && this.isOpen) {
            this.close();
        }
    }
    
    /**
     * ⬅️ Handle Telegram back button
     */
    handleBackButton() {
        this.close();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoverCommentsModal;
}
