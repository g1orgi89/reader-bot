# Telegram Webhook 404 Fix

## Problem
The POST `/api/reader/telegram/webhook` endpoint was returning 404 (API endpoint not found) because the webhook handler was registered inside the async `startServer()` function, AFTER all other middleware and the 404 catch-all handler were already registered at module load time.

## Root Cause
Express.js processes middleware in the order they are registered. The 404 handler was registered at module load time (line 710), but the webhook handler was only registered later when `startServer()` was called. By that time, the middleware stack was already set, so the 404 handler would match before the webhook handler.

## Solution
Moved the webhook registration to happen at module load time, immediately after Express app creation and BEFORE all other middleware, including the 404 handler.

### Key Changes in `server/index.js`

**Before:**
```javascript
// Module load time - line ~410
const app = express();
// ... other middleware registered here ...
app.use(`${config.app.apiPrefix}/*`, (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' }); // Line 710
});

// Later, inside startServer() async function
async function startServer() {
  // ...
  await simpleBot.initialize();
  app.use(webhookPath, simpleBot.webhookCallback(webhookPath)); // Too late!
}
```

**After:**
```javascript
// Module load time - line ~420
const app = express();

// 🤖 Register webhook FIRST, before any other middleware - line ~430
let webhookHandler = null;
app.post('/api/reader/telegram/webhook', (req, res, next) => {
  if (webhookHandler) {
    return webhookHandler(req, res, next);
  } else {
    return res.status(200).json({ ok: true, description: 'Bot initializing' });
  }
});

// Initialize bot async (completes before server.listen())
botInitPromise = (async () => {
  await simpleBot.initialize();
  webhookHandler = simpleBot.webhookCallback(webhookPath);
})();

// ... other middleware registered after ...
app.use(`${config.app.apiPrefix}/*`, (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' }); // Line 710
});

// startServer() awaits bot initialization before listening
async function startServer() {
  await botInitPromise; // Wait for bot to be ready
  await server.listen(PORT); // Only then start accepting connections
}
```

## Verification
Run the verification script to confirm the fix:

```bash
node /tmp/verify-webhook-fix.js
```

Expected output:
```
✅ PASS: Webhook registered BEFORE 404 handler (line 430 < line 710)
✅ PASS: Bot initialization found
✅ PASS: Bot initialization happens before server.listen
✅ ALL CRITICAL CHECKS PASSED
```

## Testing
To test the webhook endpoint manually:

```bash
# Make sure ENABLE_SIMPLE_BOT=true and TELEGRAM_BOT_TOKEN is set
curl -X POST http://localhost:3002/api/reader/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"message_id":1,"from":{"id":123,"first_name":"Test"},"chat":{"id":123,"type":"private"},"date":1234567890,"text":"/start"}}'
```

Expected response: `200 OK` with Telegraf handling the request
NOT: `404 Not Found` with `{"error": "API endpoint not found"}`

## Benefits
1. **No more 404 errors** - Webhook route is registered first in middleware chain
2. **Proper initialization order** - Bot initializes before server accepts connections
3. **Graceful handling** - If a request arrives during initialization, returns 200 OK instead of 404
4. **Cached handler** - Webhook handler is created once and reused for better performance

## Implementation Details
- **Line 430**: Webhook route registered synchronously at module load time
- **Line 444**: Bot initialization starts async (IIFE)
- **Line 461**: Webhook handler cached once bot is ready
- **Line 710**: 404 handler registered (after webhook)
- **Line 737**: `startServer()` awaits bot initialization before `server.listen()`

This ensures the webhook is always available and never returns 404, even before the bot is fully initialized (it returns 200 OK with "Bot initializing" message in that case).
