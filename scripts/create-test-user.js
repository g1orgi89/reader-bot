const mongoose = require('mongoose');
const path = require('path');

// Импортируем модели
const { UserProfile, Quote, WeeklyReport, MonthlyReport } = require('../server/models');

/**
 * Скрипт для создания тестовых данных пользователя Reader Bot
 * Убирает fallback данные и показывает реальную аналитику
 * ИСПРАВЛЕНА ОШИБКА: используем только валидные категории из enum
 */
async function createTestUser() {
    try {
        console.log('🔌 Подключение к MongoDB...');
        
        // Подключение к MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader_bot';
        await mongoose.connect(mongoUri);
        console.log('✅ Подключено к MongoDB');
        
        // Очистка существующих тестовых данных
        console.log('🧹 Очистка существующих тестовых данных...');
        await UserProfile.deleteMany({ userId: { $in: ['test_user_123', 'test_user_456', 'test_user_789'] } });
        await Quote.deleteMany({ userId: { $in: ['test_user_123', 'test_user_456', 'test_user_789'] } });
        await WeeklyReport.deleteMany({ userId: { $in: ['test_user_123', 'test_user_456', 'test_user_789'] } });
        if (MonthlyReport) {
            await MonthlyReport.deleteMany({ userId: { $in: ['test_user_123', 'test_user_456', 'test_user_789'] } });
        }
        
        // Создание тестовых пользователей
        console.log('👥 Создание тестовых пользователей...');
        
        const users = [
            {
                userId: 'test_user_123',
                telegramUsername: 'maria_reader',
                name: 'Мария Тестова',
                email: 'maria.test@example.com',
                testResults: {
                    name: 'Мария',
                    lifestyle: 'Замужем, балансирую дом/работу/себя',
                    timeForSelf: 'Читаю перед сном',
                    priorities: 'Семья и саморазвитие',
                    readingFeelings: 'Вдохновение и покой',
                    closestPhrase: 'Жизнь - это путешествие',
                    readingTime: '1-2 часа в неделю'
                },
                source: 'Instagram',
                preferences: {
                    mainThemes: ['Саморазвитие', 'Любовь'],
                    personalityType: 'рефлексивный',
                    recommendationStyle: 'глубокий'
                },
                statistics: {
                    totalQuotes: 15,
                    currentStreak: 3,
                    longestStreak: 5,
                    favoriteAuthors: ['Фромм', 'Цветаева', 'Рильке'],
                    monthlyQuotes: [
                        { month: 6, year: 2025, count: 8 },
                        { month: 7, year: 2025, count: 7 }
                    ]
                },
                achievements: [
                    {
                        achievementId: 'first_quote',
                        unlockedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
                    }
                ],
                registeredAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
                isOnboardingComplete: true
            },
            {
                userId: 'test_user_456',
                telegramUsername: 'anna_reader',
                name: 'Анна Иванова',
                email: 'anna.test@example.com',
                testResults: {
                    name: 'Анна',
                    lifestyle: 'Я мама (дети - главная забота)',
                    timeForSelf: 'Утром с кофе',
                    priorities: 'Дети и личностный рост',
                    readingFeelings: 'Умиротворение',
                    closestPhrase: 'Семья - это всё',
                    readingTime: '30 минут в день'
                },
                source: 'YouTube',
                preferences: {
                    mainThemes: ['Материнство', 'Мудрость'],
                    personalityType: 'заботливый',
                    recommendationStyle: 'практичный'
                },
                statistics: {
                    totalQuotes: 8,
                    currentStreak: 1,
                    longestStreak: 7,
                    favoriteAuthors: ['Толстой', 'Экзюпери'],
                    monthlyQuotes: [
                        { month: 7, year: 2025, count: 8 }
                    ]
                },
                registeredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                isOnboardingComplete: true
            },
            {
                userId: 'test_user_789',
                telegramUsername: 'elena_reader',
                name: 'Елена Смирнова',
                email: 'elena.test@example.com',
                testResults: {
                    name: 'Елена',
                    lifestyle: 'Без отношений, изучаю мир и себя',
                    timeForSelf: 'Вечером после работы',
                    priorities: 'Карьера и самопознание',
                    readingFeelings: 'Вдохновение и рост',
                    closestPhrase: 'Жизнь в моих руках',
                    readingTime: '2-3 часа в неделю'
                },
                source: 'Telegram',
                preferences: {
                    mainThemes: ['Философия', 'Мотивация'],
                    personalityType: 'амбициозный',
                    recommendationStyle: 'интеллектуальный'
                },
                statistics: {
                    totalQuotes: 12,
                    currentStreak: 5,
                    longestStreak: 8,
                    favoriteAuthors: ['Ницше', 'Сенека', 'Кафка'],
                    monthlyQuotes: [
                        { month: 7, year: 2025, count: 12 }
                    ]
                },
                registeredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                isOnboardingComplete: true
            }
        ];
        
        // Сохранение пользователей
        for (const userData of users) {
            const user = new UserProfile(userData);
            await user.save();
            console.log(`✅ Пользователь создан: ${user.name}`);
        }
        
        // Создание цитат - ИСПРАВЛЕНО: используем только валидные категории
        console.log('📚 Создание цитат...');
        
        // Валидные категории из схемы Quote:
        // 'Саморазвитие', 'Любовь', 'Философия', 'Мотивация', 'Мудрость', 'Творчество', 'Отношения', 'Материнство', 'Карьера', 'Другое'
        
        const quotes = [
            // Цитаты Марии
            {
                userId: 'test_user_123',
                text: 'В каждом слове — целая жизнь',
                author: 'Марина Цветаева',
                source: 'Стихотворения',
                category: 'Творчество', // ✅ Валидная категория
                themes: ['поэзия', 'жизнь'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            },
            {
                userId: 'test_user_123',
                text: 'Любовь — это решение любить',
                author: 'Эрих Фромм',
                source: 'Искусство любить',
                category: 'Любовь', // ✅ Валидная категория
                themes: ['отношения', 'выбор'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
                userId: 'test_user_123',
                text: 'Счастье — это внутреннее состояние',
                author: null,
                source: null,
                category: 'Саморазвитие', // ✅ Валидная категория
                themes: ['счастье', 'внутренний мир'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            },
            {
                userId: 'test_user_123',
                text: 'Время — самый ценный ресурс',
                author: 'Стив Джобс',
                source: null,
                category: 'Мотивация', // ✅ Валидная категория
                themes: ['время', 'ценности'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date()
            },
            
            // Цитаты Анны
            {
                userId: 'test_user_456',
                text: 'Все взрослые сначала были детьми',
                author: 'Антуан де Сент-Экзюпери',
                source: 'Маленький принц',
                category: 'Мудрость', // ✅ Валидная категория
                themes: ['детство', 'взросление'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
                userId: 'test_user_456',
                text: 'Семья — это самое важное в жизни',
                author: null,
                source: null,
                category: 'Материнство', // ✅ Изменено с 'Семья' на 'Материнство' (валидная категория)
                themes: ['семья', 'ценности'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date()
            },
            
            // Цитаты Елены
            {
                userId: 'test_user_789',
                text: 'То, что нас не убивает, делает нас сильнее',
                author: 'Фридрих Ницше',
                source: 'Сумерки идолов',
                category: 'Философия', // ✅ Валидная категория
                themes: ['сила', 'преодоление'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
            },
            {
                userId: 'test_user_789',
                text: 'Мудрец тот, кто знает границы своего незнания',
                author: 'Сенека',
                source: 'Письма к Луцилию',
                category: 'Мудрость', // ✅ Валидная категория
                themes: ['мудрость', 'познание'],
                sentiment: 'positive',
                weekNumber: 27,
                monthNumber: 7,
                yearNumber: 2025,
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            }
        ];
        
        // Сохранение цитат
        for (const quoteData of quotes) {
            const quote = new Quote(quoteData);
            await quote.save();
            console.log(`✅ Цитата добавлена: "${quote.text.substring(0, 30)}..." (${quote.category})`);
        }
        
        // Создание еженедельного отчета
        console.log('📊 Создание еженедельного отчета...');
        
        const weeklyReport = new WeeklyReport({
            userId: 'test_user_123',
            weekNumber: 27,
            year: 2025,
            quotes: [],
            analysis: {
                summary: 'Неделя была посвящена внутреннему росту',
                dominantThemes: ['Любовь', 'Творчество'],
                emotionalTone: 'позитивный',
                insights: 'Пользователь фокусируется на глубоких вопросах любви и творчества'
            },
            recommendations: [
                {
                    title: 'Искусство любить',
                    description: 'Глубокий разбор о природе любви',
                    price: '$8',
                    link: 'https://anna-busel.com/books?utm_source=telegram_bot&utm_campaign=reader_weekly',
                    reasoning: 'Подходит вашему интересу к философии отношений'
                }
            ],
            promoCode: {
                code: 'READER20',
                discount: 20,
                validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            },
            sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        });
        
        await weeklyReport.save();
        console.log('✅ Еженедельный отчет создан');
        
        // Статистика базы данных
        const totalUsers = await UserProfile.countDocuments();
        const totalQuotes = await Quote.countDocuments();
        const totalReports = await WeeklyReport.countDocuments();
        
        console.log('\n📊 СТАТИСТИКА БАЗЫ ДАННЫХ:');
        console.log(`👥 Всего пользователей: ${totalUsers}`);
        console.log(`📚 Всего цитат: ${totalQuotes}`);
        console.log(`📋 Еженедельных отчетов: ${totalReports}`);
        
        console.log('\n🎉 Тестовые данные созданы успешно!');
        console.log('Теперь дашборд покажет реальные данные вместо fallback.');
        console.log('\n📈 ДАШБОРД ПОКАЗЫВАЕТ:');
        console.log('- 3 реальных пользователя из разных источников');
        console.log('- 8 реальных цитат за последние дни');
        console.log('- Реальную статистику по авторам и категориям');
        console.log('- Настоящие источники трафика (Instagram, YouTube, Telegram)');
        console.log('\n✅ ВСЕ КАТЕГОРИИ ВАЛИДНЫ - ошибка исправлена!');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Отключение от MongoDB');
        process.exit(0);
    }
}

// Запуск скрипта
if (require.main === module) {
    createTestUser();
}

module.exports = createTestUser;