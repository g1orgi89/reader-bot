# CORS Testing Guide for Shrooms Support Bot

## Quick Start

1. **Make sure the server is running:**
   ```bash
   git pull
   npm start
   ```

2. **Open the CORS test page in your browser:**
   ```
   http://localhost:3000/test-cors
   ```

## Test Features

The CORS test page includes comprehensive testing capabilities:

### 🔓 Public Endpoints
- **Health Check**: Tests the `/api/health` endpoint
- **Chat Message**: Tests POST requests to `/api/chat/message` with CORS headers

### 🔐 Admin Authentication
- Tests Basic Authentication with configurable credentials
- Default credentials: `admin` / `password123`
- Tests both GET and POST admin endpoints

### 📊 Rate Limiting
- Sends 10 rapid requests to test rate limiting
- Should show 429 errors after hitting the limit

### 🌐 CORS Testing
- **Preflight Tests**: Checks OPTIONS requests with custom headers
- **Credentials Tests**: Tests requests with authentication and CORS

## Expected Results

✅ **Success scenarios:**
- Health check returns 200 with service status
- Chat messages work with proper CORS headers
- Admin endpoints work with correct credentials
- Rate limiting kicks in after multiple requests

❌ **Expected "failures" (by design):**
- Admin endpoints return 401 without credentials
- Rate limiting returns 429 after threshold

## Security Verification

The tests verify that:
1. CORS headers are properly set
2. Authentication is required for admin endpoints
3. Rate limiting is protecting against abuse
4. All endpoints handle errors gracefully

## Troubleshooting

If the page doesn't load:
1. Check that the server is running on port 3000
2. Verify no browser cache issues (Ctrl/Cmd + F5)
3. Check browser console for any JavaScript errors

## Advanced Testing

Use the browser's Network tab to see:
- Request/response headers
- CORS preflight requests
- Rate limiting headers (`X-RateLimit-*`)
- Authentication headers

The test page provides a complete dashboard for validating the Shrooms Support Bot's security, CORS, and API functionality! 🍄