/**
 * @fileoverview Скрипт миграции данных из хардкода в MongoDB
 * @description Переносим хардкодированные данные из сервисов в новые модели БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');
const BookCatalog = require('../models/BookCatalog');
const AnnouncementCatalog = require('../models/AnnouncementCatalog');
const PromoCode = require('../models/PromoCode');
const Category = require('../models/Category');
const TargetAudience = require('../models/TargetAudience');
const UtmTemplate = require('../models/UtmTemplate');
const AnnaPersona = require('../models/AnnaPersona');

/**
 * Данные для миграции из weeklyReportService.js
 */
const BOOK_CATALOG_DATA = [
  {
    title: 'Разбор "Искусство любить" Эриха Фромма',
    author: 'Эрих Фромм',
    description: 'О построении здоровых отношений с собой и миром',
    price: '$8',
    categories: ['Любовь', 'Отношения'],
    targetThemes: ['любов', 'отношен', 'сердц', 'чувств'],
    bookSlug: 'art_of_loving',
    reasoning: 'Ваши цитаты показывают интерес к теме любви и отношений',
    priority: 8
  },
  {
    title: '"Письма к молодому поэту" Рильке',
    author: 'Райнер Мария Рильке',
    description: 'О творчестве, самопознании и поиске своего пути',
    price: '$8',
    categories: ['Философия', 'Творчество', 'Саморазвитие'],
    targetThemes: ['мудр', 'философи', 'творчеств', 'путь'],
    bookSlug: 'letters_to_young_poet',
    reasoning: 'Судя по вашим цитатам, вас привлекает философский взгляд на жизнь',
    priority: 7
  },
  {
    title: 'Курс "Быть собой"',
    description: 'О самопринятии и аутентичности',
    price: '$12',
    categories: ['Саморазвитие'],
    targetThemes: ['саморазвит', 'самопознан', 'аутентичн'],
    bookSlug: 'be_yourself_course',
    reasoning: 'Ваш выбор цитат говорит о стремлении к личностному росту',
    priority: 6
  },
  {
    title: 'Курс "Мудрая мама"',
    description: 'Как сохранить себя в материнстве и воспитать счастливых детей',
    price: '$20',
    categories: ['Материнство', 'Семья'],
    targetThemes: ['семь', 'мам', 'дет', 'материнств'],
    bookSlug: 'wise_mother_course',
    reasoning: 'Ваши цитаты отражают интерес к семейным ценностям',
    priority: 9
  },
  {
    title: '"Маленький принц" с комментариями',
    author: 'Антуан де Сент-Экзюпери',
    description: 'О простых истинах жизни и важности человеческих связей',
    price: '$6',
    categories: ['Универсальное', 'Счастье', 'Философия'],
    targetThemes: ['счасть', 'радост', 'жизн', 'связи'],
    bookSlug: 'little_prince',
    reasoning: 'Универсальная книга для размышлений о жизни и ценностях',
    priority: 10
  }
];

/**
 * Данные для миграции из announcementService.js
 */
const ANNOUNCEMENT_CATALOG_DATA = [
  {
    title: 'Новый книжный клуб "Женщина и литература"',
    description: 'Месячный курс для тех, кто хочет глубже понять себя через книги',
    price: '$25',
    targetAudience: ['self_development', 'women'],
    announcementSlug: 'book_club_women_literature',
    months: [1, 4, 7, 10], // Январь, апрель, июль, октябрь
    priority: 8
  },
  {
    title: 'Курс "Мудрая мама"',
    description: 'Как сохранить себя в материнстве и воспитать счастливых детей',
    price: '$20',
    targetAudience: ['mothers', 'family'],
    announcementSlug: 'wise_mother_course',
    months: [2, 5, 8, 11], // Февраль, май, август, ноябрь
    priority: 9
  },
  {
    title: 'Интенсив "Любовь без драм"',
    description: 'Строим здоровые отношения на основе психологии и литературы',
    price: '$18',
    targetAudience: ['relationships', 'love'],
    announcementSlug: 'love_intensive',
    months: [3, 6, 9, 12], // Март, июнь, сентябрь, декабрь
    priority: 7
  },
  {
    title: 'Курс "Найти себя"',
    description: 'Путешествие к аутентичности через литературу и самопознание',
    price: '$22',
    targetAudience: ['self_development', 'personal_growth'],
    announcementSlug: 'self_discovery_course',
    months: [], // Доступен всегда
    priority: 6
  }
];

/**
 * Данные промокодов из weeklyReportService.js
 */
const PROMO_CODE_DATA = [
  {
    code: 'READER20',
    description: 'Скидка 20% для подписчиков бота',
    discount: 20,
    maxUses: 1000,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 год
    usageContext: ['weekly_report', 'general'],
    targetAudience: ['all']
  },
  {
    code: 'WISDOM20',
    description: 'Промокод для любителей мудрости',
    discount: 20,
    maxUses: 500,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    usageContext: ['weekly_report'],
    targetAudience: ['self_development']
  },
  {
    code: 'QUOTES20',
    description: 'Скидка для коллекционеров цитат',
    discount: 20,
    maxUses: 500,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    usageContext: ['weekly_report'],
    targetAudience: ['active_users']
  },
  {
    code: 'BOOKS20',
    description: 'Скидка для любителей книг',
    discount: 20,
    maxUses: 500,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    usageContext: ['weekly_report'],
    targetAudience: ['all']
  },
  {
    code: 'READER15',
    description: 'Скидка 15% для анонсов',
    discount: 15,
    maxUses: 2000,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    usageContext: ['announcement'],
    targetAudience: ['all']
  },
  {
    code: 'MONTH25',
    description: 'Месячная скидка 25%',
    discount: 25,
    maxUses: 200,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    usageContext: ['monthly_report'],
    targetAudience: ['active_users']
  }
];

/**
 * Данные категорий из quoteHandler.js
 */
const CATEGORY_DATA = [
  {
    name: 'Саморазвитие',
    description: 'Цитаты о личностном росте и самосовершенствовании',
    icon: '🌱',
    color: '#10B981',
    keywords: ['саморазвит', 'рост', 'развит', 'совершенств', 'прогресс'],
    priority: 10,
    aiPromptHint: 'Цитаты о стремлении стать лучше, учиться, развиваться'
  },
  {
    name: 'Любовь',
    description: 'Цитаты о любви во всех её проявлениях',
    icon: '❤️',
    color: '#EF4444',
    keywords: ['любов', 'сердц', 'чувств', 'романтик', 'страсть'],
    priority: 9,
    aiPromptHint: 'Романтические цитаты, о любви к себе, близким, миру'
  },
  {
    name: 'Философия',
    description: 'Глубокие размышления о жизни и бытии',
    icon: '🤔',
    color: '#8B5CF6',
    keywords: ['философи', 'размышлен', 'смысл', 'бытие', 'истин'],
    priority: 8,
    aiPromptHint: 'Философские размышления, поиск смысла, глубокие мысли'
  },
  {
    name: 'Мотивация',
    description: 'Вдохновляющие цитаты для достижения целей',
    icon: '💪',
    color: '#F59E0B',
    keywords: ['мотивац', 'вдохновен', 'цель', 'достижен', 'успех'],
    priority: 9,
    aiPromptHint: 'Мотивирующие слова, призывы к действию, достижение целей'
  },
  {
    name: 'Мудрость',
    description: 'Мудрые высказывания и жизненный опыт',
    icon: '🦉',
    color: '#6B7280',
    keywords: ['мудр', 'опыт', 'знан', 'понимание', 'глубин'],
    priority: 8,
    aiPromptHint: 'Мудрые слова, жизненный опыт, глубокие истины'
  },
  {
    name: 'Творчество',
    description: 'Цитаты о творческом процессе и вдохновении',
    icon: '🎨',
    color: '#EC4899',
    keywords: ['творчеств', 'искусств', 'вдохновен', 'креатив', 'создан'],
    priority: 7,
    aiPromptHint: 'О творческом процессе, искусстве, вдохновении'
  },
  {
    name: 'Отношения',
    description: 'Цитаты о человеческих взаимоотношениях',
    icon: '🤝',
    color: '#3B82F6',
    keywords: ['отношен', 'общение', 'дружб', 'семь', 'связи'],
    priority: 8,
    aiPromptHint: 'О взаимоотношениях между людьми, дружбе, семье'
  },
  {
    name: 'Материнство',
    description: 'Цитаты о материнстве и воспитании детей',
    icon: '👶',
    color: '#F97316',
    keywords: ['мам', 'материнств', 'дет', 'воспитан', 'родител'],
    priority: 7,
    aiPromptHint: 'О материнстве, воспитании, родительстве'
  },
  {
    name: 'Карьера',
    description: 'Цитаты о работе и профессиональном развитии',
    icon: '💼',
    color: '#059669',
    keywords: ['работ', 'карьер', 'профессион', 'бизнес', 'дел'],
    priority: 6,
    aiPromptHint: 'О работе, карьере, профессиональном росте'
  },
  {
    name: 'Другое',
    description: 'Прочие цитаты, не попадающие в основные категории',
    icon: '📝',
    color: '#6B7280',
    keywords: [],
    priority: 1,
    aiPromptHint: 'Цитаты, которые сложно отнести к основным категориям'
  }
];

/**
 * Данные целевых аудиторий
 */
const TARGET_AUDIENCE_DATA = [
  {
    name: 'Мамы',
    description: 'Женщины с детьми, интересующиеся материнством',
    slug: 'mothers',
    criteria: {
      testResults: [
        { field: 'lifestyle', values: ['мама', 'материнство', 'дети'] }
      ],
      preferences: ['Материнство', 'Семья'],
      demographics: {
        lifestyle: ['мама', 'родитель']
      }
    },
    priority: 9
  },
  {
    name: 'Саморазвитие',
    description: 'Люди, активно занимающиеся личностным ростом',
    slug: 'self_development',
    criteria: {
      preferences: ['Саморазвитие', 'Мудрость', 'Философия'],
      testResults: [
        { field: 'priorities', values: ['развитие', 'рост', 'обучение'] }
      ]
    },
    priority: 8
  },
  {
    name: 'Отношения',
    description: 'Люди, интересующиеся темой отношений',
    slug: 'relationships',
    criteria: {
      preferences: ['Любовь', 'Отношения'],
      testResults: [
        { field: 'priorities', values: ['любовь', 'отношения', 'семья'] }
      ]
    },
    priority: 7
  },
  {
    name: 'Женщины',
    description: 'Женская аудитория с интересом к балансу',
    slug: 'women',
    criteria: {
      testResults: [
        { field: 'priorities', values: ['баланс', 'нежность', 'гармония'] }
      ]
    },
    priority: 6
  },
  {
    name: 'Все',
    description: 'Универсальная аудитория',
    slug: 'all',
    criteria: {},
    priority: 1
  }
];

/**
 * Шаблоны UTM ссылок
 */
const UTM_TEMPLATE_DATA = [
  {
    name: 'Еженедельный отчет - рекомендация книги',
    description: 'UTM для книжных рекомендаций в еженедельных отчетах',
    baseUrl: 'https://anna-busel.com/books',
    utmSource: 'telegram_bot',
    utmMedium: 'weekly_report',
    utmCampaign: 'reader_recommendations',
    utmContent: '{bookSlug}',
    context: 'weekly_report'
  },
  {
    name: 'Месячный анонс курса',
    description: 'UTM для анонсов курсов и интенсивов',
    baseUrl: 'https://anna-busel.com/courses',
    utmSource: 'telegram_bot',
    utmMedium: 'monthly_announcement',
    utmCampaign: '{month}_{slug}',
    utmContent: 'reader_subscribers',
    context: 'announcement'
  },
  {
    name: 'Месячный отчет - спецпредложение',
    description: 'UTM для специальных предложений в месячных отчетах',
    baseUrl: 'https://anna-busel.com/special',
    utmSource: 'telegram_bot',
    utmMedium: 'monthly_report',
    utmCampaign: 'reader_special_offer',
    utmContent: '{userId}',
    context: 'monthly_report'
  }
];

/**
 * Персона Анны для разных контекстов
 */
const ANNA_PERSONA_DATA = [
  {
    name: 'Anna - Анализ цитат',
    description: 'Анна Бусел - психолог и эксперт по книгам, анализирующая цитаты пользователей',
    personality: {
      communicationStyle: 'Дружелюбный, профессиональный, вдохновляющий',
      toneOfVoice: 'Теплый, мудрый, поддерживающий',
      keyPhrases: [
        'Прекрасная цитата!',
        'Глубокая мысль для размышления',
        'Хватит сидеть в телефоне - читайте книги!',
        'Ваш выбор цитат говорит о многом'
      ],
      addressingStyle: 'вы'
    },
    expertise: {
      mainAreas: ['Психология', 'Литература', 'Саморазвитие'],
      specializations: ['Анализ цитат', 'Книжные рекомендации', 'Психологические инсайты'],
      credentials: ['Практикующий психолог', 'Основатель Книжного клуба']
    },
    responsePatterns: {
      greeting: ['Добро пожаловать!', 'Рада видеть вас!'],
      encouragement: ['Продолжайте собирать мудрость!', 'Отличный выбор цитат!'],
      bookRecommendation: ['У меня есть прекрасный разбор', 'Рекомендую изучить'],
      quoteAnalysis: ['Интересная мысль', 'Глубокое наблюдение', 'Мудрые слова']
    },
    boundaries: {
      whatSheDoes: [
        'Анализирую цитаты с психологической точки зрения',
        'Рекомендую книги на основе ваших интересов',
        'Даю инсайты о личностном росте'
      ],
      whatSheDoesNot: [
        'Не даю медицинских советов',
        'Не заменяю профессиональную психотерапию',
        'Не обсуждаю политику'
      ]
    },
    context: 'quote_analysis',
    priority: 10
  },
  {
    name: 'Anna - Еженедельные отчеты',
    description: 'Анна Бусел для еженедельных отчетов с рекомендациями',
    personality: {
      communicationStyle: 'Аналитический, вдохновляющий, персональный',
      toneOfVoice: 'Мудрый наставник, заботливый психолог',
      keyPhrases: [
        'Ваш отчет за неделю готов',
        'Интересные закономерности в ваших цитатах',
        'Книги-помощники для вашего пути'
      ],
      addressingStyle: 'вы'
    },
    expertise: {
      mainAreas: ['Психологический анализ', 'Персональные рекомендации'],
      specializations: ['Анализ паттернов поведения', 'Книжные рекомендации'],
      credentials: ['Психолог', 'Книжный эксперт']
    },
    responsePatterns: {
      greeting: ['Подводим итоги недели'],
      encouragement: ['Прекрасная активность!', 'Ваш рост очевиден'],
      bookRecommendation: ['На основе ваших цитат рекомендую', 'Идеально подойдет'],
      quoteAnalysis: ['Ваши цитаты показывают', 'Интересная тенденция']
    },
    boundaries: {
      whatSheDoes: [
        'Анализирую еженедельные паттерны',
        'Рекомендую персональные книги',
        'Отслеживаю ваш прогресс'
      ],
      whatSheDoesNot: [
        'Не сужу ваши выборы',
        'Не навязываю мнения'
      ]
    },
    context: 'weekly_report',
    priority: 9
  },
  {
    name: 'Anna - Общение',
    description: 'Анна Бусел для обычного общения с пользователями',
    personality: {
      communicationStyle: 'Дружелюбный, открытый, поддерживающий',
      toneOfVoice: 'Как добрый друг и мудрый наставник',
      keyPhrases: [
        'Рада помочь!',
        'Отличный вопрос!',
        'Хватит сидеть в телефоне - читайте книги!'
      ],
      addressingStyle: 'вы'
    },
    expertise: {
      mainAreas: ['Психология', 'Литература', 'Личностный рост'],
      specializations: ['Консультирование', 'Книжные рекомендации'],
      credentials: ['Психолог', 'Автор разборов книг']
    },
    responsePatterns: {
      greeting: ['Привет!', 'Добро пожаловать!', 'Рада видеть!'],
      encouragement: ['Так держать!', 'Вы на правильном пути!'],
      bookRecommendation: ['Рекомендую прочитать', 'Обратите внимание на'],
      quoteAnalysis: ['Мудро замечено', 'Глубокая мысль']
    },
    boundaries: {
      whatSheDoes: [
        'Отвечаю на вопросы о книгах и саморазвитии',
        'Помогаю с выбором литературы',
        'Поддерживаю в личностном росте'
      ],
      whatSheDoesNot: [
        'Не обсуждаю личные проблемы глубоко',
        'Не даю медицинских советов'
      ]
    },
    context: 'general_chat',
    priority: 5
  }
];

/**
 * Главная функция миграции
 */
async function migrateDataFromCode() {
  try {
    console.log('🚀 Начинаем миграцию данных из хардкода в MongoDB...\n');

    // 1. Миграция каталога книг
    console.log('📚 Мигрируем каталог книг...');
    for (const bookData of BOOK_CATALOG_DATA) {
      const existingBook = await BookCatalog.findOne({ bookSlug: bookData.bookSlug });
      if (!existingBook) {
        const book = new BookCatalog(bookData);
        await book.save();
        console.log(`  ✅ Создана книга: ${book.title}`);
      } else {
        console.log(`  ⏭️  Книга уже существует: ${existingBook.title}`);
      }
    }

    // 2. Миграция анонсов
    console.log('\n📢 Мигрируем каталог анонсов...');
    for (const announcementData of ANNOUNCEMENT_CATALOG_DATA) {
      const existing = await AnnouncementCatalog.findOne({ announcementSlug: announcementData.announcementSlug });
      if (!existing) {
        const announcement = new AnnouncementCatalog(announcementData);
        await announcement.save();
        console.log(`  ✅ Создан анонс: ${announcement.title}`);
      } else {
        console.log(`  ⏭️  Анонс уже существует: ${existing.title}`);
      }
    }

    // 3. Миграция промокодов
    console.log('\n🎁 Мигрируем промокоды...');
    for (const promoData of PROMO_CODE_DATA) {
      const existing = await PromoCode.findOne({ code: promoData.code });
      if (!existing) {
        const promo = new PromoCode(promoData);
        await promo.save();
        console.log(`  ✅ Создан промокод: ${promo.code} (${promo.discount}%)`);
      } else {
        console.log(`  ⏭️  Промокод уже существует: ${existing.code}`);
      }
    }

    // 4. Миграция категорий
    console.log('\n📂 Мигрируем категории цитат...');
    for (const categoryData of CATEGORY_DATA) {
      const existing = await Category.findOne({ name: categoryData.name });
      if (!existing) {
        const category = new Category(categoryData);
        await category.save();
        console.log(`  ✅ Создана категория: ${category.name} ${category.icon}`);
      } else {
        console.log(`  ⏭️  Категория уже существует: ${existing.name}`);
      }
    }

    // 5. Миграция целевых аудиторий
    console.log('\n🎯 Мигрируем целевые аудитории...');
    for (const audienceData of TARGET_AUDIENCE_DATA) {
      const existing = await TargetAudience.findOne({ slug: audienceData.slug });
      if (!existing) {
        const audience = new TargetAudience(audienceData);
        await audience.save();
        console.log(`  ✅ Создана аудитория: ${audience.name} (${audience.slug})`);
      } else {
        console.log(`  ⏭️  Аудитория уже существует: ${existing.name}`);
      }
    }

    // 6. Миграция UTM шаблонов
    console.log('\n🔗 Мигрируем UTM шаблоны...');
    for (const utmData of UTM_TEMPLATE_DATA) {
      const existing = await UtmTemplate.findOne({ name: utmData.name });
      if (!existing) {
        const utm = new UtmTemplate(utmData);
        await utm.save();
        console.log(`  ✅ Создан UTM шаблон: ${utm.name}`);
      } else {
        console.log(`  ⏭️  UTM шаблон уже существует: ${existing.name}`);
      }
    }

    // 7. Миграция персоны Анны
    console.log('\n👩 Мигрируем персону Анны...');
    for (const personaData of ANNA_PERSONA_DATA) {
      const existing = await AnnaPersona.findOne({ name: personaData.name });
      if (!existing) {
        const persona = new AnnaPersona(personaData);
        await persona.save();
        console.log(`  ✅ Создана персона: ${persona.name} (${persona.context})`);
      } else {
        console.log(`  ⏭️  Персона уже существует: ${existing.name}`);
      }
    }

    console.log('\n🎉 Миграция завершена успешно!');
    
    // Показываем статистику
    console.log('\n📊 СТАТИСТИКА:');
    console.log(`📚 Книг в каталоге: ${await BookCatalog.countDocuments()}`);
    console.log(`📢 Анонсов: ${await AnnouncementCatalog.countDocuments()}`);
    console.log(`🎁 Промокодов: ${await PromoCode.countDocuments()}`);
    console.log(`📂 Категорий: ${await Category.countDocuments()}`);
    console.log(`🎯 Аудиторий: ${await TargetAudience.countDocuments()}`);
    console.log(`🔗 UTM шаблонов: ${await UtmTemplate.countDocuments()}`);
    console.log(`👩 Персон Анны: ${await AnnaPersona.countDocuments()}`);

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    throw error;
  }
}

/**
 * Функция для запуска миграции отдельно
 */
async function runMigration() {
  try {
    // Подключаемся к MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-bot');
    console.log('✅ Подключение к MongoDB установлено');

    // Запускаем миграцию
    await migrateDataFromCode();

    // Закрываем соединение
    await mongoose.connection.close();
    console.log('👋 Соединение с MongoDB закрыто');
    process.exit(0);

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  }
}

// Экспортируем функции
module.exports = { migrateDataFromCode, runMigration };

// Если файл запущен напрямую - выполняем миграцию
if (require.main === module) {
  runMigration();
}
