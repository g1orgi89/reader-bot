/**
 * @fileoverview Canonical Categories Configuration
 * @description Single source of truth for the 14 canonical categories + ДРУГОЕ fallback
 * @author Reader Bot Team
 */

/**
 * All 14 canonical categories + fallback
 */
const CANONICAL_CATEGORIES = [
  {
    key: 'КРИЗИСЫ',
    slug: 'crisis',
    synonyms: ['кризис', 'трудности', 'проблемы', 'преодоление', 'выход из кризиса', 'борьба'],
    keywords: ['кризис', 'трудност', 'проблем', 'преодоле', 'борьб'],
    priority: 10,
    excludeFromTrend: false
  },
  {
    key: 'Я — ЖЕНЩИНА',
    slug: 'woman',
    synonyms: ['женщина', 'женственность', 'женская сила', 'материнство', 'красота', 'женское начало'],
    keywords: ['женщин', 'женственност', 'материнств', 'красот'],
    priority: 9,
    excludeFromTrend: false
  },
  {
    key: 'ЛЮБОВЬ',
    slug: 'love',
    synonyms: ['любовь', 'страсть', 'романтика', 'влюбленность', 'сердце', 'чувства', 'привязанность'],
    keywords: ['любовь', 'страст', 'романтик', 'влюбленност', 'сердц', 'чувств'],
    priority: 9,
    excludeFromTrend: false
  },
  {
    key: 'ОТНОШЕНИЯ',
    slug: 'relationships',
    synonyms: ['отношения', 'дружба', 'общение', 'связь', 'взаимодействие', 'понимание', 'близость'],
    keywords: ['отношени', 'дружб', 'общени', 'связь', 'взаимодействи', 'близост'],
    priority: 8,
    excludeFromTrend: false
  },
  {
    key: 'ДЕНЬГИ',
    slug: 'money',
    synonyms: ['деньги', 'богатство', 'финансы', 'успех', 'материальное', 'благополучие', 'карьера'],
    keywords: ['деньг', 'богатств', 'финанс', 'успех', 'материальн', 'карьер'],
    priority: 8,
    excludeFromTrend: false
  },
  {
    key: 'ОДИНОЧЕСТВО',
    slug: 'loneliness',
    synonyms: ['одиночество', 'уединение', 'самостоятельность', 'независимость', 'тишина', 'единение с собой'],
    keywords: ['одиночеств', 'уединени', 'самостоятельност', 'независимост'],
    priority: 7,
    excludeFromTrend: false
  },
  {
    key: 'СМЕРТЬ',
    slug: 'death',
    synonyms: ['смерть', 'конечность', 'бренность', 'утрата', 'память', 'вечность', 'потеря'],
    keywords: ['смерть', 'конечност', 'бренност', 'утрат', 'потер'],
    priority: 6,
    excludeFromTrend: false
  },
  {
    key: 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
    slug: 'family',
    synonyms: ['семья', 'родители', 'дети', 'родственники', 'семейные ценности', 'воспитание', 'поколения'],
    keywords: ['семь', 'родител', 'дети', 'родственник', 'семейн', 'воспитани'],
    priority: 8,
    excludeFromTrend: false
  },
  {
    key: 'СМЫСЛ ЖИЗНИ',
    slug: 'meaning',
    synonyms: ['смысл жизни', 'предназначение', 'цель', 'миссия', 'призвание', 'суть', 'философия', 'жизненная философия'],
    keywords: ['смысл', 'предназначени', 'цель', 'миссия', 'призвани', 'философи'],
    priority: 9,
    excludeFromTrend: false
  },
  {
    key: 'СЧАСТЬЕ',
    slug: 'happiness',
    synonyms: ['счастье', 'радость', 'веселье', 'удовольствие', 'блаженство', 'позитив', 'эйфория', 'эмоции', 'эмоциональная экспрессия'],
    keywords: ['счасть', 'радост', 'веселье', 'удовольстви', 'блаженств', 'позитив'],
    priority: 8,
    excludeFromTrend: false
  },
  {
    key: 'ВРЕМЯ И ПРИВЫЧКИ',
    slug: 'time-habits',
    synonyms: ['время', 'привычки', 'рутина', 'организация', 'планирование', 'дисциплина', 'режим'],
    keywords: ['время', 'привычк', 'рутин', 'организаци', 'планировани', 'дисциплин'],
    priority: 7,
    excludeFromTrend: false
  },
  {
    key: 'ДОБРО И ЗЛО',
    slug: 'good-evil',
    synonyms: ['добро', 'зло', 'мораль', 'этика', 'справедливость', 'нравственность', 'принципы'],
    keywords: ['добро', 'зло', 'мораль', 'этик', 'справедливост', 'нравственност'],
    priority: 6,
    excludeFromTrend: false
  },
  {
    key: 'ОБЩЕСТВО',
    slug: 'society',
    synonyms: ['общество', 'социум', 'мир', 'люди', 'человечество', 'цивилизация', 'социальные вопросы'],
    keywords: ['общество', 'социум', 'мир', 'люди', 'человечеств', 'цивилизаци'],
    priority: 7,
    excludeFromTrend: false
  },
  {
    key: 'ПОИСК СЕБЯ',
    slug: 'self-discovery',
    synonyms: ['самопознание', 'саморазвитие', 'поиск себя', 'путь', 'рост', 'развитие', 'познание', 'самосовершенствование', 'личностный рост', 'самосознание', 'становление', 'начало пути', 'влияние мыслей на личность', 'мышление', 'мысли'],
    keywords: ['самопознани', 'саморазвити', 'поиск', 'путь', 'рост', 'развити', 'познани'],
    priority: 9,
    excludeFromTrend: false
  },
  {
    key: 'ДРУГОЕ',
    slug: 'other',
    synonyms: ['другое', 'прочее', 'иное', 'разное'],
    keywords: [],
    priority: 1,
    excludeFromTrend: true
  }
];

/**
 * Create lookup maps for efficient access
 */
const CATEGORIES_BY_KEY = new Map(CANONICAL_CATEGORIES.map(cat => [cat.key, cat]));
const CATEGORIES_BY_SLUG = new Map(CANONICAL_CATEGORIES.map(cat => [cat.slug, cat]));

// Create flat synonym mapping for fast lookup
const SYNONYM_TO_CATEGORY = new Map();
CANONICAL_CATEGORIES.forEach(category => {
  category.synonyms.forEach(synonym => {
    SYNONYM_TO_CATEGORY.set(synonym.toLowerCase(), category.key);
  });
});

// Create flat keyword mapping for fast lookup
const KEYWORD_TO_CATEGORY = new Map();
CANONICAL_CATEGORIES.forEach(category => {
  category.keywords.forEach(keyword => {
    KEYWORD_TO_CATEGORY.set(keyword.toLowerCase(), category.key);
  });
});

module.exports = {
  CANONICAL_CATEGORIES,
  CATEGORIES_BY_KEY,
  CATEGORIES_BY_SLUG,
  SYNONYM_TO_CATEGORY,
  KEYWORD_TO_CATEGORY
};