# Alice Wonderland Audio Streaming Fix - Implementation Summary

## Problem
Protected audio streaming for `alice_wonderland` was experiencing potential conflicts due to duplicate route definitions with divergent access check logic.

## Root Cause
There were two `/media/stream/:id` route definitions:
1. **Active route** in `server/index.js` (line 755) - uses `audioService.isUnlocked(userId, id)`
2. **Unused route** in `server/api/stream.js` (line 40) - uses `hasAudioAccess(userId, containerId)` directly

While the unused route wasn't mounted, its presence created confusion and potential for future conflicts if accidentally mounted.

## Solution Implemented
**Removed** the duplicate unused route file `server/api/stream.js` to ensure a single source of truth.

## Unified Access Check Flow

All three endpoints now consistently use `audioService.isUnlocked(userId, id)` for access control:

### 1. Metadata Request
```
GET /api/audio/alice_wonderland?userId=XXX
├─→ audioService.findById('alice_wonderland')
└─→ audioService.isUnlocked(userId, 'alice_wonderland')
    └─→ hasAudioAccess(userId, 'alice_wonderland')
    
Response: { unlocked: true/false, tracks: [...], coverUrl, playerCoverUrl }
```

### 2. Stream URL Request
```
GET /api/audio/alice_wonderland/stream-url?userId=XXX
└─→ audioService.getStreamUrl(userId, 'alice_wonderland')
    ├─→ audioService.isUnlocked(userId, 'alice_wonderland')
    │   └─→ hasAudioAccess(userId, 'alice_wonderland')
    └─→ Returns: /media/stream/alice_wonderland-01?userId=XXX
```

### 3. Actual Streaming
```
GET /media/stream/alice_wonderland-01?userId=XXX
├─→ resolveUserObjectId(userId) → ObjectId
├─→ audioService.isUnlocked(userId, 'alice_wonderland-01')
│   ├─→ Finds track in container 'alice_wonderland'
│   ├─→ Maps to container ID: 'alice_wonderland'
│   └─→ hasAudioAccess(userId, 'alice_wonderland')
└─→ Sets X-Accel-Redirect: /media-protected/alice_wonderland/01.mp3
```

## Access Check Logic in `audioService.isUnlocked()`

The function handles both container IDs and track IDs correctly:

```javascript
// For track IDs (e.g., 'alice_wonderland-01'):
1. Search all containers for a track with this ID
2. Find parent container (e.g., 'alice_wonderland')
3. Check if container is free → return true
4. If premium, use CONTAINER ID for entitlement check
5. Call: hasAudioAccess(userId, 'alice_wonderland')

// For container IDs (e.g., 'alice_wonderland'):
1. Find container by ID
2. Check if container is free → return true
3. If premium, use container ID for entitlement check
4. Call: hasAudioAccess(userId, 'alice_wonderland')
```

## Alice Wonderland Configuration

```javascript
alice_wonderland: {
  id: 'alice_wonderland',
  title: 'Разбор: «Алиса в стране чудес»',
  author: 'Льюис Кэрролл',
  description: 'Философский анализ классической сказки о поиске себя и познании мира',
  coverUrl: '/mini-app/assets/book-covers/alice_wonderland.png',         // Card UI
  playerCoverUrl: '/mini-app/assets/audio-covers/alice_wonderland-player.png',  // Player UI
  isFree: false,
  requiresEntitlement: true,
  tracks: [
    { id: 'alice_wonderland-01', title: 'Часть 1', file: 'alice_wonderland/01.mp3' },
    { id: 'alice_wonderland-02', title: 'Часть 2', file: 'alice_wonderland/02.mp3' },
    { id: 'alice_wonderland-03', title: 'Часть 3', file: 'alice_wonderland/03.mp3' },
    { id: 'alice_wonderland-04', title: 'Часть 4', file: 'alice_wonderland/04.mp3' },
    { id: 'alice_wonderland-05', title: 'Часть 5', file: 'alice_wonderland/05.mp3' },
    { id: 'alice_wonderland-06', title: 'Часть 6', file: 'alice_wonderland/06.mp3' }
  ]
}
```

## X-Accel-Redirect Mapping

The streaming endpoint correctly maps track IDs to file paths:

```
Track ID              → X-Accel-Redirect Path
alice_wonderland-01   → /media-protected/alice_wonderland/01.mp3
alice_wonderland-02   → /media-protected/alice_wonderland/02.mp3
...
alice_wonderland-06   → /media-protected/alice_wonderland/06.mp3
```

## Stream URL Format

For premium content, the stream URL includes the userId parameter:

```
/media/stream/{trackId}?userId={userId}
```

Example:
```
/media/stream/alice_wonderland-01?userId=507f1f77bcf86cd799439011
```

## Key Features

✅ **Unified access check** - All endpoints use `audioService.isUnlocked()`
✅ **Track-to-container mapping** - Correctly maps track IDs to parent container for entitlement checks
✅ **User ID in stream URL** - Premium content includes userId parameter
✅ **Correct covers** - Card cover and player cover properly configured
✅ **6 tracks** - All tracks (01-06) properly defined
✅ **Single source of truth** - Only one active route in server/index.js

## Testing Checklist

- [ ] Metadata shows `unlocked=true` when user has entitlement
- [ ] Metadata shows `unlocked=false` when user lacks entitlement
- [ ] Stream URL includes userId parameter: `/media/stream/alice_wonderland-01?userId=XXX`
- [ ] Actual streaming succeeds with 200 status when user has access
- [ ] Actual streaming fails with 403 when user lacks access
- [ ] X-Accel-Redirect header set to `/media-protected/alice_wonderland/{trackNumber}.mp3`
- [ ] All 6 tracks are accessible
- [ ] Covers display correctly in UI
