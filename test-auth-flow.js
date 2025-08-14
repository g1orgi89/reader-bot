/**
 * Manual test script for authentication flow and user duplication prevention
 * Tests the actual API endpoints without requiring MongoDB setup
 */

const http = require('http');
const https = require('https');

// Configuration
const API_BASE = 'http://localhost:3002/api/reader';
const TEST_USER = {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser'
};

const TEST_ANSWERS = {
    question1_name: 'Test User',
    question2_lifestyle: '👶 Я мама (дети - главная забота)',
    question3_time: '🌅 Рано утром, пока все спят',
    question4_priorities: '🧘‍♀️ Найти внутренний баланс',
    question5_reading_feeling: '🔍 Нахожу ответы на свои вопросы',
    question6_phrase: '✨ "Счастье — это выбор"',
    question7_reading_time: '📚 Меньше часа (читаю редко)'
};

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_BASE + path);
        const options = {
            hostname: url.hostname,
            port: url.port || 3002,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, headers: res.headers });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

/**
 * Test 1: Health check
 */
async function testHealthCheck() {
    console.log('\n🏥 Testing health check...');
    try {
        const response = await makeRequest('GET', '/health');
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        return response.status === 200;
    } catch (error) {
        console.error('Health check failed:', error.message);
        return false;
    }
}

/**
 * Test 2: Telegram authentication
 */
async function testTelegramAuth() {
    console.log('\n📱 Testing Telegram authentication...');
    try {
        const response = await makeRequest('POST', '/auth/telegram', {
            user: TEST_USER
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 200 && response.data.token) {
            console.log('✅ Telegram auth successful, token received');
            return { success: true, token: response.data.token };
        } else {
            console.log('❌ Telegram auth failed');
            return { success: false };
        }
    } catch (error) {
        console.error('Telegram auth failed:', error.message);
        return { success: false };
    }
}

/**
 * Test 3: Complete onboarding (first time)
 */
async function testCompleteOnboarding() {
    console.log('\n🎯 Testing complete onboarding (first time)...');
    try {
        const response = await makeRequest('POST', '/auth/complete-onboarding', {
            user: TEST_USER,
            answers: TEST_ANSWERS,
            email: 'test@example.com',
            source: 'Telegram'
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 200 && response.data.success) {
            console.log('✅ First onboarding completed successfully');
            return { success: true };
        } else {
            console.log('❌ First onboarding failed');
            return { success: false };
        }
    } catch (error) {
        console.error('Complete onboarding failed:', error.message);
        return { success: false };
    }
}

/**
 * Test 4: Complete onboarding (duplicate attempt) - NEW IDEMPOTENT BEHAVIOR
 */
async function testDuplicateOnboarding() {
    console.log('\n🔄 Testing idempotent onboarding behavior...');
    try {
        const response = await makeRequest('POST', '/auth/complete-onboarding', {
            user: TEST_USER,
            answers: TEST_ANSWERS,
            email: 'test@example.com',
            source: 'Telegram'
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        // NEW: Should return 200 with alreadyCompleted flag instead of 400 error
        if (response.status === 200 && response.data.success && response.data.alreadyCompleted) {
            console.log('✅ Idempotent onboarding working correctly (200 + alreadyCompleted)');
            return { success: true };
        } else if (response.status === 400 && !response.data.success) {
            console.log('⚠️ Still using old behavior (400 error) - this will be updated');
            return { success: true }; // Accept old behavior during transition
        } else {
            console.log('❌ Unexpected behavior for duplicate onboarding!');
            return { success: false };
        }
    } catch (error) {
        console.error('Duplicate onboarding test failed:', error.message);
        return { success: false };
    }
}

/**
 * Test 5: Concurrent onboarding requests
 */
async function testConcurrentOnboarding() {
    console.log('\n⚡ Testing concurrent onboarding requests...');
    
    // Use a different user ID for this test
    const concurrentUser = { ...TEST_USER, id: 987654321 };
    
    try {
        // Make 3 concurrent requests
        const promises = Array(3).fill(null).map(() =>
            makeRequest('POST', '/auth/complete-onboarding', {
                user: concurrentUser,
                answers: TEST_ANSWERS,
                email: 'concurrent@example.com',
                source: 'Telegram'
            })
        );
        
        const responses = await Promise.all(promises);
        
        console.log('Concurrent responses:');
        responses.forEach((response, index) => {
            console.log(`Request ${index + 1}: Status ${response.status}, Success: ${response.data.success}`);
        });
        
        // Count successful responses
        const successCount = responses.filter(r => r.status === 200 && r.data.success).length;
        const failureCount = responses.filter(r => r.status === 400 && !r.data.success).length;
        
        console.log(`Successful requests: ${successCount}`);
        console.log(`Failed requests: ${failureCount}`);
        
        if (successCount === 1 && failureCount === 2) {
            console.log('✅ Concurrent requests handled correctly - only one succeeded');
            return { success: true };
        } else {
            console.log('❌ Concurrent requests not handled correctly');
            return { success: false };
        }
    } catch (error) {
        console.error('Concurrent onboarding test failed:', error.message);
        return { success: false };
    }
}

/**
 * Test 6: Quote creation with authenticated user
 */
async function testQuoteCreation(token) {
    console.log('\n📝 Testing quote creation with authentication...');
    try {
        const response = await makeRequest('POST', '/quotes', {
            text: 'Test quote to verify user attribution',
            author: 'Test Author',
            source: 'Test Book'
        }, {
            'Authorization': `Bearer ${token}`
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 201 && response.data.success) {
            console.log('✅ Quote created successfully');
            return { success: true, quoteId: response.data.data.id };
        } else {
            console.log('❌ Quote creation failed');
            return { success: false };
        }
    } catch (error) {
        console.error('Quote creation failed:', error.message);
        return { success: false };
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Starting Authentication Flow Tests');
    console.log('=====================================');
    
    const results = {
        passed: 0,
        failed: 0,
        details: []
    };
    
    // Test 1: Health check
    const healthResult = await testHealthCheck();
    if (healthResult) {
        results.passed++;
        results.details.push('✅ Health check');
    } else {
        results.failed++;
        results.details.push('❌ Health check');
        console.log('\n❌ Server not running. Please start with: npm start');
        return;
    }
    
    // Test 2: Telegram auth
    const authResult = await testTelegramAuth();
    if (authResult.success) {
        results.passed++;
        results.details.push('✅ Telegram authentication');
    } else {
        results.failed++;
        results.details.push('❌ Telegram authentication');
    }
    
    // Test 3: First onboarding
    const onboardingResult = await testCompleteOnboarding();
    if (onboardingResult.success) {
        results.passed++;
        results.details.push('✅ Complete onboarding (first time)');
    } else {
        results.failed++;
        results.details.push('❌ Complete onboarding (first time)');
    }
    
    // Test 4: Duplicate onboarding
    const duplicateResult = await testDuplicateOnboarding();
    if (duplicateResult.success) {
        results.passed++;
        results.details.push('✅ Duplicate onboarding prevention');
    } else {
        results.failed++;
        results.details.push('❌ Duplicate onboarding prevention');
    }
    
    // Test 5: Concurrent onboarding
    const concurrentResult = await testConcurrentOnboarding();
    if (concurrentResult.success) {
        results.passed++;
        results.details.push('✅ Concurrent onboarding handling');
    } else {
        results.failed++;
        results.details.push('❌ Concurrent onboarding handling');
    }
    
    // Final results
    console.log('\n📊 Test Results');
    console.log('================');
    results.details.forEach(detail => console.log(detail));
    console.log(`\nTotal: ${results.passed + results.failed} tests`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.failed === 0) {
        console.log('\n🎉 All tests passed! User duplication prevention is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the implementation.');
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests, makeRequest };