/**
 * Prompts API Routes - Управление промптами для Reader Bot
 * @file server/api/prompts.js
 * 🔧 ИСПРАВЛЕНО: Обновлена логика под новые поля модели промптов
 */

const express = require('express');
const router = express.Router();
const Prompt = require('../models/prompt');
const claude = require('../services/claude');
const promptService = require('../services/promptService');
const logger = require('../utils/logger');

// Middleware для UTF-8 кодировки
router.use((req, res, next) => {
  res.charset = 'utf-8';
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * @route GET /api/reader/prompts
 * @desc Получить список промптов с фильтрацией
 * @access Public
 * @param {string} [category] - Фильтр по категории
 * @param {string} [type] - Фильтр по типу
 * @param {string} [language] - Фильтр по языку
 * @param {string} [status] - Фильтр по статусу (active, draft, archived)
 * @param {string} [q] - Поисковый запрос
 * @param {number} [page=1] - Номер страницы
 * @param {number} [limit=20] - Результатов на странице
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      type,
      language,
      status,
      q: searchQuery,
      page = 1,
      limit = 20
    } = req.query;

    // Построение запроса
    const query = {};
    if (category) query.category = category;
    if (type) query.type = type;
    if (language && language !== 'all') query.language = { $in: [language, 'none'] };
    if (status && status !== 'all') query.status = status;

    let prompts;
    let totalCount;

    // Если есть поисковый запрос - используем текстовый поиск
    if (searchQuery && searchQuery.trim()) {
      const searchOptions = {
        category,
        type,
        language,
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      };
      
      prompts = await Prompt.searchText(searchQuery.trim(), searchOptions);
      // Для поиска считаем общее количество через отдельный запрос
      totalCount = await Prompt.countDocuments({
        ...query,
        $text: { $search: searchQuery.trim() }
      });
    } else {
      // Обычный запрос с фильтрами
      totalCount = await Prompt.countDocuments(query);
      
      prompts = await Prompt.find(query)
        .sort({ isDefault: -1, priority: 1, type: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
    }

    // Форматирование для фронтенда
    const formattedPrompts = prompts.map(prompt => prompt.toPublicJSON());

    res.json({
      success: true,
      data: formattedPrompts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalDocs: totalCount,
        limit: parseInt(limit),
        startDoc: ((page - 1) * limit) + 1,
        endDoc: Math.min(page * limit, totalCount)
      }
    });

    logger.info(`Prompts retrieved: ${formattedPrompts.length}/${totalCount}`);
  } catch (error) {
    logger.error(`Error retrieving prompts: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить список промптов',
      errorCode: 'RETRIEVAL_ERROR'
    });
  }
});

/**
 * @route GET /api/reader/prompts/stats
 * @desc Получить статистику промптов для Reader Bot
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    // Используем обновленный метод для Reader Bot
    const stats = await Prompt.getReaderStats();
    
    res.json({
      success: true,
      data: stats
    });

    logger.info(`Reader prompt statistics retrieved`);
  } catch (error) {
    logger.error(`Error retrieving prompt statistics: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить статистику',
      errorCode: 'STATS_ERROR'
    });
  }
});

/**
 * @route POST /api/reader/prompts/test
 * @desc Тестировать промпт с переменными
 * @access Public
 * @body {string} promptId - ID промпта для тестирования
 * @body {Object} variables - Переменные для подстановки
 */
router.post('/test', async (req, res) => {
  try {
    const { promptId, variables = {} } = req.body;

    if (!promptId) {
      return res.status(400).json({
        success: false,
        error: 'ID промпта обязателен',
        errorCode: 'MISSING_PROMPT_ID'
      });
    }

    // Получаем промпт
    const prompt = await Prompt.findById(promptId);
    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Промпт не найден',
        errorCode: 'PROMPT_NOT_FOUND'
      });
    }

    logger.info(`Testing prompt: ${prompt.name}`);

    // Подставляем переменные в промпт
    let processedPrompt = prompt.content;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      processedPrompt = processedPrompt.replace(regex, value);
    });

    // Тестируем через Claude
    const startTime = Date.now();
    const testResult = await claude.generateResponse(processedPrompt, {
      platform: 'test',
      userId: 'test_user'
    });
    const executionTime = Date.now() - startTime;

    // Сохраняем результат тестирования
    await prompt.addTestResult({
      input: processedPrompt,
      output: testResult.message,
      tokensUsed: testResult.tokensUsed || 0,
      successful: true
    });

    res.json({
      success: true,
      data: {
        promptName: prompt.name,
        processedPrompt,
        result: testResult.message,
        tokensUsed: testResult.tokensUsed,
        executionTime: `${executionTime}ms`,
        variables
      }
    });

    logger.info(`Prompt test completed: ${prompt.name} - ${executionTime}ms`);
  } catch (error) {
    logger.error(`Error testing prompt: ${error.message}`, error);
    
    // Сохраняем результат с ошибкой
    if (req.body.promptId) {
      try {
        const prompt = await Prompt.findById(req.body.promptId);
        if (prompt) {
          await prompt.addTestResult({
            input: req.body.variables || {},
            output: null,
            error: error.message,
            successful: false
          });
        }
      } catch (saveError) {
        logger.error(`Error saving test result: ${saveError.message}`);
      }
    }
    
    res.json({
      success: false,
      data: {
        error: error.message,
        variables: req.body.variables || {}
      },
      error: 'Ошибка при тестировании промпта',
      errorCode: 'TEST_ERROR'
    });
  }
});

/**
 * @route POST /api/reader/prompts
 * @desc Создать новый промпт Reader Bot
 * @access Public
 * @body {string} name - Название промпта
 * @body {string} category - Категория (onboarding, quote_analysis, etc.)
 * @body {string} language - Язык (ru, en, none)
 * @body {string} content - Содержимое промпта
 * @body {string[]} [variables] - Переменные
 * @body {string} [status=active] - Статус
 * @body {string} [priority=normal] - Приоритет
 * @body {string} [description] - Описание
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      category,
      language = 'ru',
      content,
      variables = [],
      status = 'active',
      priority = 'normal',
      description = ''
    } = req.body;

    // Валидация обязательных полей
    if (!name || !category || !content) {
      return res.status(400).json({
        success: false,
        error: 'Название, категория и содержимое обязательны',
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

    // Определяем тип на основе категории
    const typeMapping = {
      'onboarding': 'reader_onboarding',
      'quote_analysis': 'reader_analysis',
      'weekly_reports': 'reader_reports',
      'monthly_reports': 'reader_reports',
      'book_recommendations': 'reader_recommendations',
      'user_interaction': 'basic',
      'system': 'basic',
      'other': 'basic'
    };

    const promptData = {
      name: name.trim(),
      type: typeMapping[category] || 'basic',
      category,
      language,
      content: content.trim(),
      variables: Array.isArray(variables) ? variables : [],
      status,
      priority,
      description: description.trim(),
      authorId: 'admin',
      isDefault: false
    };

    // Создаем промпт
    const newPrompt = new Prompt(promptData);
    await newPrompt.save();

    res.status(201).json({
      success: true,
      data: newPrompt.toPublicJSON(),
      message: 'Промпт успешно создан'
    });

    logger.info(`Prompt created: ${newPrompt._id} - "${name}"`);
  } catch (error) {
    logger.error(`Error creating prompt: ${error.message}`, error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации данных',
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
 * @route GET /api/reader/prompts/:id
 * @desc Получить конкретный промпт
 * @access Public
 * @param {string} id - ID промпта
 */
router.get('/:id', async (req, res) => {
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

    logger.info(`Prompt retrieved: ${id}`);
  } catch (error) {
    logger.error(`Error retrieving prompt: ${error.message}`, error);
    
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
 * @route PUT /api/reader/prompts/:id
 * @desc Обновить промпт
 * @access Public
 * @param {string} id - ID промпта
 * @body Поля для обновления
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Удаляем поля, которые нельзя обновлять
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.metadata;
    delete updateData.isDefault; // Защита системных промптов

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
      const allowedFields = ['status', 'maxTokens', 'priority'];
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

    // Обновляем тип на основе категории, если категория изменилась
    if (updateData.category && updateData.category !== prompt.category) {
      const typeMapping = {
        'onboarding': 'reader_onboarding',
        'quote_analysis': 'quoute_analysis',
        'weekly_reports': 'weekly_reports',
        'monthly_reports': 'monthly_reports',
        'book_recommendations': 'book_recommendations',
        'user_interaction': 'basic',
        'system': 'basic',
        'other': 'basic'
      };
      updateData.type = typeMapping[updateData.category] || 'basic';
    }

    // Обновляем промпт
    const updatedPrompt = await Prompt.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedPrompt.toPublicJSON(),
      message: 'Промпт успешно обновлен'
    });

    logger.info(`Prompt updated: ${id}`);
  } catch (error) {
    logger.error(`Error updating prompt: ${error.message}`, error);
    
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
 * @route DELETE /api/reader/prompts/:id
 * @desc Удалить промпт
 * @access Public
 * @param {string} id - ID промпта
 */
router.delete('/:id', async (req, res) => {
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

    await Prompt.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Промпт успешно удален'
    });

    logger.info(`Prompt deleted: ${id} - "${prompt.name}"`);
  } catch (error) {
    logger.error(`Error deleting prompt: ${error.message}`, error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID промпта',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Не удалось удалить промпт',
      errorCode: 'DELETION_ERROR'
    });
  }
});

/**
 * @route GET /api/reader/prompts/export
 * @desc Экспорт всех промптов в JSON для бэкапа
 * @access Public
 */
router.get('/export', async (req, res) => {
  try {
    const prompts = await Prompt.find().sort({ category: 1, name: 1 });
    
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      source: 'Reader Bot',
      count: prompts.length,
      prompts: prompts.map(prompt => ({
        name: prompt.name,
        type: prompt.type,
        category: prompt.category,
        language: prompt.language,
        content: prompt.content,
        variables: prompt.variables || [],
        status: prompt.status,
        priority: prompt.priority,
        description: prompt.description,
        tags: prompt.tags || [],
        isDefault: prompt.isDefault
      }))
    };

    res.setHeader('Content-Disposition', `attachment; filename="reader-prompts-${Date.now()}.json"`);
    res.json(exportData);

    logger.info(`Prompts exported: ${prompts.length} prompts`);
  } catch (error) {
    logger.error(`Error exporting prompts: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: 'Не удалось экспортировать промпты',
      errorCode: 'EXPORT_ERROR'
    });
  }
});

module.exports = router;
