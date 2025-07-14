/**
 * @fileoverview API для управления промокодами и скидками
 * @description CRUD операции для PromoCode модели
 * @author Reader Bot Team
 */

const express = require('express');
const PromoCode = require('../models/PromoCode');
const { adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/reader/promoCodes
 * Получить список промокодов
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      context,
      audience,
      isActive,
      isExpired,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Строим фильтр
    const filter = {};
    
    if (context) {
      filter.usageContext = context;
    }
    
    if (audience) {
      filter.targetAudience = audience;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (isExpired !== undefined) {
      const now = new Date();
      if (isExpired === 'true') {
        filter.validUntil = { $lt: now };
      } else {
        filter.validUntil = { $gte: now };
      }
    }
    
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Строим сортировку
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Выполняем запрос с пагинацией
    const [promoCodes, total] = await Promise.all([
      PromoCode.find(filter)
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      PromoCode.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: promoCodes,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching promo codes:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения промокодов',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/promoCodes/stats
 * Получить статистику промокодов
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await PromoCode.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching promo code stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики промокодов',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/promoCodes/active/:context
 * Получить активные промокоды по контексту
 */
router.get('/active/:context', async (req, res) => {
  try {
    const { context } = req.params;
    const { limit = 5 } = req.query;
    
    const promoCodes = await PromoCode.getActiveByContext(context, Number(limit));

    res.json({
      success: true,
      data: promoCodes,
      meta: {
        context,
        count: promoCodes.length
      }
    });

  } catch (error) {
    logger.error('Error fetching active promo codes:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения активных промокодов',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/promoCodes/random/:context
 * Получить случайный промокод для контекста
 */
router.get('/random/:context', async (req, res) => {
  try {
    const { context } = req.params;
    const { audience } = req.query;
    
    const audienceArray = audience ? (Array.isArray(audience) ? audience : [audience]) : ['all'];
    const promoCode = await PromoCode.getRandomForContext(context, audienceArray);

    res.json({
      success: true,
      data: promoCode,
      meta: {
        context,
        audience: audienceArray
      }
    });

  } catch (error) {
    logger.error('Error fetching random promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения случайного промокода',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/promoCodes/validate
 * Проверить валидность промокода
 */
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Код промокода обязателен'
      });
    }

    const validation = await PromoCode.validateCode(code);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    logger.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки промокода',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/promoCodes/use
 * Использовать промокод
 */
router.post('/use', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Код промокода обязателен'
      });
    }

    const used = await PromoCode.useCode(code);

    if (used) {
      logger.info(`🎁 Promo code used: ${code.toUpperCase()}`);
      res.json({
        success: true,
        message: 'Промокод успешно использован'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Промокод недоступен для использования'
      });
    }

  } catch (error) {
    logger.error('Error using promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка использования промокода',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/promoCodes/:id
 * Получить промокод по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const promoCode = await PromoCode.findById(req.params.id);
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    res.json({
      success: true,
      data: promoCode
    });

  } catch (error) {
    logger.error('Error fetching promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения промокода',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/promoCodes
 * Создать новый промокод
 */
router.post('/', adminAuth, async (req, res) => {
  try {
    const promoCodeData = req.body;
    
    // Валидация обязательных полей
    const requiredFields = ['code', 'description', 'discount', 'validUntil'];
    for (const field of requiredFields) {
      if (!promoCodeData[field]) {
        return res.status(400).json({
          success: false,
          message: `Поле ${field} обязательно для заполнения`
        });
      }
    }

    // Проверяем уникальность кода
    const existingPromoCode = await PromoCode.findOne({ code: promoCodeData.code.toUpperCase() });
    if (existingPromoCode) {
      return res.status(400).json({
        success: false,
        message: 'Промокод с таким кодом уже существует'
      });
    }

    const promoCode = new PromoCode(promoCodeData);
    await promoCode.save();

    logger.info(`🎁 Created promo code: ${promoCode.code} (${promoCode.discount}% off)`);

    res.status(201).json({
      success: true,
      data: promoCode,
      message: 'Промокод успешно создан'
    });

  } catch (error) {
    logger.error('Error creating promo code:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка создания промокода',
      error: error.message
    });
  }
});

/**
 * PUT /api/reader/promoCodes/:id
 * Обновить промокод
 */
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const promoCodeData = req.body;
    
    // Если обновляется код, проверяем уникальность
    if (promoCodeData.code) {
      const existingPromoCode = await PromoCode.findOne({ 
        code: promoCodeData.code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      
      if (existingPromoCode) {
        return res.status(400).json({
          success: false,
          message: 'Промокод с таким кодом уже существует'
        });
      }
    }

    const promoCode = await PromoCode.findByIdAndUpdate(
      req.params.id,
      promoCodeData,
      { new: true, runValidators: true }
    );

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    logger.info(`🎁 Updated promo code: ${promoCode.code}`);

    res.json({
      success: true,
      data: promoCode,
      message: 'Промокод успешно обновлен'
    });

  } catch (error) {
    logger.error('Error updating promo code:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка обновления промокода',
      error: error.message
    });
  }
});

/**
 * PATCH /api/reader/promoCodes/:id/toggle
 * Переключить активность промокода
 */
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const promoCode = await PromoCode.findById(req.params.id);
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    promoCode.isActive = !promoCode.isActive;
    await promoCode.save();

    logger.info(`🎁 Toggled promo code status: ${promoCode.code} -> ${promoCode.isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      data: promoCode,
      message: `Промокод ${promoCode.isActive ? 'активирован' : 'деактивирован'}`
    });

  } catch (error) {
    logger.error('Error toggling promo code status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка изменения статуса промокода',
      error: error.message
    });
  }
});

/**
 * DELETE /api/reader/promoCodes/:id
 * Удалить промокод
 */
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const promoCode = await PromoCode.findByIdAndDelete(req.params.id);
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    logger.info(`🎁 Deleted promo code: ${promoCode.code}`);

    res.json({
      success: true,
      message: 'Промокод успешно удален'
    });

  } catch (error) {
    logger.error('Error deleting promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления промокода',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/promoCodes/import
 * Импортировать промокоды из JSON
 */
router.post('/import', adminAuth, async (req, res) => {
  try {
    const { promoCodes } = req.body;
    
    if (!Array.isArray(promoCodes) || promoCodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Массив промокодов не предоставлен'
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const promoCodeData of promoCodes) {
      try {
        const existingPromoCode = await PromoCode.findOne({ code: promoCodeData.code });
        
        if (existingPromoCode) {
          await PromoCode.findByIdAndUpdate(existingPromoCode._id, promoCodeData);
          results.updated++;
        } else {
          const promoCode = new PromoCode(promoCodeData);
          await promoCode.save();
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          code: promoCodeData.code || 'Unknown',
          error: error.message
        });
      }
    }

    logger.info(`🎁 Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      success: true,
      data: results,
      message: `Импорт завершен: создано ${results.created}, обновлено ${results.updated}`
    });

  } catch (error) {
    logger.error('Error importing promo codes:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка импорта промокодов',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/promoCodes/export
 * Экспортировать промокоды в JSON
 */
router.get('/export', adminAuth, async (req, res) => {
  try {
    const promoCodes = await PromoCode.find({});
    
    res.json({
      success: true,
      data: promoCodes,
      count: promoCodes.length
    });

  } catch (error) {
    logger.error('Error exporting promo codes:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка экспорта промокодов',
      error: error.message
    });
  }
});

module.exports = router;
