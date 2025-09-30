# Scroll Architecture Documentation

## Overview
This document describes the unified scroll architecture for the Telegram Mini App.

## Architecture - Single Scroll Container

The app uses a clean, single-scroll-container architecture without experimental frameworks or workarounds.

### Structure

```
body (overflow: hidden)
└── .app-container (flex column)
    ├── #page-content (flex: 1, overflow-y: auto) ← SCROLLS HERE
    │   └── .content (padding only)
    │       └── Page content
    └── .bottom-nav (fixed height)
```

### Key Principles

#### 1. Body Scroll Prevention (`css/base.css`)
```css
body {
    overflow: hidden; /* Only #page-content scrolls */
}
```

#### 2. Single Scroll Container (`css/base.css`)
```css
#page-content,
.page-content {
    flex: 1;
    min-height: 0; /* Critical for flex shrinking */
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
}
```

#### 3. Content Class - Padding Only (`css/base.css`)
```css
.content {
    width: 100%;
    padding: 16px;
    /* NO height, NO overflow */
}
```

#### 4. Static Bottom Navigation
```html
<nav id="bottom-nav" class="bottom-nav">
  <!-- Navigation items -->
</nav>
```

## Implementation Details

- **#page-content** is defined in `index.html` as part of the static HTML structure
- No JavaScript manipulation of scroll containers
- No dynamic scroll framework initialization
- No `.has-scroll-container` class management
- Clean separation: CSS handles layout, HTML provides structure

## Files Involved

### HTML
- `mini-app/index.html` - Contains #page-content and .bottom-nav structure

### CSS
- `mini-app/css/base.css` - Defines body, #page-content, .content styles

### JavaScript
- `mini-app/js/core/App.js` - No scroll framework code

## Testing

### Browser Console Quick Test
```javascript
(() => {
  const pc = document.getElementById('page-content');
  return {
    navs: document.querySelectorAll('nav.bottom-nav').length,
    pcOv: pc && getComputedStyle(pc).overflowY,
    pcH: pc && pc.clientHeight,
    pcSH: pc && pc.scrollHeight,
    bodyOv: getComputedStyle(document.body).overflow
  };
})()
```

### Expected Results
```javascript
{
  navs: 1,           // Exactly 1 navigation
  pcOv: 'auto',      // Overflow enabled
  pcH: 650,          // Has height
  pcSH: 1500,        // Scrollable (when content overflows)
  bodyOv: 'hidden'   // Body doesn't scroll
}
```

### Manual Test Scenarios
1. ✅ Navigate to /home → scroll down
2. ✅ Navigate to /diary (many quotes) → scroll works, nav fixed
3. ✅ Navigate to /reports → scroll works
4. ✅ Rapid navigation 3x → no duplicate navs
5. ✅ Check console → no warnings about scroll architecture

## Verification Checklist
- [x] `document.querySelectorAll('nav.bottom-nav').length === 1`
- [x] `#page-content.scrollHeight > #page-content.clientHeight` (when content overflows)
- [x] `getComputedStyle(document.body).overflow === 'hidden'`
- [x] `getComputedStyle(#page-content).overflowY === 'auto'`
- [x] No experimental scroll framework code
- [x] No `.has-scroll-container` class in code
- [x] No duplicate vertical scrollbars
- [x] No console warnings about scroll architecture

## Design Philosophy

**Keep it simple:**
- HTML defines structure
- CSS defines layout and scroll behavior  
- JavaScript focuses on business logic, not layout management

This approach is:
- ✅ More maintainable
- ✅ More predictable
- ✅ Better for performance
- ✅ Easier to debug
- ✅ Less prone to edge cases

## Previous Iterations

This architecture evolved from:
1. **Legacy**: Double scroll (body + .content) - caused confusion
2. **Experimental**: Scroll Safety Framework - added complexity
3. **Current**: Unified #page-content - clean and simple

The experimental framework was removed in favor of this clean architecture that relies on standard CSS flexbox and overflow properties.

