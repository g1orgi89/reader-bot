# CLEANUP: Old Handlers Removal Plan

## Problem Identified
The main `telegram/index.js` was importing old handlers instead of modern ones:

**OLD (REMOVED):**
- `OnboardingHandler` from `./handlers/onboardingHandler`
- `QuoteHandler` from `./handlers/quoteHandler`  
- `NavigationHandler` from `./handlers/navigationHandler`

**NEW (NOW ACTIVE):**
- `ModernOnboardingHandler` from `./handlers/modernOnboardingHandler`
- `ModernQuoteHandler` from `./handlers/modernQuoteHandler`
- `ModernNavigationHandler` from `./handlers/modernNavigationHandler`

## Files to Remove
The following old handler files should be deleted as they conflict with modern UX:

1. `telegram/handlers/onboardingHandler.js` - OLD basic onboarding
2. `telegram/handlers/quoteHandler.js` - OLD quote processing  
3. `telegram/handlers/navigationHandler.js` - OLD navigation without modern UX

## Files to Keep
These handlers are still needed:

- `telegram/handlers/modernOnboardingHandler.js` ✅
- `telegram/handlers/modernQuoteHandler.js` ✅
- `telegram/handlers/modernNavigationHandler.js` ✅
- `telegram/handlers/commandHandler.js` ✅
- `telegram/handlers/complexQuestionHandler.js` ✅
- `telegram/handlers/feedbackHandler.js` ✅
- `telegram/handlers/weeklyReportHandler.js` ✅

## Status
- ✅ Fixed imports in `telegram/index.js` to use modern handlers
- ⏳ Need to remove old conflicting handler files
- ✅ Modern UX system is now active

After removing the old handlers, the modern UX with visual panels, progress bars, and elegant navigation will work properly.