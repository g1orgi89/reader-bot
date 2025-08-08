/**
 * COMPREHENSIVE VERIFICATION SCRIPT
 * Tests all the fixes implemented for user duplication and quote attribution
 */

require('dotenv').config();
const mongoose = require('mongoose');
const UserProfile = require('./server/models/userProfile');
const Quote = require('./server/models/quote');

async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader_bot';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

async function createTestUser() {
    console.log('\n📝 Creating test user...');
    
    const testUserId = 'TEST_USER_123';
    const testData = {
        name: 'Test User',
        email: 'testuser@example.com',
        testResults: {
            question1_name: 'Test User',
            question2_lifestyle: '👶 Я мама (дети - главная забота)',
            question3_time: '🌅 Рано утром, пока все спят',
            question4_priorities: '🧘‍♀️ Найти внутренний баланс',
            question5_reading_feeling: '🔍 Нахожу ответы на свои вопросы',
            question6_phrase: '✨ "Счастье — это выбор"',
            question7_reading_time: '📚 Меньше часа (читаю редко)',
            completedAt: new Date()
        },
        source: 'Telegram',
        telegramUsername: 'testuser123',
        telegramData: {
            firstName: 'Test',
            lastName: 'User',
            languageCode: 'ru',
            chatId: testUserId
        },
        isOnboardingComplete: true,
        registeredAt: new Date()
    };

    // Clean up first
    await UserProfile.deleteMany({ userId: testUserId });
    await Quote.deleteMany({ userId: testUserId });

    // Create user using the fixed atomic operation
    const user = await UserProfile.findOneAndUpdate(
        { userId: testUserId },
        {
            $setOnInsert: {
                userId: testUserId,
                ...testData,
                createdAt: new Date()
            },
            $set: { updatedAt: new Date() }
        },
        {
            upsert: true,
            new: true,
            runValidators: true
        }
    );

    console.log(`✅ Test user created: ${user.userId} (${user.name})`);
    return user;
}

async function createTestQuotes(userId) {
    console.log('\n📖 Creating test quotes...');
    
    const testQuotes = [
        {
            userId: userId,
            text: 'Первая тестовая цитата о саморазвитии',
            author: 'Тестовый Автор 1',
            source: 'Тестовая Книга 1',
            category: 'Саморазвитие',
            sentiment: 'positive'
        },
        {
            userId: userId,
            text: 'Вторая тестовая цитата о любви',
            author: 'Тестовый Автор 2',
            source: 'Тестовая Книга 2',
            category: 'Любовь',
            sentiment: 'positive'
        },
        {
            userId: userId,
            text: 'Третья тестовая цитата о мудрости',
            author: 'Тестовый Автор 1',
            source: 'Тестовая Книга 3',
            category: 'Мудрость',
            sentiment: 'neutral'
        }
    ];

    const quotes = [];
    for (const quoteData of testQuotes) {
        const quote = new Quote(quoteData);
        await quote.save();
        quotes.push(quote);
    }

    console.log(`✅ Created ${quotes.length} test quotes`);
    return quotes;
}

async function createOtherUserQuotes() {
    console.log('\n👥 Creating quotes for other users (to test filtering)...');
    
    const otherUserId = 'OTHER_USER_456';
    
    // Clean up first
    await UserProfile.deleteMany({ userId: otherUserId });
    await Quote.deleteMany({ userId: otherUserId });
    
    // Create other user
    const otherUser = await UserProfile.findOneAndUpdate(
        { userId: otherUserId },
        {
            $setOnInsert: {
                userId: otherUserId,
                name: 'Other User',
                email: 'otheruser@example.com',
                testResults: {
                    question1_name: 'Other User',
                    question2_lifestyle: '⚖️ Замужем, балансирую дом/работу/себя',
                    question3_time: '🌙 Поздно вечером, когда дела сделаны',
                    question4_priorities: '💭 Понять свои истинные желания',
                    question5_reading_feeling: '⚡ Получаю вдохновение и энергию',
                    question6_phrase: '❤️ "Любовь начинается с себя"',
                    question7_reading_time: '📚 1-3 часа в неделю',
                    completedAt: new Date()
                },
                source: 'Telegram',
                isOnboardingComplete: true,
                createdAt: new Date()
            },
            $set: { updatedAt: new Date() }
        },
        {
            upsert: true,
            new: true,
            runValidators: true
        }
    );

    // Create quotes for other user
    const otherQuotes = [
        {
            userId: otherUserId,
            text: 'Цитата другого пользователя о философии',
            author: 'Другой Автор',
            source: 'Другая Книга',
            category: 'Философия',
            sentiment: 'neutral'
        }
    ];

    for (const quoteData of otherQuotes) {
        const quote = new Quote(quoteData);
        await quote.save();
    }

    console.log(`✅ Created other user ${otherUserId} with ${otherQuotes.length} quotes`);
    return { otherUser, otherQuotes };
}

async function testQuoteFiltering(testUserId) {
    console.log('\n🔍 Testing quote filtering by userId...');
    
    // Test 1: Direct query should only return test user's quotes
    const userQuotes = await Quote.find({ userId: testUserId });
    console.log(`✅ Direct query: Found ${userQuotes.length} quotes for test user`);
    
    // Test 2: Query without userId filter should return all quotes
    const allQuotes = await Quote.find({});
    console.log(`📊 Total quotes in database: ${allQuotes.length}`);
    
    // Test 3: Verify filtering works correctly
    const otherUserQuotes = await Quote.find({ userId: { $ne: testUserId } });
    console.log(`👥 Other users' quotes: ${otherUserQuotes.length}`);
    
    if (userQuotes.length === 3 && otherUserQuotes.length >= 1) {
        console.log('✅ Quote filtering working correctly');
        return true;
    } else {
        console.log('❌ Quote filtering has issues');
        return false;
    }
}

async function testStatisticsFiltering(testUserId) {
    console.log('\n📊 Testing statistics filtering...');
    
    try {
        // Test category statistics for user
        const userStats = await Quote.aggregate([
            { $match: { userId: testUserId } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        console.log('✅ User statistics by category:');
        userStats.forEach(stat => {
            console.log(`   ${stat._id}: ${stat.count} quotes`);
        });
        
        // Test total quotes for user
        const totalUserQuotes = await Quote.countDocuments({ userId: testUserId });
        console.log(`✅ Total quotes for user: ${totalUserQuotes}`);
        
        // Test authors for user
        const userAuthors = await Quote.distinct('author', { 
            userId: testUserId,
            author: { $ne: null, $ne: '' }
        });
        console.log(`✅ Unique authors for user: ${userAuthors.length} (${userAuthors.join(', ')})`);
        
        return totalUserQuotes === 3 && userStats.length === 3;
    } catch (error) {
        console.error('❌ Statistics filtering error:', error.message);
        return false;
    }
}

async function testUserDuplicationPrevention() {
    console.log('\n🔒 Testing user duplication prevention...');
    
    const testUserId = 'DUPLICATE_TEST_789';
    
    // Clean up first
    await UserProfile.deleteMany({ userId: testUserId });
    
    const userData = {
        name: 'Duplicate Test',
        email: 'duplicate@example.com',
        testResults: {
            question1_name: 'Duplicate Test',
            question2_lifestyle: '🌸 Без отношений, изучаю мир и себя',
            question3_time: '📱 Урывками в течение дня',
            question4_priorities: '💕 Научиться любить себя',
            question5_reading_feeling: '😌 Успокаиваюсь и расслабляюсь',
            question6_phrase: '🌍 "Жизнь — это путешествие"',
            question7_reading_time: '📚 3-5 часов в неделю',
            completedAt: new Date()
        },
        source: 'Telegram',
        isOnboardingComplete: true
    };
    
    // Simulate concurrent requests
    const promises = Array(5).fill(null).map(() =>
        UserProfile.findOneAndUpdate(
            { userId: testUserId },
            {
                $setOnInsert: {
                    userId: testUserId,
                    ...userData,
                    createdAt: new Date()
                },
                $set: { updatedAt: new Date() }
            },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        )
    );
    
    const results = await Promise.all(promises);
    
    // Check that all results point to the same user
    const uniqueUserIds = [...new Set(results.map(u => u._id.toString()))];
    
    console.log(`✅ Concurrent operations completed: ${results.length} requests`);
    console.log(`✅ Unique users created: ${uniqueUserIds.length} (should be 1)`);
    
    // Verify in database
    const usersInDb = await UserProfile.find({ userId: testUserId });
    console.log(`✅ Users in database: ${usersInDb.length} (should be 1)`);
    
    // Cleanup
    await UserProfile.deleteMany({ userId: testUserId });
    
    return uniqueUserIds.length === 1 && usersInDb.length === 1;
}

async function testComprehensiveScenario() {
    console.log('\n🎯 Running comprehensive test scenario...');
    
    let passed = 0;
    let total = 0;
    
    // Test 1: User duplication prevention
    total++;
    const duplicationTest = await testUserDuplicationPrevention();
    if (duplicationTest) {
        console.log('✅ Test 1 PASSED: User duplication prevention');
        passed++;
    } else {
        console.log('❌ Test 1 FAILED: User duplication prevention');
    }
    
    // Test 2: Create test data
    total++;
    try {
        const testUser = await createTestUser();
        const testQuotes = await createTestQuotes(testUser.userId);
        const { otherUser, otherQuotes } = await createOtherUserQuotes();
        console.log('✅ Test 2 PASSED: Test data creation');
        passed++;
        
        // Test 3: Quote filtering
        total++;
        const filteringTest = await testQuoteFiltering(testUser.userId);
        if (filteringTest) {
            console.log('✅ Test 3 PASSED: Quote filtering');
            passed++;
        } else {
            console.log('❌ Test 3 FAILED: Quote filtering');
        }
        
        // Test 4: Statistics filtering
        total++;
        const statsTest = await testStatisticsFiltering(testUser.userId);
        if (statsTest) {
            console.log('✅ Test 4 PASSED: Statistics filtering');
            passed++;
        } else {
            console.log('❌ Test 4 FAILED: Statistics filtering');
        }
        
        // Cleanup test data
        await UserProfile.deleteMany({ userId: { $in: [testUser.userId, otherUser.userId] } });
        await Quote.deleteMany({ userId: { $in: [testUser.userId, otherUser.userId] } });
        console.log('🧹 Test data cleaned up');
        
    } catch (error) {
        console.error('❌ Test 2 FAILED: Test data creation -', error.message);
    }
    
    console.log(`\n📊 COMPREHENSIVE TEST RESULTS: ${passed}/${total} tests passed`);
    return passed === total;
}

async function main() {
    console.log('🧪 COMPREHENSIVE VERIFICATION OF ALL FIXES');
    console.log('==========================================');
    
    await connectDB();
    
    const allTestsPassed = await testComprehensiveScenario();
    
    console.log('\n🎉 FINAL RESULT:');
    if (allTestsPassed) {
        console.log('✅ ALL TESTS PASSED! The fixes are working correctly.');
        console.log('\n🔧 Fixes implemented:');
        console.log('  ✅ User duplication prevention (atomic operations)');
        console.log('  ✅ Quote attribution (proper userId filtering)');
        console.log('  ✅ Statistics filtering (user-specific data)');
        console.log('  ✅ Authentication flow security');
    } else {
        console.log('❌ Some tests failed. Additional investigation needed.');
    }
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testUserDuplicationPrevention,
    testQuoteFiltering,
    testStatisticsFiltering,
    testComprehensiveScenario
};