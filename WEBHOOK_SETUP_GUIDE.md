# Telegram Bot Webhook Setup Guide

## Overview

The Simple Telegram Bot now runs in **webhook mode** instead of polling mode. This provides a production-ready architecture with better performance and scalability.

## Architecture Changes

### Before (Polling Mode)
- Bot ran as a separate process using `bot/start.js`
- Continuously polled Telegram API for updates
- ReminderService and cron jobs ran in bot process
- Required separate deployment

### After (Webhook Mode)
- Bot integrated into main server (`server/index.js`)
- Telegram sends updates directly to webhook endpoint
- ReminderService and cron jobs run in main server process
- Single deployment with unified process

## Configuration

### Required Environment Variables

Add these to your `.env` file:

```bash
# Telegram Bot Token (required)
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Enable Simple Bot (required for bot to start)
ENABLE_SIMPLE_BOT=true

# Webhook URL (required for production webhook mode)
# This should be your public HTTPS URL
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook

# Webhook Path (optional, default: /api/telegram/webhook)
TELEGRAM_WEBHOOK_PATH=/api/telegram/webhook

# Mini App URL (optional)
APP_WEBAPP_URL=https://app.unibotz.com/mini-app/

# Enable Reminder Cron Jobs (optional, default: true)
ENABLE_REMINDER_CRON=true
```

## Setup Instructions

### 1. Get Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Create a new bot or use existing one: `/newbot` or `/mybots`
3. Copy the bot token

### 2. Configure Webhook URL

Your webhook URL must:
- Use HTTPS (required by Telegram)
- Be publicly accessible
- Point to your server's webhook endpoint

Example: `https://yourdomain.com/api/telegram/webhook`

### 3. Update Environment Variables

```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
ENABLE_SIMPLE_BOT=true
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
```

### 4. Start Server

```bash
npm start
```

The server will:
1. Initialize the bot
2. Register webhook endpoint at `/api/telegram/webhook`
3. Set webhook URL with Telegram API
4. Initialize ReminderService
5. Start reminder cron jobs

### 5. Verify Webhook

Check server logs for:
```
✅ Simple Telegram Bot initialized
🔗 Setting up webhook at /api/telegram/webhook
✅ Webhook configured
✅ Simple Telegram Bot started in WEBHOOK mode
```

## Development Mode

For local development without public HTTPS:

1. Leave `TELEGRAM_WEBHOOK_URL` empty in `.env`
2. The bot will not start (webhook mode required)
3. Use tools like [ngrok](https://ngrok.com/) to expose local server:
   ```bash
   ngrok http 3002
   ```
4. Set `TELEGRAM_WEBHOOK_URL` to ngrok URL:
   ```bash
   TELEGRAM_WEBHOOK_URL=https://your-ngrok-id.ngrok.io/api/telegram/webhook
   ```

## Features

### Webhook Endpoint
- **Path**: `/api/telegram/webhook` (configurable)
- **Method**: POST
- **Handled by**: Telegraf's webhookCallback

### ReminderService Integration
- Initialized with bot instance
- Available globally as `global.reminderService`
- Sends notifications through bot

### Cron Jobs
Three reminder slots (Moscow timezone):
- **Morning**: 09:05 MSK
- **Day**: 15:05 MSK
- **Evening**: 21:05 MSK

## Troubleshooting

### Bot Not Receiving Messages

1. Check webhook status:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```

2. Verify webhook URL is accessible:
   ```bash
   curl -I https://yourdomain.com/api/telegram/webhook
   ```

3. Check server logs for errors

### Webhook Conflicts

If switching from polling to webhook or vice versa:

1. Delete webhook:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook
   ```

2. Restart server with correct configuration

### ReminderService Not Working

1. Check `ENABLE_REMINDER_CRON=true` in `.env`
2. Verify bot is initialized
3. Check logs for cron job execution

## Migration from Polling Mode

If you were using `bot/start.js` (polling mode):

1. Stop the bot process
2. Update `.env` with webhook configuration
3. Start server with `npm start`
4. Old `bot/start.js` is now deprecated and will show warning

## API Reference

### SimpleTelegramBot Methods

#### `webhookCallback(webhookPath)`
Returns Express middleware for handling webhook updates.

#### `setWebhook(webhookUrl)`
Registers webhook URL with Telegram Bot API.

#### `getWebhookInfo()`
Gets current webhook configuration from Telegram.

#### `deleteWebhook()`
Removes webhook (switches back to polling mode).

## Security Considerations

1. **HTTPS Required**: Telegram only accepts HTTPS webhooks
2. **Secret Path**: Use non-obvious webhook path
3. **Rate Limiting**: Implement rate limiting on webhook endpoint
4. **Validation**: Telegraf validates updates automatically

## Production Deployment

### Recommended Setup

1. Use reverse proxy (nginx) with SSL/TLS
2. Set up monitoring for webhook endpoint
3. Configure logging for debugging
4. Enable graceful shutdown handling
5. Use process manager (PM2, systemd)

### Example nginx Configuration

```nginx
location /api/telegram/webhook {
    proxy_pass http://localhost:3002/api/telegram/webhook;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Monitoring

Monitor these metrics:
- Webhook endpoint response time
- Telegram update processing success rate
- ReminderService execution logs
- Cron job execution status

## Support

For issues or questions:
1. Check server logs
2. Verify environment variables
3. Test webhook connectivity
4. Review Telegram Bot API documentation

## References

- [Telegraf Documentation](https://telegraf.js.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Webhook Guide](https://core.telegram.org/bots/webhooks)
