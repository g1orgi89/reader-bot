/**
 * Audio Service - manages audio metadata and access
 * @file server/services/audio/audioService.js
 */

const logger = require('../../utils/logger');

/**
 * Metadata for free audio content
 * In production, this would come from a database
 */
const FREE_AUDIO_METADATA = {
  'free-1': {
    id: 'free-1',
    title: 'Введение в психологию чтения',
    author: 'Анна Бусел',
    description: 'Вводный аудиоразбор о психологии чтения и работе с книгами',
    durationSec: 1800, // 30 minutes
    coverUrl: '/assets/audio/free-1-cover.jpg',
    audioFile: 'intro-psychology-reading.mp3',
    isFree: true
  }
  // More free audios can be added here
};

/**
 * List all free audio content
 * @returns {Promise<Array>} Array of free audio metadata
 */
async function listFreeAudios() {
  try {
    const freeAudios = Object.values(FREE_AUDIO_METADATA).map(audio => ({
      id: audio.id,
      title: audio.title,
      author: audio.author,
      description: audio.description,
      durationSec: audio.durationSec,
      coverUrl: audio.coverUrl,
      audioUrl: `/media/free/${audio.audioFile}`,
      isFree: true
    }));

    logger.info(`📚 Listed ${freeAudios.length} free audio(s)`);
    return freeAudios;
  } catch (error) {
    logger.error('❌ Error listing free audios:', error);
    throw error;
  }
}

/**
 * Find audio by ID
 * @param {string} audioId - Audio identifier
 * @returns {Promise<Object|null>} Audio metadata or null if not found
 */
async function findById(audioId) {
  try {
    // Check free audios
    if (FREE_AUDIO_METADATA[audioId]) {
      const audio = FREE_AUDIO_METADATA[audioId];
      return {
        id: audio.id,
        title: audio.title,
        author: audio.author,
        description: audio.description,
        durationSec: audio.durationSec,
        coverUrl: audio.coverUrl,
        audioUrl: `/media/free/${audio.audioFile}`,
        isFree: true
      };
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
 * @param {string} audioId - Audio identifier
 * @returns {Promise<boolean>} True if user has access
 */
async function isUnlocked(userId, audioId) {
  try {
    // Free content is always unlocked
    if (audioId.startsWith('free-')) {
      logger.info(`✅ Free audio ${audioId} is unlocked for all users`);
      return true;
    }

    // For premium content, check entitlements
    // Import here to avoid circular dependencies
    const { hasAudioAccess } = require('../access/entitlementService');
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
 * @param {string} audioId - Audio identifier
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

    // For free content, return direct URL
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

module.exports = {
  listFreeAudios,
  findById,
  isUnlocked,
  getStreamUrl
};
