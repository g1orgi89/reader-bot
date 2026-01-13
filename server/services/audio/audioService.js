/**
 * Audio Service - manages audio metadata and access
 * @file server/services/audio/audioService.js
 */

const logger = require('../../utils/logger');
// Import entitlement service at top level to avoid dynamic require
const { hasAudioAccess } = require('../access/entitlementService');

/**
 * Helper to construct media URL for free audio files
 * @param {string} relativePath - Relative path to audio file (e.g., 'malenkii_princ/01.mp3')
 * @returns {string} Full media URL
 */
function makeMediaUrl(relativePath) {
  return `/media/free/${relativePath}`;
}

/**
 * Metadata for free audio content
 * In production, this would come from a database
 * TODO: Move to database model for easier content management
 */
const FREE_AUDIO_METADATA = {
  'malenkii_princ': {
    id: 'malenkii_princ',
    title: 'Разбор: «Маленький принц»',
    author: 'Антуан де Сент-Экзюпери',
    description: 'Этот разбор прослушало более 35.000 человек!',
    coverUrl: '/assets/book-covers/malenkii_princ.png',
    playerCoverUrl: '/assets/audio-covers/malenkii_princ-player.png',
    isFree: true,
    tracks: [
      {
        id: 'malenkii_princ-01',
        title: 'Часть 1',
        file: 'malenkii_princ/01.mp3'
      },
      {
        id: 'malenkii_princ-02',
        title: 'Часть 2',
        file: 'malenkii_princ/02.mp3'
      },
      {
        id: 'malenkii_princ-03',
        title: 'Часть 3',
        file: 'malenkii_princ/03.mp3'
      },
      {
        id: 'malenkii_princ-04',
        title: 'Часть 4',
        file: 'malenkii_princ/04.mp3'
      },
      {
        id: 'malenkii_princ-05',
        title: 'Часть 5',
        file: 'malenkii_princ/05.mp3'
      },
      {
        id: 'malenkii_princ-06',
        title: 'Часть 6',
        file: 'malenkii_princ/06.mp3'
      }
    ]
  },
  eat_pray_love: {
    id: 'eat_pray_love',
    title: 'Разбор фильма: «Ешь, молись, люби»',
    author: 'Фильм',
    description: 'Как найти своё предназначение?',
    coverUrl: '/assets/book-covers/eat_pray_love.png',
    playerCoverUrl: '/assets/audio-covers/eat_pray_love-player.png',
    isFree: true,
    tracks: [
      { id: 'eat_pray_love-01', title: 'Полный аудиоразбор', file: 'eat_pray_love/01.mp3' }
    ]
  }
  
  // More free audios can be added here
};

/**
 * List all free audio content
 * @returns {Promise<Array>} Array of free audio metadata
 */
async function listFreeAudios() {
  try {
    const freeAudios = Object.values(FREE_AUDIO_METADATA).map(audio => {
      const result = {
        id: audio.id,
        title: audio.title,
        author: audio.author,
        description: audio.description,
        coverUrl: audio.coverUrl,
        isFree: true
      };
      
      // Only add audioUrl for single files (not containers)
      if (audio.audioFile) {
        result.audioUrl = `/media/free/${audio.audioFile}`;
        result.durationSec = audio.durationSec;
      }
      
      return result;
    });

    logger.info(`📚 Listed ${freeAudios.length} free audio(s)`);
    return freeAudios;
  } catch (error) {
    logger.error('❌ Error listing free audios:', error);
    throw error;
  }
}

/**
 * Find audio by ID (container or individual track)
 * @param {string} audioId - Audio identifier (container ID or track ID)
 * @returns {Promise<Object|null>} Audio metadata or null if not found
 */
async function findById(audioId) {
  try {
    // Check if it's a direct container
    if (FREE_AUDIO_METADATA[audioId]) {
      const audio = FREE_AUDIO_METADATA[audioId];
      
      // If it's a container with tracks, return container metadata
      if (audio.tracks) {
        return {
          id: audio.id,
          title: audio.title,
          author: audio.author,
          description: audio.description,
          coverUrl: audio.coverUrl,
          playerCoverUrl: audio.playerCoverUrl,
          isFree: true,
          tracks: audio.tracks
        };
      }
      
      // Otherwise, it's a single audio file
      return {
        id: audio.id,
        title: audio.title,
        author: audio.author,
        description: audio.description,
        durationSec: audio.durationSec,
        coverUrl: audio.coverUrl,
        playerCoverUrl: audio.playerCoverUrl,
        audioUrl: `/media/free/${audio.audioFile}`,
        isFree: true
      };
    }

    // Check if it's a track ID (format: containerId-trackNumber)
    for (const containerId in FREE_AUDIO_METADATA) {
      const container = FREE_AUDIO_METADATA[containerId];
      if (container.tracks) {
        const track = container.tracks.find(t => t.id === audioId);
        if (track) {
          return {
            id: track.id,
            title: track.title,
            author: container.author,
            coverUrl: container.coverUrl,
            audioUrl: makeMediaUrl(track.file),
            isFree: true,
            containerId: containerId
          };
        }
      }
    }

    // In the future, check database for premium content
    // For now, premium content is not implemented
    
    logger.warn(`⚠️ Audio not found: ${audioId}`);
    return null;
  } catch (error) {
    logger.error(`❌ Error finding audio ${audioId}:`, error);
    throw error;
  }
}

/**
 * Check if user has access to audio
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier (container ID or track ID)
 * @returns {Promise<boolean>} True if user has access
 */
async function isUnlocked(userId, audioId) {
  try {
    // Free content is always unlocked (including tracks from free containers)
    // Check if ID starts with 'free-' prefix
    if (audioId.startsWith('free-')) {
      logger.info(`✅ Free audio ${audioId} is unlocked for all users`);
      return true;
    }

    // Check if it's a direct container ID in FREE_AUDIO_METADATA
    if (FREE_AUDIO_METADATA[audioId]) {
      logger.info(`✅ Free audio ${audioId} is unlocked for all users`);
      return true;
    }

    // Check if it's a track ID from a free container (format: containerId-trackNumber)
    for (const containerId in FREE_AUDIO_METADATA) {
      const container = FREE_AUDIO_METADATA[containerId];
      if (container.tracks) {
        const track = container.tracks.find(t => t.id === audioId);
        if (track) {
          logger.info(`✅ Free audio ${audioId} is unlocked for all users`);
          return true;
        }
      }
    }

    // For premium content, check entitlements
    // Import already at top level to avoid circular dependencies
    const hasAccess = await hasAudioAccess(userId, audioId);
    
    logger.info(`${hasAccess ? '✅' : '❌'} Audio ${audioId} ${hasAccess ? 'unlocked' : 'locked'} for user ${userId}`);
    return hasAccess;
  } catch (error) {
    logger.error(`❌ Error checking unlock status for audio ${audioId}:`, error);
    // Fail closed - deny access on error
    return false;
  }
}

/**
 * Get streaming URL for audio
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier (container ID or track ID)
 * @returns {Promise<Object>} Object with url property
 */
async function getStreamUrl(userId, audioId) {
  try {
    const audio = await findById(audioId);
    
    if (!audio) {
      throw new Error('Audio not found');
    }

    const unlocked = await isUnlocked(userId, audioId);
    
    if (!unlocked) {
      throw new Error('Access denied');
    }

    // For containers with tracks, return URL of first track
    if (audio.tracks && audio.tracks.length > 0) {
      return { url: makeMediaUrl(audio.tracks[0].file) };
    }

    // For free content (single files or tracks), return direct URL
    if (audio.isFree) {
      return { url: audio.audioUrl };
    }

    // For premium content, return protected stream URL
    // This will be proxied through Node.js with X-Accel-Redirect
    return { url: `/media/stream/${audioId}` };
  } catch (error) {
    logger.error(`❌ Error getting stream URL for audio ${audioId}:`, error);
    throw error;
  }
}

/**
 * Get the last listened track for a container
 * @param {mongoose.Types.ObjectId} userId - User ID (optional)
 * @param {string} containerId - Container ID
 * @returns {Promise<Object|null>} Object with trackId and positionSec, or null
 */
async function getLastTrack(userId, containerId) {
  try {
    // Get container metadata to verify it exists and has tracks
    const container = FREE_AUDIO_METADATA[containerId];
    
    if (!container || !container.tracks || container.tracks.length === 0) {
      logger.warn(`⚠️ Container ${containerId} not found or has no tracks`);
      return null;
    }

    // If userId is not valid, return default (first track)
    if (!userId) {
      logger.info(`📊 No userId provided, returning first track for ${containerId}`);
      return {
        trackId: container.tracks[0].id,
        positionSec: 0
      };
    }

    // Import AudioProgress here to avoid circular dependencies
    const AudioProgress = require('../../models/AudioProgress');
    
    // Get all progress records for this container's tracks
    const trackIds = container.tracks.map(t => t.id);
    const progressRecords = await AudioProgress.find({
      userId: userId,
      audioId: { $in: trackIds }
    }).sort({ updatedAt: -1 }).limit(1);

    // If found a progress record, return that track
    if (progressRecords.length > 0) {
      const lastProgress = progressRecords[0];
      logger.info(`✅ Found last track for ${containerId}: ${lastProgress.audioId} at ${lastProgress.positionSec}s`);
      return {
        trackId: lastProgress.audioId,
        positionSec: lastProgress.positionSec
      };
    }

    // No progress found, return first track
    logger.info(`📊 No progress found for ${containerId}, returning first track`);
    return {
      trackId: container.tracks[0].id,
      positionSec: 0
    };
  } catch (error) {
    logger.error(`❌ Error getting last track for ${containerId}:`, error);
    // Return first track on error
    const container = FREE_AUDIO_METADATA[containerId];
    if (container && container.tracks && container.tracks.length > 0) {
      return {
        trackId: container.tracks[0].id,
        positionSec: 0
      };
    }
    return null;
  }
}

module.exports = {
  listFreeAudios,
  findById,
  isUnlocked,
  getStreamUrl,
  getLastTrack,
  makeMediaUrl
};
