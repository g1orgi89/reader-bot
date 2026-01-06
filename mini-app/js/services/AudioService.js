/**
 * Global Audio Service - Singleton for managing audio playback
 * @file mini-app/js/services/AudioService.js
 * 
 * Features:
 * - Single HTMLAudioElement for the entire application
 * - Progress saving to localStorage every ~1s
 * - Server sync every ~15s and on visibility change
 * - Media Session API integration
 * - Play/pause/seek controls
 * - Event-driven updates
 */

class AudioService {
  /**
   * @typedef {Object} AudioMetadata
   * @property {string} id - Audio identifier
   * @property {string} title - Audio title
   * @property {string} artist - Audio artist/author
   * @property {string} cover - Cover image URL
   * @property {string} url - Audio stream URL
   */

  constructor() {
    if (AudioService.instance) {
      return AudioService.instance;
    }

    // Singleton instance
    AudioService.instance = this;

    // Audio player element
    this.audio = new Audio();
    this.audio.preload = 'metadata';

    // Current audio metadata
    this.currentAudio = null;

    // State
    this.isPlaying = false;
    this.currentPosition = 0;
    this.duration = 0;

    // Progress sync timers
    this.localSaveTimer = null;
    this.serverSyncTimer = null;
    this.lastServerSync = 0;

    // Event listeners
    this.updateListeners = new Set();

    // Initialize
    this.setupAudioListeners();
    this.setupMediaSession();
    this.setupVisibilityHandlers();

    console.log('✅ AudioService: Initialized');
  }

  /**
   * Setup audio element event listeners
   */
  setupAudioListeners() {
    // Playback events
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.startProgressTracking();
      this.notifyListeners();
      console.log('▶️ AudioService: Playing');
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.stopProgressTracking();
      this.saveProgressToServer();
      this.notifyListeners();
      console.log('⏸️ AudioService: Paused');
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.stopProgressTracking();
      this.saveProgressToServer();
      this.notifyListeners();
      console.log('⏹️ AudioService: Ended');
    });

    // Time update
    this.audio.addEventListener('timeupdate', () => {
      this.currentPosition = this.audio.currentTime;
      this.notifyListeners();
    });

    // Metadata loaded
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio.duration;
      this.notifyListeners();
      console.log(`📊 AudioService: Duration loaded: ${this.duration}s`);
    });

    // Error handling
    this.audio.addEventListener('error', (e) => {
      console.error('❌ AudioService: Playback error:', e);
      this.notifyListeners({ error: 'Ошибка воспроизведения' });
    });
  }

  /**
   * Setup Media Session API for system media controls
   */
  setupMediaSession() {
    if (!('mediaSession' in navigator)) {
      console.warn('⚠️ AudioService: Media Session API not supported');
      return;
    }

    // Media session action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      this.togglePlay();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.togglePlay();
    });

    navigator.mediaSession.setActionHandler('seekbackward', () => {
      this.seek(-15);
    });

    navigator.mediaSession.setActionHandler('seekforward', () => {
      this.seek(15);
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime) {
        this.seekTo(details.seekTime);
      }
    });

    console.log('✅ AudioService: Media Session API configured');
  }

  /**
   * Update Media Session metadata
   * @param {AudioMetadata} metadata - Audio metadata
   */
  updateMediaSession(metadata) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title || 'Аудио разбор',
      artist: metadata.artist || 'Reader Bot',
      artwork: [
        { src: metadata.cover || '/assets/audio/default-cover.jpg', sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    console.log('✅ AudioService: Media Session metadata updated');
  }

  /**
   * Setup visibility change handlers for progress sync
   */
  setupVisibilityHandlers() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // App hidden - sync progress immediately
        this.saveProgressToServer();
        console.log('👁️ AudioService: App hidden, progress synced');
      }
    });

    window.addEventListener('beforeunload', () => {
      // Page unload - sync progress
      this.saveProgressToServer();
      console.log('👋 AudioService: Page unload, progress synced');
    });
  }

  /**
   * Play audio with metadata
   * @param {AudioMetadata} metadata - Audio metadata
   * @param {Object} apiService - API service for fetching stream URL
   * @returns {Promise<void>}
   */
  async play(metadata, apiService) {
    try {
      console.log('🎵 AudioService: Starting playback:', metadata.id);

      // Store metadata
      this.currentAudio = metadata;

      // Get stream URL from API
      const response = await apiService.getAudioStreamUrl(metadata.id);
      
      if (!response.success || !response.url) {
        throw new Error('Failed to get stream URL');
      }

      const streamUrl = response.url;

      // Load progress from server and local storage
      const serverProgress = await this.loadProgressFromServer(metadata.id, apiService);
      const localProgress = this.loadProgressFromLocal(metadata.id);

      // Merge progress - use the most recent
      const progress = this.mergeProgress(serverProgress, localProgress);

      console.log('📊 AudioService: Progress loaded:', progress);

      // Set audio source
      this.audio.src = streamUrl;

      // Wait for metadata to load
      await new Promise((resolve) => {
        const onMetadata = () => {
          this.audio.removeEventListener('loadedmetadata', onMetadata);
          resolve();
        };
        this.audio.addEventListener('loadedmetadata', onMetadata);
        this.audio.load();
      });

      // Seek to saved position if available
      if (progress.positionSec > 0 && progress.positionSec < this.audio.duration) {
        this.audio.currentTime = progress.positionSec;
      }

      // Start playback
      await this.audio.play();

      // Update Media Session
      this.updateMediaSession(metadata);

      console.log('✅ AudioService: Playback started');
    } catch (error) {
      console.error('❌ AudioService: Play error:', error);
      throw error;
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
  }

  /**
   * Pause playback
   */
  pause() {
    this.audio.pause();
  }

  /**
   * Seek relative to current position
   * @param {number} seconds - Seconds to seek (positive or negative)
   */
  seek(seconds) {
    const newTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
    this.audio.currentTime = newTime;
    console.log(`⏩ AudioService: Seeked ${seconds}s to ${newTime}s`);
  }

  /**
   * Seek to absolute position
   * @param {number} position - Position in seconds
   */
  seekTo(position) {
    const newTime = Math.max(0, Math.min(this.audio.duration, position));
    this.audio.currentTime = newTime;
    console.log(`⏩ AudioService: Seeked to ${newTime}s`);
  }

  /**
   * Start progress tracking (local save every ~1s, server sync every ~15s)
   */
  startProgressTracking() {
    // Stop existing timers
    this.stopProgressTracking();

    // Local save timer (every 1 second)
    this.localSaveTimer = setInterval(() => {
      this.saveProgressToLocal();
    }, 1000);

    // Server sync timer (every 15 seconds)
    this.serverSyncTimer = setInterval(() => {
      this.saveProgressToServer();
    }, 15000);

    console.log('⏱️ AudioService: Progress tracking started');
  }

  /**
   * Stop progress tracking
   */
  stopProgressTracking() {
    if (this.localSaveTimer) {
      clearInterval(this.localSaveTimer);
      this.localSaveTimer = null;
    }

    if (this.serverSyncTimer) {
      clearInterval(this.serverSyncTimer);
      this.serverSyncTimer = null;
    }

    console.log('⏱️ AudioService: Progress tracking stopped');
  }

  /**
   * Save progress to localStorage
   */
  saveProgressToLocal() {
    if (!this.currentAudio) return;

    const progress = {
      audioId: this.currentAudio.id,
      positionSec: this.audio.currentTime,
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(`audio_progress_${this.currentAudio.id}`, JSON.stringify(progress));
    } catch (error) {
      console.error('❌ AudioService: Local save error:', error);
    }
  }

  /**
   * Load progress from localStorage
   * @param {string} audioId - Audio identifier
   * @returns {Object} Progress data
   */
  loadProgressFromLocal(audioId) {
    try {
      const data = localStorage.getItem(`audio_progress_${audioId}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('❌ AudioService: Local load error:', error);
    }

    return { audioId, positionSec: 0, updatedAt: null };
  }

  /**
   * Save progress to server
   * @returns {Promise<void>}
   */
  async saveProgressToServer() {
    if (!this.currentAudio) return;

    // Throttle server requests (don't sync more than once per 10 seconds)
    const now = Date.now();
    if (now - this.lastServerSync < 10000) {
      return;
    }

    try {
      const apiService = window.app?.api;
      if (!apiService || !apiService.updateAudioProgress) {
        console.warn('⚠️ AudioService: API service not available for server sync');
        return;
      }

      await apiService.updateAudioProgress(this.currentAudio.id, this.audio.currentTime);
      this.lastServerSync = now;
      
      console.log(`💾 AudioService: Progress synced to server: ${this.audio.currentTime}s`);
    } catch (error) {
      console.error('❌ AudioService: Server sync error:', error);
    }
  }

  /**
   * Load progress from server
   * @param {string} audioId - Audio identifier
   * @param {Object} apiService - API service
   * @returns {Promise<Object>} Progress data
   */
  async loadProgressFromServer(audioId, apiService) {
    try {
      if (!apiService || !apiService.getAudioProgress) {
        console.warn('⚠️ AudioService: API service not available for loading progress');
        return { audioId, positionSec: 0, updatedAt: null };
      }

      const response = await apiService.getAudioProgress(audioId);
      
      if (response.success && response.progress) {
        return response.progress;
      }
    } catch (error) {
      console.error('❌ AudioService: Server load error:', error);
    }

    return { audioId, positionSec: 0, updatedAt: null };
  }

  /**
   * Merge progress from server and local (use most recent)
   * @param {Object} serverProgress - Server progress
   * @param {Object} localProgress - Local progress
   * @returns {Object} Merged progress
   */
  mergeProgress(serverProgress, localProgress) {
    // If no server progress, use local
    if (!serverProgress.updatedAt) {
      return localProgress;
    }

    // If no local progress, use server
    if (!localProgress.updatedAt) {
      return serverProgress;
    }

    // Compare timestamps and use the most recent
    const serverTime = new Date(serverProgress.updatedAt).getTime();
    const localTime = new Date(localProgress.updatedAt).getTime();

    return serverTime > localTime ? serverProgress : localProgress;
  }

  /**
   * Add update listener
   * @param {Function} callback - Listener callback
   */
  onUpdate(callback) {
    this.updateListeners.add(callback);
  }

  /**
   * Remove update listener
   * @param {Function} callback - Listener callback
   */
  offUpdate(callback) {
    this.updateListeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   * @param {Object} extra - Extra data to pass to listeners
   */
  notifyListeners(extra = {}) {
    const state = {
      isPlaying: this.isPlaying,
      currentPosition: this.currentPosition,
      duration: this.duration,
      currentAudio: this.currentAudio,
      ...extra
    };

    this.updateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('❌ AudioService: Listener error:', error);
      }
    });
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentPosition: this.currentPosition,
      duration: this.duration,
      currentAudio: this.currentAudio
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stopProgressTracking();
    this.audio.pause();
    this.audio.src = '';
    this.updateListeners.clear();
    console.log('🧹 AudioService: Destroyed');
  }
}

// Create singleton instance
const audioService = new AudioService();

// Export to window
window.AudioService = AudioService;
window.audioService = audioService;
