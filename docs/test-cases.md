# Manual Test Cases

## Overview

This document defines the core manual test suite for Reader Bot Telegram Mini App. These test cases cover critical user flows and should be executed before each release.

---

## Test Cases

### TC-001: Onboarding Flow

**Objective:** Verify new users can complete the 7-question personality test and reach the main app.

**Preconditions:**
- Fresh Telegram user (no existing Reader Bot account)
- Bot accessible via `@reader_app_bot`

**Steps:**
1. Open Telegram and search for `@reader_app_bot`
2. Start chat and tap "Reader" menu button or send `/start`
3. Complete all 7 onboarding questions
4. Submit final question

**Expected Results:**
- All 7 questions display correctly
- Progress indicator shows current step (e.g., "3/7")
- After submission, user is redirected to main app (Diary page)
- User data is persisted (refresh should not restart onboarding)

**Priority:** Critical

---

### TC-002: Quote Creation & AI Analysis

**Objective:** Verify users can add quotes and receive AI-powered analysis.

**Preconditions:**
- User has completed onboarding
- User is on Diary page
- Daily quote limit not reached (< 10 quotes today)

**Steps:**
1. Navigate to Diary page
2. Tap "Add Quote" button
3. Enter quote text: "The only way to do great work is to love what you do"
4. Enter book title: "Steve Jobs"
5. Enter author: "Walter Isaacson"
6. Submit form

**Expected Results:**
- Quote submission succeeds with success toast/notification
- Quote appears in diary list with entered details
- "Analysis from Anna" section appears on the quote card within 3-5 seconds
- AI analysis contains thoughtful, personalized reflection
- Daily limit counter decrements (e.g., "9/10 quotes remaining")

**Priority:** Critical

---

### TC-003: Community Feed Like Toggle

**Objective:** Verify like functionality works correctly in the Community feed.

**Preconditions:**
- User has completed onboarding
- Community feed contains at least one quote

**Steps:**
1. Navigate to Community page
2. Locate any quote in the feed
3. Tap the like/heart icon on the quote
4. Observe icon state change
5. Tap the like icon again (unlike)

**Expected Results:**
- First tap: Like icon changes to filled/active state; like count increments by 1
- Second tap: Like icon returns to outline/inactive state; like count decrements by 1
- Changes persist after page refresh
- No duplicate likes allowed for same quote
- Network errors show appropriate error message

**Priority:** High

---

### TC-004: Catalog UTM Tracking

**Objective:** Verify book catalog loads and UTM click tracking works.

**Preconditions:**
- User has completed onboarding
- Catalog contains at least one book

**Steps:**
1. Navigate to Catalog page
2. Wait for books to load
3. Select any book item
4. Tap on the book's "Learn More" or external link (if present)

**Expected Results:**
- Catalog page loads within 2 seconds on 3G
- Books display with title, author, cover image, and description
- Clicking external links includes UTM parameters (`utm_source=telegram_miniapp`)
- Click event is tracked server-side (verify in logs or analytics)
- No console errors during navigation

**Priority:** Medium

---

### TC-005: Weekly Report Display

**Objective:** Verify weekly AI-powered reports display correctly.

**Preconditions:**
- User has completed onboarding
- User has created at least one quote during the current week
- Weekly report has been generated (Sundays at 11:00 or manually triggered)

**Steps:**
1. Navigate to Reports or Achievements page
2. Locate "Weekly Report" section
3. Tap to open most recent weekly report
4. Scroll through report content

**Expected Results:**
- Weekly report displays with correct week range (e.g., "Week of Oct 17-23")
- Report includes AI-generated psychological analysis
- Quote count and reading statistics are accurate
- Report is formatted and readable (proper line breaks, spacing)
- Images/charts (if any) load correctly

**Priority:** High

---

### TC-006: API Error Handling

**Objective:** Verify the app handles API failures gracefully.

**Preconditions:**
- User has completed onboarding
- Device can simulate network conditions (or use airplane mode toggle)

**Steps:**
1. Enable airplane mode or simulate offline state
2. Navigate to Diary page
3. Attempt to create a new quote
4. Submit form
5. Re-enable network connection
6. Retry quote submission

**Expected Results:**
- Offline submission shows user-friendly error message (e.g., "No internet connection")
- No generic "500 Internal Server Error" displayed
- Form data is retained after error (user doesn't lose input)
- Retry after reconnection succeeds
- Loading states display during network requests (spinners/skeleton screens)

**Priority:** High

---

## Accessibility & Mobile Checklist

### Accessibility
- [ ] All interactive elements have ≥44px touch targets (iOS guideline)
- [ ] Form inputs include proper labels (visible or aria-label)
- [ ] Color contrast meets WCAG AA (4.5:1 for body text)
- [ ] Font scaling supports user-preferred text size
- [ ] Screen reader announces page changes and form errors

### Mobile Responsiveness
- [ ] App renders correctly on iPhone 14 Pro (iOS 16+)
- [ ] App renders correctly on Android Pixel 6 (Chrome)
- [ ] Safe areas respected on notched iPhones (top/bottom padding)
- [ ] Modals do not exceed viewport height (scroll internally if needed)
- [ ] No horizontal scrolling on any page

---

## References

- **Bug Report Template:** See [README.md](../README.md#bug-report-template)
- **Performance Targets:** Lighthouse >90 (Performance, Accessibility)
- **Test Matrix:** See [README.md](../README.md#test-matrix)
- **Known Issues:** See [README.md](../README.md#known-issues--roadmap)

---

## Notes for QA Engineers

- Execute TC-001 through TC-006 on each release candidate
- Document actual results in "Actual" column during execution
- Report bugs using the template in README.md
- Prioritize Critical and High priority tests for smoke testing
- Run full suite for major releases; smoke tests for hotfixes
