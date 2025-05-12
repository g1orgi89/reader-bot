/**
 * Check for missing files that may cause errors
 * @file check-missing-files.js
 */

const fs = require('fs');
const path = require('path');

console.log('Checking for missing files...\n');

// Files that are required for the server to start
const requiredFiles = [
  'server/index.js',
  'server/config/index.js',
  'server/core/ServiceManager.js',
  'server/utils/logger.js',
  'server/services/claude.js',
  'server/services/vectorStore.js',
  'server/services/ticketing.js',
  'server/services/message.js',
  'server/api/chat.js',
  'server/api/tickets.js',
  'server/api/knowledge.js',
  'server/api/admin.js',
  'server/middleware/auth.js',
  'server/models/ticket.js',
  'server/models/message.js',
  'server/models/conversation.js',
  'server/utils/validators.js',
  'server/constants/errorCodes.js',
  'package.json',
  '.env.example'
];

// Optional files that may have placeholders
const optionalFiles = [
  '.env',
  'server/types/index.js',
  'server/types/ticket.js',
  'server/types/claude.js'
];

console.log('=== Required Files ===');
let missingRequired = 0;
requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file}`);
  } else {
    console.log(`✗ MISSING: ${file}`);
    missingRequired++;
  }
});

console.log('\n=== Optional Files ===');
let missingOptional = 0;
optionalFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file}`);
  } else {
    console.log(`? Missing (optional): ${file}`);
    missingOptional++;
  }
});

console.log('\n=== Summary ===');
console.log(`Required files missing: ${missingRequired}`);
console.log(`Optional files missing: ${missingOptional}`);

if (missingRequired > 0) {
  console.log('\n❌ Some required files are missing. The server will likely fail to start.');
  console.log('Please create these files before attempting to run the server.');
} else {
  console.log('\n✅ All required files are present.');
}

// Check file contents for obvious issues
console.log('\n=== Checking Critical Files ===');
const criticalFiles = [
  'server/index.js',
  'server/config/index.js'
];

criticalFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`\n${file}:`);
    console.log(`  File size: ${content.length} bytes`);
    
    // Check for common issues
    if (content.includes('require(') && !content.includes('module.exports')) {
      console.log(`  ⚠️  Warning: Has require() but no module.exports`);
    }
    if (content.includes('function(') || content.includes('() =>')) {
      console.log(`  ✓ Contains functions`);
    }
    if (content.includes('Error')) {
      console.log(`  ✓ Has error handling`);
    }
  }
});

console.log('\nRun this with: node check-missing-files.js');
