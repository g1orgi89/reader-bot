/**
 * @fileoverview Reader Bot Mini App API Endpoints
 * @description API маршруты для Telegram Mini App
 */

const express = require('express');
const router = express.Router();

/**
 * @description Telegram аутентификация для Mini App
 * @route POST /api/reader/auth/telegram
 */
router.post('/auth/telegram', async (req, res) => {
    try {
        console.log('📱 Telegram Auth Request:', req.body);
        
        const { telegramData, user } = req.body;
        
        if (!user || !user.id) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют данные пользователя Telegram'
            });
        }

        // Простая аутентификация для начала
        const authData = {
            success: true,
            user: {
                id: user.id,
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                username: user.username || '',
                telegramId: user.id
            },
            token: `temp_token_${user.id}_${Date.now()}`, // Временный токен
            isOnboardingCompleted: false // По умолчанию показываем онбординг
        };

        console.log('✅ Auth Success:', authData);
        res.json(authData);

    } catch (error) {
        console.error('❌ Telegram Auth Error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка аутентификации'
        });
    }
});

/**
 * @description Проверка статуса онбординга
 * @route GET /api/reader/auth/onboarding-status
 */
router.get('/auth/onboarding-status', async (req, res) => {
    try {
        console.log('📊 Onboarding Status Check');
        
        // Пока всегда возвращаем что онбординг не завершен
        res.json({
            success: true,
            isCompleted: false,
            data: null
        });

    } catch (error) {
        console.error('❌ Onboarding Status Error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка проверки статуса онбординга'
        });
    }
});

/**
 * @description Завершение онбординга
 * @route POST /api/reader/auth/complete-onboarding
 */
router.post('/auth/complete-onboarding', async (req, res) => {
    try {
        console.log('✅ Complete Onboarding Request:', req.body);
        
        const { answers, email, source } = req.body;
        
        // Валидация основных данных
        if (!answers || !email) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют обязательные данные'
            });
        }

        // Пока просто сохраняем в логи
        console.log('📝 Onboarding Data:', {
            answers,
            email,
            source,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Онбординг успешно завершен',
            data: {
                userId: `user_${Date.now()}`,
                isOnboardingCompleted: true
            }
        });

    } catch (error) {
        console.error('❌ Complete Onboarding Error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка завершения онбординга'
        });
    }
});

/**
 * @description Debug endpoint для viewport данных
 * @route POST /api/reader/debug/viewport
 */
router.post('/debug/viewport', async (req, res) => {
    try {
        console.log('🔧 Debug Viewport:', req.body);
        
        res.json({
            success: true,
            message: 'Viewport data received',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Debug Viewport Error:', error);
        res.status(500).json({
            success: false,
            error: 'Debug error'
        });
    }
});

/**
 * @description Базовая проверка работоспособности API
 * @route GET /api/reader/health
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Reader API is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;