/**
 * @fileoverview API для управления каталогом анонсов курсов/интенсивов
 * @description CRUD операции для AnnouncementCatalog модели
 * @author Reader Bot Team
 */

const express = require('express');
const AnnouncementCatalog = require('../models/AnnouncementCatalog');
const { adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/reader/announcements
 * Получить список анонсов
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      audience,
      month,
      isActive,
      search,
      sortBy = 'priority',
      sortOrder = 'desc'
    } = req.query;

    // Строим фильтр
    const filter = {};
    
    if (audience) {
      filter.targetAudience = audience;
    }
    
    if (month) {
      filter.$or = [
        { months: Number(month) },
        { months: { $size: 0 } }
      ];
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Строим сортировку
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Выполняем запрос с пагинацией
    const [announcements, total] = await Promise.all([
      AnnouncementCatalog.find(filter)
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      AnnouncementCatalog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: announcements,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения анонсов',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/announcements/stats
 * Получить статистику анонсов
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await AnnouncementCatalog.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching announcement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики анонсов',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/announcements/current
 * Получить анонсы для текущего месяца
 */
router.get('/current', async (req, res) => {
  try {
    const { limit = 4 } = req.query;
    const currentMonth = new Date().getMonth() + 1;
    
    const announcements = await AnnouncementCatalog.getForMonth(currentMonth, Number(limit));

    res.json({
      success: true,
      data: announcements,
      meta: {
        month: currentMonth,
        count: announcements.length
      }
    });

  } catch (error) {
    logger.error('Error fetching current announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения анонсов текущего месяца',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/announcements/for-audience
 * Получить анонс для конкретной аудитории
 */
router.get('/for-audience', async (req, res) => {
  try {
    const { audience, month } = req.query;
    
    if (!audience) {
      return res.status(400).json({
        success: false,
        message: 'Параметр audience обязателен'
      });
    }

    const currentMonth = month ? Number(month) : new Date().getMonth() + 1;
    const audienceArray = Array.isArray(audience) ? audience : [audience];
    
    const announcement = await AnnouncementCatalog.getForUserAudience(audienceArray, currentMonth);

    res.json({
      success: true,
      data: announcement,
      meta: {
        audience: audienceArray,
        month: currentMonth
      }
    });

  } catch (error) {
    logger.error('Error fetching audience announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения анонса для аудитории',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/announcements/:id
 * Получить анонс по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const announcement = await AnnouncementCatalog.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Анонс не найден'
      });
    }

    res.json({
      success: true,
      data: announcement
    });

  } catch (error) {
    logger.error('Error fetching announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения анонса',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/announcements/slug/:slug
 * Получить анонс по slug
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const announcement = await AnnouncementCatalog.getBySlug(req.params.slug);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Анонс не найден'
      });
    }

    res.json({
      success: true,
      data: announcement
    });

  } catch (error) {
    logger.error('Error fetching announcement by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения анонса',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/announcements
 * Создать новый анонс
 */
router.post('/', adminAuth, async (req, res) => {
  try {
    const announcementData = req.body;
    
    // Валидация обязательных полей
    const requiredFields = ['title', 'description', 'price', 'targetAudience', 'announcementSlug'];
    for (const field of requiredFields) {
      if (!announcementData[field]) {
        return res.status(400).json({
          success: false,
          message: `Поле ${field} обязательно для заполнения`
        });
      }
    }

    // Проверяем уникальность slug
    const existingAnnouncement = await AnnouncementCatalog.findOne({ 
      announcementSlug: announcementData.announcementSlug 
    });
    
    if (existingAnnouncement) {
      return res.status(400).json({
        success: false,
        message: 'Анонс с таким slug уже существует'
      });
    }

    const announcement = new AnnouncementCatalog(announcementData);
    await announcement.save();

    logger.info(`📢 Created announcement: ${announcement.title} (${announcement.announcementSlug})`);

    res.status(201).json({
      success: true,
      data: announcement,
      message: 'Анонс успешно создан'
    });

  } catch (error) {
    logger.error('Error creating announcement:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка создания анонса',
      error: error.message
    });
  }
});

/**
 * PUT /api/reader/announcements/:id
 * Обновить анонс
 */
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const announcementData = req.body;
    
    // Если обновляется slug, проверяем уникальность
    if (announcementData.announcementSlug) {
      const existingAnnouncement = await AnnouncementCatalog.findOne({ 
        announcementSlug: announcementData.announcementSlug,
        _id: { $ne: req.params.id }
      });
      
      if (existingAnnouncement) {
        return res.status(400).json({
          success: false,
          message: 'Анонс с таким slug уже существует'
        });
      }
    }

    const announcement = await AnnouncementCatalog.findByIdAndUpdate(
      req.params.id,
      announcementData,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Анонс не найден'
      });
    }

    logger.info(`📢 Updated announcement: ${announcement.title} (${announcement.announcementSlug})`);

    res.json({
      success: true,
      data: announcement,
      message: 'Анонс успешно обновлен'
    });

  } catch (error) {
    logger.error('Error updating announcement:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка обновления анонса',
      error: error.message
    });
  }
});

/**
 * PATCH /api/reader/announcements/:id/toggle
 * Переключить активность анонса
 */
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const announcement = await AnnouncementCatalog.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Анонс не найден'
      });
    }

    announcement.isActive = !announcement.isActive;
    await announcement.save();

    logger.info(`📢 Toggled announcement status: ${announcement.title} -> ${announcement.isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      data: announcement,
      message: `Анонс ${announcement.isActive ? 'активирован' : 'деактивирован'}`
    });

  } catch (error) {
    logger.error('Error toggling announcement status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка изменения статуса анонса',
      error: error.message
    });
  }
});

/**
 * DELETE /api/reader/announcements/:id
 * Удалить анонс
 */
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const announcement = await AnnouncementCatalog.findByIdAndDelete(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Анонс не найден'
      });
    }

    logger.info(`📢 Deleted announcement: ${announcement.title} (${announcement.announcementSlug})`);

    res.json({
      success: true,
      message: 'Анонс успешно удален'
    });

  } catch (error) {
    logger.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления анонса',
      error: error.message
    });
  }
});

/**
 * POST /api/reader/announcements/import
 * Импортировать анонсы из JSON
 */
router.post('/import', adminAuth, async (req, res) => {
  try {
    const { announcements } = req.body;
    
    if (!Array.isArray(announcements) || announcements.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Массив анонсов не предоставлен'
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const announcementData of announcements) {
      try {
        const existingAnnouncement = await AnnouncementCatalog.findOne({ 
          announcementSlug: announcementData.announcementSlug 
        });
        
        if (existingAnnouncement) {
          await AnnouncementCatalog.findByIdAndUpdate(existingAnnouncement._id, announcementData);
          results.updated++;
        } else {
          const announcement = new AnnouncementCatalog(announcementData);
          await announcement.save();
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          announcement: announcementData.title || 'Unknown',
          error: error.message
        });
      }
    }

    logger.info(`📢 Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      success: true,
      data: results,
      message: `Импорт завершен: создано ${results.created}, обновлено ${results.updated}`
    });

  } catch (error) {
    logger.error('Error importing announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка импорта анонсов',
      error: error.message
    });
  }
});

/**
 * GET /api/reader/announcements/export
 * Экспортировать анонсы в JSON
 */
router.get('/export', adminAuth, async (req, res) => {
  try {
    const announcements = await AnnouncementCatalog.find({});
    
    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });

  } catch (error) {
    logger.error('Error exporting announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка экспорта анонсов',
      error: error.message
    });
  }
});

module.exports = router;
