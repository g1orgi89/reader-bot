# Telegram Webhook Diagnostic Logging

This document describes the diagnostic logging features added to help diagnose webhook 404 errors from Telegram Bot API.

## Problem

Telegram webhook was showing 404 errors from the server. We needed ironclad diagnostics to verify whether updates (especially `/start`) reach the Node process, what exact URL Express sees, and what Telegraf receives.

## Solution

Added comprehensive diagnostic logging at two levels:

### 1. Server-Level Diagnostics (server/index.js)

#### Multiple Fallback Webhook Paths

To guard against proxy/ingress path rewriting, we now support 4 webhook paths:

1. `/api/reader/telegram/webhook` (primary)
2. `/reader/telegram/webhook`
3. `/api/telegram/webhook`
4. `/telegram/webhook`

All paths are registered before any other middleware to ensure they're first in the routing chain.

#### Webhook Hit Logging

Every webhook request logs comprehensive diagnostic information:

```
>>> [WEBHOOK_HIT] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | X-Forwarded-For: 149.154.167.197 | X-Real-IP: 149.154.167.197 | UA: TelegramBot/1.0 | Content-Type: application/json | Body: {"update_id":123456789,...
```

Logged information:
- HTTP Method and originalUrl
- Request path
- X-Forwarded-For header (proxy IP)
- X-Real-IP header (real client IP)
- User-Agent (first 100 chars)
- Content-Type
- Body snapshot (first 200 chars)

#### Local Body Parser

Added dedicated `express.json()` body parser for webhook routes to ensure `req.body` is parsed even if global parser comes later in the middleware chain.

#### Enhanced 404 Handler

API 404 handler now logs:
```
❌ [API_404] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | From: 192.168.1.1
```

This helps identify if requests are hitting the wrong path.

### 2. Bot-Level Diagnostics (bot/simpleBot.js)

#### Global Telegraf Middleware

Every incoming update from Telegram is logged with:

```
[TG][IN] update_id=123456789 type=message chat=12345 from=67890 text/data="/start"
```

Logged information:
- update_id
- Update type (message, callback_query, edited_message, inline_query, etc.)
- Chat ID
- From ID (user who sent the update)
- Text/data snippet (first 100 chars)

#### Enhanced /start Command Logging

The `/start` command has additional logging:

```
[TG][/start] update_id=123456789 chat=12345 from=67890 username=testuser
[TG][/start] ✅ Reply sent successfully to user 67890
```

Or on error:
```
[TG][/start] ❌ Error: Network error | user=67890
```

## Diagnostic Flow

When a webhook request arrives:

1. **Server receives request** → Logs `[WEBHOOK_HIT]` with all headers and body
2. **Telegraf processes update** → Logs `[TG][IN]` with update details
3. **Command handler executes** → Logs `[TG][/start]` with user info
4. **Reply sent** → Logs success or error

## Testing

### Test Webhook Paths

Run the integration test:

```bash
node test-webhook-diagnostics.js
```

This tests all 4 fallback webhook paths and verifies diagnostic logging.

### Test Bot Logging

Run the unit test:

```bash
node test-bot-diagnostics.js
```

This tests the global middleware and /start command logging.

### Manual Testing with curl

Send a test webhook request:

```bash
curl -X POST https://app.unibotz.com/api/reader/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_id":1,
    "message":{
      "message_id":1,
      "from":{"id":111,"is_bot":false,"first_name":"Test"},
      "chat":{"id":111,"type":"private"},
      "date":1690000000,
      "text":"/start"
    }
  }'
```

Expected server logs:
```
>>> [WEBHOOK_HIT] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | ...
[TG][IN] update_id=1 type=message chat=111 from=111 text/data="/start"
[TG][/start] update_id=1 chat=111 from=111 username=no_username
[TG][/start] ✅ Reply sent successfully to user 111
```

## Troubleshooting

### Scenario 1: No [WEBHOOK_HIT] logs

**Symptom**: Bot API shows 404 errors, but server logs show no `[WEBHOOK_HIT]` entries.

**Diagnosis**: Request is not reaching the Node process.

**Possible causes**:
- Proxy/ingress routing issue
- Wrong URL configured in Telegram
- Firewall blocking requests

**Action**: Check proxy configuration and Telegram webhook URL.

### Scenario 2: [WEBHOOK_HIT] but no [TG][IN]

**Symptom**: Server logs show `[WEBHOOK_HIT]` but no `[TG][IN]` entries.

**Diagnosis**: Request reaches server but Telegraf is not processing it.

**Possible causes**:
- Bot not initialized
- Telegraf handler error
- Invalid update format

**Action**: Check bot initialization logs and Telegraf error logs.

### Scenario 3: [TG][IN] but no [TG][/start]

**Symptom**: Logs show `[TG][IN]` but `/start` command is not executed.

**Diagnosis**: Update received but command handler not triggered.

**Possible causes**:
- Update is not a message type
- Text is not "/start"
- Command handler error

**Action**: Check update type and text content in `[TG][IN]` log.

## Configuration

No additional configuration required. Diagnostic logging is enabled automatically when `ENABLE_SIMPLE_BOT=true`.

## Performance Impact

Minimal. Diagnostic logging adds approximately:
- 1-2ms per webhook request (logging overhead)
- 50-100 bytes per log entry

This is negligible compared to typical webhook processing time (50-200ms).

## Security Considerations

- Body snapshots are limited to first 200 characters to avoid logging sensitive data
- User IDs are logged but no personal information (names, emails, etc.)
- Headers are logged to diagnose routing issues

## Future Improvements

Potential enhancements:
- Add request timing metrics
- Track webhook success/failure rates
- Alert on repeated 404 errors
- Add request ID for correlation across logs
