/**
 * @fileoverview API для управления UTM шаблонами Reader Bot
 * Обеспечивает CRUD операции для модели UtmTemplate
 * 
 * @author Claude AI
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const UtmTemplate = require('../models/UtmTemplate');
const { authenticateAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

/**
 * @typedef {Object} UtmTemplateData
 * @property {string} name - Название шаблона
 * @property {string} baseUrl - Базовый URL
 * @property {string} utmSource - UTM source
 * @property {string} utmMedium - UTM medium
 * @property {string} utmCampaign - UTM campaign
 * @property {string} utmContent - UTM content
 * @property {string} context - Контекст использования
 * @property {boolean} isActive - Статус активности
 */

/**
 * GET /api/reader/utm-templates
 * Получение списка UTM шаблонов с пагинацией и фильтрацией
 */
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            search = '', 
            context = '',
            active = '',
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        // Построение фильтра
        const filter = {};
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { baseUrl: { $regex: search, $options: 'i' } },
                { utmSource: { $regex: search, $options: 'i' } },
                { utmCampaign: { $regex: search, $options: 'i' } }
            ];
        }

        if (context) {
            filter.context = context;
        }

        if (active !== '') {
            filter.isActive = active === 'true';
        }

        // Настройка сортировки
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Выполнение запроса с пагинацией
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [templates, total] = await Promise.all([
            UtmTemplate.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            UtmTemplate.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: templates,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Ошибка получения списка UTM шаблонов:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения списка UTM шаблонов',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/utm-templates/stats
 * Получение статистики по UTM шаблонам
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        const [totalCount, activeCount, inactiveCount] = await Promise.all([
            UtmTemplate.countDocuments(),
            UtmTemplate.countDocuments({ isActive: true }),
            UtmTemplate.countDocuments({ isActive: false })
        ]);

        // Группировка по контекстам
        const contextStats = await UtmTemplate.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$context', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Топ источников
        const sourceStats = await UtmTemplate.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$utmSource', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            success: true,
            stats: {
                total: totalCount,
                active: activeCount,
                inactive: inactiveCount,
                byContext: contextStats,
                topSources: sourceStats
            }
        });

    } catch (error) {
        console.error('Ошибка получения статистики UTM шаблонов:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения статистики UTM шаблонов',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/utm-templates/contexts
 * Получение списка доступных контекстов
 */
router.get('/contexts', async (req, res) => {
    try {
        const contexts = await UtmTemplate.distinct('context');
        
        res.json({
            success: true,
            data: contexts
        });

    } catch (error) {
        console.error('Ошибка получения контекстов:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения контекстов',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/utm-templates/by-context/:context
 * Получение UTM шаблонов по контексту
 */
router.get('/by-context/:context', async (req, res) => {
    try {
        const { context } = req.params;
        
        const templates = await UtmTemplate.getByContext(context);

        res.json({
            success: true,
            data: templates
        });

    } catch (error) {
        console.error('Ошибка получения шаблонов по контексту:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения шаблонов по контексту',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/utm-templates/:id
 * Получение конкретного UTM шаблона по ID
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
    try {
        const template = await UtmTemplate.findById(req.params.id);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'UTM шаблон не найден'
            });
        }

        res.json({
            success: true,
            data: template
        });

    } catch (error) {
        console.error('Ошибка получения UTM шаблона:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения UTM шаблона',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/utm-templates
 * Создание нового UTM шаблона
 */
router.post('/', authenticateAdmin, async (req, res) => {
    try {
        const { 
            name, 
            baseUrl, 
            utmSource, 
            utmMedium, 
            utmCampaign, 
            utmContent = '',
            context,
            isActive = true 
        } = req.body;

        // Базовая валидация
        if (!name || !baseUrl || !utmSource || !utmMedium || !utmCampaign || !context) {
            return res.status(400).json({
                success: false,
                message: 'Название, baseUrl, utmSource, utmMedium, utmCampaign и context обязательны'
            });
        }

        // Валидация URL
        try {
            new URL(baseUrl);
        } catch (urlError) {
            return res.status(400).json({
                success: false,
                message: 'Некорректный базовый URL'
            });
        }

        const template = new UtmTemplate({
            name,
            baseUrl,
            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
            context,
            isActive
        });

        await template.save();

        res.status(201).json({
            success: true,
            message: 'UTM шаблон успешно создан',
            data: template
        });

    } catch (error) {
        console.error('Ошибка создания UTM шаблона:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка создания UTM шаблона',
            error: error.message
        });
    }
});

/**
 * PUT /api/reader/utm-templates/:id
 * Обновление UTM шаблона
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
    try {
        const { 
            name, 
            baseUrl, 
            utmSource, 
            utmMedium, 
            utmCampaign, 
            utmContent,
            context,
            isActive 
        } = req.body;

        // Валидация URL если он изменяется
        if (baseUrl) {
            try {
                new URL(baseUrl);
            } catch (urlError) {
                return res.status(400).json({
                    success: false,
                    message: 'Некорректный базовый URL'
                });
            }
        }

        const template = await UtmTemplate.findByIdAndUpdate(
            req.params.id,
            { 
                ...(name && { name }),
                ...(baseUrl && { baseUrl }),
                ...(utmSource && { utmSource }),
                ...(utmMedium && { utmMedium }),
                ...(utmCampaign && { utmCampaign }),
                ...(utmContent !== undefined && { utmContent }),
                ...(context && { context }),
                ...(isActive !== undefined && { isActive }),
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'UTM шаблон не найден'
            });
        }

        res.json({
            success: true,
            message: 'UTM шаблон успешно обновлен',
            data: template
        });

    } catch (error) {
        console.error('Ошибка обновления UTM шаблона:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка обновления UTM шаблона',
            error: error.message
        });
    }
});

/**
 * DELETE /api/reader/utm-templates/:id
 * Удаление UTM шаблона
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
    try {
        const template = await UtmTemplate.findByIdAndDelete(req.params.id);

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'UTM шаблон не найден'
            });
        }

        res.json({
            success: true,
            message: 'UTM шаблон успешно удален',
            data: { deletedId: req.params.id }
        });

    } catch (error) {
        console.error('Ошибка удаления UTM шаблона:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка удаления UTM шаблона',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/utm-templates/generate-link
 * Генерация UTM ссылки по шаблону
 */
router.post('/generate-link', async (req, res) => {
    try {
        const { templateId, variables = {} } = req.body;

        if (!templateId) {
            return res.status(400).json({
                success: false,
                message: 'ID шаблона обязателен'
            });
        }

        const template = await UtmTemplate.findById(templateId);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'UTM шаблон не найден'
            });
        }

        if (!template.isActive) {
            return res.status(400).json({
                success: false,
                message: 'UTM шаблон неактивен'
            });
        }

        const generatedLink = template.generateLink(variables);

        res.json({
            success: true,
            data: {
                link: generatedLink,
                template: {
                    id: template._id,
                    name: template.name,
                    context: template.context
                },
                variables: variables
            }
        });

    } catch (error) {
        console.error('Ошибка генерации UTM ссылки:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка генерации UTM ссылки',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/utm-templates/toggle/:id
 * Переключение статуса активности шаблона
 */
router.post('/toggle/:id', authenticateAdmin, async (req, res) => {
    try {
        const template = await UtmTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'UTM шаблон не найден'
            });
        }

        template.isActive = !template.isActive;
        template.updatedAt = new Date();
        await template.save();

        res.json({
            success: true,
            message: `UTM шаблон ${template.isActive ? 'активирован' : 'деактивирован'}`,
            data: template
        });

    } catch (error) {
        console.error('Ошибка переключения статуса UTM шаблона:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка переключения статуса UTM шаблона',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/utm-templates/test/:id
 * Тестирование UTM шаблона с тестовыми переменными
 */
router.post('/test/:id', authenticateAdmin, async (req, res) => {
    try {
        const { variables = {} } = req.body;
        
        const template = await UtmTemplate.findById(req.params.id);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'UTM шаблон не найден'
            });
        }

        // Тестовые переменные по умолчанию
        const testVariables = {
            userId: 'test-123',
            bookSlug: 'test-book',
            campaignId: 'test-campaign',
            ...variables
        };

        const testLink = template.generateLink(testVariables);

        res.json({
            success: true,
            data: {
                testLink,
                usedVariables: testVariables,
                template: {
                    name: template.name,
                    context: template.context,
                    baseUrl: template.baseUrl
                }
            }
        });

    } catch (error) {
        console.error('Ошибка тестирования UTM шаблона:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка тестирования UTM шаблона',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/utm-templates/bulk-action
 * Массовые операции с UTM шаблонами
 */
router.post('/bulk-action', authenticateAdmin, async (req, res) => {
    try {
        const { action, templateIds } = req.body;

        if (!action || !templateIds || !Array.isArray(templateIds)) {
            return res.status(400).json({
                success: false,
                message: 'Некорректные параметры для массовой операции'
            });
        }

        let result;
        switch (action) {
            case 'activate':
                result = await UtmTemplate.updateMany(
                    { _id: { $in: templateIds } },
                    { isActive: true, updatedAt: new Date() }
                );
                break;
                
            case 'deactivate':
                result = await UtmTemplate.updateMany(
                    { _id: { $in: templateIds } },
                    { isActive: false, updatedAt: new Date() }
                );
                break;
                
            case 'delete':
                result = await UtmTemplate.deleteMany(
                    { _id: { $in: templateIds } }
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