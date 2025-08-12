/**
 * 🍎 iOS Navigation Fix Service - Touch-only with keyboard handling
 * 
 * Features:
 * - Touch device detection via media queries
 * - Automatic nav-raised class on init for touch devices  
 * - Keyboard focus/blur handling only (no scroll-based logic)
 * - Root scroll isolation setup
 * - No inline style mutations on .bottom-nav
 * 
 * @author Reader Bot Team
 */

/**
 * Detects if device is touch-capable using media queries
 * @returns {boolean} True if touch device
 */
const isTouchDevice = () => {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
};

/**
 * iOS Navigation Fix Service Class
 */
class IOSFixService {
  constructor() {
    this.isTouchDevice = isTouchDevice();
    this.isInitialized = false;
    
    // Only initialize on touch devices
    if (this.isTouchDevice) {
      this.init();
    }
  }

  /**
   * Initialize iOS fixes for touch devices only
   */
  init() {
    if (this.isInitialized) return;
    
    console.log('🍎 Initializing iOS navigation fixes for touch device');
    
    // Add nav-raised class immediately on touch devices
    document.documentElement.classList.add('nav-raised');
    
    // Setup root scroll isolation
    this.setupRootScrollIsolation();
    
    // Setup keyboard handling (focus/blur only)
    this.setupKeyboardHandling();
    
    this.isInitialized = true;
    console.log('✅ iOS navigation fixes initialized');
  }

  /**
   * Setup root scroll isolation for mobile
   */
  setupRootScrollIsolation() {
    // Find content container via selectors
    const contentContainer = document.querySelector('.page-content') || 
                           document.querySelector('.page-body') || 
                           document.querySelector('.content') ||
                           document.querySelector('.app-content') ||
                           document.querySelector('.screen-content') ||
                           document.querySelector('#app .content');
    
    if (contentContainer) {
      // Content container found - apply root scroll isolation
      const html = document.documentElement;
      const body = document.body;
      
      html.style.height = '100%';
      html.style.overflow = 'hidden';
      body.style.height = '100%';
      body.style.overflow = 'hidden';
      
      // Mark that we have a content container for CSS targeting
      html.classList.add('has-content-container');
      
      // Ensure content container has proper scrolling
      contentContainer.style.overflowY = 'auto';
      contentContainer.style.webkitOverflowScrolling = 'touch';
      
      console.log('✅ Root scroll isolation configured with content container');
    } else {
      // No content container found - leave root scroll intact
      console.log('ℹ️ No content container found - keeping root scroll on html/body');
    }
  }

  /**
   * Setup keyboard handling - hide/show nav on focus/blur only
   */
  setupKeyboardHandling() {
    // Hide navigation on input focus
    window.addEventListener('focusin', (event) => {
      const target = event.target;
      
      // Only handle actual input elements
      if (target && (target.matches('input, textarea, select') || target.contentEditable === 'true')) {
        document.documentElement.classList.add('nav-hidden');
        console.log('🔒 Navigation hidden for keyboard input');
      }
    });

    // Show navigation on input blur
    window.addEventListener('focusout', (event) => {
      const target = event.target;
      
      // Only handle actual input elements
      if (target && (target.matches('input, textarea, select') || target.contentEditable === 'true')) {
        // Small delay to prevent flicker when switching between inputs
        setTimeout(() => {
          // Check if another input is now focused
          const activeElement = document.activeElement;
          const isStillFocusedOnInput = activeElement && 
            (activeElement.matches('input, textarea, select') || activeElement.contentEditable === 'true');
          
          if (!isStillFocusedOnInput) {
            document.documentElement.classList.remove('nav-hidden');
            console.log('🔓 Navigation shown after keyboard dismiss');
          }
        }, 100);
      }
    });

    console.log('✅ Keyboard handling configured');
  }

  /**
   * Get current service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      isTouchDevice: this.isTouchDevice,
      isInitialized: this.isInitialized,
      navRaised: document.documentElement.classList.contains('nav-raised'),
      navHidden: document.documentElement.classList.contains('nav-hidden')
    };
  }

  /**
   * Force enable/disable nav-raised state (for testing)
   * @param {boolean} enabled - Whether to enable raised state
   */
  setNavRaised(enabled) {
    if (!this.isTouchDevice) {
      console.warn('⚠️ Nav raised state only available on touch devices');
      return;
    }
    
    document.documentElement.classList.toggle('nav-raised', enabled);
    console.log(`🔧 Nav raised state ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Force hide/show navigation (for testing)
   * @param {boolean} hidden - Whether to hide navigation
   */
  setNavHidden(hidden) {
    document.documentElement.classList.toggle('nav-hidden', hidden);
    console.log(`🔧 Navigation ${hidden ? 'hidden' : 'shown'} via manual control`);
  }
}

// Initialize service instance
let iosFixService = null;

/**
 * Initialize iOS fixes if not already done
 * @returns {IOSFixService|null} Service instance or null if not touch device
 */
function initIOSFixes() {
  if (!iosFixService) {
    iosFixService = new IOSFixService();
  }
  return iosFixService;
}

/**
 * Get iOS fix service instance
 * @returns {IOSFixService|null} Service instance or null if not initialized
 */
function getIOSFixService() {
  return iosFixService;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIOSFixes);
} else {
  initIOSFixes();
}

// Export for global access
window.IOSFixService = IOSFixService;
window.initIOSFixes = initIOSFixes;
window.getIOSFixService = getIOSFixService;
window.isTouchDevice = isTouchDevice;