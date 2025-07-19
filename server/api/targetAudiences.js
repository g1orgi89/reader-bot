/**
 * @fileoverview API для управления целевыми аудиториями Reader Bot
 * Обеспечивает CRUD операции для модели TargetAudience
 * 
 * @author Claude AI
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const TargetAudience = require('../models/TargetAudience');
const { adminAuth } = require('../middleware/adminAuth');

/**
 * @typedef {Object} TargetAudienceData
 * @property {string} name - Название аудитории
 * @property {string} description - Описание аудитории
 * @property {string} slug - URL-безопасный идентификатор
 * @property {Object} criteria - Критерии отбора пользователей
 * @property {boolean} isActive - Статус активности
 * @property {number} priority - Приоритет при сопоставлении
 */

/**
 * GET /api/reader/target-audiences
 * Получение списка целевых аудиторий с пагинацией и фильтрацией
 */
router.get('/', adminAuth, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            search = '', 
            active = '',
            sortBy = 'priority',
            sortOrder = 'desc'
        } = req.query;

        // Построение фильтра
        const filter = {};
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } }
            ];
        }

        if (active !== '') {
            filter.isActive = active === 'true';
        }

        // Настройка сортировки
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Выполнение запроса с пагинацией
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [audiences, total] = await Promise.all([
            TargetAudience.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            TargetAudience.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: audiences,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Ошибка получения списка аудиторий:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения списка аудиторий',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/target-audiences/stats
 * Получение статистики по целевым аудиториям
 */
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const [totalCount, activeCount, inactiveCount] = await Promise.all([
            TargetAudience.countDocuments(),
            TargetAudience.countDocuments({ isActive: true }),
            TargetAudience.countDocuments({ isActive: false })
        ]);

        // Получение топ аудиторий по приоритету
        const topAudiences = await TargetAudience.find({ isActive: true })
            .sort({ priority: -1 })
            .limit(5)
            .select('name slug priority')
            .lean();

        res.json({
            success: true,
            stats: {
                total: totalCount,
                active: activeCount,
                inactive: inactiveCount,
                topByPriority: topAudiences
            }
        });

    } catch (error) {
        console.error('Ошибка получения статистики аудиторий:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения статистики аудиторий',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/target-audiences/active
 * Получение только активных аудиторий для использования в сервисах
 */
router.get('/active', async (req, res) => {
    try {
        const audiences = await TargetAudience.find({ isActive: true })
            .sort({ priority: -1 })
            .select('name slug criteria description priority')
            .lean();

        res.json({
            success: true,
            data: audiences
        });

    } catch (error) {
        console.error('Ошибка получения активных аудиторий:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения активных аудиторий',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/target-audiences/:id
 * Получение конкретной целевой аудитории по ID
 */
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const audience = await TargetAudience.findById(req.params.id);
        
        if (!audience) {
            return res.status(404).json({
                success: false,
                message: 'Целевая аудитория не найдена'
            });
        }

        res.json({
            success: true,
            data: audience
        });

    } catch (error) {
        console.error('Ошибка получения аудитории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения аудитории',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/target-audiences
 * Создание новой целевой аудитории
 */
router.post('/', adminAuth, async (req, res) => {
    try {
        const { name, description, slug, criteria, isActive = true, priority = 1 } = req.body;

        // Базовая валидация
        if (!name || !description || !slug) {
            return res.status(400).json({
                success: false,
                message: 'Название, описание и slug обязательны'
            });
        }

        // Проверка уникальности slug
        const existingAudience = await TargetAudience.findOne({ slug });
        if (existingAudience) {
            return res.status(400).json({
                success: false,
                message: 'Аудитория с таким slug уже существует'
            });
        }

        const audience = new TargetAudience({
            name,
            description,
            slug,
            criteria: criteria || {},
            isActive,
            priority
        });

        await audience.save();

        res.status(201).json({
            success: true,
            message: 'Целевая аудитория успешно создана',
            data: audience
        });

    } catch (error) {
        console.error('Ошибка создания аудитории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка создания аудитории',
            error: error.message
        });
    }
});

/**
 * PUT /api/reader/target-audiences/:id
 * Обновление целевой аудитории
 */
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { name, description, slug, criteria, isActive, priority } = req.body;

        // Проверка уникальности slug (если изменяется)
        if (slug) {
            const existingAudience = await TargetAudience.findOne({ 
                slug, 
                _id: { $ne: req.params.id } 
            });
            
            if (existingAudience) {
                return res.status(400).json({
                    success: false,
                    message: 'Аудитория с таким slug уже существует'
                });
            }
        }

        const audience = await TargetAudience.findByIdAndUpdate(
            req.params.id,
            { 
                ...(name && { name }),
                ...(description && { description }),
                ...(slug && { slug }),
                ...(criteria && { criteria }),
                ...(isActive !== undefined && { isActive }),
                ...(priority !== undefined && { priority }),
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!audience) {
            return res.status(404).json({
                success: false,
                message: 'Целевая аудитория не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Целевая аудитория успешно обновлена',
            data: audience
        });

    } catch (error) {
        console.error('Ошибка обновления аудитории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка обновления аудитории',
            error: error.message
        });
    }
});

/**
 * DELETE /api/reader/target-audiences/:id
 * Удаление целевой аудитории
 */
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const audience = await TargetAudience.findByIdAndDelete(req.params.id);

        if (!audience) {
            return res.status(404).json({
                success: false,
                message: 'Целевая аудитория не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Целевая аудитория успешно удалена',
            data: { deletedId: req.params.id }
        });

    } catch (error) {
        console.error('Ошибка удаления аудитории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка удаления аудитории',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/target-audiences/match-user
 * Определение подходящих аудиторий для пользователя
 */
router.post('/match-user', async (req, res) => {
    try {
        const { userProfile } = req.body;

        if (!userProfile) {
            return res.status(400).json({
                success: false,
                message: 'Профиль пользователя обязателен'
            });
        }

        const matchedAudiences = await TargetAudience.getForUser(userProfile);

        res.json({
            success: true,
            data: matchedAudiences
        });

    } catch (error) {
        console.error('Ошибка сопоставления пользователя с аудиториями:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сопоставления пользователя с аудиториями',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/target-audiences/toggle/:id
 * Переключение статуса активности аудитории
 */
router.post('/toggle/:id', adminAuth, async (req, res) => {
    try {
        const audience = await TargetAudience.findById(req.params.id);

        if (!audience) {
            return res.status(404).json({
                success: false,
                message: 'Целевая аудитория не найдена'
            });
        }

        audience.isActive = !audience.isActive;
        audience.updatedAt = new Date();
        await audience.save();

        res.json({
            success: true,
            message: `Аудитория ${audience.isActive ? 'активирована' : 'деактивирована'}`,
            data: audience
        });

    } catch (error) {
        console.error('Ошибка переключения статуса аудитории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка переключения статуса аудитории',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/target-audiences/bulk-action
 * Массовые операции с аудиториями
 */
router.post('/bulk-action', adminAuth, async (req, res) => {
    try {
        const { action, audienceIds } = req.body;

        if (!action || !audienceIds || !Array.isArray(audienceIds)) {
            return res.status(400).json({
                success: false,
                message: 'Некорректные параметры для массовой операции'
            });
        }

        let result;
        switch (action) {
            case 'activate':
                result = await TargetAudience.updateMany(
                    { _id: { $in: audienceIds } },
                    { isActive: true, updatedAt: new Date() }
                );
                break;
                
            case 'deactivate':
                result = await TargetAudience.updateMany(
                    { _id: { $in: audienceIds } },
                    { isActive: false, updatedAt: new Date() }
                );
                break;
                
            case 'delete':
                result = await TargetAudience.deleteMany(
                    { _id: { $in: audienceIds } }
                );
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Неизвестное действие'
                });
        }

        res.json({
            success: true,
            message: `Массовое действие "${action}" выполнено`,
            data: { 
                affected: result.modifiedCount || result.deletedCount,
                action 
            }
        });

    } catch (error) {
        console.error('Ошибка массовой операции:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка выполнения массовой операции',
            error: error.message
        });
    }
});

module.exports = router;