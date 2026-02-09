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
   * @param {Function} options.onSubmit - Callback after successful submission
   * @param {Object} options.telegram - Telegram WebApp instance
   */
  constructor(options) {
    this.audioId = options.audioId;
    this.audioSlug = options.audioSlug || options.audioId;
    this.audioTitle = options.audioTitle || 'аудиоразбор';
    this.onSubmit = options.onSubmit;
    this.telegram = options.telegram || window.Telegram?.WebApp;
    
    this.state = {
      selectedRating: 0,
      isSubmitting: false
    };
    
    this.modal = null;
    this.elements = {
      stars: [],
      textarea: null,
      charCounter: null,
      submitBtn: null
    };
  }
  
  /**
   * Open the feedback modal
   */
  open() {
    // Haptic feedback
    this.triggerHaptic('light');
    
    // Create modal content
    const content = this.renderContent();
    
    // Create modal using base Modal class
    this.modal = new Modal({
      title: 'Ваш отзыв',
      content: content,
      size: 'medium',
      position: 'bottom',
      animation: 'slide',
      showCloseButton: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      className: 'feedback-modal',
      onOpen: () => this.attachEventListeners(),
      onClose: () => this.cleanup()
    });
    
    this.modal.open();
  }
  
  /**
   * Render modal content
   */
  renderContent() {
    return `
      <div class="feedback-modal__content">
        <div class="feedback-modal__subtitle">
          Оцените ${this.escapeHtml(this.audioTitle)}
        </div>
        
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
      
      // Call callback
      if (this.onSubmit) {
        this.onSubmit();
      }
      
      // Close modal
      this.modal.close();
      
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
}

// Export to global scope
window.FeedbackModal = FeedbackModal;
