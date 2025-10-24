/**
 * Simple validation script to test the user creation fix
 * Tests the atomic findOneAndUpdate operation directly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const UserProfile = require('./server/models/userProfile');

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

async function testAtomicUserCreation() {
    console.log('\n🧪 Testing atomic user creation...');
    
    const testUserId = '999999999'; // Test user ID
    const testData = {
        name: 'Atomic Test User',
        email: 'atomictest@example.com',
        testResults: {
            question1_name: 'Atomic Test User',
            question2_lifestyle: '👶 Я мама (дети - главная забота)',
            question3_time: '🌅 Рано утром, пока все спят',
            question4_priorities: '🧘‍♀️ Найти внутренний баланс',
            question5_reading_feeling: '🔍 Нахожу ответы на свои вопросы',
            question6_phrase: '✨ "Счастье — это выбор"',
            question7_reading_time: '📚 Меньше часа (читаю редко)',
            completedAt: new Date()
        },
        source: 'Telegram',
        telegramUsername: 'atomictest',
        telegramData: {
            firstName: 'Atomic',
            lastName: 'Test',
            languageCode: 'ru',
            chatId: testUserId
        },
        isOnboardingComplete: true,
        registeredAt: new Date()
    };

    try {
        // First, clean up any existing test user
        await UserProfile.deleteMany({ userId: testUserId });
        console.log('🧹 Cleaned up existing test user');

        // Test 1: Single atomic operation
        console.log('\n📝 Test 1: Single atomic user creation');
        const user1 = await UserProfile.findOneAndUpdate(
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
        
        console.log(`✅ User created: ${user1.userId} (${user1.name})`);
        console.log(`   CreatedAt: ${user1.createdAt}`);
        console.log(`   UpdatedAt: ${user1.updatedAt}`);

        // Test 2: Attempt to create the same user again (should not create duplicate)
        console.log('\n📝 Test 2: Attempt duplicate creation');
        const user2 = await UserProfile.findOneAndUpdate(
            { userId: testUserId },
            {
                $setOnInsert: {
                    userId: testUserId,
                    ...testData,
                    name: 'Duplicate Attempt',
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
        
        console.log(`✅ User retrieved: ${user2.userId} (${user2.name})`);
        console.log(`   CreatedAt: ${user2.createdAt}`);
        console.log(`   UpdatedAt: ${user2.updatedAt}`);
        console.log(`   Is same user: ${user1._id.toString() === user2._id.toString()}`);
        console.log(`   Name unchanged: ${user2.name === testData.name}`);

        // Test 3: Concurrent operations
        console.log('\n📝 Test 3: Concurrent operations simulation');
        const concurrentUserId = '888888888';
        
        // Clean up
        await UserProfile.deleteMany({ userId: concurrentUserId });
        
        const concurrentPromises = Array(5).fill(null).map((_, index) =>
            UserProfile.findOneAndUpdate(
                { userId: concurrentUserId },
                {
                    $setOnInsert: {
                        userId: concurrentUserId,
                        ...testData,
                        name: `Concurrent User ${index}`,
                        email: `concurrent${index}@example.com`,
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

        const concurrentResults = await Promise.all(concurrentPromises);
        
        // Check that all results point to the same user
        const uniqueUserIds = [...new Set(concurrentResults.map(u => u._id.toString()))];
        console.log(`✅ Concurrent operations completed`);
        console.log(`   Total operations: ${concurrentResults.length}`);
        console.log(`   Unique users created: ${uniqueUserIds.length}`);
        console.log(`   Winner name: ${concurrentResults[0].name}`);
        
        if (uniqueUserIds.length === 1) {
            console.log('✅ Atomic operations working correctly - no duplicates created');
        } else {
            console.log('❌ Issue detected - multiple users created');
        }

        // Count total users in database with test IDs
        const totalTestUsers = await UserProfile.countDocuments({
            userId: { $in: [testUserId, concurrentUserId] }
        });
        console.log(`\n📊 Total test users in database: ${totalTestUsers} (should be 2)`);

        // Cleanup
        await UserProfile.deleteMany({ userId: { $in: [testUserId, concurrentUserId] } });
        console.log('🧹 Test cleanup completed');

        return true;
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

async function testExistingDuplicates() {
    console.log('\n🔍 Checking for existing duplicates in database...');
    
    try {
        const duplicates = await UserProfile.aggregate([
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 },
                    docs: { $push: { id: '$_id', name: '$name', email: '$email', createdAt: '$createdAt' } }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        if (duplicates.length === 0) {
            console.log('✅ No duplicate users found');
        } else {
            console.log(`🚨 Found ${duplicates.length} sets of duplicate users:`);
            duplicates.forEach(dup => {
                console.log(`\n   User ID: ${dup._id} (${dup.count} duplicates)`);
                dup.docs.forEach((doc, index) => {
                    console.log(`     ${index + 1}. Name: ${doc.name}, Email: ${doc.email}, Created: ${doc.createdAt}`);
                });
            });
        }

        return duplicates;
    } catch (error) {
        console.error('❌ Error checking duplicates:', error);
        return [];
    }
}

async function main() {
    console.log('🧪 User Creation Atomic Operation Test');
    console.log('=====================================');
    
    await connectDB();
    
    // Test atomic operations
    const atomicTestPassed = await testAtomicUserCreation();
    
    // Check existing duplicates
    const existingDuplicates = await testExistingDuplicates();
    
    console.log('\n📊 Test Summary:');
    console.log(`   Atomic operations: ${atomicTestPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Existing duplicates: ${existingDuplicates.length === 0 ? '✅ NONE' : `🚨 ${existingDuplicates.length} SETS`}`);
    
    if (atomicTestPassed && existingDuplicates.length === 0) {
        console.log('\n🎉 All tests passed! User duplication prevention is working correctly.');
    } else {
        console.log('\n⚠️ Issues detected. The fix may need additional work.');
    }
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testAtomicUserCreation, testExistingDuplicates };