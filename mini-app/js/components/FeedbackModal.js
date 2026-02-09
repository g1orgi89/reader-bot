/**
 * FeedbackModal - Compact modal for rating and reviewing audio content
 * Extends the base Modal.js component
 * Vanilla JS implementation for audio feedback
 */

class FeedbackModal {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.audioId - Audio ID
   * @param {string} options.audioSlug - Audio slug for tags
   * @param {string} options.audioTitle - Audio title for display
   * @param {string} options.audioAuthor - Audio author for display
   * @param {string} options.audioDescription - Audio description
   * @param {string} options.audioCover - Audio cover URL
   * @param {number} options.avgRating - Average rating
   * @param {number} options.totalReviews - Total reviews count
   * @param {Function} options.onSubmit - Callback after successful submission
   * @param {Object} options.telegram - Telegram WebApp instance
   */
  constructor(options) {
    this.audioId = options.audioId;
    this.audioSlug = options.audioSlug || options.audioId;
    this.audioTitle = options.audioTitle || 'аудиоразбор';
    this.audioAuthor = options.audioAuthor || '';
    this.audioDescription = options.audioDescription || '';
    this.audioCover = options.audioCover || '';
    this.avgRating = options.avgRating || 0;
    this.totalReviews = options.totalReviews || 0;
    this.onSubmit = options.onSubmit;
    this.telegram = options.telegram || window.Telegram?.WebApp;
    
    this.state = {
      selectedRating: 0,
      isSubmitting: false,
      comments: [],
      isLoadingComments: false
    };
    
    this.modal = null;
    this.elements = {
      stars: [],
      textarea: null,
      charCounter: null,
      submitBtn: null,
      commentsList: null
    };
  }
  
  /**
   * Open the feedback modal
   */
  async open() {
    // Haptic feedback
    this.triggerHaptic('light');
    
    // Create modal content
    const content = this.renderContent();
    
    // Create modal using base Modal class
    this.modal = new Modal({
      title: 'Отзывы',
      content: content,
      size: 'medium',
      position: 'bottom',
      animation: 'slide',
      showCloseButton: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      className: 'feedback-modal',
      onOpen: async () => {
        await this.fetchComments();
        this.attachEventListeners();
      },
      onClose: () => this.cleanup()
    });
    
    this.modal.open();
  }
  
  /**
   * Fetch comments from API
   */
  async fetchComments() {
    this.state.isLoadingComments = true;
    
    try {
      const response = await fetch(`/api/reader/feedback/audio/${this.audioId}/comments?limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      
      const result = await response.json();
      this.state.comments = result.data?.items || [];
      this.state.isLoadingComments = false;
      
      // Update the reviews list in the modal
      this.updateReviewsList();
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      this.state.comments = [];
      this.state.isLoadingComments = false;
      this.updateReviewsList();
    }
  }
  
  /**
   * Update reviews list display
   */
  updateReviewsList() {
    const reviewsList = this.modal?.element?.querySelector('#feedback-reviews-list');
    if (!reviewsList) return;
    
    if (this.state.isLoadingComments) {
      reviewsList.innerHTML = '<div class="feedback-modal__loading">Загрузка отзывов...</div>';
    } else if (this.state.comments.length === 0) {
      reviewsList.innerHTML = '<div class="feedback-modal__empty">Пока нет отзывов. Будьте первым!</div>';
    } else {
      reviewsList.innerHTML = this.renderCommentsList();
    }
  }
  
  /**
   * Render modal content
   */
  renderContent() {
    return `
      <div class="feedback-modal__content">
        ${this.renderHeader()}
        ${this.renderReviews()}
        ${this.renderAddReviewForm()}
      </div>
    `;
  }
  
  /**
   * Render card preview header
   */
  renderHeader() {
    if (!this.audioTitle) return '';
    
    return `
      <div class="feedback-modal__header-preview">
        ${this.audioCover ? `
          <div class="feedback-modal__preview-cover">
            <img src="${this.escapeHtml(this.audioCover)}" alt="${this.escapeHtml(this.audioTitle)}" />
          </div>
        ` : ''}
        <div class="feedback-modal__preview-info">
          <h3 class="feedback-modal__preview-title">${this.escapeHtml(this.audioTitle)}</h3>
          ${this.audioAuthor ? `<div class="feedback-modal__preview-author">${this.escapeHtml(this.audioAuthor)}</div>` : ''}
          ${this.audioDescription ? `<div class="feedback-modal__preview-description">${this.escapeHtml(this.audioDescription)}</div>` : ''}
          ${this.totalReviews > 0 ? `
            <div class="feedback-modal__preview-rating">
              ⭐ ${this.avgRating.toFixed(1)}/5 • ${this.totalReviews} ${this.pluralizeReviews(this.totalReviews)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  /**
   * Render reviews list section
   */
  renderReviews() {
    return `
      <div class="feedback-modal__reviews-section">
        <h4 class="feedback-modal__section-title">Отзывы</h4>
        <div class="feedback-modal__reviews-list" id="feedback-reviews-list">
          ${this.state.isLoadingComments ? `
            <div class="feedback-modal__loading">Загрузка отзывов...</div>
          ` : this.state.comments.length === 0 ? `
            <div class="feedback-modal__empty">Пока нет отзывов. Будьте первым!</div>
          ` : this.renderCommentsList()}
        </div>
      </div>
    `;
  }
  
  /**
   * Render individual comments
   */
  renderCommentsList() {
    return this.state.comments.map(comment => `
      <div class="feedback-modal__review-item">
        <div class="feedback-modal__review-header">
          <div class="feedback-modal__review-rating">
            ${'⭐'.repeat(comment.rating)}
          </div>
          <div class="feedback-modal__review-date">
            ${this.formatDate(comment.createdAt)}
          </div>
        </div>
        ${comment.text ? `<div class="feedback-modal__review-text">${this.escapeHtml(comment.text)}</div>` : ''}
      </div>
    `).join('');
  }
  
  /**
   * Render add review form section
   */
  renderAddReviewForm() {
    return `
      <div class="feedback-modal__add-review-section">
        <h4 class="feedback-modal__section-title">Ваша оценка</h4>
        
        <div class="feedback-modal__rating">
          <div class="feedback-modal__stars">
            ${this.renderStars()}
          </div>
          <div class="feedback-modal__rating-label">
            <span id="rating-label">Выберите оценку</span>
          </div>
        </div>
        
        <div class="feedback-modal__review">
          <label for="feedback-textarea" class="feedback-modal__label">
            Ваш отзыв (необязательно)
          </label>
          <textarea 
            id="feedback-textarea"
            class="feedback-modal__textarea"
            placeholder="Поделитесь впечатлениями (до 300 символов)..."
            maxlength="300"
            rows="4"
          ></textarea>
          <div class="feedback-modal__char-counter">
            <span id="char-current">0</span> / 300
          </div>
        </div>
        
        <button id="feedback-submit" class="feedback-modal__submit" disabled>
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
          class="feedback-modal__star" 
          data-rating="${i}"
          aria-label="Оценить ${i} из 5"
        >
          <svg class="feedback-modal__star-icon" viewBox="0 0 24 24" width="32" height="32">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
                  fill="currentColor"/>
          </svg>
        </button>
      `;
    }
    return html;
  }
  
  /**
   * Attach event listeners after modal opens
   */
  attachEventListeners() {
    // Get elements
    const stars = this.modal.element.querySelectorAll('.feedback-modal__star');
    const textarea = this.modal.element.querySelector('#feedback-textarea');
    const charCounter = this.modal.element.querySelector('#char-current');
    const submitBtn = this.modal.element.querySelector('#feedback-submit');
    const ratingLabel = this.modal.element.querySelector('#rating-label');
    
    this.elements = {
      stars: Array.from(stars),
      textarea,
      charCounter,
      submitBtn,
      ratingLabel
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
        const counterContainer = this.modal.element.querySelector('.feedback-modal__char-counter');
        if (counterContainer) {
          if (length >= 280) {
            counterContainer.classList.add('feedback-modal__char-counter--warning');
          } else {
            counterContainer.classList.remove('feedback-modal__char-counter--warning');
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
   * Handle star click
   */
  handleStarClick(rating) {
    this.state.selectedRating = rating;
    
    // Update visual state
    this.elements.stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('feedback-modal__star--active');
      } else {
        star.classList.remove('feedback-modal__star--active');
      }
    });
    
    // Update label
    const labels = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];
    if (this.elements.ratingLabel) {
      this.elements.ratingLabel.textContent = labels[rating] || '';
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
    if (this.state.isSubmitting) return;
    if (this.state.selectedRating === 0) {
      alert('Пожалуйста, выберите оценку');
      return;
    }
    
    this.state.isSubmitting = true;
    
    // Disable submit button
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = true;
      this.elements.submitBtn.textContent = 'Отправка...';
    }
    
    try {
      const text = this.elements.textarea?.value?.trim() || '';
      const rating = this.state.selectedRating;
      
      // Get user ID
      const telegramId = this.getUserId();
      
      // Prepare payload
      const payload = {
        telegramId,
        rating,
        text,
        context: 'bot',
        source: 'mini_app',
        tags: ['audio', this.audioId, this.audioSlug]
      };
      
      // Submit to API
      const response = await fetch('/api/reader/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${window.Telegram?.WebApp?.initData || ''}`,
          'X-User-Id': telegramId
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
      
      // Refresh comments list without closing modal
      await this.fetchComments();
      
      // Reset form
      this.resetForm();
      
      // Update stats for callback
      this.totalReviews = this.state.comments.length;
      this.avgRating = this.calculateAvgRating();
      
      // Call callback
      if (this.onSubmit) {
        this.onSubmit();
      }
      
      // Do NOT close modal - keep it open to show updated reviews
      
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
      this.state.isSubmitting = false;
    }
  }
  
  /**
   * Close the modal
   */
  close() {
    if (this.modal) {
      this.modal.close();
    }
  }
  
  /**
   * Reset the form after successful submission
   */
  resetForm() {
    // Reset selected rating
    this.state.selectedRating = 0;
    
    // Reset star buttons
    this.elements.stars.forEach(star => {
      star.classList.remove('feedback-modal__star--active');
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
   * Calculate average rating from comments
   */
  calculateAvgRating() {
    if (this.state.comments.length === 0) return 0;
    
    const sum = this.state.comments.reduce((acc, comment) => acc + (comment.rating || 0), 0);
    return sum / this.state.comments.length;
  }
  
  /**
   * Cleanup on modal close
   */
  cleanup() {
    this.elements = {
      stars: [],
      textarea: null,
      charCounter: null,
      submitBtn: null
    };
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
window.FeedbackModal = FeedbackModal;
