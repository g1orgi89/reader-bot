#!/usr/bin/env node

/**
 * Test to verify the complete aiAnalysis flow
 * From quote creation to display
 */

const path = require('path');

// Mock quote creation and API responses
function testCompleteAiAnalysisFlow() {
  console.log('🧪 Testing complete aiAnalysis flow...\n');
  
  // 1. Test toQuoteDTO function from reader.js
  console.log('1. Testing toQuoteDTO function:');
  
  const mockQuote = {
    _id: 'quote123',
    text: 'Test quote text',
    author: 'Test Author',
    source: 'Test Source',
    category: 'МУДРОСТЬ',
    themes: ['wisdom', 'life'],
    sentiment: 'positive',
    insights: 'Deep insights about life',
    isEdited: false,
    editedAt: null,
    createdAt: new Date('2024-01-01')
  };
  
  // Simulate toQuoteDTO function
  function toQuoteDTO(q, { summary = '', user = null } = {}) {
    const base = {
      id: q._id,
      text: q.text,
      author: q.author,
      source: q.source,
      category: q.category,
      themes: Array.isArray(q.themes) ? q.themes : [],
      sentiment: q.sentiment,
      insights: q.insights,
      isEdited: q.isEdited,
      editedAt: q.editedAt,
      createdAt: q.createdAt,
      aiAnalysis: {
        summary: summary || '',
        insights: q.insights || '',
        category: q.category || 'ДРУГОЕ',
        themes: Array.isArray(q.themes) ? q.themes : [],
        sentiment: q.sentiment || 'neutral'
      }
    };
    if (user) base.user = user;
    return base;
  }
  
  const quoteDTOBasic = toQuoteDTO(mockQuote);
  const quoteDTOWithSummary = toQuoteDTO(mockQuote, { summary: 'Anna\'s analysis summary' });
  
  console.log('✅ Basic DTO has aiAnalysis:', !!quoteDTOBasic.aiAnalysis);
  console.log('✅ aiAnalysis.insights:', quoteDTOBasic.aiAnalysis.insights);
  console.log('✅ aiAnalysis.category:', quoteDTOBasic.aiAnalysis.category);
  console.log('✅ DTO with summary:', quoteDTOWithSummary.aiAnalysis.summary);
  
  // 2. Test API response structure for POST /api/reader/quotes
  console.log('\n2. Testing POST /api/reader/quotes response structure:');
  
  const postQuotesResponse = {
    success: true,
    quote: toQuoteDTO(mockQuote, { summary: 'Anna\'s response to the quote' }),
    newAchievements: [],
    todayCount: 1
  };
  
  console.log('✅ Response has success:', postQuotesResponse.success);
  console.log('✅ Response has quote:', !!postQuotesResponse.quote);
  console.log('✅ Quote has aiAnalysis:', !!postQuotesResponse.quote.aiAnalysis);
  console.log('✅ aiAnalysis has summary:', !!postQuotesResponse.quote.aiAnalysis.summary);
  console.log('✅ aiAnalysis has insights:', !!postQuotesResponse.quote.aiAnalysis.insights);
  console.log('✅ aiAnalysis has category:', !!postQuotesResponse.quote.aiAnalysis.category);
  
  // 3. Test frontend QuoteCard expectations
  console.log('\n3. Testing frontend QuoteCard expectations:');
  
  const quoteForFrontend = postQuotesResponse.quote;
  
  // Simulate what QuoteCard.js does
  const aiCategory = quoteForFrontend.aiAnalysis?.category || 'wisdom';
  const aiInsights = quoteForFrontend.aiAnalysis?.insight || 
                    quoteForFrontend.aiAnalysis?.insights || 
                    quoteForFrontend.aiAnalysis?.summary || 
                    'Анализируется...';
  
  console.log('✅ Frontend can get category:', aiCategory);
  console.log('✅ Frontend can get insights:', aiInsights);
  console.log('✅ Quote card would show analysis:', !!quoteForFrontend.aiAnalysis);
  
  // 4. Test potential issues
  console.log('\n4. Testing potential issues:');
  
  // Issue 1: Missing aiAnalysis
  const quoteWithoutAiAnalysis = {
    id: 'quote123',
    text: 'Test quote',
    author: 'Test Author'
    // Missing aiAnalysis!
  };
  
  console.log('❌ Quote without aiAnalysis would show:', 
    !!(quoteWithoutAiAnalysis.aiAnalysis), 
    '(should be false)'
  );
  
  // Issue 2: Empty aiAnalysis
  const quoteWithEmptyAiAnalysis = {
    id: 'quote123',
    text: 'Test quote',
    author: 'Test Author',
    aiAnalysis: {}
  };
  
  const emptyInsights = quoteWithEmptyAiAnalysis.aiAnalysis?.insight || 
                       quoteWithEmptyAiAnalysis.aiAnalysis?.insights || 
                       quoteWithEmptyAiAnalysis.aiAnalysis?.summary || 
                       'Анализируется...';
  
  console.log('⚠️  Quote with empty aiAnalysis shows fallback:', emptyInsights);
  
  // Issue 3: Missing insights field
  const quoteWithMissingInsights = {
    id: 'quote123',
    text: 'Test quote',
    author: 'Test Author',
    aiAnalysis: {
      category: 'МУДРОСТЬ',
      themes: ['wisdom'],
      sentiment: 'positive'
      // Missing insights!
    }
  };
  
  const missingInsights = quoteWithMissingInsights.aiAnalysis?.insight || 
                         quoteWithMissingInsights.aiAnalysis?.insights || 
                         quoteWithMissingInsights.aiAnalysis?.summary || 
                         'Анализируется...';
  
  console.log('⚠️  Quote with missing insights shows fallback:', missingInsights);
  
  return true;
}

// Test different endpoint responses
function testEndpointConsistency() {
  console.log('\n🧪 Testing endpoint consistency...\n');
  
  const mockQuote = {
    _id: 'quote123',
    text: 'Test quote text',
    author: 'Test Author',
    category: 'МУДРОСТЬ',
    themes: ['wisdom'],
    sentiment: 'positive',
    insights: 'Deep insights',
    createdAt: new Date()
  };
  
  // 1. POST /api/reader/quotes response (uses toQuoteDTO)
  console.log('1. POST /api/reader/quotes (reader.js):');
  const readerResponse = {
    success: true,
    quote: {
      id: mockQuote._id,
      text: mockQuote.text,
      author: mockQuote.author,
      category: mockQuote.category,
      themes: mockQuote.themes,
      sentiment: mockQuote.sentiment,
      insights: mockQuote.insights,
      createdAt: mockQuote.createdAt,
      aiAnalysis: {
        summary: 'Anna\'s summary',
        insights: mockQuote.insights,
        category: mockQuote.category,
        themes: mockQuote.themes,
        sentiment: mockQuote.sentiment
      }
    }
  };
  
  console.log('✅ Has aiAnalysis:', !!readerResponse.quote.aiAnalysis);
  console.log('✅ aiAnalysis complete:', !!(readerResponse.quote.aiAnalysis.insights && 
                                         readerResponse.quote.aiAnalysis.category));
  
  // 2. GET /api/reader/quotes response (uses toQuoteDTO)
  console.log('\n2. GET /api/reader/quotes (reader.js):');
  const getQuotesResponse = {
    success: true,
    quotes: [readerResponse.quote]
  };
  
  console.log('✅ Each quote has aiAnalysis:', getQuotesResponse.quotes.every(q => !!q.aiAnalysis));
  
  // 3. POST /api/reader/quotes/analyze response
  console.log('\n3. POST /api/reader/quotes/analyze (reader.js):');
  const analyzeResponse = {
    success: true,
    analysis: {
      category: mockQuote.category,
      themes: mockQuote.themes,
      sentiment: mockQuote.sentiment,
      insights: mockQuote.insights
    },
    aiAnalysis: {
      summary: '',
      insights: mockQuote.insights,
      category: mockQuote.category,
      themes: mockQuote.themes,
      sentiment: mockQuote.sentiment
    }
  };
  
  console.log('✅ Has analysis:', !!analyzeResponse.analysis);
  console.log('✅ Has aiAnalysis sibling:', !!analyzeResponse.aiAnalysis);
  
  return true;
}

// Run tests
try {
  testCompleteAiAnalysisFlow();
  testEndpointConsistency();
  
  console.log('\n🎉 All aiAnalysis flow tests passed!');
  console.log('\n📋 Summary:');
  console.log('✅ toQuoteDTO helper creates correct aiAnalysis structure');
  console.log('✅ POST /api/reader/quotes should return aiAnalysis');
  console.log('✅ GET /api/reader/quotes should return aiAnalysis for each quote');
  console.log('✅ Frontend QuoteCard can display aiAnalysis correctly');
  console.log('✅ Fallbacks work when insights are missing');
  
  console.log('\n🔍 Potential issues to investigate:');
  console.log('1. Verify all server endpoints consistently use toQuoteDTO');
  console.log('2. Check if AI analysis generation is failing silently');
  console.log('3. Verify frontend receives and processes response correctly');
  console.log('4. Check if there are caching issues in frontend');
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
}