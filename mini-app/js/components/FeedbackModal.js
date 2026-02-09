/**
 * FeedbackModal - Compact modal for audio feedback with card preview + reviews list
 * Uses Modal.js as base component
 * Shows: card preview header, reviews list, inline rating/comment form
 */

class FeedbackModal {
  /**
   * @param {Object} options
   * @param {string} options.audioId - Audio ID
   * @param {Object} options.api - API service instance
   * @param {Object} options.telegram - Telegram WebApp instance
   */
  constructor(options) {
    this.audioId = options.audioId;
    this.api = options.api;
    this.telegram = options.telegram || window.Telegram?.WebApp;
    
    this.modal = null;
    this.selectedRating = 0;
  }
  
  /**
   * Open the feedback modal
   */
  async open() {
    try {
      // Fetch card metadata
      const meta = await this.fetchCardMeta();
      
      // Build modal content
      const content = this.buildContent(meta);
      
      // Create modal using base Modal class
      this.modal = new window.Modal({
        title: '',
        content: content.outerHTML,
        size: 'medium',
        position: 'bottom',
        animation: 'slide',
        showCloseButton: true,
        closeOnBackdrop: true,
        closeOnEscape: true,
        className: 'feedback-modal',
        onOpen: () => this.initInteractions(),
        onClose: () => this.cleanup()
      });
      
      this.modal.open();
      
      // Return promise that resolves when modal closes
      return new Promise((resolve) => {
        const originalOnClose = this.modal.options.onClose;
        this.modal.options.onClose = () => {
          if (originalOnClose) originalOnClose();
          resolve();
        };
      });
    } catch (error) {
      console.error('Failed to open feedback modal:', error);
      throw error;
    }
  }
  
  /**
   * Build modal content DOM
   */
  buildContent(meta) {
    const container = document.createElement('div');
    container.className = 'feedback-modal';
    
    container.innerHTML = `
      <div class="feedback-preview">
        <div class="preview-cover">
          <img src="${this.escape(meta.coverUrl)}" alt="${this.escape(meta.title)}">
        </div>
        <div class="preview-info">
          <div class="preview-title">${this.escape(meta.title)}</div>
          ${meta.author ? `<div class="preview-author">${this.escape(meta.author)}</div>` : ''}
          ${meta.description ? `<div class="preview-desc">${this.escape(meta.description)}</div>` : ''}
          <div class="preview-rating">⭐ ${meta.avgRating?.toFixed(1) || '0.0'}/5 • ${meta.total || 0} отзывов</div>
        </div>
      </div>
      <div class="feedback-list" id="feedbackList"></div>
      <div class="feedback-form">
        <div class="rating-row" role="radiogroup" aria-label="Оценка">
          ${[1, 2, 3, 4, 5].map(i => 
            `<button class="rating-btn" data-rating="${i}" aria-label="Оценка ${i} из 5">⭐</button>`
          ).join('')}
        </div>
        <textarea class="feedback-text" maxlength="300" placeholder="Ваш отзыв (до 300 символов)"></textarea>
        <div class="feedback-actions">
          <button class="submit-btn">Отправить</button>
        </div>
      </div>
    `;
    
    return container;
  }
  
  /**
   * Initialize interactions after modal opens
   */
  async initInteractions() {
    const modalBody = this.modal.element;
    const listEl = modalBody.querySelector('#feedbackList');
    
    // Load reviews
    await this.loadReviews(listEl);
    
    // Rating buttons
    const ratingBtns = modalBody.querySelectorAll('.rating-btn');
    ratingBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectedRating = Number(btn.dataset.rating);
        
        // Update active state
        ratingBtns.forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        
        // Haptic feedback
        this.triggerHaptic('light');
      });
    });
    
    // Submit button
    const submitBtn = modalBody.querySelector('.submit-btn');
    const textArea = modalBody.querySelector('.feedback-text');
    
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      if (!this.selectedRating) {
        alert('Пожалуйста, выберите оценку');
        return;
      }
      
      const text = textArea.value || '';
      
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
        
        await this.submit(this.selectedRating, text);
        
        // Reload reviews
        await this.loadReviews(listEl);
        
        // Reset form
        textArea.value = '';
        this.selectedRating = 0;
        ratingBtns.forEach(b => b.classList.remove('active'));
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить';
        
        // Success haptic
        this.triggerHaptic('success');
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        alert(error.message || 'Не удалось отправить отзыв');
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить';
        
        this.triggerHaptic('error');
      }
    });
  }
  
  /**
   * Load reviews into list element
   */
  async loadReviews(listEl) {
    try {
      const response = await fetch(`/api/reader/feedback/audio/${encodeURIComponent(this.audioId)}/comments`);
      const json = await response.json();
      const comments = Array.isArray(json?.data?.items) ? json.data.items : (Array.isArray(json?.data) ? json.data : []);
      
      if (comments.length === 0) {
        listEl.innerHTML = '<div class="empty-reviews">Отзывов пока нет</div>';
        return;
      }
      
      listEl.innerHTML = comments.map(c => `
        <div class="review">
          <div class="review-head">⭐ ${c.rating}/5 • ${c.userName || 'Аноним'}</div>
          <div class="review-text">${this.escape((c.text || '').slice(0, 300))}</div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Failed to load reviews:', error);
      listEl.innerHTML = '<div class="empty-reviews">Не удалось загрузить отзывы</div>';
    }
  }
  
  /**
   * Fetch card metadata
   */
  async fetchCardMeta() {
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch(`/api/reader/feedback/audio/${encodeURIComponent(this.audioId)}/stats`),
        fetch('/api/audio/free', { credentials: 'include' })
      ]);
      
      const stats = await statsRes.json();
      const list = await listRes.json();
      
      // Parse list response
      const items = Array.isArray(list?.data) 
        ? list.data 
        : (list?.audios || list?.items || []);
      
      const item = (items || []).find(x => x.id === this.audioId) || {};
      
      return {
        coverUrl: item.coverUrl || '/mini-app/assets/audio-covers/default.svg',
        title: item.title || 'Аудиоразбор',
        author: item.author || '',
        description: item.description || '',
        avgRating: stats?.data?.avgRating || 0,
        total: stats?.data?.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch card meta:', error);
      return {
        coverUrl: '/mini-app/assets/audio-covers/default.svg',
        title: 'Аудиоразбор',
        author: '',
        description: '',
        avgRating: 0,
        total: 0
      };
    }
  }
  
  /**
   * Submit rating and text
   */
  async submit(rating, text) {
    if (!rating) {
      throw new Error('Выберите оценку');
    }
    
    const telegramId = this.getUserId();
    
    const payload = {
      telegramId,
      rating,
      text: text || '',
      context: 'bot',
      source: 'mini_app',
      tags: ['audio', this.audioId]
    };
    
    const response = await fetch('/api/reader/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `tma ${window.Telegram?.WebApp?.initData || ''}`,
        'X-User-Id': telegramId
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return response.json();
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
   * Escape HTML
   */
  escape(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
  }
  
  /**
   * Cleanup on close
   */
  cleanup() {
    this.selectedRating = 0;
  }
}

// Export to global scope
window.FeedbackModal = FeedbackModal;
