/**
 * 💬 COVER COMMENTS MODAL - CoverCommentsModal.js
 * 
 * Modal for viewing and interacting with cover post comments
 * Supports likes, replies (nested threads), and pagination
 * 
 * Features:
 * - Load and display comments with pagination
 * - Deduplicated comment list by _id
 * - Avatar + "Имя · @username" + relative time
 * - Clickable avatar/name to open ProfileModal
 * - Like button with counter (optimistic toggle)
 * - Reply functionality (nested threads)
 * - Comment input with post handler
 * 
 * @version 1.0.0
 */

class CoverCommentsModal {
    constructor({ postId, api, telegram, profileModal, onCommentAdded }) {
        this.postId = postId;
        this.api = api;
        this.telegram = telegram;
        this.profileModal = profileModal;
        this.onCommentAdded = onCommentAdded;
        
        // Modal state
        this.isOpen = false;
        this.comments = []; // Flat list with parentId
        this.commentsMap = new Map(); // Map by _id for deduplication
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
        this.boundHandleDelegatedClick = this.handleDelegatedClick.bind(this);
        
        console.log('✅ CoverCommentsModal: Initialized for post', postId);
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
        this.modal.setAttribute('aria-labelledby', 'coverCommentsTitle');
        
        // Add to document
        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.modal);
        
        console.log('✅ CoverCommentsModal: DOM elements created');
    }
    
    /**
     * 📂 Open modal
     */
    async open() {
        console.log('📂 CoverCommentsModal: Opening for post', this.postId);
        
        // Create modal if needed
        this.createModal();
        
        // Mark as open
        this.isOpen = true;
        
        // Show modal with loading state
        this.renderLoading();
        this.backdrop.style.display = 'block';
        this.modal.style.display = 'flex';
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Load comments
        await this.loadComments();
        
        // Telegram BackButton
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.show();
            this.telegram.BackButton.onClick(this.boundHandleBackButton);
        }
    }
    
    /**
     * 🚪 Close modal
     */
    close() {
        console.log('🚪 CoverCommentsModal: Closing');
        
        this.isOpen = false;
        
        if (this.modal) this.modal.style.display = 'none';
        if (this.backdrop) this.backdrop.style.display = 'none';
        
        // Detach event listeners
        this.detachEventListeners();
        
        // Hide Telegram BackButton
        if (this.telegram?.BackButton) {
            this.telegram.BackButton.offClick(this.boundHandleBackButton);
            this.telegram.BackButton.hide();
        }
    }
    
    /**
     * 📥 Load comments from API
     */
    async loadComments(append = false) {
        if (this.loading) return;
        
        this.loading = true;
        
        try {
            const options = { limit: 20 };
            if (this.cursor) options.cursor = this.cursor;
            
            const response = await this.api.getCoverComments(this.postId, options);
            
            if (response && response.success) {
                const newComments = response.data || [];
                
                // Deduplicate by _id
                newComments.forEach(comment => {
                    if (!this.commentsMap.has(comment._id)) {
                        this.commentsMap.set(comment._id, comment);
                    }
                });
                
                // Convert map to array
                this.comments = Array.from(this.commentsMap.values());
                
                // Sort by createdAt descending (newest first)
                this.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                this.hasMore = response.hasMore || false;
                this.cursor = response.nextCursor || null;
                
                // Render comments
                this.render();
            } else {
                throw new Error(response?.error || 'Failed to load comments');
            }
        } catch (error) {
            console.error('❌ CoverCommentsModal: Failed to load comments:', error);
            this.renderError('Ошибка загрузки комментариев');
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 🎨 Render loading state
     */
    renderLoading() {
        if (!this.modal) return;
        
        this.modal.innerHTML = `
            <div class="cover-comments-container">
                <div class="cover-comments-header">
                    <h2 id="coverCommentsTitle">Комментарии</h2>
                    <button class="modal-close-btn" data-action="close-modal">✕</button>
                </div>
                <div class="cover-comments-body">
                    <div class="loading-indicator" style="text-align: center; padding: 40px;">
                        <div class="spinner"></div>
                        <div style="margin-top: 12px; color: var(--text-secondary);">Загрузка...</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎨 Render error state
     */
    renderError(message) {
        if (!this.modal) return;
        
        this.modal.innerHTML = `
            <div class="cover-comments-container">
                <div class="cover-comments-header">
                    <h2 id="coverCommentsTitle">Комментарии</h2>
                    <button class="modal-close-btn" data-action="close-modal">✕</button>
                </div>
                <div class="cover-comments-body">
                    <div class="error-state" style="text-align: center; padding: 40px; color: var(--error-color);">
                        ${this.escapeHtml(message)}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎨 Render comments
     */
    render() {
        if (!this.modal) return;
        
        // Organize comments into threads (parent -> replies)
        const threads = this.organizeThreads();
        const commentsHtml = threads.map(thread => this.renderThread(thread)).join('');
        
        const emptyState = this.comments.length === 0 
            ? '<div class="empty-state">Пока нет комментариев. Будьте первым!</div>'
            : '';
        
        this.modal.innerHTML = `
            <div class="cover-comments-container">
                <div class="cover-comments-header">
                    <h2 id="coverCommentsTitle">Комментарии</h2>
                    <button class="modal-close-btn" data-action="close-modal">✕</button>
                </div>
                <div class="cover-comments-body">
                    ${emptyState}
                    <div class="comments-list">
                        ${commentsHtml}
                    </div>
                    ${this.hasMore ? '<button class="load-more-btn" data-action="load-more">Показать ещё</button>' : ''}
                </div>
                <div class="cover-comments-footer">
                    <input 
                        type="text" 
                        class="comment-input" 
                        placeholder="Добавить комментарий..." 
                        id="newCommentInput"
                        maxlength="500"
                    />
                    <button class="comment-send-btn" data-action="post-comment">Отправить</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 🧵 Organize comments into threads
     */
    organizeThreads() {
        const threads = [];
        const repliesMap = new Map(); // parentId -> [replies]
        
        // Group replies by parentId
        this.comments.forEach(comment => {
            if (comment.parentId) {
                if (!repliesMap.has(comment.parentId)) {
                    repliesMap.set(comment.parentId, []);
                }
                repliesMap.get(comment.parentId).push(comment);
            }
        });
        
        // Build threads (parent + replies)
        this.comments.forEach(comment => {
            if (!comment.parentId) {
                // This is a parent comment
                const replies = repliesMap.get(comment._id) || [];
                threads.push({
                    parent: comment,
                    replies: replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) // Oldest reply first
                });
            }
        });
        
        return threads;
    }
    
    /**
     * 🎨 Render a comment thread (parent + replies)
     */
    renderThread(thread) {
        const { parent, replies } = thread;
        const parentHtml = this.renderComment(parent, false);
        const repliesHtml = replies.map(reply => this.renderComment(reply, true)).join('');
        
        return `
            <div class="comment-thread" data-comment-id="${parent._id}">
                ${parentHtml}
                ${repliesHtml ? `<div class="comment-replies">${repliesHtml}</div>` : ''}
            </div>
        `;
    }
    
    /**
     * 🎨 Render a single comment
     */
    renderComment(comment, isReply = false) {
        const user = comment.user || {};
        const userId = user.userId || '';
        const displayName = this.getDisplayName(user);
        const avatarHtml = this.getAvatarHtml(user, userId);
        const createdAt = comment.createdAt ? new Date(comment.createdAt) : new Date();
        const timeStr = this.formatRelativeTime(createdAt);
        const likesCount = comment.likesCount || 0;
        const liked = comment.liked || false;
        
        return `
            <div class="comment-item ${isReply ? 'comment-reply' : ''}" data-comment-id="${comment._id}">
                <div class="comment-header">
                    ${avatarHtml}
                    <div class="comment-user-info">
                        <div class="comment-user-name" data-user-id="${userId}" style="cursor: pointer;">${displayName}</div>
                        <div class="comment-time">${timeStr}</div>
                    </div>
                </div>
                <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                <div class="comment-actions">
                    <button class="comment-like-btn${liked ? ' liked' : ''}" 
                            data-action="like-comment" 
                            data-comment-id="${comment._id}"
                            data-liked="${liked}">
                        ❤ <span class="like-count">${likesCount}</span>
                    </button>
                    ${!isReply ? `<button class="comment-reply-btn" data-action="reply-comment" data-comment-id="${comment._id}">Ответить</button>` : ''}
                </div>
                <div class="reply-input-container" id="reply-input-${comment._id}" style="display: none;">
                    <input 
                        type="text" 
                        class="reply-input" 
                        placeholder="Написать ответ..." 
                        maxlength="500"
                    />
                    <button class="reply-send-btn" data-action="post-reply" data-parent-id="${comment._id}">Отправить</button>
                    <button class="reply-cancel-btn" data-action="cancel-reply" data-comment-id="${comment._id}">Отмена</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Get display name with username
     */
    getDisplayName(user) {
        if (!user) return 'Пользователь';
        const name = user.name || 'Пользователь';
        const username = user.telegramUsername;
        if (username) {
            return `${this.escapeHtml(name)} · @${this.escapeHtml(username)}`;
        }
        return this.escapeHtml(name);
    }
    
    /**
     * 👤 Get avatar HTML
     */
    getAvatarHtml(user, userId) {
        const safeUserId = userId && /^[a-zA-Z0-9_-]+$/.test(userId) ? userId : '';
        const dataAttrs = safeUserId ? `data-user-id="${safeUserId}" style="cursor: pointer;"` : '';
        
        if (user && user.avatarUrl) {
            return `<img src="${this.escapeHtml(user.avatarUrl)}" 
                         alt="${this.escapeHtml(user.name || 'User')}" 
                         class="comment-avatar" 
                         ${dataAttrs}>`;
        } else {
            const initials = this.getInitials(user?.name || 'Пользователь');
            return `<div class="comment-avatar comment-avatar-initials" ${dataAttrs}>${initials}</div>`;
        }
    }
    
    /**
     * 👤 Get initials from name
     */
    getInitials(name) {
        if (!name || typeof name !== 'string') return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 0) return '?';
        const initials = parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
        return initials || '?';
    }
    
    /**
     * ⏱️ Format relative time
     */
    formatRelativeTime(dateInput) {
        try {
            const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
            const now = new Date();
            const diffMs = now - d;
            const mins = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (mins < 60) return `${mins} мин назад`;
            if (hours < 24) return `${hours} ч назад`;
            if (days === 1) return 'вчера';
            if (days < 7) return `${days} дн назад`;

            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        } catch {
            return '';
        }
    }
    
    /**
     * 🔒 Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 🎯 Attach event listeners
     */
    attachEventListeners() {
        this.backdrop?.addEventListener('click', this.boundHandleBackdropClick);
        document.addEventListener('keydown', this.boundHandleEscape);
        this.modal?.addEventListener('click', this.boundHandleDelegatedClick);
    }
    
    /**
     * 🔌 Detach event listeners
     */
    detachEventListeners() {
        this.backdrop?.removeEventListener('click', this.boundHandleBackdropClick);
        document.removeEventListener('keydown', this.boundHandleEscape);
        this.modal?.removeEventListener('click', this.boundHandleDelegatedClick);
    }
    
    /**
     * 🎯 Handle delegated clicks
     */
    async handleDelegatedClick(event) {
        const target = event.target;
        const action = target.dataset.action || target.closest('[data-action]')?.dataset.action;
        
        if (!action) {
            // Check if clicking on avatar or username to open ProfileModal
            const userElement = target.closest('[data-user-id]');
            if (userElement && !target.closest('button')) {
                const userId = userElement.dataset.userId;
                if (userId && this.profileModal) {
                    this.profileModal.open(userId, false);
                    this.triggerHapticFeedback('light');
                }
            }
            return;
        }
        
        event.preventDefault();
        
        switch (action) {
            case 'close-modal':
                this.close();
                break;
            case 'load-more':
                await this.loadComments(true);
                break;
            case 'post-comment':
                await this.postComment();
                break;
            case 'like-comment':
                const likeBtn = target.closest('[data-action="like-comment"]');
                await this.likeComment(likeBtn);
                break;
            case 'reply-comment':
                this.showReplyInput(target.dataset.commentId);
                break;
            case 'cancel-reply':
                this.hideReplyInput(target.dataset.commentId);
                break;
            case 'post-reply':
                await this.postReply(target.dataset.parentId);
                break;
        }
    }
    
    /**
     * 📝 Post a new comment
     */
    async postComment() {
        const input = document.getElementById('newCommentInput');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        try {
            input.disabled = true;
            
            const response = await this.api.addCoverComment(this.postId, text);
            
            if (response && response.success) {
                input.value = '';
                
                // Add new comment to list
                const newComment = response.data;
                if (!this.commentsMap.has(newComment._id)) {
                    this.commentsMap.set(newComment._id, newComment);
                    this.comments = Array.from(this.commentsMap.values());
                    this.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                }
                
                this.render();
                this.triggerHapticFeedback('medium');
                
                if (this.onCommentAdded) this.onCommentAdded();
                
                if (window.app?.showToast) {
                    window.app.showToast('Комментарий добавлен', 'success');
                }
            }
        } catch (error) {
            console.error('Failed to post comment:', error);
            if (window.app?.showToast) {
                window.app.showToast('Ошибка отправки комментария', 'error');
            }
        } finally {
            if (input) input.disabled = false;
        }
    }
    
    /**
     * ❤️ Like/unlike a comment
     */
    async likeComment(button) {
        if (!button) return;
        
        const commentId = button.dataset.commentId;
        const wasLiked = button.classList.contains('liked');
        const likeCountSpan = button.querySelector('.like-count');
        const currentCount = parseInt(likeCountSpan?.textContent || '0', 10);
        
        try {
            // Optimistic update
            button.classList.toggle('liked');
            if (likeCountSpan) {
                likeCountSpan.textContent = wasLiked ? currentCount - 1 : currentCount + 1;
            }
            button.dataset.liked = wasLiked ? 'false' : 'true';
            
            // API call
            const response = await this.api.likeCoverComment(this.postId, commentId);
            
            if (response && response.success !== undefined) {
                // Update with server response
                if (likeCountSpan) {
                    likeCountSpan.textContent = response.likesCount || 0;
                }
                if (response.liked) {
                    button.classList.add('liked');
                } else {
                    button.classList.remove('liked');
                }
                button.dataset.liked = response.liked ? 'true' : 'false';
                
                // Update local state
                const comment = this.commentsMap.get(commentId);
                if (comment) {
                    comment.likesCount = response.likesCount || 0;
                    comment.liked = response.liked;
                }
                
                this.triggerHapticFeedback('light');
            }
        } catch (error) {
            console.error('Failed to toggle comment like:', error);
            
            // Revert optimistic update
            button.classList.toggle('liked');
            if (likeCountSpan) {
                likeCountSpan.textContent = wasLiked ? currentCount + 1 : currentCount - 1;
            }
            
            if (window.app?.showToast) {
                window.app.showToast('Ошибка обработки лайка', 'error');
            }
        }
    }
    
    /**
     * 💬 Show reply input for a comment
     */
    showReplyInput(commentId) {
        const container = document.getElementById(`reply-input-${commentId}`);
        if (container) {
            container.style.display = 'flex';
            const input = container.querySelector('.reply-input');
            if (input) input.focus();
            this.triggerHapticFeedback('light');
        }
    }
    
    /**
     * 🚫 Hide reply input
     */
    hideReplyInput(commentId) {
        const container = document.getElementById(`reply-input-${commentId}`);
        if (container) {
            container.style.display = 'none';
            const input = container.querySelector('.reply-input');
            if (input) input.value = '';
        }
    }
    
    /**
     * 📝 Post a reply to a comment
     */
    async postReply(parentId) {
        const container = document.getElementById(`reply-input-${parentId}`);
        if (!container) return;
        
        const input = container.querySelector('.reply-input');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        try {
            input.disabled = true;
            
            const response = await this.api.addCoverComment(this.postId, text, parentId);
            
            if (response && response.success) {
                input.value = '';
                this.hideReplyInput(parentId);
                
                // Add new reply to list
                const newReply = response.data;
                if (!this.commentsMap.has(newReply._id)) {
                    this.commentsMap.set(newReply._id, newReply);
                    this.comments = Array.from(this.commentsMap.values());
                    this.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                }
                
                this.render();
                this.triggerHapticFeedback('medium');
                
                if (this.onCommentAdded) this.onCommentAdded();
                
                if (window.app?.showToast) {
                    window.app.showToast('Ответ добавлен', 'success');
                }
            }
        } catch (error) {
            console.error('Failed to post reply:', error);
            if (window.app?.showToast) {
                window.app.showToast('Ошибка отправки ответа', 'error');
            }
        } finally {
            if (input) input.disabled = false;
        }
    }
    
    /**
     * 🎮 Handle backdrop click
     */
    handleBackdropClick(event) {
        if (event.target === this.backdrop) {
            this.close();
        }
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
     * ◀️ Handle Telegram BackButton
     */
    handleBackButton() {
        this.close();
    }
    
    /**
     * 📳 Trigger haptic feedback
     */
    triggerHapticFeedback(type = 'light') {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback(type);
        }
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.CoverCommentsModal = CoverCommentsModal;
}
