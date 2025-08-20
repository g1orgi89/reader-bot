/**
 * Миграция категорий каталога книг под 14 витринных категорий.
 * - По title ищет нужную витринную категорию и оставляет только ее в categories[0]
 * - Старые категории и любые старые поля с рубриками складывает в расширенные теги tags
 * - Исключает дублирование (новая витринная категория не попадает в tags)
 * 
 * Запуск:
 *   DRY RUN (по умолчанию): node scripts/migrate_book_categories.js
 *   Применить изменения:   node scripts/migrate_book_categories.js --apply
 * 
 * Требуется переменная окружения MONGODB_URI в .env
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reader_bot';
const APPLY = process.argv.includes('--apply');

const BookCatalog = require('../server/models/BookCatalog');

/**
 * 14 витринных категорий (ровно как в enum модели)
 */
const CATEGORY_ENUM = [
  'КРИЗИСЫ',
  'Я — ЖЕНЩИНА',
  'ЛЮБОВЬ',
  'ОТНОШЕНИЯ',
  'ДЕНЬГИ',
  'ОДИНОЧЕСТВО',
  'СМЕРТЬ',
  'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'СМЫСЛ ЖИЗНИ',
  'СЧАСТЬЕ',
  'ВРЕМЯ И ПРИВЫЧКИ',
  'ДОБРО И ЗЛО',
  'ОБЩЕСТВО',
  'ПОИСК СЕБЯ'
];

/**
 * Утилита: нормализация строки заголовка для сопоставления
 */
function normalizeTitle(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"""'']/g, '')
    .replace(/[—–‐-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(разбор( книг)?|курс|авторский курс)\s*:?/g, '')
    .trim();
}

/**
 * Карта соответствия normalizedTitle -> категория (по списку от пользователя)
 */
const TITLE_TO_CATEGORY = new Map([
  // КРИЗИСЫ
  ['тысячеликий герой', 'КРИЗИСЫ'],
  ['гроздья гнева', 'КРИЗИСЫ'],
  ['идиот', 'КРИЗИСЫ'],
  ['игрок', 'КРИЗИСЫ'],

  // Я — ЖЕНЩИНА
  ['все дороги ведут к себе', 'Я — ЖЕНЩИНА'],
  ['я у себя одна или веретено василисы', 'Я — ЖЕНЩИНА'],
  ['нелюбимая дочь', 'Я — ЖЕНЩИНА'],

  // ЛЮБОВЬ
  ['искусство любить', 'ЛЮБОВЬ'],
  ['госпожа бовари', 'ЛЮБОВЬ'],

  // ОТНОШЕНИЯ
  ['разбор книг эрика берна', 'ОТНОШЕНИЯ'],
  ['люди которые играют в игры', 'ОТНОШЕНИЯ'],
  ['игры в которые играют люди', 'ОТНОШЕНИЯ'],
  ['неверность', 'ОТНОШЕНИЯ'],
  ['невыносимая легкость бытия', 'ОТНОШЕНИЯ'],
  ['герой нашего времени', 'ОТНОШЕНИЯ'],
  ['анна каренина', 'ОТНОШЕНИЯ'],
  ['война и мир', 'ОТНОШЕНИЯ'],
  ['вишневый сад', 'ОТНОШЕНИЯ'],
  ['уйти чтобы вырасти', 'ОТНОШЕНИЯ'],

  // ДЕНЬГИ
  ['время деньги', 'ДЕНЬГИ'],

  // ОДИНОЧЕСТВО
  ['сто лет одиночества', 'ОДИНОЧЕСТВО'],
  ['тошнота', 'ОДИНОЧЕСТВО'],
  ['парадокс одиночества', 'ОДИНОЧЕСТВО'],
  ['возраст', 'ОДИНОЧЕСТВО'],

  // СМЕРТЬ
  ['вглядываясь в солнце', 'СМЕРТЬ'],
  ['смерть ивана ильича', 'СМЕРТЬ'],

  // СЕМЕЙНЫЕ ОТНОШЕНИЯ
  ['все дело в папе', 'СЕМЕЙНЫЕ ОТНОШЕНИЯ'],
  ['братья карамазовы', 'СЕМЕЙНЫЕ ОТНОШЕНИЯ'],
  ['бесы', 'СЕМЕЙНЫЕ ОТНОШЕНИЯ'],
  ['отцы и дети', 'СЕМЕЙНЫЕ ОТНОШЕНИЯ'],

  // СМЫСЛ ЖИЗНИ
  ['выбор', 'СМЫСЛ ЖИЗНИ'],
  ['12 правил жизни', 'СМЫСЛ ЖИЗНИ'],

  // СЧАСТЬЕ
  ['поток', 'СЧАСТЬЕ'],

  // ВРЕМЯ И ПРИВЫЧКИ
  ['атомные привычки', 'ВРЕМЯ И ПРИВЫЧКИ'],
  ['4000 недель', 'ВРЕМЯ И ПРИВЫЧКИ'],
  ['ада или отрада', 'ВРЕМЯ И ПРИВЫЧКИ'],

  // ДОБРО И ЗЛО
  ['преступление и наказание', 'ДОБРО И ЗЛО'],
  ['фауст', 'ДОБРО И ЗЛО'],

  // ОБЩЕСТВО
  ['горе от ума', 'ОБЩЕСТВО'],
  ['собачье сердце', 'ОБЩЕСТВО'],
  ['мертвые души', 'ОБЩЕСТВО'],

  // ПОИСК СЕБЯ
  ['защита лужина', 'ПОИСК СЕБЯ'],
  ['биография владимира набокова', 'ПОИСК СЕБЯ'],
  ['биография льва толстого', 'ПОИСК СЕБЯ'],
]);

function collectLegacyTags(doc, newCategory) {
  const bucket = new Set();

  if (Array.isArray(doc.categories)) {
    for (const c of doc.categories) if (typeof c === 'string' && c.trim()) bucket.add(c.trim());
  }
  for (const key of ['category', 'rawCategories', 'keywords', 'tags']) {
    const val = doc[key];
    if (!val) continue;
    if (Array.isArray(val)) {
      for (const v of val) if (typeof v === 'string' && v.trim()) bucket.add(v.trim());
    } else if (typeof val === 'string' && val.trim()) {
      bucket.add(val.trim());
    }
  }
  if (newCategory) bucket.delete(newCategory);
  return Array.from(bucket);
}

async function run() {
  await mongoose.connect(MONGODB_URI, { autoIndex: false });
  console.log(`🔌 Connected to MongoDB: ${MONGODB_URI}`);
  console.log(`🧪 Mode: ${APPLY ? 'APPLY (will modify data)' : 'DRY-RUN (no changes saved)'}`);

  const books = await BookCatalog.find({}, { title: 1, categories: 1 }).lean();
  console.log(`📚 Found ${books.length} books in catalog`);

  let updated = 0; let skipped = 0; const notMatched = [];

  for (const book of books) {
    const norm = normalizeTitle(book.title);
    let newCategory = TITLE_TO_CATEGORY.get(norm);
    if (!newCategory) {
      const short = norm.replace(/[:,\-–—].*$/, '').trim();
      if (short && TITLE_TO_CATEGORY.has(short)) newCategory = TITLE_TO_CATEGORY.get(short);
    }
    if (!newCategory) { notMatched.push(book.title); skipped++; continue; }
    if (!CATEGORY_ENUM.includes(newCategory)) { console.warn(`⚠️ Not in enum: ${newCategory} (${book.title})`); skipped++; continue; }

    const legacyTags = collectLegacyTags(book, newCategory);
    const update = { $set: { categories: [newCategory], tags: legacyTags } };

    if (APPLY) await BookCatalog.collection.updateOne({ _id: book._id }, update, { upsert: false });

    updated++;
    console.log(`${APPLY ? '✅ UPDATED' : 'ℹ️  Will update'}: "${book.title}" → category=[${newCategory}] tags=${legacyTags.length}`);
  }

  console.log('------------------------------------------------------------');
  console.log(`✅ Done. Updated: ${updated}, Skipped: ${skipped}`);
  if (notMatched.length) {
    console.log('\n⚠️ Not matched by title:');
    notMatched.forEach(t => console.log(`  - ${t}`));
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

run().catch(err => { console.error('❌ Migration error:', err); process.exit(1); });