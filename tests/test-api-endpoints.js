#!/usr/bin/env node
/**
 * Simple test script for new API endpoints
 */

const http = require('http');
const path = require('path');

// Simple HTTP client for testing
function makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: `/api/reader${endpoint}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({ 
                        status: res.statusCode, 
                        data: parsedData 
                    });
                } catch (error) {
                    resolve({ 
                        status: res.statusCode, 
                        data: responseData 
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testEndpoints() {
    console.log('🧪 Testing Reader Bot API Endpoints...\n');

    const tests = [
        {
            name: 'Health Check',
            method: 'GET',
            endpoint: '/health'
        },
        {
            name: 'Telegram Auth',
            method: 'POST',
            endpoint: '/auth/telegram',
            data: {
                user: {
                    id: 12345,
                    first_name: 'Test',
                    username: 'test_user'
                }
            }
        },
        {
            name: 'Onboarding Status Check',
            method: 'GET',
            endpoint: '/auth/onboarding-status'
        },
        {
            name: 'Complete Onboarding',
            method: 'POST',
            endpoint: '/auth/complete-onboarding',
            data: {
                user: {
                    id: 12345,
                    first_name: 'Test',
                    username: 'test_user'
                },
                answers: {
                    question1_name: 'Test User',
                    question2_lifestyle: 'Тестовый стиль жизни',
                    question3_time: 'Утром',
                    question4_priorities: 'Самопознание',
                    question5_reading_feeling: 'Вдохновение',
                    question6_phrase: 'Счастье — это выбор',
                    question7_reading_time: '1-3 часа'
                },
                email: 'test@example.com',
                source: 'Telegram'
            }
        }
    ];

    for (const test of tests) {
        try {
            console.log(`🔍 ${test.name}...`);
            const result = await makeRequest(test.method, test.endpoint, test.data);
            
            if (result.status >= 200 && result.status < 300) {
                console.log(`✅ ${test.name}: ${result.status}`);
                if (result.data && result.data.success) {
                    console.log(`   Success: ${result.data.message || 'OK'}`);
                }
            } else {
                console.log(`❌ ${test.name}: ${result.status}`);
                if (result.data && result.data.error) {
                    console.log(`   Error: ${result.data.error}`);
                }
            }
        } catch (error) {
            console.log(`💥 ${test.name}: ${error.message}`);
        }
        console.log('');
    }
}

// Check if server is running
async function checkServer() {
    try {
        const result = await makeRequest('GET', '/health');
        if (result.status === 200) {
            console.log('🟢 Server is running on port 3002\n');
            return true;
        }
    } catch (error) {
        console.log('🔴 Server is not running on port 3002');
        console.log('   Please start the server first: npm run dev');
        console.log('   Or: npm start\n');
        return false;
    }
}

async function main() {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await testEndpoints();
        console.log('🏁 API endpoint testing completed!');
    }
}

if (require.main === module) {
    main();
}

module.exports = { makeRequest, testEndpoints };