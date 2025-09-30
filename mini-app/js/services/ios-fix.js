/**
 * 🍎 iOS Fix Service - Simplified for single scroll architecture
 * 
 * Features:
 * - iOS device detection
 * - Add .ios-device class to documentElement
 * - Minimal interference with scroll architecture
 * 
 * NOTE: Most iOS fixes have been moved to CSS (ios-navigation-fix.css)
 * This service now only handles device detection.
 * 
 * @author Reader Bot Team
 */

/**
 * Detects if device is iOS
 * @returns {boolean} True if iOS device
 */
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Detects if device has touch capabilities
 * @returns {boolean} True if touch device
 */
const detectTouchDevice = () => {
  return ('ontouchstart' in window) ||
         (navigator.maxTouchPoints > 0) ||
         (navigator.msMaxTouchPoints > 0);
};

/**
 * iOS Fix Service Class
 */
class IOSFixService {
  constructor() {
    this.isIOS = isIOS();
    this.isInitialized = false;
    
    // Initialize if iOS device
    if (this.isIOS) {
      this.init();
    }
  }

  /**
   * Initialize iOS fixes
   */
  init() {
    if (this.isInitialized) return;
    
    console.log('🍎 Detected iOS device - adding .ios-device class');
    
    // Add .ios-device class for CSS targeting
    document.documentElement.classList.add('ios-device');
    
    this.isInitialized = true;
    console.log('✅ iOS device class added');
  }

  /**
   * Get current service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      isIOS: this.isIOS,
      isInitialized: this.isInitialized
    };
  }
}

// Initialize service instance
let iosFixService = null;

/**
 * Initialize iOS fixes if not already done
 * @returns {IOSFixService|null} Service instance or null if not iOS
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

// Export touch device detection
const isTouchDevice = detectTouchDevice();
window.isTouchDevice = isTouchDevice;