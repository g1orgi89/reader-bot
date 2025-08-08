/**
 * Test for authentication flow and user duplication prevention
 * Validates that the race condition fix in /auth/complete-onboarding works correctly
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

// Import models and API
const UserProfile = require('../server/models/userProfile');
const readerApi = require('../server/api/reader');

describe('Authentication Flow and Duplication Prevention', () => {
    let mongoServer;
    let app;

    beforeAll(async () => {
        // Setup in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Setup Express app with the reader API
        app = express();
        app.use(express.json());
        app.use('/api/reader', readerApi);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections before each test
        await UserProfile.deleteMany({});
    });

    describe('Complete Onboarding Endpoint', () => {
        const testUser = {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
        };

        const testAnswers = {
            question1_name: 'Test User',
            question2_lifestyle: '👶 Я мама (дети - главная забота)',
            question3_time: '🌅 Рано утром, пока все спят',
            question4_priorities: '🧘‍♀️ Найти внутренний баланс',
            question5_reading_feeling: '🔍 Нахожу ответы на свои вопросы',
            question6_phrase: '✨ "Счастье — это выбор"',
            question7_reading_time: '📚 Меньше часа (читаю редко)'
        };

        const onboardingData = {
            user: testUser,
            answers: testAnswers,
            email: 'test@example.com',
            source: 'Telegram'
        };

        test('should create user profile successfully on first onboarding', async () => {
            const response = await request(app)
                .post('/api/reader/auth/complete-onboarding')
                .send(onboardingData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.userId).toBe(testUser.id.toString());
            expect(response.body.user.name).toBe(testAnswers.question1_name);
            expect(response.body.user.email).toBe(onboardingData.email);
            expect(response.body.user.isOnboardingComplete).toBe(true);

            // Verify user exists in database
            const userInDb = await UserProfile.findOne({ userId: testUser.id.toString() });
            expect(userInDb).toBeTruthy();
            expect(userInDb.isOnboardingComplete).toBe(true);
        });

        test('should prevent duplicate user creation when called multiple times', async () => {
            // First call - should succeed
            const response1 = await request(app)
                .post('/api/reader/auth/complete-onboarding')
                .send(onboardingData);

            expect(response1.status).toBe(200);
            expect(response1.body.success).toBe(true);

            // Second call - should return error about existing user
            const response2 = await request(app)
                .post('/api/reader/auth/complete-onboarding')
                .send(onboardingData);

            expect(response2.status).toBe(400);
            expect(response2.body.success).toBe(false);
            expect(response2.body.error).toContain('already completed onboarding');

            // Verify only one user exists in database
            const usersInDb = await UserProfile.find({ userId: testUser.id.toString() });
            expect(usersInDb).toHaveLength(1);
        });

        test('should handle concurrent onboarding requests without creating duplicates', async () => {
            // Simulate concurrent requests
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    request(app)
                        .post('/api/reader/auth/complete-onboarding')
                        .send(onboardingData)
                );
            }

            const responses = await Promise.all(promises);

            // Check that only one request succeeded
            const successfulResponses = responses.filter(r => r.status === 200);
            const failedResponses = responses.filter(r => r.status === 400);

            expect(successfulResponses).toHaveLength(1);
            expect(failedResponses).toHaveLength(4);

            // Verify only one user exists in database
            const usersInDb = await UserProfile.find({ userId: testUser.id.toString() });
            expect(usersInDb).toHaveLength(1);
            expect(usersInDb[0].isOnboardingComplete).toBe(true);
        });

        test('should validate required fields', async () => {
            const incompleteData = {
                user: testUser,
                // Missing answers, email, source
            };

            const response = await request(app)
                .post('/api/reader/auth/complete-onboarding')
                .send(incompleteData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required fields');

            // Verify no user was created
            const usersInDb = await UserProfile.find({ userId: testUser.id.toString() });
            expect(usersInDb).toHaveLength(0);
        });

        test('should validate user data', async () => {
            const invalidData = {
                // Missing user object
                answers: testAnswers,
                email: 'test@example.com',
                source: 'Telegram'
            };

            const response = await request(app)
                .post('/api/reader/auth/complete-onboarding')
                .send(invalidData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Telegram Auth Endpoint', () => {
        const testUser = {
            id: 987654321,
            first_name: 'Auth',
            last_name: 'Test',
            username: 'authtest'
        };

        test('should authenticate user and return JWT token', async () => {
            const response = await request(app)
                .post('/api/reader/auth/telegram')
                .send({
                    user: testUser
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeTruthy();
            expect(response.body.user.id).toBe(testUser.id);
            expect(response.body.isOnboardingCompleted).toBe(false);
        });

        test('should not create user profile during telegram auth', async () => {
            await request(app)
                .post('/api/reader/auth/telegram')
                .send({
                    user: testUser
                });

            // Verify no user profile was created
            const usersInDb = await UserProfile.find({ userId: testUser.id.toString() });
            expect(usersInDb).toHaveLength(0);
        });

        test('should detect completed onboarding if user exists', async () => {
            // First create a user through onboarding
            const userProfile = new UserProfile({
                userId: testUser.id.toString(),
                name: 'Auth Test',
                email: 'authtest@example.com',
                testResults: {
                    question1_name: 'Auth Test',
                    question2_lifestyle: '👶 Я мама (дети - главная забота)',
                    question3_time: '🌅 Рано утром, пока все спят',
                    question4_priorities: '🧘‍♀️ Найти внутренний баланс',
                    question5_reading_feeling: '🔍 Нахожу ответы на свои вопросы',
                    question6_phrase: '✨ "Счастье — это выбор"',
                    question7_reading_time: '📚 Меньше часа (читаю редко)',
                    completedAt: new Date()
                },
                source: 'Telegram',
                isOnboardingComplete: true
            });
            await userProfile.save();

            // Now authenticate
            const response = await request(app)
                .post('/api/reader/auth/telegram')
                .send({
                    user: testUser
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.isOnboardingCompleted).toBe(true);
        });
    });
});