# PROJECT KNOWLEDGE: Reader Bot Telegram Mini App

**Last Updated:** October 24, 2024  
**Status:** Development (Pre-Production)

---

## 🌐 Hosting & Production Details

### Live Environment
- **API Host:** [app.unibotz.com](https://app.unibotz.com) (backend API only, no public web UI)
- **Telegram Entry:** [https://t.me/reader_app_bot/Reader](https://t.me/reader_app_bot/Reader)
- **Hosting Provider:** Contabo VPS
- **Web Server:** Nginx reverse proxy
- **Process Manager:** PM2 (`pm2 start server/index.js --name reader-bot`)
- **Database:** MongoDB via Docker on VPS
- **Deployment:** SSH-based manual deployment

> **Important:** This is a **Telegram-only Mini App**. The domain app.unibotz.com serves as the API host behind Nginx/PM2. The user interface is only accessible via the Telegram Mini App, not by visiting the domain directly.

### Infrastructure Commands
```bash
# Start application
pm2 start server/index.js --name reader-bot

# Check status
pm2 status

# View logs
pm2 logs reader-bot

# Stop application
pm2 stop reader-bot
```

---

## 📊 Current Project Status

### Development Progress

| Component           | Completion | Notes                                          |
|---------------------|-----------|------------------------------------------------|
| **Backend API**     | 100%      | All endpoints functional, webhook mode active  |
| **Frontend (Mini App)** | ~90%  | Core features working, polish needed          |
| **CSS/UI**          | ~60%      | Mobile responsive, modal/scroll issues remain  |
| **Mobile UX**       | ~70%      | iOS safe area & navigation partially fixed     |
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
- AI-powered quote analysis — "Analysis from Anna" (GPT integration active)
- Duplicate detection & normalization

**Reports & Analytics:**
- Weekly reports (AI-generated, Sunday 11:00 delivery)
- Monthly deep-dive reports
- User statistics dashboard (quotes count, reading streaks)
- Personal stats tracking

**Book Catalog:**
- Curated psychology/self-help books from Anna Busel
- Personalized recommendations based on user test results
- UTM click tracking for conversions (working and active)
- "Top Books" section
- Curated breakdowns and recommendations

**Community Features:**
- Latest quotes feed from all users
- Popular quotes (most favorited)
- Favorite/like quotes functionality
- "Top of the Week" section
- Community statistics
- **Following System** — subscribe/unsubscribe on users
- **Feed Filters** — "Все" / "Подписки" / "Обложки"
- **Covers (Обложки)** — photo-sharing feature:
  - 1 photo per day per user (enforced)
  - Auto-posted "start of day" from Anna (@anna_busel) at 06:00 MSK
  - Photo uploads with Sharp (EXIF cleanup, resize to 1200x1200)
  - Comments on photos with pagination
  - Pin mechanism (one pinned post per day)
  - Full-screen lightbox viewer (zoom, pan, double-tap)
  - Infinite scroll with cursor-based pagination

**Backend Services:**
- Telegram Bot (webhook mode)
- Smart reminder system via Telegram bot (implemented and active)
- Cron jobs for report generation & reminders
- MongoDB integration with indexing
- Rate limiting & security middleware
- GPT integration (implemented); Anthropic (Claude) optional
- **Audio System** with access control and entitlements
- **Gamification System** with badges and progress tracking

**Audio Features:**
- Free audio content (e.g., "Маленький принц", "Ешь, молись, люби")
- Gated premium audio (e.g., "Алиса в стране чудес" via badge)
- Entitlement-based access control
- 30-day time-limited access grants
- Progress tracking per audio/track
- Container support for multi-track audios

**Gamification & Badges:**
- **Alice Badge** ("Алиса в стране чудес") - IMPLEMENTED
  - Requirement: 10 photos in "книжный кадр" rubric
  - Requirement: 5 follows (subscriptions)
  - Requirement: 10 likes given to others' quotes
  - Requirement: 30-day continuous activity streak
  - Reward: 30-day access to "Alice in Wonderland" audio analysis
  - Badge appears in user profiles and next to usernames
  - **Frontend: Badge Icons (PR-3) - IMPLEMENTED**
    - Badge chips (32px) displayed under avatar on ProfilePage
    - Inline badge icons (18px) next to usernames in:
      - ProfilePage (own profile and user cards)
      - ProfileModal (quick preview)
      - CommunityPage (user cards in feed/lists)
    - Assets: `/assets/badges/alice.png` and `alice.webp`
    - CSS: `badges.css` component with `.badge-chip` and `.badge-inline` classes
    - Badge mapping: `BADGE_ICON_MAP` in ProfilePage, ProfileModal, CommunityPage
    - Renders only when `user.badges` array includes 'alice_badge'
    - Fallback: If `badges` absent/empty, nothing is rendered
- Progress tracking API: `GET /api/reader/gamification/progress/alice`
- Claim API: `POST /api/reader/gamification/alice/claim`
- Idempotent claiming (can't double-claim)
- Badges shown in profile responses

**User Interface:**
- Profile & Settings pages
- Responsive design optimized for Telegram WebView
- Dark/Light theme support

#### 🔄 Partially Implemented / Planned

**Achievements & Gamification:**
- ✅ Backend implemented (Alice badge)
- ✅ Frontend badge icons implemented (PR-3)
- UI and design exist
- Additional badges planned

**Admin Panel:**
- Pages and CSS exist from previous codebase
- Needs integration with existing Reader Bot API endpoints
- User management and analytics views present but not fully adapted

**UI/UX Refinements:**
- Modal height overflow on tall screens (iPad, iPhone 15 Pro Max) — needs fixing
- iOS safe-area bottom padding — needs refinement and device testing
- Red analysis card readability — line-height and contrast improvements needed
- Touch target sizes — some buttons <44px, audit required
- Debug logs removal — console.log statements need cleanup

#### ❌ Not Implemented

- **Offline Mode:** IndexedDB caching for quotes (not implemented)

---

## 🎯 Project Overview

**Product Name:** Reader Bot  
**Project owner / Client:** Anna Busel — Psychologist & Book Club Founder  
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

## 🐛 Known Issues

### High Priority

1. **Modal Overflow on Tall Screens**  
   - Modals may exceed viewport height on iPad and notched iPhones
   - Needs `max-height` with internal scroll (`max-height: calc(100vh - var(--safe-area-bottom))` + `overflow-y: auto`)
   - Priority: Medium

2. **iOS Safe Area Bottom Padding**  
   - Bottom navigation may overlap home indicator on newer iPhones
   - Requires testing on iPhone 15 Pro Max and refinement of `env(safe-area-inset-bottom)`
   - Priority: Medium

3. **Red Analysis Card Readability**  
   - Text contrast and line-height issues on "Analysis from Anna" cards
   - Needs improved line-height and contrast ratio adjustments
   - Priority: Low

4. **Touch Target Sizes**  
   - Some interactive elements are <44px (iOS guideline)
   - Full audit required to ensure all buttons/links meet ≥44px minimum
   - Priority: High

5. **Debug Logs in Production**  
   - Console logs not removed from some files
   - Need to strip all `console.log()` statements before release
   - Priority: High

---

## 🛠 Short-Term Roadmap

- [ ] **Integrate Admin Panel** — Connect existing admin UI with Reader Bot API endpoints
- [ ] **Implement Achievements** — Complete gamification system with badge unlocking
- [ ] **Fix Modal/Safe-Area Issues** — Address modal overflow and iOS safe-area padding
- [ ] **Accessibility Fixes** — Ensure touch targets ≥44px, improve readability, add ARIA labels
- [ ] **Remove Debug Logs** — Strip all console logging for production
- [ ] **Add Smoke/E2E Tests** — Set up Playwright or similar for automated testing
- [ ] **Simple CI Setup** — Basic GitHub Actions for linting and tests
- [ ] **Validate Theme Handling** — Test Telegram dark/light mode theme switching

---

## 📋 Deployment Notes

### Production Deployment Process
1. SSH into Contabo VPS
2. Navigate to app directory
3. Pull latest changes from repository
4. Install dependencies: `npm install`
5. Restart PM2 process: `pm2 restart reader-bot`
6. Monitor logs: `pm2 logs reader-bot`

### MongoDB Management
- MongoDB runs via Docker on the VPS
- Connection string configured in `.env` file
- Database backups should be configured separately

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
