# Webhook Diagnostic Log Examples

This document provides real-world examples of the diagnostic logs produced by the webhook system.

## Normal Operation

### Successful /start Command

```
[2024-01-15 10:30:45.123Z] [INFO] >>> [WEBHOOK_HIT] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | X-Forwarded-For: 149.154.167.197 | X-Real-IP: 149.154.167.197 | UA: TelegramBot (like TwitterBot) | Content-Type: application/json | Body: {"update_id":987654321,"message":{"message_id":42,"from":{"id":12345,"is_bot":false,"first_name":"John","username":"johndoe"}...

[2024-01-15 10:30:45.125Z] [INFO] [WEBHOOK] Delegating to Telegraf handler for /api/reader/telegram/webhook

[2024-01-15 10:30:45.127Z] [INFO] [TG][IN] update_id=987654321 type=message chat=12345 from=12345 text/data="/start"

[2024-01-15 10:30:45.128Z] [INFO] [TG][/start] update_id=987654321 chat=12345 from=12345 username=johndoe

[2024-01-15 10:30:45.250Z] [INFO] [TG][/start] ✅ Reply sent successfully to user 12345
```

### Regular Text Message

```
[2024-01-15 10:31:20.456Z] [INFO] >>> [WEBHOOK_HIT] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | X-Forwarded-For: 149.154.167.198 | X-Real-IP: 149.154.167.198 | UA: TelegramBot (like TwitterBot) | Content-Type: application/json | Body: {"update_id":987654322,"message":{"message_id":43,"from":{"id":12345,"is_bot":false,"first_name":"John"},"chat":{"id":12345,"type":"private"},"date":1705318280,"text":"Hello"}...

[2024-01-15 10:31:20.458Z] [INFO] [WEBHOOK] Delegating to Telegraf handler for /api/reader/telegram/webhook

[2024-01-15 10:31:20.460Z] [INFO] [TG][IN] update_id=987654322 type=message chat=12345 from=12345 text/data="Hello"

[2024-01-15 10:31:20.580Z] [INFO] 🤖 Text message handled for user 12345
```

### Callback Query

```
[2024-01-15 10:32:15.789Z] [INFO] >>> [WEBHOOK_HIT] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | X-Forwarded-For: 149.154.167.199 | X-Real-IP: 149.154.167.199 | UA: TelegramBot (like TwitterBot) | Content-Type: application/json | Body: {"update_id":987654323,"callback_query":{"id":"123456789","from":{"id":12345,"username":"johndoe"},"message":{"chat":{"id":12345}},"data":"btn_action"}...

[2024-01-15 10:32:15.791Z] [INFO] [WEBHOOK] Delegating to Telegraf handler for /api/reader/telegram/webhook

[2024-01-15 10:32:15.793Z] [INFO] [TG][IN] update_id=987654323 type=callback_query chat=12345 from=12345 text/data="btn_action"
```

## Fallback Path Used

When a proxy rewrites the path, one of the fallback paths handles it:

```
[2024-01-15 10:35:00.123Z] [INFO] >>> [WEBHOOK_HIT] POST /telegram/webhook | Path: /telegram/webhook | X-Forwarded-For: 149.154.167.197 | X-Real-IP: 149.154.167.197 | UA: TelegramBot (like TwitterBot) | Content-Type: application/json | Body: {"update_id":987654324,"message":{"message_id":44,"from":{"id":12345},"chat":{"id":12345},"text":"/start"}...

[2024-01-15 10:35:00.125Z] [INFO] [WEBHOOK] Delegating to Telegraf handler for /telegram/webhook

[2024-01-15 10:35:00.127Z] [INFO] [TG][IN] update_id=987654324 type=message chat=12345 from=12345 text/data="/start"
```

## Bot Initialization

During server startup, if a webhook arrives before bot is ready:

```
[2024-01-15 10:00:05.123Z] [INFO] >>> [WEBHOOK_HIT] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | X-Forwarded-For: 149.154.167.197 | X-Real-IP: 149.154.167.197 | UA: TelegramBot (like TwitterBot) | Content-Type: application/json | Body: {"update_id":987654320,"message":{"message_id":40,"from":{"id":12345},"chat":{"id":12345},"text":"/start"}...

[2024-01-15 10:00:05.125Z] [WARN] ⚠️ [WEBHOOK] Request received during bot initialization for /api/reader/telegram/webhook
```

Note: This state only exists for a few seconds during server startup. The webhook returns 200 OK with "Bot initializing, please retry" so Telegram doesn't mark it as an error.

## Error Scenarios

### /start Command Error

```
[2024-01-15 10:40:00.123Z] [INFO] >>> [WEBHOOK_HIT] POST /api/reader/telegram/webhook | Path: /api/reader/telegram/webhook | X-Forwarded-For: 149.154.167.197 | X-Real-IP: 149.154.167.197 | UA: TelegramBot (like TwitterBot) | Content-Type: application/json | Body: {"update_id":987654325,"message":{"message_id":45,"from":{"id":12345},"chat":{"id":12345},"text":"/start"}...

[2024-01-15 10:40:00.125Z] [INFO] [WEBHOOK] Delegating to Telegraf handler for /api/reader/telegram/webhook

[2024-01-15 10:40:00.127Z] [INFO] [TG][IN] update_id=987654325 type=message chat=12345 from=12345 text/data="/start"

[2024-01-15 10:40:00.128Z] [INFO] [TG][/start] update_id=987654325 chat=12345 from=12345 username=johndoe

[2024-01-15 10:40:00.150Z] [ERROR] [TG][/start] ❌ Error: Network timeout | user=12345
```

### API 404 - Wrong Path

If a request hits the wrong API path (not a webhook path):

```
[2024-01-15 10:45:00.123Z] [WARN] ❌ [API_404] POST /api/reader/wrong/path | Path: /api/reader/wrong/path | From: 149.154.167.197
```

This indicates the request is reaching the server but hitting the wrong endpoint.

### No [WEBHOOK_HIT] - Request Not Reaching Server

If Telegram Bot API shows 404 errors but there are NO `[WEBHOOK_HIT]` logs:

```
(no logs at all)
```

This indicates:
- Request is not reaching the Node.js process
- Proxy/ingress is returning 404 before reaching the application
- Wrong URL configured in Telegram webhook settings
- Firewall/network issue

Check:
1. Telegram webhook info: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Proxy/ingress configuration
3. Network connectivity

## Log Patterns to Watch For

### ✅ Healthy Pattern

```
[WEBHOOK_HIT] → [WEBHOOK] Delegating → [TG][IN] → [TG][/start] → ✅ Reply sent
```

Time between steps should be < 1 second total.

### ⚠️ Slow Processing

```
[WEBHOOK_HIT] → [WEBHOOK] Delegating → [TG][IN] → [TG][/start] → ✅ Reply sent (5 seconds later)
```

If reply takes > 2 seconds, investigate:
- Database slowness
- Network issues
- Heavy processing in handlers

### ❌ Missing Steps

```
[WEBHOOK_HIT] → (no further logs)
```

Indicates Telegraf is not processing the update. Check:
- Bot initialization
- Telegraf configuration
- Update format

### ❌ Handler Errors

```
[WEBHOOK_HIT] → [TG][IN] → [TG][/start] → ❌ Error
```

Command received but handler failed. Check error message for details.

## Filtering Logs

### See only webhook hits
```bash
grep "WEBHOOK_HIT" logs/combined.log
```

### See only Telegram updates
```bash
grep "\[TG\]\[IN\]" logs/combined.log
```

### See only /start commands
```bash
grep "\[TG\]\[/start\]" logs/combined.log
```

### See only errors
```bash
grep "❌" logs/combined.log
```

### Track specific user
```bash
grep "from=12345" logs/combined.log
```

### Track specific update
```bash
grep "update_id=987654321" logs/combined.log
```

## Performance Metrics

Normal webhook processing times:

| Step | Expected Time |
|------|--------------|
| Webhook arrival → Handler delegation | < 5ms |
| Handler delegation → Telegraf IN | < 5ms |
| Telegraf IN → Command handler | < 10ms |
| Command handler → Reply sent | 100-500ms |
| **Total** | **< 1 second** |

If any step consistently exceeds expected time, investigate that component.
