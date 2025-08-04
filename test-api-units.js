#!/usr/bin/env node
/**
 * Unit test for Reader API endpoints - works without MongoDB
 */

const express = require('express');
const request = require('supertest');

// Mock the models to avoid MongoDB dependency
jest.mock('../server/models/userProfile', () => {
    return {
        findOne: jest.fn(),
        countDocuments: jest.fn(),
        aggregate: jest.fn()
    };
});

jest.mock('../server/models/quote', () => {
    return {
        getTodayQuotesCount: jest.fn(),
        getTopAuthors: jest.fn(),
        countDocuments: jest.fn(),
        find: jest.fn(),
        prototype: {
            save: jest.fn()
        }
    };
});

jest.mock('../server/models/weeklyReport', () => {
    return {
        find: jest.fn()
    };
});

jest.mock('../server/models/monthlyReport', () => {
    return {
        find: jest.fn()
    };
});

jest.mock('../server/models/BookCatalog', () => {
    return {
        find: jest.fn(),
        countDocuments: jest.fn(),
        getRecommendationsByThemes: jest.fn(),
        getUniversalRecommendations: jest.fn()
    };
});

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    
    // Import the reader routes (mocked models will be used)
    const readerRoutes = require('../server/api/reader');
    app.use('/api/reader', readerRoutes);
    
    return app;
}

describe('Reader API Endpoints', () => {
    let app;

    beforeEach(() => {
        app = createTestApp();
    });

    describe('Health Check', () => {
        test('GET /health should return 200', async () => {
            const response = await request(app)
                .get('/api/reader/health');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Reader API is working');
        });
    });

    describe('Authentication', () => {
        test('POST /auth/telegram should work with valid user data', async () => {
            const userData = {
                telegramData: 'mock_data',
                user: {
                    id: 12345,
                    first_name: 'Test',
                    username: 'test_user'
                }
            };

            const response = await request(app)
                .post('/api/reader/auth/telegram')
                .send(userData);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.id).toBe(12345);
        });

        test('POST /auth/telegram should fail without user data', async () => {
            const response = await request(app)
                .post('/api/reader/auth/telegram')
                .send({});
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Onboarding', () => {
        test('POST /auth/complete-onboarding should require all fields', async () => {
            const response = await request(app)
                .post('/api/reader/auth/complete-onboarding')
                .send({});
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required fields');
        });

        test('POST /auth/complete-onboarding should work with valid data', async () => {
            // Mock UserProfile.findOne to return null (user doesn't exist)
            const UserProfile = require('../server/models/userProfile');
            UserProfile.findOne.mockResolvedValue(null);
            
            // Mock save method
            const mockSave = jest.fn().mockResolvedValue({
                userId: '12345',
                name: 'Test User',
                email: 'test@example.com'
            });
            
            // Mock UserProfile constructor
            UserProfile.mockImplementation(() => ({
                save: mockSave,
                userId: '12345',
                name: 'Test User',
                email: 'test@example.com'
            }));

            const onboardingData = {
                user: {
                    id: 12345,
                    first_name: 'Test',
                    username: 'test_user'
                },
                answers: {
                    question1_name: 'Test User',
                    question2_lifestyle: 'Test lifestyle',
                    question3_time: 'Morning',
                    question4_priorities: 'Self-development',
                    question5_reading_feeling: 'Inspiration',
                    question6_phrase: 'Happiness is a choice',
                    question7_reading_time: '1-3 hours'
                },
                email: 'test@example.com',
                source: 'Telegram'
            };

            const response = await request(app)
                .post('/api/reader/auth/complete-onboarding')
                .send(onboardingData);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.userId).toBe('12345');
        });
    });
});

// Run the tests if this file is executed directly
if (require.main === module) {
    console.log('🧪 Running Reader API unit tests...\n');
    
    // Simple test runner without Jest
    async function runBasicTests() {
        try {
            const app = createTestApp();
            
            // Test 1: Health check
            console.log('🔍 Testing health endpoint...');
            const healthTest = await request(app).get('/api/reader/health');
            console.log(healthTest.status === 200 ? '✅ Health check passed' : '❌ Health check failed');
            
            // Test 2: Auth endpoint
            console.log('🔍 Testing auth endpoint...');
            const authTest = await request(app)
                .post('/api/reader/auth/telegram')
                .send({
                    user: { id: 12345, first_name: 'Test' }
                });
            console.log(authTest.status === 200 ? '✅ Auth test passed' : '❌ Auth test failed');
            
            console.log('\n🏁 Basic tests completed!');
            
        } catch (error) {
            console.error('❌ Test error:', error.message);
        }
    }
    
    runBasicTests();
}

module.exports = {
    createTestApp
};