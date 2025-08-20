/**
 * @fileoverview Excel theme to website category mapper utility
 * @description Maps Excel themes to the 14 website categories with fallback to 'ПОИСК СЕБЯ'
 * @author Reader Bot Team
 */

/**
 * All 14 website categories
 */
const WEBSITE_CATEGORIES = [
  'КРИЗИСЫ',
  'Я — ЖЕНЩИНА',
  'ЛЮБОВЬ',
  'ОТНОШЕНИЯ',
  'ДЕНЬГИ',
  'ОДИНОЧЕСТВО',
  'СМЕРТЬ',
  'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'СМЫСЛ ЖИЗНИ',
  'СЧАСТЬЕ',
  'ВРЕМЯ И ПРИВЫЧКИ',
  'ДОБРО И ЗЛО',
  'ОБЩЕСТВО',
  'ПОИСК СЕБЯ'
];

/**
 * Excel theme to category mapping
 * Maps common Excel themes to website categories
 */
const THEME_TO_CATEGORY_MAP = {
  // Crisis and difficulties
  'кризис': 'КРИЗИСЫ',
  'трудности': 'КРИЗИСЫ',
  'проблемы': 'КРИЗИСЫ',
  'преодоление': 'КРИЗИСЫ',
  'выход из кризиса': 'КРИЗИСЫ',
  'борьба': 'КРИЗИСЫ',
  
  // Women themes
  'женщина': 'Я — ЖЕНЩИНА',
  'женственность': 'Я — ЖЕНЩИНА',
  'женская сила': 'Я — ЖЕНЩИНА',
  'материнство': 'Я — ЖЕНЩИНА',
  'красота': 'Я — ЖЕНЩИНА',
  'женское начало': 'Я — ЖЕНЩИНА',
  
  // Love
  'любовь': 'ЛЮБОВЬ',
  'страсть': 'ЛЮБОВЬ',
  'романтика': 'ЛЮБОВЬ',
  'влюбленность': 'ЛЮБОВЬ',
  'сердце': 'ЛЮБОВЬ',
  'чувства': 'ЛЮБОВЬ',
  'привязанность': 'ЛЮБОВЬ',
  
  // Relationships
  'отношения': 'ОТНОШЕНИЯ',
  'дружба': 'ОТНОШЕНИЯ',
  'общение': 'ОТНОШЕНИЯ',
  'связь': 'ОТНОШЕНИЯ',
  'взаимодействие': 'ОТНОШЕНИЯ',
  'понимание': 'ОТНОШЕНИЯ',
  'близость': 'ОТНОШЕНИЯ',
  
  // Money
  'деньги': 'ДЕНЬГИ',
  'богатство': 'ДЕНЬГИ',
  'финансы': 'ДЕНЬГИ',
  'успех': 'ДЕНЬГИ',
  'материальное': 'ДЕНЬГИ',
  'благополучие': 'ДЕНЬГИ',
  'карьера': 'ДЕНЬГИ',
  
  // Loneliness
  'одиночество': 'ОДИНОЧЕСТВО',
  'уединение': 'ОДИНОЧЕСТВО',
  'самостоятельность': 'ОДИНОЧЕСТВО',
  'независимость': 'ОДИНОЧЕСТВО',
  'тишина': 'ОДИНОЧЕСТВО',
  'единение с собой': 'ОДИНОЧЕСТВО',
  
  // Death
  'смерть': 'СМЕРТЬ',
  'конечность': 'СМЕРТЬ',
  'бренность': 'СМЕРТЬ',
  'утрата': 'СМЕРТЬ',
  'память': 'СМЕРТЬ',
  'вечность': 'СМЕРТЬ',
  'потеря': 'СМЕРТЬ',
  
  // Family relationships
  'семья': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'родители': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'дети': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'родственники': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'семейные ценности': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'воспитание': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'поколения': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  
  // Meaning of life
  'смысл жизни': 'СМЫСЛ ЖИЗНИ',
  'предназначение': 'СМЫСЛ ЖИЗНИ',
  'цель': 'СМЫСЛ ЖИЗНИ',
  'миссия': 'СМЫСЛ ЖИЗНИ',
  'призвание': 'СМЫСЛ ЖИЗНИ',
  'суть': 'СМЫСЛ ЖИЗНИ',
  'философия': 'СМЫСЛ ЖИЗНИ',
  
  // Happiness
  'счастье': 'СЧАСТЬЕ',
  'радость': 'СЧАСТЬЕ',
  'веселье': 'СЧАСТЬЕ',
  'удовольствие': 'СЧАСТЬЕ',
  'блаженство': 'СЧАСТЬЕ',
  'позитив': 'СЧАСТЬЕ',
  'эйфория': 'СЧАСТЬЕ',
  
  // Time and habits
  'время': 'ВРЕМЯ И ПРИВЫЧКИ',
  'привычки': 'ВРЕМЯ И ПРИВЫЧКИ',
  'рутина': 'ВРЕМЯ И ПРИВЫЧКИ',
  'организация': 'ВРЕМЯ И ПРИВЫЧКИ',
  'планирование': 'ВРЕМЯ И ПРИВЫЧКИ',
  'дисциплина': 'ВРЕМЯ И ПРИВЫЧКИ',
  'режим': 'ВРЕМЯ И ПРИВЫЧКИ',
  
  // Good and evil
  'добро': 'ДОБРО И ЗЛО',
  'зло': 'ДОБРО И ЗЛО',
  'мораль': 'ДОБРО И ЗЛО',
  'этика': 'ДОБРО И ЗЛО',
  'справедливость': 'ДОБРО И ЗЛО',
  'нравственность': 'ДОБРО И ЗЛО',
  'принципы': 'ДОБРО И ЗЛО',
  
  // Society
  'общество': 'ОБЩЕСТВО',
  'социум': 'ОБЩЕСТВО',
  'мир': 'ОБЩЕСТВО',
  'люди': 'ОБЩЕСТВО',
  'человечество': 'ОБЩЕСТВО',
  'цивилизация': 'ОБЩЕСТВО',
  'социальные вопросы': 'ОБЩЕСТВО',
  
  // Self-discovery
  'самопознание': 'ПОИСК СЕБЯ',
  'саморазвитие': 'ПОИСК СЕБЯ',
  'поиск себя': 'ПОИСК СЕБЯ',
  'путь': 'ПОИСК СЕБЯ',
  'рост': 'ПОИСК СЕБЯ',
  'развитие': 'ПОИСК СЕБЯ',
  'познание': 'ПОИСК СЕБЯ',
  'самосовершенствование': 'ПОИСК СЕБЯ',
  'личностный рост': 'ПОИСК СЕБЯ'
};

/**
 * Map Excel theme to website category
 * @param {string} excelTheme - Theme from Excel document
 * @returns {string} Website category (defaults to 'ПОИСК СЕБЯ')
 */
function mapExcelToWebsiteCategory(excelTheme) {
  if (!excelTheme || typeof excelTheme !== 'string') {
    return 'ПОИСК СЕБЯ';
  }
  
  const theme = excelTheme.toLowerCase().trim();
  
  // Direct mapping
  if (THEME_TO_CATEGORY_MAP[theme]) {
    return THEME_TO_CATEGORY_MAP[theme];
  }
  
  // Partial matching - check if theme contains any of the mapped keys
  for (const [key, category] of Object.entries(THEME_TO_CATEGORY_MAP)) {
    if (theme.includes(key) || key.includes(theme)) {
      return category;
    }
  }
  
  // Default fallback
  return 'ПОИСК СЕБЯ';
}

/**
 * Get all available website categories
 * @returns {string[]} Array of all 14 website categories
 */
function getAllWebsiteCategories() {
  return [...WEBSITE_CATEGORIES];
}

/**
 * Get category mapping statistics
 * @returns {Object} Statistics about the mapping
 */
function getCategoryMappingStats() {
  const stats = {};
  
  // Count themes per category
  for (const category of Object.values(THEME_TO_CATEGORY_MAP)) {
    stats[category] = (stats[category] || 0) + 1;
  }
  
  return {
    totalThemes: Object.keys(THEME_TO_CATEGORY_MAP).length,
    totalCategories: WEBSITE_CATEGORIES.length,
    themesPerCategory: stats,
    defaultCategory: 'ПОИСК СЕБЯ'
  };
}

/**
 * Validate if a category is a valid website category
 * @param {string} category - Category to validate
 * @returns {boolean} True if valid website category
 */
function isValidWebsiteCategory(category) {
  return WEBSITE_CATEGORIES.includes(category);
}

/**
 * Get themes mapped to a specific category
 * @param {string} category - Website category
 * @returns {string[]} Array of themes mapped to this category
 */
function getThemesForCategory(category) {
  return Object.keys(THEME_TO_CATEGORY_MAP).filter(
    theme => THEME_TO_CATEGORY_MAP[theme] === category
  );
}

/**
 * Map themes to a single website category  
 * @param {string} input - Theme or themes string (comma-separated)
 * @returns {string} Single mapped category (defaults to 'ПОИСК СЕБЯ')
 */
function mapThemesToCategory(input) {
  if (!input || typeof input !== 'string') {
    return 'ПОИСК СЕБЯ';
  }
  
  // Split by commas and try to map each theme
  const themes = input.split(',').map(theme => theme.trim().toLowerCase());
  
  // Try to find the first matching theme
  for (const theme of themes) {
    if (THEME_TO_CATEGORY_MAP[theme]) {
      return THEME_TO_CATEGORY_MAP[theme];
    }
    
    // Partial matching - check if theme contains any of the mapped keys
    for (const [key, category] of Object.entries(THEME_TO_CATEGORY_MAP)) {
      if (theme.includes(key) || key.includes(theme)) {
        return category;
      }
    }
  }
  
  // Default fallback
  return 'ПОИСК СЕБЯ';
}

/**
 * Normalize categories input for BookCatalog
 * @param {Object} body - Request body that may contain category fields
 * @returns {string[]} Array with exactly one normalized category
 */
function normalizeCategoriesInput(body) {
  // Try different input fields in order of preference
  const input = body.category || 
                (body.categories && body.categories[0]) || 
                body.theme || 
                (body.targetThemes && body.targetThemes[0]);
  
  if (input) {
    const mapped = mapThemesToCategory(input);
    return [mapped];
  }
  
  // Fallback to default category
  return ['ПОИСК СЕБЯ'];
}

module.exports = {
  THEME_TO_CATEGORY_MAP,
  WEBSITE_CATEGORIES,
  mapExcelToWebsiteCategory,
  getAllWebsiteCategories,
  getCategoryMappingStats,
  isValidWebsiteCategory,
  getThemesForCategory,
  mapThemesToCategory,
  normalizeCategoriesInput
};