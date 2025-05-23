/**
 * Prompts API Routes - Управление промптами для Shrooms AI Support Bot
 * @file server/api/prompts.js
 */

const express = require('express');
const router = express.Router();
const Prompt = require('../models/prompt');
const claude = require('../services/claude');
const logger = require('../utils/logger');
const { requireAdminAuth } = require('../middleware/adminAuth');

// Middleware для UTF-8 кодировки
router.use((req, res, next) => {
  res.charset = 'utf-8';
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * @route GET /api/prompts
 * @desc Получить список промптов с фильтрацией
 * @access Private (Admin only)
 * @param {string} [category] - Фильтр по категории
 * @param {string} [type] - Фильтр по типу
 * @param {string} [language] - Фильтр по языку
 * @param {boolean} [activeOnly=true] - Только активные промпты
 * @param {number} [page=1] - Номер страницы
 * @param {number} [limit=20] - Результатов на странице
 */
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      category,
      type,
      language,
      activeOnly = 'true',
      page = 1,
      limit = 20
    } = req.query;

    // Построение запроса
    const query = {};
    if (category) query.category = category;
    if (type) query.type = type;
    if (language && language !== 'all') query.language = { $in: [language, 'all'] };
    if (activeOnly === 'true') query.active = true;

    // Подсчет общего количества
    const totalCount = await Prompt.countDocuments(query);
    
    // Получение промптов с пагинацией
    const prompts = await Prompt.find(query)
      .sort({ isDefault: -1, type: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Форматирование для фронтенда
    const formattedPrompts = prompts.map(prompt => prompt.toPublicJSON());

    res.json({
      success: true,
      data: formattedPrompts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

    logger.info(`Prompts retrieved: ${formattedPrompts.length}/${totalCount} by ${req.admin.username}`);
  } catch (error) {
    logger.error(`Error retrieving prompts: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить список промптов',
      errorCode: 'RETRIEVAL_ERROR'
    });
  }
});

/**
 * @route GET /api/prompts/search
 * @desc Поиск промптов по тексту
 * @access Private (Admin only)
 * @param {string} q - Поисковый запрос
 * @param {string} [category] - Фильтр по категории
 * @param {string} [type] - Фильтр по типу
 * @param {string} [language] - Фильтр по языку
 * @param {number} [page=1] - Номер страницы
 * @param {number} [limit=10] - Результатов на странице
 */
router.get('/search', requireAdminAuth, async (req, res) => {
  try {
    const {
      q: searchQuery,
      category,
      type,
      language,
      page = 1,
      limit = 10
    } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Поисковый запрос обязателен',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    const prompts = await Prompt.searchText(searchQuery, {
      category,
      type,
      language,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    const formattedPrompts = prompts.map(prompt => prompt.toPublicJSON());

    res.json({
      success: true,
      data: formattedPrompts,
      query: searchQuery,
      count: formattedPrompts.length
    });

    logger.info(`Prompt search performed: "${searchQuery}" - ${formattedPrompts.length} results by ${req.admin.username}`);
  } catch (error) {
    logger.error(`Error searching prompts: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Поиск промптов не удался',
      errorCode: 'SEARCH_ERROR'
    });
  }
});

/**
 * @route GET /api/prompts/stats
 * @desc Получить статистику промптов
 * @access Private (Admin only)
 */
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await Prompt.getStats();
    
    res.json({
      success: true,
      data: stats
    });

    logger.info(`Prompt statistics retrieved by ${req.admin.username}`);
  } catch (error) {
    logger.error(`Error retrieving prompt statistics: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить статистику',
      errorCode: 'STATS_ERROR'
    });
  }
});

/**
 * @route POST /api/prompts/test
 * @desc Тестировать промпт с Claude API
 * @access Private (Admin only)
 * @body {string} prompt - Промпт для тестирования
 * @body {string} testMessage - Тестовое сообщение
 * @body {string} [language=en] - Язык тестирования
 */
router.post('/test', requireAdminAuth, async (req, res) => {
  try {
    const { prompt, testMessage, language = 'en' } = req.body;

    if (!prompt || !testMessage) {
      return res.status(400).json({
        success: false,
        error: 'Промпт и тестовое сообщение обязательны',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      });
    }

    logger.info(`Testing prompt with Claude API by ${req.admin.username}`);

    // Тестируем промпт через Claude
    const testResult = await claude.testPrompt(prompt, testMessage, { language });

    res.json({
      success: true,
      data: {
        input: testMessage,
        output: testResult.message,
        tokensUsed: testResult.tokensUsed,
        provider: testResult.provider,
        testedAt: new Date().toISOString(),
        successful: true
      }
    });

    logger.info(`Prompt test completed successfully by ${req.admin.username}`);
  } catch (error) {
    logger.error(`Error testing prompt: ${error.message}`);
    
    // Возвращаем результат тестирования даже если произошла ошибка
    res.json({
      success: false,
      data: {
        input: req.body.testMessage,
        output: null,
        error: error.message,
        testedAt: new Date().toISOString(),
        successful: false
      },
      error: 'Ошибка при тестировании промпта',
      errorCode: 'TEST_ERROR'
    });
  }
});

/**
 * @route GET /api/prompts/backup
 * @desc Экспорт всех промптов в JSON
 * @access Private (Admin only)
 */
router.get('/backup', requireAdminAuth, async (req, res) => {
  try {
    const prompts = await Prompt.find().sort({ type: 1, language: 1, name: 1 });
    
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.admin.username,
      count: prompts.length,
      prompts: prompts.map(prompt => prompt.toPublicJSON())
    };

    res.setHeader('Content-Disposition', `attachment; filename="shrooms-prompts-backup-${Date.now()}.json"`);
    res.json(backup);

    logger.info(`Prompts backup exported: ${prompts.length} prompts by ${req.admin.username}`);
  } catch (error) {
    logger.error(`Error exporting prompts: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Не удалось экспортировать промпты',
      errorCode: 'EXPORT_ERROR'
    });
  }
});

/**
 * @route POST /api/prompts/restore
 * @desc Импорт промптов из JSON
 * @access Private (Admin only)
 * @body {Object} backup - Бэкап промптов
 */
router.post('/restore', requireAdminAuth, async (req, res) => {
  try {
    const { backup } = req.body;

    if (!backup || !backup.prompts || !Array.isArray(backup.prompts)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный формат бэкапа',
        errorCode: 'INVALID_BACKUP_FORMAT'
      });
    }

    let importedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const promptData of backup.prompts) {
      try {
        // Проверяем, существует ли промпт с таким именем
        const existingPrompt = await Prompt.findOne({ name: promptData.name });
        
        if (existingPrompt && existingPrompt.isDefault) {
          // Не перезаписываем системные промпты
          continue;
        }

        if (existingPrompt) {
          // Обновляем существующий промпт
          Object.assign(existingPrompt, promptData);
          await existingPrompt.save();
        } else {
          // Создаем новый промпт
          const newPrompt = new Prompt({
            ...promptData,
            authorId: req.admin.id,
            isDefault: false // Импортированные промпты не могут быть системными
          });
          await newPrompt.save();
        }
        
        importedCount++;
      } catch (promptError) {
        errorCount++;
        errors.push({
          prompt: promptData.name,
          error: promptError.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        total: backup.prompts.length,
        imported: importedCount,
        errors: errorCount,
        errorDetails: errors
      },
      message: `Импортировано ${importedCount} промптов из ${backup.prompts.length}`
    });

    logger.info(`Prompts restore completed: ${importedCount}/${backup.prompts.length} by ${req.admin.username}`);
  } catch (error) {
    logger.error(`Error restoring prompts: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Не удалось импортировать промпты',
      errorCode: 'IMPORT_ERROR'
    });
  }
});

/**
 * @route GET /api/prompts/:id
 * @desc Получить конкретный промпт
 * @access Private (Admin only)
 * @param {string} id - ID промпта
 */
router.get('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const prompt = await Prompt.findById(id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Промпт не найден',
        errorCode: 'PROMPT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: prompt.toPublicJSON()
    });

    logger.info(`Prompt retrieved: ${id} by ${req.admin.username}`);
  } catch (error) {
    logger.error(`Error retrieving prompt: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID промпта',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Не удалось получить промпт',
      errorCode: 'RETRIEVAL_ERROR'
    });
  }
});

/**
 * @route POST /api/prompts
 * @desc Создать новый промпт
 * @access Private (Admin only)
 * @body {string} name - Название промпта
 * @body {string} type - Тип промпта
 * @body {string} category - Категория
 * @body {string} language - Язык
 * @body {string} content - Содержимое промпта
 * @body {string} [description] - Описание
 * @body {number} [maxTokens=1000] - Максимум токенов
 * @body {string[]} [tags] - Теги
 */
router.post('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      name,
      type,
      category,
      language,
      content,
      description,
      maxTokens = 1000,
      tags = []
    } = req.body;

    // Валидация обязательных полей
    if (!name || !type || !category || !language || !content) {
      return res.status(400).json({
        success: false,
        error: 'Название, тип, категория, язык и содержимое обязательны',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Проверка уникальности названия
    const existingPrompt = await Prompt.findOne({ name: name.trim() });
    if (existingPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Промпт с таким названием уже существует',
        errorCode: 'DUPLICATE_NAME'
      });
    }

    const prompt = new Prompt({
      name: name.trim(),
      type,
      category,
      language,
      content: content.trim(),
      description: description?.trim(),
      maxTokens: parseInt(maxTokens),
      tags: Array.isArray(tags) ? tags : [],
      authorId: req.admin.id,
      isDefault: false // Пользовательские промпты не могут быть системными
    });

    await prompt.save();

    res.status(201).json({
      success: true,
      data: prompt.toPublicJSON(),
      message: 'Промпт успешно создан'
    });

    logger.info(`Prompt created by ${req.admin.username}: ${prompt._id} - "${name}"`);
  } catch (error) {
    logger.error(`Error creating prompt: ${error.message}`);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: Object.values(error.errors).map(err => err.message),
        errorCode: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Не удалось создать промпт',
      errorCode: 'CREATION_ERROR'
    });
  }
});

/**
 * @route PUT /api/prompts/:id
 * @desc Обновить промпт
 * @access Private (Admin only)
 * @param {string} id - ID промпта
 * @body Поля для обновления
 */
router.put('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Удаляем поля, которые нельзя обновлять
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.metadata;

    const prompt = await Prompt.findById(id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Промпт не найден',
        errorCode: 'PROMPT_NOT_FOUND'
      });
    }

    // Системные промпты можно редактировать только частично
    if (prompt.isDefault) {
      // Разрешаем изменять только активность и максимум токенов
      const allowedFields = ['active', 'maxTokens'];
      Object.keys(updateData).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
    }

    // Проверка уникальности названия при изменении
    if (updateData.name && updateData.name !== prompt.name) {
      const existingPrompt = await Prompt.findOne({ 
        name: updateData.name.trim(),
        _id: { $ne: id }
      });
      
      if (existingPrompt) {
        return res.status(400).json({
          success: false,
          error: 'Промпт с таким названием уже существует',
          errorCode: 'DUPLICATE_NAME'
        });
      }
    }

    // Применяем обновления
    Object.assign(prompt, updateData);
    await prompt.save();

    res.json({
      success: true,
      data: prompt.toPublicJSON(),
      message: 'Промпт успешно обновлен'
    });

    logger.info(`Prompt updated by ${req.admin.username}: ${id}`);
  } catch (error) {
    logger.error(`Error updating prompt: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID промпта',
        errorCode: 'INVALID_ID'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: Object.values(error.errors).map(err => err.message),
        errorCode: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Не удалось обновить промпт',
      errorCode: 'UPDATE_ERROR'
    });
  }
});

/**
 * @route DELETE /api/prompts/:id
 * @desc Удалить промпт
 * @access Private (Admin only)
 * @param {string} id - ID промпта
 */
router.delete('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const prompt = await Prompt.findById(id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Промпт не найден',
        errorCode: 'PROMPT_NOT_FOUND'
      });
    }

    // Защита от удаления системных промптов
    if (prompt.isDefault) {
      return res.status(403).json({
        success: false,
        error: 'Системные промпты не могут быть удалены',
        errorCode: 'SYSTEM_PROMPT_PROTECTED'
      });
    }

    await prompt.deleteOne();

    res.json({
      success: true,
      message: 'Промпт успешно удален'
    });

    logger.info(`Prompt deleted by ${req.admin.username}: ${id} - "${prompt.name}"`);
  } catch (error) {
    logger.error(`Error deleting prompt: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID промпта',
        errorCode: 'INVALID_ID'
      });
    }

    if (error.code === 'SYSTEM_PROMPT_PROTECTED') {
      return res.status(403).json({
        success: false,
        error: error.message,
        errorCode: 'SYSTEM_PROMPT_PROTECTED'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Не удалось удалить промпт',
      errorCode: 'DELETION_ERROR'
    });
  }
});

module.exports = router;