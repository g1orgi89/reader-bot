/**
 * @fileoverview Cron scheduler for reminder slots (morning/day/evening/report)
 * @author g1orgi89
 */

const cron = require('node-cron');
const logger = require('../utils/logger');

console.log('DEBUG: reminderJobs.js загружен');

/**
 * Initialize reminder cron jobs
 * @param {Object} options - Configuration options
 * @param {Object} options.reminderService - ReminderService instance
 * @returns {Object} Cron job instances
 */
function initReminderCron({ reminderService }) {
  console.log('DEBUG: initReminderCron вызван');
  
  if (!reminderService) {
    logger.error('🔔 Cannot initialize reminder cron: reminderService is required');
    return null;
  }

  logger.info('🔔 Initializing reminder cron jobs for Moscow timezone...');

  const jobs = {};

  // Morning reminders: 09:05 Moscow time
  jobs.morning = cron.schedule('5 9 * * *', async () => {
    const startTime = new Date();
    logger.info('🌅 Starting morning reminders...');
    try {
      console.log('[DEBUG] CRON: Вызван morning slot, сейчас будет отправка');
      const stats = await reminderService.sendSlotReminders('morning');
      const endTime = new Date();
      const duration = endTime - startTime;
      logger.info(`🌅 Morning reminders completed in ${duration}ms: sent=${stats.sent}, skipped=${stats.skipped}, failed=${stats.failed}`);
      if (stats.failed > 0) {
        logger.warn(`🌅 Morning reminders had ${stats.failed} failures:`, stats.errors);
      }
    } catch (error) {
      logger.error('🌅 Error in morning reminders cron:', error);
    }
  }, {
    timezone: 'Europe/Moscow',
    scheduled: true
  });

  // Day reminders: 15:05 Moscow time
  jobs.day = cron.schedule('5 15 * * *', async () => {
    const startTime = new Date();
    logger.info('🌤️ Starting day reminders...');
    
    try {
      const stats = await reminderService.sendSlotReminders('day');
      const endTime = new Date();
      const duration = endTime - startTime;
      
      logger.info(`🌤️ Day reminders completed in ${duration}ms: sent=${stats.sent}, skipped=${stats.skipped}, failed=${stats.failed}`);
      
      if (stats.failed > 0) {
        logger.warn(`🌤️ Day reminders had ${stats.failed} failures:`, stats.errors);
      }
    } catch (error) {
      logger.error('🌤️ Error in day reminders cron:', error);
    }
  }, {
    timezone: 'Europe/Moscow',
    scheduled: true
  });

  // Evening reminders: 21:05 Moscow time
  jobs.evening = cron.schedule('5 21 * * *', async () => {
    const startTime = new Date();
    logger.info('🌙 Starting evening reminders...');
    
    try {
      const stats = await reminderService.sendSlotReminders('evening');
      const endTime = new Date();
      const duration = endTime - startTime;
      
      logger.info(`🌙 Evening reminders completed in ${duration}ms: sent=${stats.sent}, skipped=${stats.skipped}, failed=${stats.failed}`);
      
      if (stats.failed > 0) {
        logger.warn(`🌙 Evening reminders had ${stats.failed} failures:`, stats.errors);
      }
    } catch (error) {
      logger.error('🌙 Error in evening reminders cron:', error);
    }
  }, {
    timezone: 'Europe/Moscow',
    scheduled: true
  });

  // Weekly report notifications: 11:05 Moscow time, Mondays only
  jobs.report = cron.schedule('5 11 * * 1', async () => {
    const startTime = new Date();
    logger.info('📊 Starting weekly report notifications...');
    
    try {
      const stats = await reminderService.sendSlotReminders('report');
      const endTime = new Date();
      const duration = endTime - startTime;
      
      logger.info(`📊 Report notifications completed in ${duration}ms: sent=${stats.sent}, skipped=${stats.skipped}, failed=${stats.failed}`);
      
      if (stats.failed > 0) {
        logger.warn(`📊 Report notifications had ${stats.failed} failures:`, stats.errors);
      }
    } catch (error) {
      logger.error('📊 Error in report notifications cron:', error);
    }
  }, {
    timezone: 'Europe/Moscow',
    scheduled: true
  });

  logger.info('✅ Reminder cron jobs registered:');
  logger.info('  🌅 Morning: 09:05 MSK');
  logger.info('  🌤️ Day: 15:05 MSK');
  logger.info('  🌙 Evening: 21:05 MSK');
  logger.info('  📊 Report: 11:05 MSK (Mondays)');

  return jobs;
}

/**
 * Stop all reminder cron jobs
 * @param {Object} jobs - Cron job instances
 */
function stopReminderCron(jobs) {
  if (!jobs) return;
  
  logger.info('🔔 Stopping reminder cron jobs...');
  
  if (jobs.morning) jobs.morning.stop();
  if (jobs.day) jobs.day.stop();
  if (jobs.evening) jobs.evening.stop();
  if (jobs.report) jobs.report.stop();
  
  logger.info('✅ Reminder cron jobs stopped');
}

module.exports = {
  initReminderCron,
  stopReminderCron
};
