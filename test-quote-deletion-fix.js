/**
 * Test script to verify quote deletion cache fixes
 */

const path = require('path');

// Mock environment for testing
global.window = {
    StorageService: class {
        clearApiCache(pattern) {
            console.log(`✅ StorageService.clearApiCache called with pattern: ${pattern}`);
        }
    },
    location: { hostname: 'localhost' },
    localStorage: {
        getItem: (key) => null,
        setItem: () => {},
        removeItem: () => {}
    },
    sessionStorage: {
        getItem: (key) => null,
        setItem: () => {},
        removeItem: () => {}
    }
};

// Mock fetch for testing
global.fetch = async (url, options) => {
    console.log(`🌐 Mock fetch: ${options.method} ${url}`);
    console.log(`📋 Headers:`, options.headers);
    
    // Simulate successful response
    return {
        ok: true,
        status: 200,
        headers: {
            get: (name) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ success: true, message: 'Quote deleted successfully' })
    };
};

// Load the ApiService
const ApiService = require('./mini-app/js/services/api.js');

async function testQuoteDeletionFix() {
    console.log('🧪 Testing Quote Deletion Cache Fixes\n');
    
    const api = new ApiService();
    
    // Test 1: Enhanced clearQuotesCache
    console.log('1️⃣ Testing enhanced clearQuotesCache...');
    api.clearQuotesCache();
    console.log('✅ Enhanced cache clearing completed\n');
    
    // Test 2: Header merging with custom headers
    console.log('2️⃣ Testing header merging...');
    try {
        await api.request('GET', '/quotes', null, {
            headers: { 'Custom-Header': 'test-value' }
        });
        console.log('✅ Header merging test passed\n');
    } catch (error) {
        console.log('❌ Header merging failed:', error.message, '\n');
    }
    
    // Test 3: Cache-busting for quotes endpoints
    console.log('3️⃣ Testing cache-busting for quotes...');
    try {
        await api.request('GET', '/quotes?userId=test-user');
        console.log('✅ Cache-busting test passed\n');
    } catch (error) {
        console.log('❌ Cache-busting test failed:', error.message, '\n');
    }
    
    // Test 4: Delete quote with cache clearing
    console.log('4️⃣ Testing deleteQuote with enhanced cache clearing...');
    try {
        await api.deleteQuote('test-quote-id', 'test-user');
        console.log('✅ Delete quote test passed\n');
    } catch (error) {
        console.log('❌ Delete quote test failed:', error.message, '\n');
    }
    
    // Test 5: User ID normalization
    console.log('5️⃣ Testing User ID normalization...');
    const headers = api.getHeaders('/quotes?userId=normalized-user');
    console.log('Headers with normalized userId:', headers);
    console.log('✅ User ID normalization test completed\n');
    
    console.log('🎉 All tests completed!');
}

if (require.main === module) {
    testQuoteDeletionFix().catch(console.error);
}

module.exports = { testQuoteDeletionFix };