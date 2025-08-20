/**
 * @fileoverview API для управления каталогом разборов книг Анны Бусел
 * @description CRUD операции для BookCatalog модели
 * @author Reader Bot Team
 */

const express = require('express');
const BookCatalog = require('../models/BookCatalog');
const { adminAuth } = require('../middleware/adminAuth');
const logger = require('../utils/logger');
const { normalizeCategoriesInput } = require('../utils/categoryMapper');

const router = express.Router();

/**
 * @typedef {Object} BookCatalogRequest
 * @property {string} title - Название книги/курса
 * @property {string} [author] - Автор книги
 * @property {string} description - Описание разбора
 * @property {string} price - Цена в формате "$X"
 * @property {string[]} categories - Категории
 * @property {string[]} targetThemes - Целевые темы
 * @property {string} bookSlug - Идентификатор для UTM
 * @property {boolean} [isActive] - Активность
 * @property {number} [priority] - Приоритет (1-10)
 * @property {string} reasoning - Причина рекомендации
 */

/**
 * GET /api/reader/bookCatalog
 * Получить список книг в каталоге
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      isActive,
      search,
      sortBy = 'priority',
      sortOrder = 'desc'
    } = req.query;

    // Строим фильтр
    const filter = {};
    
    if (category) {
      filter.categories = category;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } }
      ];
    }

    // Строим сортировку
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Выполняем запрос с пагинацией
    const [books, total] = await Promise.all([
      BookCatalog.find(filter)
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      BookCatalog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: books,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching book catalog:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения каталога книг',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/bookCatalog/stats
 * Получить статистику каталога
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await BookCatalog.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching book catalog stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики каталога',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/bookCatalog/recommendations
 * Получить рекомендации по темам
 */
router.get('/recommendations', async (req, res) => {
  try {
    const { themes, limit = 2 } = req.query;
    
    let recommendations;
    
    if (themes) {
      const themesArray = Array.isArray(themes) ? themes : [themes];
      recommendations = await BookCatalog.getRecommendationsByThemes(themesArray, Number(limit));
    } else {
      recommendations = await BookCatalog.getUniversalRecommendations(Number(limit));
    }

    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    logger.error('Error fetching book recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения рекомендаций',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/bookCatalog/:id
 * Получить книгу по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const book = await BookCatalog.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Книга не найдена'
      });
    }

    res.json({
      success: true,
      data: book
    });

  } catch (error) {
    logger.error('Error fetching book:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения книги',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/bookCatalog/slug/:slug
 * Получить книгу по slug
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const book = await BookCatalog.getBySlug(req.params.slug);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Книга не найдена'
      });
    }

    res.json({
      success: true,
      data: book
    });

  } catch (error) {
    logger.error('Error fetching book by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения книги',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/bookCatalog
 * Создать новую книгу в каталоге
 */
router.post('/', adminAuth, async (req, res) => {
  try {
    const bookData = req.body;
    
    // Normalize categories before validation
    bookData.categories = normalizeCategoriesInput(bookData);
    
    // Валидация обязательных полей
    const requiredFields = ['title', 'description', 'price', 'categories', 'bookSlug', 'reasoning'];
    for (const field of requiredFields) {
      if (!bookData[field]) {
        return res.status(400).json({
          success: false,
          message: `Поле ${field} обязательно для заполнения`
        });
      }
    }

    // Проверяем уникальность slug
    const existingBook = await BookCatalog.findOne({ bookSlug: bookData.bookSlug });
    if (existingBook) {
      return res.status(400).json({
        success: false,
        message: 'Книга с таким slug уже существует'
      });
    }

    const book = new BookCatalog(bookData);
    await book.save();

    logger.info(`📚 Created book catalog entry: ${book.title} (${book.bookSlug})`);

    res.status(201).json({
      success: true,
      data: book,
      message: 'Книга успешно добавлена в каталог'
    });

  } catch (error) {
    logger.error('Error creating book catalog entry:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка создания записи в каталоге',
      error: error.message
    });
  }
});

/**
 * PUT /api/reader/bookCatalog/:id
 * Обновить книгу в каталоге
 */
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const bookData = req.body;
    
    // Normalize categories if provided
    if (bookData.categories || bookData.category || bookData.theme || bookData.targetThemes) {
      bookData.categories = normalizeCategoriesInput(bookData);
    }
    
    // Если обновляется slug, проверяем уникальность
    if (bookData.bookSlug) {
      const existingBook = await BookCatalog.findOne({ 
        bookSlug: bookData.bookSlug,
        _id: { $ne: req.params.id }
      });
      
      if (existingBook) {
        return res.status(400).json({
          success: false,
          message: 'Книга с таким slug уже существует'
        });
      }
    }

    const book = await BookCatalog.findByIdAndUpdate(
      req.params.id,
      bookData,
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Книга не найдена'
      });
    }

    logger.info(`📚 Updated book catalog entry: ${book.title} (${book.bookSlug})`);

    res.json({
      success: true,
      data: book,
      message: 'Книга успешно обновлена'
    });

  } catch (error) {
    logger.error('Error updating book catalog entry:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка обновления записи в каталоге',
      error: error.message
    });
  }
});

/**
 * PATCH /api/reader/bookCatalog/:id/toggle
 * Переключить активность книги
 */
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const book = await BookCatalog.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Книга не найдена'
      });
    }

    book.isActive = !book.isActive;
    await book.save();

    logger.info(`📚 Toggled book status: ${book.title} -> ${book.isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      data: book,
      message: `Книга ${book.isActive ? 'активирована' : 'деактивирована'}`
    });

  } catch (error) {
    logger.error('Error toggling book status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка изменения статуса книги',
      error: error.message
    });
  }
});

/**
 * DELETE /api/reader/bookCatalog/:id
 * Удалить книгу из каталога
 */
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const book = await BookCatalog.findByIdAndDelete(req.params.id);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Книга не найдена'
      });
    }

    logger.info(`📚 Deleted book catalog entry: ${book.title} (${book.bookSlug})`);

    res.json({
      success: true,
      message: 'Книга успешно удалена из каталога'
    });

  } catch (error) {
    logger.error('Error deleting book catalog entry:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления записи из каталога',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/bookCatalog/import
 * Импортировать книги из JSON
 */
router.post('/import', adminAuth, async (req, res) => {
  try {
    const { books } = req.body;
    
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Массив книг не предоставлен'
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const bookData of books) {
      try {
        const existingBook = await BookCatalog.findOne({ bookSlug: bookData.bookSlug });
        
        if (existingBook) {
          await BookCatalog.findByIdAndUpdate(existingBook._id, bookData);
          results.updated++;
        } else {
          const book = new BookCatalog(bookData);
          await book.save();
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          book: bookData.title || 'Unknown',
          error: error.message
        });
      }
    }

    logger.info(`📚 Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      success: true,
      data: results,
      message: `Импорт завершен: создано ${results.created}, обновлено ${results.updated}`
    });

  } catch (error) {
    logger.error('Error importing books:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка импорта книг',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/bookCatalog/export
 * Экспортировать книги в JSON
 */
router.get('/export', adminAuth, async (req, res) => {
  try {
    const books = await BookCatalog.find({});
    
    res.json({
      success: true,
      data: books,
      count: books.length
    });

  } catch (error) {
    logger.error('Error exporting books:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка экспорта книг',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/bookCatalog/import-from-knowledge/:id
 * Импортировать каталог из документа Knowledge
 */
router.post('/import-from-knowledge/:id', adminAuth, async (req, res) => {
  try {
    const knowledgeId = req.params.id;
    
    // Загружаем документ Knowledge
    const KnowledgeDocument = require('../models/knowledge');
    const knowledgeDoc = await KnowledgeDocument.findById(knowledgeId);
    
    if (!knowledgeDoc) {
      return res.status(404).json({
        success: false,
        message: 'Документ Knowledge не найден'
      });
    }
    
    // Парсим содержимое как pipe-separated таблицу
    const content = knowledgeDoc.content;
    const lines = content.split('\n');
    
    const results = {
      created: 0,
      updated: 0,
      errors: []
    };
    
    // Получаем курс конвертации из env переменных
    const BYN_TO_RUB = parseFloat(process.env.BYN_TO_RUB) || 30;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Пропускаем пустые строки
      if (!trimmedLine) continue;
      
      // Проверяем, начинается ли строка с номера и пайпа (новая строка таблицы)
      if (!/^\s*\d+\s*\|/.test(trimmedLine)) continue;
      
      try {
        // Разбиваем по пайпам
        const columns = trimmedLine.split('|').map(col => col.trim());
        
        if (columns.length < 6) {
          results.errors.push({
            line: trimmedLine,
            error: 'Недостаточно колонок в строке'
          });
          continue;
        }
        
        // Извлекаем поля: № | Название | Автор | Цена BYN | Ссылка | Описание | Темы | ...
        const [, title, author, priceBynStr, url, description, themes] = columns;
        
        if (!title || !priceBynStr) {
          results.errors.push({
            line: trimmedLine,
            error: 'Отсутствуют обязательные поля: название или цена'
          });
          continue;
        }
        
        // Парсим цену (поддерживаем запятую и точку как десятичный разделитель)
        const priceByn = parseFloat(priceBynStr.replace(',', '.'));
        if (isNaN(priceByn) || priceByn < 0) {
          results.errors.push({
            book: title,
            error: 'Некорректная цена BYN'
          });
          continue;
        }
        
        // Вычисляем цену в рублях
        const priceRub = Math.round(priceByn * BYN_TO_RUB);
        
        // Извлекаем bookSlug из URL или создаем из заголовка
        let bookSlug;
        if (url && url.trim()) {
          const urlParts = url.trim().split('/');
          bookSlug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
          bookSlug = bookSlug.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
        }
        
        if (!bookSlug || bookSlug.length < 2) {
          // Fallback: создаем slug из заголовка
          bookSlug = title.toLowerCase()
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
            .replace(/-+/g, '-')  // Replace multiple dashes with single dash
            .replace(/^-|-$/g, '') // Remove leading/trailing dashes
            .substring(0, 50);
        }
        
        // Нормализуем категории
        const { mapThemesToCategory } = require('../utils/categoryMapper');
        const category = mapThemesToCategory(themes || '');
        
        // Разбиваем темы на массив
        const targetThemes = themes ? themes.split(',').map(theme => theme.trim()) : [];
        
        // Подготавливаем данные книги
        const bookData = {
          title: title.trim(),
          author: author ? author.trim() : null,
          description: description ? description.trim() : '',
          price: '$10', // legacy поле для обратной совместимости
          priceRub,
          priceByn,
          categories: [category],
          targetThemes,
          bookSlug,
          reasoning: `Разбор "${title.trim()}" поможет глубже понять основные идеи и применить их в жизни.`
        };
        
        // Проверяем, существует ли книга с таким slug
        const existingBook = await BookCatalog.findOne({ bookSlug });
        
        if (existingBook) {
          // Обновляем существующую книгу
          await BookCatalog.findByIdAndUpdate(
            existingBook._id, 
            bookData, 
            { runValidators: true }
          );
          results.updated++;
        } else {
          // Создаем новую книгу
          const book = new BookCatalog(bookData);
          await book.save();
          results.created++;
        }
        
      } catch (error) {
        results.errors.push({
          line: trimmedLine,
          error: error.message
        });
      }
    }
    
    logger.info(`📚 Knowledge import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);
    
    res.json({
      success: true,
      data: results,
      message: `Импорт завершен: создано ${results.created}, обновлено ${results.updated}`
    });
    
  } catch (error) {
    logger.error('Error importing from knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка импорта из Knowledge',
      error: error.message
    });
  }
});

module.exports = router;