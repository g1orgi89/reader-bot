# PROJECT KNOWLEDGE: Reader Bot Telegram Mini App

**Last Updated:** October 2024  
**Status:** Development (Pre-Production)

---

## 📊 Current Project Status

### Development Progress

| Component           | Completion | Notes                                          |
|---------------------|-----------|------------------------------------------------|
| **Backend API**     | 100%      | All endpoints functional, webhook mode active  |
| **Frontend (Mini App)** | ~90%  | Core features working, polish needed          |
| **CSS/UI**          | ~60%      | Mobile responsive, modal/scroll issues remain  |
| **Mobile UX**       | ~70%      | iOS safe area & navigation partially fixed     |
| **Testing/QA**      | ~40%      | Manual testing done, automated tests missing   |
| **Production Ready** | 0%       | Debug logs, Lighthouse audit, optimization needed |

### Feature Inventory

#### ✅ Fully Implemented

**User Onboarding:**
- 7-question personality test (page-by-page flow)
- Email collection with validation
- UTM source tracking
- Avatar upload (community feature)

**Quote Management:**
- Create quotes with book metadata (title, author, page number)
- Daily limit enforcement (10 quotes/day)
- Quote editing & deletion
- Search/filter by book or date
- AI-powered quote analysis (Claude API)
- Duplicate detection & normalization

**Reports & Analytics:**
- Weekly reports (AI-generated, Sunday 11:00 delivery)
- Monthly deep-dive reports
- User statistics dashboard (quotes count, reading streaks)
- Achievements system (badges for milestones)

**Book Catalog:**
- Curated psychology/self-help books from Anna Busel
- Personalized recommendations based on user test results
- UTM click tracking for conversions
- "Top Books" section

**Community Features:**
- Latest quotes feed from all users
- Popular quotes (most favorited)
- Favorite/unfavorite quotes
- Community statistics

**Backend Services:**
- Telegram Bot (webhook mode)
- Smart reminder system (3 time slots: morning/afternoon/evening)
- Cron jobs for report generation & reminders
- MongoDB integration with indexing
- Rate limiting & security middleware

#### 🔄 Partially Implemented

**UI/UX Refinements:**
- iOS navigation fixes (scroll jump on modal open/close)
- Modal height overflow on tall screens (iPad, iPhone 15 Pro Max)
- Safe area insets (partially applied, needs testing on more devices)
- Touch target sizes (some buttons <44px, needs audit)

**Admin Panel:**
- User management dashboard exists but not fully adapted to Reader Bot
- Analytics/UTM tracking visible but limited filtering
- Content moderation tools planned but not implemented

**Localization:**
- Currently Russian-only (`lang="ru"` in HTML)
- No i18n framework (all strings hardcoded)

#### ❌ Not Started

- **Offline Mode:** IndexedDB caching for quotes
- **Push Notifications:** Proactive report delivery reminders
- **Social Sharing:** Share quotes to Telegram channels/groups
- **Content Moderation:** Flag inappropriate community quotes
- **A/B Testing:** Experiment framework for UI variants

---

## 🎯 Project Overview

**Product Name:** Reader Bot  
**Client:** Anna Busel — Psychologist & Book Club Founder  
**Purpose:** Personal quote diary that drives book purchase conversions through:
- Weekly AI-powered psychological insights
- Personalized book recommendations
- Gamification (achievements, streaks)
- Community engagement

**Target Audience:** Russian-speaking readers interested in psychology, self-development, and literature analysis.

**Business Model:**
- Free quote diary + AI reports
- Monetization via book recommendations with affiliate links
- Promo codes: `READER20` (20% off), `MONTH25` (25% off)
- UTM tracking for campaign attribution

---

## 🏗 Architecture & Tech Stack

### Tech Stack

**Frontend (Telegram Mini App):**
- **Vanilla JavaScript** (no frameworks — explicit requirement)
- **JSDoc for type hints** (NO TypeScript)
- **CSS Variables** for theming (`mini-app/css/variables.css`)
- **Telegram Web App SDK** v6.0+
- **Service Worker** for offline support (basic implementation)

**Backend:**
- **Node.js 18+** with Express
- **MongoDB 7.0+** (Mongoose ODM)
- **Claude API (Anthropic)** or OpenAI for AI features
- **Telegraf** for Telegram Bot (webhook mode)

**DevOps:**
- **Webhook mode** (no long-polling bot)
- **Cron jobs** via `node-cron` for scheduled reports
- **Winston** for logging
- **Helmet + CORS** for security

### Key Files

**Mini App:**
- `mini-app/index.html` — Main HTML entry point
- `mini-app/js/core/App.js` — Application orchestrator
- `mini-app/js/core/Router.js` — Client-side routing
- `mini-app/js/core/State.js` — Global state management
- `mini-app/css/variables.css` — Design system (DO NOT MODIFY COLORS)

**Backend:**
- `server/index.js` — Express server + webhook setup
- `server/api/reader.js` — Main API routes
- `server/models/` — MongoDB schemas (User, Quote, Report, etc.)
- `server/services/` — Business logic (AI, reminders, statistics)

**Configuration:**
- `.env` — Environment variables (see `.env.example`)
- `package.json` — Dependencies & scripts

### Design Constraints

**CRITICAL: CSS Variable Locking**
The brand colors are **hardcoded and locked** in `mini-app/index.html`:

```css
--primary-color: #D2452C !important;  /* Terracotta */
--bg-primary: #F5F2EC;                /* Light beige */
--text-primary: #2C1810;              /* Dark brown */
```

**Do NOT:**
- Rename or remove existing CSS variables
- Add new color variables (reuse existing tokens)
- Override `--primary-color` in any CSS file

**JavaScript monitors** any attempt to change `--primary-color` and reverts it (see brand guard script in `index.html`).

---

## 🛠 Short-Term Roadmap (Pre-Production)

### Priority 1: Critical Fixes

**1. Modal Height Overflow**
- **Issue:** On iPad and tall iPhones, modals exceed viewport height
- **Fix:** Apply `max-height: calc(100vh - var(--safe-area-bottom) - 32px)` and `overflow-y: auto` to `.modal-content`
- **Files:** `mini-app/css/components/modals.css`
- **Effort:** 2 hours

**2. iOS Safe Area Refinement**
- **Issue:** Bottom navigation overlaps home indicator on iPhone 15 Pro Max
- **Fix:** Test on physical devices, adjust `padding-bottom: env(safe-area-inset-bottom)`
- **Files:** `mini-app/css/ios-navigation-fix.css`, `mini-app/css/components/navigation.css`
- **Effort:** 4 hours (requires device testing)

**3. Remove Debug Logs**
- **Issue:** 100+ `console.log()` statements in production code
- **Fix:** Wrap debug logs in `if (process.env.NODE_ENV === 'development')` or remove entirely
- **Files:** All `mini-app/js/**/*.js` files
- **Effort:** 3 hours
- **Tool:** `grep -r "console.log" mini-app/js | wc -l` → 127 occurrences

### Priority 2: Accessibility & UX

**4. Touch Target Audit**
- **Issue:** Some buttons/links are <44px (iOS guideline)
- **Fix:** Audit all interactive elements, increase padding or `min-height/width: 44px`
- **Tool:** Browser DevTools → Measure mode
- **Effort:** 4 hours

**5. Readability & Contrast**
- **Issue:** Light text on light backgrounds in some modals
- **Fix:** Run Lighthouse accessibility audit, fix contrast issues
- **Target:** WCAG AA (4.5:1 ratio)
- **Effort:** 2 hours

**6. ARIA Labels**
- **Issue:** Screen reader support incomplete (missing labels on icons)
- **Fix:** Add `aria-label` to SVG icons, `role` attributes to custom components
- **Effort:** 3 hours

### Priority 3: Performance

**7. Lighthouse Optimization**
- **Current Score:** Unknown (needs baseline)
- **Targets:**
  - Performance: >90
  - Accessibility: >90
  - Best Practices: >95
  - SEO: >90
- **Actions:**
  - Lazy-load images (`loading="lazy"`)
  - Minify CSS/JS (currently unminified)
  - Optimize variable fonts (subset if possible)
  - Remove unused CSS rules
- **Effort:** 8 hours

**8. Service Worker Enhancements**
- **Issue:** Current SW caches all assets but doesn't handle offline quote creation
- **Fix:** Implement IndexedDB queue for offline quote submission
- **Effort:** 12 hours (complex)

---

## 🐛 Known Issues

### High Priority

1. **Modal Scroll Jump (iOS)**
   - **Symptom:** Opening a modal causes page content to jump/scroll
   - **Cause:** `position: fixed` on modal backdrop changes document height
   - **Workaround:** Applied `overscroll-behavior: none` in CSS
   - **Status:** Partially fixed; still occurs on older iOS versions (14.x)

2. **Double-Tap Zoom on Quotes**
   - **Symptom:** Double-tapping a quote card zooms in
   - **Cause:** iOS Safari default behavior
   - **Workaround:** `touchend` event handler with 300ms delay detection
   - **Status:** Fixed in `mini-app/index.html` but may conflict with link clicks

3. **Avatar Upload 404 on First Attempt**
   - **Symptom:** First avatar upload fails with 404, second attempt succeeds
   - **Cause:** Race condition in directory creation (`mkdir -p`)
   - **Fix:** Already patched in `server/api/reader.js` (sync `mkdirSync`)
   - **Status:** Resolved

### Medium Priority

4. **Telegram Theme Not Applied on Launch**
   - **Symptom:** App loads with light theme even if user has dark mode in Telegram
   - **Cause:** Theme params applied async after WebApp.ready()
   - **Fix:** Move theme detection to synchronous init block
   - **Status:** To Do

5. **Navigation Drawer Flicker**
   - **Symptom:** Bottom nav icons flash when switching pages
   - **Cause:** `.active` class removed/added with slight delay
   - **Fix:** Use CSS transitions with `will-change: transform`
   - **Status:** To Do

6. **Quote Search Lag on Large Datasets**
   - **Symptom:** Search input lags when user has 500+ quotes
   - **Cause:** Client-side filtering without debouncing
   - **Fix:** Add 300ms debounce to search handler
   - **Status:** To Do

### Low Priority

7. **Font Loading Flash** (FOUT)
   - **Symptom:** System font briefly shown before variable fonts load
   - **Fix:** Use `font-display: swap` (already applied) and inline critical CSS
   - **Status:** Minor cosmetic issue

8. **Empty State Illustrations**
   - **Symptom:** Placeholder emojis instead of custom illustrations
   - **Fix:** Design + implement SVG illustrations for empty diary, no reports, etc.
   - **Status:** Design asset needed

---

## 🧪 QA & Testing Notes

### Manual Testing Coverage

**Tested on:**
- iPhone 14 Pro (iOS 17.2) — Primary device
- Android Pixel 6 (Android 13) — Secondary
- Desktop Chrome 120 (with mock SDK)

**Not Tested:**
- iPhone SE (small screen)
- iPad Pro (tablet layout)
- Older Android versions (<12)

### Test Scenarios

**Critical Flows:**
1. ✅ Onboarding completion (7 questions → result page)
2. ✅ Quote creation with all fields filled
3. ✅ Quote creation with minimal fields (only text + book title)
4. ✅ Daily limit enforcement (11th quote blocked)
5. ✅ Weekly report display with recommendations
6. ✅ Book catalog browsing & click tracking
7. ✅ Community feed scrolling & favoriting
8. ✅ Dark mode theme switch

**Edge Cases:**
1. ⚠️ Quote with 1000+ characters (exceeds screen height)
2. ⚠️ Book title with special characters (emoji, Cyrillic)
3. ❌ Offline quote submission (not implemented)
4. ❌ Network timeout on report fetch (no retry logic)

### Automated Tests

**Backend:**
- Unit tests: `tests/*.test.js` (Jest)
- Coverage: ~60% (models + services)
- **Missing:** API integration tests with Supertest

**Frontend:**
- **No automated tests** (manual QA only)
- **Recommendation:** Add Playwright for E2E tests

---

## 📋 Release Checklist (v1.0)

### Pre-Release Tasks

**Code Quality:**
- [ ] Remove all `console.log()` / `console.warn()` debug statements
- [ ] Run ESLint and fix all warnings (`npm run lint:fix`)
- [ ] Ensure no secrets in code (API keys, tokens)
- [ ] Update version in `package.json` and `mini-app/js/core/App.js`

**Testing:**
- [ ] Manual QA on iPhone 14, Pixel 6, iPad
- [ ] Lighthouse audit: all scores >90
- [ ] Accessibility audit with VoiceOver/TalkBack
- [ ] Test on slow 3G network (Lighthouse → Throttling)

**UI/UX:**
- [ ] Touch target audit (all buttons ≥44px)
- [ ] Safe area tested on iPhone 15 Pro Max
- [ ] Modal heights capped on iPad Pro
- [ ] Empty states have illustrations (not just text)

**Documentation:**
- [ ] README.md updated with latest features
- [ ] API documentation complete (or link to Swagger/Postman)
- [ ] Environment variables documented in `.env.example`
- [ ] CHANGELOG.md created with v1.0 notes

**Production Setup:**
- [ ] `.env` configured with production secrets
- [ ] MongoDB indexes created (`npm run migrate:community`)
- [ ] Telegram webhook URL set to production domain
- [ ] HTTPS certificate valid (Let's Encrypt or similar)
- [ ] CDN configured for static assets (optional)
- [ ] Error tracking enabled (Sentry or similar)

**Deployment:**
- [ ] Deploy to staging environment
- [ ] Smoke test all critical flows
- [ ] Deploy to production
- [ ] Monitor logs for 24 hours
- [ ] Send test report to Anna Busel

### Post-Release Monitoring

**Week 1:**
- Monitor error logs daily
- Track user signup conversion rate
- Check weekly report delivery success rate
- Verify book click tracking (UTM data)

**Week 2-4:**
- Collect user feedback (in-app survey or Telegram group)
- Analyze Lighthouse performance metrics
- Identify top 3 user pain points
- Plan v1.1 features based on feedback

---

## ❓ Questions for Maintainer

**Clarifications Needed:**

1. **Admin Panel Scope:**  
   - Should admin panel be migrated from Shrooms Bot codebase?
   - Or is this a separate project not included in this repository?

2. **Localization Strategy:**  
   - Plan to support English in the future?
   - If yes, should we start using i18n keys now?

3. **Offline Mode Priority:**  
   - Is IndexedDB queue for quotes a must-have for v1.0?
   - Or can this be deferred to v1.1?

4. **Analytics Platform:**  
   - Are we sending UTM data to Google Analytics / Mixpanel?
   - Or just storing in MongoDB for internal dashboards?

5. **Content Moderation:**  
   - Who moderates community quotes (Anna or automated AI filter)?
   - Should we add a "Report" button for inappropriate content?

6. **Promo Code System:**  
   - Are promo codes validated in this app or on external payment page?
   - Should we track redemption in MongoDB?

---

## 📚 Additional Resources

- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Claude API Docs (Anthropic)](https://docs.anthropic.com/claude/reference/getting-started)
- [MongoDB Best Practices](https://www.mongodb.com/docs/manual/administration/production-notes/)
- [iOS Human Interface Guidelines — Touch Targets](https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/adaptivity-and-layout/)

---

**Document Maintained By:** Development Team  
**Next Review:** Before v1.0 Release
