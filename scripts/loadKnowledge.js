/**
 * Скрипт для загрузки документов в векторную базу знаний
 * @file scripts/loadKnowledge.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const vectorStoreService = require('../server/services/vectorStore');
const logger = require('../server/utils/logger');

// Константы
const KNOWLEDGE_DIR = path.join(__dirname, '../knowledge');
const SUPPORTED_EXTENSIONS = ['.md', '.txt'];
const SUPPORTED_LANGUAGES = ['en', 'es', 'ru'];

/**
 * Получает язык из пути к файлу или его имени
 * @param {string} filePath - Путь к файлу
 * @returns {string} Код языка (en, es, ru)
 */
function detectLanguageFromPath(filePath) {
  // Язык из пути к файлу
  if (filePath.includes('/ru/') || filePath.includes('\\ru\\')) return 'ru';
  if (filePath.includes('/es/') || filePath.includes('\\es\\')) return 'es';
  
  // Язык из имени файла
  const fileName = path.basename(filePath, path.extname(filePath));
  if (fileName.endsWith('_ru') || fileName.endsWith('-ru')) return 'ru';
  if (fileName.endsWith('_es') || fileName.endsWith('-es')) return 'es';
  
  // По умолчанию английский
  return 'en';
}

/**
 * Получает категорию из пути к файлу
 * @param {string} filePath - Путь к файлу
 * @returns {string} Категория документа
 */
function getCategoryFromPath(filePath) {
  // Получаем директорию, в которой находится файл
  const relativePath = path.relative(KNOWLEDGE_DIR, filePath);
  const directory = path.dirname(relativePath).split(path.sep)[0];
  
  // Если файл находится в корневой директории, используем имя файла как категорию
  if (directory === '.') {
    return 'general';
  }
  
  return directory;
}

/**
 * Получает теги из содержимого файла
 * @param {string} content - Содержимое файла
 * @returns {string[]} Массив тегов
 */
function extractTagsFromContent(content) {
  const tags = [];
  
  // Ищем теги в формате "tags: [tag1, tag2, ...]" или "tags: tag1, tag2, ..."
  const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/) || content.match(/tags:\s*([^\n]+)/);
  
  if (tagsMatch && tagsMatch[1]) {
    const tagsList = tagsMatch[1].split(',').map(tag => tag.trim()).filter(Boolean);
    tags.push(...tagsList);
  }
  
  // Ищем заголовки и ключевые слова для дополнительных тегов
  const headings = content.match(/#{1,3}\s+([^\n]+)/g) || [];
  for (const heading of headings) {
    const headingText = heading.replace(/^#{1,3}\s+/, '').trim();
    // Добавляем только короткие заголовки как теги
    if (headingText.length < 30) {
      tags.push(headingText.toLowerCase());
    }
  }
  
  // Удаляем дубликаты и возвращаем уникальные теги
  return [...new Set(tags)];
}

/**
 * Получает заголовок из содержимого файла
 * @param {string} content - Содержимое файла
 * @param {string} filePath - Путь к файлу (для запасного варианта)
 * @returns {string} Заголовок документа
 */
function extractTitleFromContent(content, filePath) {
  // Пытаемся найти заголовок в формате # Заголовок
  const titleMatch = content.match(/^#\s+([^\n]+)/);
  
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  
  // Запасной вариант: используем имя файла без расширения
  return path.basename(filePath, path.extname(filePath))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Читает файл и возвращает его содержимое
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} Содержимое файла
 */
async function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/**
 * Разбивает содержимое файла на чанки для лучшего поиска
 * @param {string} content - Содержимое файла
 * @param {number} chunkSize - Размер чанка в символах
 * @param {number} chunkOverlap - Размер перекрытия между чанками
 * @returns {string[]} Массив чанков
 */
function splitContentIntoChunks(content, chunkSize = 1000, chunkOverlap = 200) {
  // Если содержимое меньше размера чанка, возвращаем его целиком
  if (content.length <= chunkSize) {
    return [content];
  }
  
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < content.length) {
    // Определяем конец чанка
    let endIndex = startIndex + chunkSize;
    
    // Если не дошли до конца текста, ищем ближайшую границу предложения
    if (endIndex < content.length) {
      // Ищем точку, вопросительный или восклицательный знак с пробелом после
      const sentenceEndMatch = content.substring(endIndex - 100, endIndex + 100).match(/[.!?]\s/);
      if (sentenceEndMatch) {
        // Корректируем индекс с учетом относительной позиции найденного совпадения
        endIndex = endIndex - 100 + sentenceEndMatch.index + 2; // +2 для включения знака и пробела
      }
    } else {
      endIndex = content.length;
    }
    
    // Добавляем чанк
    chunks.push(content.substring(startIndex, endIndex));
    
    // Обновляем начальный индекс с учетом перекрытия
    startIndex = endIndex - chunkOverlap;
    
    // Если перекрытие делает следующий чанк слишком маленьким, просто заканчиваем
    if (startIndex + chunkSize - chunkOverlap >= content.length) {
      // Добавляем последний фрагмент, если он еще не добавлен
      if (endIndex < content.length) {
        chunks.push(content.substring(startIndex));
      }
      break;
    }
  }
  
  return chunks;
}

/**
 * Загружает все документы из директории в Qdrant
 * @param {string} directory - Директория для сканирования
 * @param {Object} options - Опции загрузки
 * @param {boolean} options.clearFirst - Очистить коллекцию перед загрузкой
 * @param {number} options.chunkSize - Размер чанка в символах
 * @param {number} options.chunkOverlap - Размер перекрытия между чанками
 * @returns {Promise<number>} Количество загруженных документов
 */
async function loadDocumentsFromDirectory(directory, options = {}) {
  try {
    const { clearFirst = false, chunkSize = 1000, chunkOverlap = 200 } = options;
    
    logger.info(`Loading documents from: ${directory}`);
    
    // Проверка существования директории
    if (!fs.existsSync(directory)) {
      logger.error(`Directory not found: ${directory}`);
      return 0;
    }
    
    // Инициализация векторной базы
    const initialized = await vectorStoreService.initialize();
    if (!initialized) {
      logger.error('Failed to initialize vector store');
      return 0;
    }
    
    // Очистка коллекции, если требуется
    if (clearFirst) {
      logger.warn('Clearing vector store collection before loading documents');
      await vectorStoreService.clearCollection();
    }
    
    // Рекурсивное сканирование директории
    const documents = [];
    
    async function scanDirectory(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Рекурсивно сканируем вложенные директории
          await scanDirectory(fullPath);
        } else if (entry.isFile() && SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
          // Загружаем поддерживаемые файлы
          try {
            const content = await readFile(fullPath);
            
            // Извлекаем метаданные из файла и пути
            const language = detectLanguageFromPath(fullPath);
            const category = getCategoryFromPath(fullPath);
            const title = extractTitleFromContent(content, fullPath);
            const tags = extractTagsFromContent(content);
            
            // Разбиваем содержимое на чанки
            const chunks = splitContentIntoChunks(content, chunkSize, chunkOverlap);
            
            // Добавляем каждый чанк как отдельный документ
            chunks.forEach((chunk, index) => {
              // Создаем уникальный ID для документа
              const id = uuidv4();
              
              // Собираем метаданные для чанка
              const chunkTitle = chunks.length > 1 
                ? `${title} (часть ${index + 1}/${chunks.length})` 
                : title;
              
              documents.push({
                id,
                content: chunk,
                metadata: {
                  id,
                  title: chunkTitle,
                  originalTitle: title,
                  chunkIndex: index,
                  totalChunks: chunks.length,
                  category,
                  language,
                  tags,
                  source: fullPath,
                  createdAt: new Date().toISOString()
                }
              });
            });
            
            logger.info(`Processed document: ${title} (${language}, ${category}) - ${chunks.length} chunks`);
          } catch (error) {
            logger.error(`Error processing file ${fullPath}: ${error.message}`);
          }
        }
      }
    }
    
    // Начинаем сканирование
    await scanDirectory(directory);
    
    // Загружаем документы в Qdrant (партиями по 50)
    if (documents.length > 0) {
      const batchSize = 50;
      const batches = Math.ceil(documents.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, documents.length);
        const batch = documents.slice(start, end);
        
        logger.info(`Uploading batch ${i + 1}/${batches} (${batch.length} documents)`);
        
        await vectorStoreService.addDocuments(batch);
      }
      
      logger.info(`Successfully loaded ${documents.length} document chunks into Qdrant`);
    } else {
      logger.warn('No documents found for loading');
    }
    
    return documents.length;
  } catch (error) {
    logger.error(`Error loading documents: ${error.message}`);
    throw error;
  }
}

/**
 * Тестирует поиск в векторной базе
 * @param {string[]} queries - Тестовые запросы
 * @returns {Promise<void>}
 */
async function testSearch(queries = []) {
  if (!queries || queries.length === 0) {
    // Примеры запросов для тестирования на разных языках
    queries = [
      { query: 'How to connect a wallet', language: 'en' },
      { query: 'What is the SHROOMS token', language: 'en' },
      { query: 'Как подключить кошелек', language: 'ru' },
      { query: '¿Qué es el token SHROOMS?', language: 'es' }
    ];
  }
  
  logger.info('Running test searches...');
  
  for (const test of queries) {
    try {
      const results = await vectorStoreService.search(test.query, { 
        limit: 3, 
        language: test.language
      });
      
      logger.info(`Test query: "${test.query}" (${test.language})`);
      logger.info(`Found ${results.length} results`);
      
      if (results.length > 0) {
        logger.info(`Top result: ${results[0].metadata.title} (score: ${results[0].score.toFixed(2)})`);
        // Показываем короткий фрагмент содержимого
        const contentPreview = results[0].content.length > 100 
          ? results[0].content.substring(0, 100) + '...' 
          : results[0].content;
        logger.info(`Content preview: ${contentPreview}`);
      }
    } catch (error) {
      logger.error(`Test search failed: ${error.message}`);
    }
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Разбор аргументов командной строки
    const args = process.argv.slice(2);
    const clearFlag = args.includes('--clear');
    const testFlag = args.includes('--test');
    const verboseFlag = args.includes('--verbose');
    
    // Получаем директорию базы знаний
    let knowledgeDir = KNOWLEDGE_DIR;
    const dirIndex = args.findIndex(arg => arg === '--dir');
    if (dirIndex !== -1 && args.length > dirIndex + 1) {
      knowledgeDir = args[dirIndex + 1];
    }
    
    // Проверка наличия директории с базой знаний
    if (!fs.existsSync(knowledgeDir)) {
      logger.error(`Knowledge directory not found: ${knowledgeDir}`);
      process.exit(1);
    }
    
    console.log(`Starting knowledge base loading from: ${knowledgeDir}`);
    console.log(`Clear existing data: ${clearFlag}`);
    
    // Загрузка документов
    const count = await loadDocumentsFromDirectory(knowledgeDir, {
      clearFirst: clearFlag,
      chunkSize: 1000,
      chunkOverlap: 200
    });
    
    console.log(`Knowledge base loading completed. Total document chunks: ${count}`);
    
    // Тестирование поиска
    if (testFlag && count > 0) {
      console.log('Running test searches...');
      await testSearch();
    }
    
    if (verboseFlag) {
      // Показываем статистику по векторной базе
      const stats = await vectorStoreService.getStats();
      console.log('Vector store statistics:');
      console.log(JSON.stringify(stats, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`Failed to load knowledge base: ${error.message}`);
    process.exit(1);
  }
}

// Запуск сценария, если файл запущен напрямую
if (require.main === module) {
  main().catch(error => {
    console.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

// Экспорт функций для использования в других модулях
module.exports = {
  loadDocumentsFromDirectory,
  testSearch
};
