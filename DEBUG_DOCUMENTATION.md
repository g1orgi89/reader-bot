# 🔍 COMPREHENSIVE SERVER DEBUG DOCUMENTATION

## 📋 Overview

This document explains how to use the comprehensive debugging system implemented in Reader Bot to diagnose JWT authentication issues and user data binding problems in production.

## 🎯 Problem Statement

The debugging system was implemented to solve these critical issues:
- JWT tokens not being passed correctly from Telegram Mini App
- API calls failing with 401 errors instead of proper userId authentication
- Quotes not saving under real user (userId: 1798451247 - g1orgi89)
- "My Quotes" showing empty placeholder instead of user data
- AI analysis taking 10-13 seconds (needs performance diagnosis)

## 🚀 Quick Start

### Environment Setup

Set debug flags in your environment or `.env` file:

```bash
# Enable all debugging
DEBUG_ALL=true

# Or enable specific debugging modules
DEBUG_AUTH=true
DEBUG_QUOTES=true  
DEBUG_AI=true
DEBUG_DB=true
```

### Production VPS Commands

```bash
# Start server with full debugging
DEBUG_ALL=true npm start

# Monitor logs in real-time
tail -f /path/to/app/logs/app.log

# Filter only AUTH logs
tail -f /path/to/app/logs/app.log | grep "AUTH"

# Filter by specific userId (g1orgi89)
tail -f /path/to/app/logs/app.log | grep "1798451247"

# Filter by category
tail -f /path/to/app/logs/app.log | grep "QUOTES"
tail -f /path/to/app/logs/app.log | grep "AI ANALYSIS"
tail -f /path/to/app/logs/app.log | grep "DATABASE"
```

## 🔐 Authentication Debugging

### Auth Middleware Debug Output

When `DEBUG_AUTH=true` or `DEBUG_ALL=true`, every request through the auth middleware logs:

```javascript
🔐 [AUTH MIDDLEWARE DEBUG] {
  timestamp: "2025-01-08T22:21:20.848Z",
  method: "POST",
  url: "/api/reader/quotes",
  
  // Headers analysis
  hasAuthHeader: true,
  authHeaderType: "Bearer",
  authHeaderLength: 150,
  authHeaderPreview: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  
  // All headers for debugging
  allHeaders: ["authorization", "content-type", "user-agent"],
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  
  // Telegram Web App context
  isTelegramWebApp: true,
  telegramVersion: "7.0",
  telegramPlatform: "ios",
  referrer: "https://t.me",
  origin: "https://web.telegram.org",
  
  // Request body preview
  hasBody: true,
  bodyKeys: ["text", "author"]
}
```

### JWT Verification Debugging

```javascript
🔐 [AUTH DEBUG] JWT verification successful {
  extractedToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenValid: true,
  extractedUserId: "1798451247",
  tokenPayload: {
    userId: "1798451247",
    iat: 1704748880,
    exp: 1707340880,
    telegramUserId: 1798451247
  }
}
```

### Authentication Errors

```javascript
❌ [AUTH DEBUG] JWT verification failed {
  error: "invalid signature",
  tokenPreview: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  jwtErrorName: "JsonWebTokenError",
  isExpired: false,
  isInvalid: true
}
```

## 📱 Telegram Authentication Debugging

### Telegram Auth Request Debug

```javascript
📱 [TELEGRAM AUTH DEBUG] {
  timestamp: "2025-01-08T22:21:20.850Z",
  telegramDataReceived: true,
  userDataReceived: true,
  userIdFromTelegram: 1798451247,
  
  // Telegram data analysis
  telegramDataPreview: "query_id=AAHdF6IQAAAA3ReiENWW&user=%7B%22id%22%3A1798451247...",
  userDataKeys: ["id", "first_name", "username"],
  
  // Headers analysis for Telegram context
  telegramHeaders: {
    isTelegramWebApp: true,
    telegramVersion: "7.0",
    telegramPlatform: "ios",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    referrer: "https://t.me",
    origin: "https://web.telegram.org"
  }
}
```

### JWT Token Generation Debug

```javascript
📱 [TELEGRAM AUTH DEBUG] JWT generation {
  tokenGenerated: true,
  tokenLength: 150,
  tokenPreview: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenPayload: {
    userId: "1798451247",
    telegramUserId: 1798451247,
    expiresIn: "30 days",
    issuedAt: "2025-01-08T22:21:20.850Z",
    expiresAt: "2025-02-07T22:21:20.850Z"
  }
}
```

### Auth Result Debug

```javascript
✅ [TELEGRAM AUTH RESULT] {
  success: true,
  userId: 1798451247,
  isOnboardingCompleted: true,
  tokenGenerated: true,
  responseStructure: ["success", "user", "token", "isOnboardingCompleted", "expiresIn"],
  userFields: ["id", "firstName", "lastName", "username", "telegramId", "isOnboardingCompleted"]
}
```

## 📝 Quotes API Debugging

### Quote Creation Debug

```javascript
📝 [QUOTES API DEBUG] {
  timestamp: "2025-01-08T22:21:20.850Z",
  endpoint: "/api/reader/quotes",
  method: "POST",
  authenticatedUserId: 1798451247,
  
  // Quote data analysis
  quoteData: {
    text: "Жизнь — это то, что происходит с нами, пока мы...",
    author: "Джон Леннон",
    source: "Beautiful Boy",
    hasText: true,
    hasAuthor: true,
    hasSource: true,
    textLength: 65
  },
  
  // User context
  userContext: {
    userId: 1798451247,
    userName: "g1orgi89",
    userEmail: "test@example.com",
    isOnboardingComplete: true
  }
}
```

### Daily Limit Check Debug

```javascript
📝 [QUOTES DEBUG] Daily limit check {
  userId: 1798451247,
  todayQuotes: 3,
  dailyLimit: 10,
  canAddQuote: true
}
```

### Quote Retrieval Debug

```javascript
✅ [QUOTES DEBUG] Quotes retrieved {
  userId: 1798451247,
  quotesFound: 15,
  totalQuotes: 42,
  pagination: {
    limit: 20,
    offset: 0,
    hasMore: true
  },
  filters: {
    author: null,
    search: null,
    dateRange: null
  }
}
```

## 🤖 AI Analysis Debugging

### AI Analysis Start

```javascript
🤖 [AI ANALYSIS START] {
  timestamp: "2025-01-08T22:21:20.850Z",
  userId: 1798451247,
  quoteText: "Жизнь — это то, что происходит с нами, пока мы...",
  textLength: 65
}
```

### AI Analysis Complete

```javascript
🤖 [AI ANALYSIS COMPLETE] {
  timestamp: "2025-01-08T22:21:20.950Z",
  userId: 1798451247,
  quoteId: "65f8a1b2c3d4e5f6789a",
  processingTime: "11250ms",
  success: true,
  category: "Философия",
  themes: ["жизнь", "момент", "настоящее"],
  sentiment: "positive"
}
```

### AI Analysis Error

```javascript
❌ [AI ANALYSIS ERROR] {
  timestamp: "2025-01-08T22:21:20.950Z",
  userId: 1798451247,
  error: "API rate limit exceeded",
  errorName: "RateLimitError",
  stack: "Error: API rate limit exceeded..."
}
```

## 💾 Database Operations Debugging

### Insert Operations

```javascript
💾 [DATABASE DEBUG] {
  timestamp: "2025-01-08T22:21:20.851Z",
  operation: "INSERT",
  table: "quotes",
  userId: 1798451247,
  conditions: {
    userId: 1798451247,
    text: "Жизнь — это то, что происходит с нами...",
    author: "Джон Леннон"
  },
  resultCount: 1
}
```

### Select Operations

```javascript
💾 [DATABASE DEBUG] {
  timestamp: "2025-01-08T22:21:20.851Z",
  operation: "SELECT",
  table: "quotes",
  userId: 1798451247,
  conditions: { userId: 1798451247 },
  pagination: { limit: 20, offset: 0 }
}
```

### Update Operations

```javascript
💾 [DATABASE DEBUG] {
  timestamp: "2025-01-08T22:21:20.851Z",
  operation: "UPDATE",
  table: "userProfile",
  userId: 1798451247,
  action: "updateQuoteStats",
  author: "Джон Леннон"
}
```

## 🛠️ Onboarding Debugging

### Onboarding Request Debug

```javascript
📱 [ONBOARDING DEBUG] {
  timestamp: "2025-01-08T22:21:20.850Z",
  hasUser: true,
  hasAnswers: true,
  hasEmail: true,
  hasSource: true,
  userId: 1798451247,
  answersKeys: ["question1_name", "question2_lifestyle", "question3_time"],
  email: "user@example.com",
  source: "telegram_mini_app"
}
```

### User Creation Debug

```javascript
✅ [ONBOARDING DEBUG] User processed {
  userId: "1798451247",
  wasJustCreated: true,
  isOnboardingComplete: true,
  userName: "g1orgi89",
  userEmail: "user@example.com"
}
```

## 🔧 Debug Flag Reference

| Flag | Purpose | Logs |
|------|---------|------|
| `DEBUG_ALL=true` | Enable all debugging | All debug output |
| `DEBUG_AUTH=true` | Authentication debugging | JWT, Telegram auth, middleware |
| `DEBUG_QUOTES=true` | Quotes API debugging | CRUD operations, validation |
| `DEBUG_AI=true` | AI analysis debugging | Performance, errors, results |
| `DEBUG_DB=true` | Database debugging | Queries, operations, results |

## 📊 Monitoring in Production

### Real-time Monitoring Commands

```bash
# Monitor all activity for user g1orgi89
tail -f /path/to/logs | grep "1798451247"

# Monitor authentication issues
tail -f /path/to/logs | grep -E "(AUTH|JWT|TOKEN)"

# Monitor quote operations
tail -f /path/to/logs | grep "QUOTES"

# Monitor AI performance
tail -f /path/to/logs | grep "AI ANALYSIS" | grep "processingTime"

# Monitor errors only
tail -f /path/to/logs | grep "❌"

# Monitor success operations
tail -f /path/to/logs | grep "✅"
```

### Performance Analysis

```bash
# Find slow AI operations (>10 seconds)
grep "AI ANALYSIS COMPLETE" /path/to/logs | grep -E "[1-9][0-9]{4,}ms"

# Count daily operations per user
grep "1798451247" /path/to/logs | grep "`date +%Y-%m-%d`" | wc -l

# Find authentication failures
grep "❌.*AUTH" /path/to/logs | tail -20
```

## 🚨 Troubleshooting Guide

### Common Issues and Solutions

#### 1. JWT Token Not Found
**Debug Output:**
```
❌ [AUTH DEBUG] No valid authorization header {
  hasAuthHeader: false,
  authHeaderValue: undefined,
  expectedFormat: "Bearer <token>"
}
```
**Solution:** Check if frontend is sending Authorization header with Bearer token.

#### 2. Invalid JWT Token
**Debug Output:**
```
❌ [AUTH DEBUG] JWT verification failed {
  error: "invalid signature",
  jwtErrorName: "JsonWebTokenError"
}
```
**Solution:** Verify JWT_SECRET matches between client and server.

#### 3. User Not Found After Auth
**Debug Output:**
```
❌ [AUTH DEBUG] User not found in database {
  searchedUserId: "1798451247",
  jwtUserId: "1798451247"
}
```
**Solution:** User needs to complete onboarding first.

#### 4. AI Analysis Taking Too Long
**Debug Output:**
```
🤖 [AI ANALYSIS COMPLETE] {
  processingTime: "15000ms"
}
```
**Solution:** Check AI service API limits and network connectivity.

#### 5. Quotes Not Saving Under User
**Debug Output:**
```
📝 [QUOTES API DEBUG] {
  authenticatedUserId: undefined
}
```
**Solution:** Authentication middleware is not setting req.userId properly.

## 📝 Log File Locations

Default log locations:
- **Application logs:** `/path/to/app/logs/app.log`
- **Error logs:** `/path/to/app/logs/error.log`
- **Debug logs:** Console output (use `tee` to save to file)

## 🎯 Specific Debug for g1orgi89 (userId: 1798451247)

Use these commands to specifically monitor user g1orgi89:

```bash
# All activity
tail -f /path/to/logs | grep "1798451247"

# Authentication only
tail -f /path/to/logs | grep "1798451247" | grep "AUTH"

# Quote operations only
tail -f /path/to/logs | grep "1798451247" | grep "QUOTES"

# AI analysis performance
tail -f /path/to/logs | grep "1798451247" | grep "AI ANALYSIS.*processingTime"

# Errors only
tail -f /path/to/logs | grep "1798451247" | grep "❌"
```

## 🔄 Development vs Production

### Development
```bash
DEBUG_ALL=true npm run dev
```

### Production
```bash
# Only enable specific debugging to reduce log volume
DEBUG_AUTH=true DEBUG_QUOTES=true npm start

# Or enable all for troubleshooting
DEBUG_ALL=true npm start
```

## 💡 Best Practices

1. **Start with specific flags** - Use `DEBUG_AUTH=true` first, then add others as needed
2. **Monitor log volume** - `DEBUG_ALL=true` can generate many logs
3. **Use grep filters** - Filter logs by userId or category
4. **Rotate logs** - Implement log rotation for production
5. **Security** - Don't log sensitive data in production
6. **Performance** - Disable debugging when not needed

## ✅ Success Indicators

When debugging is working correctly, you should see:

1. **Authentication Flow:**
   - `📱 [TELEGRAM AUTH DEBUG]` for login requests
   - `✅ [TELEGRAM AUTH RESULT]` for successful auth
   - `🔐 [AUTH MIDDLEWARE DEBUG]` for protected endpoints

2. **Quote Operations:**
   - `📝 [QUOTES API DEBUG]` for all quote requests
   - `🤖 [AI ANALYSIS START/COMPLETE]` for AI processing
   - `💾 [DATABASE DEBUG]` for database operations

3. **User Data Binding:**
   - `authenticatedUserId: 1798451247` in all protected requests
   - Successful quote saves under the correct user
   - Proper user context in all operations

## 🎉 Expected Results

After implementing this debugging system, you will be able to:

1. **Identify exactly where JWT tokens are lost** in the request chain
2. **Verify Telegram auth creates tokens correctly**
3. **Confirm tokens are passed in subsequent API calls**
4. **Diagnose why middleware gets undefined userId**
5. **Measure AI analysis performance** (10-13 seconds timing)
6. **Track all database operations** for user data binding
7. **Monitor real-time user activity** on production VPS

The comprehensive debugging will help pinpoint exactly where the JWT authentication chain breaks for userId: 1798451247 (g1orgi89) and ensure all data is properly bound to the correct user.