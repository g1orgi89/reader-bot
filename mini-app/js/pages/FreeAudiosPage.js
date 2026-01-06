/**
 * Free Audios Page - List of free audio content
 * @file mini-app/js/pages/FreeAudiosPage.js
 */

class FreeAudiosPage {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.state = app.state;
    this.telegram = app.telegram;
    this.router = app.router;
    this.query = app.initialState?.query || {};

    // Audio data
    this.audios = [];
    this.loading = false;

    console.log('📻 FreeAudiosPage: Initialized');
  }

  /**
   * Prefetch data before rendering
   */
  async prefetch() {
    if (this.audios.length > 0) {
      console.log('📻 FreeAudiosPage: Using cached data');
      return;
    }

    await this.loadAudios();
  }

  /**
   * Initialize page
   */
  async init() {
    console.log('📻 FreeAudiosPage: Init');
  }

  /**
   * Load free audios from API
   */
  async loadAudios() {
    try {
      this.loading = true;
      console.log('📻 FreeAudiosPage: Loading audios...');

      const response = await this.api.getFreeAudios();

      if (response.success && response.audios) {
        this.audios = response.audios;
        console.log(`✅ FreeAudiosPage: Loaded ${this.audios.length} audio(s)`);
      } else {
        console.warn('⚠️ FreeAudiosPage: No audios returned');
        this.audios = [];
      }
    } catch (error) {
      console.error('❌ FreeAudiosPage: Error loading audios:', error);
      this.audios = [];
    } finally {
      this.loading = false;
    }
  }

  /**
   * Render page
   */
  render() {
    return `
      <div class="content free-audios-page">
        ${this.renderHeader()}
        ${this.loading ? this.renderLoading() : this.renderAudiosList()}
      </div>
    `;
  }

  /**
   * Render page header
   */
  renderHeader() {
    return `
      <div class="free-audios-header">
        <h1 class="page-title">🎧 Бесплатные разборы</h1>
        <p class="page-subtitle">Слушайте аудиоразборы книг бесплатно</p>
      </div>
    `;
  }

  /**
   * Render loading state
   */
  renderLoading() {
    return `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Загружаем аудио...</p>
      </div>
    `;
  }

  /**
   * Render audios list
   */
  renderAudiosList() {
    if (this.audios.length === 0) {
      return this.renderEmptyState();
    }

    return `
      <div class="audios-list">
        ${this.audios.map(audio => this.renderAudioCard(audio)).join('')}
      </div>
    `;
  }

  /**
   * Render single audio card
   */
  renderAudioCard(audio) {
    const escapeHtml = window.escapeHtml || ((text) => text);
    const duration = this.formatDuration(audio.durationSec);

    return `
      <div class="audio-card" data-audio-id="${audio.id}">
        <div class="audio-cover">
          <img src="${audio.coverUrl}" alt="${escapeHtml(audio.title)}" 
               onerror="this.src='/assets/audio/default-cover.jpg'">
          <div class="audio-play-overlay">
            <div class="audio-play-icon">▶</div>
          </div>
        </div>
        <div class="audio-info">
          <h3 class="audio-title">${escapeHtml(audio.title)}</h3>
          <p class="audio-author">${escapeHtml(audio.author)}</p>
          <p class="audio-description">${escapeHtml(audio.description)}</p>
          <div class="audio-meta">
            <span class="audio-duration">⏱️ ${duration}</span>
            <span class="audio-free-badge">🎁 Бесплатно</span>
          </div>
        </div>
        <button class="audio-listen-btn" data-audio-id="${audio.id}">
          🎧 Прослушать
        </button>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🎧</div>
        <h3>Нет доступных аудио</h3>
        <p>Скоро здесь появятся бесплатные аудиоразборы книг</p>
      </div>
    `;
  }

  /**
   * Format duration in seconds to human readable
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds) return '0 мин';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} ч ${minutes} мин`;
    }
    return `${minutes} мин`;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Listen buttons
    const listenButtons = document.querySelectorAll('.audio-listen-btn');
    listenButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const audioId = btn.dataset.audioId;
        this.handleListen(audioId);
      });
    });

    // Audio cards (also clickable)
    const audioCards = document.querySelectorAll('.audio-card');
    audioCards.forEach(card => {
      card.addEventListener('click', () => {
        const audioId = card.dataset.audioId;
        this.handleListen(audioId);
      });
    });
  }

  /**
   * Handle listen button click
   * @param {string} audioId - Audio ID
   */
  async handleListen(audioId) {
    try {
      console.log(`🎧 FreeAudiosPage: Starting playback for ${audioId}`);

      // Find audio metadata
      const audio = this.audios.find(a => a.id === audioId);
      if (!audio) {
        console.error('❌ FreeAudiosPage: Audio not found');
        return;
      }

      // Haptic feedback
      if (this.telegram?.hapticFeedback) {
        this.telegram.hapticFeedback('medium');
      }

      // Start playback through global audio service
      await window.audioService.play({
        id: audio.id,
        title: audio.title,
        artist: audio.author,
        cover: audio.coverUrl
      }, this.api);

      // Navigate to player page
      this.router.navigate(`/free-audios/${audioId}`);

    } catch (error) {
      console.error('❌ FreeAudiosPage: Playback error:', error);
      
      if (this.telegram?.showAlert) {
        this.telegram.showAlert('Ошибка воспроизведения. Попробуйте снова.');
      }
    }
  }

  /**
   * Page shown
   */
  onShow() {
    console.log('📻 FreeAudiosPage: onShow');

    // Reload if data is old
    if (this.audios.length === 0 && !this.loading) {
      this.loadAudios().then(() => this.rerender());
    }
  }

  /**
   * Page hidden
   */
  onHide() {
    console.log('📻 FreeAudiosPage: onHide');
  }

  /**
   * Rerender page
   */
  rerender() {
    const container = document.getElementById('page-content');
    if (container) {
      container.innerHTML = this.render();
      this.attachEventListeners();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log('📻 FreeAudiosPage: Destroyed');
  }
}

// Export to window
window.FreeAudiosPage = FreeAudiosPage;
