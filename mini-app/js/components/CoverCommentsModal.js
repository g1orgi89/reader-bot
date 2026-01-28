/**
 * 📸💬 COVER COMMENTS MODAL - CoverCommentsModal.js (ES5 Compatible)
 * 
 * Bottom sheet modal for viewing and interacting with cover post comments
 * 
 * Features:
 * - Instagram-style bottom sheet behavior
 * - View comments with pagination
 * - Like/unlike comments (optimistic updates)
 * - Reply to comments (nested threads)
 * - Avatar/name clickable to open ProfileModal
 * - ES5 compatible for Telegram WebView
 * 
 * @version 2.0.0
 */

(function() {
    'use strict';
    
    /**
     * CoverCommentsModal Constructor
     * @param {Object} app - App instance
     */
    function CoverCommentsModal(app) {
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
        this._commentsCache = {}; // postId -> {items, ts}
        
        // Collapsed state for Instagram-style replies
        this._repliesCollapsed = {}; // parentId -> boolean
        
        // Bottom sheet state
        this._sheetHeight = 65; // Start at 65dvh
        this._lastScrollTop = 0;
        this._isDragging = false;
        this._likeInProgress = {}; // commentId -> boolean (prevent double-sends)
        
        // DOM elements
        this.modal = null;
        this.backdrop = null;
        this.modalBody = null;
        
        // Event handlers (bound to preserve context)
        this.boundHandleBackdropClick = this.handleBackdropClick.bind(this);
        this.boundHandleEscape = this.handleEscape.bind(this);
        this.boundHandleBackButton = this.handleBackButton.bind(this);
        this.boundHandleScroll = this.handleScroll.bind(this);
        this.boundDelegatedClickHandler = null;
        
        // Track if BackButton handler is attached
        this.backButtonAttached = false;
        
        console.log('✅ CoverCommentsModal: Initialized (ES5)');
    }
    
    /**
     * 🏗️ Create modal DOM elements
     */
    CoverCommentsModal.prototype.createModal = function() {
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
        
        // Set initial sheet height
        this.setSheetHeight(65);
        
        console.log('✅ CoverCommentsModal: DOM elements created');
    };
    
    /**
     * 🎭 Open modal
     * @param {string} postId - Post ID to load comments for
     * @param {Function} updateCountCallback - Callback to update comment count in parent
     * @param {Object} options - Options including initialComments
     */
    CoverCommentsModal.prototype.open = function(postId, updateCountCallback, options) {
        var self = this;
        
        if (!postId) {
            console.error('❌ CoverCommentsModal: No postId provided');
            return;
        }
        
        updateCountCallback = updateCountCallback || null;
        options = options || {};
        
        console.log('📸 CoverCommentsModal: Opening for post ' + postId);
        
        this.postId = postId;
        this.nextCursor = null;
        this.hasMore = false;
        this.replyingTo = null;
        this.updateCountCallback = updateCountCallback;
        this._lastScrollTop = 0;
        
        // Create modal if needed
        this.createModal();
        
        // Show modal
        this.isOpen = true;
        this.backdrop.style.display = 'block';
        this.modal.style.display = 'block';
        
        // Add body class for content shift
        document.body.classList.add('sheet-open');
        
        // Use initial comments if provided for instant UI
        if (options.initialComments && options.initialComments.length > 0) {
            this.comments = options.initialComments;
            this.render();
        } else {
            // Check cache first
            var cached = this._commentsCache[postId];
            if (cached && cached.items) {
                this.comments = cached.items;
                this.render();
            } else {
                // No cache - show loading state
                this.comments = [];
                this.render();
            }
        }
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Hide Telegram back button and attach our handler
        this.handleTelegramBackButton(true);
        
        // Fetch fresh data
        this.loadComments(false);
        
        // Trigger animation
        setTimeout(function() {
            self.backdrop.classList.add('active');
            self.modal.classList.add('active');
        }, 10);
    };
    
    /**
     * 🔒 Close modal
     */
    CoverCommentsModal.prototype.close = function() {
        var self = this;
        
        if (!this.isOpen) return;
        
        console.log('📸 CoverCommentsModal: Closing');
        
        // Remove animation classes
        this.backdrop.classList.remove('active');
        this.modal.classList.remove('active');
        
        // Remove body class
        document.body.classList.remove('sheet-open');
        
        // Hide after animation
        setTimeout(function() {
            if (self.backdrop) self.backdrop.style.display = 'none';
            if (self.modal) self.modal.style.display = 'none';
            self.isOpen = false;
        }, 300);
        
        // Detach event listeners
        this.detachEventListeners();
        
        // Restore Telegram back button
        this.handleTelegramBackButton(false);
        
        // Clear state
        this.postId = null;
        this.comments = [];
        this.replyingTo = null;
        this._likeInProgress = {};
    };
    
    /**
     * 📐 Set sheet height (for bottom sheet behavior)
     */
    CoverCommentsModal.prototype.setSheetHeight = function(heightDvh) {
        // Clamp between 65dvh and 96dvh
        heightDvh = Math.max(65, Math.min(96, heightDvh));
        this._sheetHeight = heightDvh;
        
        // Update CSS variable
        document.documentElement.style.setProperty('--sheet-height', heightDvh + 'dvh');
        
        // Update modal height directly for mobile
        if (this.modal && window.innerWidth <= 480) {
            this.modal.style.height = heightDvh + 'dvh';
        }
    };
    
    /**
     * 📜 Handle scroll for bottom sheet expansion/collapse
     */
    CoverCommentsModal.prototype.handleScroll = function(event) {
        if (!this.modalBody) return;
        if (window.innerWidth > 480) return; // Only on mobile
        
        var scrollTop = this.modalBody.scrollTop;
        var scrollDelta = scrollTop - this._lastScrollTop;
        
        // Scroll up: expand sheet
        if (scrollDelta < 0 && this._sheetHeight < 96) {
            var newHeight = this._sheetHeight + Math.abs(scrollDelta) * 0.1;
            this.setSheetHeight(newHeight);
        }
        
        // Scroll down when at top: close sheet
        if (scrollTop === 0 && scrollDelta > 0) {
            this.close();
            return;
        }
        
        this._lastScrollTop = scrollTop;
    };
    
    /**
     * 📥 Load comments for the post
     * @param {boolean} loadMore - Whether this is a load more request
     */
    CoverCommentsModal.prototype.loadComments = function(loadMore) {
        var self = this;
        
        if (this.loading) return;
        if (loadMore && !this.hasMore) return;
        
        this.loading = true;
        
        var options = { 
            limit: 20,
            ts: Date.now()
        };
        if (loadMore && this.nextCursor) {
            options.cursor = this.nextCursor;
        }
        
        this.api.getCoverComments(this.postId, options)
            .then(function(response) {
                if (response && response.success) {
                    var newComments = response.data || [];
                    
                    // Deduplicate comments by ID
                    var existingIds = {};
                    self.comments.forEach(function(c) {
                        var id = c._id || c.id;
                        existingIds[id] = true;
                    });
                    
                    var uniqueNewComments = newComments.filter(function(c) {
                        var id = c._id || c.id;
                        if (existingIds[id]) return false;
                        existingIds[id] = true;
                        return true;
                    });
                    
                    if (loadMore) {
                        self.comments = self.comments.concat(uniqueNewComments);
                    } else {
                        self.comments = uniqueNewComments;
                        
                        // Update cache with fresh data
                        self._commentsCache[self.postId] = {
                            items: self.comments,
                            ts: Date.now()
                        };
                    }
                    
                    self.hasMore = response.hasMore || false;
                    self.nextCursor = response.nextCursor || null;
                    
                    console.log('✅ CoverCommentsModal: Loaded ' + uniqueNewComments.length + ' comments (total: ' + self.comments.length + ')');
                    
                    // Update comment count in parent card
                    if (self.updateCountCallback) {
                        self.updateCountCallback(self.comments.length);
                    }
                }
                
                self.loading = false;
                self.render();
            })
            .catch(function(error) {
                console.error('❌ CoverCommentsModal: Failed to load comments:', error);
                if (window.app && window.app.showToast) {
                    window.app.showToast('Ошибка загрузки комментариев', 'error');
                }
                
                self.loading = false;
                self.render();
            });
    };
    
    /**
     * 🔄 Update comments list from external source
     * @param {Array} commentsList - New comments list
     */
    CoverCommentsModal.prototype.updateComments = function(commentsList) {
        if (!Array.isArray(commentsList)) return;
        
        this.comments = commentsList;
        
        // Update cache
        if (this.postId) {
            this._commentsCache[this.postId] = {
                items: this.comments,
                ts: Date.now()
            };
        }
        
        // Update count callback
        if (this.updateCountCallback) {
            this.updateCountCallback(this.comments.length);
        }
        
        // Re-render
        this.render();
    };
    
    /**
     * 🎨 Render modal content
     */
    CoverCommentsModal.prototype.render = function() {
        if (!this.modal) return;
        
        var commentsHtml = this.renderComments();
        var replyFormHtml = this.renderReplyForm();
        
        this.modal.innerHTML = 
            '<div class="cover-comments-modal__content">' +
                '<div class="cover-comments-modal__header">' +
                    '<h2 id="coverCommentsTitle" class="cover-comments-modal__title">Комментарии</h2>' +
                '</div>' +
                '<div class="cover-comments-modal__body">' +
                    (this.loading && this.comments.length === 0 ? this.renderLoading() : commentsHtml) +
                    (this.hasMore && !this.loading ? '<button class="cover-comments-modal__load-more">Показать ещё</button>' : '') +
                    (this.loading && this.comments.length > 0 ? '<div class="cover-comments-modal__loading-more">Загрузка...</div>' : '') +
                '</div>' +
                replyFormHtml +
            '</div>';
        
        // Store reference to modal body for scroll handling
        this.modalBody = this.modal.querySelector('.cover-comments-modal__body');
        
        // Reattach event listeners after render
        if (this.isOpen) {
            this.attachInternalListeners();
        }
    };
    
    /**
     * 📝 Render loading state
     */
    CoverCommentsModal.prototype.renderLoading = function() {
        return '<div class="cover-comments-modal__loading">' +
                   '<div class="spinner"></div>' +
                   '<div style="margin-top: 12px; color: var(--text-secondary);">Загрузка комментариев...</div>' +
               '</div>';
    };
    
    /**
     * 💬 Render comments list
     */
    CoverCommentsModal.prototype.renderComments = function() {
        if (this.comments.length === 0 && !this.loading) {
            return '<div class="cover-comments-modal__empty">' +
                       '<div class="cover-comments-modal__empty-icon">💬</div>' +
                       '<div class="cover-comments-modal__empty-text">Пока нет комментариев</div>' +
                   '</div>';
        }
        
        // Organize comments into threads
        var threads = this.organizeThreads();
        var html = '<div class="cover-comments-list">';
        
        for (var i = 0; i < threads.length; i++) {
            html += this.renderThread(threads[i]);
        }
        
        html += '</div>';
        return html;
    };
    
    /**
     * 🧵 Organize comments into threads (parent-reply structure)
     */
    CoverCommentsModal.prototype.organizeThreads = function() {
        var topLevel = [];
        var repliesMap = {};
        var self = this;
        
        // First pass: separate top-level comments and replies
        this.comments.forEach(function(comment) {
            if (comment.parentId) {
                // This is a reply
                if (!repliesMap[comment.parentId]) {
                    repliesMap[comment.parentId] = [];
                }
                repliesMap[comment.parentId].push(comment);
            } else {
                // This is a top-level comment
                topLevel.push(comment);
            }
        });
        
        // Build threads
        var threads = [];
        topLevel.forEach(function(parent) {
            var parentId = parent._id || parent.id;
            threads.push({
                parent: parent,
                replies: repliesMap[parentId] || []
            });
        });
        
        return threads;
    };
    
    /**
     * 🧵 Render a comment thread (parent + replies)
     */
    CoverCommentsModal.prototype.renderThread = function(thread) {
        var parentHtml = this.renderComment(thread.parent, false);
        var parentId = thread.parent._id || thread.parent.id;
        var replyCount = thread.replies.length;
        var isCollapsed = this._repliesCollapsed[parentId] !== false; // Default collapsed
        
        var repliesSection = '';
        if (replyCount > 0) {
            if (isCollapsed) {
                // Show "View replies" button
                var replyText = this.getReplyCountText(replyCount);
                repliesSection = 
                    '<div class="comment-replies-toggle">' +
                        '<button class="comment-replies-toggle__btn" ' +
                                'data-action="expand-replies" ' +
                                'data-parent-id="' + parentId + '">' +
                            replyText +
                        '</button>' +
                    '</div>';
            } else {
                // Show replies + "Hide replies" button
                var repliesHtml = '';
                for (var i = 0; i < thread.replies.length; i++) {
                    repliesHtml += this.renderComment(thread.replies[i], true);
                }
                repliesSection = 
                    '<div class="comment-replies">' + repliesHtml + '</div>' +
                    '<div class="comment-replies-toggle">' +
                        '<button class="comment-replies-toggle__btn" ' +
                                'data-action="collapse-replies" ' +
                                'data-parent-id="' + parentId + '">' +
                            'Скрыть ответы' +
                        '</button>' +
                    '</div>';
            }
        }
        
        return '<div class="comment-thread">' +
                   parentHtml +
                   repliesSection +
               '</div>';
    };
    
    /**
     * 📝 Get reply count text with pluralization
     */
    CoverCommentsModal.prototype.getReplyCountText = function(count) {
        var lastDigit = count % 10;
        var lastTwoDigits = count % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
            return 'Посмотреть ' + count + ' ответов';
        } else if (lastDigit === 1) {
            return 'Посмотреть ' + count + ' ответ';
        } else if (lastDigit >= 2 && lastDigit <= 4) {
            return 'Посмотреть ' + count + ' ответа';
        } else {
            return 'Посмотреть ' + count + ' ответов';
        }
    };
    
    /**
     * 💬 Render a single comment
     * @param {Object} comment - Comment object
     * @param {boolean} isReply - Whether this is a reply (affects styling)
     */
    CoverCommentsModal.prototype.renderComment = function(comment, isReply) {
        var user = comment.user || {};
        var userId = user.userId || '';
        var displayName = this.getDisplayName(user);
        var avatarUrl = user.avatarUrl || '';
        var timeStr = comment.createdAt ? this.formatRelativeTime(new Date(comment.createdAt)) : '';
        var likesCount = comment.likesCount || 0;
        var liked = comment.liked || false;
        var commentId = comment._id || comment.id;
        
        // Check if this is the current user's comment
        var currentUserId = this.api && typeof this.api.resolveUserId === 'function' ? this.api.resolveUserId() : null;
        var isOwnComment = currentUserId && userId && currentUserId === userId;
        
        var avatarHtml = avatarUrl 
            ? '<img src="' + this.escapeHtml(avatarUrl) + '" alt="' + this.escapeHtml(displayName) + '" class="comment__avatar" data-user-id="' + userId + '">'
            : '<div class="comment__avatar comment__avatar--placeholder" data-user-id="' + userId + '">👤</div>';
        
        var deleteBtn = isOwnComment 
            ? '<button class="comment__delete-btn comment__action-btn" ' +
                      'data-action="delete-comment" ' +
                      'data-comment-id="' + commentId + '" ' +
                      'title="Удалить">' +
                  'Удалить' +
              '</button>'
            : '';
        
        var replyBtn = !isReply 
            ? '<button class="comment__action-btn comment__reply-btn" ' +
                      'data-action="reply" ' +
                      'data-comment-id="' + commentId + '" ' +
                      'data-user-name="' + this.escapeHtml(user.name || 'Пользователь') + '">' +
                  'Ответить' +
              '</button>'
            : '';
        
        return '<div class="comment ' + (isReply ? 'comment--reply' : '') + '" data-comment-id="' + commentId + '">' +
                   avatarHtml +
                   '<div class="comment__content">' +
                       '<div class="comment__header">' +
                           '<span class="comment__name" data-user-id="' + userId + '">' + displayName + '</span>' +
                           '<span class="comment__time">' + timeStr + '</span>' +
                       '</div>' +
                       '<div class="comment__text">' + this.escapeHtml(comment.text) + '</div>' +
                       '<div class="comment__actions">' +
                           replyBtn +
                           deleteBtn +
                           '<button class="comment__action-btn comment__like-btn' + (liked ? ' liked' : '') + '" ' +
                                   'data-action="like-comment" ' +
                                   'data-comment-id="' + commentId + '" ' +
                                   'data-liked="' + liked + '">' +
                               (liked ? '❤️' : '♡') + ' <span class="comment__like-count">' + likesCount + '</span>' +
                           '</button>' +
                       '</div>' +
                   '</div>' +
               '</div>';
    };
    
    /**
     * ✍️ Render reply form
     */
    CoverCommentsModal.prototype.renderReplyForm = function() {
        var placeholder = this.replyingTo 
            ? 'Ответ для ' + this.replyingTo.userName + '...'
            : 'Написать комментарий...';
        
        var cancelBtn = this.replyingTo 
            ? '<button class="reply-form__cancel" data-action="cancel-reply">Отмена</button>'
            : '';
        
        return '<div class="cover-comments-modal__reply-form">' +
                   '<div class="reply-form">' +
                       cancelBtn +
                       '<textarea class="reply-form__input" ' +
                                 'placeholder="' + placeholder + '" ' +
                                 'maxlength="500" ' +
                                 'rows="1"></textarea>' +
                       '<button class="reply-form__submit" data-action="submit-reply">' +
                           'Отправить' +
                       '</button>' +
                   '</div>' +
               '</div>';
    };
    
    /**
     * 📝 Get display name with username
     */
    CoverCommentsModal.prototype.getDisplayName = function(user) {
        if (!user) return 'Пользователь';
        var name = user.name || 'Пользователь';
        var username = user.telegramUsername;
        if (username) {
            return name + ' · @' + username;
        }
        return name;
    };
    
    /**
     * ⏰ Format relative time
     */
    CoverCommentsModal.prototype.formatRelativeTime = function(date) {
        var now = new Date();
        var diffMs = now - date;
        var diffSec = Math.floor(diffMs / 1000);
        var diffMin = Math.floor(diffSec / 60);
        var diffHour = Math.floor(diffMin / 60);
        var diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) return 'только что';
        if (diffMin < 60) return diffMin + 'м назад';
        if (diffHour < 24) return diffHour + 'ч назад';
        if (diffDay === 1) return 'вчера';
        if (diffDay < 7) return diffDay + 'д назад';
        
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };
    
    /**
     * 🔐 Escape HTML
     */
    CoverCommentsModal.prototype.escapeHtml = function(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    /**
     * 🎯 Attach event listeners
     */
    CoverCommentsModal.prototype.attachEventListeners = function() {
        this.backdrop.addEventListener('click', this.boundHandleBackdropClick);
        document.addEventListener('keydown', this.boundHandleEscape);
        
        // Attach scroll listener for bottom sheet behavior
        if (this.modalBody) {
            this.modalBody.addEventListener('scroll', this.boundHandleScroll);
        }
    };
    
    /**
     * 🎯 Attach internal listeners (for modal content)
     */
    CoverCommentsModal.prototype.attachInternalListeners = function() {
        var self = this;
        
        // Load more button
        var loadMoreBtn = this.modal.querySelector('.cover-comments-modal__load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function() {
                self.loadComments(true);
            });
        }
        
        // Remove old delegated click handler to prevent duplicates
        if (this.boundDelegatedClickHandler) {
            this.modal.removeEventListener('click', this.boundDelegatedClickHandler);
        }
        
        // Create new delegated click handler
        this.boundDelegatedClickHandler = function(e) {
            var target = e.target;
            
            // Delete comment
            if (target.dataset.action === 'delete-comment' || target.closest('[data-action="delete-comment"]')) {
                e.preventDefault();
                var btn = target.dataset.action === 'delete-comment' ? target : target.closest('[data-action="delete-comment"]');
                self.handleDeleteComment(btn);
                return;
            }
            
            // Like comment
            if (target.dataset.action === 'like-comment' || target.closest('[data-action="like-comment"]')) {
                e.preventDefault();
                var btn = target.dataset.action === 'like-comment' ? target : target.closest('[data-action="like-comment"]');
                self.handleLikeComment(btn);
                return;
            }
            
            // Reply to comment
            if (target.dataset.action === 'reply' || target.closest('[data-action="reply"]')) {
                e.preventDefault();
                var btn = target.dataset.action === 'reply' ? target : target.closest('[data-action="reply"]');
                self.handleReply(btn);
                return;
            }
            
            // Expand replies
            if (target.dataset.action === 'expand-replies' || target.closest('[data-action="expand-replies"]')) {
                e.preventDefault();
                var btn = target.dataset.action === 'expand-replies' ? target : target.closest('[data-action="expand-replies"]');
                var parentId = btn.dataset.parentId;
                if (parentId) {
                    self._repliesCollapsed[parentId] = false;
                    self.render();
                }
                return;
            }
            
            // Collapse replies
            if (target.dataset.action === 'collapse-replies' || target.closest('[data-action="collapse-replies"]')) {
                e.preventDefault();
                var btn = target.dataset.action === 'collapse-replies' ? target : target.closest('[data-action="collapse-replies"]');
                var parentId = btn.dataset.parentId;
                if (parentId) {
                    self._repliesCollapsed[parentId] = true;
                    self.render();
                }
                return;
            }
            
            // Submit reply
            if (target.dataset.action === 'submit-reply') {
                e.preventDefault();
                self.handleSubmitReply();
                return;
            }
            
            // Cancel reply
            if (target.dataset.action === 'cancel-reply') {
                e.preventDefault();
                self.replyingTo = null;
                self.render();
                return;
            }
            
            // Open profile modal
            var userElement = target.closest('[data-user-id]');
            if (userElement && !target.closest('button')) {
                e.preventDefault();
                var userId = userElement.dataset.userId;
                if (userId && self.profileModal) {
                    self.profileModal.open(userId);
                }
                return;
            }
        };
        
        // Attach delegated click handler
        this.modal.addEventListener('click', this.boundDelegatedClickHandler);
        
        // Reattach scroll listener after render
        if (this.modalBody) {
            this.modalBody.addEventListener('scroll', this.boundHandleScroll);
        }
    };
    
    /**
     * 🎯 Detach event listeners
     */
    CoverCommentsModal.prototype.detachEventListeners = function() {
        this.backdrop.removeEventListener('click', this.boundHandleBackdropClick);
        document.removeEventListener('keydown', this.boundHandleEscape);
        
        if (this.modalBody) {
            this.modalBody.removeEventListener('scroll', this.boundHandleScroll);
        }
        
        // Remove delegated click handler
        if (this.boundDelegatedClickHandler && this.modal) {
            this.modal.removeEventListener('click', this.boundDelegatedClickHandler);
            this.boundDelegatedClickHandler = null;
        }
    };
    
    /**
     * ❤️ Handle like comment (with optimistic update and double-send protection)
     */
    CoverCommentsModal.prototype.handleLikeComment = function(button) {
        var self = this;
        
        if (!button) return;
        
        var commentId = button.dataset.commentId;
        
        // 🔧 Prevent double-sends
        if (this._likeInProgress[commentId]) {
            console.log('⚠️ Like already in progress for comment', commentId);
            return;
        }
        
        var wasLiked = button.dataset.liked === 'true';
        var likeCountSpan = button.querySelector('.comment__like-count');
        
        // Mark as in-progress
        this._likeInProgress[commentId] = true;
        
        // Optimistic UI update
        button.dataset.liked = wasLiked ? 'false' : 'true';
        button.classList.toggle('liked', !wasLiked);
        button.innerHTML = (wasLiked ? '♡' : '❤️') + ' <span class="comment__like-count">' + 
                          (wasLiked ? Math.max(0, parseInt(likeCountSpan.textContent) - 1) : parseInt(likeCountSpan.textContent) + 1) + 
                          '</span>';
        
        // Haptic feedback
        if (this.telegram && this.telegram.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // Call API
        this.api.likeCoverComment(this.postId, commentId)
            .then(function(response) {
                if (response && response.success) {
                    // Update with server response
                    button.dataset.liked = response.liked ? 'true' : 'false';
                    button.classList.toggle('liked', response.liked);
                    button.innerHTML = (response.liked ? '❤️' : '♡') + ' <span class="comment__like-count">' + 
                                      (response.likesCount || 0) + '</span>';
                    
                    // Update in local state
                    for (var i = 0; i < self.comments.length; i++) {
                        var c = self.comments[i];
                        if ((c._id || c.id) === commentId) {
                            c.liked = response.liked;
                            c.likesCount = response.likesCount || 0;
                            break;
                        }
                    }
                }
                
                // Mark as complete
                delete self._likeInProgress[commentId];
            })
            .catch(function(error) {
                console.error('❌ CoverCommentsModal: Failed to like comment:', error);
                
                // Revert optimistic update
                button.dataset.liked = wasLiked ? 'true' : 'false';
                button.classList.toggle('liked', wasLiked);
                button.innerHTML = (wasLiked ? '❤️' : '♡') + ' <span class="comment__like-count">' + 
                                  (likeCountSpan ? likeCountSpan.textContent : '0') + '</span>';
                
                // Mark as complete
                delete self._likeInProgress[commentId];
            });
    };
    
    /**
     * 💬 Handle reply to comment
     */
    CoverCommentsModal.prototype.handleReply = function(button) {
        var self = this;
        
        if (!button) return;
        
        var commentId = button.dataset.commentId;
        var userName = button.dataset.userName;
        
        this.replyingTo = { commentId: commentId, userName: userName };
        this.render();
        
        // Focus on textarea and prefill with @username
        setTimeout(function() {
            var textarea = self.modal.querySelector('.reply-form__input');
            if (textarea) {
                textarea.value = '@' + userName + ' ';
                textarea.focus();
                // Move cursor to end
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        }, 10);
        
        // Haptic feedback
        if (this.telegram && this.telegram.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
    };
    
    /**
     * 📤 Handle submit reply
     */
    CoverCommentsModal.prototype.handleSubmitReply = function() {
        var self = this;
        var textarea = this.modal.querySelector('.reply-form__input');
        var submitBtn = this.modal.querySelector('.reply-form__submit');
        
        if (!textarea) return;
        
        var text = textarea.value.trim();
        if (!text) return;
        
        // Guard: check if button is already disabled
        if (submitBtn && submitBtn.disabled) {
            return;
        }
        
        var parentId = (this.replyingTo && this.replyingTo.commentId) || null;
        
        // Disable button and textarea while pending
        if (textarea) textarea.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        
        this.api.addCoverComment(this.postId, text, parentId)
            .then(function(response) {
                if (response && response.success) {
                    // Add new comment to list
                    var newComment = response.data;
                    if (newComment) {
                        self.comments = [newComment].concat(self.comments);
                        
                        // Update cache with new comment
                        self._commentsCache[self.postId] = {
                            items: self.comments,
                            ts: Date.now()
                        };
                    }
                    
                    // Clear form and reply state
                    textarea.value = '';
                    self.replyingTo = null;
                    
                    // Update comment count in parent card
                    if (self.updateCountCallback) {
                        self.updateCountCallback(self.comments.length);
                    }
                    
                    // Reload comments to get fresh data
                    self.loadComments(false);
                    
                    // Show success toast
                    if (window.app && window.app.showToast) {
                        window.app.showToast('Комментарий добавлен', 'success');
                    }
                    
                    // Haptic feedback
                    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    }
                } else {
                    throw new Error((response && response.error) || 'Failed to add comment');
                }
                
                // Re-enable button and textarea
                if (textarea) textarea.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
            })
            .catch(function(error) {
                console.error('❌ CoverCommentsModal: Failed to add comment:', error);
                
                if (window.app && window.app.showToast) {
                    window.app.showToast('Ошибка добавления комментария', 'error');
                }
                
                // Re-enable button and textarea
                if (textarea) textarea.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
            });
    };
    
    /**
     * 🗑️ Handle delete comment
     */
    CoverCommentsModal.prototype.handleDeleteComment = function(button) {
        var self = this;
        
        if (!button) return;
        
        var commentId = button.dataset.commentId;
        if (!commentId) return;
        
        // Use Telegram.WebApp.showConfirm (with fallback)
        var showConfirm = function(message, callback) {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showConfirm) {
                window.Telegram.WebApp.showConfirm(message, callback);
            } else {
                // Fallback to blocking confirm
                callback(confirm(message));
            }
        };
        
        showConfirm('Удалить комментарий?', function(confirmed) {
            if (!confirmed) return;
            
            // Optimistically remove from UI
            var commentElement = button.closest('.comment');
            if (commentElement) {
                commentElement.style.opacity = '0.5';
                commentElement.style.pointerEvents = 'none';
            }
            
            // Call API to delete
            self.api.deleteCoverComment(self.postId, commentId)
                .then(function(response) {
                    if (response && response.success) {
                        // Remove from local state
                        self.comments = self.comments.filter(function(c) {
                            return (c._id || c.id) !== commentId;
                        });
                        
                        // Update cache after delete
                        self._commentsCache[self.postId] = {
                            items: self.comments,
                            ts: Date.now()
                        };
                        
                        // Update comment count in parent card
                        if (self.updateCountCallback) {
                            self.updateCountCallback(self.comments.length);
                        }
                        
                        // Reload comments to get fresh data
                        self.loadComments(false);
                        
                        // Show success toast
                        if (window.app && window.app.showToast) {
                            window.app.showToast('Комментарий удален', 'success');
                        }
                        
                        // Haptic feedback
                        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                        }
                    } else {
                        throw new Error((response && response.error) || 'Failed to delete comment');
                    }
                })
                .catch(function(error) {
                    console.error('❌ CoverCommentsModal: Failed to delete comment:', error);
                    
                    // Restore comment element
                    if (commentElement) {
                        commentElement.style.opacity = '1';
                        commentElement.style.pointerEvents = 'auto';
                    }
                    
                    if (window.app && window.app.showToast) {
                        window.app.showToast('Ошибка удаления комментария', 'error');
                    }
                });
        });
    };
    
    /**
     * 👆 Handle backdrop click
     */
    CoverCommentsModal.prototype.handleBackdropClick = function(event) {
        if (event.target === this.backdrop) {
            this.close();
        }
    };
    
    /**
     * ⌨️ Handle Escape key
     */
    CoverCommentsModal.prototype.handleEscape = function(event) {
        if (event.key === 'Escape' && this.isOpen) {
            this.close();
        }
    };
    
    /**
     * ◀️ Handle Telegram back button
     */
    CoverCommentsModal.prototype.handleBackButton = function() {
        this.close();
    };
    
    /**
     * 🔧 Handle Telegram back button visibility
     */
    CoverCommentsModal.prototype.handleTelegramBackButton = function(show) {
        if (!this.telegram || !this.telegram.BackButton) return;
        
        if (show && !this.backButtonAttached) {
            this.telegram.BackButton.show();
            this.telegram.BackButton.onClick(this.boundHandleBackButton);
            this.backButtonAttached = true;
        } else if (!show && this.backButtonAttached) {
            this.telegram.BackButton.offClick(this.boundHandleBackButton);
            this.telegram.BackButton.hide();
            this.backButtonAttached = false;
        }
    };
    
    /**
     * 🧹 Cleanup
     */
    CoverCommentsModal.prototype.destroy = function() {
        this.close();
        
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
        
        console.log('🧹 CoverCommentsModal: Destroyed');
    };
    
    // Export for use in other modules
    if (typeof window !== 'undefined') {
        window.CoverCommentsModal = CoverCommentsModal;
    }
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CoverCommentsModal;
    }
})();
