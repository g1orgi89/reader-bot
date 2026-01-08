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

    // Track playlist state
    this.tracks = null; // Array of tracks if this is a container
    this.currentTrackId = null; // Current track being played
    this._initialPositionSec = null; // Initial position to seek to on first play

    // Player state (from AudioService)
    this.playerState = {
      isPlaying: false,
      currentPosition: 0,
      duration: 0
    };

    // Bound handler for audio service updates
    this.handleAudioUpdate = this.handleAudioUpdate.bind(this);
    this.handleAudioEnded = this.handleAudioEnded.bind(this);

    // Animation frame for smooth progress updates
    this._raf = null;

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
        
        // If this is a container with tracks, store them
        if (response.tracks && Array.isArray(response.tracks)) {
          this.tracks = response.tracks;
          
          // Get the last listened track to resume playback
          try {
            console.log(`🎵 FreeAudioPlayerPage: Container detected, fetching last track...`);
            const lastTrackResponse = await this.api.getLastTrack(this.audioId);
            
            if (lastTrackResponse.success && lastTrackResponse.trackId) {
              // Set current track to the last listened one
              this.currentTrackId = lastTrackResponse.trackId;
              // Save initial position to seek to on first play
              this._initialPositionSec = lastTrackResponse.positionSec || 0;
              console.log(`✅ FreeAudioPlayerPage: Resuming from track ${this.currentTrackId} at ${this._initialPositionSec}s`);
            } else {
              // Fallback to first track
              this.currentTrackId = this.tracks[0].id;
              this._initialPositionSec = 0;
              console.log(`📊 FreeAudioPlayerPage: No last track found, using first track`);
            }
          } catch (error) {
            console.warn('⚠️ FreeAudioPlayerPage: Error getting last track, using first:', error);
            this.currentTrackId = this.tracks[0].id;
            this._initialPositionSec = 0;
          }
          
          console.log(`✅ FreeAudioPlayerPage: Container loaded with ${this.tracks.length} tracks`);
        }
        
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

    // Start/stop smooth progress animation based on play state
    if (this.playerState.isPlaying) {
      this.startProgressAnimation();
    } else {
      this.stopProgressAnimation();
    }
  }

  /**
   * Update player UI with current state
   */
  updatePlayerUI() {
    // Update play/pause button
    const playBtn = document.querySelector('.player-play-btn');
    if (playBtn) {
      const isPlaying = !!this.playerState.isPlaying;
      // Force text presentation (no emoji): U+FE0E
      playBtn.textContent = isPlaying ? '⏸\uFE0E' : '▶\uFE0E';
      playBtn.classList.toggle('playing', isPlaying);
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
   * Start smooth progress animation using requestAnimationFrame
   */
  startProgressAnimation() {
    if (this._raf) return; // Already running

    const bar = document.querySelector('.player-progress-bar');
    const slider = document.querySelector('.player-seek-slider');
    const currentTimeEl = document.querySelector('.player-current-time');

    const tick = () => {
      const audio = window.audioService && window.audioService.audio;
      if (audio && !audio.paused && this.playerState.duration > 0) {
        const t = audio.currentTime;
        const pct = (t / this.playerState.duration) * 100;
        
        if (bar) bar.style.width = `${pct}%`;
        if (slider) slider.value = t;
        if (currentTimeEl) currentTimeEl.textContent = this.formatTime(t);
        
        this._raf = requestAnimationFrame(tick);
      } else {
        this._raf = null;
      }
    };

    this._raf = requestAnimationFrame(tick);
  }

  /**
   * Stop smooth progress animation
   */
  stopProgressAnimation() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
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
   * Handle audio ended event (auto-progression to next track)
   */
  handleAudioEnded() {
    console.log('🎵 FreeAudioPlayerPage: Audio ended');
    
    if (!this.tracks || this.tracks.length === 0) {
      console.log('🎵 FreeAudioPlayerPage: No tracks, stopping playback');
      return;
    }

    // Find current track index
    const currentIndex = this.tracks.findIndex(t => t.id === this.currentTrackId);
    
    if (currentIndex === -1) {
      console.warn('⚠️ FreeAudioPlayerPage: Current track not found in list');
      return;
    }

    // Check if there's a next track
    if (currentIndex < this.tracks.length - 1) {
      const nextTrack = this.tracks[currentIndex + 1];
      console.log(`🎵 FreeAudioPlayerPage: Auto-progressing to next track: ${nextTrack.title}`);
      
      this.currentTrackId = nextTrack.id;
      // Clear initial position when auto-progressing
      this._initialPositionSec = null;
      this.updateTrackListUI();
      this.startPlayback();
    } else {
      console.log('🎵 FreeAudioPlayerPage: Reached end of playlist');
    }
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

        ${this.renderTrackList()}

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
            ${this.playerState.isPlaying ? '⏸\uFE0E' : '▶\uFE0E'}
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
   * Render track list (if this is a container with tracks)
   */
  renderTrackList() {
    if (!this.tracks || this.tracks.length === 0) {
      return '';
    }

    const escapeHtml = window.escapeHtml || ((text) => text);

    return `
      <div class="track-list">
        ${this.tracks.map(track => `
          <button class="track-item ${track.id === this.currentTrackId ? 'active' : ''}" 
                  data-track-id="${track.id}">
            ${escapeHtml(track.title)}
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Update track list UI to reflect current track
   */
  updateTrackListUI() {
    if (!this.tracks || this.tracks.length === 0) return;

    const trackItems = document.querySelectorAll('.track-item');
    trackItems.forEach(item => {
      const trackId = item.getAttribute('data-track-id');
      if (trackId === this.currentTrackId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
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

    // Track selection buttons
    this.attachTrackEvents();
  }

  /**
   * Attach track selection event listeners
   */
  attachTrackEvents() {
    if (!this.tracks || this.tracks.length === 0) return;

    const trackItems = document.querySelectorAll('.track-item');
    trackItems.forEach(item => {
      item.addEventListener('click', () => {
        const trackId = item.getAttribute('data-track-id');
        
        if (trackId && trackId !== this.currentTrackId) {
          console.log(`🎵 FreeAudioPlayerPage: Switching to track ${trackId}`);
          this.currentTrackId = trackId;
          // Clear initial position when manually switching tracks
          this._initialPositionSec = null;
          this.updateTrackListUI();
          this.startPlayback();
          
          if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
          }
        }
      });
    });
  }

  /**
   * Page shown
   */
  onShow() {
    console.log('🎵 FreeAudioPlayerPage: onShow');

    // Subscribe to audio ended event for auto-progression
    if (window.audioService && typeof window.audioService.onEnded === 'function') {
      window.audioService.onEnded(this.handleAudioEnded);
    }

    // Get current audio service state
    const currentState = window.audioService.getState();
    
    // Determine expected audio ID (track or container)
    const expectedId = this.currentTrackId || this.audioId;
    
    // If playing different audio, start playing this one
    if (!currentState.currentAudio || currentState.currentAudio.id !== expectedId) {
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
      // Determine which audio ID to play (track ID or container ID)
      const audioIdToPlay = this.currentTrackId || this.audioId;
      
      console.log(`🎵 FreeAudioPlayerPage: Starting playback for ${audioIdToPlay}`);

      // Get stream URL for the current track/audio
      const streamUrlResponse = await this.api.getAudioStreamUrl(audioIdToPlay);
      
      if (!streamUrlResponse.success || !streamUrlResponse.url) {
        throw new Error('Failed to get stream URL');
      }

      // Play the audio using AudioService
      await window.audioService.play({
        id: audioIdToPlay,
        title: this.getTrackTitle(),
        artist: this.audioMetadata.author,
        coverUrl: this.audioMetadata.coverUrl,
        url: streamUrlResponse.url
      }, this.api);

      // Apply initial position if available (only on first play)
      if (this._initialPositionSec !== null && this._initialPositionSec > 0) {
        console.log(`🎵 FreeAudioPlayerPage: Seeking to initial position ${this._initialPositionSec}s`);
        const positionToSeek = this._initialPositionSec;
        this._initialPositionSec = null; // Clear immediately to prevent re-seeking
        
        // Wait for audio to be ready before seeking
        const audio = window.audioService.audio;
        const HAVE_CURRENT_DATA = 2; // HTMLMediaElement.HAVE_CURRENT_DATA
        
        if (audio.readyState >= HAVE_CURRENT_DATA) {
          window.audioService.seekTo(positionToSeek);
        } else {
          // If not ready yet, wait for loadedmetadata event
          let timeoutId = null;
          const onMetadataLoaded = () => {
            audio.removeEventListener('loadedmetadata', onMetadataLoaded);
            if (timeoutId) clearTimeout(timeoutId);
            window.audioService.seekTo(positionToSeek);
          };
          audio.addEventListener('loadedmetadata', onMetadataLoaded);
          
          // Safety timeout to prevent memory leak if metadata never loads
          timeoutId = setTimeout(() => {
            audio.removeEventListener('loadedmetadata', onMetadataLoaded);
            console.warn('⚠️ FreeAudioPlayerPage: Metadata load timeout, attempting seekTo anyway');
            if (audio.readyState > 0) {
              window.audioService.seekTo(positionToSeek);
            }
          }, 5000);
        }
      }
    } catch (error) {
      console.error('❌ FreeAudioPlayerPage: Playback error:', error);
      
      if (this.telegram?.showAlert) {
        this.telegram.showAlert('Ошибка воспроизведения. Попробуйте снова.');
      }
    }
  }

  /**
   * Get title for current track (or main audio title)
   */
  getTrackTitle() {
    if (this.tracks && this.currentTrackId) {
      const track = this.tracks.find(t => t.id === this.currentTrackId);
      if (track) {
        return `${this.audioMetadata.title} - ${track.title}`;
      }
    }
    return this.audioMetadata.title;
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

    // Stop progress animation to prevent memory leaks
    this.stopProgressAnimation();

    // Unsubscribe from audio service
    window.audioService.offUpdate(this.handleAudioUpdate);
    
    // Unsubscribe from ended event
    if (window.audioService && typeof window.audioService.offEnded === 'function') {
      window.audioService.offEnded(this.handleAudioEnded);
    }
  }
}

// Export to window
window.FreeAudioPlayerPage = FreeAudioPlayerPage;
