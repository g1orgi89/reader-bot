const mongoose = require('mongoose');

// 1. Схема BookCatalog (пример, адаптируй под свой проект)
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
  // другие поля по необходимости...
});
const BookCatalog = mongoose.model('BookCatalog', bookCatalogSchema, 'book_catalog');

// 2. Схема KnowledgeDocument (минимальная для чтения content)
const knowledgeSchema = new mongoose.Schema({
  content: String,
});
const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeSchema, 'knowledge_documents');

// 3. Основная логика
async function migrate() {
  await mongoose.connect('mongodb://reader_bot_admin:54321Server105425@127.0.0.1:27017/reader_bot?authSource=reader_bot');

  // Найти нужный документ knowledge_documents (по title или _id)
  const knowledgeDoc = await KnowledgeDocument.findOne({ title: /Каталог разборов/i });
  if (!knowledgeDoc) {
    console.error('Документ не найден');
    return;
  }

  // Парсим таблицу
  const lines = knowledgeDoc.content.split('\n').map(line => line.trim()).filter(Boolean);
  // Первая строка — заголовки
  const books = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('|').map(s => s.trim());
    if (cols.length < 8 || !cols[1]) continue; // пропускаем невалидные строки
    books.push({
      title: cols[1],
      author: cols[2],
      priceByn: Number(cols[3]),
      buyUrl: cols[4],
      description: cols[5],
      categories: cols[6].split(',').map(s => s.trim()),
      targetAudience: cols[7],
      isActive: true,
      // добавь/допиши другие нужные поля здесь
    });
  }

  // Сохраняем в book_catalog
  const res = await BookCatalog.insertMany(books);
  console.log(`Импортировано ${res.length} книг.`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
