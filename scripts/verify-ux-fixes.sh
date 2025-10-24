#!/bin/bash

# UX Fixes Verification Script
# This script verifies that all UX fixes have been properly applied

echo "🔍 Verifying UX Fixes..."
echo ""

ERRORS=0
WARNINGS=0

# Check 1: Body overflow hidden
echo "📋 Check 1: Body overflow hidden"
if grep -A15 "^body {" mini-app/css/base.css | grep -q "overflow: hidden;"; then
    echo "  ✅ PASS: body has overflow: hidden"
else
    echo "  ❌ FAIL: body does not have overflow: hidden"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 2: Content no fixed height
echo "📋 Check 2: .content has no fixed height (only min-height)"
if grep -A20 "^\.content {" mini-app/css/base.css | grep -q "min-height: calc(100vh"; then
    if grep -A20 "^\.content {" mini-app/css/base.css | grep -q "height: calc(100vh" | grep -v "min-height"; then
        echo "  ⚠️  WARNING: .content might still have fixed height"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "  ✅ PASS: .content has no fixed height (only min-height)"
    fi
else
    echo "  ⚠️  WARNING: .content min-height not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 3: Keyboard open CSS rule
echo "📋 Check 3: Keyboard open bottom-nav hide rule"
if grep -q "body.keyboard-open .bottom-nav" mini-app/css/components/navigation.css; then
    echo "  ✅ PASS: keyboard-open rule exists"
else
    echo "  ❌ FAIL: keyboard-open rule not found"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 4: BottomNav id attribute
echo "📋 Check 4: BottomNav creates id=\"bottom-nav\""
if grep -q "\.id = 'bottom-nav'" mini-app/js/components/navigation/BottomNav.js; then
    echo "  ✅ PASS: BottomNav sets id attribute"
else
    echo "  ❌ FAIL: BottomNav doesn't set id attribute"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 5: BottomNav data-initialized guard
echo "📋 Check 5: BottomNav has data-initialized guard"
if grep -q "dataset.initialized" mini-app/js/components/navigation/BottomNav.js; then
    echo "  ✅ PASS: BottomNav has initialization guard"
else
    echo "  ❌ FAIL: BottomNav missing initialization guard"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 6: Viewport calculator debounce
echo "📋 Check 6: Viewport calculator has debounce"
if grep -q "minUpdateInterval" mini-app/js/utils/viewport-calculator.js; then
    echo "  ✅ PASS: Viewport calculator has debounce"
else
    echo "  ❌ FAIL: Viewport calculator missing debounce"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 7: Viewport calculator keyboard-open check
echo "📋 Check 7: Viewport calculator skips updates during keyboard-open"
if grep -q "keyboard-open" mini-app/js/utils/viewport-calculator.js && \
   grep -A5 "keyboard-open" mini-app/js/utils/viewport-calculator.js | grep -q "return;"; then
    echo "  ✅ PASS: Viewport calculator skips keyboard-open"
else
    echo "  ❌ FAIL: Viewport calculator doesn't skip keyboard-open"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 8: StatisticsService ISO week check in onQuoteAdded
echo "📋 Check 8: StatisticsService checks ISO week in onQuoteAdded"
if grep -q "_getIsoWeekKey" mini-app/js/services/StatisticsService.js && \
   grep -A30 "onQuoteAdded" mini-app/js/services/StatisticsService.js | grep -q "isCurrentWeek"; then
    echo "  ✅ PASS: onQuoteAdded checks ISO week"
else
    echo "  ❌ FAIL: onQuoteAdded doesn't check ISO week"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 9: Reports.css uses scoped selector
echo "📋 Check 9: Reports.css uses scoped .reports-page selector"
if grep -q "\.reports-page {" mini-app/css/pages/reports.css; then
    echo "  ✅ PASS: Reports uses scoped selector"
else
    echo "  ⚠️  WARNING: Reports.css might still use global .content"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 10: No syntax errors in JavaScript files
echo "📋 Check 10: JavaScript syntax validation"
JS_ERRORS=0
for file in mini-app/js/components/navigation/BottomNav.js \
            mini-app/js/utils/viewport-calculator.js \
            mini-app/js/services/StatisticsService.js; do
    if node -c "$file" 2>/dev/null; then
        echo "  ✅ $file: valid syntax"
    else
        echo "  ❌ $file: syntax error!"
        JS_ERRORS=$((JS_ERRORS + 1))
    fi
done
ERRORS=$((ERRORS + JS_ERRORS))
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 ALL CHECKS PASSED!"
    echo ""
    echo "✅ All UX fixes have been properly applied."
    echo "✅ Code is ready for manual testing."
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  WARNINGS: $WARNINGS"
    echo ""
    echo "✅ All critical checks passed, but some warnings were found."
    echo "✅ Code should be safe to test, but review warnings above."
    echo ""
    exit 0
else
    echo "❌ ERRORS: $ERRORS"
    echo "⚠️  WARNINGS: $WARNINGS"
    echo ""
    echo "❌ Some critical checks failed. Please review errors above."
    echo ""
    exit 1
fi
