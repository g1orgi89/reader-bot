/**
 * @file Barrel export для всех типов
 * @description Центральная точка импорта всех типов проекта
 */

// Re-export типов для базы знаний
const knowledgeTypes = require('./knowledge');

// Re-export типов для векторной базы
const vectorStoreTypes = require('./vectorStore');

// Export всех типов для удобного импорта
module.exports = {
  // Типы из knowledge.js доступны напрямую
  ...knowledgeTypes,
  
  // Типы из vectorStore.js доступны напрямую
  ...vectorStoreTypes,
  
  // Также можно импортировать как отдельные модули
  knowledge: knowledgeTypes,
  vectorStore: vectorStoreTypes
};