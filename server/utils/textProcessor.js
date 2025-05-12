/**
 * @file Text processing utilities for VectorStore
 * @description Утилиты для обработки текста, включая intelligent chunking и contextual embeddings
 * 
 * Основано на лучших практиках Anthropic Cookbook для улучшения RAG performance
 */

/**
 * @import {DocumentChunk, VectorDocumentMetadata} from '../types/index.js'
 */

/**
 * @typedef {Object} ChunkingOptions
 * @property {number} chunkSize - Размер чанка в токенах
 * @property {number} chunkOverlap - Перекрытие между чанками
 * @property {boolean} [useBoundaryDetection=true] - Использовать ли детекцию границ
 * @property {boolean} [preserveCodeBlocks=true] - Сохранять ли блоки кода
 * @property {string[]} [separators] - Кастомные разделители
 */

/**
 * @typedef {Object} ProcessingResult
 * @property {DocumentChunk[]} chunks - Обработанные чанки
 * @property {VectorDocumentMetadata} metadata - Метаданные документа
 * @property {number} totalTokens - Общее количество токенов
 */

/**
 * @class TextProcessor
 * @description Класс для обработки и подготовки текстов для векторной базы
 */
class TextProcessor {
  /**
   * @constructor
   * @param {ChunkingOptions} options - Опции для обработки текста
   */
  constructor(options = {}) {
    this.options = {
      chunkSize: 800,
      chunkOverlap: 200,
      useBoundaryDetection: true,
      preserveCodeBlocks: true,
      separators: ['\n\n', '\n', '. ', ', ', ' '],
      ...options
    };
  }

  /**
   * Разделение документа на чанки с интеллектуальной обработкой границ
   * @param {string} text - Текст для разделения
   * @param {VectorDocumentMetadata} metadata - Метаданные документа
   * @returns {Promise<ProcessingResult>}
   */
  async createChunks(text, metadata) {
    try {
      // Предварительная обработка текста
      const processedText = this._preprocessText(text);
      
      // Подсчет токенов
      const totalTokens = this._estimateTokens(processedText);
      
      // Если текст мал, возвращаем как один чанк
      if (totalTokens <= this.options.chunkSize) {
        return {
          chunks: [{
            id: this._generateChunkId(metadata.source, 0),
            text: processedText,
            metadata: { ...metadata, chunkIndex: 0 },
            startIndex: 0,
            endIndex: processedText.length
          }],
          metadata,
          totalTokens
        };
      }

      // Создание чанков с учетом границ
      const chunks = await this._createIntelligentChunks(processedText, metadata);
      
      return {
        chunks,
        metadata,
        totalTokens
      };
    } catch (error) {
      throw new Error(`Error creating chunks: ${error.message}`);
    }
  }

  /**
   * Предварительная обработка текста
   * @private
   * @param {string} text - Исходный текст
   * @returns {string} Обработанный текст
   */
  _preprocessText(text) {
    let processed = text;
    
    // Удаление лишних пробелов и символов
    processed = processed.replace(/\r\n/g, '\n');
    processed = processed.replace(/\n{3,}/g, '\n\n');
    processed = processed.replace(/[ \t]{2,}/g, ' ');
    
    // Нормализация markdown заголовков
    processed = processed.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2');
    
    return processed.trim();
  }

  /**
   * Создание интеллектуальных чанков с учетом структуры документа
   * @private
   * @param {string} text - Текст для обработки
   * @param {VectorDocumentMetadata} metadata - Метаданные
   * @returns {Promise<DocumentChunk[]>}
   */
  async _createIntelligentChunks(text, metadata) {
    const chunks = [];
    const { chunkSize, chunkOverlap } = this.options;
    
    // Определение структурных элементов
    const sections = this._identifyStructuralElements(text);
    
    let chunkIndex = 0;
    let currentPosition = 0;
    
    while (currentPosition < text.length) {
      const remainingText = text.slice(currentPosition);
      const remainingTokens = this._estimateTokens(remainingText);
      
      if (remainingTokens <= chunkSize) {
        // Последний чанк - берем весь оставшийся текст
        chunks.push({
          id: this._generateChunkId(metadata.source, chunkIndex),
          text: remainingText,
          metadata: { ...metadata, chunkIndex },
          startIndex: currentPosition,
          endIndex: text.length
        });
        break;
      }
      
      // Найти оптимальную границу для чанка
      const chunkEnd = this._findOptimalChunkBoundary(
        text,
        currentPosition,
        chunkSize,
        sections
      );
      
      const chunkText = text.slice(currentPosition, chunkEnd);
      chunks.push({
        id: this._generateChunkId(metadata.source, chunkIndex),
        text: chunkText,
        metadata: { ...metadata, chunkIndex },
        startIndex: currentPosition,
        endIndex: chunkEnd
      });
      
      // Вычисление следующей позиции с учетом перекрытия
      const overlapSize = Math.min(chunkOverlap, Math.floor(chunkText.length * 0.25));
      currentPosition = chunkEnd - overlapSize;
      chunkIndex++;
    }
    
    return chunks;
  }

  /**
   * Определение структурных элементов в тексте
   * @private
   * @param {string} text - Текст для анализа
   * @returns {Object[]} Массив структурных элементов
   */
  _identifyStructuralElements(text) {
    const elements = [];
    
    // Markdown заголовки
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(text)) !== null) {
      elements.push({
        type: 'heading',
        level: match[1].length,
        text: match[2],
        position: match.index,
        end: match.index + match[0].length
      });
    }
    
    // Абзацы
    const paragraphRegex = /\n\n/g;
    while ((match = paragraphRegex.exec(text)) !== null) {
      elements.push({
        type: 'paragraph_break',
        position: match.index
      });
    }
    
    // Блоки кода
    if (this.options.preserveCodeBlocks) {
      const codeBlockRegex = /```[\s\S]*?```/g;
      while ((match = codeBlockRegex.exec(text)) !== null) {
        elements.push({
          type: 'code_block',
          position: match.index,
          end: match.index + match[0].length
        });
      }
    }
    
    elements.sort((a, b) => a.position - b.position);
    return elements;
  }

  /**
   * Поиск оптимальной границы для чанка
   * @private
   * @param {string} text - Полный текст
   * @param {number} start - Начальная позиция
   * @param {number} maxTokens - Максимум токенов в чанке
   * @param {Object[]} sections - Структурные элементы
   * @returns {number} Оптимальная позиция окончания чанка
   */
  _findOptimalChunkBoundary(text, start, maxTokens, sections) {
    // Приблизительная оценка размера в символах
    const approxCharLimit = maxTokens * 4; // ~4 символа на токен
    let targetPos = Math.min(start + approxCharLimit, text.length);
    
    // Поиск ближайшей границы абзаца
    const paragraphBoundary = this._findNearestParagraphBoundary(text, targetPos);
    if (paragraphBoundary !== -1 && Math.abs(paragraphBoundary - targetPos) <= approxCharLimit * 0.2) {
      targetPos = paragraphBoundary;
    }
    
    // Проверка, не разрывается ли блок кода
    const codeBlock = sections.find(s => 
      s.type === 'code_block' && s.position < targetPos && s.end > targetPos
    );
    if (codeBlock) {
      // Если мы внутри блока кода, лучше разделить до него или после
      const beforeBlock = Math.max(start, codeBlock.position - 100);
      const afterBlock = codeBlock.end;
      targetPos = Math.abs(beforeBlock - targetPos) < Math.abs(afterBlock - targetPos) ? 
        beforeBlock : afterBlock;
    }
    
    // Проверка настоящего размера в токенах
    const chunkText = text.slice(start, targetPos);
    const actualTokens = this._estimateTokens(chunkText);
    
    if (actualTokens > maxTokens) {
      // Уменьшаем размер чанка
      const reduction = Math.ceil((actualTokens - maxTokens) * 4);
      targetPos = Math.max(start + 100, targetPos - reduction);
    }
    
    return Math.min(targetPos, text.length);
  }

  /**
   * Поиск ближайшей границы абзаца
   * @private
   * @param {string} text - Текст
   * @param {number} position - Позиция поиска
   * @returns {number} Позиция границы или -1
   */
  _findNearestParagraphBoundary(text, position) {
    const searchRange = 100;
    const searchStart = Math.max(0, position - searchRange);
    const searchEnd = Math.min(text.length, position + searchRange);
    
    // Поиск двойных переносов строк
    const beforePos = text.lastIndexOf('\n\n', position);
    const afterPos = text.indexOf('\n\n', position);
    
    if (beforePos !== -1 && beforePos >= searchStart && beforePos <= position) {
      return beforePos + 2;
    }
    
    if (afterPos !== -1 && afterPos <= searchEnd && afterPos >= position) {
      return afterPos + 2;
    }
    
    return -1;
  }

  /**
   * Приблизительная оценка количества токенов
   * @private
   * @param {string} text - Текст для оценки
   * @returns {number} Приблизительное количество токенов
   */
  _estimateTokens(text) {
    // Очень приблизительная оценка: 1 токен ≈ 4 символа для большинства языков
    // Для кода соотношение может быть другим
    const baseEstimate = Math.ceil(text.length / 4);
    
    // Корректировка для кода (больше токенов)
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).join('');
    const codeTokens = Math.ceil(codeBlocks.length / 3); // Код плотнее
    const regularTokens = Math.ceil((text.length - codeBlocks.length) / 4);
    
    return codeTokens + regularTokens;
  }

  /**
   * Генерация ID для чанка
   * @private
   * @param {string} source - Источник документа
   * @param {number} index - Индекс чанка
   * @returns {string} ID чанка
   */
  _generateChunkId(source, index) {
    // Очистка имени файла и создание читаемого ID
    const filename = source.split('/').pop().replace(/\.[^/.]+$/, '');
    const sanitized = filename.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitized}_chunk_${index}`;
  }

  /**
   * Создание контекстуальных embeddings (по методологии Anthropic)
   * @param {DocumentChunk[]} chunks - Чанки для обработки
   * @param {string} fullDocument - Полный документ для контекста
   * @param {Function} claudeClient - Клиент Claude для генерации контекста
   * @returns {Promise<DocumentChunk[]>} Чанки с добавленным контекстом
   */
  async createContextualEmbeddings(chunks, fullDocument, claudeClient) {
    const contextualChunks = [];
    
    const contextPrompt = `
Пожалуйста, дайте краткое объясняющее описание следующей части документа. 
Это описание будет использоваться для улучшения поиска, поэтому включите 
ключевые понятия и контекст, который может быть не очевиден в изолированном 
тексте. Не добавляйте никаких преамбул и отвечайте только кратким описанием.

Документ:
{{DOCUMENT}}

Часть документа:
{{CHUNK}}

Описание:`;

    for (const chunk of chunks) {
      try {
        // Генерация контекста через Claude
        const response = await claudeClient.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 200,
          temperature: 0.0,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: contextPrompt.replace('{{DOCUMENT}}', fullDocument),
                cache_control: { type: 'ephemeral' } // Используем prompt caching
              },
              {
                type: 'text',
                text: contextPrompt.replace('{{CHUNK}}', chunk.text)
              }
            ]
          }]
        });
        
        const context = response.content[0].text.trim();
        
        // Добавляем контекст к чанку
        const contextualText = `${context}\n\n${chunk.text}`;
        
        contextualChunks.push({
          ...chunk,
          text: contextualText,
          metadata: {
            ...chunk.metadata,
            hasContextualEmbedding: true,
            contextLength: context.length
          }
        });
      } catch (error) {
        console.warn(`Failed to create contextual embedding for chunk ${chunk.id}: ${error.message}`);
        contextualChunks.push(chunk);
      }
    }
    
    return contextualChunks;
  }

  /**
   * Bulk обработка документов
   * @param {Object[]} documents - Документы для обработки
   * @param {Function} [progressCallback] - Callback для отслеживания прогресса
   * @returns {Promise<ProcessingResult[]>} Результаты обработки
   */
  async processDocuments(documents, progressCallback) {
    const results = [];
    let processed = 0;
    
    for (const doc of documents) {
      try {
        const result = await this.createChunks(doc.content, doc.metadata);
        results.push(result);
        
        processed++;
        if (progressCallback) {
          progressCallback(processed, documents.length);
        }
      } catch (error) {
        console.error(`Error processing document ${doc.metadata.source}: ${error.message}`);
        if (progressCallback) {
          progressCallback(processed, documents.length, error);
        }
      }
    }
    
    return results;
  }
}

module.exports = TextProcessor;