const mongoose = require('mongoose');

// Схема для коллекции book_catalog
const bookCatalogSchema = new mongoose.Schema({
  title: String,
  author: String,
  priceByn: Number,
  buyUrl: String,
  description: String,
  categories: [String],
  targetAudience: String,
  isActive: Boolean,
  createdAt: { type: Date, default: Date.now },
});
const BookCatalog = mongoose.model('BookCatalog', bookCatalogSchema, 'book_catalog');

// Схема для коллекции knowledge_documents
const knowledgeSchema = new mongoose.Schema({
  title: String,
  content: String,
});
const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeSchema, 'knowledge_documents');

async function migrate() {
  await mongoose.connect('mongodb://reader_bot_admin:54321Server105425@127.0.0.1:27017/reader_bot?authSource=reader_bot');

  // Найдём документ с каталогом разборов
  const doc = await KnowledgeDocument.findOne({ title: /Каталог разборов/i });
  if (!doc) {
    console.error('Документ с каталогом разборов не найден!');
    process.exit(1);
  }

  // Парсим строки таблицы
  const lines = doc.content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    console.error('Контент пустой или без данных.');
    process.exit(1);
  }

  const books = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('|').map(s => s.trim());
    if (cols.length < 8) continue; // пропускаем битые строки

    // Очищаем цену и проверяем на валидность
    const rawPrice = cols[3].replace(',', '.').replace(/[^0-9.]/g, '').trim();
    const priceByn = Number(rawPrice);

    if (!rawPrice || isNaN(priceByn)) {
      console.warn(`Пропущена строка ${i + 1}: невалидная цена (${cols[3]})`);
      continue;
    }

    books.push({
      title: cols[1],
      author: cols[2],
      priceByn,
      buyUrl: cols[4],
      description: cols[5],
      categories: cols[6].split(',').map(s => s.trim()),
      targetAudience: cols[7],
      isActive: true,
      createdAt: new Date(),
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
