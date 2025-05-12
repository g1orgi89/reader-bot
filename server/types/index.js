/**
 * Shared types for Shrooms AI Support Bot
 * @fileoverview Общие типы для всех модулей системы
 */

/**
 * @typedef {Object} VectorDocument
 * @property {string} id - Уникальный идентификатор документа
 * @property {string} content - Текстовое содержимое документа
 * @property {VectorDocumentMetadata} metadata - Метаданные документа
 * @property {number[]} [embedding] - Векторное представление документа (опционально)
 */

/**
 * @typedef {Object} VectorDoc