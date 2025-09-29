# ISO 8601 Week Implementation Summary

## Overview
This implementation unifies week calculation across backend and frontend using ISO 8601 weeks with Moscow business time (UTC+3) support. All quote and report logic now operates on ISO week boundaries instead of calendar month-based weeks.

## Key Changes

### Backend Changes

#### 1. New Unified ISO Week Utilities (`server/utils/isoWeek.js`)
- **`getBusinessNow()`**: Returns current time adjusted for business timezone
- **`getISOWeekInfo(date)`**: Gets ISO week number and year for a date
- **`getISOWeekRange(week, year)`**: Gets date range for specific ISO week
- **`getPreviousCompleteISOWeek()`**: Gets previous complete week info
- **`getISOWeekKey(date)`**: Generates cache key in `YYYY-WNN` format
- **`formatISOWeekLabel(week, year)`**: Formats week range for display

#### 2. Quote Model Updates (`server/models/quote.js`)
- Updated pre-save hook to use business timezone aware ISO week calculation
- `yearNumber` now stores ISO year (may differ from calendar year at boundaries)
- Maintains backward compatibility with deprecated legacy function

#### 3. Weekly Report Service Updates (`server/services/weeklyReportService.js`)
- Replaced manual ISO calculations with calls to unified utilities
- `getPreviousWeekRange()` now uses `getPreviousCompleteISOWeek()`
- Deprecated `getCurrentWeekNumber()` method

#### 4. Catch-up Service (`server/services/weeklyReportCatchUpService.js`)
- Generates missing weekly reports for past N completed weeks (default: 8)
- Respects unique index constraints to prevent duplicates
- Configurable via `CATCHUP_LOOKBACK_WEEKS` environment variable

#### 5. Week Context API (`server/api/weekContext.js`)
- New endpoint: `GET /api/reader/week-context?userId=xxx`
- Returns current/previous week info and report status
- Mounted at `/api/reader/week-context` in reader routes

### Frontend Changes

#### 1. Enhanced Date Utilities (`mini-app/js/utils/dateUtils.js`)
- Added ISO week functions matching server-side logic
- **NEW**: `getISOWeekInfo()`, `getISOWeekRange()`, `getIsoWeekKey()`, `formatIsoWeekLabel()`
- **DEPRECATED**: Month-based functions for reports (kept for legacy compatibility)
- Consistent business timezone handling (UTC+3)

#### 2. State Management (`mini-app/js/core/State.js`)
- Added `weekContext` slice with loading states
- New methods: `setWeekContext()`, `getWeekContext()`, `isWeekContextLoaded()`
- Automatic refresh logic for stale context (30-minute timeout)

#### 3. API Service (`mini-app/js/services/api.js`)
- New method: `getWeekContext(userId)` for fetching week context
- Integrates with existing authentication and error handling

#### 4. Reports Page (`mini-app/js/pages/ReportsPage.js`)
- **NEW**: `prefetch()` method loads week context before rendering
- **FIXED**: Report ordering - `reports[0]` is most recent, `reports[1]` is previous
- Uses ISO week keys for caching (`YYYY-WNN` format)
- Smart placeholder logic based on week context
- ISO week labels for report dates

## Environment Configuration

### Required Environment Variables
```bash
# Business timezone offset in minutes (default: 180 for UTC+3 Moscow)
BUSINESS_TZ_OFFSET_MIN=180

# Catch-up service lookback period (default: 8 weeks)
CATCHUP_LOOKBACK_WEEKS=8
```

## Usage Examples

### Backend Usage
```javascript
const { getISOWeekInfo, getISOWeekKey, formatISOWeekLabel } = require('./server/utils/isoWeek');

// Get current week info in business timezone
const weekInfo = getISOWeekInfo();
console.log(`Week ${weekInfo.isoWeek}/${weekInfo.isoYear}`);

// Generate cache key
const cacheKey = getISOWeekKey(); // "2024-W40"

// Format for display
const label = formatISOWeekLabel(40, 2024); // "28 сентября - 5 октября 2024"
```

### Frontend Usage
```javascript
// Get ISO week key for caching
const weekKey = window.DateUtils.getIsoWeekKey(); // "2024-W40"

// Format week label
const label = window.DateUtils.formatIsoWeekLabel(40, 2024);

// Get week context from state
const weekContext = appState.getWeekContext();
if (weekContext && !weekContext.previous.hasReport) {
  // Show waiting placeholder
}
```

## Testing Verification

All functionality has been tested and verified:
- ✅ ISO week calculations consistent between server and frontend
- ✅ Business timezone (UTC+3) handling correct
- ✅ Week boundary handling follows ISO 8601 standard
- ✅ Year boundary scenarios (Dec 31 → Jan 1) handled correctly
- ✅ Cache invalidation works with ISO week keys
- ✅ Report ordering fixed (most recent first)

## Migration Notes

### For Production Deployment
1. **Database Migration**: If existing `yearNumber` data uses calendar years, consider migration for historical data integrity
2. **Cache Invalidation**: Old month-based cache keys will be naturally invalidated
3. **Environment Setup**: Ensure `BUSINESS_TZ_OFFSET_MIN=180` is set for Moscow time
4. **Catch-up Service**: Run once after deployment to generate missing reports

### Backward Compatibility
- Legacy month-based functions are preserved but deprecated
- Existing API endpoints remain unchanged
- Cache mechanism maintains compatibility with different key formats

## Benefits

1. **Unified Logic**: Single source of truth for week calculations
2. **Business Time Aware**: Handles Moscow timezone without system changes
3. **ISO Standard Compliant**: Follows international week numbering
4. **Automatic Catch-up**: Recovers missing reports automatically
5. **Smart Caching**: ISO week keys provide better cache invalidation
6. **Improved UX**: Shows appropriate placeholders based on report status

This implementation provides a robust, timezone-aware week calculation system that unifies backend and frontend logic while maintaining backward compatibility.