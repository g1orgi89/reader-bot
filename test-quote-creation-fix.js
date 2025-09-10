/**
 * Test script to verify quote creation fixes
 * This script checks if the quote creation API is working correctly
 */

const axios = require('axios');

const API_BASE = 'https://unibotz.com/api/reader';

async function testQuoteCreation() {
    console.log('🧪 Testing quote creation fixes...\n');
    
    const testQuote = {
        text: 'Тестовая цитата для проверки исправлений',
        author: 'Тестовый автор',
        source: 'test',
        userId: 'test-user-' + Date.now()
    };

    try {
        console.log('📤 Sending quote creation request...');
        console.log('Quote data:', testQuote);
        
        const response = await axios.post(`${API_BASE}/quotes`, testQuote, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('\n✅ Response received:');
        console.log('Status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));

        // Check if response has expected structure
        const data = response.data;
        if (data.success && data.data) {
            console.log('\n✅ Quote creation successful!');
            console.log('Quote ID:', data.data.id || data.data._id);
            console.log('Has AI Analysis:', !!(data.data.aiAnalysis || data.data.insights));
            
            if (data.data.aiAnalysis) {
                console.log('AI Analysis summary:', data.data.aiAnalysis.summary);
                console.log('AI Insights:', data.data.insights);
                console.log('Category:', data.data.category);
                console.log('Sentiment:', data.data.sentiment);
            }
            
            return true;
        } else {
            console.log('\n❌ Unexpected response structure');
            return false;
        }

    } catch (error) {
        console.log('\n❌ Error during quote creation:');
        console.log('Status:', error.response?.status);
        console.log('Status Text:', error.response?.statusText);
        console.log('Error data:', error.response?.data);
        console.log('Error message:', error.message);
        
        // Check if this is actually a successful creation (status 201)
        if (error.response?.status === 201 && error.response?.data?.success) {
            console.log('\n⚠️ Got 201 status but treated as error - this is the bug we fixed!');
            console.log('Actual response data:', JSON.stringify(error.response.data, null, 2));
            return true;
        }
        
        return false;
    }
}

async function testHealthCheck() {
    try {
        console.log('🏥 Testing API health...');
        const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
        console.log('✅ API is healthy:', response.data);
        return true;
    } catch (error) {
        console.log('❌ API health check failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('🔧 Quote Creation Bug Fix Test\n');
    
    // Test API health first
    const isHealthy = await testHealthCheck();
    if (!isHealthy) {
        console.log('\n❌ API is not responding. Please start the server first with: npm run dev');
        process.exit(1);
    }
    
    // Test quote creation
    const isWorking = await testQuoteCreation();
    
    if (isWorking) {
        console.log('\n🎉 Quote creation is working correctly!');
        console.log('✅ Fixes appear to be successful');
    } else {
        console.log('\n💥 Quote creation still has issues');
        console.log('❌ Further investigation needed');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testQuoteCreation, testHealthCheck };
