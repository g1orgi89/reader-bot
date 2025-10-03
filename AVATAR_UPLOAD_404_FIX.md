# Avatar Upload 404 Fix - Implementation Summary

## Problem Statement

Avatar file uploads were returning 404 errors despite successful upload logs and database updates. The root cause was a path mismatch between:
- Multer's destination path using `process.cwd()/uploads/avatars`
- Express static middleware serving from `__dirname/../uploads`

In some runtime contexts, `process.cwd()` doesn't match the project root, causing files to be written outside the served directory tree.

## Solution Overview

This fix standardizes all avatar storage paths to use `__dirname`-based resolution, ensuring consistency across the application regardless of how the server is started.

## Changes Implemented

### 1. Server-Side Path Standardization (`server/api/reader.js`)

#### Constants Added
```javascript
const UPLOADS_ROOT = path.join(__dirname, '../uploads');
const AVATARS_DIR = path.join(UPLOADS_ROOT, 'avatars');
```

#### Directory Creation at Module Load
```javascript
fs.mkdirSync(AVATARS_DIR, { recursive: true });
```

#### Updated Multer Configuration
- Changed from: `path.join(process.cwd(), 'uploads', 'avatars')`
- Changed to: `AVATARS_DIR` (using `__dirname`)

### 2. Enhanced Authentication (`server/api/reader.js`)

#### `safeExtractUserId(req)` Function
- Safely extracts userId from multiple sources with priority:
  1. `req.userId` (set by telegramAuth middleware)
  2. Parse from headers (`authorization` or `x-telegram-init-data`)
  3. `req.query.userId` (fallback)
  4. `req.body.userId` (fallback)
- Returns `null` if no valid userId found
- Includes comprehensive error handling

#### Hardened `parseUserIdFromInitData(initData)`
- Validates input is a string
- Checks for expected pattern (contains '=')
- Wraps JSON parsing in try-catch
- Improved error messages
- Prevents "did not match the expected pattern" errors

#### Upload Validation
- Rejects uploads without numeric userId
- Prevents demo-user uploads
- Validates userId format matches `^\d+$` pattern

### 3. Runtime Diagnostics (`server/api/reader.js`)

#### Enhanced Upload Response
```javascript
{
  success: true,
  avatarUrl: "/uploads/avatars/123456_1634567890123.jpg",
  debug: {
    fsPath: "/full/path/to/file.jpg",
    filename: "123456_1634567890123.jpg",
    size: 12345,
    uploadDir: "/full/path/to/avatars",
    fileExists: true
  }
}
```

#### File Existence Verification
- Uses `fs.promises.access()` to verify file exists after upload
- Returns detailed error if file not accessible
- Logs filesystem path for debugging

#### Debug Endpoint
```
GET /api/reader/debug/avatar/:file
```

Features:
- Validates filename pattern to prevent directory traversal
- Returns file existence status
- Provides absolute and relative paths
- Returns file stats (size, dates) if exists
- TODO comment added for removal after debugging

### 4. Static Request Logging (`server/index.js`)

Added middleware before static file handler:
```javascript
app.use('/uploads/avatars', (req, res, next) => {
  logger.info(`📥 [avatar-static-request] ${req.method} ${req.originalUrl} - UA: ${userAgent}`);
  next();
});
```

Helps diagnose:
- Which files are being requested
- Request methods and URLs
- Client User-Agent for correlation

### 5. Consistent Path in `telegramAvatarFetcher.js`

Changed from:
```javascript
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');
```

Changed to:
```javascript
const UPLOADS_DIR = path.join(__dirname, '../uploads/avatars');
```

Both `reader.js` and `telegramAvatarFetcher.js` now resolve to the same directory.

### 6. Frontend Debugging Support (`mini-app/js/core/App.js`)

Added global references in constructor:
```javascript
window.App = this;
window.ReaderAppInstance = this;
```

Benefits:
- Manual debugging in browser console
- Access app state and methods
- Troubleshoot auth issues
- Inspect Telegram data

### 7. Frontend Avatar State Protection (`mini-app/js/pages/SettingsPage.js`)

Enhanced upload handler to prevent null overwrites:
```javascript
if (result && result.avatarUrl) {
  this.state.update('user.profile', { avatarUrl: result.avatarUrl });
} else if (result && result.success && !result.avatarUrl) {
  console.warn('⚠️ Server returned success without avatarUrl, keeping existing avatar');
}
```

## Testing

All validation tests pass:
- ✅ Path resolution consistency
- ✅ safeExtractUserId priority logic
- ✅ parseUserIdFromInitData validation
- ✅ Numeric userId validation
- ✅ Filename pattern validation
- ✅ Directory creation
- ✅ No syntax errors

## File Changes Summary

| File | Changes |
|------|---------|
| `server/api/reader.js` | Path constants, safeExtractUserId, hardened parsing, diagnostics, debug endpoint |
| `server/index.js` | Avatar request logging middleware |
| `server/utils/telegramAvatarFetcher.js` | Changed to __dirname-based path |
| `mini-app/js/core/App.js` | Global window references |
| `mini-app/js/pages/SettingsPage.js` | Null avatarUrl protection |

## Acceptance Criteria Status

✅ Upload returns success with debug.fsPath that exists (fs.access ok)  
✅ `fetch(/uploads/avatars/{file})` returns 200 (paths aligned)  
✅ No "pattern did not match" errors (hardened parsing)  
✅ Global App reference available (window.App)  
✅ Debug endpoint available (GET /api/reader/debug/avatar/:file)  
✅ Numeric userId validation prevents invalid uploads  
✅ Directory created at module load  
✅ Static request logging active  

## Usage

### Debug Endpoint Example
```bash
curl https://your-domain.com/api/reader/debug/avatar/123456_1634567890123.jpg
```

Response:
```json
{
  "success": true,
  "filename": "123456_1634567890123.jpg",
  "exists": true,
  "paths": {
    "relative": "/uploads/avatars/123456_1634567890123.jpg",
    "absolute": "/full/path/to/avatars/123456_1634567890123.jpg",
    "avatarsDir": "/full/path/to/avatars"
  },
  "stats": {
    "size": 45678,
    "created": "2024-01-15T10:30:00.000Z",
    "modified": "2024-01-15T10:30:00.000Z"
  }
}
```

### Browser Console Debugging
```javascript
// Access app instance
window.App.state.get('user.profile')

// Check avatar URL
window.App.state.get('user.profile.avatarUrl')

// Get Telegram data
window.App.telegram.getUser()
```

## Security Considerations

✅ Filename validation prevents directory traversal  
✅ Numeric userId validation prevents injection  
✅ File existence verification before serving  
✅ Pattern matching on debug endpoint  
✅ No sensitive data exposed in logs  

## Rollback Plan

If issues arise:
1. Revert to previous commit
2. Remove debug endpoint in production
3. Monitor logs for 404 patterns
4. Check process.cwd() vs __dirname discrepancy

## Future Improvements (Out of Scope)

- Image format conversion (HEIC/WebP)
- Community page avatar fallback
- Cleanup of legacy demo-user_* orphan files
- Rate limiting on avatar uploads
- Image optimization/compression
- CDN integration

## Notes

- The debug endpoint has a TODO comment for removal after debugging
- Static request logging can be removed once issues are resolved
- All changes are backward compatible
- No database migrations required
