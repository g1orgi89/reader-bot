/**
 * Jest setup file for Reader Bot tests
 * This file is executed before each test file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/reader_bot_test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';
process.env.TELEGRAM_BOT_TOKEN = 'test_telegram_token';

// Set test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Global setup code here
});

// Global test cleanup
afterAll(async () => {
  // Global cleanup code here
});

// Setup for each test
beforeEach(() => {
  // Clear console warnings in tests
  jest.clearAllMocks();
});

// Cleanup for each test
afterEach(() => {
  // Individual test cleanup
});