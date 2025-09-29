/**
 * @fileoverview Backfill script for quote weekNumber and yearNumber fields
 * @description Idempotent maintenance utility to ensure all quotes have proper
 * weekNumber and yearNumber fields based on business timezone (Moscow time).
 * Only updates quotes that are missing these fields.
 * 
 * Usage: node server/scripts/backfillQuoteWeekFields.js
 * 
 * @author Reader Bot Team
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { getISOWeekInfo, toBusinessTimezone } = require('../utils/isoWeek');

// Import models
const Quote = require('../models/quote');

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-bot';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error);
  }
}

/**
 * Backfill missing weekNumber and yearNumber fields
 */
async function backfillQuoteWeekFields() {
  console.log('🔄 Starting quote week fields backfill...');
  
  try {
    // Find quotes missing weekNumber or yearNumber
    const quotesNeedingUpdate = await Quote.find({
      $or: [
        { weekNumber: { $exists: false } },
        { weekNumber: null },
        { yearNumber: { $exists: false } },
        { yearNumber: null }
      ]
    }).select('_id createdAt weekNumber yearNumber').lean();
    
    if (quotesNeedingUpdate.length === 0) {
      console.log('✅ No quotes need week field updates');
      return { updated: 0, errors: 0 };
    }
    
    console.log(`📊 Found ${quotesNeedingUpdate.length} quotes needing week field updates`);
    
    let updated = 0;
    let errors = 0;
    
    // Process in batches to avoid memory issues
    const batchSize = 1000;
    
    for (let i = 0; i < quotesNeedingUpdate.length; i += batchSize) {
      const batch = quotesNeedingUpdate.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(quotesNeedingUpdate.length / batchSize)} (${batch.length} quotes)`);
      
      for (const quote of batch) {
        try {
          // Calculate week info based on business timezone
          const businessDate = toBusinessTimezone(new Date(quote.createdAt));
          const weekInfo = getISOWeekInfo(businessDate);
          
          // Update the quote with week fields
          await Quote.updateOne(
            { _id: quote._id },
            { 
              $set: { 
                weekNumber: weekInfo.isoWeek,
                yearNumber: weekInfo.isoYear
              }
            }
          );
          
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`✅ Updated ${updated} quotes so far...`);
          }
          
        } catch (quoteError) {
          console.error(`❌ Error updating quote ${quote._id}:`, quoteError.message);
          errors++;
        }
      }
    }
    
    console.log(`✅ Backfill completed: ${updated} quotes updated, ${errors} errors`);
    return { updated, errors };
    
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  }
}

/**
 * Validate the backfill results
 */
async function validateBackfill() {
  console.log('🔍 Validating backfill results...');
  
  try {
    const totalQuotes = await Quote.countDocuments();
    const quotesWithWeekFields = await Quote.countDocuments({
      weekNumber: { $exists: true, $ne: null },
      yearNumber: { $exists: true, $ne: null }
    });
    
    const quotesWithoutWeekFields = await Quote.countDocuments({
      $or: [
        { weekNumber: { $exists: false } },
        { weekNumber: null },
        { yearNumber: { $exists: false } },
        { yearNumber: null }
      ]
    });
    
    console.log(`📊 Validation results:`);
    console.log(`   Total quotes: ${totalQuotes}`);
    console.log(`   Quotes with week fields: ${quotesWithWeekFields}`);
    console.log(`   Quotes without week fields: ${quotesWithoutWeekFields}`);
    
    if (quotesWithoutWeekFields === 0) {
      console.log('✅ All quotes have proper week fields!');
    } else {
      console.log(`⚠️  ${quotesWithoutWeekFields} quotes still missing week fields`);
    }
    
    return {
      total: totalQuotes,
      withWeekFields: quotesWithWeekFields,
      withoutWeekFields: quotesWithoutWeekFields
    };
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Quote Week Fields Backfill Script');
  console.log('=====================================');
  
  try {
    await connectDB();
    
    // Run backfill
    const backfillResult = await backfillQuoteWeekFields();
    
    // Validate results
    const validationResult = await validateBackfill();
    
    console.log('\n📋 Final Summary:');
    console.log(`   Updated quotes: ${backfillResult.updated}`);
    console.log(`   Errors: ${backfillResult.errors}`);
    console.log(`   Total quotes: ${validationResult.total}`);
    console.log(`   Quotes with week fields: ${validationResult.withWeekFields}`);
    console.log(`   Success rate: ${((validationResult.withWeekFields / validationResult.total) * 100).toFixed(1)}%`);
    
    await disconnectDB();
    
    if (backfillResult.errors > 0) {
      console.log('⚠️  Script completed with some errors. Please review the logs above.');
      process.exit(1);
    } else {
      console.log('✅ Script completed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    await disconnectDB();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  backfillQuoteWeekFields,
  validateBackfill
};