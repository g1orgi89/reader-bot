require('dotenv').config();
console.log('=== Environment Variables Test ===');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars:', Object.keys(process.env).filter(key => key.startsWith('MONGODB')));

// Test MongoDB connection
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('\n=== MongoDB Connection Test ===');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support';
    console.log('Using URI:', uri);
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ MongoDB connected successfully!');
    await mongoose.connection.close();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error details:', error);
  }
}

testConnection();