/**
 * Prompts management API routes for Reader Bot
 * @file server/routes/prompts.js
 * 🤖 API для управления промптами Claude AI
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Импорт сервисов
const promptService = require('../services/promptService');
const claudeService = require('../services/claudeService');

/**
 * 📋 GET /api/reader/prompts - Получить список промптов с пагинацией и фильтрами
 */
router.get('/', async (req, res) => {
    try {
        console.log('🤖 GET /prompts - получение списка промптов');
        console.log('🤖 Query params:', req.query);

        const {
            page = 1,
            limit = 10,
            q = '',
            category = '',
            language = '',
            status = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Построение фильтров
        const filters = {};
        
        if (q) {
            filters.$or = [
                { name: { $regex: q, $options: 'i' } },
                { content: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } }
            ];
        }
        
        if (category) filters.category = category;
        if (language) filters.language = language;
        if (status) filters.status = status;

        console.log('🤖 Применяемые фильтры:', filters);

        // Получение промптов с пагинацией
        const result = await promptService.getPrompts({
            filters,
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder
        });

        console.log(`🤖 Найдено промптов: ${result.prompts.length}`);

        res.json({
            success: true,
            data: result.prompts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(result.total / parseInt(limit)),
                totalDocs: result.total,
                limit: parseInt(limit),
                startDoc: ((parseInt(page) - 1) * parseInt(limit)) + 1,
                endDoc: Math.min(parseInt(page) * parseInt(limit), result.total)
            }
        });

    } catch (error) {
        console.error('❌ Ошибка получения промптов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения промптов: ' + error.message
        });
    }
});

/**
 * 📊 GET /api/reader/prompts/stats - Получить статистику промптов
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('🤖 GET /prompts/stats - получение статистики');

        const stats = await promptService.getPromptsStats();
        
        console.log('🤖 Статистика промптов:', stats);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Ошибка получения статистики промптов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения статистики: ' + error.message
        });
    }
});

/**
 * 👁️ GET /api/reader/prompts/:id - Получить конкретный промпт
 */
router.get('/:id', async (req, res) => {
    try {
        console.log(`🤖 GET /prompts/${req.params.id} - получение промпта`);

        const prompt = await promptService.getPromptById(req.params.id);
        
        if (!prompt) {
            return res.status(404).json({
                success: false,
                error: 'Промпт не найден'
            });
        }

        res.json({
            success: true,
            data: prompt
        });

    } catch (error) {
        console.error('❌ Ошибка получения промпта:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения промпта: ' + error.message
        });
    }
});

/**
 * ➕ POST /api/reader/prompts - Создать новый промпт
 */
router.post('/', async (req, res) => {
    try {
        console.log('🤖 POST /prompts - создание нового промпта');
        console.log('🤖 Request body:', req.body);

        const {
            name,
            category,
            content,
            variables = [],
            language = 'ru',
            status = 'active',
            priority = 'normal',
            description = ''
        } = req.body;

        // Валидация обязательных полей
        if (!name || !category || !content) {
            return res.status(400).json({
                success: false,
                error: 'Обязательные поля: name, category, content'
            });
        }

        // Валидация содержимого
        if (content.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Содержание промпта должно быть минимум 10 символов'
            });
        }

        // Подготовка данных промпта
        const promptData = {
            id: uuidv4(),
            name: name.trim(),
            category,
            content: content.trim(),
            variables: Array.isArray(variables) ? variables : [],
            language,
            status,
            priority,
            description: description.trim(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log('🤖 Создание промпта:', promptData.name);

        // Создание промпта
        const createdPrompt = await promptService.createPrompt(promptData);

        console.log('✅ Промпт создан успешно:', createdPrompt.id);

        res.status(201).json({
            success: true,
            data: createdPrompt
        });

    } catch (error) {
        console.error('❌ Ошибка создания промпта:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка создания промпта: ' + error.message
        });
    }
});

/**
 * ✏️ PUT /api/reader/prompts/:id - Обновить промпт
 */
router.put('/:id', async (req, res) => {
    try {
        console.log(`🤖 PUT /prompts/${req.params.id} - обновление промпта`);

        const {
            name,
            category,
            content,
            variables,
            language,
            status,
            priority,
            description
        } = req.body;

        // Проверка существования промпта
        const existingPrompt = await promptService.getPromptById(req.params.id);
        if (!existingPrompt) {
            return res.status(404).json({
                success: false,
                error: 'Промпт не найден'
            });
        }

        // Подготовка данных для обновления
        const updateData = {
            ...req.body,
            updatedAt: new Date()
        };

        // Валидация, если поля переданы
        if (name !== undefined && !name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Название промпта не может быть пустым'
            });
        }

        if (content !== undefined && content.trim().length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Содержание промпта должно быть минимум 10 символов'
            });
        }

        console.log('🤖 Обновление промпта:', req.params.id);

        // Обновление промпта
        const updatedPrompt = await promptService.updatePrompt(req.params.id, updateData);

        console.log('✅ Промпт обновлен успешно');

        res.json({
            success: true,
            data: updatedPrompt
        });

    } catch (error) {
        console.error('❌ Ошибка обновления промпта:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка обновления промпта: ' + error.message
        });
    }
});

/**
 * 🗑️ DELETE /api/reader/prompts/:id - Удалить промпт
 */
router.delete('/:id', async (req, res) => {
    try {
        console.log(`🤖 DELETE /prompts/${req.params.id} - удаление промпта`);

        // Проверка существования промпта
        const existingPrompt = await promptService.getPromptById(req.params.id);
        if (!existingPrompt) {
            return res.status(404).json({
                success: false,
                error: 'Промпт не найден'
            });
        }

        // Удаление промпта
        await promptService.deletePrompt(req.params.id);

        console.log('✅ Промпт удален успешно');

        res.json({
            success: true,
            message: 'Промпт успешно удален'
        });

    } catch (error) {
        console.error('❌ Ошибка удаления промпта:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка удаления промпта: ' + error.message
        });
    }
});

/**
 * 🧪 POST /api/reader/prompts/test - Тестировать промпт
 */
router.post('/test', async (req, res) => {
    try {
        console.log('🤖 POST /prompts/test - тестирование промпта');

        const { promptId, variables = {} } = req.body;

        if (!promptId) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать promptId'
            });
        }

        // Получение промпта
        const prompt = await promptService.getPromptById(promptId);
        if (!prompt) {
            return res.status(404).json({
                success: false,
                error: 'Промпт не найден'
            });
        }

        console.log('🤖 Тестирование промпта:', prompt.name);
        
        const startTime = Date.now();

        try {
            // Обработка промпта с переменными
            let processedPrompt = prompt.content;
            
            // Замена переменных в промпте
            if (variables && typeof variables === 'object') {
                for (const [key, value] of Object.entries(variables)) {
                    const placeholder = `{${key}}`;
                    processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), value);
                }
            }

            console.log('🤖 Обработанный промпт:', processedPrompt.substring(0, 100) + '...');

            // Тестирование через Claude API
            const claudeResponse = await claudeService.generateResponse(processedPrompt, {
                platform: 'admin_test',
                userId: 'test_user'
            });

            const executionTime = Date.now() - startTime;

            console.log(`✅ Тестирование завершено за ${executionTime}ms`);

            res.json({
                success: true,
                data: {
                    success: true,
                    processedPrompt,
                    result: claudeResponse.message,
                    executionTime: `${executionTime}ms`,
                    usage: claudeResponse.usage || null
                }
            });

        } catch (claudeError) {
            const executionTime = Date.now() - startTime;
            
            console.error('❌ Ошибка Claude API:', claudeError);

            res.json({
                success: true,
                data: {
                    success: false,
                    processedPrompt: processedPrompt || prompt.content,
                    error: claudeError.message,
                    executionTime: `${executionTime}ms`
                }
            });
        }

    } catch (error) {
        console.error('❌ Ошибка тестирования промпта:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка тестирования промпта: ' + error.message
        });
    }
});

/**
 * ✅ POST /api/reader/prompts/validate-all - Валидировать все промпты
 */
router.post('/validate-all', async (req, res) => {
    try {
        console.log('🤖 POST /prompts/validate-all - валидация всех промптов');

        const { prompts: allPrompts } = await promptService.getPrompts({
            filters: {},
            page: 1,
            limit: 1000 // Получаем все промпты
        });

        let validCount = 0;
        let invalidCount = 0;
        const validationResults = [];

        for (const prompt of allPrompts) {
            try {
                // Базовая валидация
                const isValid = prompt.name && 
                               prompt.content && 
                               prompt.content.length >= 10 &&
                               prompt.category;

                if (isValid) {
                    validCount++;
                } else {
                    invalidCount++;
                    validationResults.push({
                        id: prompt.id,
                        name: prompt.name,
                        errors: [
                            !prompt.name ? 'Отсутствует название' : null,
                            !prompt.content ? 'Отсутствует содержание' : null,
                            prompt.content && prompt.content.length < 10 ? 'Содержание слишком короткое' : null,
                            !prompt.category ? 'Отсутствует категория' : null
                        ].filter(Boolean)
                    });
                }
            } catch (error) {
                invalidCount++;
                validationResults.push({
                    id: prompt.id,
                    name: prompt.name,
                    errors: [`Ошибка валидации: ${error.message}`]
                });
            }
        }

        console.log(`✅ Валидация завершена: ${validCount}/${allPrompts.length} валидны`);

        res.json({
            success: true,
            total: allPrompts.length,
            valid: validCount,
            invalid: invalidCount,
            validationResults: invalidCount > 0 ? validationResults : []
        });

    } catch (error) {
        console.error('❌ Ошибка валидации промптов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка валидации промптов: ' + error.message
        });
    }
});

/**
 * 📤 GET /api/reader/prompts/export - Экспорт всех промптов в JSON
 */
router.get('/export', async (req, res) => {
    try {
        console.log('🤖 GET /prompts/export - экспорт промптов');

        const { prompts } = await promptService.getPrompts({
            filters: {},
            page: 1,
            limit: 10000 // Получаем все промпты
        });

        // Подготовка данных для экспорта
        const exportData = {
            exportDate: new Date().toISOString(),
            totalPrompts: prompts.length,
            prompts: prompts.map(prompt => ({
                id: prompt.id,
                name: prompt.name,
                category: prompt.category,
                content: prompt.content,
                variables: prompt.variables,
                language: prompt.language,
                status: prompt.status,
                priority: prompt.priority,
                description: prompt.description,
                createdAt: prompt.createdAt,
                updatedAt: prompt.updatedAt
            }))
        };

        console.log(`✅ Экспорт готов: ${prompts.length} промптов`);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="reader-prompts-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(exportData);

    } catch (error) {
        console.error('❌ Ошибка экспорта промптов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка экспорта промптов: ' + error.message
        });
    }
});

module.exports = router;