#!/usr/bin/env node

/**
 * Updated test for the new idempotent onboarding behavior
 * This replaces the old expectation of 400 errors with the new 200 + alreadyCompleted behavior
 */

const axios = require('axios').default;

const BASE_URL = 'http://localhost:3002/api/reader';

// Test data
const TEST_USER = {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser'
};

const TEST_ANSWERS = {
    question1_name: 'Test User',
    question2_lifestyle: 'Test Lifestyle',
    question3_time: 'Test Time',
    question4_priorities: 'Test Priorities',
    question5_reading_feeling: 'Test Feeling',
    question6_phrase: 'Test Phrase',
    question7_reading_time: 'Test Reading Time'
};

/**
 * Make HTTP request with error handling
 */
async function makeRequest(method, endpoint, data = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { status: response.status, data: response.data };
    } catch (error) {
        if (error.response) {
            return { status: error.response.status, data: error.response.data };
        }
        throw error;
    }
}

/**
 * Test 1: Health check
 */
async function testHealthCheck() {
    console.log('🏥 Testing health check...');
    try {
        const response = await makeRequest('GET', '/health');
        if (response.status === 200 && response.data.success) {
            console.log('✅ Health check passed');
            return { success: true };
        } else {
            console.log('❌ Health check failed');
            return { success: false };
        }
    } catch (error) {
        console.error('Health check failed:', error.message);
        console.log('❌ Server not running. Please start with: npm start');
        return { success: false };
    }
}

/**
 * Test 2: First onboarding completion
 */
async function testFirstOnboarding() {
    console.log('\n🎯 Testing first onboarding completion...');
    try {
        const response = await makeRequest('POST', '/auth/complete-onboarding', {
            user: TEST_USER,
            answers: TEST_ANSWERS,
            email: 'test@example.com',
            source: 'Telegram'
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 200 && response.data.success && response.data.user.isOnboardingComplete) {
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
 * Test 3: Idempotent onboarding (NEW BEHAVIOR)
 */
async function testIdempotentOnboarding() {
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
        } else {
            console.log('❌ Idempotent behavior not working as expected');
            return { success: false };
        }
    } catch (error) {
        console.error('Idempotent onboarding test failed:', error.message);
        return { success: false };
    }
}

/**
 * Test 4: Force retake behavior
 */
async function testForceRetake() {
    console.log('\n🔄 Testing force retake...');
    try {
        const response = await makeRequest('POST', '/auth/complete-onboarding', {
            user: TEST_USER,
            answers: { ...TEST_ANSWERS, question1_name: 'Updated Test User' },
            email: 'updated@example.com',
            source: 'Instagram',
            forceRetake: true
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 200 && response.data.success && response.data.retake) {
            console.log('✅ Force retake working correctly');
            return { success: true };
        } else {
            console.log('❌ Force retake not working');
            return { success: false };
        }
    } catch (error) {
        console.error('Force retake test failed:', error.message);
        return { success: false };
    }
}

/**
 * Test 5: Onboarding status with new field
 */
async function testOnboardingStatus() {
    console.log('\n📊 Testing onboarding status...');
    try {
        const response = await makeRequest('GET', `/auth/onboarding-status?userId=${TEST_USER.id}`);
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 200 && 
            response.data.success && 
            response.data.isOnboardingComplete === true &&
            response.data.user.isOnboardingComplete === true) {
            console.log('✅ Onboarding status includes new isOnboardingComplete field');
            return { success: true };
        } else {
            console.log('❌ Onboarding status missing isOnboardingComplete field');
            return { success: false };
        }
    } catch (error) {
        console.error('Onboarding status test failed:', error.message);
        return { success: false };
    }
}

/**
 * Test 6: Email validation on first completion
 */
async function testEmailValidation() {
    console.log('\n📧 Testing email validation...');
    
    // Use a different user for this test
    const newUser = { ...TEST_USER, id: 999888777 };
    
    try {
        const response = await makeRequest('POST', '/auth/complete-onboarding', {
            user: newUser,
            answers: TEST_ANSWERS,
            email: '', // Empty email should fail
            source: 'Telegram'
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 400 && !response.data.success && response.data.error === 'EMAIL_REQUIRED') {
            console.log('✅ Email validation working correctly');
            return { success: true };
        } else {
            console.log('❌ Email validation not working');
            return { success: false };
        }
    } catch (error) {
        console.error('Email validation test failed:', error.message);
        return { success: false };
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Starting Updated Authentication Flow Tests');
    console.log('=============================================\n');
    
    const tests = [
        testHealthCheck,
        testFirstOnboarding,
        testIdempotentOnboarding,
        testForceRetake,
        testOnboardingStatus,
        testEmailValidation
    ];
    
    const results = { passed: 0, failed: 0, details: [] };
    
    for (const test of tests) {
        const result = await test();
        if (result.success) {
            results.passed++;
            results.details.push(`✅ ${test.name}`);
        } else {
            results.failed++;
            results.details.push(`❌ ${test.name}`);
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(50));
    results.details.forEach(detail => console.log(detail));
    console.log(`\nTotal: ${results.passed + results.failed} tests`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.failed === 0) {
        console.log('\n🎉 All tests passed! Idempotent onboarding is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the implementation.');
    }
    
    process.exit(results.failed === 0 ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };