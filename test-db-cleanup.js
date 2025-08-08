/**
 * Database cleanup and inspection script
 * Helps identify and clean up duplicate users
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

async function inspectUsers() {
    console.log('\n🔍 Inspecting user profiles...');
    
    try {
        const users = await UserProfile.find({}).sort({ createdAt: -1 });
        console.log(`Total users found: ${users.length}`);
        
        if (users.length === 0) {
            console.log('No users found in database');
            return;
        }
        
        // Group users by userId to find duplicates
        const userGroups = {};
        users.forEach(user => {
            if (!userGroups[user.userId]) {
                userGroups[user.userId] = [];
            }
            userGroups[user.userId].push(user);
        });
        
        console.log('\n📊 User analysis:');
        Object.keys(userGroups).forEach(userId => {
            const group = userGroups[userId];
            if (group.length > 1) {
                console.log(`🚨 DUPLICATE USER ID: ${userId} (${group.length} entries)`);
                group.forEach((user, index) => {
                    console.log(`  ${index + 1}. Created: ${user.createdAt}, Name: ${user.name}, Email: ${user.email}`);
                });
            } else {
                console.log(`✅ User ${userId}: ${group[0].name} (${group[0].email})`);
            }
        });
        
        return { users, userGroups };
    } catch (error) {
        console.error('Error inspecting users:', error.message);
    }
}

async function inspectQuotes() {
    console.log('\n📝 Inspecting quotes...');
    
    try {
        const quotes = await Quote.find({}).sort({ createdAt: -1 }).limit(10);
        console.log(`Total quotes found: ${quotes.length}`);
        
        if (quotes.length === 0) {
            console.log('No quotes found in database');
            return;
        }
        
        console.log('\n📋 Recent quotes:');
        quotes.forEach((quote, index) => {
            console.log(`${index + 1}. User: ${quote.userId}, Text: "${quote.text.substring(0, 50)}...", Created: ${quote.createdAt}`);
        });
        
        // Check for orphaned quotes (quotes without corresponding users)
        const quoteUserIds = [...new Set(quotes.map(q => q.userId))];
        const users = await UserProfile.find({ userId: { $in: quoteUserIds } });
        const existingUserIds = users.map(u => u.userId);
        
        const orphanedQuotes = quotes.filter(q => !existingUserIds.includes(q.userId));
        if (orphanedQuotes.length > 0) {
            console.log(`\n🚨 Found ${orphanedQuotes.length} orphaned quotes (no corresponding user)`);
            orphanedQuotes.forEach(quote => {
                console.log(`  User: ${quote.userId}, Text: "${quote.text.substring(0, 30)}..."`);
            });
        }
        
        return { quotes, orphanedQuotes };
    } catch (error) {
        console.error('Error inspecting quotes:', error.message);
    }
}

async function cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
        // Remove test users
        const testUserIds = ['123456789', '987654321'];
        const testEmails = ['test@example.com', 'concurrent@example.com', 'authtest@example.com'];
        
        const deletedUsers = await UserProfile.deleteMany({
            $or: [
                { userId: { $in: testUserIds } },
                { email: { $in: testEmails } }
            ]
        });
        
        const deletedQuotes = await Quote.deleteMany({
            userId: { $in: testUserIds }
        });
        
        console.log(`✅ Deleted ${deletedUsers.deletedCount} test user profiles`);
        console.log(`✅ Deleted ${deletedQuotes.deletedCount} test quotes`);
        
    } catch (error) {
        console.error('Error cleaning up test data:', error.message);
    }
}

async function removeDuplicates() {
    console.log('\n🔧 Removing duplicate users...');
    
    try {
        const duplicates = await UserProfile.aggregate([
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 },
                    docs: { $push: '$_id' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);
        
        console.log(`Found ${duplicates.length} sets of duplicate users`);
        
        for (const duplicate of duplicates) {
            console.log(`Processing duplicates for userId: ${duplicate._id}`);
            
            // Keep the first one, delete the rest
            const toDelete = duplicate.docs.slice(1);
            const result = await UserProfile.deleteMany({
                _id: { $in: toDelete }
            });
            
            console.log(`  Deleted ${result.deletedCount} duplicate entries`);
        }
        
    } catch (error) {
        console.error('Error removing duplicates:', error.message);
    }
}

async function main() {
    console.log('🔍 Database Inspection and Cleanup Tool');
    console.log('=======================================');
    
    await connectDB();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'inspect':
            await inspectUsers();
            await inspectQuotes();
            break;
            
        case 'cleanup':
            await cleanupTestData();
            break;
            
        case 'remove-duplicates':
            await removeDuplicates();
            break;
            
        case 'full':
            await inspectUsers();
            await inspectQuotes();
            await cleanupTestData();
            await removeDuplicates();
            console.log('\n✅ Full cleanup completed');
            break;
            
        default:
            console.log('\nUsage:');
            console.log('  node test-db-cleanup.js inspect          - Inspect current database state');
            console.log('  node test-db-cleanup.js cleanup          - Remove test data');
            console.log('  node test-db-cleanup.js remove-duplicates - Remove duplicate users');
            console.log('  node test-db-cleanup.js full             - Do everything');
    }
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    connectDB,
    inspectUsers,
    inspectQuotes,
    cleanupTestData,
    removeDuplicates
};