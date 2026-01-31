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

/**
 * 🔧 Helper: Deduplicate array of comments by id
 * @param {Array} arr - Array of comments
 * @returns {Array} Deduplicated array
 */
function dedupeById(arr) {
    if (!Array.isArray(arr)) return [];
    const map = new Map();
    for (const c of arr) {
        const id = c?._id || c?.id;
        if (!id) continue;
        if (!map.has(id)) map.set(id, c);
    }
    return Array.from(map.values());
}

class CoverCommentsModal {
    constructor(app) {
        // Handle both appObject (from Router.js) and App instance (from App.js)
        // - When called from App.js getCoverCommentsModal(): receives App instance directly
        // - When passed through Router's appObject: receives appObject with .app property
        // This defensive pattern ensures compatibility with both calling conventions
        this.app = app.app || app; // Save the real App instance
        this.api = app.api;
        this.telegram = app.telegram;
        // Get ProfileModal directly from the real App instance
        this.profileModal = this.app.getProfileModal ? this.app.getProfileModal() : null;
        
        // Constants
        this.MOBILE_BREAKPOINT = 480;
        
        // State machine constants for three-position drawer
        this.SHEET_STATES = {
            CLOSED: 'CLOSED',
            INITIAL: 'INITIAL',
            FULL: 'FULL'
        };
        
        // Translate Y values for each state (in vh units for INITIAL, dvh for others)
        this.SHEET_POSITIONS = {
            CLOSED: 100,   // translateY(100dvh) - completely off screen
            INITIAL: 50,   // translateY(50vh) - input form visible, exactly 50% of viewport
            FULL: 0        // translateY(0dvh) - fully expanded
        };
        
        this.INITIAL_SHEET_HEIGHT = 65; // Deprecated - kept for compatibility
        this.MAX_SHEET_HEIGHT = 96;     // Deprecated - kept for compatibility
        this.SCROLL_EXPANSION_FACTOR = 0.1; // Deprecated - removing scroll-to-expand
        this.PULL_TO_CLOSE_THRESHOLD = 100; // Deprecated - using state-based swipes
        
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
        
        // State machine for three-position drawer
        this.sheetState = this.SHEET_STATES.CLOSED; // Current state: CLOSED, INITIAL, FULL
        this._keyboardTriggeredFull = false; // Track if FULL state was triggered by keyboard
        this.isAnimating = false; // Track if sheet is currently animating (prevent double animations)
        this._openInFlight = false; // Guard concurrent opens
        
        // Bottom sheet state (deprecated - kept for compatibility)
        this._sheetHeight = this.INITIAL_SHEET_HEIGHT; // Start at 65dvh
        this._lastScrollTop = 0;
        this._likeInProgress = new Map(); // commentId → boolean (prevent double-sends)
        this._touchStartY = 0;
        this._touchStartScrollTop = 0;
        this._isDraggingSheet = false; // Track if user is dragging the sheet
        this._scrollThrottleTimer = null; // For throttling scroll updates
        this._keyboardResizeHandler = null; // Handler for keyboard resize events
        
        // DOM elements
        this.modal = null;
        this.backdrop = null;
        this.modalBody = null;
        this.modalHeader = null;
        
        // Event handlers
        this.boundHandleBackdropClick = this.handleBackdropClick.bind(this);
        this.boundHandleEscape = this.handleEscape.bind(this);
        this.boundHandleBackButton = this.handleBackButton.bind(this);
        this.boundHandleScroll = this.handleScroll.bind(this);
        this.boundHandleTouchStart = this.handleTouchStart.bind(this);
        this.boundHandleTouchMove = this.handleTouchMove.bind(this);
        this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
        this.boundDelegatedClickHandler = null; // Track delegated click handler
        
        // Track if BackButton handler is attached
        this.backButtonAttached = false;
        
        console.log('✅ CoverCommentsModal: Initialized');
    }
    
    /**
     * 🏗️ Create modal DOM elements
     */
    createModal() {
        // 🔧 ARCHITECTURAL FIX: Check if modal already exists AND is in document.body
        // If modal exists but is not in DOM (removed during page rerender), re-add it
        if (this.modal && !document.body.contains(this.modal)) {
            console.log('⚠️ CoverCommentsModal: Modal existed but was not in DOM, re-adding to body');
            document.body.appendChild(this.backdrop);
            document.body.appendChild(this.modal);
            return;
        }
        
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
        
        // Add to document.body (top level, isolated from page rerenders)
        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.modal);
        
        // 🔧 Initialize in CLOSED state (off-screen)
        this.sheetState = this.SHEET_STATES.CLOSED;
        if (window.innerWidth <= this.MOBILE_BREAKPOINT) {
            this.modal.style.transform = `translateY(${this.SHEET_POSITIONS.CLOSED}dvh)`;
            this.modal.classList.add('sheet-state-closed');
        }
        
        console.log('✅ CoverCommentsModal: DOM elements created and added to document.body');
    }
    
    /**
     * 🎯 Set sheet state (State Machine control method)
     * Manages transitions between CLOSED, INITIAL, and FULL states
     * Uses transform: translateY() for hardware-accelerated animations
     * @param {string} newState - Target state (CLOSED, INITIAL, FULL)
     * @param {boolean} animated - Whether to animate the transition (default: true)
     */
    _setSheetState(newState, animated = true) {
        if (!this.SHEET_STATES[newState]) {
            console.warn(`⚠️ Invalid sheet state: ${newState}`);
            return;
        }
        
        // Allow re-applying same state to reset visual position (for snap-back after drag)
        const isReapplying = this.sheetState === newState;
        
        if (!isReapplying) {
            const previousState = this.sheetState;
            this.sheetState = newState;
            console.log(`🎯 Sheet state transition: ${previousState} → ${newState}`);
        }
        
        // Apply CSS transformation
        if (this.modal && window.innerWidth <= this.MOBILE_BREAKPOINT) {
            let translateValue;
            let unit;
            
            if (newState === this.SHEET_STATES.INITIAL) {
                // Use calculated initial height from CSS custom property
                const customHeight = getComputedStyle(document.documentElement).getPropertyValue('--sheet-initial-height').trim();
                if (customHeight && customHeight !== '') {
                    translateValue = customHeight;
                    unit = ''; // Already includes unit (px)
                } else {
                    // Fallback to 50vh if custom property not set
                    translateValue = this.SHEET_POSITIONS[newState];
                    unit = 'vh';
                }
            } else {
                translateValue = this.SHEET_POSITIONS[newState];
                unit = 'dvh';
            }
            
            // Set transition based on animated flag
            this.modal.style.transition = animated 
                ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                : 'none';
            
            this.modal.style.transform = `translateY(${translateValue}${unit})`;
            
            // Update CSS class for styling hooks (only if actually changing state)
            if (!isReapplying) {
                this.modal.classList.remove('sheet-state-closed', 'sheet-state-initial', 'sheet-state-full');
                this.modal.classList.add(`sheet-state-${newState.toLowerCase()}`);
            }
            
            // Track animation state
            if (animated) {
                this.isAnimating = true;
                
                // Listen for transition end to clear animation flag
                const handleTransitionEnd = (e) => {
                    if (e.target === this.modal && e.propertyName === 'transform') {
                        this.isAnimating = false;
                        this.modal.removeEventListener('transitionend', handleTransitionEnd);
                    }
                };
                this.modal.addEventListener('transitionend', handleTransitionEnd);
            } else {
                this.isAnimating = false;
            }
        }
    }
    
    /**
     * 📐 Set sheet position (for bottom sheet behavior) - DEPRECATED
     * 🔧 FIX: Using transform: translateY() instead of height for hardware-accelerated animations
     * @deprecated Use _setSheetState() instead
     */
    setSheetPosition(heightDvh) {
        // Clamp between INITIAL and MAX sheet heights
        heightDvh = Math.max(this.INITIAL_SHEET_HEIGHT, Math.min(this.MAX_SHEET_HEIGHT, heightDvh));
        this._sheetHeight = heightDvh;
        
        // Calculate translateY based on height difference from max
        // When at MAX_SHEET_HEIGHT, translateY = 0
        // When at INITIAL_SHEET_HEIGHT, translateY = positive value (pushed down)
        const heightDiff = this.MAX_SHEET_HEIGHT - heightDvh;
        const translateYPercent = heightDiff; // dvh units
        
        // Update CSS variable for reference
        document.documentElement.style.setProperty('--sheet-height', `${heightDvh}dvh`);
        
        // 🔧 FIX: Use transform for smooth hardware-accelerated animation
        if (this.modal && window.innerWidth <= this.MOBILE_BREAKPOINT) {
            // Keep height at max, use transform to position
            this.modal.style.height = `${this.MAX_SHEET_HEIGHT}dvh`;
            this.modal.style.transform = `translateY(${translateYPercent}dvh)`;
            this.modal.style.transition = 'transform 0.2s ease-out';
        }
    }
    
    /**
     * 📜 Handle scroll for bottom sheet - DISABLED
     * 🔧 Removed scroll-to-expand behavior for cleaner three-position state machine
     */
    handleScroll() {
        // Disabled - using three-position state machine instead
        return;
    }
    
    /**
     * 👆 Handle touch start for pull-to-close gesture
     */
    /**
     * 👆 Handle touch start for swipe gestures on header
     * Tracks initial touch position for state-based swipe detection
     */
    handleTouchStart(e) {
        if (window.innerWidth > this.MOBILE_BREAKPOINT) return; // Only on mobile
        
        // Check if touch started on header
        const header = e.target.closest('.cover-comments-modal__header');
        if (header) {
            this._isDraggingSheet = true;
            this._touchStartY = e.touches[0].clientY;
            this._touchStartScrollTop = this.modalBody ? this.modalBody.scrollTop : 0;
        }
    }
    
    /**
     * 👆 Handle touch move for swipe gestures
     * 🔧 Provides immediate visual feedback during drag
     */
    handleTouchMove(e) {
        if (window.innerWidth > this.MOBILE_BREAKPOINT) return; // Only on mobile
        if (!this._isDraggingSheet) return;
        
        const touchY = e.touches[0].clientY;
        const deltaY = touchY - this._touchStartY;
        
        // Prevent default to stop page scrolling while dragging header
        e.preventDefault();
        
        // 🔧 Disable transition during drag for immediate feedback
        if (this.modal) {
            this.modal.style.transition = 'none';
            
            // Calculate new position based on drag
            const currentPosition = this.SHEET_POSITIONS[this.sheetState];
            const dragPercent = (deltaY / window.innerHeight) * 100; // Convert to dvh
            const newPosition = Math.max(0, Math.min(100, currentPosition + dragPercent));
            
            this.modal.style.transform = `translateY(${newPosition}dvh)`;
        }
    }
    
    /**
     * 👆 Handle touch end for swipe gestures
     * 🔧 Implements three-position state machine logic:
     * - Swipe up from INITIAL → FULL
     * - Swipe down from FULL → INITIAL
     * - Swipe down from INITIAL → CLOSED
     */
    handleTouchEnd(e) {
        if (window.innerWidth > this.MOBILE_BREAKPOINT) return; // Only on mobile
        if (!this._isDraggingSheet) return;
        
        const touchY = e.changedTouches[0].clientY;
        const deltaY = touchY - this._touchStartY;
        const swipeThreshold = 50; // Minimum swipe distance in pixels
        
        // 🔧 Re-enable transition for smooth snap
        if (this.modal) {
            this.modal.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        }
        
        // Determine state transition based on swipe direction and current state
        let targetState = this.sheetState;
        
        if (Math.abs(deltaY) >= swipeThreshold) {
            if (deltaY < 0) {
                // Swipe UP
                if (this.sheetState === this.SHEET_STATES.INITIAL) {
                    targetState = this.SHEET_STATES.FULL;
                    // User manually swiped to FULL, so clear keyboard trigger flag
                    this._keyboardTriggeredFull = false;
                }
                // From FULL, can't go higher - stay at FULL
                // From CLOSED, shouldn't happen - ignore
            } else {
                // Swipe DOWN
                if (this.sheetState === this.SHEET_STATES.FULL) {
                    targetState = this.SHEET_STATES.INITIAL;
                } else if (this.sheetState === this.SHEET_STATES.INITIAL) {
                    // 🔧 FIX: Use unified close method to ensure backdrop is removed
                    targetState = this.SHEET_STATES.CLOSED;
                }
                // From CLOSED, already closed - ignore
            }
        }
        
        // Apply state transition or close
        if (targetState === this.SHEET_STATES.CLOSED && this.sheetState !== this.SHEET_STATES.CLOSED) {
            // 🔧 Call unified close method instead of just setting state
            this._triggerClose();
        } else {
            this._setSheetState(targetState);
        }
        
        // Reset state
        this._isDraggingSheet = false;
        this._touchStartY = 0;
        this._touchStartScrollTop = 0;
    }
    
    /**
     * ⌨️ Setup keyboard resize handler for mobile
     * 🔧 When keyboard shows, force FULL state; when hidden, return to INITIAL only if keyboard-triggered
     */
    setupKeyboardHandler() {
        if (!window.visualViewport) return; // Not supported
        if (window.innerWidth > this.MOBILE_BREAKPOINT) return; // Only on mobile
        
        // Store initial viewport height
        const initialViewportHeight = window.visualViewport.height;
        
        this._keyboardResizeHandler = () => {
            if (!this.isOpen || !this.modal) return;
            
            const currentViewportHeight = window.visualViewport.height;
            const viewportHeightDiff = initialViewportHeight - currentViewportHeight;
            
            // If keyboard is showing (viewport height decreased significantly)
            if (viewportHeightDiff > 150) {
                // Keyboard opened
                // 🔧 FIX: If already in FULL state, remain stable (no re-animation)
                if (this.sheetState === this.SHEET_STATES.FULL) {
                    this._keyboardTriggeredFull = true; // mark as keyboard-triggered for collapse logic
                    return;
                }
                
                // 🔧 FIX: Prevent animation if currently animating
                if (this.isAnimating) {
                    return;
                }
                
                // Sheet is in INITIAL state, smoothly transition to FULL
                console.log('⌨️ Keyboard shown - smoothly transitioning from INITIAL to FULL');
                this._keyboardTriggeredFull = true;
                this._setSheetState(this.SHEET_STATES.FULL);
            } else {
                // Keyboard hidden - return to INITIAL only if FULL was keyboard-triggered
                if (this.sheetState === this.SHEET_STATES.FULL && this._keyboardTriggeredFull) {
                    console.log('⌨️ Keyboard hidden - returning to INITIAL state');
                    this._setSheetState(this.SHEET_STATES.INITIAL);
                    this._keyboardTriggeredFull = false;
                }
            }
        };
        
        window.visualViewport.addEventListener('resize', this._keyboardResizeHandler);
    }
    
    /**
     * ⌨️ Remove keyboard resize handler
     */
    removeKeyboardHandler() {
        if (this._keyboardResizeHandler && window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this._keyboardResizeHandler);
            this._keyboardResizeHandler = null;
        }
    }
    
    /**
     * 🎭 Open modal
     * @param {string} postId - Post ID to load comments for
     * @param {Function} updateCountCallback - Callback to update comment count in parent
     * @param {Object} options - Options including initialComments
     */
    async open(postId, updateCountCallback = null, options = {}) {
        if (!postId) {
            console.error('❌ CoverCommentsModal: No postId provided');
            return;
        }
        
        // 🔧 FIX: Guard concurrent opens
        if (this._openInFlight) {
            console.log('⏳ open() in flight, ignore');
            return;
        }
        
        // 🔧 FIX: If already open for same post, just ensure INITIAL state
        if (this.isOpen && this.postId === postId) {
            console.log(`⚠️ CoverCommentsModal: Already open for same post ${postId}, ensuring INITIAL state`);
            this._setSheetState(this.SHEET_STATES.INITIAL);
            return;
        }
        
        this._openInFlight = true;
        
        try {
            console.log(`📸 CoverCommentsModal: Opening for post ${postId}`);
            
            this.postId = postId;
            this.nextCursor = null;
            this.hasMore = false;
            this.replyingTo = null;
            this.updateCountCallback = updateCountCallback; // Store callback
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
            }
            
            // Attach event listeners
            this.attachEventListeners();
            
            // Setup keyboard handler for mobile
            this.setupKeyboardHandler();
            
            // Hide Telegram back button and attach our handler
            this.handleTelegramBackButton(true);
            
            // Fetch fresh data with cache-busting
            await this.loadComments();
            
            // Trigger animation and set initial state
            requestAnimationFrame(() => {
                this.backdrop.classList.add('active');
                this.modal.classList.add('active');
                
                // 🔧 FIX: Compute INITIAL translateY from real modal sheet height (DOM-based measurement)
                // Measure after modal is inserted into DOM and rendered
                if (this.modal && window.innerWidth <= this.MOBILE_BREAKPOINT) {
                    const rect = this.modal.getBoundingClientRect();
                    const sheetHeight = rect.height; // Real measured height in px
                    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                    const targetVisibleHeight = viewportHeight * 0.6; // Show 60% of viewport
                    const translateYPx = Math.max(0, Math.round(sheetHeight - targetVisibleHeight));
                    
                    // Set CSS variable with px value for precise positioning
                    document.documentElement.style.setProperty('--sheet-initial-height', `${translateYPx}px`);
                    console.log(`[INIT HEIGHT] sheetHeight=${sheetHeight}px viewport=${viewportHeight}px visible=${targetVisibleHeight}px translateY=${translateYPx}px`);
                }
                
                // 🔧 Set sheet to INITIAL state (input form visible)
                this._setSheetState(this.SHEET_STATES.INITIAL);
            });
        } finally {
            this._openInFlight = false;
        }
    }
    
    /**
     * 🎯 Trigger unified close action
     * 🔧 FIX: Single method that handles both backdrop removal and sheet animation
     * Used by both backdrop click and swipe-to-close to ensure consistent behavior
     */
    _triggerClose() {
        this.close();
    }
    
    /**
     * 🔒 Close modal
     */
    close() {
        if (!this.isOpen) return;
        
        console.log('📸 CoverCommentsModal: Closing');
        
        // 🔧 FIX: Synchronously remove all backdrop and body classes immediately
        // This ensures the background fades out in sync with the sheet animation
        if (this.backdrop) {
            this.backdrop.classList.remove('active');
        }
        if (this.modal) {
            this.modal.classList.remove('active');
        }
        
        // Remove body class immediately
        document.body.classList.remove('sheet-open');
        
        // Remove any backdrop-visible class if present
        document.body.classList.remove('backdrop-visible');
        
        // 🔧 Animate transition to CLOSED state on mobile
        if (window.innerWidth <= this.MOBILE_BREAKPOINT) {
            this._setSheetState(this.SHEET_STATES.CLOSED, true);
            // The _setSheetState will handle the cleanup via setTimeout
            // Just set isOpen to false after animation
            setTimeout(() => {
                this.isOpen = false;
            }, 300);
        } else {
            // Desktop: immediate hide
            this.sheetState = this.SHEET_STATES.CLOSED;
            this.isOpen = false;
        }
        
        // Hide after animation completes
        setTimeout(() => {
            if (this.backdrop) this.backdrop.style.display = 'none';
            if (this.modal) this.modal.style.display = 'none';
        }, 300);
        
        // Detach event listeners
        this.detachEventListeners();
        
        // Remove keyboard handler
        this.removeKeyboardHandler();
        
        // Restore Telegram back button
        this.handleTelegramBackButton(false);
        
        // Clear state
        this.postId = null;
        this.comments = [];
        this.replyingTo = null;
        this._likeInProgress.clear();
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
                const fresh = dedupeById(response.data || []);
                
                if (loadMore) {
                    // Load more: dedupe combined list
                    this.comments = dedupeById([...(this.comments || []), ...fresh]);
                } else {
                    // Full refresh: only replace when server returns non-empty
                    this.comments = fresh.length > 0 ? fresh : (this.comments || []);
                }
                
                this.hasMore = response.hasMore || false;
                this.nextCursor = response.nextCursor || null;
                
                // Update cache only with actual displayed comments
                if (this.postId) {
                    this._commentsCache.set(this.postId, { 
                        items: this.comments, 
                        ts: Date.now() 
                    });
                }
                
                console.log(`✅ CoverCommentsModal: Loaded ${fresh.length} (total: ${this.comments.length})`);
                
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
     * 🔄 Update comments list from external source (e.g., cache refresh)
     * @param {Array} commentsList - New comments list
     */
    updateComments(commentsList) {
        if (!Array.isArray(commentsList)) return;
        
        this.comments = commentsList;
        
        // Update cache
        if (this.postId) {
            this._commentsCache.set(this.postId, {
                items: this.comments,
                ts: Date.now()
            });
        }
        
        // Update count callback
        if (this.updateCountCallback) {
            this.updateCountCallback(this.comments.length);
        }
        
        // Re-render
        this.render();
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
                <div class="cover-comments-modal__header" aria-label="Потяните вниз чтобы закрыть">
                    <h2 id="coverCommentsTitle" class="cover-comments-modal__title">Комментарии</h2>
                </div>
                <div class="cover-comments-modal__body">
                    ${this.loading && this.comments.length === 0 ? this.renderLoading() : commentsHtml}
                    ${this.hasMore && !this.loading ? '<button class="cover-comments-modal__load-more">Показать ещё</button>' : ''}
                    ${this.loading && this.comments.length > 0 ? '<div class="cover-comments-modal__loading-more">Загрузка...</div>' : ''}
                </div>
                ${replyFormHtml}
            </div>
        `;
        
        // Store references to modal elements for event handling
        this.modalBody = this.modal.querySelector('.cover-comments-modal__body');
        this.modalHeader = this.modal.querySelector('.cover-comments-modal__header');
        
        // 🔧 FIX: Ensure body padding matches reply form height + safe area
        const bodyEl = this.modalBody;
        const replyFormEl = this.modal.querySelector('.cover-comments-modal__reply-form');
        if (bodyEl && replyFormEl) {
            // Wait for next frame to ensure elements are laid out
            requestAnimationFrame(() => {
                const pad = replyFormEl.offsetHeight + 16; // include small margin; safe-area handled in CSS
                bodyEl.style.paddingBottom = `${pad}px`;
            });
        }
        
        // Reattach event listeners after render (modalBody changed)
        if (this.isOpen) {
            this.attachInternalListeners();
            this.reattachModalBodyListeners(); // Reattach scroll/touch listeners
        }
    }
    
    /**
     * 🎯 Reattach modal body event listeners after render
     */
    reattachModalBodyListeners() {
        // Remove old listeners if they exist (defensive)
        if (this.modalBody) {
            this.modalBody.removeEventListener('scroll', this.boundHandleScroll);
        }
        if (this.modalHeader) {
            this.modalHeader.removeEventListener('touchstart', this.boundHandleTouchStart);
            this.modalHeader.removeEventListener('touchmove', this.boundHandleTouchMove);
            this.modalHeader.removeEventListener('touchend', this.boundHandleTouchEnd);
        }
        
        // Attach new listeners
        if (this.modalBody) {
            this.modalBody.addEventListener('scroll', this.boundHandleScroll);
        }
        if (this.modalHeader) {
            this.modalHeader.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
            this.modalHeader.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
            this.modalHeader.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });
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
                    <div class="comment__body">
                        <div class="comment__text">${this.highlightMentions(this.escapeHtml(comment.text))}</div>
                        <button class="comment__action-btn comment__like-btn${liked ? ' liked' : ''}" 
                                data-action="like-comment" 
                                data-comment-id="${commentId}"
                                data-liked="${liked}">
                            <span class="like-icon">${liked ? '❤️' : '♡'}</span> <span class="comment__like-count">${likesCount}</span>
                        </button>
                    </div>
                    <div class="comment__actions">
                        ${!isReply ? `
                            <button class="comment__action-btn comment__reply-btn" 
                                    data-action="reply" 
                                    data-comment-id="${commentId}"
                                    data-user-name="${this.escapeHtml(user.telegramUsername || user.name || 'user')}">
                                Ответить
                            </button>
                        ` : ''}
                        ${isOwnComment ? `
                            <button class="comment__delete-btn comment__action-btn" 
                                    data-action="delete-comment" 
                                    data-comment-id="${commentId}" 
                                    title="Удалить">
                                Удалить
                            </button>
                        ` : ''}
                    </div>
                </div>
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
                              rows="1"></textarea>
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
     * 🎨 Highlight mentions in text
     * @param {string} text - Escaped HTML text
     * @returns {string} HTML with highlighted mentions
     */
    highlightMentions(text) {
        if (!text) return '';
        // Match @username pattern (supports alphanumeric, dots, hyphens, underscores)
        return text.replace(/@([\w.-]+)/g, '<span class="comment__mention">@$1</span>');
    }
    
    /**
     * 🎯 Attach event listeners
     */
    attachEventListeners() {
        this.backdrop.addEventListener('click', this.boundHandleBackdropClick);
        document.addEventListener('keydown', this.boundHandleEscape);
        
        // Attach scroll listener for bottom sheet behavior
        if (this.modalBody) {
            this.modalBody.addEventListener('scroll', this.boundHandleScroll);
        }
        
        // Touch listeners for swipe gestures on header
        if (this.modalHeader) {
            this.modalHeader.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
            this.modalHeader.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
            this.modalHeader.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });
        }
    }
    
    /**
     * 🎯 Attach internal listeners (for modal content)
     */
    attachInternalListeners() {
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
        
        if (this.modalBody) {
            this.modalBody.removeEventListener('scroll', this.boundHandleScroll);
        }
        
        if (this.modalHeader) {
            this.modalHeader.removeEventListener('touchstart', this.boundHandleTouchStart);
            this.modalHeader.removeEventListener('touchmove', this.boundHandleTouchMove);
            this.modalHeader.removeEventListener('touchend', this.boundHandleTouchEnd);
        }
        
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
        
        // Prevent double-sends
        if (this._likeInProgress.get(commentId)) {
            console.log('⚠️ Like already in progress for comment', commentId);
            return;
        }
        
        const wasLiked = button.dataset.liked === 'true';
        const likeCountSpan = button.querySelector('.comment__like-count');
        const likeIconSpan = button.querySelector('.like-icon');
        
        // Mark as in-progress
        this._likeInProgress.set(commentId, true);
        
        // Helper to update icon
        const updateIcon = (liked) => {
            if (likeIconSpan) {
                likeIconSpan.textContent = liked ? '❤️' : '♡';
            }
        };
        
        // Optimistic UI update
        button.dataset.liked = wasLiked ? 'false' : 'true';
        button.classList.toggle('liked', !wasLiked);
        updateIcon(!wasLiked);
        
        const currentCount = parseInt((likeCountSpan && likeCountSpan.textContent) || '0');
        const newCount = wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
        if (likeCountSpan) {
            likeCountSpan.textContent = newCount;
        }
        
        // Haptic feedback
        if (this.telegram && this.telegram.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        try {
            const response = await this.api.likeCoverComment(this.postId, commentId);
            
            if (response && response.success) {
                // Update with server response
                button.dataset.liked = response.liked ? 'true' : 'false';
                button.classList.toggle('liked', response.liked);
                updateIcon(response.liked);
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
            updateIcon(wasLiked);
            if (likeCountSpan) {
                likeCountSpan.textContent = currentCount;
            }
        } finally {
            // Mark as complete
            this._likeInProgress.delete(commentId);
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
        if (this.telegram && this.telegram.hapticFeedback) {
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
        
        const parentId = (this.replyingTo && this.replyingTo.commentId) || null;
        
        try {
            // Disable button and textarea while pending
            if (textarea) textarea.disabled = true;
            if (submitBtn) submitBtn.disabled = true;
            
            const response = await this.api.addCoverComment(this.postId, text, parentId);
            
            if (response && response.success) {
                // 🔧 OPTIMISTIC UPDATE: Add new comment to list
                const newComment = response.data;
                if (newComment) {
                    this.comments = [newComment, ...this.comments];
                    
                    // Update cache with new comment
                    this._commentsCache.set(this.postId, {
                        items: this.comments,
                        ts: Date.now()
                    });
                    
                    // Re-render to show new comment
                    this.render();
                }
                
                // Clear form and reply state
                textarea.value = '';
                this.replyingTo = null;
                
                // Update comment count in parent card
                if (this.updateCountCallback) {
                    this.updateCountCallback(this.comments.length);
                }
                
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
        } catch (error) {
            console.error('❌ CoverCommentsModal: Failed to add comment:', error);
            
            if (window.app && window.app.showToast) {
                window.app.showToast('Ошибка добавления комментария', 'error');
            }
        } finally {
            // Re-enable button and textarea
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
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showConfirm) {
                    window.Telegram.WebApp.showConfirm(message, resolve);
                } else {
                    // Fallback to blocking confirm if Telegram API not available
                    resolve(confirm(message));
                }
            });
        };
        
        const confirmed = await showConfirm('Удалить комментарий?');
        if (!confirmed) return;
        
        // 🔧 FIX: Declare originalComments before try block so it's available in catch
        const originalComments = [...this.comments];
        
        try {
            // 🔧 OPTIMISTIC DELETE: Remove from local state immediately
            this.comments = this.comments.filter(c => (c._id || c.id) !== commentId);
            
            // Update cache after optimistic delete
            this._commentsCache.set(this.postId, {
                items: this.comments,
                ts: Date.now()
            });
            
            // Update comment count in parent card
            if (this.updateCountCallback) {
                this.updateCountCallback(this.comments.length);
            }
            
            // Re-render to remove comment from DOM
            this.render();
            
            // Call API to delete
            const response = await this.api.deleteCoverComment(this.postId, commentId);
            
            if (response && response.success) {
                // 🔧 FIX: Dispatch global event for cache synchronization
                const event = new CustomEvent('comment:deleted', {
                    detail: {
                        postId: this.postId,
                        commentId: commentId,
                        remainingCount: this.comments.length
                    }
                });
                window.dispatchEvent(event);
                
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
        } catch (error) {
            console.error('❌ CoverCommentsModal: Failed to delete comment:', error);
            
            // 🔧 ROLLBACK: Restore original comments on error
            this.comments = originalComments;
            
            // Update cache with restored comments
            this._commentsCache.set(this.postId, {
                items: this.comments,
                ts: Date.now()
            });
            
            // Update comment count in parent card
            if (this.updateCountCallback) {
                this.updateCountCallback(this.comments.length);
            }
            
            // Re-render to restore comment in DOM
            this.render();
            
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
            this._triggerClose();
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
    }
    
    /**
     * 🧹 Cleanup
     */
    destroy() {
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
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CoverCommentsModal = CoverCommentsModal;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoverCommentsModal;
}
