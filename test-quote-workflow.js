/**
 * Browser simulation test for quote deletion cache fixes
 */

// Mock browser environment
global.window = {
    StorageService: class {
        clearApiCache(pattern) {
            console.log(`✅ StorageService.clearApiCache called with pattern: ${pattern}`);
        }
    },
    location: { hostname: 'localhost' },
    localStorage: {
        getItem: (key) => {
            if (key === 'reader-user-id') return 'test-user-123';
            return null;
        },
        setItem: () => {},
        removeItem: () => {}
    },
    sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    },
    Telegram: {
        WebApp: {
            initData: 'query_id=test&user=%7B%22id%22%3A123456789%7D',
            initDataUnsafe: {
                user: { id: 123456789 }
            }
        }
    }
};

// Mock fetch to simulate API responses
let deleteCount = 0;
global.fetch = async (url, options) => {
    console.log(`🌐 API Request: ${options.method} ${url}`);
    console.log(`📋 Headers:`, JSON.stringify(options.headers, null, 2));
    
    if (url.includes('/quotes/') && options.method === 'DELETE') {
        deleteCount++;
        console.log(`🗑️ DELETE request #${deleteCount} detected`);
        
        // Simulate successful deletion
        return {
            ok: true,
            status: 204,
            headers: {
                get: () => null
            },
            text: async () => ''
        };
    }
    
    if (url.includes('/quotes') && options.method === 'GET') {
        console.log(`📖 GET quotes request detected`);
        
        // Simulate quotes response (should be different after deletion)
        const quotes = deleteCount === 0 
            ? [{ id: 'quote-1', text: 'Test quote 1' }, { id: 'quote-2', text: 'Test quote 2' }]
            : [{ id: 'quote-2', text: 'Test quote 2' }]; // quote-1 deleted
            
        return {
            ok: true,
            status: 200,
            headers: {
                get: (name) => name === 'content-type' ? 'application/json' : null
            },
            json: async () => ({
                success: true,
                quotes: quotes,
                total: quotes.length
            })
        };
    }
    
    // Default response
    return {
        ok: true,
        status: 200,
        headers: {
            get: (name) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ success: true })
    };
};

// Load the ApiService
const ApiService = require('./mini-app/js/services/api.js');

async function simulateQuoteDeletionWorkflow() {
    console.log('🧪 Simulating Real Quote Deletion Workflow\n');
    
    const api = new ApiService();
    
    // Step 1: Get initial quotes list
    console.log('1️⃣ Getting initial quotes list...');
    const initialQuotes = await api.getQuotes({ limit: 10 }, 'test-user-123');
    console.log('📋 Initial quotes:', initialQuotes.quotes.length, 'quotes');
    console.log('✅ Initial load completed\n');
    
    // Step 2: Delete a quote (this should clear cache)
    console.log('2️⃣ Deleting quote "quote-1"...');
    await api.deleteQuote('quote-1', 'test-user-123');
    console.log('✅ Quote deletion completed\n');
    
    // Step 3: Get quotes again (should not use cache and show updated data)
    console.log('3️⃣ Getting quotes after deletion...');
    const updatedQuotes = await api.getQuotes({ limit: 10 }, 'test-user-123');
    console.log('📋 Updated quotes:', updatedQuotes.quotes.length, 'quotes');
    console.log('✅ Updated load completed\n');
    
    // Step 4: Verify cache-busting worked
    console.log('4️⃣ Verifying cache behavior...');
    if (updatedQuotes.quotes.length < initialQuotes.quotes.length) {
        console.log('✅ SUCCESS: Quote count decreased, cache invalidation worked!');
    } else {
        console.log('❌ FAILURE: Quote count unchanged, possible cache issue');
    }
    
    // Step 5: Test header consistency
    console.log('\n5️⃣ Testing header consistency...');
    const headers1 = api.getHeaders('/quotes?userId=user-from-url');
    const headers2 = api.getHeaders('/quotes?userId=different-user');
    
    console.log('Headers for userId=user-from-url:', headers1['X-User-Id']);
    console.log('Headers for userId=different-user:', headers2['X-User-Id']);
    
    if (headers1['X-User-Id'] === 'user-from-url' && headers2['X-User-Id'] === 'different-user') {
        console.log('✅ SUCCESS: User ID normalization working correctly!');
    } else {
        console.log('❌ FAILURE: User ID normalization not working');
    }
    
    // Step 6: Test Telegram headers
    console.log('\n6️⃣ Testing Telegram authentication headers...');
    const authHeaders = api.getHeaders();
    if (authHeaders['Authorization'] && authHeaders['X-Telegram-Init-Data']) {
        console.log('✅ SUCCESS: Both Authorization and X-Telegram-Init-Data headers present!');
    } else {
        console.log('❌ FAILURE: Missing Telegram authentication headers');
        console.log('Authorization:', !!authHeaders['Authorization']);
        console.log('X-Telegram-Init-Data:', !!authHeaders['X-Telegram-Init-Data']);
    }
    
    console.log('\n🎉 Quote deletion workflow simulation completed!');
    console.log(`📊 Summary: ${deleteCount} delete operations performed`);
}

if (require.main === module) {
    simulateQuoteDeletionWorkflow().catch(console.error);
}

module.exports = { simulateQuoteDeletionWorkflow };