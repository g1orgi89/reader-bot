const axios = require('axios');

async function testChatAPI() {
    const API_BASE = 'http://localhost:3000';
    
    console.log('🧪 Testing Shrooms Chat API...');
    
    // Test 1: Health check
    try {
        const healthResponse = await axios.get(`${API_BASE}/api/health`);
        console.log('\n✅ Health Check:', JSON.stringify(healthResponse.data, null, 2));
    } catch (error) {
        console.log('\n❌ Health Check Failed:', error.message);
        if (error.response) {
            console.log('Response data:', error.response.data);
        }
    }
    
    // Test 2: Direct chat test
    try {
        const chatResponse = await axios.post(`${API_BASE}/api/chat`, {
            message: 'Привет! Как дела?',
            userId: 'test-user-123',
            language: 'ru'
        });
        
        console.log('\n✅ Chat Response:', JSON.stringify(chatResponse.data, null, 2));
        
        if (chatResponse.data.success) {
            console.log('\n🎉 Chat test successful!');
            console.log('Response message:', chatResponse.data.data.message);
            console.log('Tokens used:', chatResponse.data.data.tokensUsed);
        } else {
            console.log('\n❌ Chat test failed:', chatResponse.data.error);
        }
    } catch (error) {
        console.log('\n❌ Chat API Test Failed:', error.message);
        if (error.response) {
            console.log('Response data:', error.response.data);
            console.log('Status:', error.response.status);
        }
    }
    
    // Test 3: Languages endpoint
    try {
        const langResponse = await axios.get(`${API_BASE}/api/chat/languages`);
        console.log('\n✅ Languages:', JSON.stringify(langResponse.data, null, 2));
    } catch (error) {
        console.log('\n❌ Languages Test Failed:', error.message);
    }
}

testChatAPI().catch(console.error);