/**
 * @fileoverview Утилита для чанкинга (разбиения) текстовых документов на части
 * Используется для векторизации больших документов в Qdrant
 * @author Shrooms Development Team
 */

const logger = require('./logger');

/**
 * @typedef {Object} ChunkOptions
 * @property {number} [chunkSize=500] - Размер чанка в символах
 * @property {number} [overlap=100] - Перекрытие между чанками в символах
 * @property {string} [separator='\n\n'] - Разделитель для первичного разбиения
 * @property {boolean} [preserveParagraphs=true] - Сохранять целостность параграфов
 * @property {number} [minChunkSize=50] - Минимальный размер чанка
 */

/**
 * @typedef {Object} DocumentChunk
 * @property {string} id - Уникальный ID чанка (originalId_chunk_N)
 * @property {string} content - Содержимое чанка
 * @property {Object} metadata - Метаданные чанка
 * @property {string} metadata.originalId - ID оригинального документа
 * @property {number} metadata.chunkIndex - Индекс чанка (начиная с 0)
 * @property {number} metadata.totalChunks - Общее количество чанков документа
 * @property {number} metadata.startPosition - Начальная позиция в оригинальном тексте
 * @property {number} metadata.endPosition - Конечная позиция в оригинальном тексте
 * @property {string} metadata.title - Заголовок оригинального документа
 * @property {string} metadata.category - Категория документа
 * @property {string} metadata.language - Язык документа
 * @property {string[]} metadata.tags - Теги документа
 * @property {Date} metadata.createdAt - Дата создания документа
 * @property {Date} metadata.updatedAt - Дата обновления документа
 */

/**
 * Утилита для чанкинга текстовых документов
 * @class TextChunker
 */
class TextChunker {
  /**
   * Создает экземпляр TextChunker с настройками по умолчанию
   * @constructor
   */
  constructor() {
    // Настройки по умолчанию оптимизированы для OpenAI embeddings
    this.defaultOptions = {
      chunkSize: 500,       // Оптимальный размер для качественных embeddings
      overlap: 100,         // Перекрытие для сохранения контекста
      separator: '\n\n',    // Разбиение по параграфам
      preserveParagraphs: true,  // Сохранение целостности параграфов
      minChunkSize: 50      // Минимальный размер чанка
    };
  }

  /**
   * Разбивает один документ на чанки
   * @param {Object} document - Документ для чанкинга
   * @param {string} document.id - ID документа
   * @param {string} document.content - Содержимое документа
   * @param {Object} document.metadata - Метаданные документа
   * @param {ChunkOptions} [options={}] - Опции чанкинга
   * @returns {DocumentChunk[]} Массив чанков
   */
  chunkDocument(document, options = {}) {
    try {
      if (!document || !document.id || !document.content) {
        logger.warn('🍄 Документ для чанкинга содержит неполные данные');
        return [];
      }

      const config = { ...this.defaultOptions, ...options };
      const content = document.content.trim();
      
      // Если документ короткий, возвращаем его целиком
      if (content.length <= config.chunkSize) {
        logger.debug(`🍄 Документ ${document.id} слишком короткий для чанкинга (${content.length} символов)`);
        return [{
          id: `${document.id}_chunk_0`,
          content: content,
          metadata: {
            ...document.metadata,
            originalId: document.id,
            chunkIndex: 0,
            totalChunks: 1,
            startPosition: 0,
            endPosition: content.length
          }
        }];
      }

      logger.info(`🍄 Чанкинг документа ${document.id} (${content.length} символов) с размером чанка ${config.chunkSize}`);

      const chunks = this._createChunks(content, config);
      
      // Преобразуем чанки в DocumentChunk объекты
      const documentChunks = chunks.map((chunk, index) => ({
        id: `${document.id}_chunk_${index}`,
        content: chunk.text,
        metadata: {
          ...document.metadata,
          originalId: document.id,
          chunkIndex: index,
          totalChunks: chunks.length,
          startPosition: chunk.start,
          endPosition: chunk.end
        }
      }));

      logger.info(`🍄 Документ ${document.id} разбит на ${documentChunks.length} чанков`);
      
      // Логируем размеры чанков для отладки
      documentChunks.forEach((chunk, index) => {
        logger.debug(`🍄 Чанк ${index}: ${chunk.content.length} символов (позиции ${chunk.metadata.startPosition}-${chunk.metadata.endPosition})`);
      });

      return documentChunks;
    } catch (error) {
      logger.error(`🍄 Ошибка при чанкинге документа ${document.id}: ${error.message}`);
      return [];
    }
  }

  /**
   * Разбивает несколько документов на чанки
   * @param {Object[]} documents - Массив документов для чанкинга
   * @param {ChunkOptions} [options={}] - Опции чанкинга
   * @returns {DocumentChunk[]} Массив всех чанков
   */
  chunkDocuments(documents, options = {}) {
    try {
      if (!Array.isArray(documents) || documents.length === 0) {
        logger.warn('🍄 Не предоставлен массив документов для чанкинга');
        return [];
      }

      logger.info(`🍄 Начинаем чанкинг ${documents.length} документов`);
      
      const allChunks = [];
      let totalOriginalSize = 0;
      let totalChunks = 0;

      for (const document of documents) {
        const documentChunks = this.chunkDocument(document, options);
        allChunks.push(...documentChunks);
        
        totalOriginalSize += document.content?.length || 0;
        totalChunks += documentChunks.length;
      }

      const averageChunkSize = totalChunks > 0 ? Math.round(totalOriginalSize / totalChunks) : 0;
      
      logger.info(`🍄 Чанкинг завершен: ${documents.length} документов → ${totalChunks} чанков (средний размер: ${averageChunkSize} символов)`);

      return allChunks;
    } catch (error) {
      logger.error(`🍄 Ошибка при чанкинге документов: ${error.message}`);
      return [];
    }
  }

  /**
   * Создает чанки из текста с учетом настроек
   * @private
   * @param {string} text - Исходный текст
   * @param {ChunkOptions} config - Конфигурация чанкинга
   * @returns {Object[]} Массив объектов чанков с позициями
   */
  _createChunks(text, config) {
    const chunks = [];
    
    if (config.preserveParagraphs) {
      // Разбиение с сохранением целостности параграфов
      return this._createParagraphAwareChunks(text, config);
    } else {
      // Простое разбиение по размеру
      return this._createSimpleChunks(text, config);
    }
  }

  /**
   * Создает чанки с сохранением целостности параграфов
   * @private
   * @param {string} text - Исходный текст
   * @param {ChunkOptions} config - Конфигурация чанкинга
   * @returns {Object[]} Массив объектов чанков
   */
  _createParagraphAwareChunks(text, config) {
    const chunks = [];
    const paragraphs = text.split(config.separator);
    
    let currentChunk = '';
    let currentStart = 0;
    let processedLength = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      const newChunkContent = currentChunk ? 
        currentChunk + config.separator + paragraph : 
        paragraph;

      // Если добавление параграфа превышает размер чанка
      if (newChunkContent.length > config.chunkSize && currentChunk) {
        // Сохраняем текущий чанк
        if (currentChunk.length >= config.minChunkSize) {
          chunks.push({
            text: currentChunk,
            start: currentStart,
            end: currentStart + currentChunk.length
          });
        }

        // Начинаем новый чанк с overlap
        const overlapText = this._getOverlapText(currentChunk, config.overlap);
        currentStart = processedLength - overlapText.length;
        currentChunk = overlapText + (overlapText ? config.separator : '') + paragraph;
      } else {
        // Добавляем параграф к текущему чанку
        currentChunk = newChunkContent;
        if (!currentStart) {
          currentStart = processedLength;
        }
      }

      processedLength += paragraph.length + config.separator.length;
    }

    // Добавляем последний чанк
    if (currentChunk && currentChunk.length >= config.minChunkSize) {
      chunks.push({
        text: currentChunk,
        start: currentStart,
        end: currentStart + currentChunk.length
      });
    }

    return chunks;
  }

  /**
   * Создает простые чанки фиксированного размера
   * @private
   * @param {string} text - Исходный текст
   * @param {ChunkOptions} config - Конфигурация чанкинга
   * @returns {Object[]} Массив объектов чанков
   */
  _createSimpleChunks(text, config) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + config.chunkSize, text.length);
      
      // Пытаемся найти границу слова для более естественного разбиения
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const boundary = Math.max(lastSpace, lastNewline);
        
        if (boundary > start + config.minChunkSize) {
          end = boundary;
        }
      }

      const chunkText = text.slice(start, end).trim();
      
      if (chunkText.length >= config.minChunkSize) {
        chunks.push({
          text: chunkText,
          start: start,
          end: end
        });
      }

      // Следующий чанк начинается с учетом overlap
      start = Math.max(start + 1, end - config.overlap);
    }

    return chunks;
  }

  /**
   * Получает текст для перекрытия между чанками
   * @private
   * @param {string} text - Текст чанка
   * @param {number} overlapSize - Размер перекрытия
   * @returns {string} Текст для перекрытия
   */
  _getOverlapText(text, overlapSize) {
    if (!text || overlapSize <= 0) return '';
    
    const startPos = Math.max(0, text.length - overlapSize);
    let overlapText = text.slice(startPos);
    
    // Пытаемся начать с начала предложения или параграфа для лучшего контекста
    const sentenceBoundary = overlapText.search(/[.!?]\s+/);
    if (sentenceBoundary > 0 && sentenceBoundary < overlapSize / 2) {
      overlapText = overlapText.slice(sentenceBoundary + 2);
    }
    
    return overlapText.trim();
  }

  /**
   * Восстанавливает оригинальный документ из чанков
   * @param {DocumentChunk[]} chunks - Чанки документа
   * @returns {Object|null} Восстановленный документ
   */
  reconstructDocument(chunks) {
    try {
      if (!Array.isArray(chunks) || chunks.length === 0) {
        return null;
      }

      // Сортируем чанки по индексу
      const sortedChunks = chunks
        .filter(chunk => chunk.metadata?.originalId)
        .sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);

      if (sortedChunks.length === 0) {
        return null;
      }

      const firstChunk = sortedChunks[0];
      const originalId = firstChunk.metadata.originalId;

      // Объединяем содержимое чанков
      const content = sortedChunks.map(chunk => chunk.content).join('\n\n');

      return {
        id: originalId,
        content: content,
        metadata: {
          title: firstChunk.metadata.title,
          category: firstChunk.metadata.category,
          language: firstChunk.metadata.language,
          tags: firstChunk.metadata.tags,
          createdAt: firstChunk.metadata.createdAt,
          updatedAt: firstChunk.metadata.updatedAt
        }
      };
    } catch (error) {
      logger.error(`🍄 Ошибка при восстановлении документа из чанков: ${error.message}`);
      return null;
    }
  }

  /**
   * Получает статистику чанкинга
   * @param {DocumentChunk[]} chunks - Чанки для анализа
   * @returns {Object} Статистика чанкинга
   */
  getChunkingStats(chunks) {
    try {
      if (!Array.isArray(chunks) || chunks.length === 0) {
        return {
          totalChunks: 0,
          uniqueDocuments: 0,
          averageChunkSize: 0,
          totalContentLength: 0
        };
      }

      const uniqueDocuments = new Set(chunks.map(chunk => chunk.metadata?.originalId)).size;
      const totalContentLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      const averageChunkSize = Math.round(totalContentLength / chunks.length);

      const chunkSizes = chunks.map(chunk => chunk.content.length);
      const minChunkSize = Math.min(...chunkSizes);
      const maxChunkSize = Math.max(...chunkSizes);

      return {
        totalChunks: chunks.length,
        uniqueDocuments,
        averageChunkSize,
        totalContentLength,
        minChunkSize,
        maxChunkSize,
        chunkSizeDistribution: {
          small: chunkSizes.filter(size => size < 200).length,
          medium: chunkSizes.filter(size => size >= 200 && size < 500).length,
          large: chunkSizes.filter(size => size >= 500).length
        }
      };
    } catch (error) {
      logger.error(`🍄 Ошибка при получении статистики чанкинга: ${error.message}`);
      return {
        totalChunks: 0,
        uniqueDocuments: 0,
        averageChunkSize: 0,
        totalContentLength: 0,
        error: error.message
      };
    }
  }
}

// Экспортируем singleton экземпляр
module.exports = new TextChunker();