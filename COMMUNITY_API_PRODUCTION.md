# Community API Production Hardening

This document describes the production hardening improvements made to the Community API endpoints.

## Overview

The Community API has been hardened for production use with enhanced validation, rate limiting, database optimization, and uniform response formats.

## Endpoints Enhanced

### `/api/reader/community/quotes/latest`
- **Purpose**: Latest quotes from all users
- **Validation**: `limit` (1-50, default 10)
- **Features**: Deterministic sorting, no private user data exposure

### `/api/reader/community/popular`
- **Purpose**: Popular quotes aggregated by frequency
- **Validation**: `period` (7d|30d), `limit` (1-50, default 10)
- **Features**: Aggregation by text+author, minimum 2 occurrences

### `/api/reader/community/popular-books`
- **Purpose**: Popular books from UTM click analytics
- **Validation**: `period` (7d|30d), `limit` (1-20, default 10)
- **Features**: UTM analytics integration, sales data correlation

### `/api/reader/community/stats`
- **Purpose**: Community statistics and metrics
- **Features**: Active user counts, quote statistics, top authors

### `/api/reader/community/leaderboard`
- **Purpose**: User rankings (anonymized)
- **Validation**: `limit` (1-50, default 10)
- **Features**: Quote counts, current user highlighting

## Security & Performance

### Input Validation
- **Period**: Only `7d` and `30d` allowed
- **Limit**: Range 1-50, safe defaults
- **Sanitization**: All inputs validated and sanitized

### Rate Limiting
- **Community Limiter**: 30 requests per 5 minutes per user
- **Key Strategy**: Uses `userId` from telegram auth, falls back to IP
- **Protection**: Prevents abuse while allowing normal usage

### Database Optimization
```javascript
// New indexes for performance
{ createdAt: -1, _id: -1 }  // Latest quotes with deterministic sorting
{ text: 1, author: 1, createdAt: -1 }  // Popular quotes aggregation
{ campaign: 1, timestamp: -1, content: 1 }  // UTM analytics
{ 'statistics.totalQuotes': -1, _id: 1, isOnboardingComplete: 1, isActive: 1 }  // Leaderboard
```

### Response Format
All endpoints use consistent format:
```javascript
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 10,
    "limit": 10,
    "period": "7d"  // where applicable
  }
}
```

## Setup

### 1. Run Database Migration
```bash
npm run migrate:community
```

### 2. Verify Indexes
The migration script will show current index status for all collections.

### 3. Test Production Settings
```bash
node test-community-api-production.js
```

## Production Deployment

1. **Pre-deployment**: Run migration script in production environment
2. **Monitoring**: Watch for rate limit hits and query performance
3. **Scaling**: Indexes support high-volume community usage

## Error Handling

All endpoints return consistent error format:
```javascript
{
  "success": false,
  "error": "Descriptive error message"
}
```

Common validation errors:
- `Invalid period parameter. Use 7d or 30d.`
- `Invalid limit parameter. Must be between 1 and 50.`

## Backward Compatibility

✅ **Zero Breaking Changes**
- All existing response structures maintained
- Frontend clients require no modifications
- API contracts remain stable