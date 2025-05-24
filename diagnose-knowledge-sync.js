/**
 * Диагностический скрипт для анализа синхронизации между MongoDB и Qdrant
 * @file diagnose-knowledge-sync.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const KnowledgeDocument = require('./server/models/knowledge');
const vectorStoreService = require('./server/services/vectorStore');
const logger = require('./server/utils/logger');

/**
 * Диагностика синхронизации между MongoDB и Qdrant
 */
async function diagnoseKnowledgeSync() {
  try {
    console.log('🔍 Starting knowledge base synchronization diagnosis...\n');

    // 1. Подключение к MongoDB
    console.log('📄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // 2. Инициализация Qdrant
    console.log('🧠 Initializing Qdrant...');
    const vectorInitialized = await vectorStoreService.initialize();
    if (!vectorInitialized) {
      throw new Error('Failed to initialize Qdrant');
    }
    console.log('✅ Qdrant initialized\n');

    // 3. Анализ MongoDB
    console.log('📊 Analyzing MongoDB documents...');
    const allDocs = await KnowledgeDocument.find({}).lean();
    const publishedDocs = await KnowledgeDocument.find({ status: 'published' }).lean();
    const draftDocs = await KnowledgeDocument.find({ status: 'draft' }).lean();
    const noDraftsField = await KnowledgeDocument.find({ status: { $exists: false } }).lean();

    console.log(`📄 MongoDB Analysis:`);
    console.log(`   Total documents: ${allDocs.length}`);
    console.log(`   Published: ${publishedDocs.length}`);
    console.log(`   Draft: ${draftDocs.length}`);
    console.log(`   No status field: ${noDraftsField.length}`);
    
    // Показываем все документы
    console.log(`\n📋 All MongoDB documents:`);
    allDocs.forEach((doc, index) => {
      console.log(`   ${index + 1}. "${doc.title}" (${doc.language}) - Status: ${doc.status || 'undefined'}`);
      console.log(`      ID: ${doc._id}`);
      console.log(`      Category: ${doc.category}`);
      console.log(`      Created: ${doc.createdAt}`);
      console.log(`      Content length: ${doc.content?.length || 0} chars\n`);
    });

    // 4. Анализ Qdrant
    console.log('🧠 Analyzing Qdrant collection...');
    const vectorStats = await vectorStoreService.getStats();
    console.log(`🧠 Qdrant Analysis:`);
    console.log(`   Documents count: ${vectorStats.documentsCount}`);
    console.log(`   Status: ${vectorStats.status