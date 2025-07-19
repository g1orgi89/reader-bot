/**
 * @fileoverview API для управления персоной Анны Бусел в Reader Bot
 * Обеспечивает CRUD операции для модели AnnaPersona
 * 
 * @author Claude AI
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const AnnaPersona = require('../models/AnnaPersona');
const { adminAuth } = require('../middleware/adminAuth');

/**
 * @typedef {Object} AnnaPersonaData
 * @property {string} name - Название персоны
 * @property {Object} personality - Черты личности
 * @property {Object} expertise - Области экспертизы
 * @property {Object} responsePatterns - Паттерны ответов
 * @property {Object} boundaries - Границы и ограничения
 * @property {string} context - Контекст использования
 * @property {boolean} isActive - Статус активности
 */

/**
 * GET /api/reader/anna-persona
 * Получение списка персон Анны с пагинацией и фильтрацией
 */
router.get('/', adminAuth, async (req, res) => {
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
                { context: { $regex: search, $options: 'i' } },
                { 'personality.traits': { $regex: search, $options: 'i' } }
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
        
        const [personas, total] = await Promise.all([
            AnnaPersona.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            AnnaPersona.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: personas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Ошибка получения списка персон Анны:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения списка персон Анны',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/anna-persona/stats
 * Получение статистики по персонам Анны
 */
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const [totalCount, activeCount, inactiveCount] = await Promise.all([
            AnnaPersona.countDocuments(),
            AnnaPersona.countDocuments({ isActive: true }),
            AnnaPersona.countDocuments({ isActive: false })
        ]);

        // Группировка по контекстам
        const contextStats = await AnnaPersona.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$context', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Получение активных персон
        const activePersonas = await AnnaPersona.find({ isActive: true })
            .select('name context')
            .lean();

        res.json({
            success: true,
            stats: {
                total: totalCount,
                active: activeCount,
                inactive: inactiveCount,
                byContext: contextStats,
                activePersonas: activePersonas
            }
        });

    } catch (error) {
        console.error('Ошибка получения статистики персон Анны:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения статистики персон Анны',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/anna-persona/contexts
 * Получение списка доступных контекстов
 */
router.get('/contexts', async (req, res) => {
    try {
        const contexts = await AnnaPersona.distinct('context');
        
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
 * GET /api/reader/anna-persona/for-context/:context
 * Получение персоны Анны для конкретного контекста
 */
router.get('/for-context/:context', async (req, res) => {
    try {
        const { context } = req.params;
        
        const persona = await AnnaPersona.getForContext(context);

        if (!persona) {
            return res.status(404).json({
                success: false,
                message: `Персона для контекста "${context}" не найдена`
            });
        }

        res.json({
            success: true,
            data: persona
        });

    } catch (error) {
        console.error('Ошибка получения персоны по контексту:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения персоны по контексту',
            error: error.message
        });
    }
});

/**
 * GET /api/reader/anna-persona/:id
 * Получение конкретной персоны Анны по ID
 */
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const persona = await AnnaPersona.findById(req.params.id);
        
        if (!persona) {
            return res.status(404).json({
                success: false,
                message: 'Персона Анны не найдена'
            });
        }

        res.json({
            success: true,
            data: persona
        });

    } catch (error) {
        console.error('Ошибка получения персоны Анны:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения персоны Анны',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/anna-persona
 * Создание новой персоны Анны
 */
router.post('/', adminAuth, async (req, res) => {
    try {
        const { 
            name, 
            personality, 
            expertise, 
            responsePatterns, 
            boundaries, 
            context,
            isActive = true 
        } = req.body;

        // Базовая валидация
        if (!name || !context) {
            return res.status(400).json({
                success: false,
                message: 'Название и контекст обязательны'
            });
        }

        // Проверка уникальности контекста среди активных персон
        const existingPersona = await AnnaPersona.findOne({ 
            context, 
            isActive: true 
        });
        
        if (existingPersona) {
            return res.status(400).json({
                success: false,
                message: 'Активная персона для этого контекста уже существует'
            });
        }

        const persona = new AnnaPersona({
            name,
            personality: personality || {},
            expertise: expertise || {},
            responsePatterns: responsePatterns || {},
            boundaries: boundaries || {},
            context,
            isActive
        });

        await persona.save();

        res.status(201).json({
            success: true,
            message: 'Персона Анны успешно создана',
            data: persona
        });

    } catch (error) {
        console.error('Ошибка создания персоны Анны:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка создания персоны Анны',
            error: error.message
        });
    }
});

/**
 * PUT /api/reader/anna-persona/:id
 * Обновление персоны Анны
 */
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { 
            name, 
            personality, 
            expertise, 
            responsePatterns, 
            boundaries, 
            context,
            isActive 
        } = req.body;

        // Проверка уникальности контекста (если изменяется)
        if (context) {
            const existingPersona = await AnnaPersona.findOne({ 
                context, 
                isActive: true,
                _id: { $ne: req.params.id } 
            });
            
            if (existingPersona) {
                return res.status(400).json({
                    success: false,
                    message: 'Активная персона для этого контекста уже существует'
                });
            }
        }

        const persona = await AnnaPersona.findByIdAndUpdate(
            req.params.id,
            { 
                ...(name && { name }),
                ...(personality && { personality }),
                ...(expertise && { expertise }),
                ...(responsePatterns && { responsePatterns }),
                ...(boundaries && { boundaries }),
                ...(context && { context }),
                ...(isActive !== undefined && { isActive }),
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!persona) {
            return res.status(404).json({
                success: false,
                message: 'Персона Анны не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Персона Анны успешно обновлена',
            data: persona
        });

    } catch (error) {
        console.error('Ошибка обновления персоны Анны:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка обновления персоны Анны',
            error: error.message
        });
    }
});

/**
 * DELETE /api/reader/anna-persona/:id
 * Удаление персоны Анны
 */
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const persona = await AnnaPersona.findByIdAndDelete(req.params.id);

        if (!persona) {
            return res.status(404).json({
                success: false,
                message: 'Персона Анны не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Персона Анны успешно удалена',
            data: { deletedId: req.params.id }
        });

    } catch (error) {
        console.error('Ошибка удаления персоны Анны:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка удаления персоны Анны',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/anna-persona/generate-prompt/:id
 * Генерация системного промпта на основе персоны
 */
router.post('/generate-prompt/:id', async (req, res) => {
    try {
        const { additionalContext = '' } = req.body;
        
        const persona = await AnnaPersona.findById(req.params.id);
        
        if (!persona) {
            return res.status(404).json({
                success: false,
                message: 'Персона Анны не найдена'
            });
        }

        if (!persona.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Персона неактивна'
            });
        }

        const systemPrompt = persona.generateSystemPrompt(additionalContext);

        res.json({
            success: true,
            data: {
                systemPrompt,
                persona: {
                    id: persona._id,
                    name: persona.name,
                    context: persona.context
                },
                additionalContext
            }
        });

    } catch (error) {
        console.error('Ошибка генерации системного промпта:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка генерации системного промпта',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/anna-persona/random-phrase/:id
 * Получение случайной фразы из репертуара персоны
 */
router.post('/random-phrase/:id', async (req, res) => {
    try {
        const { type = 'general' } = req.body;
        
        const persona = await AnnaPersona.findById(req.params.id);
        
        if (!persona) {
            return res.status(404).json({
                success: false,
                message: 'Персона Анны не найдена'
            });
        }

        if (!persona.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Персона неактивна'
            });
        }

        const randomPhrase = persona.getRandomPhrase(type);

        res.json({
            success: true,
            data: {
                phrase: randomPhrase,
                type,
                persona: {
                    id: persona._id,
                    name: persona.name,
                    context: persona.context
                }
            }
        });

    } catch (error) {
        console.error('Ошибка получения случайной фразы:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения случайной фразы',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/anna-persona/toggle/:id
 * Переключение статуса активности персоны
 */
router.post('/toggle/:id', adminAuth, async (req, res) => {
    try {
        const persona = await AnnaPersona.findById(req.params.id);

        if (!persona) {
            return res.status(404).json({
                success: false,
                message: 'Персона Анны не найдена'
            });
        }

        // При активации проверяем конфликты
        if (!persona.isActive) {
            const existingPersona = await AnnaPersona.findOne({ 
                context: persona.context, 
                isActive: true,
                _id: { $ne: persona._id }
            });
            
            if (existingPersona) {
                return res.status(400).json({
                    success: false,
                    message: 'Активная персона для этого контекста уже существует'
                });
            }
        }

        persona.isActive = !persona.isActive;
        persona.updatedAt = new Date();
        await persona.save();

        res.json({
            success: true,
            message: `Персона ${persona.isActive ? 'активирована' : 'деактивирована'}`,
            data: persona
        });

    } catch (error) {
        console.error('Ошибка переключения статуса персоны:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка переключения статуса персоны',
            error: error.message
        });
    }
});

/**
 * POST /api/reader/anna-persona/bulk-action
 * Массовые операции с персонами Анны
 */
router.post('/bulk-action', adminAuth, async (req, res) => {
    try {
        const { action, personaIds } = req.body;

        if (!action || !personaIds || !Array.isArray(personaIds)) {
            return res.status(400).json({
                success: false,
                message: 'Некорректные параметры для массовой операции'
            });
        }

        let result;
        switch (action) {
            case 'deactivate':
                result = await AnnaPersona.updateMany(
                    { _id: { $in: personaIds } },
                    { isActive: false, updatedAt: new Date() }
                );
                break;
                
            case 'delete':
                result = await AnnaPersona.deleteMany(
                    { _id: { $in: personaIds } }
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