/**
 * Simple test script for MongoDB connection and basic setup
 * @file test-mongodb-simple.js
 */

const mongoose = require('mongoose');
const logger = require('./server/utils/logger');

async function testMongoDB() {
  try {
    console.log('🔍 Testing MongoDB connection...');
    
    // Подключаемся к MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB successfully');
    
    // Проверяем ping
    await mongoose.connection.db.admin().ping();
    console.log('✅ MongoDB ping successful');
    
    // Получаем информацию о базе данных
    const dbStats = await mongoose.connection.db.stats();
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`📊 Collections: ${dbStats.collections}`);
    console.log(`📊 Objects: ${dbStats.objects}`);
    
    // Тестируем создание простого документа
    const TestSchema = new mongoose.Schema({
      message: String,
      createdAt: { type: Date, default: Date.now }
    });
    
    const TestModel = mongoose.model('Test', TestSchema);
    
    const testDoc = new TestModel({
      message: 'MongoDB connection test successful'
    });
    
    await testDoc.save();
    console.log('✅ Test document created successfully');
    
    // Удаляем тестовый документ
    await TestModel.deleteOne({ _id: testDoc._id });
    console.log('✅ Test document deleted successfully');
    
    // Отключаемся
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
    console.log('\n🎉 MongoDB test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ MongoDB test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Запускаем тест
require('dotenv').config();
testMongoDB();