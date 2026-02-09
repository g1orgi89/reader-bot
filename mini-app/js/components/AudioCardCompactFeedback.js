/**
 * AudioCardCompactFeedback - Компактный компонент рейтинга/отзывов для карточек аудио
 * Vanilla JS implementation для интеграции в FreeAudiosPage
 */

class AudioCardCompactFeedback {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.audioId - Audio ID
   * @param {string} options.audioSlug - Audio slug for tags
   * @param {string} options.audioTitle - Audio title
   * @param {string} options.audioAuthor - Audio author
   * @param {string} options.audioDescription - Audio description
   * @param {string} options.audioCover - Audio cover URL
   * @param {HTMLElement} options.footerElement - Book footer element for inline rating
   * @param {Function} options.apiService - API service instance
   * @param {Function} options.telegram - Telegram WebApp instance
   */
  constructor(options) {
    this.audioId = options.audioId;
    this.audioSlug = options.audioSlug || options.audioId;
    this.audioTitle = options.audioTitle || '';
    this.audioAuthor = options.audioAuthor || '';
    this.audioDescription = options.audioDescription || '';
    this.audioCover = options.audioCover || '';
    this.footerElement = options.footerElement;
    this.api = options.apiService;
    this.telegram = options.telegram;
    
    this.state = {
      stats: null,
      isSubmitting: false
    };
    
    this.elements = {
      inlineRating: null
    };
    
    this.init();
  }
  
  /**
   * Initialize the component
   */
  async init() {
    try {
      await this.fetchStats();
      this.renderFooterInline();
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
   * Render compact rating row as FIRST element in book-footer
   */
  renderFooterInline() {
    if (!this.footerElement) return;
    
    const { avgRating = 0, total = 0 } = this.state.stats || {};
    
    // Create compact inline rating row
    const ratingRow = document.createElement('div');
    ratingRow.className = 'feedback-inline';
    
    const button = document.createElement('button');
    button.className = 'feedback-inline-link';
    button.type = 'button';
    button.setAttribute('aria-label', total > 0 ? 'Открыть отзывы' : 'Оценить аудиоразбор');
    
    // Set text based on whether there are ratings
    // Format: "⭐ X.Y * N отзывов" without 'Рейтинг' word and 'из 5'
    if (total > 0) {
      button.textContent = `⭐ ${avgRating.toFixed(1)} * ${total} ${this.pluralizeReviews(total)}`;
    } else {
      button.textContent = '⭐ 0.0 * 0 отзывов';
    }
    
    // Make button clickable to open modal
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleCommentClick(e);
    });
    
    ratingRow.appendChild(button);
    
    // Insert as FIRST element in footer to align left with pricing
    if (typeof this.footerElement.prepend === 'function') {
      this.footerElement.prepend(ratingRow);
    } else {
      this.footerElement.insertBefore(ratingRow, this.footerElement.firstChild);
    }
    
    this.elements.inlineRating = ratingRow;
  }
  
  /**
   * Handle comment/rating click - open modal
   * This is the single entry point for opening the feedback modal
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
    
    // Check if FeedbackModal is available
    if (!window.FeedbackModal) {
      console.error('FeedbackModal not loaded');
      return;
    }
    
    this.openFeedbackModal();
  }
  

  
  /**
   * Open feedback modal
   */
  openFeedbackModal() {
    const { avgRating, total } = this.state.stats;
    
    // Create and open FeedbackModal
    const feedbackModal = new FeedbackModal({
      audioId: this.audioId,
      audioSlug: this.audioSlug,
      audioTitle: this.audioTitle,
      audioAuthor: this.audioAuthor,
      audioDescription: this.audioDescription,
      audioCover: this.audioCover,
      avgRating: avgRating || 0,
      totalReviews: total || 0,
      telegram: this.telegram,
      onSubmit: async () => {
        // Refresh stats after submission
        await this.fetchStats();
        this.updateInlineRating();
      }
    });
    
    feedbackModal.open();
  }
  
  /**
   * Update inline rating row with new stats
   */
  updateInlineRating() {
    if (!this.elements.inlineRating) return;
    
    const button = this.elements.inlineRating.querySelector('.feedback-inline-link');
    if (!button) return;
    
    const { avgRating = 0, total = 0 } = this.state.stats || {};
    
    if (total > 0) {
      button.textContent = `⭐ ${avgRating.toFixed(1)} * ${total} ${this.pluralizeReviews(total)}`;
    } else {
      button.textContent = '⭐ 0.0 * 0 отзывов';
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
    if (this.elements.inlineRating) {
      this.elements.inlineRating.remove();
    }
  }
}

// Export to global scope
window.AudioCardCompactFeedback = AudioCardCompactFeedback;
