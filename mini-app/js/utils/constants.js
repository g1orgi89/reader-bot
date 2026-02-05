/**
 * 📋 КОНСТАНТЫ ПРИЛОЖЕНИЯ READER BOT
 * Размер: ~3 KB - все константы, тексты и настройки Mini App
 * 
 * Содержит все константы приложения:
 * - UI константы (цвета, размеры, анимации)
 * - Тексты интерфейса в стиле Анны Бусел
 * - Настройки приложения и лимиты
 * - Конфигурация достижений и геймификации
 */

// 🎨 UI КОНСТАНТЫ

/** Цветовая палитра приложения (CSS переменные) */
const COLORS = {
    primary: '#D2452C',           // Терракотовый как на сайте annabusel.org
    primaryDark: '#B53A23',       // Темнее красный
    primaryLight: '#E85A42',      // Светлее красный
    textPrimary: '#2D2D2D',       // Темно-серый текст
    textSecondary: '#666666',     // Серый текст
    textMuted: '#999999',         // Приглушенный серый
    background: '#F5F2EC',        // Светло-бежевый фон
    backgroundLight: '#FAF8F3',   // Очень светлый бежевый
    surface: '#FFFFFF',           // Белые карточки
    border: '#E6E0D6',            // Бежевая граница
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545'
};

/** Размеры и отступы */
const DIMENSIONS = {
    borderRadius: '12px',
    borderRadiusSmall: '8px',
    headerHeight: '64px',
    bottomNavHeight: '80px',
    cardPadding: '16px',
    pagePadding: '20px',
    buttonHeight: '44px',
    avatarSize: '48px',
    iconSize: '24px'
};

/** Длительность анимаций */
const ANIMATIONS = {
    fast: '0.2s',
    normal: '0.3s',
    slow: '0.5s',
    pageTransition: '0.4s',
    modalTransition: '0.3s'
};

// 📱 НАСТРОЙКИ ПРИЛОЖЕНИЯ

/** Лимиты и ограничения */
const LIMITS = {
    quotesPerDay: 10,             // Максимум цитат в день
    quoteMaxLength: 500,          // Максимальная длина цитаты
    authorMaxLength: 100,         // Максимальная длина имени автора
    nameMaxLength: 50,            // Максимальная длина имени пользователя
    bioMaxLength: 200,            // Максимальная длина описания "о себе"
    statusMaxLength: 80,          // Максимальная длина статуса пользователя
    searchMinLength: 2,           // Минимальная длина поискового запроса
    pageSize: 20                  // Количество элементов на страницу
};

/** Настройки кэширования */
const CACHE = {
    userProfileTTL: 300000,       // 5 минут для профиля пользователя
    quotesListTTL: 60000,         // 1 минута для списка цитат
    reportsTTL: 600000,           // 10 минут для отчетов
    achievementsTTL: 3600000      // 1 час для достижений
};

/** Типы страниц для навигации */
const PAGES = {
    HOME: 'home',
    DIARY: 'diary',
    REPORTS: 'reports',
    CATALOG: 'catalog',
    COMMUNITY: 'community',
    PROFILE: 'profile',
    ACHIEVEMENTS: 'achievements',
    SETTINGS: 'settings',
    HELP: 'help',
    ABOUT: 'about',
    ONBOARDING: 'onboarding'
};

// 💬 ТЕКСТЫ ИНТЕРФЕЙСА В СТИЛЕ АННЫ БУСЕЛ

/** Фирменные фразы Анны Бусел */
const ANNA_PHRASES = {
    greeting: "Друзья, здравствуйте!",
    motto1: "Хватит сидеть в телефоне - читайте книги!",
    motto2: "Почитайте в клубе хотя бы несколько лет и ваша жизнь изменится до неузнаваемости",
    motto3: "Хорошая жизнь строится, а не дается по умолчанию",
    personalQuote: "Хорошая жизнь строится, а не дается по умолчанию. Давайте строить вашу вместе!"
};

/** Тексты приветствий и онбординга */
const WELCOME_TEXTS = {
    title: "Добро пожаловать! 👋",
    subtitle: "Ваш персональный дневник мудрости",
    description: "Здесь мы превратим ваши случайные цитаты в персональный дневник роста.",
    firstQuotePrompt: "Поделитесь первой цитатой, которая вас вдохновляет",
    testPrompt: "📝 Сначала пройдём короткий тест (2 минуты)"
};

/** Тексты для главной страницы */
const HOME_TEXTS = {
    todayQuotes: "Сегодня добавлено",
    weekStreak: "Дней подряд",
    totalQuotes: "Цитат собрано",
    totalBooks: "Книг изучено",
    quickAddPlaceholder: "Поделитесь мудростью...",
    quickAddButton: "Добавить цитату",
    topBooksTitle: "📚 Популярные книги недели",
    recentQuotesTitle: "💫 Ваши последние цитаты"
};

/** Тексты для дневника цитат */
const DIARY_TEXTS = {
    title: "Дневник цитат",
    searchPlaceholder: "Поиск по цитатам...",
    addQuoteButton: "➕ Добавить цитату",
    emptyState: "Пока нет цитат",
    emptyStateSubtitle: "Добавьте первую цитату, чтобы начать свой дневник мудрости",
    tabs: {
        all: "Все",
        books: "Из книг", 
        thoughts: "Мысли",
        favorites: "Избранное"
    },
    filterLabels: {
        thisWeek: "На этой неделе",
        thisMonth: "В этом месяце",
        allTime: "За все время"
    }
};

/** Тексты для отчетов */
const REPORTS_TEXTS = {
    title: "Мои отчеты",
    weeklyTitle: "📊 Еженедельные отчеты",
    monthlyTitle: "📈 Месячные анализы",
    latestReport: "Последний отчет",
    analysisFrom: "Анализ от Анны:",
    recommendations: "💎 Рекомендации от Анны:",
    promoCode: "🎁 Промокод",
    validUntil: "действует до",
    emptyState: "Отчеты появятся после первой недели использования",
    generateButton: "Создать отчет"
};

/** Тексты для каталога */
const CATALOG_TEXTS = {
    title: "Каталог книг",
    searchPlaceholder: "Поиск книг...",
    categories: "Категории",
    newBooks: "Новинки",
    popular: "Популярное",
    fromAnna: "От Анны",
    viewDetails: "Подробнее",
    readAnalysis: "Читать разбор",
    addToWishlist: "В избранное"
};

/** Тексты для профиля */
const PROFILE_TEXTS = {
    title: "Мой профиль",
    editProfile: "Редактировать профиль",
    statistics: "Статистика",
    personalInfo: "Личная информация",
    labels: {
        name: "Имя",
        email: "Email",
        about: "О себе",
        readingTime: "Время чтения в неделю",
        favoriteGenres: "Любимые жанры"
    },
    placeholders: {
        name: "Ваше имя",
        email: "Ваш email",
        about: "Расскажите о себе",
        readingTime: "Например: 5-10 часов"
    },
    retakeTest: "🔄 Пересдать тест (7 вопросов)",
    saveChanges: "Сохранить изменения",
    changesSaved: "Изменения сохранены!"
};

/** Тексты для настроек */
const SETTINGS_TEXTS = {
    title: "Настройки",
    groups: {
        notifications: "Уведомления",
        application: "Приложение",
        account: "Аккаунт",
        data: "Данные"
    },
    items: {
        dailyReminders: "Ежедневные напоминания",
        weeklyReports: "Еженедельные отчеты",
        pushNotifications: "Push-уведомления",
        darkTheme: "Темная тема",
        exportData: "Экспорт данных",
        deleteAllData: "Удалить все данные",
        logout: "Выйти из аккаунта"
    }
};

// 🏆 КОНФИГУРАЦИЯ ДОСТИЖЕНИЙ

/** Типы достижений */
const ACHIEVEMENT_TYPES = {
    QUOTES_COUNT: 'quotes_count',
    STREAK_DAYS: 'streak_days',
    BOOK_QUOTES: 'book_quotes',
    OWN_THOUGHTS: 'own_thoughts',
    CLASSIC_AUTHORS: 'classic_authors',
    WEEK_ACTIVE: 'week_active',
    MONTH_ACTIVE: 'month_active',
    FIRST_REPORT: 'first_report'
};

/** Конфигурация достижений */
const ACHIEVEMENTS_CONFIG = {
    [ACHIEVEMENT_TYPES.QUOTES_COUNT]: [
        { id: 'first_quote', title: 'Первые шаги', description: 'Добавили первую цитату', icon: '🌟', threshold: 1 },
        { id: 'collector', title: 'Коллекционер мудрости', description: 'Собрали 25 цитат', icon: '📚', threshold: 25 },
        { id: 'wisdom_keeper', title: 'Хранитель мудрости', description: 'Собрали 100 цитат', icon: '💎', threshold: 100 }
    ],
    [ACHIEVEMENT_TYPES.STREAK_DAYS]: [
        { id: 'week_philosopher', title: 'Философ недели', description: '7 дней подряд добавляйте цитаты', icon: '🔥', threshold: 7 },
        { id: 'month_thinker', title: 'Мыслитель месяца', description: '30 дней подряд', icon: '🧠', threshold: 30 }
    ],
    [ACHIEVEMENT_TYPES.OWN_THOUGHTS]: [
        { id: 'thinker', title: 'Мыслитель', description: 'Добавьте 10 собственных мыслей', icon: '💭', threshold: 10 }
    ],
    [ACHIEVEMENT_TYPES.CLASSIC_AUTHORS]: [
        { id: 'classic_lover', title: 'Любитель классики', description: '10 цитат классических авторов', icon: '🎭', threshold: 10 }
    ]
};

/** Тексты для достижений */
const ACHIEVEMENTS_TEXTS = {
    title: "Мои достижения",
    subtitle: "Продолжайте собирать цитаты для новых наград!",
    progress: "Прогресс",
    unlocked: "Выполнено!",
    locked: "Заблокировано",
    unlockedCount: (count, total) => `${count} из ${total} достижений`
};

// 📋 МЕНЮ И НАВИГАЦИЯ

/** Конфигурация главного меню */
const MENU_ITEMS = [
    {
        id: 'profile',
        title: 'Мой профиль',
        icon: 'user',
        page: PAGES.PROFILE
    },
    {
        id: 'achievements',
        title: 'Мои достижения', 
        icon: 'award',
        page: PAGES.ACHIEVEMENTS
    },
    {
        id: 'settings',
        title: 'Настройки',
        icon: 'settings',
        page: PAGES.SETTINGS
    },
    {
        id: 'help',
        title: 'Помощь',
        icon: 'help-circle',
        page: PAGES.HELP
    },
    {
        id: 'about',
        title: 'О приложении',
        icon: 'smile',
        page: PAGES.ABOUT
    }
];

/** Конфигурация нижней навигации */
const BOTTOM_NAV_ITEMS = [
    {
        id: 'home',
        title: 'Главная',
        icon: 'home',
        page: PAGES.HOME
    },
    {
        id: 'diary',
        title: 'Дневник',
        icon: 'book-open',
        page: PAGES.DIARY
    },
    {
        id: 'reports',
        title: 'Отчеты', 
        icon: 'bar-chart-2',
        page: PAGES.REPORTS
    },
    {
        id: 'catalog',
        title: 'Каталог',
        icon: 'library',
        page: PAGES.CATALOG
    },
    {
        id: 'community',
        title: 'Клуб',
        icon: 'users',
        page: PAGES.COMMUNITY
    }
];

// 🔄 СОСТОЯНИЯ И СТАТУСЫ

/** Состояния загрузки */
const LOADING_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error'
};

/** Типы уведомлений */
const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

/** Сообщения об ошибках */
const ERROR_MESSAGES = {
    network: 'Проблемы с подключением. Проверьте интернет.',
    validation: 'Пожалуйста, проверьте правильность заполнения полей.',
    quoteTooLong: `Цитата слишком длинная. Максимум ${LIMITS.quoteMaxLength} символов.`,
    quotesLimit: `Достигнут дневной лимит цитат (${LIMITS.quotesPerDay}).`,
    unauthorized: 'Необходимо войти в аккаунт.',
    serverError: 'Ошибка сервера. Попробуйте позже.',
    notFound: 'Запрашиваемые данные не найдены.'
};

/** Сообщения об успехе */
const SUCCESS_MESSAGES = {
    quoteSaved: 'Цитата сохранена в ваш дневник! 📖',
    profileUpdated: 'Профиль обновлен!',
    settingsSaved: 'Настройки сохранены!',
    dataExported: 'Данные экспортированы!',
    achievementUnlocked: 'Новое достижение разблокировано! 🏆'
};

// 📞 КОНТАКТНАЯ ИНФОРМАЦИЯ

/** Информация об Анне Бусел */
const ANNA_INFO = {
    name: 'Анна Бусел',
    role: 'Психолог • Основатель "Книжного клуба"',
    photo: 'А', // Инициал для аватара
    quote: ANNA_PHRASES.personalQuote,
    contacts: {
        telegram: '@manager_bookclub',
        email: 'help@annabusel.org',
        instagram: 'annabusel',
        website: 'annabusel.org'
    }
};

/** Информация о приложении */
const APP_INFO = {
    name: 'Читатель',
    version: '1.0.2',
    description: '"Читатель" — это персональный дневник цитат с AI-анализом от Анны Бусел. Собирайте мудрость, получайте персональные рекомендации книг и развивайтесь вместе с сообществом единомышленников.',
    supportEmail: 'help@annabusel.org',
    responseTime: 'до 24 часов'
};

// 🔐 ВАЛИДАЦИЯ

/** Регулярные выражения для валидации */
const VALIDATION_PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    name: /^[а-яё\s\-]+$/i,
    phone: /^[\+]?[0-9\s\-\(\)]{10,}$/
};

/** Сообщения валидации */
const VALIDATION_MESSAGES = {
    required: 'Это поле обязательно для заполнения',
    email: 'Введите корректный email адрес',
    name: 'Имя может содержать только буквы, пробелы и дефисы',
    minLength: (min) => `Минимум ${min} символов`,
    maxLength: (max) => `Максимум ${max} символов`,
    phone: 'Введите корректный номер телефона'
};

// 🌐 ГЛОБАЛЬНЫЙ ДОСТУП
window.COLORS = COLORS;
window.DIMENSIONS = DIMENSIONS;
window.ANIMATIONS = ANIMATIONS;
window.LIMITS = LIMITS;
window.CACHE = CACHE;
window.PAGES = PAGES;
window.ANNA_PHRASES = ANNA_PHRASES;
window.WELCOME_TEXTS = WELCOME_TEXTS;
window.HOME_TEXTS = HOME_TEXTS;
window.DIARY_TEXTS = DIARY_TEXTS;
window.REPORTS_TEXTS = REPORTS_TEXTS;
window.CATALOG_TEXTS = CATALOG_TEXTS;
window.PROFILE_TEXTS = PROFILE_TEXTS;
window.SETTINGS_TEXTS = SETTINGS_TEXTS;
window.ACHIEVEMENT_TYPES = ACHIEVEMENT_TYPES;
window.ACHIEVEMENTS_CONFIG = ACHIEVEMENTS_CONFIG;
window.ACHIEVEMENTS_TEXTS = ACHIEVEMENTS_TEXTS;
window.MENU_ITEMS = MENU_ITEMS;
window.BOTTOM_NAV_ITEMS = BOTTOM_NAV_ITEMS;
window.LOADING_STATES = LOADING_STATES;
window.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
window.ERROR_MESSAGES = ERROR_MESSAGES;
window.SUCCESS_MESSAGES = SUCCESS_MESSAGES;
window.ANNA_INFO = ANNA_INFO;
window.APP_INFO = APP_INFO;
window.VALIDATION_PATTERNS = VALIDATION_PATTERNS;
window.VALIDATION_MESSAGES = VALIDATION_MESSAGES;

// Главный объект со всеми константами
window.APP_CONSTANTS = {
    COLORS,
    DIMENSIONS,
    ANIMATIONS,
    LIMITS,
    CACHE,
    PAGES,
    ANNA_PHRASES,
    WELCOME_TEXTS,
    HOME_TEXTS,
    DIARY_TEXTS,
    REPORTS_TEXTS,
    CATALOG_TEXTS,
    PROFILE_TEXTS,
    SETTINGS_TEXTS,
    ACHIEVEMENT_TYPES,
    ACHIEVEMENTS_CONFIG,
    ACHIEVEMENTS_TEXTS,
    MENU_ITEMS,
    BOTTOM_NAV_ITEMS,
    LOADING_STATES,
    NOTIFICATION_TYPES,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    ANNA_INFO,
    APP_INFO,
    VALIDATION_PATTERNS,
    VALIDATION_MESSAGES
};
