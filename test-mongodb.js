/**
 * Тест подключения к MongoDB
 * @file test-mongodb.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('URI:', process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ MongoDB connected successfully!');
    
    // Тест операции
    const testCollection = mongoose.connection.db.collection('test');
    await testCollection.insertOne({ test: 'Hello MongoDB!' });
    const result = await testCollection.findOne({ test: 'Hello MongoDB!' });
    console.log('✅ Test operation successful:', result);
    
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();