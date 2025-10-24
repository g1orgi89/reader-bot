# Webhook Diagnostics Quick Reference Card

## 🔍 Quick Diagnostic Commands

### Check if webhooks are reaching the server
```bash
tail -f logs/combined.log | grep "WEBHOOK_HIT"
```

### Monitor incoming Telegram updates
```bash
tail -f logs/combined.log | grep "\[TG\]\[IN\]"
```

### Watch /start commands
```bash
tail -f logs/combined.log | grep "\[TG\]\[/start\]"
```

### Track errors only
```bash
tail -f logs/error.log
```

### Follow a specific user
```bash
tail -f logs/combined.log | grep "from=USER_ID"
```

## 🚦 Health Check Patterns

### ✅ Healthy Webhook
```
[WEBHOOK_HIT] → [WEBHOOK] Delegating → [TG][IN] → [TG][/start] → ✅ Reply sent
```
*All steps < 1 second total*

### ⚠️ Bot Initializing
```
[WEBHOOK_HIT] → ⚠️ [WEBHOOK] Request received during bot initialization
```
*Only during first 5-10 seconds of server startup*

### ❌ Not Reaching Server
```
(no logs)
```
*Check proxy/ingress configuration*

### ❌ Not Processed by Telegraf
```
[WEBHOOK_HIT] → (no [TG][IN])
```
*Check bot initialization and Telegraf configuration*

## 🧪 Test Commands

### Test primary webhook path
```bash
curl -X POST http://localhost:3002/api/reader/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"message_id":1,"from":{"id":111,"is_bot":false},"chat":{"id":111,"type":"private"},"date":1690000000,"text":"/start"}}'
```

### Test fallback path
```bash
curl -X POST http://localhost:3002/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id":2,"message":{"message_id":2,"from":{"id":111,"is_bot":false},"chat":{"id":111,"type":"private"},"date":1690000000,"text":"/help"}}'
```

### Check Telegram webhook info
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

## 📊 Expected Response Times

| Stage | Expected Time |
|-------|--------------|
| Webhook → Handler | < 5ms |
| Handler → Telegraf | < 5ms |
| Telegraf → Command | < 10ms |
| Command → Reply | 100-500ms |
| **Total** | **< 1 second** |

## 🎯 Supported Webhook Paths

All paths are functionally identical:

1. `/api/reader/telegram/webhook` ← Primary
2. `/reader/telegram/webhook`
3. `/api/telegram/webhook`
4. `/telegram/webhook`

*Use primary path in Telegram configuration*

## 🔧 Troubleshooting Steps

### 1. Verify Server Running
```bash
curl http://localhost:3002/api/health
```
Expected: `200 OK`

### 2. Check Bot Initialization
```bash
grep "Simple Telegram Bot" logs/combined.log | tail -5
```
Expected:
```
✅ Simple Telegram Bot instance created
✅ Simple Telegram Bot handlers initialized
✅ Webhook handler cached and ready
```

### 3. Verify Webhook Registration
```bash
grep "Webhook route registered" logs/combined.log | tail -5
```
Expected: 4 lines (one for each path)

### 4. Check Telegram Configuration
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo | jq .
```
Expected:
```json
{
  "ok": true,
  "result": {
    "url": "https://app.unibotz.com/api/reader/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0
  }
}
```

## 📋 Log Format Reference

### Webhook Hit
```
>>> [WEBHOOK_HIT] POST /path | Path: /path | X-Forwarded-For: IP | X-Real-IP: IP | UA: agent | Content-Type: type | Body: {...}
```

### Telegraf Update
```
[TG][IN] update_id=ID type=TYPE chat=CHAT_ID from=FROM_ID text/data="TEXT"
```

### /start Command
```
[TG][/start] update_id=ID chat=CHAT_ID from=FROM_ID username=USERNAME
[TG][/start] ✅ Reply sent successfully to user FROM_ID
```

### API 404
```
❌ [API_404] METHOD URL | Path: PATH | From: IP
```

## 🚨 Alert Conditions

### Critical: No webhooks for > 5 minutes
```bash
# Check last webhook timestamp
grep "WEBHOOK_HIT" logs/combined.log | tail -1
```

### Warning: High error rate (> 10%)
```bash
# Count errors in last 100 updates
grep "\[TG\]\[IN\]" logs/combined.log | tail -100 | wc -l
grep "❌" logs/combined.log | tail -100 | wc -l
```

### Warning: Slow responses (> 2 seconds)
```bash
# Check for delays in logs
grep "\[TG\]\[/start\]" logs/combined.log | tail -20
```

## 🔐 Security Notes

- User IDs are logged (not PII)
- Usernames logged (public information)
- Body limited to 200 chars
- No passwords or tokens logged
- Headers logged for routing diagnosis

## 📞 Support Checklist

When reporting webhook issues, include:

1. Last [WEBHOOK_HIT] timestamp
2. Last [TG][IN] timestamp
3. Telegram webhook info output
4. Server uptime
5. Recent error logs
6. Network/proxy configuration

## 🎓 Resources

- Full guide: `WEBHOOK_DIAGNOSTICS.md`
- Log examples: `WEBHOOK_LOG_EXAMPLES.md`
- Tests: `test-webhook-diagnostics.js`, `test-bot-diagnostics.js`
