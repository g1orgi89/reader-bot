/**
 * AudioCardCompactFeedback - Компактный компонент рейтинга/отзывов для карточек аудио
 * Vanilla JS implementation для интеграции в FreeAudiosPage
 */

class AudioCardCompactFeedback {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.audioId - Audio ID
   * @param {string} options.audioSlug - Audio slug for tags
   * @param {HTMLElement} options.coverElement - Book cover element for pill
   * @param {HTMLElement} options.footerElement - Book footer element for actions
   * @param {Function} options.apiService - API service instance
   * @param {Function} options.telegram - Telegram WebApp instance
   */
  constructor(options) {
    this.audioId = options.audioId;
    this.audioSlug = options.audioSlug || options.audioId;
    this.coverElement = options.coverElement;
    this.footerElement = options.footerElement;
    this.api = options.apiService;
    this.telegram = options.telegram;
    
    this.state = {
      stats: null,
      isSubmitting: false
    };
    
    this.elements = {
      pill: null,
      feedbackBtn: null
    };
    
    this.init();
  }
  
  /**
   * Initialize the component
   */
  async init() {
    try {
      await this.fetchStats();
      this.renderPill();
      this.renderActions();
    } catch (e) {
      console.error(`AudioCardCompactFeedback init failed for audio ${this.audioId}:`, e);
      // Non-fatal: do not block page rendering
    }
  }
  
  /**
   * Fetch feedback stats for this audio
   */
  async fetchStats() {
    try {
      const response = await fetch(`/api/reader/feedback/audio/${this.audioId}/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const result = await response.json();
      this.state.stats = result.data || { avgRating: 0, total: 0, distribution: {} };
    } catch (error) {
      console.warn('Failed to fetch feedback stats:', error);
      this.state.stats = { avgRating: 0, total: 0, distribution: {} };
    }
  }
  
  /**
   * Render rating pill in cover
   */
  renderPill() {
    if (!this.coverElement) return;
    
    const { avgRating, total } = this.state.stats;
    
    // Don't show pill if no ratings yet
    if (!total) return;
    
    const ratingText = `${avgRating.toFixed(1)}/5`;
    const reviewsText = `• ${total} ${this.pluralizeReviews(total)}`;
    
    const pill = document.createElement('div');
    pill.className = 'rating-pill';
    pill.textContent = `⭐ ${ratingText} ${reviewsText}`;
    
    this.coverElement.style.position = 'relative';
    this.coverElement.appendChild(pill);
    
    // Measure and adjust to multiline if needed
    requestAnimationFrame(() => {
      const maxWidth = this.coverElement.clientWidth - 16;
      if (pill.offsetWidth > maxWidth) {
        pill.classList.add('multiline');
        pill.innerHTML = `<span class="pill-rating">⭐ ${ratingText}</span><span class="pill-reviews">${reviewsText}</span>`;
      }
    });
    
    // Make pill clickable to open modal
    pill.style.cursor = 'pointer';
    pill.addEventListener('click', (e) => this.handleCommentClick(e));
    
    this.elements.pill = pill;
  }
  
  /**
   * Render actions (compact stats + feedback button) in footer
   */
  renderActions() {
    if (!this.footerElement) return;
    
    const { avgRating, total } = this.state.stats;
    
    // Create feedback actions container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'feedback-actions compact';
    
    // Create single link/button that shows stats or "Оценить"
    const statsBtn = document.createElement('button');
    statsBtn.className = 'feedback-link';
    statsBtn.type = 'button';
    statsBtn.textContent = total > 0 
      ? `${avgRating.toFixed(1)}/5 • ${total} ${this.pluralizeReviews(total)}` 
      : 'Оценить';
    statsBtn.setAttribute('aria-label', total > 0 ? 'Открыть отзывы' : 'Оценить аудиоразбор');
    statsBtn.addEventListener('click', (e) => this.handleCommentClick(e));
    
    actionsContainer.appendChild(statsBtn);
    
    // Safe DOM insertion: after .book-pricing, before .buy-button, else prepend
    const pricing = this.footerElement.querySelector('.book-pricing');
    const buyBtn = this.footerElement.querySelector('.buy-button');
    
    if (pricing && this.footerElement.contains(pricing)) {
      pricing.insertAdjacentElement('afterend', actionsContainer);
    } else if (buyBtn && this.footerElement.contains(buyBtn)) {
      this.footerElement.insertBefore(actionsContainer, buyBtn);
    } else {
      // Prepend to footer
      if (typeof this.footerElement.prepend === 'function') {
        this.footerElement.prepend(actionsContainer);
      } else {
        this.footerElement.insertBefore(actionsContainer, this.footerElement.firstChild);
      }
    }
  }
  
  /**
   * Handle comment/feedback button click - open modal
   */
  handleCommentClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Haptic feedback
    if (this.telegram && typeof this.telegram.HapticFeedback === 'object') {
      this.telegram.HapticFeedback.impactOccurred('light');
    }
    
    this.openFeedbackModal();
  }
  
  /**
   * Open feedback modal
   */
  openFeedbackModal() {
    // Check if FeedbackModal is available
    if (!window.FeedbackModal) {
      console.error('FeedbackModal not loaded');
      return;
    }
    
    // Create and open FeedbackModal with new API
    const feedbackModal = new window.FeedbackModal({
      audioId: this.audioId,
      api: this.api,
      telegram: this.telegram
    });
    
    feedbackModal.open().then(() => {
      // Refresh stats after modal closes
      this.fetchStats().then(() => {
        this.updatePill();
        this.updateActions();
      });
    }).catch(error => {
      console.error('Failed to open feedback modal:', error);
    });
  }
  
  /**
   * Update pill with new stats
   */
  updatePill() {
    if (!this.elements.pill && this.state.stats.total > 0) {
      // Create pill if it doesn't exist yet
      this.renderPill();
      return;
    }
    
    if (this.elements.pill) {
      const { avgRating, total } = this.state.stats;
      const ratingText = `${avgRating.toFixed(1)}/5`;
      const reviewsText = `• ${total} ${this.pluralizeReviews(total)}`;
      
      // Check if multiline
      if (this.elements.pill.classList.contains('multiline')) {
        this.elements.pill.innerHTML = `<span class="pill-rating">⭐ ${ratingText}</span><span class="pill-reviews">${reviewsText}</span>`;
      } else {
        this.elements.pill.textContent = `⭐ ${ratingText} ${reviewsText}`;
      }
    }
  }
  
  /**
   * Update actions with new stats
   */
  updateActions() {
    // Find and update the actions container
    const actionsContainer = this.footerElement?.querySelector('.feedback-actions.compact');
    if (!actionsContainer) return;
    
    const { avgRating, total } = this.state.stats;
    
    // Update the button text
    const statsBtn = actionsContainer.querySelector('.feedback-link');
    if (statsBtn) {
      statsBtn.textContent = total > 0 
        ? `${avgRating.toFixed(1)}/5 • ${total} ${this.pluralizeReviews(total)}` 
        : 'Оценить';
    }
  }
  
  /**
   * Get user ID from Telegram WebApp
   */
  getUserId() {
    // Try to get from Telegram WebApp
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return String(window.Telegram.WebApp.initDataUnsafe.user.id);
    }
    
    // Fallback to localStorage or default
    return localStorage.getItem('telegramUserId') || '0';
  }
  
  /**
   * Pluralize Russian word "отзыв"
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
   * Cleanup - remove all elements
   */
  destroy() {
    if (this.elements.pill) {
      this.elements.pill.remove();
    }
    // Feedback button is part of footer, will be removed with card
  }
}

// Export to global scope
window.AudioCardCompactFeedback = AudioCardCompactFeedback;
