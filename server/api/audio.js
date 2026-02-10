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
const { resolveUserObjectId } = require('../services/access/resolveUserId');
const logger = require('../utils/logger');

/**
 * Helper to validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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
 * GET /api/audio/alice_wonderland
 * Get Alice audio metadata with unlock status and timer
 * Returns same format as GET /api/audio/:id for consistency
 * @returns {Object} Alice metadata with success, audio, and tracks
 */
router.get('/alice_wonderland', async (req, res) => {
  try {
    const userId = req.query.userId;
    
    logger.info(`📚 Fetching Alice audio metadata for user ${userId}...`);
    
    // Get full audio metadata from audioService
    const audio = await audioService.findById('alice_wonderland');
    
    if (!audio) {
      return res.status(404).json({
        success: false,
        error: 'Alice audio not found'
      });
    }
    
    // Check if audio is unlocked for this user
    let unlocked = false;
    let remainingDays = null;
    let expiresAt = null;
    
    if (userId) {
      // Resolve userId to ObjectId
      const userObjectId = await resolveUserObjectId(userId);
      
      if (userObjectId) {
        // Check entitlement
        const entitlementService = require('../services/access/entitlementService');
        unlocked = await entitlementService.hasAudioAccess(userObjectId, 'alice_wonderland');
        
        if (unlocked) {
          const UserEntitlement = require('../models/UserEntitlement');
          
          // Get entitlement to extract expiresAt
          const entitlement = await UserEntitlement.findOne({ 
            userId: userObjectId, 
            kind: 'audio', 
            resourceId: 'alice_wonderland' 
          });
          
          if (entitlement) {
            expiresAt = entitlement.expiresAt;
            remainingDays = await entitlementService.getRemainingDays(userObjectId, 'alice_wonderland');
            // If remainingDays is -1 (never expires), keep as -1 for proper handling
          }
        }
      }
    }
    
    // Prepare response object
    const audioResponse = {
      ...audio,
      unlocked
    };
    
    // Add remainingDays if available (for gated content)
    if (remainingDays !== null) {
      audioResponse.remainingDays = remainingDays;
    }
    
    // Add expiresAt if available (for expired detection)
    if (expiresAt !== null) {
      audioResponse.expiresAt = expiresAt;
    }
    
    // Return container with tracks
    res.json({
      success: true,
      audio: audioResponse,
      tracks: audio.tracks
    });
  } catch (error) {
    logger.error('❌ Error fetching Alice metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Alice metadata',
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
    let remainingDays = null;
    let expiresAt = null;
    
    if (userId) {
      // Resolve userId to ObjectId before calling audioService (prevents "me" CastError)
      const userObjectId = await resolveUserObjectId(userId);
      
      if (userObjectId) {
        unlocked = await audioService.isUnlocked(userObjectId, id);
        
        // For gated content (alice_wonderland), include remainingDays and expiresAt if unlocked
        if (audio.requiresEntitlement) {
          const entitlementService = require('../services/access/entitlementService');
          const UserEntitlement = require('../models/UserEntitlement');
          
          // Get entitlement to extract expiresAt
          const entitlement = await UserEntitlement.findOne({ 
            userId: userObjectId, 
            kind: 'audio', 
            resourceId: id 
          });
          
          if (entitlement) {
            expiresAt = entitlement.expiresAt;
            // Only include remainingDays if still valid
            if (unlocked) {
              remainingDays = await entitlementService.getRemainingDays(userObjectId, id);
            }
          }
        }
      }
    }

    // Prepare response object
    const audioResponse = {
      ...audio,
      unlocked
    };
    
    // Add remainingDays only if available (for gated content)
    if (remainingDays !== null) {
      audioResponse.remainingDays = remainingDays;
    }
    
    // Add expiresAt if available (for expired detection)
    if (expiresAt !== null) {
      audioResponse.expiresAt = expiresAt;
    }

    // Return container with tracks if applicable
    if (audio.tracks) {
      return res.json({
        success: true,
        audio: audioResponse,
        tracks: audio.tracks
      });
    }

    // Return single audio/track
    res.json({
      success: true,
      audio: audioResponse
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
    const rawUserId = req.query.userId; // DEVELOPMENT ONLY - NOT SECURE
    
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required'
      });
    }

    logger.info(`🎵 Getting stream URL for audio ${id}, user ${rawUserId}...`);
    
    // Resolve userId to ObjectId (prevents "me" CastError)
    const userId = await resolveUserObjectId(rawUserId);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
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

/**
 * GET /api/audio/:id/stream
 * Stream audio with entitlement check → X-Accel-Redirect
 */
router.get('/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    const rawUserId = req.query.userId;
    if (!rawUserId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const entitlementService = require('../services/access/entitlementService');

    // Единая резолюция userId: ObjectId как есть, иначе resolveUserObjectId
    let userObjectId = null;
    if (mongoose.Types.ObjectId.isValid(String(rawUserId)) && String(rawUserId).length === 24) {
      userObjectId = new mongoose.Types.ObjectId(String(rawUserId));
    } else {
      userObjectId = await resolveUserObjectId(rawUserId);
    }
    if (!userObjectId) {
      return res.status(401).json({ success: false, error: 'Invalid user ID' });
    }

    // Проверка доступа (учтены алиасы/бейджи)
    const hasAccess = await entitlementService.hasAudioAccess(userObjectId, id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Формируем путь к защищенному файлу
    const m = String(id).match(/^(.+)-(\d+)$/);
    const filePath = m ? `${m[1]}/${m[2]}.mp3` : `${id}.mp3`;

    // Отдаем через X-Accel-Redirect
    res.setHeader('X-Accel-Redirect', `/media-protected/${filePath}`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.end();
  } catch (error) {
    logger.error('❌ Error in /api/audio/:id/stream:', error);
    return res.status(500).json({ success: false, error: 'Failed to stream audio', details: error.message });
  }
});

/**
 * GET /api/audio/_debug/access
 * Диагностика доступа: возвращает всю информацию, которую использует стрим-роут
 * Пример: /api/audio/_debug/access?audioId=alice_wonderland-01&userId=6925e7e64ae91123a887501f
 */
router.get('/_debug/access', async (req, res) => {
  try {
    const { audioId, userId: rawUserId } = req.query;
    if (!audioId || !rawUserId) {
      return res.status(400).json({ success: false, error: 'audioId and userId are required' });
    }

    const UserEntitlement = require('../models/UserEntitlement');
    const entitlementService = require('../services/access/entitlementService');

    // Единая резолюция userId
    const resolvedUserId = (mongoose.Types.ObjectId.isValid(String(rawUserId)) && String(rawUserId).length === 24)
      ? new mongoose.Types.ObjectId(String(rawUserId))
      : await resolveUserObjectId(rawUserId);

    // Нормализация track → container
    const m = String(audioId).match(/^(.+)-(\d+)$/);
    const baseId = m ? m[1] : String(audioId);

    // Прямой findOne в Mongo
    const ent = resolvedUserId
      ? await UserEntitlement.findOne({ userId: resolvedUserId, kind: 'audio', resourceId: baseId }).lean()
      : null;

    const now = new Date();
    const isValidDirect = !!ent && (!ent.expiresAt || new Date(ent.expiresAt) > now);

    // Проверка через сервис (с алиасами)
    const hasAccessAlias = resolvedUserId
      ? await entitlementService.hasAudioAccess(resolvedUserId, audioId)
      : false;

    // Отладочные сведения
    res.json({
      success: true,
      debug: {
        audioId,
        rawUserId,
        resolvedUserId: resolvedUserId ? String(resolvedUserId) : null,
        baseId,
        entitlementFound: !!ent,
        entitlementId: ent?._id || null,
        entitlementExpiresAt: ent?.expiresAt || null,
        now: now.toISOString(),
        validByDirectFindOne: isValidDirect,
        validByAliasService: hasAccessAlias
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Debug failed', details: error.message });
  }
});

module.exports = router;
