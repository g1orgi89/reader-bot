/**
 * Конвертация ./csvjson.json -> ./data/bookCatalog.import.json в формат BookCatalog API
 * Запуск: node scripts/prepare_book_catalog_from_csvjson.js
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(process.cwd(), 'csvjson.json');
const OUTPUT_DIR = path.resolve(process.cwd(), 'data');
const OUTPUT = path.join(OUTPUT_DIR, 'bookCatalog.import.json');

// Попробуем использовать проектный маппер категорий
let mapThemesToCategory = null;
try {
  ({ mapThemesToCategory } = require('../server/utils/categoryMapper'));
} catch {
  // Фоллбек: если util недоступен при запуске скрипта
  mapThemesToCategory = (themes) => 'ПОИСК СЕБЯ';
}

function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    return (segs.pop() || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  } catch {
    return '';
  }
}

// Простейшая транслитерация на случай отсутствия ссылки
function slugifyRu(text) {
  const map = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
    н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',
    ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  };
  return String(text || '')
    .toLowerCase()
    .replace(/[а-яё]/g, ch => map[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function normalizeThemes(str) {
  return String(str || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function toNumberSafe(v) {
  if (v === null || v === undefined || v === '') return null;
  const num = Number(String(v).replace(',', '.').replace(/\s+/g, ''));
  return Number.isFinite(num) ? num : null;
}

function buildReasoning(title) {
  return `Разбор "${title}" поможет глубже понять идеи и применить их в жизни.`;
}

function convertItem(item, index) {
  const title = String(item['Название разбора'] || '').trim();
  if (!title) return null;

  const link = String(item['Прямая ссылка на покупку'] || '').trim();
  const slugFromLink = slugFromUrl(link);
  let bookSlug = slugFromLink || slugifyRu(title);
  
  // Добавляем индекс к slug для обеспечения уникальности
  // Это будет исправлено позже в main() через deduplication
  const originalSlug = bookSlug;

  const author = String(item['Автор оригинальной книги'] || '').trim() || null;
  const description = String(item['Краткое описание (2-3 предложения о чем разбор)'] || '').trim();
  const themesRaw = String(item['Основные темы (3-5 ключевых слов)'] || '').trim();
  const targetThemes = normalizeThemes(themesRaw);
  const category = mapThemesToCategory(themesRaw || '');
  const priceByn = toNumberSafe(item['Цена BYN']);
  // priceRub из источника отсутствует — оставляем null
  const priceRub = null;

  return {
    title,
    author,
    description,
    price: '$10',           // legacy, обязателен API
    priceRub,               // null
    priceByn,               // число или null
    categories: [category], // одна нормализованная категория
    targetThemes,
    bookSlug,
    originalSlug,          // для дедупликации
    index,                 // для дедупликации
    isActive: true,
    priority: 5,
    reasoning: buildReasoning(title)
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Не найден входной файл: ${INPUT}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Некорректный JSON во входном файле:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('Ожидался массив JSON с объектами книг.');
    process.exit(1);
  }

  const books = data
    .map((item, index) => convertItem(item, index))
    .filter(Boolean)
    // Удалим строки без slug/описания при необходимости:
    .filter(b => b.bookSlug && b.description);

  if (!books.length) {
    console.error('После конвертации не осталось валидных записей.');
    process.exit(1);
  }

  // Дедупликация bookSlug - добавляем суффиксы к дубликатам
  const slugCounts = {};
  books.forEach(book => {
    const originalSlug = book.originalSlug;
    if (!slugCounts[originalSlug]) {
      slugCounts[originalSlug] = [];
    }
    slugCounts[originalSlug].push(book);
  });

  // Для каждой группы дубликатов, добавляем суффиксы
  Object.values(slugCounts).forEach(group => {
    if (group.length > 1) {
      group.forEach((book, index) => {
        if (index === 0) {
          // Первая книга остается с оригинальным slug
          book.bookSlug = book.originalSlug;
        } else {
          // Последующие получают суффикс
          book.bookSlug = `${book.originalSlug}-${index + 1}`;
        }
      });
    } else {
      // Единственная книга остается с оригинальным slug
      group[0].bookSlug = group[0].originalSlug;
    }
  });

  // Убираем временные поля
  books.forEach(book => {
    delete book.originalSlug;
    delete book.index;
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify({ books }, null, 2), 'utf8');

  console.log(`Готово. Сформирован файл для импорта: ${OUTPUT}`);
  console.log(`Всего записей: ${books.length}`);
}

main();