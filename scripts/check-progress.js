#!/usr/bin/env node
/**
 * Script to track repair progress
 * Usage: node check-progress.js
 */

const fs = require('fs');
const path = require('path');

// Define all repair items
const repairItems = [
  {
    id: 'types-addition',
    name: 'Add missing types to api.js',
    files: ['server/types/api.js'],
    check: (content) => {
      return content.includes('ChatMessage') && 
             content.includes('ChatRequest') && 
             content.includes('ChatResponse');
    }
  },
  {
    id: 'message-service-fix',
    name: 'Fix content->text in message service',
    files: ['server/services/message.js'],
    check: (content) => {
      return !content.includes('content: messageData.content') &&
             content.includes('text: messageData.text');
    }
  },
  {
    id: 'chat-api-fix',
    name: 'Fix content->text in chat API',
    files: ['server/api/chat.js'],
    check: (content) => {
      return !content.includes("role: 'user',\n        content:") &&
             content.includes("role: 'user',\n        text:");
    }
  },
  {
    id: 'claude-service-fix',
    name: 'Remove FIX comments in claude service',
    files: ['server/services/claude.js'],
    check: (content) => {
      return !content.includes('// FIX:');
    }
  },
  {
    id: 'mongodb-connection',
    name: 'Add MongoDB connection to index.js',
    files: ['server/index.js'],
    check: (content) => {
      return content.includes('mongoose.connect') &&
             content.includes('const mongoose = require');
    }
  },
  {
    id: 'api-routes-registration',
    name: 'Register API routes in index.js',
    files: ['server/index.js'],
    check: (content) => {
      return content.includes("app.use('/api/tickets'") &&
             content.includes("app.use('/api/knowledge'") &&
             content.includes("app.use('/api/admin'");
    }
  },
  {
    id: 'admin-api-creation',
    name: 'Create admin API file',
    files: ['server/api/admin.js'],
    check: (content) => {
      return content && content.includes('router.get') && content.includes('require(');
    }
  }
];

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function getFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function checkRepairStatus() {
  console.log('🔧 Checking repair progress...\n');
  
  let completed = 0;
  let total = repairItems.length;
  
  for (const item of repairItems) {
    let status = '❌';
    let details = '';
    
    // Check if all required files exist
    const allFilesExist = item.files.every(file => checkFileExists(file));
    
    if (!allFilesExist) {
      const missingFiles = item.files.filter(file => !checkFileExists(file));
      details = `Missing files: ${missingFiles.join(', ')}`;
    } else {
      // Check content of files
      const fileContents = item.files.map(file => getFileContent(file));
      const allValid = fileContents.every((content, index) => {
        if (!content) return false;
        return item.check(content);
      });
      
      if (allValid) {
        status = '✅';
        completed++;
        details = 'Completed';
      } else {
        details = 'Files exist but content not updated';
      }
    }
    
    console.log(`${status} ${item.name}`);
    if (details) {
      console.log(`   ${details}`);
    }
  }
  
  console.log(`\n📊 Progress: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
  
  if (completed === total) {
    console.log('🎉 All repairs completed!');
  } else {
    console.log(`\n📝 Next steps:`);
    const pending = repairItems.filter((item, index) => {
      if (!checkFileExists(item.files[0])) return true;
      const content = getFileContent(item.files[0]);
      return !content || !item.check(content);
    });
    
    pending.slice(0, 3).forEach(item => {
      console.log(`   - ${item.name}`);
    });
  }
}

// Export for programmatic use
module.exports = {
  repairItems,
  checkRepairStatus
};

// Run if called directly
if (require.main === module) {
  checkRepairStatus();
}
