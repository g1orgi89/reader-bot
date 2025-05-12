/**
 * @file Тесты для типизированного скрипта загрузки знаний
 * @description Модульные тесты для TypedKnowledgeLoader
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const TypedKnowledgeLoader = require('../../scripts/loadKnowledge');
const VectorStoreService = require('../../server/services/vectorStore');
const TextProcessor = require('../../server/utils/textProcessor');

// Mock dependencies
jest.mock('../../server/services/vectorStore');
jest.mock('../../server/utils/textProcessor');
jest.mock('../../server/utils/logger');

describe('TypedKnowledgeLoader', () => {
  /** @type {TypedKnowledgeLoader} */
  let loader;
  let mockVectorStore;
  let mockTextProcessor;
  let tempDir;
  
  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-test-'));
    
    // Mock services
    mockVectorStore = {
      initialize: jest.fn().mockResolvedValue(undefined),
      addDocuments: jest.fn().mockResolvedValue(undefined),
      createEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };
    
    mockTextProcessor = {
      createChunks: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          text: 'Test chunk 1',
          metadata: { order: 0 },
          startIndex: 0,
          endIndex: 100
        },
        {
          id: 'chunk-2',
          text: 'Test chunk 2',
          metadata: { order: 1 },
          startIndex: 100,
          endIndex: 200
        }
      ])
    };
    
    VectorStoreService.mockImplementation(() => mockVectorStore);
    TextProcessor.mockImplementation(() => mockTextProcessor);
    
    // Create loader instance
    loader = new TypedKnowledgeLoader({
      knowledgePath: tempDir,
      maxConcurrency: 2,
      processingOptions: {
        chunkSize: 100,
        chunkOverlap: 20
      }
    });
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  describe('Type Validation', () => {
    test('should validate document types correctly', () => {
      const validDocument = {
        path: 'test.md',
        content: 'Test content',
        metadata: {
          language: 'en',
          category: 'general',
          title: 'Test',
          createdAt: new Date()
        },
        hash: 'test-hash'
      };
      
      const validated = loader.validateDocuments([validDocument]);
      expect(validated).toHaveLength(1);
      expect(validated[0]).toMatchObject(validDocument);
    });
    
    test('should handle invalid documents', () => {
      const invalidDocument = {
        path: 'test.md',
        content: 'Test content',
        metadata: {
          // Missing required fields
        }
      };
      
      const validated = loader.validateDocuments([invalidDocument]);
      expect(validated).toHaveLength(0);
      expect(loader.stats.skippedFiles).toBe(1);
      expect(loader.stats.errors).toHaveLength(1);
    });
  });
  
  describe('File Processing', () => {
    test('should process markdown files correctly', async () => {
      const mdContent = `---
title: Test Document
tags: [test, markdown]
language: en
category: general
---

# Test Document

This is a test document.

## Section 1

Content for section 1.
`;
      
      const document = {
        path: 'test.md',
        content: mdContent,
        metadata: {
          language: 'en',
          category: 'general'
        }
      };
      
      const result = await loader.loadMarkdownFile(document);
      
      expect(result.content).not.toContain('---');
      expect(result.content).toContain('# Test Document');
      expect(result.metadata.type).toBe('markdown');
      expect(result.metadata.hasStructure).toBe(true);
    });
    
    test('should process JSON files correctly', async () => {
      const jsonContent = JSON.stringify({
        title: 'Test API',
        description: 'API documentation',
        content: 'Detailed API description',
        version: '1.0'
      });
      
      const document = {
        path: 'api.json',
        content: jsonContent,
        metadata: {
          language: 'en',
          category: 'technical'
        }
      };
      
      const result = await loader.loadJsonFile(document);
      
      expect(result.content).toContain('# Test API');
      expect(result.content).toContain('API documentation');
      expect(result.metadata.originalStructure).toBeDefined();
      expect(result.metadata.originalStructure.version).toBe('1.0');
    });
  });
  
  describe('Metadata Extraction', () => {
    test('should extract metadata correctly', () => {
      const content = `---
title: Test Document
tags: [test, docs]
custom: value
---

# Test Document

Content here.
`;
      
      const metadata = loader.extractTypedMetadata('general/test.md', content);
      
      expect(metadata.source).toBe('general/test.md');
      expect(metadata.title).toBe('Test Document');
      expect(metadata.language).toBe('en');
      expect(metadata.category).toBe('general');
      expect(metadata.tags).toContain('test');
      expect(metadata.tags).toContain('docs');
    });
    
    test('should detect language correctly', () => {
      const ruContent = 'Это русский текст с кириллицей';
      const esPath = 'guide/es/help.md';
      const ruPath = 'docs/ru/manual.md';
      
      expect(loader.detectLanguage('general/test.md', ruContent)).toBe('ru');
      expect(loader.detectLanguage(esPath, 'English content')).toBe('es');
      expect(loader.detectLanguage(ruPath, 'English content')).toBe('ru');
      expect(loader.detectLanguage('general/test.md', 'English content')).toBe('en');
    });
    
    test('should detect category correctly', () => {
      expect(loader.detectCategory('general/about.md')).toBe('general');
      expect(loader.detectCategory('user-guide/setup.md')).toBe('user-guide');
      expect(loader.detectCategory('api/reference.md')).toBe('technical');
      expect(loader.detectCategory('faq/common.md')).toBe('troubleshooting');
      expect(loader.detectCategory('unknown/file.md')).toBe('unknown');
    });
  });
  
  describe('Embedding Queue', () => {
    test('should process embedding queue correctly', async () => {
      // Create test chunks
      const chunks = [
        {
          id: 'chunk-1',
          text: 'Test chunk 1',
          metadata: { category: 'test' }
        },
        {
          id: 'chunk-2',
          text: 'Test chunk 2',
          metadata: { category: 'test' }
        }
      ];
      
      // Mock successful embedding creation
      mockVectorStore.createEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.addDocuments.mockResolvedValue(undefined);
      
      await loader.createAndUploadEmbeddings(chunks);
      
      expect(loader.embeddingQueue.completed).toHaveLength(2);
      expect(loader.embeddingQueue.failed).toHaveLength(0);
      expect(mockVectorStore.createEmbedding).toHaveBeenCalledTimes(2);
      expect(mockVectorStore.addDocuments).toHaveBeenCalledTimes(2);
    });
    
    test('should handle embedding failures with retry', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          text: 'Test chunk',
          metadata: { category: 'test' }
        }
      ];
      
      // Mock failure then success
      mockVectorStore.createEmbedding
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      
      await loader.createAndUploadEmbeddings(chunks);
      
      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(loader.embeddingQueue.completed).toHaveLength(1);
      expect(mockVectorStore.createEmbedding).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Statistics', () => {
    test('should track statistics correctly', () => {
      loader.stats.totalFiles = 10;
      loader.stats.processedFiles = 8;
      loader.stats.skippedFiles = 1;
      loader.stats.totalChunks = 50;
      loader.stats.totalVectors = 48;
      loader.stats.errors = [
        { file: 'test1.md', error: 'Parse error', type: 'parse' },
        { file: 'test2.md', error: 'Read error', type: 'read' }
      ];
      
      const langStats = loader.getLanguageStatistics();
      const categoryStats = loader.getCategoryStatistics();
      const errorStats = loader.groupErrorsByType();
      
      // Mock completed tasks for stats
      loader.embeddingQueue.completed = [
        { metadata: { language: 'en', category: 'general' } },
        { metadata: { language: 'ru', category: 'general' } },
        { metadata: { language: 'en', category: 'technical' } }
      ];
      
      const updatedLangStats = loader.getLanguageStatistics();
      const updatedCategoryStats = loader.getCategoryStatistics();
      
      expect(updatedLangStats.en).toBe(2);
      expect(updatedLangStats.ru).toBe(1);
      expect(updatedCategoryStats.general).toBe(2);
      expect(updatedCategoryStats.technical).toBe(1);
      expect(errorStats.parse).toHaveLength(1);
      expect(errorStats.read).toHaveLength(1);
    });
  });
  
  describe('Document Grouping', () => {
    test('should group documents correctly', () => {
      const documents = [
        {
          metadata: { category: 'general', language: 'en' }
        },
        {
          metadata: { category: 'general', language: 'ru' }
        },
        {
          metadata: { category: 'technical', language: 'en' }
        },
        {
          metadata: { category: 'general', language: 'en' }
        }
      ];
      
      const grouped = loader.groupDocumentsForProcessing(documents);
      
      expect(grouped.size).toBe(3);
      expect(grouped.get('general_en')).toHaveLength(2);
      expect(grouped.get('general_ru')).toHaveLength(1);
      expect(grouped.get('technical_en')).toHaveLength(1);
    });
  });
  
  describe('Configuration', () => {
    test('should initialize file types correctly', () => {
      expect(loader.supportedFileTypes.size).toBeGreaterThan(0);
      expect(loader.supportedFileTypes.has('.md')).toBe(true);
      expect(loader.supportedFileTypes.has('.txt')).toBe(true);
      expect(loader.supportedFileTypes.has('.json')).toBe(true);
      
      const mdType = loader.supportedFileTypes.get('.md');
      expect(mdType.extension).toBe('.md');
      expect(mdType.mimeType).toBe('text/markdown');
      expect(typeof mdType.loader).toBe('function');
    });
    
    test('should initialize language configs correctly', () => {
      expect(loader.languageConfigs.size).toBe(3);
      expect(loader.languageConfigs.has('en')).toBe(true);
      expect(loader.languageConfigs.has('ru')).toBe(true);
      expect(loader.languageConfigs.has('es')).toBe(true);
      
      const enConfig = loader.languageConfigs.get('en');
      expect(enConfig.code).toBe('en');
      expect(enConfig.name).toBe('English');
      expect(enConfig.patterns).toContain('/en/');
    });
    
    test('should initialize category configs correctly', () => {
      expect(loader.categoryConfigs.size).toBe(5);
      expect(loader.categoryConfigs.has('general')).toBe(true);
      
      const generalConfig = loader.categoryConfigs.get('general');
      expect(generalConfig.name).toBe('general');
      expect(generalConfig.paths).toContain('general/');
      expect(generalConfig.priority).toBe(1);
    });
  });
  
  describe('Integration Tests', () => {
    test('should process example documents end-to-end', async () => {
      // Create test files
      const mdFile = path.join(tempDir, 'test.md');
      const jsonFile = path.join(tempDir, 'api.json');
      
      await fs.writeFile(mdFile, `---
title: Test Document
tags: [test]
---

# Test Document

This is a test.
`);
      
      await fs.writeFile(jsonFile, JSON.stringify({
        title: 'API Docs',
        content: 'API documentation'
      }));
      
      // Run processing
      const stats = await loader.loadKnowledgeBase();
      
      expect(stats.totalFiles).toBe(2);
      expect(stats.processedFiles).toBe(2);
      expect(stats.totalChunks).toBe(4); // 2 chunks per file
      expect(stats.totalVectors).toBe(4);
      expect(mockVectorStore.initialize).toHaveBeenCalled();
      expect(mockTextProcessor.createChunks).toHaveBeenCalledTimes(2);
    });
  });
});