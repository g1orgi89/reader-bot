/**
 * @fileoverview API для управления категориями цитат
 * @description CRUD операции для Category модели
 * @author Reader Bot Team
 */

const express = require('express');
const Category = require('../models/Category');
const { adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/reader/categories
 * Получить список категорий
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      isActive,
      search,
      sortBy = 'priority',
      sortOrder = 'desc'
    } = req.query;

    // Строим фильтр
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { keywords: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Строим сортировку
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Выполняем запрос с пагинацией
    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      Category.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: categories,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения категорий',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/categories/stats
 * Получить статистику категорий
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await Category.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching category stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики категорий',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/categories/active
 * Получить активные категории для AI анализа
 */
router.get('/active', async (req, res) => {
  try {
    const categories = await Category.getActiveForAI();

    res.json({
      success: true,
      data: categories,
      count: categories.length
    });

  } catch (error) {
    logger.error('Error fetching active categories:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения активных категорий',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/categories/ui
 * Получить категории для пользовательского интерфейса
 */
router.get('/ui', async (req, res) => {
  try {
    const categories = await Category.getForUI();

    res.json({
      success: true,
      data: categories,
      count: categories.length
    });

  } catch (error) {
    logger.error('Error fetching UI categories:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения категорий для UI',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/categories/validate
 * Валидировать категорию от AI
 */
router.post('/validate', async (req, res) => {
  try {
    const { categoryName } = req.body;
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: 'Название категории обязательно'
      });
    }

    const category = await Category.validateAICategory(categoryName);

    res.json({
      success: true,
      data: category,
      found: !!category
    });

  } catch (error) {
    logger.error('Error validating category:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка валидации категории',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/categories/find-by-text
 * Найти категорию по тексту цитаты
 */
router.post('/find-by-text', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Текст цитаты обязателен'
      });
    }

    const category = await Category.findByText(text);

    res.json({
      success: true,
      data: category
    });

  } catch (error) {
    logger.error('Error finding category by text:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска категории по тексту',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/categories/:id
 * Получить категорию по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Категория не найдена'
      });
    }

    res.json({
      success: true,
      data: category
    });

  } catch (error) {
    logger.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения категории',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/categories
 * Создать новую категорию
 */
router.post('/', adminAuth, async (req, res) => {
  try {
    const categoryData = req.body;
    
    // Валидация обязательных полей
    const requiredFields = ['name', 'description'];
    for (const field of requiredFields) {
      if (!categoryData[field]) {
        return res.status(400).json({
          success: false,
          message: `Поле ${field} обязательно для заполнения`
        });
      }
    }

    // Проверяем уникальность названия
    const existingCategory = await Category.findOne({ name: categoryData.name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Категория с таким названием уже существует'
      });
    }

    const category = new Category(categoryData);
    await category.save();

    logger.info(`📂 Created category: ${category.name}`);

    res.status(201).json({
      success: true,
      data: category,
      message: 'Категория успешно создана'
    });

  } catch (error) {
    logger.error('Error creating category:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка создания категории',
      error: error.message
    });
  }
});

/**
 * PUT /api/reader/categories/:id
 * Обновить категорию
 */
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const categoryData = req.body;
    
    // Если обновляется название, проверяем уникальность
    if (categoryData.name) {
      const existingCategory = await Category.findOne({ 
        name: categoryData.name,
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Категория с таким названием уже существует'
        });
      }
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      categoryData,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Категория не найдена'
      });
    }

    logger.info(`📂 Updated category: ${category.name}`);

    res.json({
      success: true,
      data: category,
      message: 'Категория успешно обновлена'
    });

  } catch (error) {
    logger.error('Error updating category:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка обновления категории',
      error: error.message
    });
  }
});

/**
 * PATCH /api/reader/categories/:id/toggle
 * Переключить активность категории
 */
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Категория не найдена'
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    logger.info(`📂 Toggled category status: ${category.name} -> ${category.isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      data: category,
      message: `Категория ${category.isActive ? 'активирована' : 'деактивирована'}`
    });

  } catch (error) {
    logger.error('Error toggling category status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка изменения статуса категории',
      error: error.message
    });
  }
});

/**
 * DELETE /api/reader/categories/:id
 * Удалить категорию
 */
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Категория не найдена'
      });
    }

    logger.info(`📂 Deleted category: ${category.name}`);

    res.json({
      success: true,
      message: 'Категория успешно удалена'
    });

  } catch (error) {
    logger.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления категории',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/categories/import
 * Импортировать категории из JSON
 */
router.post('/import', adminAuth, async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Массив категорий не предоставлен'
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const categoryData of categories) {
      try {
        const existingCategory = await Category.findOne({ name: categoryData.name });
        
        if (existingCategory) {
          await Category.findByIdAndUpdate(existingCategory._id, categoryData);
          results.updated++;
        } else {
          const category = new Category(categoryData);
          await category.save();
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          category: categoryData.name || 'Unknown',
          error: error.message
        });
      }
    }

    logger.info(`📂 Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      success: true,
      data: results,
      message: `Импорт завершен: создано ${results.created}, обновлено ${results.updated}`
    });

  } catch (error) {
    logger.error('Error importing categories:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка импорта категорий',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/categories/export
 * Экспортировать категории в JSON
 */
router.get('/export', adminAuth, async (req, res) => {
  try {
    const categories = await Category.find({});
    
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });

  } catch (error) {
    logger.error('Error exporting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка экспорта категорий',
      error: error.message
    });
  }
});

module.exports = router;
