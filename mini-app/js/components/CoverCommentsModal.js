/**
 * 📸💬 COVER COMMENTS MODAL - CoverCommentsModal.js
 * 
 * Modal for viewing and interacting with cover post comments
 * 
 * Features:
 * - View comments with pagination
 * - Like/unlike comments
 * - Reply to comments (nested threads)
 * - Avatar/name clickable to open ProfileModal
 * - Comment deduplication
 * 
 * @version 1.0.0
 */

class CoverCommentsModal {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.telegram = app.telegram;
        this.profileModal = app.getProfileModal ? app.getProfileModal() : null;
        
        // Modal state
        this.isOpen = false;
        this.postId = null;
        this.comments = [];
        this.loading = false;
        this.hasMore = false;
        this.nextCursor = null;
        
        // Reply state
        this.replyingTo = null; // { commentId, userName }
        
        // Comments cache
        this._commentsCache = new Map(); // postId → {items, ts}
        
        // Collapsed state for Instagram-style replies
        this._repliesCollapsed = new Map(); // parentId → boolean
        
        // DOM elements
        this.modal = null;
        this.backdrop = null;
        
        // Event handlers
        this.boundHandleBackdropClick = this.handleBackdropClick.bind(this);
        this.boundHandleEscape = this.handleEscape.bind(this);
        this.boundHandleBackButton = this.handleBackButton.bind(this);
        this.boundDelegatedClickHandler = null; // Track delegated click handler
        
        // Track if BackButton handler is attached
        this.backButtonAttached = false;
        
        console.log('✅ CoverCommentsModal: Initialized');
    }
    
    /**
     * 🏗️ Create modal DOM elements
     */
    createModal() {
        if (this.modal) return;
        
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
     * 🎭 Open modal
     * @param {string} postId - Post ID to load comments for
     * @param {Function} updateCountCallback - Callback to update comment count in parent
     */
    async open(postId, updateCountCallback = null) {
        if (!postId) {
            console.error('❌ CoverCommentsModal: No postId provided');
            return;
        }
        
        console.log(`📸 CoverCommentsModal: Opening for post ${postId}`);
        
        this.postId = postId;
        this.nextCursor = null;
        this.hasMore = false;
        this.replyingTo = null;
        this.updateCountCallback = updateCountCallback; // Store callback
        
        // Create modal if needed
        this.createModal();
        
        // Show modal
        this.isOpen = true;
        this.backdrop.style.display = 'block';
        this.modal.style.display = 'block';
        
        // Check cache first - render immediately if available
        const cached = this._commentsCache.get(postId);
        if (cached && cached.items) {
            this.comments = cached.items;
            this.render();
        } else {
            // No cache - show loading state
            this.comments = [];
            this.render();
        }
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Hide Telegram back button and attach our handler
        this.handleTelegramBackButton(true);
        
        // Setup keyboard animation
        this.setupKeyboardAnimation();
        
        // Fetch fresh data with cache-busting
        await this.loadComments();
        
        // Trigger animation
        requestAnimationFrame(() => {
            this.backdrop.classList.add('active');
            this.modal.classList.add('active');
        });
    }
    
    /**
     * 🔒 Close modal
     */
    close() {
        if (!this.isOpen) return;
        
        console.log('📸 CoverCommentsModal: Closing');
        
        // Remove animation classes
        this.backdrop.classList.remove('active');
        this.modal.classList.remove('active');
        
        // Hide after animation
        setTimeout(() => {
            if (this.backdrop) this.backdrop.style.display = 'none';
            if (this.modal) this.modal.style.display = 'none';
            this.isOpen = false;
        }, 300);
        
        // Detach event listeners
        this.detachEventListeners();
        
        // Detach drag gesture
        this.detachDragGesture();
        
        // Cleanup keyboard animation
        this.cleanupKeyboardAnimation();
        
        // Restore Telegram back button
        this.handleTelegramBackButton(false);
        
        // Clear state
        this.postId = null;
        this.comments = [];
        this.replyingTo = null;
    }
    
    /**
     * 📥 Load comments for the post
     * @param {boolean} loadMore - Whether this is a load more request
     */
    async loadComments(loadMore = false) {
        if (this.loading) return;
        if (loadMore && !this.hasMore) return;
        
        this.loading = true;
        
        try {
            const options = { 
                limit: 20,
                ts: Date.now() // Cache-busting timestamp
            };
            if (loadMore && this.nextCursor) {
                options.cursor = this.nextCursor;
            }
            
            const response = await this.api.getCoverComments(this.postId, options);
            
            if (response && response.success) {
                const newComments = response.data || [];
                
                // Deduplicate comments by ID
                const existingIds = new Set(this.comments.map(c => c._id || c.id));
                const uniqueNewComments = newComments.filter(c => {
                    const id = c._id || c.id;
                    if (existingIds.has(id)) return false;
                    existingIds.add(id);
                    return true;
                });
                
                if (loadMore) {
                    this.comments = [...this.comments, ...uniqueNewComments];
                } else {
                    this.comments = uniqueNewComments;
                    
                    // Update cache with fresh data
                    this._commentsCache.set(this.postId, {
                        items: this.comments,
                        ts: Date.now()
                    });
                }
                
                this.hasMore = response.hasMore || false;
                this.nextCursor = response.nextCursor || null;
                
                console.log(`✅ CoverCommentsModal: Loaded ${uniqueNewComments.length} comments (total: ${this.comments.length})`);
                
                // 🔧 HOTFIX: Update comment count in parent card using deduped count
                if (this.updateCountCallback) {
                    this.updateCountCallback(this.comments.length);
                }
            }
        } catch (error) {
            console.error('❌ CoverCommentsModal: Failed to load comments:', error);
            if (window.app && window.app.showToast) {
                window.app.showToast('Ошибка загрузки комментариев', 'error');
            }
        } finally {
            this.loading = false;
            this.render();
        }
    }
    
    /**
     * 🎨 Render modal content
     */
    render() {
        if (!this.modal) return;
        
        const commentsHtml = this.renderComments();
        const replyFormHtml = this.renderReplyForm();
        
        this.modal.innerHTML = `
            <div class="cover-comments-modal__content">
                <div class="cover-comments-modal__header">
                    <div class="cover-comments-modal__handle"></div>
                    <h2 id="coverCommentsTitle" class="cover-comments-modal__title">Комментарии</h2>
                    <button class="cover-comments-modal__close" aria-label="Закрыть">✕</button>
                </div>
                <div class="cover-comments-modal__body">
                    ${this.loading && this.comments.length === 0 ? this.renderLoading() : commentsHtml}
                    ${this.hasMore && !this.loading ? '<button class="cover-comments-modal__load-more">Показать ещё</button>' : ''}
                    ${this.loading && this.comments.length > 0 ? '<div class="cover-comments-modal__loading-more">Загрузка...</div>' : ''}
                </div>
                ${replyFormHtml}
            </div>
        `;
        
        // Reattach event listeners after render
        if (this.isOpen) {
            this.attachInternalListeners();
            this.attachDragGesture();
        }
    }
    
    /**
     * 📝 Render loading state
     */
    renderLoading() {
        return `
            <div class="cover-comments-modal__loading">
                <div class="spinner"></div>
                <div style="margin-top: 12px; color: var(--text-secondary);">Загрузка комментариев...</div>
            </div>
        `;
    }
    
    /**
     * 💬 Render comments list
     */
    renderComments() {
        if (this.comments.length === 0 && !this.loading) {
            return `
                <div class="cover-comments-modal__empty">
                    <div class="cover-comments-modal__empty-icon">💬</div>
                    <div class="cover-comments-modal__empty-text">Пока нет комментариев</div>
                </div>
            `;
        }
        
        // Organize comments into threads
        const threads = this.organizeThreads();
        
        return `
            <div class="cover-comments-list">
                ${threads.map(thread => this.renderThread(thread)).join('')}
            </div>
        `;
    }
    
    /**
     * 🧵 Organize comments into threads (parent-reply structure)
     */
    organizeThreads() {
        const topLevel = [];
        const repliesMap = new Map();
        
        // First pass: separate top-level comments and replies
        this.comments.forEach(comment => {
            if (comment.parentId) {
                // This is a reply
                if (!repliesMap.has(comment.parentId)) {
                    repliesMap.set(comment.parentId, []);
                }
                repliesMap.get(comment.parentId).push(comment);
            } else {
                // This is a top-level comment
                topLevel.push(comment);
            }
        });
        
        // Build threads
        return topLevel.map(parent => ({
            parent,
            replies: repliesMap.get(parent._id || parent.id) || []
        }));
    }
    
    /**
     * 🧵 Render a comment thread (parent + replies)
     */
    renderThread(thread) {
        const parentHtml = this.renderComment(thread.parent, false);
        const parentId = thread.parent._id || thread.parent.id;
        const replyCount = thread.replies.length;
        const isCollapsed = this._repliesCollapsed.get(parentId) !== false; // Default collapsed
        
        let repliesSection = '';
        if (replyCount > 0) {
            if (isCollapsed) {
                // Show "View replies" button
                const replyText = this.getReplyCountText(replyCount);
                repliesSection = `
                    <div class="comment-replies-toggle">
                        <button class="comment-replies-toggle__btn" 
                                data-action="expand-replies" 
                                data-parent-id="${parentId}">
                            ${replyText}
                        </button>
                    </div>`;
            } else {
                // Show replies + "Hide replies" button
                const repliesHtml = thread.replies.map(reply => this.renderComment(reply, true)).join('');
                repliesSection = `
                    <div class="comment-replies">${repliesHtml}</div>
                    <div class="comment-replies-toggle">
                        <button class="comment-replies-toggle__btn" 
                                data-action="collapse-replies" 
                                data-parent-id="${parentId}">
                            Скрыть ответы
                        </button>
                    </div>`;
            }
        }
        
        return `
            <div class="comment-thread">
                ${parentHtml}
                ${repliesSection}
            </div>
        `;
    }
    
    /**
     * 📝 Get reply count text with pluralization
     */
    getReplyCountText(count) {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
            return `Посмотреть ${count} ответов`;
        } else if (lastDigit === 1) {
            return `Посмотреть ${count} ответ`;
        } else if (lastDigit >= 2 && lastDigit <= 4) {
            return `Посмотреть ${count} ответа`;
        } else {
            return `Посмотреть ${count} ответов`;
        }
    }
    
    /**
     * 💬 Render a single comment
     * @param {Object} comment - Comment object
     * @param {boolean} isReply - Whether this is a reply (affects styling)
     */
    renderComment(comment, isReply = false) {
        const user = comment.user || {};
        const userId = user.userId || '';
        const displayName = this.getDisplayName(user);
        const avatarUrl = user.avatarUrl || '';
        const timeStr = comment.createdAt ? this.formatRelativeTime(new Date(comment.createdAt)) : '';
        const likesCount = comment.likesCount || 0;
        const liked = comment.liked || false;
        const commentId = comment._id || comment.id;
        
        // Check if this is the current user's comment
        const currentUserId = this.api && typeof this.api.resolveUserId === 'function' ? this.api.resolveUserId() : null;
        const isOwnComment = currentUserId && userId && currentUserId === userId;
        
        const avatarHtml = avatarUrl 
            ? `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(displayName)}" class="comment__avatar" data-user-id="${userId}">`
            : `<div class="comment__avatar comment__avatar--placeholder" data-user-id="${userId}">👤</div>`;
        
        return `
            <div class="comment ${isReply ? 'comment--reply' : ''}" data-comment-id="${commentId}">
                ${avatarHtml}
                <div class="comment__content">
                    <div class="comment__header">
                        <span class="comment__name" data-user-id="${userId}">${displayName}</span>
                        <span class="comment__time">${timeStr}</span>
                    </div>
                    <div class="comment__text">${this.escapeHtml(comment.text)}</div>
                    <div class="comment__actions">
                        <button class="comment__action-btn comment__like-btn${liked ? ' liked' : ''}" 
                                data-action="like-comment" 
                                data-comment-id="${commentId}"
                                data-liked="${liked}">
                            ❤️ <span class="comment__like-count">${likesCount}</span>
                        </button>
                        ${!isReply ? `<button class="comment__action-btn comment__reply-btn" 
                                data-action="reply" 
                                data-comment-id="${commentId}"
                                data-user-name="${this.escapeHtml(user.name || 'Пользователь')}">
                            Ответить
                        </button>` : ''}
                    </div>
                </div>
                ${isOwnComment ? `<button class="comment__delete-btn" data-action="delete-comment" data-comment-id="${commentId}" title="Удалить" aria-label="Удалить комментарий">🗑️</button>` : ''}
            </div>
        `;
    }
    
    /**
     * ✍️ Render reply form
     */
    renderReplyForm() {
        const placeholder = this.replyingTo 
            ? `Ответ для ${this.replyingTo.userName}...`
            : 'Написать комментарий...';
        
        const cancelBtn = this.replyingTo 
            ? '<button class="reply-form__cancel" data-action="cancel-reply">Отмена</button>'
            : '';
        
        return `
            <div class="cover-comments-modal__reply-form">
                <div class="reply-form">
                    ${cancelBtn}
                    <textarea class="reply-form__input" 
                              placeholder="${placeholder}"
                              maxlength="500"
                              rows="2"></textarea>
                    <button class="reply-form__submit" data-action="submit-reply">
                        Отправить
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 📝 Get display name with username
     */
    getDisplayName(user) {
        if (!user) return 'Пользователь';
        const name = user.name || 'Пользователь';
        const username = user.telegramUsername;
        if (username) {
            return `${name} · @${username}`;
        }
        return name;
    }
    
    /**
     * ⏰ Format relative time
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) return 'только что';
        if (diffMin < 60) return `${diffMin}м назад`;
        if (diffHour < 24) return `${diffHour}ч назад`;
        if (diffDay === 1) return 'вчера';
        if (diffDay < 7) return `${diffDay}д назад`;
        
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
    
    /**
     * 🔐 Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 🎯 Attach event listeners
     */
    attachEventListeners() {
        this.backdrop.addEventListener('click', this.boundHandleBackdropClick);
        document.addEventListener('keydown', this.boundHandleEscape);
    }
    
    /**
     * 🎯 Attach internal listeners (for modal content)
     */
    attachInternalListeners() {
        // Close button
        const closeBtn = this.modal.querySelector('.cover-comments-modal__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Load more button
        const loadMoreBtn = this.modal.querySelector('.cover-comments-modal__load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadComments(true));
        }
        
        // Remove old delegated click handler to prevent duplicates
        if (this.boundDelegatedClickHandler) {
            this.modal.removeEventListener('click', this.boundDelegatedClickHandler);
        }
        
        // Create new delegated click handler
        this.boundDelegatedClickHandler = (e) => {
            const target = e.target;
            
            // Delete comment
            if (target.dataset.action === 'delete-comment' || target.closest('[data-action="delete-comment"]')) {
                e.preventDefault();
                const btn = target.dataset.action === 'delete-comment' ? target : target.closest('[data-action="delete-comment"]');
                this.handleDeleteComment(btn);
                return;
            }
            
            // Like comment
            if (target.dataset.action === 'like-comment' || target.closest('[data-action="like-comment"]')) {
                e.preventDefault();
                const btn = target.dataset.action === 'like-comment' ? target : target.closest('[data-action="like-comment"]');
                this.handleLikeComment(btn);
                return;
            }
            
            // Reply to comment
            if (target.dataset.action === 'reply' || target.closest('[data-action="reply"]')) {
                e.preventDefault();
                const btn = target.dataset.action === 'reply' ? target : target.closest('[data-action="reply"]');
                this.handleReply(btn);
                return;
            }
            
            // Expand replies
            if (target.dataset.action === 'expand-replies' || target.closest('[data-action="expand-replies"]')) {
                e.preventDefault();
                const btn = target.dataset.action === 'expand-replies' ? target : target.closest('[data-action="expand-replies"]');
                const parentId = btn.dataset.parentId;
                if (parentId) {
                    this._repliesCollapsed.set(parentId, false);
                    this.render();
                }
                return;
            }
            
            // Collapse replies
            if (target.dataset.action === 'collapse-replies' || target.closest('[data-action="collapse-replies"]')) {
                e.preventDefault();
                const btn = target.dataset.action === 'collapse-replies' ? target : target.closest('[data-action="collapse-replies"]');
                const parentId = btn.dataset.parentId;
                if (parentId) {
                    this._repliesCollapsed.set(parentId, true);
                    this.render();
                }
                return;
            }
            
            // Submit reply
            if (target.dataset.action === 'submit-reply') {
                e.preventDefault();
                this.handleSubmitReply();
                return;
            }
            
            // Cancel reply
            if (target.dataset.action === 'cancel-reply') {
                e.preventDefault();
                this.replyingTo = null;
                this.render();
                return;
            }
            
            // Open profile modal
            const userElement = target.closest('[data-user-id]');
            if (userElement && !target.closest('button')) {
                e.preventDefault();
                const userId = userElement.dataset.userId;
                if (userId && this.profileModal) {
                    this.profileModal.open(userId);
                }
                return;
            }
        };
        
        // Attach delegated click handler
        this.modal.addEventListener('click', this.boundDelegatedClickHandler);
    }
    
    /**
     * 🎯 Detach event listeners
     */
    detachEventListeners() {
        this.backdrop.removeEventListener('click', this.boundHandleBackdropClick);
        document.removeEventListener('keydown', this.boundHandleEscape);
        
        // Remove delegated click handler
        if (this.boundDelegatedClickHandler && this.modal) {
            this.modal.removeEventListener('click', this.boundDelegatedClickHandler);
            this.boundDelegatedClickHandler = null;
        }
    }
    
    /**
     * ❤️ Handle like comment
     */
    async handleLikeComment(button) {
        if (!button) return;
        
        const commentId = button.dataset.commentId;
        const wasLiked = button.dataset.liked === 'true';
        const likeCountSpan = button.querySelector('.comment__like-count');
        
        // Optimistic UI update
        button.dataset.liked = wasLiked ? 'false' : 'true';
        button.classList.toggle('liked', !wasLiked);
        
        const currentCount = parseInt(likeCountSpan?.textContent || '0');
        const newCount = wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
        if (likeCountSpan) {
            likeCountSpan.textContent = newCount;
        }
        
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        try {
            const response = await this.api.likeCoverComment(this.postId, commentId);
            
            if (response && response.success) {
                // Update with server response
                button.dataset.liked = response.liked ? 'true' : 'false';
                button.classList.toggle('liked', response.liked);
                if (likeCountSpan) {
                    likeCountSpan.textContent = response.likesCount || 0;
                }
                
                // Update in local state
                const comment = this.comments.find(c => (c._id || c.id) === commentId);
                if (comment) {
                    comment.liked = response.liked;
                    comment.likesCount = response.likesCount || 0;
                }
            }
        } catch (error) {
            console.error('❌ CoverCommentsModal: Failed to like comment:', error);
            
            // Revert optimistic update
            button.dataset.liked = wasLiked ? 'true' : 'false';
            button.classList.toggle('liked', wasLiked);
            if (likeCountSpan) {
                likeCountSpan.textContent = currentCount;
            }
        }
    }
    
    /**
     * 💬 Handle reply to comment
     */
    handleReply(button) {
        if (!button) return;
        
        const commentId = button.dataset.commentId;
        const userName = button.dataset.userName;
        
        this.replyingTo = { commentId, userName };
        this.render();
        
        // Focus on textarea and prefill with @username
        requestAnimationFrame(() => {
            const textarea = this.modal.querySelector('.reply-form__input');
            if (textarea) {
                textarea.value = `@${userName} `;
                textarea.focus();
                // Move cursor to end
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        });
        
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
    }
    
    /**
     * 📤 Handle submit reply
     */
    async handleSubmitReply() {
        const textarea = this.modal.querySelector('.reply-form__input');
        const submitBtn = this.modal.querySelector('.reply-form__submit');
        
        if (!textarea) return;
        
        const text = textarea.value.trim();
        if (!text) return;
        
        // Guard: check if button is already disabled
        if (submitBtn && submitBtn.disabled) {
            return;
        }
        
        const parentId = this.replyingTo?.commentId || null;
        
        try {
            // Disable button and textarea while pending
            if (textarea) textarea.disabled = true;
            if (submitBtn) submitBtn.disabled = true;
            
            const response = await this.api.addCoverComment(this.postId, text, parentId);
            
            if (response && response.success) {
                // Add new comment to list
                const newComment = response.data;
                this.comments.unshift(newComment);
                
                // Update cache
                this._commentsCache.set(this.postId, {
                    items: this.comments,
                    ts: Date.now()
                });
                
                // Update comment count in parent card
                if (this.updateCountCallback) {
                    this.updateCountCallback(this.comments.length);
                }
                
                // Clear input
                textarea.value = '';
                this.replyingTo = null;
                
                // Rerender
                this.render();
                
                // Show success toast
                if (window.app && window.app.showToast) {
                    window.app.showToast('Комментарий добавлен', 'success');
                }
                
                // Haptic feedback
                if (this.telegram?.hapticFeedback) {
                    this.telegram.hapticFeedback('success');
                }
            }
        } catch (error) {
            console.error('❌ CoverCommentsModal: Failed to add comment:', error);
            if (window.app && window.app.showToast) {
                window.app.showToast('Ошибка добавления комментария', 'error');
            }
        } finally {
            // Re-enable controls
            if (textarea) textarea.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    }
    
    /**
     * 🗑️ Handle delete comment
     */
    async handleDeleteComment(button) {
        if (!button) return;
        
        const commentId = button.dataset.commentId;
        if (!commentId) return;
        
        // 🔧 HOTFIX: Use non-blocking Telegram.WebApp.showConfirm (with fallback)
        const showConfirm = (message) => {
            return new Promise((resolve) => {
                if (window.Telegram?.WebApp?.showConfirm) {
                    window.Telegram.WebApp.showConfirm(message, resolve);
                } else {
                    // Fallback to blocking confirm if Telegram API not available
                    resolve(confirm(message));
                }
            });
        };
        
        const confirmed = await showConfirm('Удалить комментарий?');
        if (!confirmed) return;
        
        try {
            // Optimistically remove from UI
            const commentElement = button.closest('.comment');
            if (commentElement) {
                commentElement.style.opacity = '0.5';
                commentElement.style.pointerEvents = 'none';
            }
            
            // Call API to delete
            const response = await this.api.deleteCoverComment(this.postId, commentId);
            
            if (response && response.success) {
                // Remove from local state
                this.comments = this.comments.filter(c => (c._id || c.id) !== commentId);
                
                // Update comment count in parent card
                if (this.updateCountCallback) {
                    this.updateCountCallback(this.comments.length);
                }
                
                // Rerender
                this.render();
                
                // Show success toast
                if (window.app && window.app.showToast) {
                    window.app.showToast('Комментарий удален', 'success');
                }
                
                // Haptic feedback
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
            } else {
                throw new Error(response?.error || 'Failed to delete comment');
            }
        } catch (error) {
            console.error('❌ CoverCommentsModal: Failed to delete comment:', error);
            
            // Restore comment element
            const commentElement = button.closest('.comment');
            if (commentElement) {
                commentElement.style.opacity = '1';
                commentElement.style.pointerEvents = 'auto';
            }
            
            if (window.app && window.app.showToast) {
                window.app.showToast('Ошибка удаления комментария', 'error');
            }
        }
    }
    
    /**
     * 👆 Handle backdrop click
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
     * ◀️ Handle Telegram back button
     */
    handleBackButton() {
        this.close();
    }
    
    /**
     * 🔧 Handle Telegram back button visibility
     */
    handleTelegramBackButton(show) {
        if (!this.telegram?.BackButton) return;
        
        if (show && !this.backButtonAttached) {
            this.telegram.BackButton.show();
            this.telegram.BackButton.onClick(this.boundHandleBackButton);
            this.backButtonAttached = true;
        } else if (!show && this.backButtonAttached) {
            this.telegram.BackButton.offClick(this.boundHandleBackButton);
            this.telegram.BackButton.hide();
            this.backButtonAttached = false;
        }
    }
    
    /**
     * 🧹 Cleanup
     */
    destroy() {
        this.close();
        
        // Cleanup drag gesture
        this.detachDragGesture();
        
        // Cleanup keyboard animation
        this.cleanupKeyboardAnimation();
        
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
        
        console.log('🧹 CoverCommentsModal: Destroyed');
    }
    
    /**
     * 📱 Attach drag gesture for bottom sheet (mobile)
     */
    attachDragGesture() {
        if (!this.modal) return;
        
        // Only enable drag on mobile
        if (window.innerWidth > 820) return;
        
        const handle = this.modal.querySelector('.cover-comments-modal__handle');
        const header = this.modal.querySelector('.cover-comments-modal__header');
        const body = this.modal.querySelector('.cover-comments-modal__body');
        
        if (!handle || !header || !body) return;
        
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let isExpanded = false;
        
        const handleTouchStart = (e) => {
            // Only drag from handle or when body is scrolled to top
            const isHandle = e.target.closest('.cover-comments-modal__handle');
            const isHeader = e.target.closest('.cover-comments-modal__header');
            const bodyAtTop = body.scrollTop === 0;
            
            if (!isHandle && !isHeader && !bodyAtTop) return;
            
            startY = e.touches[0].clientY;
            isDragging = true;
            this.modal.style.transition = 'none';
        };
        
        const handleTouchMove = (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            // Only allow downward drag or upward drag if not expanded
            if (deltaY > 0 || (!isExpanded && deltaY < 0)) {
                e.preventDefault();
                
                if (deltaY > 0) {
                    // Drag down to close
                    this.modal.style.transform = `translateY(${deltaY}px)`;
                } else if (!isExpanded) {
                    // Drag up to expand
                    const maxHeight = window.innerHeight - 20;
                    const currentHeight = this.modal.offsetHeight;
                    const expansion = Math.min(Math.abs(deltaY), maxHeight - currentHeight);
                    this.modal.style.height = `${currentHeight + expansion}px`;
                }
            }
        };
        
        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            const deltaY = currentY - startY;
            
            this.modal.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            
            // Close if dragged down more than 100px
            if (deltaY > 100) {
                this.close();
            } 
            // Expand if dragged up more than 50px
            else if (deltaY < -50 && !isExpanded) {
                isExpanded = true;
                this.modal.classList.add('expanded');
                this.modal.style.transform = 'translateY(0)';
                this.modal.style.height = '';
            } 
            // Reset position
            else {
                this.modal.style.transform = 'translateY(0)';
                this.modal.style.height = '';
            }
        };
        
        // Attach touch events to header for dragging
        header.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
        
        // Store handlers for cleanup
        this._dragHandlers = {
            touchstart: handleTouchStart,
            touchmove: handleTouchMove,
            touchend: handleTouchEnd,
            header,
            document
        };
    }
    
    /**
     * 🧹 Detach drag gesture
     */
    detachDragGesture() {
        if (!this._dragHandlers) return;
        
        const { header, touchstart, touchmove, touchend } = this._dragHandlers;
        
        if (header) {
            header.removeEventListener('touchstart', touchstart);
        }
        document.removeEventListener('touchmove', touchmove);
        document.removeEventListener('touchend', touchend);
        
        this._dragHandlers = null;
    }
    
    /**
     * ⌨️ Handle keyboard showing/hiding with smooth animation
     */
    setupKeyboardAnimation() {
        if (!window.visualViewport) return;
        
        const handleResize = () => {
            if (!this.isOpen || !this.modal) return;
            
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight - viewportHeight;
            
            // Keyboard is showing
            if (keyboardHeight > 100) {
                const replyForm = this.modal.querySelector('.cover-comments-modal__reply-form');
                if (replyForm) {
                    replyForm.style.transform = `translateY(-${keyboardHeight}px)`;
                }
            } else {
                // Keyboard is hidden
                const replyForm = this.modal.querySelector('.cover-comments-modal__reply-form');
                if (replyForm) {
                    replyForm.style.transform = 'translateY(0)';
                }
            }
        };
        
        window.visualViewport.addEventListener('resize', handleResize);
        this._viewportResizeHandler = handleResize;
    }
    
    /**
     * 🧹 Cleanup keyboard animation
     */
    cleanupKeyboardAnimation() {
        if (this._viewportResizeHandler && window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this._viewportResizeHandler);
            this._viewportResizeHandler = null;
        }
    }
}
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CoverCommentsModal = CoverCommentsModal;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoverCommentsModal;
}
