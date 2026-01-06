# Audio Feature - Architecture Overview

This document provides a high-level overview of the audio feature implementation for the Reader Bot.

## Overview

The audio feature implements a two-tier content model:
- **Free audio content** - Accessible to all users without authentication
- **Premium audio content** - Requires user entitlement and access control

This architecture allows starting with free content while being ready to support paid content without rewriting the frontend.

## Architecture Components

### 1. Database Models

#### AudioProgress (`server/models/AudioProgress.js`)
Tracks user's listening progress for each audio.

**Schema:**
- `userId` - Reference to user
- `audioId` - Audio identifier
- `positionSec` - Current playback position in seconds
- `updatedAt` - Last update timestamp

**Key Features:**
- Unique compound index on `(userId, audioId)`
- Static methods for CRUD operations
- Automatic upsert on progress updates

#### UserEntitlement (`server/models/UserEntitlement.js`)
Manages user access rights to content.

**Schema:**
- `userId` - Reference to user
- `kind` - Entitlement type (`audio`, `package`, `subscription`)
- `resourceId` - Resource identifier
- `expiresAt` - Expiration date (null = never expires)
- `grantedBy` - Source of grant (system, admin, purchase, etc.)
- `metadata` - Additional data (purchase info, promo codes, etc.)

**Key Features:**
- Support for individual items, packages, and subscriptions
- Expiration date support
- Automatic cleanup of expired entitlements

#### Purchase (`server/models/Purchase.js`)
Records payment and purchase events.

**Schema:**
- `userId` - Reference to user
- `source` - Payment source (stripe, telegram-stars, promo-code, admin, other)
- `externalPaymentId` - External payment ID
- `eventId` - For idempotency (prevents duplicate processing)
- `items` - Array of purchased items
- `totalAmount` - Total amount paid
- `status` - Purchase status (pending, completed, failed, refunded)
- `rawPayload` - Raw webhook data for debugging

**Key Features:**
- Idempotent purchase recording via `eventId`
- Support for multiple payment sources
- Raw payload storage for debugging

### 2. Services

#### Audio Service (`server/services/audio/audioService.js`)
Core business logic for audio management.

**Functions:**
- `listFreeAudios()` - Get all free audio metadata
- `findById(audioId)` - Get audio metadata by ID
- `isUnlocked(userId, audioId)` - Check if user has access
- `getStreamUrl(userId, audioId)` - Get streaming URL after access check

**Key Features:**
- Free audio detection via `free-` prefix
- Integration with entitlement service for premium content
- Public URL generation for free content
- Protected URL generation for premium content

#### Entitlement Service (`server/services/access/entitlementService.js`)
Manages user access rights.

**Functions:**
- `hasAudioAccess(userId, audioId)` - Check audio access
- `grantAudio(userId, audioId, options)` - Grant audio access
- `revokeAudio(userId, audioId)` - Revoke audio access
- `getUserAudioEntitlements(userId)` - Get all audio entitlements
- `grantPackage(userId, packageId, options)` - Grant package access
- `grantSubscription(userId, subscriptionId, options)` - Grant subscription access

**Key Features:**
- Centralized access control logic
- Support for temporary and permanent access
- Extensible for packages and subscriptions

### 3. API Routes (`server/api/audio.js`)

**Public Endpoints:**
- `GET /api/audio/free` - List free audios
- `GET /api/audio/:id` - Get audio metadata with unlock status
- `GET /api/audio/:id/stream-url` - Get streaming URL (with access check)
- `POST /api/audio/:id/progress` - Update listening progress
- `GET /api/audio/:id/progress` - Get listening progress

**Protected Endpoint:**
- `GET /media/stream/:id` - Stream protected audio (Node.js + X-Accel-Redirect)

### 4. Nginx Integration

**Public Directory:** `/media/free/`
- Served directly by Nginx
- No access control
- Optimized for performance

**Protected Directory:** `/media-protected/`
- Internal Nginx location
- Not directly accessible
- Served only via X-Accel-Redirect from Node.js

**Flow for Premium Content:**
1. Client requests stream URL from API
2. Node.js checks access rights
3. If authorized, returns protected stream endpoint
4. Client requests protected stream
5. Node.js verifies access again
6. Node.js responds with X-Accel-Redirect header
7. Nginx intercepts and serves file from protected directory

## Security Features

### Access Control
- Free content: Always accessible (ID starts with `free-`)
- Premium content: Requires valid entitlement
- Protected directory: Inaccessible without Node.js authorization

### Authentication
- Current: `userId` query parameter (for development)
- Production: Should use JWT tokens

### Idempotency
- Purchase processing uses `eventId` to prevent duplicates
- Safe for webhook retries

### Fail-Closed
- Access checks fail closed (deny access on error)
- Ensures security even during failures

## Data Flow

### Free Audio Playback

```
Client → GET /api/audio/free-1/stream-url
       ↓
Audio Service checks: audioId.startsWith('free-')
       ↓
Returns: { url: '/media/free/intro-psychology-reading.mp3' }
       ↓
Client → GET /media/free/intro-psychology-reading.mp3
       ↓
Nginx serves file directly
```

### Premium Audio Playback

```
Client → GET /api/audio/premium-1/stream-url?userId=123
       ↓
Audio Service → Entitlement Service
       ↓
Check UserEntitlement for (userId=123, audioId=premium-1)
       ↓
If authorized: { url: '/media/stream/premium-1' }
       ↓
Client → GET /media/stream/premium-1?userId=123
       ↓
Node.js verifies access again
       ↓
If authorized: X-Accel-Redirect: /media-protected/premium-1.mp3
       ↓
Nginx serves file from protected directory
```

### Progress Tracking

```
Client plays audio
       ↓
Every few seconds: POST /api/audio/free-1/progress
Body: { positionSec: 150 }
       ↓
AudioProgress.updateProgress(userId, audioId, positionSec)
       ↓
Upsert to database
       ↓
Returns current progress
```

## Extensibility

### Adding Premium Content

1. Add audio metadata to database or service
2. Grant entitlement to user:
   ```javascript
   await grantAudio(userId, 'premium-1', {
     grantedBy: 'purchase',
     metadata: { purchaseId: 'xxx' }
   });
   ```
3. Audio becomes accessible to that user

### Adding Packages

```javascript
// Grant package entitlement
await grantPackage(userId, 'psychology-pack', {
  grantedBy: 'purchase'
});

// Update entitlement service to check packages
// (requires mapping packages to individual audios)
```

### Adding Subscriptions

```javascript
// Grant subscription with expiration
const expiresAt = new Date();
expiresAt.setMonth(expiresAt.getMonth() + 1);

await grantSubscription(userId, 'monthly-sub', {
  expiresAt,
  grantedBy: 'stripe'
});

// Update entitlement service to check subscriptions
// (requires subscription-to-content mapping)
```

### Adding Payment Integration

```javascript
const { recordPurchase } = require('./models/Purchase');

// On successful payment
await recordPurchase({
  userId,
  source: 'stripe',
  items: [{ kind: 'audio', resourceId: 'premium-1', price: 9.99 }],
  totalAmount: 9.99,
  currency: 'USD'
}, {
  externalPaymentId: stripeChargeId,
  eventId: webhookEventId, // For idempotency
  rawPayload: webhookData
});

// Grant access
await grantAudio(userId, 'premium-1', {
  grantedBy: 'purchase',
  metadata: { purchaseId: purchase._id }
});
```

## Testing

### Unit Tests
- `tests/unit/audioProgress.test.js` - AudioProgress model tests

### Integration Tests
- `tests/integration/audio.test.js` - Audio API endpoint tests

### Manual Testing

```bash
# List free audios
curl http://localhost:3002/api/audio/free

# Get audio metadata
curl "http://localhost:3002/api/audio/free-1?userId=USER_ID"

# Get stream URL
curl "http://localhost:3002/api/audio/free-1/stream-url?userId=USER_ID"

# Update progress
curl -X POST "http://localhost:3002/api/audio/free-1/progress?userId=USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"positionSec": 150}'

# Get progress
curl "http://localhost:3002/api/audio/free-1/progress?userId=USER_ID"
```

## Deployment Checklist

- [ ] Configure Nginx with audio locations (see `docs/audio/nginx-config.md`)
- [ ] Create `/media/free/` directory for public audio files
- [ ] Create `/media/protected/` directory for premium audio files
- [ ] Set proper file permissions (www-data:www-data, 755)
- [ ] Upload audio files to appropriate directories
- [ ] Replace `userId` query parameter with JWT authentication
- [ ] Configure CORS headers for your domain
- [ ] Set up monitoring and logging
- [ ] Test audio playback from client application
- [ ] Test access control for premium content
- [ ] Configure rate limiting

## Future Improvements

1. **Database-driven metadata** - Move audio metadata from code to database
2. **Admin panel** - UI for managing audio content and entitlements
3. **Analytics** - Track listening time, completion rates, popular content
4. **Recommendations** - Suggest audio based on user preferences
5. **Downloads** - Allow offline downloads with temporary tokens
6. **Quality levels** - Support multiple bitrates
7. **Transcripts** - Add text transcripts for accessibility
8. **Playlists** - Allow users to create custom playlists
9. **Comments** - Enable user comments and discussions
10. **Sharing** - Social sharing features

## File Locations

```
server/
├── models/
│   ├── AudioProgress.js       # Progress tracking model
│   ├── UserEntitlement.js     # Access rights model
│   └── Purchase.js            # Purchase records model
├── services/
│   ├── audio/
│   │   └── audioService.js    # Audio business logic
│   └── access/
│       └── entitlementService.js  # Access control logic
└── api/
    └── audio.js               # API routes

docs/
└── audio/
    ├── README.md              # This file
    ├── API.md                 # API documentation
    └── nginx-config.md        # Nginx configuration guide

tests/
├── unit/
│   └── audioProgress.test.js  # Model tests
└── integration/
    └── audio.test.js          # API tests
```

## Support

For questions or issues, refer to:
- [API Documentation](./API.md)
- [Nginx Configuration Guide](./nginx-config.md)
- Main project README
