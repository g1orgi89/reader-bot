/**
 * @fileoverview Photo Auto-Post Cron Service for Covers feature
 * @description Automatically posts Anna's "start of day" photo at 06:00 Europe/Moscow
 */

const cron = require('node-cron');
const logger = require('../../utils/logger');

/**
 * Get current day key in Europe/Moscow timezone
 * @returns {string} Day key in format YYYY-MM-DD
 */
function getCurrentDayKey() {
  const now = new Date();
  // Convert to Moscow timezone (UTC+3)
  const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const year = moscowTime.getFullYear();
  const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
  const day = String(moscowTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Execute the daily photo auto-post job
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Result of the operation
 */
async function executePhotoAutopost(models) {
  const { PhotoPost, PhotoSchedule, UserProfile } = models;
  const dayKey = getCurrentDayKey();
  
  logger.info(`📸 Photo Auto-Post: Starting for dayKey=${dayKey}`);
  
  try {
    // Check if there's already a pinned post for today
    const existingPin = await PhotoPost.getPinnedForDay(dayKey);
    if (existingPin) {
      logger.info(`📸 Photo Auto-Post: Pinned post already exists for ${dayKey}, skipping`);
      return { success: true, skipped: true, reason: 'Pin already exists' };
    }
    
    // Find scheduled post for today
    const schedule = await PhotoSchedule.getPendingForDay(dayKey);
    if (!schedule) {
      logger.info(`📸 Photo Auto-Post: No pending schedule for ${dayKey}, skipping`);
      return { success: true, skipped: true, reason: 'No schedule found' };
    }
    
    // Find Anna by telegramUsername
    const anna = await UserProfile.findOne({ telegramUsername: 'anna_busel' }).lean();
    if (!anna) {
      logger.error('📸 Photo Auto-Post: Anna user not found (telegramUsername=anna_busel)');
      return { success: false, error: 'Anna user not found' };
    }
    
    // Create the auto-post
    const postData = {
      userId: anna.userId,
      imageUrl: schedule.imageUrl,
      caption: schedule.caption,
      dayKey: dayKey,
      isPinned: true,
      status: 'published'
    };
    
    const post = await PhotoPost.createPost(postData);
    
    // Mark schedule as published
    await PhotoSchedule.markAsPublished(dayKey);
    
    logger.info(`📸 Photo Auto-Post: Successfully created post ${post._id} for ${dayKey}`);
    return { 
      success: true, 
      postId: post._id.toString(),
      dayKey,
      userId: anna.userId 
    };
    
  } catch (error) {
    logger.error('📸 Photo Auto-Post: Error executing job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the photo auto-post cron job
 * @param {Object} models - Database models { PhotoPost, PhotoSchedule, UserProfile }
 * @returns {Object} Cron job instance
 */
function initPhotoAutopostCron(models) {
  if (!models || !models.PhotoPost || !models.PhotoSchedule || !models.UserProfile) {
    logger.error('📸 Photo Auto-Post Cron: Required models not provided');
    return null;
  }
  
  logger.info('📸 Initializing Photo Auto-Post cron job (06:00 Europe/Moscow)...');
  
  // Schedule for 06:00 Moscow time every day
  const job = cron.schedule('0 6 * * *', async () => {
    const startTime = new Date();
    logger.info('📸 Photo Auto-Post cron job triggered');
    
    try {
      const result = await executePhotoAutopost(models);
      const endTime = new Date();
      const duration = endTime - startTime;
      
      if (result.success) {
        if (result.skipped) {
          logger.info(`📸 Photo Auto-Post completed in ${duration}ms: ${result.reason}`);
        } else {
          logger.info(`📸 Photo Auto-Post completed in ${duration}ms: Created post ${result.postId}`);
        }
      } else {
        logger.error(`📸 Photo Auto-Post failed in ${duration}ms: ${result.error}`);
      }
    } catch (error) {
      logger.error('📸 Photo Auto-Post cron error:', error);
    }
  }, {
    timezone: 'Europe/Moscow',
    scheduled: true
  });
  
  logger.info('📸 Photo Auto-Post cron job initialized successfully');
  return job;
}

module.exports = {
  initPhotoAutopostCron,
  executePhotoAutopost,
  getCurrentDayKey
};
