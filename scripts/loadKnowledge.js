/**
 * @file Script for loading initial knowledge base
 * @description Скрипт для загрузки документов в векторную базу знаний
 * 
 * Поддерживает:
 * - Загрузку документов из директории knowledge/
 * - Автоматическое определение языка и категории
 * - Обработку различных форматов (MD, TXT, JSON)
 * - Создание contextual embeddings
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const VectorStoreService = require('../server/services/vectorStore');
const TextProcessor = require('../server/utils/textProcessor');
const { getVectorStoreConfig } = require('../server/config/vectorStore');
const logger = require('../server/utils/logger');

/**
 * @typedef {Object} KnowledgeDocument
 * @property {string} path - Путь к файлу
 * @property {string} content - Содержимое документа
 * @property {Object} metadata - Метаданные
 */

/**
 * @class KnowledgeLoader
 * @description Загрузчик базы знаний
 */
class KnowledgeLoader {
  constructor() {
    this.vectorStoreConfig = getVectorStoreConfig();
    this.vectorStore = new VectorStoreService(this.vectorStoreConfig);
    this.textProcessor = new TextProcessor();
    this.baseKnowledgePath = path.join(__dirname, '../knowledge');
    this.supportedExtensions = ['.md', '.txt', '.json'];
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      totalChunks: 0,
      errors: []
    };
  }

  /**
   * Основная функция загрузки базы знаний
   * @returns {Promise<void>}
   */
  async loadKnowledgeBase() {
    try {
      logger.info('Starting knowledge base loading...');
      
      // Инициализация векторной базы
      await this.vectorStore.initialize();
      
      // Поиск всех документов
      const documents = await this.findAllDocuments();
      logger.info(`Found ${documents.length} documents to process`);
      
      // Группировка документов по языкам для оптимизации
      const documentsByLanguage = this.groupDocumentsByLanguage(documents);
      
      // Обработка документов по группам
      let totalProcessed = 0;
      for (const [language, docs] of Object.entries(documentsByLanguage)) {
        logger.info(`Processing ${docs.length} ${language} documents...`);
        
        const processedDocs = await this.processDocuments(docs);
        totalProcessed += processedDocs;
      }
      
      // Вывод статистики
      this.printStatistics();
      
      logger.info('Knowledge base loading completed successfully!');
    } catch (error) {
      logger.error(`Failed to load knowledge base: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Поиск всех документов в директории knowledge
   * @returns {Promise<KnowledgeDocument[]>}
   */
  async findAllDocuments() {
    const documents = [];
    
    try {
      // Проверка существования директории
      await fs.access(this.baseKnowledgePath);
    } catch (error) {
      logger.error(`Knowledge directory not found: ${this.baseKnowledgePath}`);
      return documents;
    }
    
    // Рекурсивный поиск файлов
    const findFiles = async (dir, relativePath = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const currentRelativePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          await findFiles(fullPath, currentRelativePath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (this.supportedExtensions.includes(ext)) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const metadata = this.extractMetadata(currentRelativePath, content);
              
              documents.push({
                path: currentRelativePath,
                content,
                metadata
              });
              
              this.stats.totalFiles++;
            } catch (error) {
              logger.warn(`Failed to read file ${fullPath}: ${error.message}`);
              this.stats.errors.push({
                file: currentRelativePath,
                error: error.message
              });
            }
          }
        }
      }
    };
    
    await findFiles(this.baseKnowledgePath);
    return documents;
  }

  /**
   * Извлечение метаданных из пути файла и содержимого
   * @param {string} filePath - Путь к файлу
   * @param {string} content - Содержимое файла
   * @returns {Object} Метаданные документа
   */
  extractMetadata(filePath, content) {
    const metadata = {
      source: filePath,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Определение категории по пути
    const pathParts = filePath.split(path.sep);
    if (pathParts.length > 1) {
      metadata.category = pathParts[0];
    } else {
      metadata.category = 'general';
    }
    
    // Определение языка по пути или содержимому
    metadata.language = this.detectLanguage(filePath, content);
    
    // Извлечение заголовка
    metadata.title = this.extractTitle(filePath, content);
    
    // Извлечение тегов из содержимого (markdown метаданные)
    const tags = this.extractTags(content);
    if (tags.length > 0) {
      metadata.tags = tags;
    }
    
    return metadata;
  }

  /**
   * Определение языка документа
   * @param {string} filePath - Путь к файлу
   * @param {string} content - Содержимое
   * @returns {string} Код языка
   */
  detectLanguage(filePath, content) {
    // Проверка по пути файла
    if (filePath.includes('/ru/') || filePath.includes('_ru.') || filePath.includes('-ru.')) {
      return 'ru';
    }
    if (filePath.includes('/es/') || filePath.includes('_es.') || filePath.includes('-es.')) {
      return 'es';
    }
    
    // Простая эвристика по содержимому
    const russianChars = (content.match(/[а-яё]/gi) || []).length;
    const totalChars = content.replace(/\s/g, '').length;
    
    if (russianChars / totalChars > 0.1) {
      return 'ru';
    }
    
    // По умолчанию английский
    return 'en';
  }

  /**
   * Извлечение заголовка документа
   * @param {string} filePath - Путь к файлу
   * @param {string} content - Содержимое
   * @returns {string} Заголовок
   */
  extractTitle(filePath, content) {
    // Поиск заголовка в markdown
    const mdHeaderMatch = content.match(/^#\s+(.+)$/m);
    if (mdHeaderMatch) {
      return mdHeaderMatch[1].trim();
    }
    
    // Поиск title в frontmatter
    const frontmatterMatch = content.match(/^---\n[\s\S]*?title:\s*(.+)\n[\s\S]*?---/);
    if (frontmatterMatch) {
      return frontmatterMatch[1].trim().replace(/["']/g, '');
    }
    
    // Использование имени файла без расширения
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Извлечение тегов из содержимого
   * @param {string} content - Содержимое документа
   * @returns {string[]} Массив тегов
   */
  extractTags(content) {
    const tags = [];
    
    // Поиск тегов в frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
      if (tagsMatch) {
        const tagsList = tagsMatch[1].split(',').map(tag => tag.trim().replace(/["']/g, ''));
        tags.push(...tagsList);
      }
    }
    
    // Поиск hashtags в тексте
    const hashtagMatches = content.match(/#([а-яё\w]+)/gi);
    if (hashtagMatches) {
      const hashtags = hashtagMatches.map(tag => tag.substring(1).toLowerCase());
      tags.push(...hashtags);
    }
    
    return [...new Set(tags)]; // Удаление дубликатов
  }

  /**
   * Группировка документов по языкам
   * @param {KnowledgeDocument[]} documents - Документы
   * @returns {Object} Документы, сгруппированные по языкам
   */
  groupDocumentsByLanguage(documents) {
    const grouped = {};
    
    for (const doc of documents) {
      const lang = doc.metadata.language;
      if (!grouped[lang]) {
        grouped[lang] = [];
      }
      grouped[lang].push(doc);
    }
    
    return grouped;
  }

  /**
   * Обработка и загрузка документов в векторную базу
   * @param {KnowledgeDocument[]} documents - Документы для обработки
   * @returns {Promise<number>} Количество обработанных документов
   */
  async processDocuments(documents) {
    let processed = 0;
    
    for (const doc of documents) {
      try {
        logger.info(`Processing ${doc.path}...`);
        
        // Создание чанков
        const processedResult = await this.textProcessor.createChunks(
          doc.content,
          doc.metadata
        );
        
        // Подготовка векторных документов
        const vectorDocuments = processedResult.chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.text,
          metadata: chunk.metadata
        }));
        
        // Добавление в векторную базу
        const addResult = await this.vectorStore.addDocuments(vectorDocuments);
        
        this.stats.processedFiles++;
        this.stats.totalChunks += processedResult.chunks.length;
        processed++;
        
        logger.info(`Successfully processed ${doc.path}: ${processedResult.chunks.length} chunks created`);
      } catch (error) {
        logger.error(`Error processing ${doc.path}: ${error.message}`);
        this.stats.errors.push({
          file: doc.path,
          error: error.message
        });
      }
    }
    
    return processed;
  }

  /**
   * Вывод статистики загрузки
   */
  printStatistics() {
    console.log('\n=== Knowledge Base Loading Statistics ===');
    console.log(`Total files found: ${this.stats.totalFiles}`);
    console.log(`Successfully processed: ${this.stats.processedFiles}`);
    console.log(`Total chunks created: ${this.stats.totalChunks}`);
    console.log(`Errors: ${this.stats.errors.length}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\nErrors:');
      for (const error of this.stats.errors) {
        console.log(`  - ${error.file}: ${error.error}`);
      }
    }
    
    console.log('\n=== Loading Summary ===');
    const successRate = (this.stats.processedFiles / this.stats.totalFiles * 100).toFixed(2);
    console.log(`Success rate: ${successRate}%`);
    console.log(`Average chunks per document: ${(this.stats.totalChunks / this.stats.processedFiles).toFixed(2)}`);
  }

  /**
   * Создание базовой структуры директорий
   * @returns {Promise<void>}
   */
  async createBaseStructure() {
    const categories = [
      'general',
      'user-guide',
      'tokenomics',
      'technical',
      'troubleshooting'
    ];
    
    const languages = ['en', 'es', 'ru'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.baseKnowledgePath, category);
      
      try {
        await fs.mkdir(categoryPath, { recursive: true });
        
        // Создание поддиректорий для языков в некоторых категориях
        if (category === 'user-guide' || category === 'general') {
          for (const lang of languages) {
            const langPath = path.join(categoryPath, lang);
            await fs.mkdir(langPath, { recursive: true });
          }
        }
      } catch (error) {
        logger.warn(`Failed to create directory ${categoryPath}: ${error.message}`);
      }
    }
    
    logger.info('Base directory structure created');
  }
}

// Функция для создания примеров документов
async function createExampleDocuments() {
  const loader = new KnowledgeLoader();
  await loader.createBaseStructure();
  
  // Создание примера документа о проекте
  const aboutProjectContent = `# О проекте Shrooms

## Концепция

"Shrooms" - это Web3-платформа на блокчейне Stacks с мемной грибной тематикой. Проект представляет собой пародию на крупные криптовалютные сообщества, сочетая технические возможности Web3 с юмористической грибной эстетикой.

## Ключевые особенности

- Интеграция с Xverse и Hiro Wallet
- Токен SHROOMS с механизмом фарминга
- Мультиязычная поддержка (EN, ES, RU)
- Адаптивный дизайн для мобильных устройств

## Токеномика

Общее предложение: 100,000,000 SHROOMS

Распределение:
- 40% для фарминга и стейкинга
- 25% для команды
- 20% для инвесторов
- 15% для маркетинга и партнерств

Для получения более подробной информации о токеномике, ознакомьтесь с техническим документом.
`;
  
  const examplePath = path.join(loader.baseKnowledgePath, 'general', 'about-project.md');
  await fs.writeFile(examplePath, aboutProjectContent, 'utf8');
  
  // Создание примера FAQ
  const faqContent = `# Часто задаваемые вопросы

## Как подключить кошелек?

1. Нажмите кнопку "Connect Wallet" в правом верхнем углу
2. Выберите Xverse или Hiro Wallet
3. Подтвердите подключение в всплывающем окне
4. Подпишите сообщение для верификации

## Как получить токены SHROOMS?

Токены SHROOMS можно получить через:
- Фарминг ликвидности в пулах STX-SHROOMS
- Покупку на децентрализованных биржах
- Участие в ивентах сообщества

## Что такое фарминг?

Фарминг - это процесс предоставления ликвидности в обмен на вознаграждения в токенах SHROOMS. Текущая доходность составляет примерно 12.5% годовых.
`;
  
  const faqPath = path.join(loader.baseKnowledgePath, 'general', 'ru', 'faq.md');
  await fs.writeFile(faqPath, faqContent, 'utf8');
  
  logger.info('Example documents created');
}

// Выполнение скрипта
async function main() {
  try {
    // Проверка переменных окружения
    if (!process.env.VECTOR_DB_URL) {
      logger.error('VECTOR_DB_URL environment variable is required');
      process.exit(1);
    }
    
    if (!process.env.VOYAGE_API_KEY && !process.env.OPENAI_API_KEY) {
      logger.error('Either VOYAGE_API_KEY or OPENAI_API_KEY is required');
      process.exit(1);
    }
    
    // Создание структуры и примеров (если директория пуста)
    const loader = new KnowledgeLoader();
    try {
      await fs.access(loader.baseKnowledgePath);
      const files = await fs.readdir(loader.baseKnowledgePath);
      if (files.length === 0) {
        logger.info('Knowledge directory is empty. Creating examples...');
        await createExampleDocuments();
      }
    } catch (error) {
      logger.info('Creating initial directory structure...');
      await createExampleDocuments();
    }
    
    // Загрузка базы знаний
    await loader.loadKnowledgeBase();
  } catch (error) {
    logger.error(`Script failed: ${error.message}`);
    process.exit(1);
  }
}

// Запуск скрипта, если файл выполняется напрямую
if (require.main === module) {
  main();
}

module.exports = KnowledgeLoader;