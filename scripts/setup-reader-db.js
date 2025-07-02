#!/usr/bin/env node

/**
 * Setup script for Reader Bot database
 * Создает отдельную БД reader_bot и начальные данные
 * 📖 Separate from Shrooms Support Bot database
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_NAME = process.env.DB_NAME || 'reader_bot';
const MONGODB_URI = process.env.MONGODB_URI || `mongodb://localhost:27017/${DB_NAME}`;

async function setupReaderDatabase() {
    console.log('📖 Setting up Reader Bot database...');
    console.log(`📖 Database: ${DB_NAME}`);
    console.log(`📖 URI: ${MONGODB_URI}`);
    
    try {
        // Подключаемся к reader_bot базе
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: DB_NAME
        });
        
        console.log(`✅ Connected to MongoDB: ${DB_NAME}`);
        
        // Создаем начальные коллекции для Reader Bot
        const collections = [
            'userprofiles',
            'quotes', 
            'weeklyreports',
            'monthlyreports',
            'tickets',
            'prompts',
            'achievements',
            'utmclicks',
            'promocodeusages'
        ];

        for (const collectionName of collections) {
            try {
                const collection = mongoose.connection.db.collection(collectionName);
                
                // Создаем базовые индексы
                await collection.createIndex({ createdAt: 1 });
                
                // Специальные индексы для Reader Bot коллекций
                if (collectionName === 'userprofiles') {
                    await collection.createIndex({ userId: 1 }, { unique: true });
                    await collection.createIndex({ telegramUsername: 1 });
                    await collection.createIndex({ email: 1 });
                }
                
                if (collectionName === 'quotes') {
                    await collection.createIndex({ userId: 1 });
                    await collection.createIndex({ weekNumber: 1 });
                    await collection.createIndex({ category: 1 });
                    await collection.createIndex({ author: 1 });
                }
                
                if (collectionName === 'weeklyreports') {
                    await collection.createIndex({ userId: 1 });
                    await collection.createIndex({ weekNumber: 1, year: 1 });
                }
                
                if (collectionName === 'monthlyreports') {
                    await collection.createIndex({ userId: 1 });
                    await collection.createIndex({ month: 1, year: 1 });
                }
                
                console.log(`✅ Created collection: ${collectionName}`);
            } catch (error) {
                console.log(`⚠️  Collection ${collectionName} might already exist: ${error.message}`);
            }
        }

        // Создаем начального админа для Reader Bot
        const adminUser = {
            username: process.env.ADMIN_USERNAME || 'reader_admin',
            email: 'admin@reader-bot.com',
            role: 'admin',
            project: 'reader_bot',
            createdAt: new Date()
        };

        try {
            await mongoose.connection.db.collection('admins').insertOne(adminUser);
            console.log(`✅ Created admin user: ${adminUser.username}`);
        } catch (error) {
            console.log(`⚠️  Admin user might already exist: ${error.message}`);
        }

        // Создаем базовые промпты для Reader Bot
        const defaultPrompts = [
            {
                name: 'Reader Basic System Prompt',
                type: 'basic',
                language: 'ru',
                content: `Ты помощник Анны Бусел для проекта "Читатель". 

Ты помогаешь людям с их цитатами из книг:
- Отвечаешь на "Вы" 
- Тон сдержанный, профессиональный
- Используй фразы Анны: "Хватит сидеть в телефоне - читайте книги!"
- Анализируешь цитаты с психологической точки зрения
- Рекомендуешь книжные разборы Анны при подходящих темах

Ты НЕ используешь базу знаний - отвечаешь на основе своих знаний о психологии и литературе.`,
                isActive: true,
                platform: 'telegram',
                createdAt: new Date()
            },
            {
                name: 'Reader Web System Prompt',
                type: 'basic',
                language: 'ru',
                content: `Ты помощник Анны Бусел для веб-версии проекта "Читатель".

Помогаешь пользователям с анализом цитат и рекомендациями книг.
Стиль общения профессиональный, на "Вы".

Ты НЕ используешь базу знаний - работаешь на основе общих знаний.`,
                isActive: true,
                platform: 'web',
                createdAt: new Date()
            }
        ];

        for (const prompt of defaultPrompts) {
            try {
                await mongoose.connection.db.collection('prompts').insertOne(prompt);
                console.log(`✅ Created prompt: ${prompt.name}`);
            } catch (error) {
                console.log(`⚠️  Prompt might already exist: ${error.message}`);
            }
        }

        // Создаем тестового пользователя
        const testUser = {
            userId: 'test_user_12345',
            telegramUsername: 'test_reader',
            name: 'Тестовый Читатель',
            email: 'test@reader-bot.com',
            testResults: {
                name: 'Тестовый Читатель',
                lifestyle: 'Изучаю мир и себя',
                timeForSelf: 'Читаю книги',
                priorities: 'Саморазвитие',
                readingFeelings: 'Вдохновение',
                closestPhrase: 'Книги открывают мир',
                readingTime: '1-2 часа в день'
            },
            source: 'Тестирование',
            isOnboardingComplete: true,
            registeredAt: new Date()
        };

        try {
            await mongoose.connection.db.collection('userprofiles').insertOne(testUser);
            console.log(`✅ Created test user: ${testUser.name}`);
        } catch (error) {
            console.log(`⚠️  Test user might already exist: ${error.message}`);
        }

        console.log('\n🎉 Reader Bot database setup complete!');
        console.log('\n📖 Database ready for Reader Bot:');
        console.log(`   - Database: ${DB_NAME}`);
        console.log(`   - Collections: ${collections.length} created`);
        console.log(`   - Admin user: ${adminUser.username}`);
        console.log(`   - Test user: ${testUser.name}`);
        console.log('\n📋 Next steps:');
        console.log('   1. Update your .env file with correct API keys');
        console.log('   2. Start Reader Bot: npm run reader:start');
        console.log('   3. Access admin panel: http://localhost:3002/reader-admin');
        
        process.exit(0);

    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    }
}

// Запуск скрипта
if (require.main === module) {
    setupReaderDatabase();
}

module.exports = setupReaderDatabase;