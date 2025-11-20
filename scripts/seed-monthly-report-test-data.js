/**
 * 🧪 СКРИПТ ДЛЯ СОЗДАНИЯ ТЕСТОВЫХ ДАННЫХ МЕСЯЧНОГО ОТЧЁТА
 * 
 * Что делает:
 * 1. Добавляет цитаты за последние 4 недели
 * 2. Генерирует 4 еженедельных отчёта
 * 3. Генерирует 1 месячный отчёт
 * 
 * Использование:
 * node scripts/seed-monthly-report-test-data.js <userId>
 * 
 * Пример:
 * node scripts/seed-monthly-report-test-data.js 123456789
 */

const mongoose = require('mongoose');
const Quote = require('../server/models/Quote');
const User = require('../server/models/User');
const WeeklyReport = require('../server/models/WeeklyReport');
const MonthlyReport = require('../server/models/MonthlyReport');

// ✅ Пул тестовых цитат для реалистичности
const TEST_QUOTES = [
    {
        text: "Счастье — это внутреннее состояние, а не внешние обстоятельства",
        author: "Виктор Франкл"
    },
    {
        text: "Единственный способ делать великую работу — любить то, что ты делаешь",
        author: "Стив Джобс"
    },
    {
        text: "Будь собой, все остальные роли уже заняты",
        author: "Оскар Уайльд"
    },
    {
        text: "Жизнь — это то, что происходит с тобой, пока ты строишь другие планы",
        author: "Джон Леннон"
    },
    {
        text: "Любовь — это решение любить",
        author: "Эрих Фромм"
    },
    {
        text: "В каждом слове — целая жизнь",
        author: "Марина Цветаева"
    },
    {
        text: "Хорошая жизнь строится, а не дается по умолчанию",
        author: "Анна Бусел"
    },
    {
        text: "Смысл жизни — в самой жизни",
        author: "Виктор Франкл"
    },
    {
        text: "Мы не можем выбирать обстоятельства, но можем выбирать своё отношение к ним",
        author: "Карл Юнг"
    },
    {
        text: "Будущее принадлежит тем, кто верит в красоту своих мечтаний",
        author: "Элеонора Рузвельт"
    },
    {
        text: "Самое важное — быть честным с самим собой",
        author: "Фёдор Достоевский"
    },
    {
        text: "Единственное, что стоит между тобой и твоей мечтой — это твой страх",
        author: "Нил Гейман"
    },
    {
        text: "Жить — значит меняться, а совершенствоваться — значит меняться часто",
        author: "Джон Ньюман"
    },
    {
        text: "Дорогу осилит идущий",
        author: "Древняя мудрость"
    },
    {
        text: "Все мы немного сумасшедшие. И это прекрасно",
        author: "Доктор Сьюз"
    },
    {
        text: "Не бойся медленно идти, бойся стоять на месте",
        author: "Китайская мудрость"
    },
    {
        text: "Жизнь начинается там, где заканчивается зона комфорта",
        author: "Нил Уолш"
    },
    {
        text: "Ты становишься тем, о чём думаешь",
        author: "Будда"
    },
    {
        text: "Познай самого себя",
        author: "Сократ"
    },
    {
        text: "Мудрость — это знание того, что ты ничего не знаешь",
        author: "Сократ"
    }
];

// ✅ Получение случайной цитаты
function getRandomQuote() {
    return TEST_QUOTES[Math.floor(Math.random() * TEST_QUOTES.length)];
}

// ✅ Получение даты N недель назад
function getWeeksAgo(weeksAgo, dayOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() - (weeksAgo * 7) + dayOffset);
    return date;
}

// ✅ Создание цитат за определённую неделю
async function createQuotesForWeek(userId, weeksAgo, quotesCount = 8) {
    console.log(`📝 Создаём ${quotesCount} цитат для недели ${weeksAgo} (${weeksAgo} недель назад)`);
    
    const quotes = [];
    
    // Распределяем цитаты по дням недели (понедельник - воскресенье)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        // Случайное количество цитат в день (0-2)
        const dailyQuotes = Math.floor(Math.random() * 3);
        
        for (let i = 0; i < dailyQuotes && quotes.length < quotesCount; i++) {
            const randomQuote = getRandomQuote();
            const createdAt = getWeeksAgo(weeksAgo, dayOffset);
            
            const quote = new Quote({
                userId,
                text: randomQuote.text,
                author: randomQuote.author,
                source: 'test-script',
                createdAt
            });
            
            await quote.save();
            quotes.push(quote);
            
            console.log(`  ✅ День ${dayOffset + 1}: "${randomQuote.text.substring(0, 40)}..."`);
        }
    }
    
    console.log(`✅ Создано ${quotes.length} цитат для недели ${weeksAgo}`);
    return quotes;
}

// ✅ Создание еженедельного отчёта
async function createWeeklyReport(userId, weeksAgo) {
    console.log(`📊 Создаём еженедельный отчёт для недели ${weeksAgo}`);
    
    // Получаем цитаты за эту неделю
    const weekStart = getWeeksAgo(weeksAgo, 0);
    const weekEnd = getWeeksAgo(weeksAgo - 1, 0);
    
    const quotes = await Quote.find({
        userId,
        createdAt: {
            $gte: weekStart,
            $lt: weekEnd
        }
    }).sort({ createdAt: 1 });
    
    if (quotes.length === 0) {
        console.warn(`⚠️ Нет цитат для недели ${weeksAgo}, пропускаем отчёт`);
        return null;
    }
    
    // Вычисляем статистику
    const uniqueAuthors = [...new Set(quotes.map(q => q.author).filter(Boolean))];
    const activeDays = [...new Set(quotes.map(q => 
        new Date(q.createdAt).toISOString().split('T')[0]
    ))].length;
    
    // Вычисляем ISO неделю
    const { isoWeek, isoYear } = getISOWeekInfo(weekStart);
    
    // Создаём отчёт
    const report = new WeeklyReport({
        userId,
        weekNumber: isoWeek,
        year: isoYear,
        quotes: quotes.map(q => ({
            text: q.text,
            author: q.author,
            createdAt: q.createdAt
        })),
        metrics: {
            quotes: quotes.length,
            uniqueAuthors: uniqueAuthors.length,
            activeDays,
            progressQuotesPct: Math.min(Math.round((quotes.length / 30) * 100), 100),
            progressDaysPct: Math.min(Math.round((activeDays / 7) * 100), 100)
        },
        analysis: {
            summary: `Отличная неделя! Вы сохранили ${quotes.length} цитат за ${activeDays} дней. Ваш фокус на самопознании и саморазвитии очень заметен.`,
            insights: `Ваши цитаты показывают активный поиск внутренней гармонии. Темы недели: ${uniqueAuthors.slice(0, 3).join(', ')}.`,
            emotionalTone: weeksAgo === 3 ? 'вдохновляющий' : weeksAgo === 2 ? 'задумчивый' : weeksAgo === 1 ? 'позитивный' : 'энергичный',
            dominantThemes: ['саморазвитие', 'самопознание', 'философия'],
            secondaryThemes: ['любовь', 'счастье', 'смысл жизни']
        },
        sentAt: weekEnd,
        status: 'sent'
    });
    
    await report.save();
    console.log(`✅ Еженедельный отчёт создан: неделя ${isoWeek}, ${isoYear} (${quotes.length} цитат)`);
    
    return report;
}

// ✅ Вычисление ISO недели
function getISOWeekInfo(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const isoYear = d.getUTCFullYear();
    
    return { isoWeek, isoYear };
}

// ✅ Создание месячного отчёта
async function createMonthlyReport(userId) {
    console.log(`📊 Создаём месячный отчёт`);
    
    // Получаем данные за последние 4 недели
    const fourWeeksAgo = getWeeksAgo(4, 0);
    const now = new Date();
    
    const quotes = await Quote.find({
        userId,
        createdAt: {
            $gte: fourWeeksAgo,
            $lt: now
        }
    }).sort({ createdAt: 1 });
    
    if (quotes.length === 0) {
        console.warn(`⚠️ Нет цитат за месяц, пропускаем месячный отчёт`);
        return null;
    }
    
    // Вычисляем статистику
    const uniqueAuthors = [...new Set(quotes.map(q => q.author).filter(Boolean))];
    const activeDays = [...new Set(quotes.map(q => 
        new Date(q.createdAt).toISOString().split('T')[0]
    ))].length;
    
    // Получаем еженедельные отчёты
    const weeklyReports = await WeeklyReport.find({
        userId,
        sentAt: {
            $gte: fourWeeksAgo,
            $lt: now
        }
    }).sort({ sentAt: 1 });
    
    // Определяем месяц и год
    const reportDate = new Date();
    const month = reportDate.getMonth() + 1; // 1-12
    const year = reportDate.getFullYear();
    
    // Создаём месячный отчёт
    const report = new MonthlyReport({
        userId,
        reportType: 'monthly',
        period: {
            month,
            year,
            startDate: fourWeeksAgo,
            endDate: now
        },
        content: {
            summary: `Прекрасный месяц! За ${month === 11 ? 'ноябрь' : month === 12 ? 'декабрь' : 'этот месяц'} вы сохранили ${quotes.length} цитат из ${uniqueAuthors.length} источников за ${activeDays} активных дней. Ваши цитаты показывают активный поиск внутренней гармонии и фокус на саморазвитии. Вы проявляете интерес к философским темам, психологии отношений и самопознанию. Рекомендую углубиться в работы Виктора Франкла и Эриха Фромма.`,
            statistics: {
                totalQuotes: quotes.length,
                booksRead: uniqueAuthors.length,
                activeDays,
                favoriteAuthors: uniqueAuthors.slice(0, 5)
            },
            insights: [
                'Ваш фокус на саморазвитии и самопознании очень заметен',
                'Интерес к философским темам показывает глубину вашего мышления',
                'Цитаты о любви и отношениях говорят о важности этой темы для вас',
                'Регулярность добавления цитат показывает вашу дисциплину'
            ],
            recommendations: [
                {
                    title: 'Искусство любить',
                    author: 'Эрих Фромм',
                    bookSlug: 'iskusstvo-lyubit',
                    description: 'Психологический анализ природы любви',
                    reason: 'На основе ваших цитат о любви и отношениях',
                    priority: 1,
                    priceByn: 35
                },
                {
                    title: 'Человек в поисках смысла',
                    author: 'Виктор Франкл',
                    bookSlug: 'chelovek-v-poiskah-smysla',
                    description: 'О поиске смысла жизни через логотерапию',
                    reason: 'Ваш интерес к философии и смыслу жизни',
                    priority: 2,
                    priceByn: 32
                }
            ]
        },
        generatedAt: now,
        status: 'generated'
    });
    
    await report.save();
    console.log(`✅ Месячный отчёт создан: ${month}/${year} (${quotes.length} цитат)`);
    
    return report;
}

// ✅ Главная функция
async function seedMonthlyReportData(userId) {
    try {
        console.log('🚀 Начинаем создание тестовых данных для месячного отчёта');
        console.log(`👤 User ID: ${userId}`);
        
        // Подключаемся к MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reader_bot_dev');
        console.log('✅ Подключено к MongoDB');
        
        // Проверяем существование пользователя
        const user = await User.findOne({ telegramId: parseInt(userId) });
        if (!user) {
            console.error(`❌ Пользователь с telegramId ${userId} не найден`);
            process.exit(1);
        }
        
        console.log(`✅ Найден пользователь: ${user.firstName} ${user.lastName || ''}`);
        
        // 1. Создаём цитаты за последние 4 недели
        console.log('\n📝 ЭТАП 1: Создание цитат');
        for (let week = 3; week >= 0; week--) {
            await createQuotesForWeek(user._id, week, 8 + Math.floor(Math.random() * 5)); // 8-12 цитат
        }
        
        // 2. Создаём еженедельные отчёты
        console.log('\n📊 ЭТАП 2: Создание еженедельных отчётов');
        for (let week = 3; week >= 0; week--) {
            await createWeeklyReport(user._id, week);
        }
        
        // 3. Создаём месячный отчёт
        console.log('\n📊 ЭТАП 3: Создание месячного отчёта');
        await createMonthlyReport(user._id);
        
        console.log('\n✅ ВСЕ ДАННЫЕ УСПЕШНО СОЗДАНЫ!');
        console.log('\n📊 Итоговая статистика:');
        
        const totalQuotes = await Quote.countDocuments({ userId: user._id });
        const totalWeeklyReports = await WeeklyReport.countDocuments({ userId: user._id });
        const totalMonthlyReports = await MonthlyReport.countDocuments({ userId: user._id });
        
        console.log(`  - Всего цитат: ${totalQuotes}`);
        console.log(`  - Еженедельных отчётов: ${totalWeeklyReports}`);
        console.log(`  - Месячных отчётов: ${totalMonthlyReports}`);
        
        console.log('\n🎉 Готово! Теперь можете тестировать месячные отчёты в приложении');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Отключено от MongoDB');
    }
}

// ✅ Запуск скрипта
const userId = process.argv[2];

if (!userId) {
    console.error('❌ Использование: node scripts/seed-monthly-report-test-data.js <userId>');
    console.error('❌ Пример: node scripts/seed-monthly-report-test-data.js 123456789');
    process.exit(1);
}

seedMonthlyReportData(userId);
