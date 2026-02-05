# Audio API Documentation

This document describes the Audio API endpoints for managing audio content, user progress, and access control.

## Base URL

All endpoints are prefixed with `/api/audio`

## Authentication

Currently, endpoints accept `userId` as a query parameter. **In production, implement proper JWT-based authentication.**

## Endpoints

### 1. List Free Audios

Get a list of all free audio content.

**Endpoint:** `GET /api/audio/free`

**Authentication:** None required

**Response:**

```json
{
  "success": true,
  "audios": [
    {
      "id": "free-1",
      "title": "Введение в психологию чтения",
      "author": "Анна Бусел",
      "description": "Вводный аудиоразбор о психологии чтения и работе с книгами",
      "durationSec": 1800,
      "coverUrl": "/assets/audio/free-1-cover.jpg",
      "audioUrl": "/media/free/intro-psychology-reading.mp3",
      "isFree": true
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:3002/api/audio/free
```

---

### 2. Get Audio Metadata

Get metadata for a specific audio, including unlock status and remaining days for gated content.

**Endpoint:** `GET /api/audio/:id`

**Parameters:**
- `id` (path) - Audio identifier (e.g., "malenkii_princ", "alice_wonderland")
- `userId` (query, optional) - User ID to check unlock status

**Response:**

For free audio:
```json
{
  "success": true,
  "audio": {
    "id": "malenkii_princ",
    "title": "Разбор: «Маленький принц»",
    "author": "Антуан де Сент-Экзюпери",
    "description": "Этот разбор прослушало более 35.000 человек!",
    "coverUrl": "/assets/book-covers/malenkii_princ.png",
    "playerCoverUrl": "/assets/audio-covers/malenkii_princ-player.png",
    "isFree": true,
    "unlocked": true
  },
  "tracks": [
    {
      "id": "malenkii_princ-01",
      "title": "Часть 1",
      "file": "malenkii_princ/01.mp3"
    }
  ]
}
```

For gated audio (with user access):
```json
{
  "success": true,
  "audio": {
    "id": "alice_wonderland",
    "title": "Разбор: «Алиса в стране чудес»",
    "author": "Льюис Кэрролл",
    "description": "Философский анализ классической сказки о поиске себя и познании мира",
    "coverUrl": "/assets/book-covers/alice_wonderland.png",
    "playerCoverUrl": "/assets/audio-covers/alice_wonderland-player.png",
    "isFree": false,
    "requiresEntitlement": true,
    "unlocked": true,
    "remainingDays": 25
  },
  "tracks": [
    {
      "id": "alice_wonderland-01",
      "title": "Часть 1",
      "file": "alice_wonderland/01.mp3"
    }
  ]
}
```

For gated audio (without access):
```json
{
  "success": true,
  "audio": {
    "id": "alice_wonderland",
    "title": "Разбор: «Алиса в стране чудес»",
    "author": "Льюис Кэрролл",
    "description": "Философский анализ классической сказки о поиске себя и познании мира",
    "coverUrl": "/assets/book-covers/alice_wonderland.png",
    "playerCoverUrl": "/assets/audio-covers/alice_wonderland-player.png",
    "isFree": false,
    "requiresEntitlement": true,
    "unlocked": false
  },
  "tracks": [...]
}
```

**New Fields:**
- `unlocked` (boolean) - Whether the user has access to this audio
- `remainingDays` (number, optional) - Days remaining on entitlement (only for gated content with access)
  - Positive number: Days remaining until expiration
  - `-1`: Never expires (permanent access)
  - Not present: Not a gated audio or no access

**Example:**

```bash
curl "http://localhost:3002/api/audio/alice_wonderland?userId=USER_ID"
```

**Error Responses:**

- `404 Not Found` - Audio not found

---

### 3. Get Stream URL

Get the streaming URL for an audio. This endpoint checks access rights before returning the URL.

**Endpoint:** `GET /api/audio/:id/stream-url`

**Parameters:**
- `id` (path) - Audio identifier
- `userId` (query, required) - User ID for access check

**Response:**

For free audio:
```json
{
  "success": true,
  "url": "/media/free/intro-psychology-reading.mp3"
}
```

For premium audio (if user has access):
```json
{
  "success": true,
  "url": "/media/stream/premium-1"
}
```

**Example:**

```bash
curl "http://localhost:3002/api/audio/free-1/stream-url?userId=USER_ID"
```

**Error Responses:**

- `401 Unauthorized` - User ID not provided
- `403 Forbidden` - User doesn't have access to this audio
- `404 Not Found` - Audio not found

---

### 4. Update Progress

Update the listening progress for an audio.

**Endpoint:** `POST /api/audio/:id/progress`

**Parameters:**
- `id` (path) - Audio identifier
- `userId` (query, required) - User ID

**Request Body:**

```json
{
  "positionSec": 150
}
```

**Response:**

```json
{
  "success": true,
  "progress": {
    "audioId": "free-1",
    "positionSec": 150,
    "updatedAt": "2024-01-06T12:00:00.000Z"
  }
}
```

**Example:**

```bash
curl -X POST "http://localhost:3002/api/audio/free-1/progress?userId=USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"positionSec": 150}'
```

**Error Responses:**

- `401 Unauthorized` - User ID not provided
- `400 Bad Request` - Invalid positionSec value

---

### 5. Get Progress

Get the current listening progress for an audio.

**Endpoint:** `GET /api/audio/:id/progress`

**Parameters:**
- `id` (path) - Audio identifier
- `userId` (query, required) - User ID

**Response:**

If progress exists:
```json
{
  "success": true,
  "progress": {
    "audioId": "free-1",
    "positionSec": 150,
    "updatedAt": "2024-01-06T12:00:00.000Z"
  }
}
```

If no progress exists:
```json
{
  "success": true,
  "progress": {
    "audioId": "free-1",
    "positionSec": 0,
    "updatedAt": null
  }
}
```

**Example:**

```bash
curl "http://localhost:3002/api/audio/free-1/progress?userId=USER_ID"
```

**Error Responses:**

- `401 Unauthorized` - User ID not provided

---

### 6. Protected Stream (Internal)

Stream protected audio files with access control.

**Endpoint:** `GET /media/stream/:id`

**Parameters:**
- `id` (path) - Audio identifier
- `userId` (query, required) - User ID for access check

**Response:**

For authorized requests, the response is the audio file stream with headers:
- `X-Accel-Redirect: /media-protected/{id}.mp3` (for Nginx)
- `Content-Type: audio/mpeg`
- `Accept-Ranges: bytes`

**Example:**

```bash
curl "http://localhost:3002/media/stream/premium-1?userId=USER_ID" -o audio.mp3
```

**Error Responses:**

- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Audio not found

---

## Data Models

### Audio Metadata

```typescript
{
  id: string,              // Unique audio identifier
  title: string,           // Audio title
  author: string,          // Author name
  description: string,     // Description
  durationSec: number,     // Duration in seconds
  coverUrl: string,        // Cover image URL
  audioUrl: string,        // Audio file URL
  isFree: boolean,         // Whether audio is free
  unlocked?: boolean       // User's unlock status (optional)
}
```

### Progress

```typescript
{
  audioId: string,         // Audio identifier
  positionSec: number,     // Current position in seconds
  updatedAt: Date          // Last update timestamp
}
```

## Access Control

### Free Audio

- Audio IDs starting with "free-" are always accessible
- No entitlement check required
- Served directly from `/media/free/` directory

### Premium Audio

- Requires user entitlement
- Access checked via `entitlementService.hasAudioAccess(userId, audioId)`
- Served via protected endpoint with X-Accel-Redirect

### Granting Access

Access can be granted programmatically:

```javascript
const { grantAudio } = require('./services/access/entitlementService');

// Grant permanent access
await grantAudio(userId, 'premium-1', {
  grantedBy: 'purchase',
  metadata: { purchaseId: 'xxx' }
});

// Grant temporary access (expires in 30 days)
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30);

await grantAudio(userId, 'premium-1', {
  expiresAt,
  grantedBy: 'subscription',
  metadata: { subscriptionId: 'xxx' }
});
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional detailed error information"
}
```

## Rate Limiting

Consider implementing rate limiting for production:

```javascript
const rateLimit = require('express-rate-limit');

const audioLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/audio', audioLimiter, audioRoutes);
```

## Client Integration Example

### JavaScript/TypeScript

```javascript
class AudioService {
  constructor(apiUrl, userId) {
    this.apiUrl = apiUrl;
    this.userId = userId;
  }

  async listFreeAudios() {
    const response = await fetch(`${this.apiUrl}/api/audio/free`);
    return response.json();
  }

  async getAudioMetadata(audioId) {
    const response = await fetch(
      `${this.apiUrl}/api/audio/${audioId}?userId=${this.userId}`
    );
    return response.json();
  }

  async getStreamUrl(audioId) {
    const response = await fetch(
      `${this.apiUrl}/api/audio/${audioId}/stream-url?userId=${this.userId}`
    );
    const data = await response.json();
    return data.url;
  }

  async updateProgress(audioId, positionSec) {
    const response = await fetch(
      `${this.apiUrl}/api/audio/${audioId}/progress?userId=${this.userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionSec })
      }
    );
    return response.json();
  }

  async getProgress(audioId) {
    const response = await fetch(
      `${this.apiUrl}/api/audio/${audioId}/progress?userId=${this.userId}`
    );
    return response.json();
  }
}

// Usage
const audioService = new AudioService('http://localhost:3002', 'USER_ID');

// List free audios
const { audios } = await audioService.listFreeAudios();

// Get stream URL
const streamUrl = await audioService.getStreamUrl('free-1');

// Play audio with progress tracking
const audio = new Audio(streamUrl);
audio.addEventListener('timeupdate', async () => {
  await audioService.updateProgress('free-1', Math.floor(audio.currentTime));
});
audio.play();
```

## Future Enhancements

1. **Packages & Subscriptions**: Support for package-based and subscription-based access
2. **Download Limits**: Track and limit number of downloads per user
3. **Analytics**: Track listening time, completion rates, etc.
4. **Offline Support**: Generate temporary download tokens
5. **Quality Levels**: Support multiple quality levels (128kbps, 256kbps, etc.)

---

## Gamification & Badges

### Alice Badge ("Алиса в стране чудес")

The Alice badge is a gamification feature that grants 30-day access to the "Alice in Wonderland" audio analysis upon completion of specific requirements.

#### Requirements

Users must complete all of the following:

1. **10 photos** in the "книжный кадр" (book frame) rubric
2. **5 follows** (subscriptions to other users)
3. **10 likes** given to quotes authored by other users
4. **30-day continuous streak** - at least one activity per day for 30 consecutive days
   - Activity types: photo posted, quote saved, like given, follow

#### Get Progress

**Endpoint:** `GET /api/reader/gamification/progress/alice`

**Authentication:** Required (telegramAuth)

**Response:**

```json
{
  "success": true,
  "progress": {
    "photos": { "current": 8, "required": 10 },
    "following": { "current": 5, "required": 5 },
    "likesGivenToOthers": { "current": 12, "required": 10 },
    "streak": { "current": 25, "required": 30 },
    "completed": false,
    "percent": 83
  }
}
```

**Example:**

```bash
curl "http://localhost:3002/api/reader/gamification/progress/alice" \
  -H "Authorization: tma TELEGRAM_INIT_DATA"
```

#### Claim Badge

**Endpoint:** `POST /api/reader/gamification/alice/claim`

**Authentication:** Required (telegramAuth)

**Response:**

Success (first time):
```json
{
  "success": true,
  "message": "Badge claimed successfully",
  "expiresAt": "2026-03-07T18:00:00.000Z"
}
```

Success (already claimed):
```json
{
  "success": true,
  "message": "Badge already claimed",
  "alreadyClaimed": true
}
```

Failure (requirements not met):
```json
{
  "success": false,
  "error": "Requirements not met",
  "progress": { ... }
}
```

**Example:**

```bash
curl -X POST "http://localhost:3002/api/reader/gamification/alice/claim" \
  -H "Authorization: tma TELEGRAM_INIT_DATA"
```

#### Access to Alice Audio

After claiming the badge:
- User receives a 30-day entitlement to `alice_wonderland` audio
- The entitlement is tracked in the UserEntitlement collection
- Progress is idempotent - claiming multiple times doesn't extend or duplicate the entitlement
- Audio metadata endpoint will show `unlocked: true` and `remainingDays: N`

#### Profile Badges

User profiles include a `badges` array that contains claimed badge identifiers:

**Endpoint:** `GET /api/reader/profile` or `GET /api/reader/users/:id`

**Response includes:**
```json
{
  "success": true,
  "user": {
    "userId": "123456",
    "name": "Test User",
    ...
    "badges": ["alice_badge"]
  }
}
```

The frontend can use this array to render badge icons under avatars and next to usernames.
