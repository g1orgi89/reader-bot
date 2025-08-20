/**
 * Simple test for BookCatalog model changes
 */
const BookCatalog = require('./server/models/BookCatalog');

async function testBookCatalogModel() {
  console.log('Testing BookCatalog model...');
  
  // Test 1: Creating a book without purchaseUrl (should use fallback)
  const bookWithoutPurchaseUrl = new BookCatalog({
    title: 'Test Book',
    description: 'Test description',
    price: '$10',
    categories: ['ПОИСК СЕБЯ'],
    bookSlug: 'test-book',
    reasoning: 'Test reasoning'
  });
  
  console.log('1. Book without purchaseUrl:');
  console.log('   utmLink:', bookWithoutPurchaseUrl.utmLink);
  
  // Test 2: Creating a book with purchaseUrl (should use purchaseUrl)
  const bookWithPurchaseUrl = new BookCatalog({
    title: 'Test Book with URL',
    description: 'Test description',
    price: '$15',
    categories: ['ПОИСК СЕБЯ'],
    bookSlug: 'test-book-url',
    reasoning: 'Test reasoning',
    purchaseUrl: 'https://bebusel.info/hero'
  });
  
  console.log('2. Book with purchaseUrl:');
  console.log('   utmLink:', bookWithPurchaseUrl.utmLink);
  
  // Test 3: Book with purchaseUrl that already has query params
  const bookWithUrlAndParams = new BookCatalog({
    title: 'Test Book with URL and params',
    description: 'Test description', 
    price: '$20',
    categories: ['ПОИСК СЕБЯ'],
    bookSlug: 'test-book-params',
    reasoning: 'Test reasoning',
    purchaseUrl: 'https://bebusel.info/hero?existing=value&utm_source=existing'
  });
  
  console.log('3. Book with purchaseUrl and existing params:');
  console.log('   utmLink:', bookWithUrlAndParams.utmLink);
  
  // Test 4: Test URL validation
  try {
    const bookWithInvalidUrl = new BookCatalog({
      title: 'Test Book Invalid URL',
      description: 'Test description',
      price: '$25',
      categories: ['ПОИСК СЕБЯ'], 
      bookSlug: 'test-book-invalid',
      reasoning: 'Test reasoning',
      purchaseUrl: 'invalid-url'
    });
    
    // This should not reach here due to validation
    await bookWithInvalidUrl.validate();
    console.log('4. ERROR: Invalid URL was accepted!');
  } catch (error) {
    console.log('4. URL validation working correctly:', error.message);
  }
  
  console.log('✅ Model tests completed successfully!');
}

// Run the test
testBookCatalogModel().catch(console.error);