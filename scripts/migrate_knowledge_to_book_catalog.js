const mongoose = require('mongoose');

function makeSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/ё/g, 'e')  // заменим "ё" на "e" для универсальности
    .replace(/[^a-zа-я0-9\s-]/giu, '') // добавим флаг 'u' для Unicode!
    .replace(/\s+/g, '-')       // пробелы на дефисы
    .replace(/\-+/g, '-')       // несколько дефисов — один дефис
    .replace(/^\-+|\-+$/g, ''); // дефисы в начале/конце
}

const bookCatalogSchema = new mongoose.Schema({
  title: String,
  author: String,
  priceByn: Number,
  buyUrl: String,
  description: String,
  categories: [String],
  targetAudience: String,
  isActive: Boolean,
  bookSlug: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
});
const BookCatalog = mongoose.model('BookCatalog', bookCatalogSchema, 'book_catalog');

const knowledgeSchema = new mongoose.Schema({
  title: String,
  content: String,
});
const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeSchema, 'knowledge_documents');

async function migrate() {
  await mongoose.connect('mongodb://reader_bot_admin:54321Server105425@127.0.0.1:27017/reader_bot?authSource=reader_bot');

  const doc = await KnowledgeDocument.findOne({ title: /Каталог разборов/i });
  if (!doc) {
    console.error('Документ не найден!');
    process.exit(1);
  }

  const lines = doc.content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    console.error('Контент пустой или без данных.');
    process.exit(1);
  }

  const books = [];
  const usedSlugs = new Set();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('|').map(s => s.trim());
    if (cols.length < 8) continue;

    const rawPrice = cols[3].replace(',', '.').replace(/[^0-9.]/g, '').trim();
    const priceByn = Number(rawPrice);
    if (!rawPrice || isNaN(priceByn)) {
      console.warn(`Пропущена строка ${i + 1}: невалидная цена (${cols[3]})`);
      continue;
    }

    const title = cols[1];
    if (!title) {
      console.warn(`Пропущена строка ${i + 1}: пустой title`);
      continue;
    }
    let baseSlug = makeSlug(title);
    if (!baseSlug) {
      console.warn(`Пропущена строка ${i + 1}: невалидный slug (${title})`);
      continue;
    }

    let slug = baseSlug, n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${n++}`;
    }
    usedSlugs.add(slug);

    books.push({
      title,
      author: cols[2],
      priceByn,
      buyUrl: cols[4],
      description: cols[5],
      categories: cols[6].split(',').map(s => s.trim()),
      targetAudience: cols[7],
      isActive: true,
      createdAt: new Date(),
      bookSlug: slug,
    });
  }

  if (!books.length) {
    console.error('Не удалось распарсить ни одной книги!');
    process.exit(1);
  }

  const res = await BookCatalog.insertMany(books);
  console.log(`Импортировано книг: ${res.length}`);
  await mongoose.disconnect();
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
