/**
 * Test script to check core functionality
 * Run this to test basic components without full server setup
 * @file test-core.js
 */

require('dotenv').config();

console.log('Starting core component test...\n');

// Test 1: Config loading
console.log('1. Testing config loading...');
try {
  const config = require('./server/config');
  console.log('✓ Config loaded successfully');
  console.log(`  - PORT: ${config.PORT}`);
  console.log(`  - NODE_ENV: ${config.NODE_ENV}`);
} catch (error) {
  console.error('✗ Config loading failed:', error.message);
}

// Test 2: ServiceManager
console.log('\n2. Testing ServiceManager...');
try {
  const ServiceManager = require('./server/core/ServiceManager');
  console.log('✓ ServiceManager loaded successfully');
  
  // Test basic service registration
  ServiceManager.register('testService', () => ({ name: 'test' }), {
    dependencies: [],
    singleton: true,
    lazy: false
  });
  console.log('✓ Service registration works');
  
  const service = ServiceManager.get('testService');
  console.log('✓ Service retrieval works');
} catch (error) {
  console.error('✗ ServiceManager test failed:', error.message);
}

// Test 3: Logger
console.log('\n3. Testing Logger...');
try {
  const logger = require('./server/utils/logger');
  logger.info('Logger test message');
  console.log('✓ Logger works');
} catch (error) {
  console.error('✗ Logger test failed:', error.message);
}

// Test 4: Claude service creation
console.log('\n4. Testing Claude service creation...');
try {
  const ClaudeService = require('./server/services/claude');
  console.log('✓ Claude service module loaded');
  
  // We won't create an instance without API key
  console.log('  (Skipping instantiation without API key)');
} catch (error) {
  console.error('✗ Claude service loading failed:', error.message);
}

// Test 5: VectorStore service creation
console.log('\n5. Testing VectorStore service creation...');
try {
  const VectorStoreService = require('./server/services/vectorStore');
  console.log('✓ VectorStore service module loaded');
} catch (error) {
  console.error('✗ VectorStore service loading failed:', error.message);
}

// Test 6: Ticket service creation
console.log('\n6. Testing Ticket service creation...');
try {
  const TicketService = require('./server/services/ticketing');
  console.log('✓ Ticket service module loaded');
} catch (error) {
  console.error('✗ Ticket service loading failed:', error.message);
}

// Test 7: Message service
console.log('\n7. Testing Message service...');
try {
  const messageService = require('./server/services/message');
  console.log('✓ Message service loaded');
} catch (error) {
  console.error('✗ Message service loading failed:', error.message);
}

// Test 8: Check all required API routes
console.log('\n8. Testing API routes loading...');
const routes = [
  './server/api/chat.js',
  './server/api/tickets.js',
  './server/api/knowledge.js',
  './server/api/admin.js'
];

routes.forEach(route => {
  try {
    require(route);
    console.log(`✓ ${route.split('/').pop()} loaded`);
  } catch (error) {
    console.error(`✗ Failed to load ${route}: ${error.message}`);
  }
});

console.log('\n=== Test Complete ===');
console.log('Run with: node test-core.js');
