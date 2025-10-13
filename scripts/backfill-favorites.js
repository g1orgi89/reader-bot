/**
 * @fileoverview Backfill script to migrate existing Quote.isFavorite=true data to Favorites collection
 * @author g1orgi89
 * 
 * This script is OPTIONAL and should be run manually if you want to preserve historical likes data.
 * It reads all Quote documents where isFavorite=true and creates corresponding Favorite documents.
 * 
 * Usage:
 *   node scripts/backfill-favorites.js [--dry-run]
 * 
 * Options:
 *   --dry-run  Show what would be done without making changes
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Quote = require('../server/models/quote');
const Favorite = require('../server/models/Favorite');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function backfillFavorites() {
  try {
    console.log('🔄 Starting Favorites backfill...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will create Favorites)'}`);
    console.log('');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required. Please set it before running this script.');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Find all quotes where isFavorite=true
    const favoriteQuotes = await Quote.find({ isFavorite: true })
      .select('userId text author createdAt')
      .lean();
    
    console.log(`📊 Found ${favoriteQuotes.length} quotes with isFavorite=true`);
    console.log('');

    if (favoriteQuotes.length === 0) {
      console.log('✅ No quotes to backfill. Exiting.');
      return;
    }

    // Group by unique (userId, normalizedKey) pairs to avoid duplicates
    const favoritesToCreate = new Map();
    
    // Verify Favorite model has required method
    if (typeof Favorite.computeNormalizedKey !== 'function') {
      throw new Error('Favorite.computeNormalizedKey method not found. The Favorite model may need to be updated.');
    }

    favoriteQuotes.forEach(quote => {
      const normalizedKey = Favorite.computeNormalizedKey(quote.text, quote.author || '');
      const key = `${quote.userId}|||${normalizedKey}`;
      
      // Only keep the earliest occurrence for each (userId, normalizedKey) pair
      if (!favoritesToCreate.has(key)) {
        favoritesToCreate.set(key, {
          userId: quote.userId,
          normalizedKey,
          text: quote.text.trim(),
          author: (quote.author || '').trim(),
          createdAt: quote.createdAt
        });
      } else {
        // Keep the earlier createdAt
        const existing = favoritesToCreate.get(key);
        if (quote.createdAt < existing.createdAt) {
          existing.createdAt = quote.createdAt;
        }
      }
    });

    console.log(`📈 Unique (userId, quote) pairs to migrate: ${favoritesToCreate.size}`);
    console.log('');

    if (isDryRun) {
      console.log('🔍 DRY RUN - Showing sample entries that would be created:');
      const samples = Array.from(favoritesToCreate.values()).slice(0, 5);
      samples.forEach((fav, idx) => {
        console.log(`  ${idx + 1}. User ${fav.userId}: "${fav.text.substring(0, 50)}..." by ${fav.author || '(no author)'}`);
      });
      console.log('');
      console.log('✅ Dry run complete. Run without --dry-run to perform the migration.');
      return;
    }

    // Create Favorites (with error handling for duplicates)
    console.log('💾 Creating Favorite documents...');
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const favorite of favoritesToCreate.values()) {
      try {
        await Favorite.create(favorite);
        created++;
        if (created % 100 === 0) {
          console.log(`  Progress: ${created} created, ${skipped} skipped, ${errors} errors`);
        }
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error - already exists
          skipped++;
        } else {
          console.error(`  ❌ Error creating favorite for user ${favorite.userId}:`, error.message);
          errors++;
        }
      }
    }

    console.log('');
    console.log('✅ Backfill complete!');
    console.log(`  Created: ${created}`);
    console.log(`  Skipped (already exist): ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log('');

    // Summary statistics
    const totalFavorites = await Favorite.countDocuments();
    const uniqueUsers = await Favorite.distinct('userId');
    const uniqueQuotes = await Favorite.distinct('normalizedKey');
    
    console.log('📊 Final Statistics:');
    console.log(`  Total Favorites: ${totalFavorites}`);
    console.log(`  Unique users: ${uniqueUsers.length}`);
    console.log(`  Unique quotes: ${uniqueQuotes.length}`);

  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('');
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the backfill
backfillFavorites()
  .then(() => {
    console.log('');
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
