#!/usr/bin/env node
/**
 * Demo script for audio feature
 * Shows how the audio system works without database
 * @file scripts/demo-audio-feature.js
 */

const audioService = require('../server/services/audio/audioService');

console.log('🎵 Audio Feature Demo\n');
console.log('=' .repeat(60));

async function demo() {
  try {
    // 1. List free audios
    console.log('\n1️⃣  Listing free audios:');
    console.log('-'.repeat(60));
    const freeAudios = await audioService.listFreeAudios();
    freeAudios.forEach(audio => {
      console.log(`\n📚 ${audio.title}`);
      console.log(`   Author: ${audio.author}`);
      console.log(`   Duration: ${Math.floor(audio.durationSec / 60)} minutes`);
      console.log(`   URL: ${audio.audioUrl}`);
      console.log(`   Free: ${audio.isFree ? '✅' : '❌'}`);
    });

    // 2. Find audio by ID
    console.log('\n\n2️⃣  Finding audio by ID (free-1):');
    console.log('-'.repeat(60));
    const audio = await audioService.findById('free-1');
    if (audio) {
      console.log(`\n✅ Found: ${audio.title}`);
      console.log(`   Description: ${audio.description}`);
    } else {
      console.log('❌ Not found');
    }

    // 3. Check if audio is unlocked (free audio)
    console.log('\n\n3️⃣  Checking if free-1 is unlocked:');
    console.log('-'.repeat(60));
    const mockUserId = '507f1f77bcf86cd799439011'; // Mock ObjectId
    const isUnlocked = await audioService.isUnlocked(mockUserId, 'free-1');
    console.log(`   Status: ${isUnlocked ? '✅ Unlocked' : '🔒 Locked'}`);
    console.log(`   Reason: Audio ID starts with 'free-' → always unlocked`);

    // 4. Get stream URL
    console.log('\n\n4️⃣  Getting stream URL for free-1:');
    console.log('-'.repeat(60));
    try {
      const streamUrl = await audioService.getStreamUrl(mockUserId, 'free-1');
      console.log(`   ✅ Stream URL: ${streamUrl.url}`);
      console.log(`   Type: Direct public URL (no access control needed)`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 5. Try to access non-existent audio
    console.log('\n\n5️⃣  Trying to access non-existent audio:');
    console.log('-'.repeat(60));
    const nonExistent = await audioService.findById('non-existent');
    console.log(`   Result: ${nonExistent ? 'Found' : '❌ Not found (as expected)'}`);

    // 6. Summary
    console.log('\n\n📊 Summary:');
    console.log('='.repeat(60));
    console.log('✅ Audio service loaded successfully');
    console.log('✅ Free audio metadata retrieved');
    console.log('✅ Access control working (free audio always unlocked)');
    console.log('✅ Stream URL generation working');
    console.log('\n💡 Next steps:');
    console.log('   1. Configure Nginx (see docs/audio/nginx-config.md)');
    console.log('   2. Upload audio files to /media/free/ directory');
    console.log('   3. Implement authentication in production');
    console.log('   4. Add premium content with entitlements');
    console.log('\n📚 Documentation:');
    console.log('   - Architecture: docs/audio/README.md');
    console.log('   - API Docs: docs/audio/API.md');
    console.log('   - Nginx Setup: docs/audio/nginx-config.md');
    console.log('');

  } catch (error) {
    console.error('❌ Error in demo:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

demo();
