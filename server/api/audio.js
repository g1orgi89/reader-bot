/**
 * Audio API routes
 * @file server/api/audio.js
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Services
const audioService = require('../services/audio/audioService');
const AudioProgress = require('../models/AudioProgress');
const UserProfile = require('../models/userProfile');
const logger = require('../utils/logger');

/**
 * Helper to validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Resolve Telegram userId to MongoDB ObjectId
 * Handles both ObjectId and numeric Telegram IDs
 * @param {string|number} rawUserId - Raw user ID (can be ObjectId string or Telegram numeric ID)
 * @returns {Promise<mongoose.Types.ObjectId|null>} MongoDB ObjectId or null if not found/invalid
 */
async function resolveUserObjectId(rawUserId) {
  if (!rawUserId) {
    return null;
  }

  const userIdStr = String(rawUserId);

  // If already a valid ObjectId, return it
  if (isValidObjectId(userIdStr)) {
    return new mongoose.Types.ObjectId(userIdStr);
  }

  // Otherwise, try to find user by Telegram userId in UserProfile
  try {
    const userProfile = await UserProfile.findOne({ userId: userIdStr });
    if (userProfile) {
      logger.info(`✅ Resolved Telegram ID ${userIdStr} to ObjectId ${userProfile._id}`);
      return userProfile._id;
    }
    
    logger.warn(`⚠️ User not found for Telegram ID ${userIdStr}`);
    return null;
  } catch (error) {
    logger.error(`❌ Error resolving user ID ${userIdStr}:`, error);
    return null;
  }
}

/**
 * GET /api/audio/free
 * List all free audio content
 * @returns {Array} Array of free audio metadata
 */
router.get('/free', async (req, res) => {
  try {
    logger.info('📚 Fetching free audio list...');
    
    const freeAudios = await audioService.listFreeAudios();
    
    res.json({
      success: true,
      audios: freeAudios
    });
  } catch (error) {
    logger.error('❌ Error fetching free audios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch free audio list',
      details: error.message
    });
  }
});

/**
 * GET /api/audio/:id
 * Get audio metadata with unlock status
 * Supports both containers (with tracks) and individual audios/tracks
 * @param {string} id - Audio ID (container ID or track ID)
 * @returns {Object} Audio metadata with unlocked flag (and tracks if container)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: SECURITY - Replace with JWT authentication
    // Current implementation uses query param for development only
    // In production, extract userId from verified JWT token: req.user.id
    const userId = req.query.userId; // DEVELOPMENT ONLY - NOT SECURE
    
    logger.info(`📚 Fetching audio metadata for ${id}...`);
    
    const audio = await audioService.findById(id);
    
    if (!audio) {
      return res.status(404).json({
        success: false,
        error: 'Audio not found'
      });
    }

    // Check if audio is unlocked for this user
    let unlocked = false;
    if (userId) {
      unlocked = await audioService.isUnlocked(userId, id);
    }

    // Return container with tracks if applicable
    if (audio.tracks) {
      return res.json({
        success: true,
        audio: {
          ...audio,
          unlocked
        },
        tracks: audio.tracks
      });
    }

    // Return single audio/track
    res.json({
      success: true,
      audio: {
        ...audio,
        unlocked
      }
    });
  } catch (error) {
    logger.error(`❌ Error fetching audio metadata:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audio metadata',
      details: error.message
    });
  }
});

/**
 * GET /api/audio/:id/stream-url
 * Get streaming URL for audio
 * @param {string} id - Audio ID
 * @returns {Object} Object with url property
 */
router.get('/:id/stream-url', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: SECURITY - Replace with JWT authentication
    // Current implementation uses query param for development only
    const userId = req.query.userId; // DEVELOPMENT ONLY - NOT SECURE
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required'
      });
    }

    logger.info(`🎵 Getting stream URL for audio ${id}, user ${userId}...`);
    
    const streamUrl = await audioService.getStreamUrl(userId, id);
    
    res.json({
      success: true,
      ...streamUrl
    });
  } catch (error) {
    logger.error(`❌ Error getting stream URL:`, error);
    
    if (error.message === 'Audio not found') {
      return res.status(404).json({
        success: false,
        error: 'Audio not found'
      });
    }
    
    if (error.message === 'Access denied') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to get stream URL',
      details: error.message
    });
  }
});

/**
 * POST /api/audio/:id/progress
 * Update listening progress
 * @param {string} id - Audio ID
 * @body {number} positionSec - Current position in seconds
 * @returns {Object} Updated progress
 */
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { positionSec } = req.body;
    // TODO: SECURITY - Replace with JWT authentication
    const rawUserId = req.query.userId; // DEVELOPMENT ONLY - NOT SECURE
    
    // Resolve userId (handles both ObjectId and Telegram numeric ID)
    const userId = await resolveUserObjectId(rawUserId);
    
    // Dev-safe: return safe default for invalid userId (prevents 500 errors)
    if (!userId) {
      return res.json({
        success: true,
        audioId: id,
        positionSec: Number(positionSec) || 0
      });
    }

    if (typeof positionSec !== 'number' || positionSec < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid positionSec'
      });
    }

    logger.info(`💾 Updating progress for audio ${id}, user ${userId}: ${positionSec}s`);
    
    const progress = await AudioProgress.updateProgress(userId, id, positionSec);
    
    res.json({
      success: true,
      progress: {
        audioId: progress.audioId,
        positionSec: progress.positionSec,
        updatedAt: progress.updatedAt
      }
    });
  } catch (error) {
    logger.warn('⚠️ POST progress failed, returning success fallback:', error);
    return res.json({
      success: true,
      audioId: req.params.id,
      positionSec: Number(req.body?.positionSec) || 0
    });
  }
});

/**
 * GET /api/audio/:id/progress
 * Get listening progress
 * @param {string} id - Audio ID
 * @returns {Object} Progress data
 */
router.get('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: SECURITY - Replace with JWT authentication
    const rawUserId = req.query.userId; // DEVELOPMENT ONLY - NOT SECURE
    
    // Resolve userId (handles both ObjectId and Telegram numeric ID)
    const userId = await resolveUserObjectId(rawUserId);
    
    // Dev-safe: return safe default for invalid userId (prevents 500 errors)
    if (!userId) {
      return res.json({
        success: true,
        audioId: id,
        positionSec: 0,
        updatedAt: null
      });
    }

    logger.info(`📊 Fetching progress for audio ${id}, user ${userId}...`);
    
    const progress = await AudioProgress.getProgress(userId, id);
    
    if (!progress) {
      return res.json({
        success: true,
        progress: {
          audioId: id,
          positionSec: 0,
          updatedAt: null
        }
      });
    }

    res.json({
      success: true,
      progress: {
        audioId: progress.audioId,
        positionSec: progress.positionSec,
        updatedAt: progress.updatedAt
      }
    });
  } catch (error) {
    logger.warn('⚠️ GET progress failed, returning safe default:', error);
    return res.json({
      success: true,
      audioId: req.params.id,
      positionSec: 0,
      updatedAt: null
    });
  }
});

/**
 * GET /api/audio/:containerId/last-track
 * Get the last listened track in a container (for resuming playback)
 * @param {string} containerId - Container ID
 * @returns {Object} Object with trackId and positionSec
 */
router.get('/:containerId/last-track', async (req, res) => {
  try {
    const { containerId } = req.params;
    // TODO: SECURITY - Replace with JWT authentication
    const rawUserId = req.query.userId; // DEVELOPMENT ONLY - NOT SECURE
    
    logger.info(`📊 Fetching last track for container ${containerId}, user ${rawUserId || 'anonymous'}...`);
    
    // Resolve userId (handles both ObjectId and Telegram numeric ID)
    const userId = await resolveUserObjectId(rawUserId);
    
    // Dev-safe: pass resolved userId to service
    const lastTrack = await audioService.getLastTrack(userId, containerId);
    
    if (!lastTrack) {
      return res.status(404).json({
        success: false,
        error: 'Container not found or has no tracks'
      });
    }

    res.json({
      success: true,
      trackId: lastTrack.trackId,
      positionSec: lastTrack.positionSec
    });
  } catch (error) {
    logger.error('❌ GET last-track failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get last track',
      details: error.message
    });
  }
});

module.exports = router;
