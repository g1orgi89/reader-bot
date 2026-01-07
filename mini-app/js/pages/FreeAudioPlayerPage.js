/**
 * Free Audio Player Page - Full-screen audio player
 * @file mini-app/js/pages/FreeAudioPlayerPage.js
 */

class FreeAudioPlayerPage {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.state = app.state;
    this.telegram = app.telegram;
    this.router = app.router;
    this.query = app.initialState?.query || {};

    // Get audio ID from route params
    // Try to get from initialState first (passed via navigate options.state)
    // Fallback to extracting from hash if not available
    this.audioId = app.initialState?.id || app.initialState?.audioId || this.extractAudioId();

    // Audio metadata
    this.audioMetadata = null;
    this.loading = false;

    // Player state (from AudioService)
    this.playerState = {
      isPlaying: false,
      currentPosition: 0,
      duration: 0
    };

    // Bound handler for audio service updates
    this.handleAudioUpdate = this.handleAudioUpdate.bind(this);

    console.log('🎵 FreeAudioPlayerPage: Initialized for', this.audioId);
  }

  /**
   * Extract audio ID from route
   */
  extractAudioId() {
    // Route is /free-audios/:id
    const path = window.location.hash.slice(1); // Remove #
    const match = path.match(/\/free-audios\/([^?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Prefetch data before rendering
   */
  async prefetch() {
    if (!this.audioId) {
      console.error('❌ FreeAudioPlayerPage: No audio ID');
      return;
    }

    await this.loadAudioMetadata();
  }

  /**
   * Initialize page
   */
  async init() {
    console.log('🎵 FreeAudioPlayerPage: Init');

    // Subscribe to audio service updates
    window.audioService.onUpdate(this.handleAudioUpdate);
  }

  /**
   * Load audio metadata
   */
  async loadAudioMetadata() {
    try {
      this.loading = true;
      console.log(`🎵 FreeAudioPlayerPage: Loading metadata for ${this.audioId}...`);

      const response = await this.api.getAudioMetadata(this.audioId);

      if (response.success && response.audio) {
        this.audioMetadata = response.audio;
        console.log('✅ FreeAudioPlayerPage: Metadata loaded');
      } else {
        console.warn('⚠️ FreeAudioPlayerPage: No metadata returned');
      }
    } catch (error) {
      console.error('❌ FreeAudioPlayerPage: Error loading metadata:', error);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Handle audio service updates
   * @param {Object} state - Audio service state
   */
  handleAudioUpdate(state) {
    this.playerState = {
      isPlaying: state.isPlaying,
      currentPosition: state.currentPosition,
      duration: state.duration
    };

    this.updatePlayerUI();
  }

  /**
   * Update player UI with current state
   */
  updatePlayerUI() {
    // Update play/pause button
    const playBtn = document.querySelector('.player-play-btn');
    if (playBtn) {
      playBtn.textContent = this.playerState.isPlaying ? '⏸' : '▶';
      playBtn.classList.toggle('playing', this.playerState.isPlaying);
    }

    // Update time display
    const currentTimeEl = document.querySelector('.player-current-time');
    const totalTimeEl = document.querySelector('.player-total-time');
    
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.playerState.currentPosition);
    }
    
    if (totalTimeEl) {
      totalTimeEl.textContent = this.formatTime(this.playerState.duration);
    }

    // Update progress bar
    const progressBar = document.querySelector('.player-progress-bar');
    if (progressBar && this.playerState.duration > 0) {
      const percent = (this.playerState.currentPosition / this.playerState.duration) * 100;
      progressBar.style.width = `${percent}%`;
    }

    // Update seek slider
    const seekSlider = document.querySelector('.player-seek-slider');
    if (seekSlider && this.playerState.duration > 0) {
      seekSlider.value = this.playerState.currentPosition;
      seekSlider.max = this.playerState.duration;
    }
  }

  /**
   * Format time in seconds to MM:SS
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Render page
   */
  render() {
    if (this.loading) {
      return this.renderLoading();
    }

    if (!this.audioMetadata) {
      return this.renderError();
    }

    return `
      <div class="content free-audio-player-page">
        ${this.renderPlayer()}
      </div>
    `;
  }

  /**
   * Render loading state
   */
  renderLoading() {
    return `
      <div class="content free-audio-player-page loading">
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Загружаем плеер...</p>
        </div>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    return `
      <div class="content free-audio-player-page error">
        <div class="error-container">
          <div class="error-icon">⚠️</div>
          <h3>Ошибка загрузки</h3>
          <p>Не удалось загрузить аудио</p>
          <button class="btn-back" onclick="history.back()">Назад</button>
        </div>
      </div>
    `;
  }

  /**
   * Render player
   */
  renderPlayer() {
    const escapeHtml = window.escapeHtml || ((text) => text);

    return `
      <div class="audio-player">
        <!-- Cover Art -->
        <div class="player-cover">
          <img src="${this.audioMetadata.coverUrl}" 
               alt="${escapeHtml(this.audioMetadata.title)}"
               onerror="this.src='/assets/audio/default-cover.jpg'">
        </div>

        <!-- Audio Info -->
        <div class="player-info">
          <h2 class="player-title">${escapeHtml(this.audioMetadata.title)}</h2>
          <p class="player-author">${escapeHtml(this.audioMetadata.author)}</p>
        </div>

        <!-- Progress Bar -->
        <div class="player-progress">
          <div class="player-progress-track">
            <div class="player-progress-bar" style="width: 0%"></div>
          </div>
          <input type="range" class="player-seek-slider" 
                 min="0" max="100" value="0" step="1">
        </div>

        <!-- Time Display -->
        <div class="player-time">
          <span class="player-current-time">0:00</span>
          <span class="player-total-time">0:00</span>
        </div>

        <!-- Controls -->
        <div class="player-controls">
          <button class="player-control-btn player-seek-back" data-seek="-15">
            <span class="player-seek-label">-15</span>
          </button>
          
          <button class="player-control-btn player-play-btn">
            ${this.playerState.isPlaying ? '⏸' : '▶'}
          </button>
          
          <button class="player-control-btn player-seek-forward" data-seek="15">
            <span class="player-seek-label">+15</span>
          </button>
        </div>

        <!-- Back Button -->
        <div class="player-footer">
          <button class="btn-back-to-list">← Вернуться к списку</button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Play/Pause button
    const playBtn = document.querySelector('.player-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        window.audioService.togglePlay();
        if (this.telegram?.hapticFeedback) {
          this.telegram.hapticFeedback('light');
        }
      });
    }

    // Seek buttons (-15 / +15)
    const seekBtns = document.querySelectorAll('.player-control-btn[data-seek]');
    seekBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const seekAmount = parseInt(btn.dataset.seek);
        window.audioService.seek(seekAmount);
        if (this.telegram?.hapticFeedback) {
          this.telegram.hapticFeedback('light');
        }
      });
    });

    // Seek slider
    const seekSlider = document.querySelector('.player-seek-slider');
    if (seekSlider) {
      let isSeeking = false;

      seekSlider.addEventListener('input', () => {
        isSeeking = true;
        // Update time display while dragging
        const currentTimeEl = document.querySelector('.player-current-time');
        if (currentTimeEl) {
          currentTimeEl.textContent = this.formatTime(seekSlider.value);
        }
      });

      seekSlider.addEventListener('change', () => {
        window.audioService.seekTo(parseFloat(seekSlider.value));
        isSeeking = false;
        if (this.telegram?.hapticFeedback) {
          this.telegram.hapticFeedback('medium');
        }
      });
    }

    // Back to list button
    const backBtn = document.querySelector('.btn-back-to-list');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.router.navigate('/free-audios');
      });
    }
  }

  /**
   * Page shown
   */
  onShow() {
    console.log('🎵 FreeAudioPlayerPage: onShow');

    // Get current audio service state
    const currentState = window.audioService.getState();
    
    // If playing different audio, start playing this one
    if (!currentState.currentAudio || currentState.currentAudio.id !== this.audioId) {
      this.startPlayback();
    } else {
      // Update UI with current state
      this.playerState = {
        isPlaying: currentState.isPlaying,
        currentPosition: currentState.currentPosition,
        duration: currentState.duration
      };
      this.updatePlayerUI();
    }
  }

  /**
   * Start playback for this audio
   */
  async startPlayback() {
    if (!this.audioMetadata) {
      console.error('❌ FreeAudioPlayerPage: No metadata for playback');
      return;
    }

    try {
      await window.audioService.play({
        id: this.audioMetadata.id,
        title: this.audioMetadata.title,
        artist: this.audioMetadata.author,
        cover: this.audioMetadata.coverUrl
      }, this.api);
    } catch (error) {
      console.error('❌ FreeAudioPlayerPage: Playback error:', error);
      
      if (this.telegram?.showAlert) {
        this.telegram.showAlert('Ошибка воспроизведения. Попробуйте снова.');
      }
    }
  }

  /**
   * Page hidden
   */
  onHide() {
    console.log('🎵 FreeAudioPlayerPage: onHide');
    // Note: We don't pause playback - audio continues in background
  }

  /**
   * Rerender page
   */
  rerender() {
    const container = document.getElementById('page-content');
    if (container) {
      container.innerHTML = this.render();
      this.attachEventListeners();
      this.updatePlayerUI();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log('🎵 FreeAudioPlayerPage: Destroyed');

    // Unsubscribe from audio service
    window.audioService.offUpdate(this.handleAudioUpdate);
  }
}

// Export to window
window.FreeAudioPlayerPage = FreeAudioPlayerPage;
