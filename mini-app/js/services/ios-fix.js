/**
 * iOS Fix Service - Touch-only navigation with Instagram-style raised state
 * - No scroll-based navigation toggling 
 * - Touch device detection and html.nav-raised class once on init
 * - Keyboard handling via .nav-hidden class only
 * - No inline style mutations on .bottom-nav element
 * - Root scroll isolation setup
 */

/**
 * iOS device detection utility
 * @returns {boolean} True if iOS device
 */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Touch device detection utility  
 * @returns {boolean} True if touch device
 */
const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

class IOSFixes {
  constructor() {
    this.isIOSDevice = isIOS();
    this.isTouchDevice = isTouchDevice();
    this.keyboardVisible = false;
    this.originalViewportHeight = window.innerHeight;
    
    if (this.isIOSDevice || this.isTouchDevice) {
      this.init();
    }
  }

  /**
   * Initialize iOS fixes
   */
  init() {
    this.setupRootScrollIsolation();
    this.setupTouchOnlyRaisedNav();
    this.setupViewportFix();
    this.setupSafeAreaSupport();
    this.setupKeyboardHandling();
    this.setupTelegramSpecificFixes();
    
    console.log('🍎 iOS fixes activated (touch-only raised nav)');
  }

  /**
   * Setup root scroll isolation for mobile
   */
  setupRootScrollIsolation() {
    if (!this.isTouchDevice) return;
    
    // Disable root scrolling on touch devices
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    
    // Ensure content container has proper scrolling
    const pageContent = document.getElementById('page-content') || 
                       document.querySelector('.page-content') ||
                       document.querySelector('.page-body') ||
                       document.querySelector('.content');
    
    if (pageContent) {
      pageContent.style.overflowY = 'auto';
      pageContent.style.webkitOverflowScrolling = 'touch';
      pageContent.style.height = '100vh';
      pageContent.style.height = '100dvh';
    }
    
    console.log('🔧 Root scroll isolation enabled');
  }

  /**
   * Setup touch-only raised navigation (Instagram-style)
   * No scroll-based toggling - just set once and done
   */
  setupTouchOnlyRaisedNav() {
    if (!this.isTouchDevice) {
      console.log('🖥️ Desktop detected - nav remains unchanged');
      return;
    }
    
    // Set raised state once for touch devices
    document.documentElement.classList.add('nav-raised');
    console.log('📱 Always-raised nav activated for touch device');
  }

  /**
   * Setup viewport height fixes
   */
  setupViewportFix() {
    const updateVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      // Detect keyboard state based on height change
      const diff = this.originalViewportHeight - window.innerHeight;
      this.keyboardVisible = diff > 150;
      
      // Update keyboard state class
      document.documentElement.classList.toggle('keyboard-visible', this.keyboardVisible);
    };
    
    window.addEventListener('resize', updateVH);
    window.addEventListener('orientationchange', () => setTimeout(updateVH, 100));
    updateVH();
  }

  /**
   * Setup safe area support
   */
  setupSafeAreaSupport() {
    if (CSS.supports('top: env(safe-area-inset-top)')) {
      document.documentElement.classList.add('supports-safe-area');
      
      const style = document.createElement('style');
      style.textContent = `
        :root {
          --safe-area-top: env(safe-area-inset-top, 0px);
          --safe-area-bottom: env(safe-area-inset-bottom, 0px);
          --safe-area-left: env(safe-area-inset-left, 0px);
          --safe-area-right: env(safe-area-inset-right, 0px);
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Setup keyboard handling - only toggle .nav-hidden class
   */
  setupKeyboardHandling() {
    let debounceTimer;
    
    // Handle resize events for keyboard detection
    window.addEventListener('resize', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.handleKeyboardToggle(), 100);
    });
    
    // Handle input focus/blur events
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, textarea, [contenteditable="true"]')) {
        this.handleInputFocus(e.target);
      }
    });
    
    document.addEventListener('focusout', (e) => {
      if (e.target.matches('input, textarea, [contenteditable="true"]')) {
        this.handleInputBlur(e.target);
      }
    });
  }

  /**
   * Handle keyboard toggle - only class changes, no inline styles
   */
  handleKeyboardToggle() {
    const root = document.documentElement;
    
    if (this.keyboardVisible) {
      // Hide nav when keyboard is visible
      root.classList.add('nav-hidden');
      if (window.Telegram?.WebApp?.expand) {
        window.Telegram.WebApp.expand();
      }
    } else {
      // Show nav when keyboard is hidden
      root.classList.remove('nav-hidden');
    }
  }

  /**
   * Handle input focus
   * @param {HTMLElement} input - Input element
   */
  handleInputFocus(input) {
    setTimeout(() => {
      const rect = input.getBoundingClientRect();
      const vh = window.innerHeight;
      
      if (rect.bottom > vh * 0.5) {
        input.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 300);
    
    input.classList.add('input-focused');
  }

  /**
   * Handle input blur
   * @param {HTMLElement} input - Input element
   */
  handleInputBlur(input) {
    input.classList.remove('input-focused');
    
    // Return to top after input blur
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }

  /**
   * Setup Telegram-specific fixes
   */
  setupTelegramSpecificFixes() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    
    // Expand and configure Telegram WebApp
    tg.expand?.();
    tg.setHeaderColor?.('#D2452C');
    tg.setBackgroundColor?.('#F5F2EC');
    
    // Handle theme changes
    tg.onEvent?.('themeChanged', () => this.updateThemeColors());
    
    // Disable vertical swipes on iOS to prevent navigation drift
    if (this.isIOSDevice && tg.disableVerticalSwipes) {
      tg.disableVerticalSwipes();
      console.log('🔧 iOS: Vertical swipes disabled');
    }
  }

  /**
   * Update theme colors based on Telegram theme
   */
  updateThemeColors() {
    const tg = window.Telegram.WebApp;
    const isDark = tg.colorScheme === 'dark';
    
    document.body.classList.toggle('dark-theme', isDark);
    
    tg.setHeaderColor?.(isDark ? '#E85A42' : '#D2452C');
    tg.setBackgroundColor?.(isDark ? '#1A1A1A' : '#F5F2EC');
  }

  /**
   * Add iOS-specific styles
   */
  addIOSStyles() {
    const style = document.createElement('style');
    style.id = 'ios-fixes-styles';
    style.textContent = `
      .ios-device { 
        height: 100dvh; 
        overflow-x: hidden; 
      }
      .supports-safe-area .bottom-nav { 
        padding-bottom: calc(8px + var(--safe-area-bottom)); 
      }
      .keyboard-visible .bottom-nav { 
        transition: transform 0.3s ease; 
      }
    `;
    document.head.appendChild(style);
    
    if (this.isIOSDevice) {
      document.documentElement.classList.add('ios-device');
    }
  }
}

// Initialize fixes
let iosFixes = null;

/**
 * Initialize iOS fixes
 */
function initIOSFixes() {
  if ((isIOS() || isTouchDevice()) && !iosFixes) {
    iosFixes = new IOSFixes();
    iosFixes.addIOSStyles();
    window.iosFixes = iosFixes;
  }
}

/**
 * Check if iOS fixes are active
 * @returns {boolean} True if fixes are active
 */
function isIOSFixesActive() {
  return iosFixes !== null;
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIOSFixes);
} else {
  initIOSFixes();
}

// Export for global access
window.IOSFixes = IOSFixes;
window.initIOSFixes = initIOSFixes;
window.isIOSFixesActive = isIOSFixesActive;
window.isIOS = isIOS;
window.isTouchDevice = isTouchDevice;