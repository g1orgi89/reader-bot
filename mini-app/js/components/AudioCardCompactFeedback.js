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
      selectedRating: 0,
      isSubmitting: false
    };
    
    this.elements = {
      pill: null,
      stars: [],
      commentBtn: null,
      sheet: null
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
      console.error('AudioCardCompactFeedback init failed', e);
      // Non-fatal: do not block page
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
   * Render actions (stars + comment button) in footer
   */
  renderActions() {
    if (!this.footerElement) return;
    
    // Create feedback actions container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'feedback-actions';
    
    // Create stars container
    const starsContainer = document.createElement('div');
    starsContainer.className = 'stars-rate';
    
    // Create 5 star buttons
    for (let i = 1; i <= 5; i++) {
      const starBtn = document.createElement('button');
      starBtn.className = 'star-btn';
      starBtn.textContent = '⭐';
      starBtn.dataset.rating = i;
      starBtn.setAttribute('aria-label', `Оценить ${i} из 5`);
      
      starBtn.addEventListener('click', (e) => this.handleStarClick(i, e));
      
      starsContainer.appendChild(starBtn);
      this.elements.stars.push(starBtn);
    }
    
    // Create comment button
    const commentBtn = document.createElement('button');
    commentBtn.className = 'comment-btn';
    commentBtn.innerHTML = '💬 Отзыв';
    commentBtn.setAttribute('aria-label', 'Написать отзыв');
    commentBtn.addEventListener('click', (e) => this.handleCommentClick(e));
    this.elements.commentBtn = commentBtn;
    
    actionsContainer.appendChild(starsContainer);
    actionsContainer.appendChild(commentBtn);
    
    // Insert feedback actions near the buy button safely
    const existingButton = this.footerElement.querySelector('.buy-button');
    if (existingButton && this.footerElement.contains(existingButton)) {
      // Place actions before the primary CTA
      this.footerElement.insertBefore(actionsContainer, existingButton);
    } else {
      // Fallback: add at the top of footer for better visibility
      if (typeof this.footerElement.prepend === 'function') {
        this.footerElement.prepend(actionsContainer);
      } else {
        this.footerElement.insertBefore(actionsContainer, this.footerElement.firstChild);
      }
    }
  }
  
  /**
   * Handle star click - submit rating
   */
  async handleStarClick(rating, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (this.state.isSubmitting) return;
    
    // Visual feedback
    this.updateStarsVisual(rating);
    
    // Haptic feedback
    if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
      this.telegram.hapticFeedback('light');
    }
    
    this.state.selectedRating = rating;
    
    // Submit rating
    await this.submitFeedback(rating, '');
  }
  
  /**
   * Handle comment button click - open sheet
   */
  handleCommentClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Haptic feedback
    if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
      this.telegram.hapticFeedback('light');
    }
    
    this.openCommentSheet();
  }
  
  /**
   * Update stars visual state
   */
  updateStarsVisual(rating) {
    this.elements.stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }
  
  /**
   * Open comment sheet
   */
  openCommentSheet() {
    // Create sheet if it doesn't exist
    if (!this.elements.sheet) {
      this.createSheet();
    }
    
    // Show sheet
    this.elements.sheet.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  
  /**
   * Close comment sheet
   */
  closeCommentSheet() {
    if (this.elements.sheet) {
      this.elements.sheet.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }
  
  /**
   * Create comment sheet
   */
  createSheet() {
    const sheet = document.createElement('div');
    sheet.className = 'rating-sheet';
    
    sheet.innerHTML = `
      <div class="sheet-content">
        <div class="sheet-header">
          <div class="sheet-title">Ваш отзыв</div>
          <button class="close-btn" aria-label="Закрыть">×</button>
        </div>
        <textarea 
          placeholder="Поделитесь впечатлениями об аудиоразборе (до 300 символов)..."
          maxlength="300"
          class="feedback-textarea"
        ></textarea>
        <div class="char-counter">
          <span class="current">0</span> / 300
        </div>
        <button class="submit-btn">Отправить отзыв</button>
      </div>
    `;
    
    document.body.appendChild(sheet);
    this.elements.sheet = sheet;
    
    // Attach event listeners
    const closeBtn = sheet.querySelector('.close-btn');
    const textarea = sheet.querySelector('.feedback-textarea');
    const submitBtn = sheet.querySelector('.submit-btn');
    const charCounter = sheet.querySelector('.char-counter');
    
    closeBtn.addEventListener('click', () => this.closeCommentSheet());
    
    // Click outside to close
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        this.closeCommentSheet();
      }
    });
    
    // Character counter
    textarea.addEventListener('input', () => {
      const current = textarea.value.length;
      const currentSpan = charCounter.querySelector('.current');
      currentSpan.textContent = current;
      
      if (current >= 280) {
        charCounter.classList.add('warning');
      } else {
        charCounter.classList.remove('warning');
      }
    });
    
    // Submit button
    submitBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        alert('Пожалуйста, введите текст отзыва');
        return;
      }
      
      // Use selected rating or default to 5
      const rating = this.state.selectedRating || 5;
      
      await this.submitFeedback(rating, text);
      this.closeCommentSheet();
      
      // Clear textarea
      textarea.value = '';
      charCounter.querySelector('.current').textContent = '0';
    });
  }
  
  /**
   * Submit feedback to API
   */
  async submitFeedback(rating, text) {
    if (this.state.isSubmitting) return;
    
    this.state.isSubmitting = true;
    
    // Disable stars and buttons
    this.elements.stars.forEach(star => star.disabled = true);
    if (this.elements.commentBtn) {
      this.elements.commentBtn.disabled = true;
    }
    
    try {
      const telegramId = this.getUserId();
      
      const payload = {
        telegramId,
        rating,
        text,
        context: 'bot',
        source: 'mini_app',
        tags: ['audio', this.audioId, this.audioSlug]
      };
      
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
        throw new Error('Failed to submit feedback');
      }
      
      console.log('✅ Feedback submitted successfully');
      
      // Update stats
      await this.fetchStats();
      this.updatePill();
      
      // Show success feedback
      if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
        this.telegram.hapticFeedback('success');
      }
      
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Не удалось отправить отзыв. Попробуйте позже.');
      
      // Reset visual state
      this.updateStarsVisual(0);
      
      if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
        this.telegram.hapticFeedback('error');
      }
    } finally {
      this.state.isSubmitting = false;
      
      // Re-enable stars and buttons
      this.elements.stars.forEach(star => star.disabled = false);
      if (this.elements.commentBtn) {
        this.elements.commentBtn.disabled = false;
      }
    }
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
    if (this.elements.sheet) {
      this.elements.sheet.remove();
    }
    // Stars and comment button are part of footer, will be removed with card
  }
}

// Export to global scope
window.AudioCardCompactFeedback = AudioCardCompactFeedback;
