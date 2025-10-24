# 📖 Reader Bot — Telegram Mini App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0%2B-green.svg)](https://www.mongodb.com/)

> **A personal quote diary Telegram Mini App for psychologist Anna Busel**  
> Helps readers capture meaningful book quotes, receive AI-powered weekly insights, and discover personalized book recommendations.

---

## 📸 Screenshots

_Visuals coming soon! Please add screenshots/GIFs to `docs/screenshots/` to showcase:_
- Onboarding flow (personality test)
- Quote diary with cards
- Weekly AI-powered reports
- Book catalog with recommendations
- Community quotes feed
- Achievements & gamification

**Instructions for maintainers:** Place PNG/JPEG screenshots or GIF demos in `docs/screenshots/` and reference them here.

---

## ✨ Features

### 📝 Core Features
- **7-Question Personality Test** — Onboarding flow to understand reader preferences
- **Quote Collection** — Save and organize meaningful quotes from books (limit: 10/day)
- **AI Analysis** — Claude-powered insights on captured quotes
- **Weekly Reports** — Sunday 11:00 delivery with psychological analysis & book recommendations
- **Monthly Reports** — Deep-dive analytics with special offers

### 📚 Discovery & Recommendations
- **Book Catalog** — Curated psychology & self-help books from Anna Busel
- **Personalized Recommendations** — AI-driven suggestions based on reading patterns
- **Community Feed** — Browse latest and popular quotes from other readers

### 🎯 Engagement & Growth
- **Gamification** — Achievements system to encourage daily reading habits
- **Smart Reminders** — Configurable notifications (morning/afternoon/evening slots)
- **UTM Tracking** — Analytics for marketing campaigns
- **Promo Codes** — READER20 (20% off), MONTH25 (25% off)

### 👤 User Experience
- **Responsive Design** — Mobile-first, optimized for Telegram WebView
- **Dark/Light Theme** — Auto-adapts to Telegram theme
- **Offline Support** — Service Worker for better performance
- **iOS Safe Area** — Proper handling of notches and navigation bars

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm 8+
- **MongoDB** 7.0+ (local or remote)
- **Telegram Bot Token** — Get one from [@BotFather](https://t.me/botfather)
- **Anthropic API Key** — For Claude AI (or OpenAI API key)

### 1. Clone & Install

```bash
git clone https://github.com/g1orgi89/reader-bot.git
cd reader-bot
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your credentials (see .env.example for guidance)
```

**Key variables:**
- `PORT=3002`
- `MONGODB_URI=mongodb://localhost:27017/reader_bot`
- `TELEGRAM_BOT_TOKEN=your_bot_token_here`
- `ANTHROPIC_API_KEY=your_anthropic_key` (or `OPENAI_API_KEY`)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` for admin panel

See [`.env.example`](.env.example) for complete reference.

### 3. Database Setup

```bash
npm run db:setup
```

This creates the `reader_bot` MongoDB database with required collections.

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Access:
- **Main App:** http://localhost:3002
- **Admin Panel:** http://localhost:3002/reader-admin
- **API Health:** http://localhost:3002/api/reader/health

---

## 🧪 Local Testing (Mini App)

The Telegram Mini App lives in `/mini-app`. To test locally **outside Telegram**:

### Option 1: Python HTTP Server

```bash
cd mini-app
python3 -m http.server 8080
# Open http://localhost:8080 in browser
```

### Option 2: Node.js http-server

```bash
npm install -g http-server
cd mini-app
http-server -p 8080
# Open http://localhost:8080
```

### Mock Telegram Web App SDK

For local testing, add this **before** loading `telegram-web-app.js`:

```html
<!-- Mock Telegram WebApp SDK for local testing -->
<script>
if (!window.Telegram) {
  window.Telegram = {
    WebApp: {
      initData: '',
      initDataUnsafe: { user: { id: 123456, first_name: 'Test', username: 'testuser' } },
      version: '6.0',
      platform: 'web',
      colorScheme: 'light',
      themeParams: {
        bg_color: '#ffffff',
        text_color: '#000000',
        hint_color: '#999999',
        link_color: '#D2452C',
        button_color: '#D2452C',
        button_text_color: '#ffffff'
      },
      isExpanded: false,
      viewportHeight: window.innerHeight,
      viewportStableHeight: window.innerHeight,
      headerColor: '#ffffff',
      backgroundColor: '#ffffff',
      BackButton: { isVisible: false, show: () => {}, hide: () => {}, onClick: () => {} },
      MainButton: { text: '', color: '#D2452C', textColor: '#fff', isVisible: false, isActive: true, show: () => {}, hide: () => {}, setText: () => {}, onClick: () => {} },
      ready: () => console.log('Mock Telegram.WebApp.ready()'),
      expand: () => console.log('Mock Telegram.WebApp.expand()'),
      close: () => console.log('Mock Telegram.WebApp.close()'),
      sendData: (data) => console.log('Mock sendData:', data),
      showAlert: (msg) => alert(msg),
      showConfirm: (msg) => confirm(msg),
      showPopup: (params) => alert(params.message)
    }
  };
  console.log('✅ Mock Telegram WebApp SDK loaded for local testing');
}
</script>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

Insert this snippet into `mini-app/index.html` **temporarily** for local development (remove before production).

---

## 🎨 Design System

The Mini App uses a **CSS Variables-based design system** (no Tailwind/Bootstrap).

### Key Design Tokens

Defined in [`mini-app/css/variables.css`](mini-app/css/variables.css):

```css
--primary-color: #D2452C;     /* Terracotta (Anna Busel brand color) */
--bg-primary: #F5F2EC;        /* Light beige background */
--text-primary: #2C1810;      /* Dark brown text */
```

### Mobile Guidelines
- **Touch targets:** Minimum 44px (iOS guideline)
- **Typography:** +1px font scale on mobile (17px base instead of 16px)
- **Safe areas:** iOS notch/home indicator respected via `env(safe-area-inset-*)`

**Important:** Do NOT modify existing CSS variables or add new ones. Reference `variables.css` for all available tokens.

---

## 🔌 API Reference

Base URL: `http://localhost:3002/api/reader`

### Authentication

**Telegram Auth:**
```bash
curl -X POST http://localhost:3002/api/reader/auth/telegram \
  -H "Content-Type: application/json" \
  -H "Authorization: tma <telegram_init_data>" \
  -d '{"userId": "123456", "firstName": "Anna"}'
```

### Quotes

**Create Quote:**
```bash
curl -X POST http://localhost:3002/api/reader/quotes \
  -H "Authorization: tma <init_data>" \
  -H "Content-Type: application/json" \
  -d '{"text": "To be or not to be", "bookTitle": "Hamlet", "author": "Shakespeare"}'
```

**Get User Quotes:**
```bash
curl http://localhost:3002/api/reader/quotes \
  -H "Authorization: tma <init_data>"
```

### Reports

**Weekly Reports:**
```bash
curl http://localhost:3002/api/reader/reports/weekly \
  -H "Authorization: tma <init_data>"
```

### Catalog

**Browse Books:**
```bash
curl http://localhost:3002/api/reader/catalog
```

**Get Recommendations:**
```bash
curl http://localhost:3002/api/reader/recommendations \
  -H "Authorization: tma <init_data>"
```

> **Note:** `<telegram_init_data>` is the initialization string from Telegram WebApp SDK. For full endpoint list, see [`server/api/reader.js`](server/api/reader.js).

---

## 🧪 QA & Testing Section

### Test Matrix

| Device/Browser       | Status | Notes                    |
|---------------------|--------|--------------------------|
| iPhone 14 / Safari  | ✅ Pass | Primary target           |
| Android / Chrome    | ✅ Pass | Tested on Pixel 6        |
| Desktop / Chrome    | ✅ Pass | With dev mock SDK        |
| iPad / Safari       | ⚠️ WIP  | Modal height issues      |

### Smoke Tests

**Pre-deployment checklist:**
1. ✅ User can complete onboarding (7-question test)
2. ✅ Quote submission works (text + book details)
3. ✅ Weekly report displays correctly
4. ✅ Catalog loads books without errors
5. ✅ Community feed shows latest quotes
6. ✅ Achievements page loads stats
7. ✅ Dark mode theme switches properly

### Sample Test Case

**TC-001: Quote Creation**
- **Preconditions:** User authenticated, onboarding complete
- **Steps:**
  1. Navigate to Diary page
  2. Tap "Add Quote" button
  3. Enter quote text, book title, author
  4. Submit form
- **Expected:** Quote appears in diary; success toast shown; daily limit counter decrements
- **Actual:** (To be filled by QA)

### Bug Report Template

```markdown
**Title:** [Component] Brief description

**Environment:**
- Device: iPhone 14 Pro
- OS: iOS 16.5
- Telegram: Latest version
- App Version: [Git commit SHA]

**Steps to Reproduce:**
1. Navigate to...
2. Click on...
3. Observe...

**Expected Behavior:**
Should display...

**Actual Behavior:**
Instead shows...

**Screenshots:**
[Attach images]

**Severity:** Critical / High / Medium / Low
**Logs:** (if available)
```

### Acceptance Criteria
- [ ] All pages load within 2 seconds on 3G
- [ ] No console errors on clean user flow
- [ ] Touch targets ≥ 44px on all interactive elements
- [ ] Proper error messages for API failures
- [ ] Graceful offline degradation (cached data shown)

### Performance & Accessibility
- **Lighthouse Score Target:** >90 (Performance, Accessibility)
- **Font Scaling:** Supports user-preferred text size (Settings page)
- **Color Contrast:** WCAG AA compliant (4.5:1 for body text)
- **Screen Readers:** Labels on all form inputs & buttons

**Run Lighthouse:** Open DevTools → Lighthouse → "Mobile" → Generate Report

---

## 🛠 Known Issues & Roadmap

### Known Issues

1. **Modal Height on Tall Screens** — iPad/notched iPhones: modals may overflow viewport
   - _Workaround:_ Use `max-height: calc(100vh - var(--safe-area-bottom))` for modal content
   - _Priority:_ Medium

2. **Scroll Jump on iOS** — Navigation drawer may cause page scroll to reset
   - _Workaround:_ Applied `overscroll-behavior: none` in `css/ios-navigation-fix.css`
   - _Status:_ Partially fixed; edge cases remain

3. **Debug Logs in Production** — Console logs not removed from some files
   - _Fix:_ Clean up `console.log()` statements before v1.0 release
   - _Priority:_ High

### Short-Term Roadmap (Pre-Production)

- [ ] **Accessibility Audit** — Add ARIA labels, test with VoiceOver
- [ ] **Touch Target Audit** — Ensure all buttons/links ≥ 44px
- [ ] **Safe Area Refinement** — Test on iPhone 15 Pro Max, iPad Pro
- [ ] **Error Boundary** — Global error handler for unexpected crashes
- [ ] **Lighthouse Optimization** — Lazy-load images, optimize fonts
- [ ] **Remove Debug Code** — Strip `console.log()` and dev tools

### Long-Term Vision

- Offline mode with IndexedDB for quotes
- Push notifications for report delivery
- Social sharing of quotes to Telegram channels
- Admin panel for content moderation

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes (ensure they pass `npm run lint`)
4. Commit with clear messages (`git commit -m 'Add amazing feature'`)
5. Push to your fork (`git push origin feature/amazing-feature`)
6. Open a Pull Request

**Contribution Guidelines:**
- Follow existing code style (JSDoc comments, no TypeScript)
- Test on iOS Safari (primary target)
- Do NOT modify `mini-app/css/variables.css` colors (brand locked)
- Add tests for new API endpoints
- Update this README if adding features

---

## 📞 Contact & Support

**Maintainer:** [@g1orgi89](https://github.com/g1orgi89)  
**Project Lead:** Anna Busel ([annabusel.org](https://annabusel.org))  
**Issues:** [GitHub Issues](https://github.com/g1orgi89/reader-bot/issues)

For urgent support, contact the development team via Telegram.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for Anna Busel's Book Club Community**
