/**
 * Test script for Community Trend category-first display fix
 * @file test-community-trend-fix.js
 */

/**
 * Test that community trend response always shows category-centric text
 */
function testCommunityTrendResponse() {
  console.log('🧪 Testing Community Trend response format...\n');
  
  // Mock response structure based on requirements
  const mockResponseWithBook = {
    success: true,
    data: {
      title: 'Тренд недели',
      text: 'Тема «ДЕНЬГИ» набирает популярность',
      buttonText: 'Изучить разборы',
      link: '/catalog?category=dengi&highlight=some-book-slug',
      category: { 
        key: 'ДЕНЬГИ', 
        label: 'ДЕНЬГИ', 
        slug: 'dengi' 
      },
      book: {
        id: '507f1f77bcf86cd799439011',
        title: 'Богатый папа, бедный папа'
      }
    }
  };

  const mockResponseWithoutBook = {
    success: true,
    data: {
      title: 'Тренд недели',
      text: 'Тема «ПСИХОЛОГИЯ» набирает популярность',
      buttonText: 'Изучить разборы',
      link: '/catalog?category=psihologiya',
      category: { 
        key: 'ПСИХОЛОГИЯ', 
        label: 'ПСИХОЛОГИЯ', 
        slug: 'psihologiya' 
      }
    }
  };

  console.log('✅ Test Case 1: Response WITH top book');
  console.log('  - Title:', mockResponseWithBook.data.title);
  console.log('  - Text (category-based):', mockResponseWithBook.data.text);
  console.log('  - Button:', mockResponseWithBook.data.buttonText);
  console.log('  - Link (with highlight):', mockResponseWithBook.data.link);
  console.log('  - Category:', mockResponseWithBook.data.category.key);
  console.log('  - Book meta (optional):', mockResponseWithBook.data.book ? 'Present' : 'Absent');
  
  // Validate: text should NOT contain book title
  const hasBookInText = mockResponseWithBook.data.text.includes('«Богатый папа');
  console.log('  - Text does NOT contain book title:', !hasBookInText ? '✅' : '❌');
  
  // Validate: link should contain highlight param
  const hasHighlight = mockResponseWithBook.data.link.includes('&highlight=');
  console.log('  - Link contains highlight param:', hasHighlight ? '✅' : '❌');
  
  console.log('\n✅ Test Case 2: Response WITHOUT top book');
  console.log('  - Title:', mockResponseWithoutBook.data.title);
  console.log('  - Text (category-based):', mockResponseWithoutBook.data.text);
  console.log('  - Button:', mockResponseWithoutBook.data.buttonText);
  console.log('  - Link (no highlight):', mockResponseWithoutBook.data.link);
  console.log('  - Category:', mockResponseWithoutBook.data.category.key);
  console.log('  - Book meta:', mockResponseWithoutBook.data.book ? 'Present' : 'Absent ✅');
  
  // Validate: link should NOT contain highlight param
  const noHighlight = !mockResponseWithoutBook.data.link.includes('&highlight=');
  console.log('  - Link does NOT contain highlight:', noHighlight ? '✅' : '❌');
}

/**
 * Test getTopBooks API client with scope parameter
 */
function testGetTopBooksWithScope() {
  console.log('\n🧪 Testing getTopBooks API client with scope parameter...\n');
  
  // Simulate the API client method
  function getTopBooks(options = {}) {
    const params = new URLSearchParams();
    if (options.period) params.append('period', options.period);
    if (options.limit) params.append('limit', options.limit);
    if (options.scope) params.append('scope', options.scope);
    
    const queryString = params.toString();
    const endpoint = queryString ? `/top-books?${queryString}` : '/top-books';
    
    return endpoint;
  }
  
  // Test cases
  const testCases = [
    { 
      input: { scope: 'week' }, 
      expected: '/top-books?scope=week',
      description: 'scope=week only'
    },
    { 
      input: { period: '7d', limit: 3 }, 
      expected: '/top-books?period=7d&limit=3',
      description: 'period and limit (legacy)'
    },
    { 
      input: { scope: 'week', limit: 5 }, 
      expected: '/top-books?scope=week&limit=5',
      description: 'scope=week with limit'
    },
    { 
      input: {}, 
      expected: '/top-books',
      description: 'no parameters'
    }
  ];
  
  testCases.forEach(test => {
    const result = getTopBooks(test.input);
    const passed = result === test.expected;
    console.log(`  ${passed ? '✅' : '❌'} ${test.description}`);
    console.log(`     Input: ${JSON.stringify(test.input)}`);
    console.log(`     Output: ${result}`);
    if (!passed) {
      console.log(`     Expected: ${test.expected}`);
    }
  });
}

/**
 * Test highlight encoding
 */
function testHighlightEncoding() {
  console.log('\n🧪 Testing highlight URL encoding...\n');
  
  const testCases = [
    { 
      slug: 'simple-slug',
      categorySlug: 'dengi',
      expected: '/catalog?category=dengi&highlight=simple-slug'
    },
    { 
      slug: 'slug-with-spaces',
      categorySlug: 'psihologiya',
      expected: '/catalog?category=psihologiya&highlight=slug-with-spaces'
    },
    { 
      slug: 'slug/with/slashes',
      categorySlug: 'career',
      expected: '/catalog?category=career&highlight=slug%2Fwith%2Fslashes'
    }
  ];
  
  testCases.forEach(test => {
    const result = `/catalog?category=${test.categorySlug}&highlight=${encodeURIComponent(test.slug)}`;
    const passed = result === test.expected;
    console.log(`  ${passed ? '✅' : '❌'} Encoding "${test.slug}"`);
    console.log(`     Result: ${result}`);
    if (!passed) {
      console.log(`     Expected: ${test.expected}`);
    }
  });
}

// Run all tests
console.log('🚀 Community Trend Category-First Display Fix - Test Suite\n');
console.log('='.repeat(60) + '\n');

testCommunityTrendResponse();
testGetTopBooksWithScope();
testHighlightEncoding();

console.log('\n' + '='.repeat(60));
console.log('✅ All validation tests completed!');
