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
    
    const pill = document.createElement('div');
    pill.className = 'rating-pill';
    pill.textContent = `${avgRating.toFixed(1)}/5 • ${total} ${this.pluralizeReviews(total)}`;
    
    this.coverElement.style.position = 'relative';
    this.coverElement.appendChild(pill);
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
    
    // Create compact stats display (if there are ratings)
    if (total > 0) {
      const statsText = document.createElement('span');
      statsText.className = 'feedback-stats-text';
      statsText.textContent = `${avgRating.toFixed(1)}/5 • ${total} ${this.pluralizeReviews(total)}`;
      actionsContainer.appendChild(statsText);
    }
    
    // Create feedback button
    const feedbackBtn = document.createElement('button');
    feedbackBtn.className = 'feedback-btn';
    feedbackBtn.textContent = total > 0 ? 'Отзыв' : 'Оценить';
    feedbackBtn.setAttribute('aria-label', total > 0 ? 'Написать отзыв' : 'Оценить аудиоразбор');
    feedbackBtn.addEventListener('click', (e) => this.handleFeedbackClick(e));
    this.elements.feedbackBtn = feedbackBtn;
    
    actionsContainer.appendChild(feedbackBtn);
    
    // Insert feedback actions safely before buy button or prepend to footer
    const buyButton = this.footerElement.querySelector('.buy-button');
    if (buyButton && this.footerElement.contains(buyButton)) {
      // Insert before buy button
      this.footerElement.insertBefore(actionsContainer, buyButton);
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
   * Handle feedback button click - open modal
   */
  handleFeedbackClick(event) {
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
    // Create and open FeedbackModal
    const feedbackModal = new FeedbackModal({
      audioId: this.audioId,
      audioSlug: this.audioSlug,
      audioTitle: 'аудиоразбор',
      telegram: this.telegram,
      onSubmit: async () => {
        // Refresh stats after submission
        await this.fetchStats();
        this.updatePill();
        this.updateActions();
      }
    });
    
    feedbackModal.open();
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
      this.elements.pill.textContent = `${avgRating.toFixed(1)}/5 • ${total} ${this.pluralizeReviews(total)}`;
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
    
    // Update or create stats text
    let statsText = actionsContainer.querySelector('.feedback-stats-text');
    if (total > 0) {
      if (!statsText) {
        statsText = document.createElement('span');
        statsText.className = 'feedback-stats-text';
        actionsContainer.insertBefore(statsText, actionsContainer.firstChild);
      }
      statsText.textContent = `${avgRating.toFixed(1)}/5 • ${total} ${this.pluralizeReviews(total)}`;
    } else if (statsText) {
      statsText.remove();
    }
    
    // Update button text
    const feedbackBtn = actionsContainer.querySelector('.feedback-btn');
    if (feedbackBtn) {
      feedbackBtn.textContent = total > 0 ? 'Отзыв' : 'Оценить';
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
