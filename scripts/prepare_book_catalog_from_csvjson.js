/**
 * @fileoverview Conversion script to prepare book catalog import from csvjson.json
 * @description Converts the CSV-JSON data to BookCatalog format for import
 * @author Reader Bot Team
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate slug from title
 * @param {string} title - Book title
 * @returns {string} URL-safe slug
 */
function generateSlug(title) {
  // Transliterate Cyrillic to Latin
  const transliterationMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  return title
    .toLowerCase()
    .split('')
    .map(char => transliterationMap[char] || char)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-latin chars except spaces and hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-+/g, '_') // Replace hyphens with underscores  
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Map categories from CSV format to schema enum
 * @param {string} themesStr - Comma-separated themes from CSV
 * @returns {string[]} Array of mapped categories
 */
function mapCategories(themesStr) {
  if (!themesStr) return ['ПОИСК СЕБЯ']; // Default fallback
  
  const themes = themesStr.toLowerCase();
  const categories = [];
  
  // Mapping rules based on keywords
  if (themes.includes('кризис') || themes.includes('трудности') || themes.includes('стресс')) {
    categories.push('КРИЗИСЫ');
  }
  if (themes.includes('женщин') || themes.includes('я — женщина')) {
    categories.push('Я — ЖЕНЩИНА');
  }
  if (themes.includes('любов') || themes.includes('любимые')) {
    categories.push('ЛЮБОВЬ');
  }
  if (themes.includes('отношения') || themes.includes('семь')) {
    categories.push('ОТНОШЕНИЯ');
  }
  if (themes.includes('деньги') || themes.includes('финанс')) {
    categories.push('ДЕНЬГИ');
  }
  if (themes.includes('одиночест')) {
    categories.push('ОДИНОЧЕСТВО');
  }
  if (themes.includes('смерт')) {
    categories.push('СМЕРТЬ');
  }
  if (themes.includes('семейн') || themes.includes('семья')) {
    categories.push('СЕМЕЙНЫЕ ОТНОШЕНИЯ');
  }
  if (themes.includes('смысл жизни') || themes.includes('смысл')) {
    categories.push('СМЫСЛ ЖИЗНИ');
  }
  if (themes.includes('счаст')) {
    categories.push('СЧАСТЬЕ');
  }
  if (themes.includes('время') || themes.includes('привычк') || themes.includes('лень')) {
    categories.push('ВРЕМЯ И ПРИВЫЧКИ');
  }
  if (themes.includes('добро') || themes.includes('зло')) {
    categories.push('ДОБРО И ЗЛО');
  }
  if (themes.includes('общество')) {
    categories.push('ОБЩЕСТВО');
  }
  if (themes.includes('поиск себя') || themes.includes('растерянность') || themes.includes('не знаю что делать')) {
    categories.push('ПОИСК СЕБЯ');
  }
  
  // If no categories matched, default to universal category
  return categories.length > 0 ? categories : ['ПОИСК СЕБЯ'];
}

/**
 * Parse target themes from the themes string
 * @param {string} themesStr - Comma-separated themes from CSV
 * @returns {string[]} Array of target themes
 */
function parseTargetThemes(themesStr) {
  if (!themesStr) return [];
  
  return themesStr
    .split(',')
    .map(theme => theme.trim())
    .filter(theme => theme.length > 0)
    .slice(0, 10); // Limit to 10 themes max
}

/**
 * Convert CSV-JSON data to BookCatalog format
 * @param {Object[]} csvData - Data from csvjson.json
 * @returns {Object[]} Array of books in BookCatalog format
 */
function convertToBookCatalog(csvData) {
  const books = [];
  const usedSlugs = new Set();
  
  for (const item of csvData) {
    try {
      // Skip invalid entries
      if (!item['Название разбора'] || !item['Цена BYN']) {
        console.warn('Skipping invalid entry:', item);
        continue;
      }
      
      const title = item['Название разбора'].trim();
      const author = item['Автор оригинальной книги']?.trim() || null;
      const description = item['Краткое описание (2-3 предложения о чем разбор)']?.trim() || '';
      const priceByn = parseInt(item['Цена BYN']);
      const purchaseUrl = item['Прямая ссылка на покупку']?.trim() || null;
      const themesStr = item['Основные темы (3-5 ключевых слов)']?.trim() || '';
      const targetAudience = item['Целевая аудитория']?.trim() || '';
      
      // Generate unique slug
      let baseSlug = generateSlug(title);
      let bookSlug = baseSlug;
      let counter = 1;
      
      while (usedSlugs.has(bookSlug)) {
        bookSlug = `${baseSlug}_${counter}`;
        counter++;
      }
      usedSlugs.add(bookSlug);
      
      // Map categories and target themes
      const categories = mapCategories(themesStr);
      const targetThemes = parseTargetThemes(themesStr);
      
      // Create reasoning from description and target audience
      let reasoning = description;
      if (reasoning.length > 180) {
        reasoning = reasoning.substring(0, 177) + '...';
      }
      if (!reasoning) {
        reasoning = `Разбор книги "${title}" для читателей`;
      }
      
      const book = {
        title,
        author,
        description: description || `Подробный разбор книги "${title}"`,
        price: `$${Math.round(priceByn / 3)}`, // Rough BYN to USD conversion
        priceByn,
        categories,
        targetThemes,
        bookSlug,
        purchaseUrl, // This is the key new field
        isActive: true,
        priority: 5, // Default priority
        reasoning: reasoning || `Рекомендуется для изучения темы ${categories[0].toLowerCase()}`
      };
      
      books.push(book);
      
    } catch (error) {
      console.error('Error processing item:', item, error);
    }
  }
  
  return books;
}

/**
 * Main function to process the conversion
 */
async function main() {
  try {
    const inputFile = path.join(__dirname, '..', 'csvjson.json');
    const outputFile = path.join(__dirname, '..', 'data', 'bookCatalog.import.json');
    
    // Ensure data directory exists
    const dataDir = path.dirname(outputFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Read input file
    console.log('Reading csvjson.json...');
    const csvData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    // Convert data
    console.log(`Converting ${csvData.length} entries...`);
    const books = convertToBookCatalog(csvData);
    
    // Write output file
    const outputData = { books };
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');
    
    console.log(`✅ Conversion completed!`);
    console.log(`   Input: ${csvData.length} entries`);
    console.log(`   Output: ${books.length} books`);
    console.log(`   File: ${outputFile}`);
    
    // Show sample of converted data
    console.log('\n📋 Sample converted entry:');
    console.log(JSON.stringify(books[0], null, 2));
    
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { convertToBookCatalog, generateSlug, mapCategories };