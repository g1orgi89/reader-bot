/**
 * @file Центральный файл экспорта типов для проекта Shrooms Support Bot
 * @description Объединяет все типы и обеспечивает единое место для импорта
 */

// Импорт типов Knowledge API
const knowledgeTypes = require('./knowledgeApi');

// Импорт остальных типов
const apiTypes = require('./api');
const ticketTypes = require('./ticket');
const vectorStoreTypes = require('./vectorStore');

// Импорт старых типов knowledge для обратной совместимости
const legacyKnowledgeTypes = require('./knowledge');

// Экспорт всех типов через единый интерфейс
module.exports = {
  // Новые типизированные API types
  ...knowledgeTypes,
  
  // Остальные типы
  ...apiTypes,
  ...ticketTypes,
  ...vectorStoreTypes,
  
  // Legacy types для обратной совместимости
  ...legacyKnowledgeTypes,
  
  // Составные экспорты
  API: {
    ...apiTypes,
    Knowledge: knowledgeTypes
  },
  
  Knowledge: {
    ...knowledgeTypes,
    Legacy: legacyKnowledgeTypes
  },
  
  Ticket: ticketTypes,
  VectorStore: vectorStoreTypes
};