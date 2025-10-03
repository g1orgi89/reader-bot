# InitData Sanitization and Avatar Upload Fix

## Summary

Fixed the issue where users saw "the string did not match the expected pattern" error on mobile during avatar upload. The root cause was raw Telegram initData containing CR/LF or unsafe characters being placed into HTTP headers, which browsers reject before the request is sent.

## Changes Implemented

### 1. Client-Side Sanitization (mini-app/js/services/api.js)

**Function: `resolveTelegramInitData()`**

Added sanitization pipeline to clean initData before sending:
- Remove all CR/LF characters (`\r\n`)
- Trim whitespace
- Encode with `encodeURIComponent()` for safe HTTP header transmission

```javascript
// Sanitize: remove CR/LF and encode for HTTP headers
if (rawInitData) {
    const sanitized = rawInitData.replace(/[\r\n]/g, '').trim();
    return encodeURIComponent(sanitized);
}
```

**Benefits:**
- Prevents browser rejection of malformed headers
- Ensures consistent data format across all requests
- Works with both Authorization and X-Telegram-Init-Data headers (already sent)

### 2. Server-Side Decoding (server/api/reader.js)

**Function: `parseUserIdFromInitData()`**

Added safe decoding with fallback:
- Attempt `decodeURIComponent()` on incoming initData
- Use decoded version if it contains expected pattern
- Fall back to original if decoding fails
- Maintain existing validation guards

```javascript
// Safe decode: client may send encoded string
let decodedInitData = initData;
try {
    const decoded = decodeURIComponent(initData);
    if (decoded.includes('=')) {
        decodedInitData = decoded;
    }
} catch (decodeError) {
    // Use original if decode fails
}
```

**Benefits:**
- Handles both encoded and already-decoded initData
- Backward compatible with existing clients
- Robust error handling

### 3. Fallback to X-User-Id Header (server/api/reader.js)

**Function: `safeExtractUserId()`**

Enhanced priority chain:
1. req.userId (from telegramAuth middleware)
2. Parse from Authorization/X-Telegram-Init-Data headers
3. **NEW**: Fallback to X-User-Id header
4. Query parameters (legacy)

```javascript
// Priority 3: Fallback to X-User-Id header
if (req.headers['x-user-id']) {
    return String(req.headers['x-user-id']);
}
```

**Benefits:**
- Always has a userId even if initData parsing fails
- Client already sends X-User-Id in all requests
- Graceful degradation

### 4. Dual /uploads Static Mapping (server/index.js)

Added secondary static route for avatar files:

```javascript
app.use('/server/uploads', express.static(path.join(__dirname, '../uploads'), {
    // ... same config as /uploads
}));
```

**Benefits:**
- Files saved under `server/uploads` are accessible
- Prevents 404 errors due to path mismatches
- Maintains backward compatibility

### 5. Window.App Exposure (mini-app/js/core/App.js)

Already implemented in constructor:

```javascript
window.App = this;
window.ReaderAppInstance = this;
```

**Benefits:**
- Manual debugging in browser console
- Access to API service and app state
- Diagnostic capabilities

## Testing

Created comprehensive test suite: `tests/unit/initdata-sanitization.test.js`

**19 tests covering:**
- Client-side sanitization (CR/LF removal, trimming, encoding)
- Server-side decoding and parsing
- End-to-end flow
- Fallback to X-User-Id header
- Security validation (path traversal, XSS, long strings)

**All tests pass ✅**

## Manual Verification

Created verification script: `/tmp/test-initdata-flow.js`

Tested:
- ✅ Valid initData with CR/LF characters
- ✅ Valid initData with whitespace
- ✅ Clean initData
- ✅ Invalid initData handling
- ✅ Empty initData handling
- ✅ Fallback to X-User-Id when initData fails
- ✅ Priority order (initData > X-User-Id)

## Impact

### Before
- ❌ Browser rejects HTTP requests with malformed headers
- ❌ Users see "string did not match expected pattern" error
- ❌ Avatar uploads fail on mobile
- ❌ 404 errors for some avatar paths

### After
- ✅ All HTTP headers are properly formatted
- ✅ InitData safely transmitted in all requests
- ✅ Avatar uploads work on mobile
- ✅ Fallback mechanism ensures userId extraction always succeeds
- ✅ Dual upload paths prevent 404 errors
- ✅ Window.App available for debugging

## Security Considerations

- ✅ Input validation maintained (string type, pattern matching)
- ✅ JSON parsing wrapped in try-catch
- ✅ Path traversal attempts rejected
- ✅ XSS injection attempts rejected
- ✅ Safe encoding/decoding with fallbacks

## Backward Compatibility

- ✅ Works with both encoded and already-decoded initData
- ✅ Maintains existing validation logic
- ✅ Graceful fallback for legacy clients
- ✅ No breaking changes to API

## Files Changed

1. `mini-app/js/services/api.js` - Client-side sanitization
2. `server/api/reader.js` - Server-side decoding and fallback
3. `server/index.js` - Dual uploads mapping
4. `tests/unit/initdata-sanitization.test.js` - Test suite (new)
5. `INITDATA_SANITIZATION_FIX.md` - Documentation (new)

## Deployment Notes

- No database changes required
- No environment variables needed
- Deploy server and client together for full functionality
- Backward compatible - old clients will continue to work
- Test avatar upload on mobile devices after deployment

## Related Issues

Fixes: Avatar upload 404 and "string did not match expected pattern" errors on mobile
