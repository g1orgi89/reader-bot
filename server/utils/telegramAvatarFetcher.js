/**
 * Telegram Avatar Fetcher Utility
 * @file server/utils/telegramAvatarFetcher.js
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

/**
 * Ensure uploads directory exists
 */
async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch (error) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    logger.info(`📁 Created uploads directory: ${UPLOADS_DIR}`);
  }
}

/**
 * Fetch user profile photos from Telegram API
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Array>} Array of photo objects
 */
async function getUserProfilePhotos(userId) {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos`, {
      params: {
        user_id: userId,
        limit: 1 // We only need the latest photo
      },
      timeout: 10000
    });

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }

    return response.data.result.photos || [];
  } catch (error) {
    if (error.response?.status === 400) {
      // User not found or has no photos
      logger.info(`👤 No profile photos found for user ${userId}`);
      return [];
    }
    throw error;
  }
}

/**
 * Get file download URL from Telegram
 * @param {string} fileId - Telegram file ID
 * @returns {Promise<string>} File download URL
 */
async function getFileUrl(fileId) {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
    params: { file_id: fileId },
    timeout: 10000
  });

  if (!response.data.ok) {
    throw new Error(`Telegram API error: ${response.data.description}`);
  }

  const filePath = response.data.result.file_path;
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
}

/**
 * Download and save avatar from URL
 * @param {string} url - Image URL
 * @param {string} filename - Local filename to save
 * @returns {Promise<string>} Local file path
 */
async function downloadAvatar(url, filename) {
  await ensureUploadsDir();

  const localPath = path.join(UPLOADS_DIR, filename);
  
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000
  });

  await fs.writeFile(localPath, response.data);
  
  return localPath;
}

/**
 * Fetch and save Telegram user avatar
 * @param {string} userId - Telegram user ID
 * @returns {Promise<string|null>} Avatar URL or null if not available
 */
async function fetchTelegramAvatar(userId) {
  try {
    logger.info(`🖼️ Fetching avatar for user ${userId}`);

    const photos = await getUserProfilePhotos(userId);
    
    if (photos.length === 0) {
      logger.info(`👤 No profile photo available for user ${userId}`);
      return null;
    }

    // Get the highest resolution photo (last in the array)
    const photo = photos[0];
    const highestRes = photo[photo.length - 1];
    
    const fileUrl = await getFileUrl(highestRes.file_id);
    const extension = path.extname(fileUrl) || '.jpg';
    const filename = `${userId}_${Date.now()}${extension}`;
    
    await downloadAvatar(fileUrl, filename);
    
    // Return the URL path that will be accessible via static serving
    const avatarUrl = `/uploads/avatars/${filename}`;
    
    logger.info(`✅ Avatar downloaded for user ${userId}: ${avatarUrl}`);
    return avatarUrl;
    
  } catch (error) {
    logger.error(`❌ Failed to fetch avatar for user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Check if user already has an avatar
 * @param {Object} userProfile - User profile document
 * @returns {boolean} Whether user has avatar
 */
function hasAvatar(userProfile) {
  return userProfile && userProfile.avatarUrl && userProfile.avatarUrl.trim() !== '';
}

/**
 * Update user profile with new avatar URL
 * @param {string} userId - User ID
 * @param {string} avatarUrl - New avatar URL
 * @returns {Promise<void>}
 */
async function updateUserAvatar(userId, avatarUrl) {
  const UserProfile = require('../models/userProfile');
  
  await UserProfile.findOneAndUpdate(
    { userId },
    { 
      avatarUrl,
      updatedAt: new Date()
    },
    { new: true }
  );
  
  logger.info(`📝 Updated avatar for user ${userId}: ${avatarUrl}`);
}

module.exports = {
  fetchTelegramAvatar,
  hasAvatar,
  updateUserAvatar,
  ensureUploadsDir
};