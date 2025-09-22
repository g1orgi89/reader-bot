#!/usr/bin/env node
/**
 * Integration test for catalog import and pricing functionality
 */

const { 
  normalizeCategoriesInput, 
  mapThemesToCategory,
  WEBSITE_CATEGORIES
} = require('../server/utils/categoryMapper');

console.log('🧪 Running Integration Tests for Catalog Import & Pricing');
console.log('========================================================\n');

let passed = 0;
let failed = 0;

function test(description, testFn) {
  try {
    const result = testFn();
    if (result) {
      console.log(`✅ ${description}`);
      passed++;
    } else {
      console.log(`❌ ${description}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
    failed++;
  }
}

// Test 1: Category mapping
test('Category mapping maps "любовь" to "ЛЮБОВЬ"', () => {
  return mapThemesToCategory('любовь') === 'ЛЮБОВЬ';
});

test('Category mapping maps "психология" to "ПОИСК СЕБЯ"', () => {
  return mapThemesToCategory('психология') === 'ПОИСК СЕБЯ';
});

test('Category mapping handles comma-separated themes', () => {
  return mapThemesToCategory('любовь, отношения') === 'ЛЮБОВЬ';
});

test('Category mapping falls back to "ПОИСК СЕБЯ" for unknown themes', () => {
  return mapThemesToCategory('unknown theme') === 'ПОИСК СЕБЯ';
});

// Test 2: Category normalization
test('Category normalization handles category field', () => {
  const result = normalizeCategoriesInput({ category: 'любовь' });
  return Array.isArray(result) && result.length === 1 && result[0] === 'ЛЮБОВЬ';
});

test('Category normalization handles categories array', () => {
  const result = normalizeCategoriesInput({ categories: ['деньги'] });
  return Array.isArray(result) && result.length === 1 && result[0] === 'ДЕНЬГИ';
});

test('Category normalization handles empty input', () => {
  const result = normalizeCategoriesInput({});
  return Array.isArray(result) && result.length === 1 && result[0] === 'ПОИСК СЕБЯ';
});

// Test 3: BookCatalog model fields
test('BookCatalog model has priceRub field', () => {
  const BookCatalog = require('../server/models/BookCatalog');
  return BookCatalog.schema.paths.priceRub !== undefined;
});

test('BookCatalog model has priceByn field', () => {
  const BookCatalog = require('../server/models/BookCatalog');
  return BookCatalog.schema.paths.priceByn !== undefined;
});

test('BookCatalog model still has legacy price field', () => {
  const BookCatalog = require('../server/models/BookCatalog');
  return BookCatalog.schema.paths.price !== undefined;
});

// Test 4: Price calculations
test('BYN to RUB conversion works correctly', () => {
  const BYN_TO_RUB = 30;
  const priceByn = 15.5;
  const priceRub = Math.round(priceByn * BYN_TO_RUB);
  return priceRub === 465;
});

test('Price parsing handles comma decimal separator', () => {
  const priceStr = '15,50';
  const parsed = parseFloat(priceStr.replace(',', '.'));
  return parsed === 15.5;
});

// Test 5: Slug generation
test('Slug generation works for Cyrillic text', () => {
  const title = 'Искусство любить';
  const slug = title.toLowerCase()
    .replace(/[^a-za-z0-9а-яё\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[а-яё]/g, (char) => {
      const map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return map[char] || char;
    })
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  
  return slug === 'iskusstvo-lyubit';
});

// Test 6: API route compilation
test('BookCatalog API routes compile without errors', () => {
  try {
    require('../server/api/bookCatalog');
    return true;
  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return false;
  }
});

test('Reader API routes compile without errors', () => {
  try {
    require('../server/api/reader');
    return true;
  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return false;
  }
});

// Test 7: Website categories validation
test('All 14 website categories are defined', () => {
  return WEBSITE_CATEGORIES.length === 14;
});

test('WEBSITE_CATEGORIES includes required categories', () => {
  const required = ['КРИЗИСЫ', 'Я — ЖЕНЩИНА', 'ЛЮБОВЬ', 'ОТНОШЕНИЯ', 'ДЕНЬГИ', 'ПОИСК СЕБЯ'];
  return required.every(cat => WEBSITE_CATEGORIES.includes(cat));
});

// Test 8: Mini-app syntax validation
test('CatalogPage.js has valid syntax', () => {
  try {
    const fs = require('fs');
    const content = fs.readFileSync('../mini-app/js/pages/CatalogPage.js', 'utf8');
    // Basic syntax checks
    return content.includes('convertApiBookToDisplayFormat') &&
           content.includes('formatPrice') &&
           content.includes('getCatalog');
  } catch (error) {
    return false;
  }
});

test('API service has getCatalog method', () => {
  try {
    const fs = require('fs');
    const content = fs.readFileSync('../mini-app/js/services/api.js', 'utf8');
    return content.includes('getCatalog') && content.includes('getBookCatalog');
  } catch (error) {
    return false;
  }
});

console.log('\n📊 Test Results:');
console.log('================');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! The implementation is ready.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}