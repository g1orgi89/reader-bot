/**
 * Test the import functionality with the generated book catalog data
 */
const fs = require('fs');
const path = require('path');

async function testImportFunctionality() {
  try {
    console.log('Testing import functionality...');
    
    // Read the generated import file
    const importFile = path.join(__dirname, 'data', 'bookCatalog.import.json');
    if (!fs.existsSync(importFile)) {
      console.error('❌ Import file not found. Run the conversion script first.');
      return;
    }
    
    const importData = JSON.parse(fs.readFileSync(importFile, 'utf8'));
    console.log(`📁 Loaded ${importData.books.length} books for import`);
    
    // Test a few sample books for validation
    const sampleBooks = importData.books.slice(0, 3);
    
    for (const book of sampleBooks) {
      console.log(`\n📚 Testing book: ${book.title}`);
      console.log(`   - purchaseUrl: ${book.purchaseUrl}`);
      console.log(`   - bookSlug: ${book.bookSlug}`);
      console.log(`   - categories: ${book.categories.join(', ')}`);
      
      // Test creating a virtual model instance (without saving to DB)
      try {
        const BookCatalog = require('./server/models/BookCatalog');
        const testBook = new BookCatalog(book);
        
        console.log(`   - utmLink: ${testBook.utmLink}`);
        
        // Test validation
        const validationResult = testBook.validateSync();
        if (validationResult) {
          console.log(`   ❌ Validation errors:`, validationResult.errors);
        } else {
          console.log(`   ✅ Validation passed`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error creating book instance:`, error.message);
      }
    }
    
    console.log('\n🔗 Testing UTM link generation:');
    
    // Test books with different purchaseUrl scenarios
    const BookCatalog = require('./server/models/BookCatalog');
    
    // Book with purchaseUrl
    const bookWithUrl = new BookCatalog({
      title: 'Test Book',
      description: 'Test',
      price: '$10',
      categories: ['ПОИСК СЕБЯ'],
      bookSlug: 'test',
      reasoning: 'Test',
      purchaseUrl: 'https://bebusel.info/test'
    });
    console.log('With purchaseUrl:', bookWithUrl.utmLink);
    
    // Book with purchaseUrl that has existing params
    const bookWithUrlAndParams = new BookCatalog({
      title: 'Test Book 2',
      description: 'Test',
      price: '$10',
      categories: ['ПОИСК СЕБЯ'],
      bookSlug: 'test2',
      reasoning: 'Test',
      purchaseUrl: 'https://bebusel.info/test?foo=bar&utm_source=existing'
    });
    console.log('With existing params:', bookWithUrlAndParams.utmLink);
    
    // Book without purchaseUrl
    const bookWithoutUrl = new BookCatalog({
      title: 'Test Book 3',
      description: 'Test',
      price: '$10',
      categories: ['ПОИСК СЕБЯ'],
      bookSlug: 'test3',
      reasoning: 'Test'
    });
    console.log('Without purchaseUrl:', bookWithoutUrl.utmLink);
    
    console.log('\n✅ Import test completed successfully!');
    console.log('\n📄 Sample import payload structure:');
    console.log(JSON.stringify({ books: [importData.books[0]] }, null, 2));
    
  } catch (error) {
    console.error('❌ Import test failed:', error);
  }
}

testImportFunctionality();