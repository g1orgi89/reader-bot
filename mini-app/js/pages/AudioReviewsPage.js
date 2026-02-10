/**
 * AudioReviewsPage - Dedicated page for audio reviews and ratings
 * Displays other users' comments and allows rating + comment submission
 * Vanilla JS implementation
 */

// Constants
const RATING_LABELS = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];

class AudioReviewsPage {
  /**
   * @param {Object} app - Main app instance
   */
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.state = app.state;
    this.telegram = app.telegram;
    
    // Audio metadata (will be populated from router state or URL param)
    this.audioId = null;
    this.audioSlug = null;
    this.audioTitle = '';
    this.audioAuthor = '';
    this.audioDescription = '';
    this.audioCover = '';
    
    // Feedback state
    this.feedbackState = {
      stats: { avgRating: 0, total: 0, distribution: {} },
      comments: [],
      isLoadingStats: false,
      isLoadingComments: false,
      selectedRating: 0,
      isSubmitting: false
    };
    
    this.elements = {
      stars: [],
      textarea: null,
      charCounter: null,
      submitBtn: null,
      commentsList: null,
      statsHeader: null
    };
    
    // Store back button handler for proper cleanup
    this._backButtonHandler = null;
  }
  
  /**
   * Initialize the page
   */
  init() {
    console.log('AudioReviewsPage: init called');
    
    // Extract audioId from current route
    const currentPath = window.location.hash.slice(1).split('?')[0];
    const match = currentPath.match(/^\/audios\/([^/]+)\/reviews$/);
    
    if (match) {
      this.audioId = decodeURIComponent(match[1]);
      console.log('AudioReviewsPage: audioId from URL:', this.audioId);
    }
    
    // Try to get metadata from router state if available
    if (this.app.router && this.app.router.currentState) {
      const routerState = this.app.router.currentState;
      if (routerState.audioId) this.audioId = routerState.audioId;
      if (routerState.audioSlug) this.audioSlug = routerState.audioSlug;
      if (routerState.audioTitle) this.audioTitle = routerState.audioTitle;
      if (routerState.audioAuthor) this.audioAuthor = routerState.audioAuthor;
      if (routerState.audioDescription) this.audioDescription = routerState.audioDescription;
      if (routerState.audioCover) this.audioCover = routerState.audioCover;
      if (routerState.avgRating !== undefined) this.feedbackState.stats.avgRating = routerState.avgRating;
      if (routerState.totalReviews !== undefined) this.feedbackState.stats.total = routerState.totalReviews;
    }
    
    if (!this.audioId) {
      console.error('AudioReviewsPage: No audioId found');
    }
  }
  
  /**
   * Render the page HTML
   */
  render() {
    return `
      <div class="audio-reviews-page">
        <div class="audio-reviews-header">
          <button class="back-button" id="reviews-back-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Назад
          </button>
          <h1 class="page-title">Отзывы</h1>
        </div>
        
        ${this.renderAudioPreview()}
        
        <div class="audio-reviews-content">
          ${this.renderReviewsList()}
          ${this.renderAddReviewForm()}
        </div>
      </div>
    `;
  }
  
  /**
   * Render compact audio card preview
   */
  renderAudioPreview() {
    if (!this.audioTitle) {
      return '<div class="audio-preview-placeholder"></div>';
    }
    
    const { avgRating, total } = this.feedbackState.stats;
    
    return `
      <div class="audio-reviews-preview">
        ${this.audioCover ? `
          <div class="audio-reviews-preview-cover">
            <img src="${this.escapeHtml(this.audioCover)}" alt="${this.escapeHtml(this.audioTitle)}" />
          </div>
        ` : ''}
        <div class="audio-reviews-preview-info">
          <h3 class="audio-reviews-preview-title">${this.escapeHtml(this.audioTitle)}</h3>
          ${this.audioAuthor ? `<div class="audio-reviews-preview-author">${this.escapeHtml(this.audioAuthor)}</div>` : ''}
          ${this.audioDescription ? `<div class="audio-reviews-preview-description">${this.escapeHtml(this.audioDescription)}</div>` : ''}
          <div class="audio-reviews-preview-rating" id="stats-header">
            ${total > 0 ? `⭐ ${avgRating.toFixed(1)} * ${total} ${this.pluralizeReviews(total)}` : 'Нет отзывов'}
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render reviews list section
   */
  renderReviewsList() {
    return `
      <div class="audio-reviews-section">
        <h4 class="audio-reviews-section-title">Отзывы других пользователей</h4>
        <div class="audio-reviews-list" id="reviews-list">
          ${this.feedbackState.isLoadingComments ? `
            <div class="audio-reviews-loading">Загрузка отзывов...</div>
          ` : this.feedbackState.comments.length === 0 ? `
            <div class="audio-reviews-empty">Пока нет отзывов. Будьте первым!</div>
          ` : this.renderComments()}
        </div>
      </div>
    `;
  }
  
  /**
   * Render individual comments
   */
  renderComments() {
    return this.feedbackState.comments.map(comment => `
      <div class="audio-reviews-item">
        <div class="audio-reviews-item-header">
          <div class="audio-reviews-item-user">
            ${comment.avatar ? `
              <img src="${this.escapeHtml(comment.avatar)}" alt="${this.escapeHtml(comment.displayName)}" class="audio-reviews-item-avatar" />
            ` : `
              <div class="audio-reviews-item-avatar audio-reviews-item-avatar--placeholder">
                ${this.escapeHtml(comment.displayName?.charAt(0) || '?')}
              </div>
            `}
            <div class="audio-reviews-item-info">
              <div class="audio-reviews-item-name">${this.escapeHtml(comment.displayName || 'Аноним')}</div>
              <div class="audio-reviews-item-rating">
                ${'⭐'.repeat(comment.rating)}
              </div>
            </div>
          </div>
          <div class="audio-reviews-item-date">
            ${this.formatDate(comment.createdAt)}
          </div>
        </div>
        ${comment.text ? `<div class="audio-reviews-item-text">${this.escapeHtml(comment.text)}</div>` : ''}
      </div>
    `).join('');
  }
  
  /**
   * Render add review form section (sticky at bottom)
   */
  renderAddReviewForm() {
    return `
      <div class="audio-reviews-add-section" id="add-review-section">
        <h4 class="audio-reviews-section-title">Ваша оценка</h4>
        
        <div class="audio-reviews-rating">
          <div class="audio-reviews-stars">
            ${this.renderStars()}
          </div>
          <div class="audio-reviews-rating-label">
            <span id="rating-label">Выберите оценку</span>
          </div>
        </div>
        
        <div class="audio-reviews-review">
          <label for="reviews-textarea" class="audio-reviews-label">
            Ваш отзыв (необязательно)
          </label>
          <textarea 
            id="reviews-textarea"
            class="audio-reviews-textarea"
            placeholder="Поделитесь впечатлениями (до 300 символов)..."
            maxlength="300"
            rows="4"
          ></textarea>
          <div class="audio-reviews-char-counter">
            <span id="char-current">0</span> / 300
          </div>
        </div>
        
        <button id="reviews-submit" class="audio-reviews-submit" disabled>
          Отправить отзыв
        </button>
      </div>
    `;
  }
  
  /**
   * Render star buttons
   */
  renderStars() {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `
        <button 
          class="audio-reviews-star" 
          data-rating="${i}"
          aria-label="Оценить ${i} из 5"
        >
          <svg class="audio-reviews-star-icon" viewBox="0 0 24 24" width="32" height="32">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
                  fill="currentColor"/>
          </svg>
        </button>
      `;
    }
    return html;
  }
  
  /**
   * Attach event listeners after rendering
   */
  attachEventListeners() {
    // Back button
    const backBtn = document.getElementById('reviews-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.app.router) {
          this.app.router.back();
        }
      });
    }
    
    // Star rating
    const stars = document.querySelectorAll('.audio-reviews-star');
    const textarea = document.getElementById('reviews-textarea');
    const charCounter = document.getElementById('char-current');
    const submitBtn = document.getElementById('reviews-submit');
    const ratingLabel = document.getElementById('rating-label');
    
    this.elements = {
      stars: Array.from(stars),
      textarea,
      charCounter,
      submitBtn,
      ratingLabel,
      commentsList: document.getElementById('reviews-list'),
      statsHeader: document.getElementById('stats-header')
    };
    
    // Star click handlers
    stars.forEach((star, index) => {
      star.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleStarClick(index + 1);
      });
    });
    
    // Textarea input handler
    if (textarea) {
      textarea.addEventListener('input', () => {
        const length = textarea.value.length;
        if (charCounter) {
          charCounter.textContent = length;
        }
        
        // Warning at 280+ chars
        const counterContainer = document.querySelector('.audio-reviews-char-counter');
        if (counterContainer) {
          if (length >= 280) {
            counterContainer.classList.add('audio-reviews-char-counter--warning');
          } else {
            counterContainer.classList.remove('audio-reviews-char-counter--warning');
          }
        }
      });
    }
    
    // Submit button handler
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handleSubmit());
    }
  }
  
  /**
   * Called when page is shown
   */
  async onShow() {
    console.log('AudioReviewsPage: onShow called');
    
    // Setup Telegram BackButton
    if (window.Telegram?.WebApp?.BackButton) {
      // Store handler reference for proper cleanup in onHide
      // Telegram API requires passing the same handler to both onClick and offClick
      this._backButtonHandler = () => {
        if (this.app?.router) {
          this.app.router.back();
        }
      };
      
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(this._backButtonHandler);
    }
    
    // Fetch stats and comments
    await Promise.all([
      this.fetchStats(),
      this.fetchComments()
    ]);
    
    // Update UI with fetched data
    this.updateStatsHeader();
    this.updateCommentsList();
  }
  
  /**
   * Called when page is hidden
   */
  onHide() {
    console.log('AudioReviewsPage: onHide called');
    
    // Hide Telegram BackButton and remove handler
    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.hide();
      if (this._backButtonHandler) {
        window.Telegram.WebApp.BackButton.offClick(this._backButtonHandler);
        this._backButtonHandler = null;
      }
    }
  }
  
  /**
   * Fetch feedback stats
   */
  async fetchStats() {
    if (!this.audioId) return;
    
    this.feedbackState.isLoadingStats = true;
    
    try {
      const response = await fetch(`/api/reader/feedback/audio/${this.audioId}/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const result = await response.json();
      this.feedbackState.stats = result.data || { avgRating: 0, total: 0, distribution: {} };
      console.log('AudioReviewsPage: Stats fetched:', this.feedbackState.stats);
    } catch (error) {
      console.error('Failed to fetch feedback stats:', error);
      this.feedbackState.stats = { avgRating: 0, total: 0, distribution: {} };
    } finally {
      this.feedbackState.isLoadingStats = false;
    }
  }
  
  /**
   * Fetch comments
   */
  async fetchComments() {
    if (!this.audioId) return;
    
    this.feedbackState.isLoadingComments = true;
    
    try {
      const response = await fetch(`/api/reader/feedback/audio/${this.audioId}/comments?limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      
      const result = await response.json();
      this.feedbackState.comments = result.data?.items || [];
      console.log('AudioReviewsPage: Comments fetched:', this.feedbackState.comments.length);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      this.feedbackState.comments = [];
    } finally {
      this.feedbackState.isLoadingComments = false;
    }
  }
  
  /**
   * Update stats header display
   */
  updateStatsHeader() {
    if (!this.elements.statsHeader) return;
    
    const { avgRating, total } = this.feedbackState.stats;
    this.elements.statsHeader.textContent = total > 0 
      ? `⭐ ${avgRating.toFixed(1)} * ${total} ${this.pluralizeReviews(total)}`
      : 'Нет отзывов';
  }
  
  /**
   * Update comments list display
   */
  updateCommentsList() {
    if (!this.elements.commentsList) return;
    
    if (this.feedbackState.isLoadingComments) {
      this.elements.commentsList.innerHTML = '<div class="audio-reviews-loading">Загрузка отзывов...</div>';
    } else if (this.feedbackState.comments.length === 0) {
      this.elements.commentsList.innerHTML = '<div class="audio-reviews-empty">Пока нет отзывов. Будьте первым!</div>';
    } else {
      this.elements.commentsList.innerHTML = this.renderComments();
    }
  }
  
  /**
   * Handle star click
   */
  handleStarClick(rating) {
    this.feedbackState.selectedRating = rating;
    
    // Update visual state
    this.elements.stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('audio-reviews-star--active');
      } else {
        star.classList.remove('audio-reviews-star--active');
      }
    });
    
    // Update label
    if (this.elements.ratingLabel) {
      this.elements.ratingLabel.textContent = RATING_LABELS[rating] || '';
    }
    
    // Enable submit button
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = false;
    }
    
    // Haptic feedback
    this.triggerHaptic('light');
  }
  
  /**
   * Handle form submission
   */
  async handleSubmit() {
    if (this.feedbackState.isSubmitting) return;
    if (this.feedbackState.selectedRating === 0) {
      alert('Пожалуйста, выберите оценку');
      return;
    }
    
    this.feedbackState.isSubmitting = true;
    
    // Disable submit button
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = true;
      this.elements.submitBtn.textContent = 'Отправка...';
    }
    
    try {
      const text = this.elements.textarea?.value?.trim() || '';
      const rating = this.feedbackState.selectedRating;
      
      // Get user ID
      const userId = this.getUserId();
      
      // Prepare payload
      // Note: API expects 'telegramId' property name, even though value may be a fallback
      const payload = {
        telegramId: userId,
        rating,
        text,
        context: 'bot',
        source: 'mini_app',
        tags: ['audio', this.audioId, this.audioSlug || this.audioId]
      };
      
      // Submit to API
      const response = await fetch('/api/reader/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${window.Telegram?.WebApp?.initData || ''}`,
          'X-User-Id': userId
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }
      
      console.log('✅ Feedback submitted successfully');
      
      // Success haptic
      this.triggerHaptic('success');
      
      // Refresh stats and comments without navigating away
      await Promise.all([
        this.fetchStats(),
        this.fetchComments()
      ]);
      
      // Update UI
      this.updateStatsHeader();
      this.updateCommentsList();
      
      // Reset form
      this.resetForm();
      
      // Scroll to top of reviews list to show new comment
      const reviewsList = document.querySelector('.audio-reviews-list');
      if (reviewsList) {
        reviewsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert(error.message || 'Не удалось отправить отзыв. Попробуйте позже.');
      
      // Error haptic
      this.triggerHaptic('error');
      
      // Re-enable submit button
      if (this.elements.submitBtn) {
        this.elements.submitBtn.disabled = false;
        this.elements.submitBtn.textContent = 'Отправить отзыв';
      }
    } finally {
      this.feedbackState.isSubmitting = false;
    }
  }
  
  /**
   * Reset the form after successful submission
   */
  resetForm() {
    // Reset selected rating
    this.feedbackState.selectedRating = 0;
    
    // Reset star buttons
    this.elements.stars.forEach(star => {
      star.classList.remove('audio-reviews-star--active');
    });
    
    // Reset rating label
    if (this.elements.ratingLabel) {
      this.elements.ratingLabel.textContent = 'Выберите оценку';
    }
    
    // Clear textarea
    if (this.elements.textarea) {
      this.elements.textarea.value = '';
    }
    
    // Reset char counter
    if (this.elements.charCounter) {
      this.elements.charCounter.textContent = '0';
    }
    
    // Disable submit button
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = true;
      this.elements.submitBtn.textContent = 'Отправить отзыв';
    }
  }
  
  /**
   * Get user ID from Telegram WebApp
   */
  getUserId() {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return String(window.Telegram.WebApp.initDataUnsafe.user.id);
    }
    return localStorage.getItem('telegramUserId') || '0';
  }
  
  /**
   * Trigger haptic feedback
   */
  triggerHaptic(type = 'light') {
    if (this.telegram && this.telegram.HapticFeedback) {
      this.telegram.HapticFeedback.impactOccurred(type);
    }
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
  }
  
  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    } else if (days > 0) {
      return `${days} ${this.pluralizeDays(days)} назад`;
    } else if (hours > 0) {
      return `${hours} ${this.pluralizeHours(hours)} назад`;
    } else if (minutes > 0) {
      return `${minutes} ${this.pluralizeMinutes(minutes)} назад`;
    } else {
      return 'только что';
    }
  }
  
  /**
   * Pluralize Russian "отзыв"
   */
  pluralizeReviews(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
      return 'отзыв';
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return 'отзыва';
    }
    return 'отзывов';
  }
  
  /**
   * Pluralize Russian "день"
   */
  pluralizeDays(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
      return 'день';
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return 'дня';
    }
    return 'дней';
  }
  
  /**
   * Pluralize Russian "час"
   */
  pluralizeHours(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
      return 'час';
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return 'часа';
    }
    return 'часов';
  }
  
  /**
   * Pluralize Russian "минута"
   */
  pluralizeMinutes(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
      return 'минута';
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return 'минуты';
    }
    return 'минут';
  }
}

// Export to global scope
window.AudioReviewsPage = AudioReviewsPage;
