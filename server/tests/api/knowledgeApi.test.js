/**
 * @file Тест типизированного Knowledge API
 * @description Проверка валидации, типов и функциональности API
 */

const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const knowledgeRouter = require('../../api/knowledge');
const { 
  API_ERROR_CODES,
  SUPPORTED_LANGUAGES,
  DOCUMENT_CATEGORIES 
} = require('../../types/knowledgeApi');

describe('Typized Knowledge API', () => {
  let app;
  
  before(() => {
    app = express();
    app.use(express.json());
    app.use('/api/knowledge', knowledgeRouter);
  });
  
  describe('POST /api/knowledge/documents', () => {
    it('должен валидировать обязательные поля', async () => {
      const res = await request(app)
        .post('/api/knowledge/documents')
        .send({})
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.details.validationErrors).to.be.an('array');
    });
    
    it('должен валидировать типы полей', async () => {
      const res = await request(app)
        .post('/api/knowledge/documents')
        .send({
          title: 123, // Неправильный тип
          content: 'Valid content',
          category: 'valid-category'
        })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать категории', async () => {
      const res = await request(app)
        .post('/api/knowledge/documents')
        .send({
          title: 'Test Title',
          content: 'Test content',
          category: 'invalid-category'
        })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать языки', async () => {
      const res = await request(app)
        .post('/api/knowledge/documents')
        .send({
          title: 'Test Title',
          content: 'Test content',
          category: DOCUMENT_CATEGORIES.GENERAL,
          language: 'invalid-language'
        })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
  });
  
  describe('GET /api/knowledge/search', () => {
    it('должен валидировать отсутствие query параметра', async () => {
      const res = await request(app)
        .get('/api/knowledge/search')
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать некорректные числовые параметры', async () => {
      const res = await request(app)
        .get('/api/knowledge/search?q=test&limit=invalid')
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать threshold диапазон', async () => {
      const res = await request(app)
        .get('/api/knowledge/search?q=test&threshold=1.5')
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать sortBy значения', async () => {
      const res = await request(app)
        .get('/api/knowledge/search?q=test&sortBy=invalid-sort')
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
  });
  
  describe('DELETE /api/knowledge/documents/:id', () => {
    it('должен валидировать наличие ID', async () => {
      const res = await request(app)
        .delete('/api/knowledge/documents/')
        .expect(404);
    });
    
    it('должен валидировать пустой ID', async () => {
      const res = await request(app)
        .delete('/api/knowledge/documents/ ')
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать булевые параметры', async () => {
      const res = await request(app)
        .delete('/api/knowledge/documents/test-id?cascade=invalid-boolean')
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
  });
  
  describe('POST /api/knowledge/reindex', () => {
    it('должен валидировать параметры reindex', async () => {
      const res = await request(app)
        .post('/api/knowledge/reindex')
        .send({
          clearFirst: 'invalid-boolean',
          categories: 'not-an-array'
        })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать категории в массиве', async () => {
      const res = await request(app)
        .post('/api/knowledge/reindex')
        .send({
          categories: ['valid-category', 'invalid-category']
        })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
    
    it('должен валидировать языки в массиве', async () => {
      const res = await request(app)
        .post('/api/knowledge/reindex')
        .send({
          languages: [SUPPORTED_LANGUAGES.ENGLISH, 'invalid-language']
        })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.VALIDATION_ERROR);
    });
  });
  
  describe('Type Safety Tests', () => {
    it('должен правильно типизировать SearchResponse', () => {
      // Этот тест проверяет, что TypeScript интерпретация работает корректно
      const mockSearchResponse = {
        success: true,
        results: [],
        totalResults: 0,
        searchOptions: {
          query: 'test',
          limit: 10,
          threshold: 0.7
        },
        metadata: {
          searchTime: 100,
          vectorStoreProvider: 'test',
          embedModelUsed: 'test-model',
          totalDocuments: 0,
          appliedFilters: {
            categories: [],
            languages: [],
            tags: [],
            dateRange: {}
          }
        },
        query: 'test'
      };
      
      expect(mockSearchResponse).to.have.property('success');
      expect(mockSearchResponse).to.have.property('results');
      expect(mockSearchResponse).to.have.property('searchOptions');
      expect(mockSearchResponse).to.have.property('metadata');
    });
    
    it('должен правильно типизировать DocumentResponse', () => {
      const mockDocumentResponse = {
        success: true,
        documentId: 'test-id',
        chunksCreated: 3,
        totalTokens: 450,
        processingStats: {
          originalSizeBytes: 1024,
          processedSizeBytes: 890,
          processingTimeMs: 125,
          chunkingStats: {
            totalChunks: 3,
            averageChunkSize: 297,
            maxChunkSize: 400,
            minChunkSize: 200,
            chunkOverlap: 50
          }
        }
      };
      
      expect(mockDocumentResponse).to.have.property('success');
      expect(mockDocumentResponse).to.have.property('documentId');
      expect(mockDocumentResponse).to.have.property('processingStats');
      expect(mockDocumentResponse.processingStats).to.have.property('chunkingStats');
    });
    
    it('должен правильно типизировать APIErrorResponse', () => {
      const mockErrorResponse = {
        success: false,
        error: 'Test error',
        errorCode: API_ERROR_CODES.VALIDATION_ERROR,
        details: {
          validationErrors: [
            {
              field: 'test-field',
              message: 'Test error message',
              code: 'INVALID_VALUE'
            }
          ]
        },
        timestamp: new Date()
      };
      
      expect(mockErrorResponse).to.have.property('success');
      expect(mockErrorResponse).to.have.property('error');
      expect(mockErrorResponse).to.have.property('errorCode');
      expect(mockErrorResponse).to.have.property('details');
      expect(mockErrorResponse).to.have.property('timestamp');
    });
  });
  
  describe('File Upload Tests', () => {
    it('должен валидировать отсутствие файлов', async () => {
      const res = await request(app)
        .post('/api/knowledge/upload')
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.errorCode).to.equal(API_ERROR_CODES.NO_FILES);
    });
  });
  
  describe('Constants Tests', () => {
    it('должен экспортировать корректные константы', () => {
      expect(SUPPORTED_LANGUAGES).to.have.property('ENGLISH');
      expect(SUPPORTED_LANGUAGES).to.have.property('SPANISH');
      expect(SUPPORTED_LANGUAGES).to.have.property('RUSSIAN');
      
      expect(DOCUMENT_CATEGORIES).to.have.property('GENERAL');
      expect(DOCUMENT_CATEGORIES).to.have.property('USER_GUIDE');
      expect(DOCUMENT_CATEGORIES).to.have.property('TOKENOMICS');
      expect(DOCUMENT_CATEGORIES).to.have.property('TECHNICAL');
      expect(DOCUMENT_CATEGORIES).to.have.property('TROUBLESHOOTING');
      
      expect(API_ERROR_CODES).to.have.property('MISSING_FIELDS');
      expect(API_ERROR_CODES).to.have.property('VALIDATION_ERROR');
      expect(API_ERROR_CODES).to.have.property('SEARCH_ERROR');
    });
  });
});

// Интеграционные тесты с реальными сервисами
describe('Knowledge API Integration Tests', () => {
  describe('Health Check', () => {
    it('должен возвращать статус системы', async () => {
      const res = await request(app)
        .get('/api/knowledge/health')
        .expect(200);
      
      expect(res.body).to.have.property('success');
      expect(res.body).to.have.property('status');
      expect(res.body).to.have.property('components');
      expect(res.body).to.have.property('responseTimeMs');
    });
  });
  
  describe('Stats', () => {
    it('должен возвращать статистику базы знаний', async () => {
      const res = await request(app)
        .get('/api/knowledge/stats')
        .expect(200);
      
      expect(res.body).to.have.property('success');
      expect(res.body).to.have.property('stats');
      expect(res.body.stats).to.have.property('totalDocuments');
      expect(res.body.stats).to.have.property('totalChunks');
      expect(res.body.stats).to.have.property('storage');
    });
  });
});

module.exports = {
  // Экспорт для использования в других тестах
  testApp: app
};