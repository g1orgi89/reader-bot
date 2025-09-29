/**
 * @fileoverview Category Normalization Utilities
 * @description Utilities for normalizing categories and themes to canonical keys
 * @author Reader Bot Team
 */

const {
  CANONICAL_CATEGORIES,
  CATEGORIES_BY_KEY,
  CATEGORIES_BY_SLUG,
  SYNONYM_TO_CATEGORY,
  KEYWORD_TO_CATEGORY
} = require('../shared/categoriesConfig');

/**
 * Normalize a category to canonical key
 * @param {string} raw - Raw category string
 * @returns {string} Canonical category key (or 'ДРУГОЕ')
 */
function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'string') {
    return 'ДРУГОЕ';
  }

  const normalized = raw.toLowerCase().trim();
  
  // Direct key match (case-insensitive)
  const directMatch = CANONICAL_CATEGORIES.find(cat => 
    cat.key.toLowerCase() === normalized
  );
  if (directMatch) {
    return directMatch.key;
  }

  // Synonym match
  if (SYNONYM_TO_CATEGORY.has(normalized)) {
    return SYNONYM_TO_CATEGORY.get(normalized);
  }

  // Partial contains match with synonyms
  for (const [synonym, categoryKey] of SYNONYM_TO_CATEGORY.entries()) {
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      return categoryKey;
    }
  }

  // Keyword match for fallback heuristic
  for (const [keyword, categoryKey] of KEYWORD_TO_CATEGORY.entries()) {
    if (normalized.includes(keyword)) {
      return categoryKey;
    }
  }

  return 'ДРУГОЕ';
}

/**
 * Detect categories from text using heuristic keyword scoring
 * @param {string} text - Text to analyze
 * @returns {string[]} Array of detected canonical category keys
 */
function detectCategoriesFromText(text) {
  if (!text || typeof text !== 'string') {
    return ['ДРУГОЕ'];
  }

  const textLower = text.toLowerCase();
  const categoryScores = new Map();

  // Score based on keyword matches
  for (const [keyword, categoryKey] of KEYWORD_TO_CATEGORY.entries()) {
    if (textLower.includes(keyword)) {
      const currentScore = categoryScores.get(categoryKey) || 0;
      categoryScores.set(categoryKey, currentScore + 1);
    }
  }

  // Score based on synonym matches
  for (const [synonym, categoryKey] of SYNONYM_TO_CATEGORY.entries()) {
    if (textLower.includes(synonym)) {
      const currentScore = categoryScores.get(categoryKey) || 0;
      categoryScores.set(categoryKey, currentScore + 2); // Synonyms get higher weight
    }
  }

  // Sort by score and return top categories
  const sortedCategories = [...categoryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([categoryKey]) => categoryKey)
    .slice(0, 3);

  return sortedCategories.length > 0 ? sortedCategories : ['ДРУГОЕ'];
}

/**
 * Get category slug for a canonical key
 * @param {string} key - Canonical category key
 * @returns {string} Category slug
 */
function getCategorySlug(key) {
  const category = CATEGORIES_BY_KEY.get(key);
  return category ? category.slug : 'other';
}

/**
 * Get all categories for API responses
 * @returns {Object[]} Array of category objects with key, slug, priority
 */
function getAllCategories() {
  return CANONICAL_CATEGORIES.map(cat => ({
    key: cat.key,
    slug: cat.slug,
    priority: cat.priority
  }));
}

/**
 * Normalize and filter themes array
 * @param {string[]} themes - Raw themes array
 * @returns {string[]} Normalized and filtered themes (max 3, no duplicates, filtered 'ДРУГОЕ' if others exist)
 */
function normalizeThemes(themes) {
  if (!Array.isArray(themes) || themes.length === 0) {
    return ['размышления'];
  }

  // Normalize each theme
  const normalizedThemes = themes
    .map(theme => normalizeCategory(theme))
    .filter(theme => theme && theme.trim()); // Remove empty

  // Remove duplicates
  const uniqueThemes = [...new Set(normalizedThemes)];

  // Filter out 'ДРУГОЕ' if there are other categories
  const filteredThemes = uniqueThemes.length > 1 
    ? uniqueThemes.filter(theme => theme !== 'ДРУГОЕ')
    : uniqueThemes;

  // Limit to 3
  const limitedThemes = filteredThemes.slice(0, 3);

  // Ensure we have at least one theme
  return limitedThemes.length > 0 ? limitedThemes : ['размышления'];
}

/**
 * Normalize analysis object with category and themes
 * @param {Object} analysis - Raw analysis object
 * @param {string} analysis.category - Raw category
 * @param {string[]} analysis.themes - Raw themes array
 * @returns {Object} Normalized analysis with canonical category and themes
 */
function normalizeAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return {
      category: 'ДРУГОЕ',
      themes: ['размышления']
    };
  }

  const normalizedCategory = normalizeCategory(analysis.category);
  const normalizedThemes = normalizeThemes(analysis.themes);

  // Ensure themes include the category if themes are empty or only 'ДРУГОЕ'
  const finalThemes = normalizedThemes.length === 0 || 
    (normalizedThemes.length === 1 && normalizedThemes[0] === 'ДРУГОЕ')
    ? [normalizedCategory]
    : normalizedThemes;

  return {
    ...analysis,
    category: normalizedCategory,
    themes: finalThemes
  };
}

/**
 * Check if a category key is valid canonical category
 * @param {string} key - Category key to validate
 * @returns {boolean} True if valid canonical category
 */
function isValidCategory(key) {
  return CATEGORIES_BY_KEY.has(key);
}

/**
 * Get category by slug
 * @param {string} slug - Category slug
 * @returns {Object|null} Category object or null if not found
 */
function getCategoryBySlug(slug) {
  return CATEGORIES_BY_SLUG.get(slug) || null;
}

module.exports = {
  normalizeCategory,
  detectCategoriesFromText,
  getCategorySlug,
  getAllCategories,
  normalizeThemes,
  normalizeAnalysis,
  isValidCategory,
  getCategoryBySlug
};