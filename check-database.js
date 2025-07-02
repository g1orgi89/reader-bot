/**
 * Простая проверка базы данных
 * @file check-database.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    console.log('🔍 Checking database...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Проверяем коллекции
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Collections found:', collections.map(c => c.name).join(', '));
    
    // Проверяем пользователей
    try {
      const userCount = await mongoose.connection.db.collection('userprofiles').countDocuments();
      console.log('👥 Users count:', userCount);
      
      if (userCount > 0) {
        const users = await mongoose.connection.db.collection('userprofiles').find({}).limit(3).toArray();
        console.log('👤 Sample users:');
        users.forEach(user => {
          console.log(`  - ${user.name || 'No name'} (ID: ${user.userId || user._id})`);
          console.log(`    Email: ${user.email || 'No email'}`);
          console.log(`    Registered: ${user.registeredAt || 'Unknown'}`);
        });
      } else {
        console.log('⚠️ No users found - need to register through Telegram bot');
      }
    } catch (e) {
      console.log('👥 No users collection yet');
    }
    
    // Проверяем цитаты
    try {
      const quoteCount = await mongoose.connection.db.collection('quotes').countDocuments();
      console.log('📝 Quotes count:', quoteCount);
      
      if (quoteCount > 0) {
        const quotes = await mongoose.connection.db.collection('quotes').find({}).limit(5).toArray();
        console.log('📖 Sample quotes:');
        quotes.forEach((quote, index) => {
          console.log(`  ${index + 1}. "${quote.text?.substring(0, 50)}..." by ${quote.author || 'Unknown'}`);
          console.log(`     User: ${quote.userId}, Date: ${quote.createdAt}`);
        });
      } else {
        console.log('⚠️ No quotes found - need to send quotes through Telegram bot');
      }
    } catch (e) {
      console.log('📝 No quotes collection yet');
    }
    
    // Проверяем отчеты
    try {
      const reportCount = await mongoose.connection.db.collection('weeklyreports').countDocuments();
      console.log('📊 Weekly reports count:', reportCount);
      
      if (reportCount > 0) {
        const reports = await mongoose.connection.db.collection('weeklyreports').find({}).limit(3).toArray();
        console.log('📈 Sample reports:');
        reports.forEach((report, index) => {
          console.log(`  ${index + 1}. Week ${report.weekNumber}/${report.year} for user ${report.userId}`);
          console.log(`     Analysis: ${report.analysis?.summary?.substring(0, 60)}...`);
        });
      } else {
        console.log('⚠️ No weekly reports found yet');
      }
    } catch (e) {
      console.log('📊 No reports collection yet');
    }
    
    await mongoose.disconnect();
    console.log('✅ Database check complete');
    
    // Рекомендации
    console.log('\n💡 RECOMMENDATIONS:');
    if (userCount === 0) {
      console.log('1. Send /start to your Telegram bot to create a user');
      console.log('2. Complete the onboarding test');
      console.log('3. Send a few quotes to the bot');
      console.log('4. Test weekly report generation');
    } else if (quoteCount === 0) {
      console.log('1. Send some quotes to your existing Telegram bot');
      console.log('2. Test weekly report generation');
    } else {
      console.log('1. You can test weekly reports with existing data!');
      console.log('2. Run: node test-weekly-service.js');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
}

// Запуск проверки
if (require.main === module) {
  checkDatabase();
}

module.exports = { checkDatabase };