/**
 * Vector Store Service for Shrooms AI Support Bot
 * @file server/services/vectorStore.js
 */

const { QdrantVectorStore } = require("@langchain/qdrant");
const { OpenAIEmbeddings } = require("@langchain/openai");
const logger = require('../utils/logger');

/**
 * @typedef {Object} VectorSearchResult
 * @property {string} content - Document content
 * @property {number} score - Similarity score
 * @property {Object} metadata - Document metadata
 */

/**
 * @typedef {Object} VectorDocument
 * @property {string} content - Document content
 * @property {Object} metadata - Document metadata
 */

/**
 * @class VectorStoreService
 * @description Service for managing vector storage and retrieval
 */
class VectorStoreService {
  constructor() {
    this.vectorStore = null;
    this.embeddings = null;
    this.isInitialized = false;
    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'shrooms_knowledge';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Initialize the vector store connection
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Check if vector store is disabled
      if (!process.env.ENABLE_RAG || process.env.ENABLE_RAG === 'false') {
        logger.info('Vector store disabled by configuration');
        return;
      }

      // Initialize embeddings
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OpenAI API key not found, vector store cannot be initialized');
        return;
      }

      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: process.env.EMBEDDING_MODEL || "text-embedding-ada-002"
      });

      // Try to connect to Qdrant with retries
      let lastError;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          await this._connectToQdrant();
          logger.info(`Vector store initialized successfully (attempt ${attempt})`);
          this.isInitialized = true;
          return;
        } catch (error) {
          lastError = error;
          logger.warn(`Vector store connection attempt ${attempt} failed: ${error.message}`);
          
          if (attempt < this.maxRetries) {
            await this._wait(this.retryDelay * attempt);
          }
        }
      }

      throw lastError;
    } catch (error) {
      logger.error(`Failed to initialize vector store: ${error.message}`);
      this.isInitialized = false;
      // Don't throw - allow the application to continue without RAG
    }
  }

  /**
   * Connect to Qdrant vector database
   * @private
   */
  async _connectToQdrant() {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;

    // Test connection first
    const testUrl = `${qdrantUrl}/collections`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (qdrantApiKey) {
      headers['api-key'] = qdrantApiKey;
    }

    // Test connection with a simple API call
    const fetch = require('node-fetch');
    const response = await fetch(testUrl, { 
      method: 'GET',
      headers,
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Qdrant connection failed: ${response.status} ${response.statusText}`);
    }

    // Initialize vector store
    this.vectorStore = await QdrantVectorStore.fromExistingCollection(
      this.embeddings,
      {
        url: qdrantUrl,
        apiKey: qdrantApiKey,
        collectionName: this.collectionName
      }
    );
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {number} options.k - Number of results to return
   * @param {string} options.language - Language filter
   * @param {Array} options.categories - Category filters
   * @returns {Promise<VectorSearchResult[]>} Search results
   */
  async search(query, options = {}) {
    if (!this.isInitialized || !this.vectorStore) {
      logger.warn('Vector store not initialized, returning empty results');
      return [];
    }

    try {
      const { k = 5, language, categories } = options;

      // Build filter for metadata
      const filter = {};
      if (language) {
        filter.language = language;
      }
      if (categories && categories.length > 0) {
        filter.category = { $in: categories };
      }

      // Perform similarity search
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        k,
        Object.keys(filter).length > 0 ? filter : undefined
      );

      return results.map(([doc, score]) => ({
        content: doc.pageContent,
        score,
        metadata: doc.metadata
      }));
    } catch (error) {
      logger.error(`Vector search error: ${error.message}`);
      return [];
    }
  }

  /**
   * Add documents to the vector store
   * @param {VectorDocument[]} documents - Documents to add
   * @returns {Promise<void>}
   */
  async addDocuments(documents) {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      await this.vectorStore.addDocuments(documents);
      logger.info(`Added ${documents.length} documents to vector store`);
    } catch (error) {
      logger.error(`Error adding documents to vector store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get health status of vector store
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    if (!this.isInitialized) {
      return {
        status: 'error',
        message: 'Vector store not initialized',
        details: {
          isInitialized: false,
          hasEmbeddings: !!this.embeddings,
          hasVectorStore: !!this.vectorStore
        }
      };
    }

    try {
      // Try a simple search to verify connection
      await