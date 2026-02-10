/**
 * Protected Stream API routes
 * Handles X-Accel-Redirect for premium audio content
 * @file server/api/stream.js
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { resolveUserObjectId } = require('../services/access/resolveUserId');
const { hasAudioAccess } = require('../services/access/entitlementService');

/**
 * Helper to map track ID to file path
 * @param {string} trackId - Track identifier (e.g., 'alice_wonderland-01')
 * @returns {string} File path relative to protected directory
 */
function getTrackFilePath(trackId) {
  // Extract container and track number from ID
  // Format: containerId-trackNumber (e.g., alice_wonderland-01)
  const match = trackId.match(/^(.+)-(\d+)$/);
  
  if (!match) {
    throw new Error(`Invalid track ID format: ${trackId}`);
  }
  
  const [, containerId, trackNumber] = match;
  
  // Map to file path: containerId/trackNumber.mp3
  return `${containerId}/${trackNumber}.mp3`;
}

/**
 * GET /media/stream/:id
 * Protected streaming endpoint with access control
 * Uses X-Accel-Redirect to serve files from protected directory via Nginx
 * @param {string} id - Track ID (e.g., 'alice_wonderland-01')
 * @returns {void} Sets X-Accel-Redirect header and returns 200
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rawUserId = req.query.userId; // DEVELOPMENT ONLY - NOT SECURE
    
    logger.info(`🔐 Protected stream request for ${id}, user ${rawUserId}...`);
    
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required'
      });
    }
    
    // Resolve userId to ObjectId
    const userId = await resolveUserObjectId(rawUserId);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    // Extract container ID from track ID (format: containerId-trackNumber)
    const match = id.match(/^(.+)-\d+$/);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: 'Invalid track ID format'
      });
    }
    
    const containerId = match[1];
    
    // Check if user has access to this container
    const hasAccess = await hasAudioAccess(userId, containerId);
    
    if (!hasAccess) {
      logger.warn(`❌ Access denied for user ${userId} to ${id}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Get file path for the track
    const filePath = getTrackFilePath(id);
    
    // Use X-Accel-Redirect to serve file from protected directory
    // Nginx will intercept this and serve the file
    const redirectPath = `/media-protected/${filePath}`;
    
    logger.info(`✅ Access granted for user ${userId} to ${id}, redirecting to ${redirectPath}`);
    
    // Set headers for X-Accel-Redirect
    res.setHeader('X-Accel-Redirect', redirectPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // End response with 200 status
    // Nginx will take over and serve the actual file
    res.status(200).end();
  } catch (error) {
    logger.error('❌ Error in protected stream:', error);
    
    if (error.message && error.message.includes('Invalid track ID')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid track ID',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to stream audio',
      details: error.message
    });
  }
});

module.exports = router;
