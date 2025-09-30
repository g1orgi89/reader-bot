/**
 * @fileoverview Migration script to normalize historical WeeklyReport.analysis.dominantThemes
 * @description Normalizes dominantThemes to canonical category keys and marks migrated documents
 * @author Reader Bot Team
 */

require('dotenv').config();
const mongoose = require('mongoose');
const WeeklyReport = require('../server/models/weeklyReport');
const { normalizeCategory } = require('../server/utils/normalizeCategory');

/**
 * Normalize dominantThemes array to canonical category keys
 * @param {string[]} themes - Raw themes array
 * @returns {string[]} Normalized themes (filtered, no duplicates, 'ДРУГОЕ' excluded if others exist)
 */
function normalizeThemesArray(themes) {
  if (!Array.isArray(themes) || themes.length === 0) {
    return [];
  }

  // Normalize each theme to canonical category key
  const normalizedThemes = themes
    .map(theme => normalizeCategory(theme))
    .filter(theme => theme && theme.trim()); // Remove empty

  // Remove duplicates
  const uniqueThemes = [...new Set(normalizedThemes)];

  // Filter out 'ДРУГОЕ' if there are other categories
  const filteredThemes = uniqueThemes.length > 1 
    ? uniqueThemes.filter(theme => theme !== 'ДРУГОЕ')
    : uniqueThemes;

  // Limit to 3
  return filteredThemes.slice(0, 3);
}

/**
 * Main migration function
 * @param {boolean} dryRun - If true, only show what would be changed without updating
 */
async function migrateWeeklyReports(dryRun = true) {
  console.log('🔄 Starting WeeklyReport dominantThemes migration...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY CHANGES'}`);
  console.log('');

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find all WeeklyReports that have not been migrated yet
    const reports = await WeeklyReport.find({
      'analysis._migratedCategories': { $ne: true },
      'analysis.dominantThemes': { $exists: true, $ne: null }
    }).lean();

    console.log(`📊 Found ${reports.length} WeeklyReports to process`);
    console.log('');

    if (reports.length === 0) {
      console.log('✨ No reports to migrate. All done!');
      return;
    }

    let changedCount = 0;
    let unchangedCount = 0;
    const changes = [];

    for (const report of reports) {
      const originalThemes = report.analysis?.dominantThemes || [];
      const normalizedThemes = normalizeThemesArray(originalThemes);

      // Check if themes actually changed
      const themesChanged = JSON.stringify(originalThemes.sort()) !== JSON.stringify(normalizedThemes.sort());

      if (themesChanged || originalThemes.length !== normalizedThemes.length) {
        changedCount++;
        changes.push({
          _id: report._id,
          userId: report.userId,
          weekNumber: report.weekNumber,
          year: report.year,
          original: originalThemes,
          normalized: normalizedThemes
        });

        if (dryRun) {
          console.log(`📝 Would update report ${report._id}:`);
          console.log(`   User: ${report.userId}, Week: ${report.weekNumber}/${report.year}`);
          console.log(`   Original: [${originalThemes.join(', ')}]`);
          console.log(`   Normalized: [${normalizedThemes.join(', ')}]`);
          console.log('');
        } else {
          // Apply the update
          await WeeklyReport.updateOne(
            { _id: report._id },
            {
              $set: {
                'analysis.dominantThemes': normalizedThemes,
                'analysis._migratedCategories': true
              }
            }
          );
          console.log(`✅ Updated report ${report._id} (${report.userId}, W${report.weekNumber}/${report.year})`);
        }
      } else {
        unchangedCount++;
        
        // Even if themes didn't change, mark as migrated
        if (!dryRun) {
          await WeeklyReport.updateOne(
            { _id: report._id },
            {
              $set: {
                'analysis._migratedCategories': true
              }
            }
          );
        }
      }
    }

    console.log('');
    console.log('📈 Migration Summary:');
    console.log(`   Total reports processed: ${reports.length}`);
    console.log(`   Reports with changes: ${changedCount}`);
    console.log(`   Reports unchanged: ${unchangedCount}`);
    console.log('');

    if (dryRun) {
      console.log('⚠️  This was a DRY RUN. No changes were made.');
      console.log('   To apply changes, run: node scripts/migrate_weekly_reports_categories.js --apply');
    } else {
      console.log('✅ Migration completed successfully!');
    }

    // Show sample of changes
    if (changes.length > 0 && dryRun) {
      console.log('');
      console.log('📋 Sample changes (first 5):');
      changes.slice(0, 5).forEach((change, idx) => {
        console.log(`${idx + 1}. ${change.original.join(', ')} → ${change.normalized.join(', ')}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('');
    console.log('👋 Database connection closed');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isApply = args.includes('--apply');

// Run migration
migrateWeeklyReports(!isApply)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
