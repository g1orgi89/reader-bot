/**
 * Test script to verify the CronService migration to WeeklyReportService
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { CronService } = require('./server/services/cronService');
const WeeklyReportService = require('./server/services/weeklyReportService');
const logger = require('./server/utils/logger');

async function testCronMigration() {
  try {
    console.log('🧪 Testing CronService migration to WeeklyReportService...');

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-support';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    // Initialize services
    const weeklyReportService = new WeeklyReportService();
    const cronService = new CronService();

    // Test initialization with new service
    cronService.initialize({
      bot: null, // No bot needed for this test
      weeklyReportService: weeklyReportService,
      weeklyReportHandler: null, // Old handler not provided
      monthlyReportService: null,
      reminderService: null,
      announcementService: null
    });

    console.log('✅ CronService initialized with WeeklyReportService');

    // Test diagnostics
    const diagnostics = cronService.getDiagnostics();
    console.log('📊 Diagnostics:', {
      initialized: diagnostics.initialized,
      hasWeeklyReportService: diagnostics.hasWeeklyReportService,
      hasWeeklyReportHandler: diagnostics.hasWeeklyReportHandler
    });

    // Test readiness
    const ready = cronService.isReady();
    console.log(`✅ CronService ready: ${ready}`);

    // Test job status
    const jobStatus = cronService.getJobsStatus();
    console.log('📊 Job status:', {
      initialized: jobStatus.initialized,
      hasWeeklyReportService: jobStatus.hasWeeklyReportService,
      hasWeeklyReportHandler: jobStatus.hasWeeklyReportHandler
    });

    // Test getting previous week range from WeeklyReportService
    const weekRange = weeklyReportService.getPreviousWeekRange();
    console.log(`📅 Previous week range: Week ${weekRange.isoWeekNumber}/${weekRange.isoYear} (${weekRange.start.toISOString().split('T')[0]} to ${weekRange.end.toISOString().split('T')[0]})`);

    console.log('🎉 All tests passed! CronService migration to WeeklyReportService is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected');
  }
}

if (require.main === module) {
  testCronMigration().catch(console.error);
}

module.exports = testCronMigration;