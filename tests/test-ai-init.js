#!/usr/bin/env node

/**
 * Simple test to verify AI provider initialization without ANTHROPIC_API_KEY
 */

// Set test environment variables
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test-key-placeholder';
process.env.OPENAI_MODEL = 'gpt-4o-mini';
delete process.env.ANTHROPIC_API_KEY; // Make sure it's not set

console.log('🧪 Testing AI Provider initialization...');
console.log('AI_PROVIDER:', process.env.AI_PROVIDER);
console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
console.log('ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY);

try {
  // Test configuration loading
  const { getAIProviderConfig } = require('./server/config/aiProvider');
  const config = getAIProviderConfig();
  
  console.log('\n✅ AI Provider config loaded:');
  console.log('- Provider:', config.provider);
  console.log('- OpenAI model:', config.openai.model);
  console.log('- Claude API key present:', !!config.claude.apiKey);
  console.log('- OpenAI API key present:', !!config.openai.apiKey);
  
  // Test claude service initialization
  console.log('\n🧪 Testing Claude service initialization...');
  const claudeService = require('./server/services/claude');
  
  const providerInfo = claudeService.getProviderInfo();
  console.log('\n✅ Claude service initialized:');
  console.log('- Current provider:', providerInfo.currentProvider);
  console.log('- Available providers:', providerInfo.availableProviders);
  console.log('- Models:', providerInfo.models);
  
  console.log('\n🎉 All tests passed! No errors about missing ANTHROPIC_API_KEY');
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
}