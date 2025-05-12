/**
 * @file Валидаторы для Knowledge API
 * @description Функции валидации для обеспечения типобезопасности Knowledge API
 */

const { SUPPORTED_LANGUAGES, DOCUMENT_CATEGORIES, SUPPORTED_FILE_TYPES } = require('../knowledgeApi');

/**
 * Валидирует поисковый запрос
 * @param {Object} query - Объект запроса
 * @returns {{isValid: boolean, errors: string[]}} Результат валидации
 */
function validateSearchQuery(query) {
  const errors = [];
  
  if (!query || typeof query !== 'object') {
    errors.push('Query must be an object');
    return { isValid: false, errors };
  }
  
  // Проверка обязательного поля query
  if (!query.query || typeof query.query !== 'string' || query.query.trim().length === 0) {
    errors.push('Query string is required and must be non-empty');
  }
  
  // Проверка limit
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'number' || query.limit < 1 || query.limit > 100) {
      errors.push('Limit must be a number between 1 and 100');
    }
  }
  
  // Проверка threshold
  if (query.threshold !== undefined) {
    if (typeof query.threshold !== 'number' || query.threshold < 0 || query.threshold > 1) {
      errors.push('Threshold must be a number between 0 and 1');
    }
  }
  
  // Проверка language
  if (query.language !== undefined) {
    if (!Object.values(SUPPORTED_LANGUAGES).includes(query.language)) {
      errors.push(`Language must be one of: ${Object.values(SUPPORTED_LANGUAGES).join(', ')}`);
    }
  }
  
  // Проверка category
  if (query.category !== undefined) {
    if (!Object.values(DOCUMENT_CATEGORIES).includes(query.category)) {
      errors.push(`Category must be one of: ${Object.values(DOCUMENT_CATEGORIES).join(', ')}`);
    }
  }
  
  // Проверка tags
  if (query.tags !== undefined) {
    if (!Array.isArray(query.tags)) {
      errors.push('Tags must be an array');
    } else if (query.tags.some(tag => typeof tag !== 'string')) {
      errors.push('All tags must be strings');
    }
  }
  
  // Проверка sortBy
  if (query.sortBy !== undefined) {
    const validSortBy = ['relevance', 'date_created', 'date_updated', 'title', 'category'];
    if (!validSortBy.includes(query.sortBy)) {
      errors.push(`sortBy must be one of: ${validSortBy.join(', ')}`);
    }
  }
  
  // Проверка orderBy
  if (query.orderBy !== undefined) {
    const validOrderBy = ['desc', 'asc'];
    if (!validOrderBy.includes(query.orderBy)) {
      errors.push(`orderBy must be one of: ${validOrderBy.join(', ')}`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Валидирует запрос на добавление документа
 * @param {Object} document - Объект документа
 * @returns {{isValid: boolean, errors: string[]}} Результат валидации
 */
function validateDocumentRequest(document) {
  const errors = [];
  
  if (!document || typeof document !== 'object') {
    errors.push('Document must be an object');
    return { isValid: false, errors };
  }
  
  // Проверка обязательных полей
  if (!document.title || typeof document.title !== 'string' || document.title.trim().length === 0) {
    errors.push('Title is required and must be non-empty string');
  }
  
  if (!document.content || typeof document.content !== 'string' || document.content.trim().length === 0) {
    errors.push('Content is required and must be non-empty string');
  }
  
  if (!document.category || typeof document.category !== 'string') {
    errors.push('Category is required and must be a string');
  } else if (!Object.values(DOCUMENT_CATEGORIES).includes(document.category)) {
    errors.push(`Category must be one of: ${Object.values(DOCUMENT_CATEGORIES).join(', ')}`);
  }
  
  // Проверка language
  if (document.language !== undefined) {
    if (!Object.values(SUPPORTED_LANGUAGES).includes(document.language)) {
      errors.push(`Language must be one of: ${Object.values(SUPPORTED_LANGUAGES).join(', ')}`);
    }
  }
  
  // Проверка tags
  if (document.tags !== undefined) {
    if (!Array.isArray(document.tags)) {
      errors.push('Tags must be an array');
    } else if (document.tags.some(tag => typeof tag !== 'string')) {
      errors.push('All tags must be strings');
    }
  }
  
  // Проверка титула на длину
  if (document.title && document.title.length > 500) {
    errors.push('Title cannot exceed 500 characters');
  }
  
  // Проверка контента на длину (ограничение 1MB)
  if (document.content && document.content.length > 1024 * 1024) {
    errors.push('Content cannot exceed 1MB');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Валидирует данные загрузки файлов
 * @param {Object} uploadData - Данные загрузки
 * @returns {{isValid: boolean, errors: string[]}} Результат валидации
 */
function validateFileUpload(uploadData) {
  const errors = [];
  
  if (!uploadData || typeof uploadData !== 'object') {
    errors.push('Upload data must be an object');
    return { isValid: false, errors };
  }
  
  // Проверка files
  if (!uploadData.files || !Array.isArray(uploadData.files) || uploadData.files.length === 0) {
    errors.push('Files array is required and must contain at least one file');
  } else {
    // Проверка каждого файла
    uploadData.files.forEach((file, index) => {
      if (!file.originalname) {
        errors.push(`File at index ${index} must have an originalname`);
      } else {
        const extension = '.' + file.originalname.split('.').pop().toLowerCase();
        if (!Object.values(SUPPORTED_FILE_TYPES).includes(extension)) {
          errors.push(`File ${file.originalname} has unsupported format. Supported: ${Object.values(SUPPORTED_FILE_TYPES).join(', ')}`);
        }
      }
      
      if (!file.path && !file.buffer) {
        errors.push(`File at index ${index} must have either path or buffer`);
      }
      
      // Проверка размера файла (10MB максимум)
      if (file.size && file.size > 10 * 1024 * 1024) {
        errors.push(`File ${file.originalname || `at index ${index}`} exceeds maximum size of 10MB`);
      }
    });
    
    // Проверка количества файлов
    if (uploadData.files.length > 5) {
      errors.push('Cannot upload more than 5 files at once');
    }
  }
  
  // Проверка category
  if (uploadData.category !== undefined) {
    if (!Object.values(DOCUMENT_CATEGORIES).includes(uploadData.category)) {
      errors.push(`Category must be one of: ${Object.values(DOCUMENT_CATEGORIES).join(', ')}`);
    }
  }
  
  // Проверка language
  if (uploadData.language !== undefined) {
    if (!Object.values(SUPPORTED_LANGUAGES).includes(uploadData.language)) {
      errors.push(`Language must be one of: ${Object.values(SUPPORTED_LANGUAGES).join(', ')}`);
    }
  }
  
  // Проверка tags
  if (uploadData.tags !== undefined) {
    if (!Array.isArray(uploadData.tags)) {
      errors.push('Tags must be an array');
    } else if (uploadData.tags.some(tag => typeof tag !== 'string')) {
      errors.push('All tags must be strings');
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Валидирует запрос на удаление документа
 * @param {Object} deleteRequest - Запрос на удаление
 * @returns {{isValid: boolean, errors: string[]}} Результат валидации
 */
function validateDocumentDelete(deleteRequest) {
  const errors = [];
  
  if (!deleteRequest || typeof deleteRequest !== 'object') {
    errors.push('Delete request must be an object');
    return { isValid: false, errors };
  }
  
  // Проверка id
  if (!deleteRequest.id || typeof deleteRequest.id !== 'string' || deleteRequest.id.trim().length === 0) {
    errors.push('Document ID is required and must be non-empty string');
  }
  
  // Проверка cascade
  if (deleteRequest.cascade !== undefined && typeof deleteRequest.cascade !== 'boolean') {
    errors.push('Cascade must be a boolean');
  }
  
  // Проверка force
  if (deleteRequest.force !== undefined && typeof deleteRequest.force !== 'boolean') {
    errors.push('Force must be a boolean');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Валидирует запрос на реиндексацию
 * @param {Object} reindexRequest - Запрос на реиндексацию
 * @returns {{isValid: boolean, errors: string[]}} Результат валидации
 */
function validateReindexRequest(reindexRequest) {
  const errors = [];
  
  if (!reindexRequest || typeof reindexRequest !== 'object') {
    errors.push('Reindex request must be an object');
    return { isValid: false, errors };
  }
  
  // Проверка clearFirst
  if (reindexRequest.clearFirst !== undefined && typeof reindexRequest.clearFirst !== 'boolean') {
    errors.push('clearFirst must be a boolean');
  }
  
  // Проверка categories
  if (reindexRequest.categories !== undefined) {
    if (!Array.isArray(reindexRequest.categories)) {
      errors.push('categories must be an array');
    } else {
      reindexRequest.categories.forEach(category => {
        if (!Object.values(DOCUMENT_CATEGORIES).includes(category)) {
          errors.push(`Invalid category: ${category}. Must be one of: ${Object.values(DOCUMENT_CATEGORIES).join(', ')}`);
        }
      });
    }
  }
  
  // Проверка languages
  if (reindexRequest.languages !== undefined) {
    if (!Array.isArray(reindexRequest.languages)) {
      errors.push('languages must be an array');
    } else {
      reindexRequest.languages.forEach(language => {
        if (!Object.values(SUPPORTED_LANGUAGES).includes(language)) {
          errors.push(`Invalid language: ${language}. Must be one of: ${Object.values(SUPPORTED_LANGUAGES).join(', ')}`);
        }
      });
    }
  }
  
  // Проверка parallel
  if (reindexRequest.parallel !== undefined && typeof reindexRequest.parallel !== 'boolean') {
    errors.push('parallel must be a boolean');
  }
  
  return { isValid: errors.length === 0, errors };
}

module.exports = {
  validateSearchQuery,
  validateDocumentRequest,
  validateFileUpload,
  validateDocumentDelete,
  validateReindexRequest
};