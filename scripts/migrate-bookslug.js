/**
 * @fileoverview Migration Script: Backfill bookSlug for existing WeeklyReport recommendations
 * @description Добавляет bookSlug в существующие рекомендации, сопоставляя с BookCatalog по title+author
 * @author Reader Bot Team
 * 
 * Usage:
 *   node scripts/migrate-bookslug.js [--dry-run] [--limit=N]
 * 
 * Options:
 *   --dry-run: Показать изменения без применения
 *   --limit=N: Обработать только N отчетов (для тестирования)
 */

const mongoose = require('mongoose');

// Load environment
require('dotenv').config();

/**
 * Генерирует slug из названия книги (transliteration + normalization)
 * @param {string} title - Название книги
 * @returns {string} Сгенерированный slug
 */
function generateSlugFromTitle(title) {
  if (!title) return 'unknown-book';
  
  // Transliteration map for Cyrillic to Latin
  const cyrillicMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  return title
    .toString()
    .toLowerCase()
    .replace(/[а-я]/g, (char) => cyrillicMap[char] || char)
    .replace(/[^a-z0-9\s-]/g, '') // только латиница, цифры, пробелы и дефисы
    .replace(/\s+/g, '-')         // пробелы на дефисы
    .replace(/\-+/g, '-')         // несколько дефисов — один дефис
    .replace(/^-+|-+$/g, '')      // дефисы в начале/конце
    .substring(0, 50);            // ограничиваем длину
}

/**
 * Deterministic mapping для известных книг (из fallback логики)
 */
const KNOWN_BOOK_SLUGS = {
  'Разбор "Искусство любить" Эриха Фромма': 'art_of_loving',
  '"Письма к молодому поэту" Рильке': 'letters_to_young_poet',
  'Курс "Быть собой"': 'be_yourself_course',
  'Курс "Мудрая мама"': 'wise_mother_course',
  '"Маленький принц" с комментариями': 'little_prince'
};

async function migrate() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const limitMatch = args.find(arg => arg.startsWith('--limit='));
  const limit = limitMatch ? parseInt(limitMatch.split('=')[1]) : null;
  
  console.log('📋 Starting bookSlug migration for WeeklyReport recommendations...');
  console.log(`📊 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  if (limit) console.log(`📊 Limit: ${limit} reports`);
  
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-bot';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Load models
    const WeeklyReport = require('../server/models/weeklyReport');
    const BookCatalog = require('../server/models/BookCatalog');
    
    // Get all catalog books for matching
    const catalogBooks = await BookCatalog.find({ isActive: true }).lean();
    console.log(`📚 Loaded ${catalogBooks.length} books from catalog`);
    
    // Build lookup maps for fast matching
    const titleAuthorMap = new Map();
    const titleOnlyMap = new Map();
    
    catalogBooks.forEach(book => {
      // Map by title + author
      if (book.author) {
        const key = `${book.title.toLowerCase().trim()}::${book.author.toLowerCase().trim()}`;
        titleAuthorMap.set(key, book);
      }
      
      // Map by title only (fallback)
      const titleKey = book.title.toLowerCase().trim();
      if (!titleOnlyMap.has(titleKey)) {
        titleOnlyMap.set(titleKey, book);
      }
    });
    
    console.log(`🔍 Built lookup maps: ${titleAuthorMap.size} title+author pairs, ${titleOnlyMap.size} unique titles`);
    
    // Find reports with recommendations missing bookSlug
    const query = {
      'recommendations': {
        $elemMatch: {
          $or: [
            { bookSlug: { $exists: false } },
            { bookSlug: null },
            { bookSlug: '' }
          ]
        }
      }
    };
    
    const reports = await WeeklyReport.find(query).limit(limit || 0);
    console.log(`📊 Found ${reports.length} reports with recommendations missing bookSlug`);
    
    const stats = {
      reportsUpdated: 0,
      recommendationsProcessed: 0,
      catalogMatched: 0,
      knownBookMatched: 0,
      generatedSlugs: 0,
      skipped: 0
    };
    
    for (const report of reports) {
      let reportUpdated = false;
      
      for (const recommendation of report.recommendations) {
        // Skip if already has bookSlug
        if (recommendation.bookSlug && recommendation.bookSlug.trim() !== '') {
          stats.skipped++;
          continue;
        }
        
        stats.recommendationsProcessed++;
        
        const title = recommendation.title?.trim();
        const author = recommendation.author?.trim();
        
        if (!title) {
          console.warn(`⚠️ Recommendation without title in report ${report._id}`);
          recommendation.bookSlug = 'unknown-book';
          stats.generatedSlugs++;
          reportUpdated = true;
          continue;
        }
        
        let matchedBook = null;
        let matchType = '';
        
        // 1. Try exact match with catalog by title + author
        if (author) {
          const key = `${title.toLowerCase()}::${author.toLowerCase()}`;
          matchedBook = titleAuthorMap.get(key);
          if (matchedBook) {
            matchType = 'catalog-title-author';
            stats.catalogMatched++;
          }
        }
        
        // 2. Try match with catalog by title only
        if (!matchedBook) {
          matchedBook = titleOnlyMap.get(title.toLowerCase());
          if (matchedBook) {
            matchType = 'catalog-title-only';
            stats.catalogMatched++;
          }
        }
        
        // 3. Try known book mapping
        if (!matchedBook) {
          const knownSlug = KNOWN_BOOK_SLUGS[title];
          if (knownSlug) {
            recommendation.bookSlug = knownSlug;
            matchType = 'known-book';
            stats.knownBookMatched++;
            reportUpdated = true;
            continue;
          }
        }
        
        // 4. If found in catalog, use its data
        if (matchedBook) {
          recommendation.bookSlug = matchedBook.bookSlug;
          
          // Also backfill other fields if missing
          if (!recommendation.author && matchedBook.author) {
            recommendation.author = matchedBook.author;
          }
          if (!recommendation.priceByn && matchedBook.priceByn) {
            recommendation.priceByn = matchedBook.priceByn;
          }
          
          matchType += '-with-data';
          reportUpdated = true;
          continue;
        }
        
        // 5. Generate slug from title as last resort
        const generatedSlug = generateSlugFromTitle(title);
        recommendation.bookSlug = generatedSlug;
        matchType = 'generated';
        stats.generatedSlugs++;
        reportUpdated = true;
        
        console.log(`📝 Generated slug "${generatedSlug}" for "${title}" in report ${report._id}`);
      }
      
      // Save the report if it was updated
      if (reportUpdated && !isDryRun) {
        await report.save();
        stats.reportsUpdated++;
      } else if (reportUpdated && isDryRun) {
        stats.reportsUpdated++;
        console.log(`🔍 [DRY RUN] Would update report ${report._id}`);
      }
    }
    
    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log('═'.repeat(50));
    console.log(`📋 Reports processed: ${reports.length}`);
    console.log(`📋 Reports updated: ${stats.reportsUpdated}`);
    console.log(`📋 Recommendations processed: ${stats.recommendationsProcessed}`);
    console.log(`📋 Catalog matches: ${stats.catalogMatched}`);
    console.log(`📋 Known book matches: ${stats.knownBookMatched}`);
    console.log(`📋 Generated slugs: ${stats.generatedSlugs}`);
    console.log(`📋 Skipped (already have bookSlug): ${stats.skipped}`);
    
    if (isDryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were saved');
      console.log('💡 Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
  }
}

// Handle script being run directly
if (require.main === module) {
  migrate().catch(error => {
    console.error('❌ Migration error:', error);
    process.exit(1);
  });
}

module.exports = { migrate, generateSlugFromTitle, KNOWN_BOOK_SLUGS };