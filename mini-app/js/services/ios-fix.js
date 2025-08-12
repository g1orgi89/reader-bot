/**
 * Updated iOS fixes (mobile-only raised state, no inline styles on .bottom-nav)
 */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

class IOSFixes {
  constructor() {
    this.isIOSDevice = isIOS();
    this.keyboardVisible = false;
    this.originalViewportHeight = window.innerHeight;
    if (this.isIOSDevice) this.init();
  }

  init() {
    this.setupViewportFix();
    this.setupSafeAreaSupport();
    this.setupScrollFixes();
    this.setupKeyboardHandling();
    this.setupTelegramSpecificFixes();
    this.setupRaisedNavOnScroll(); // NEW
    console.log('🍎 iOS фиксы активированы');
  }

  setupViewportFix() {
    const updateVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      const diff = this.originalViewportHeight - window.innerHeight;
      this.keyboardVisible = diff > 150;
      document.documentElement.classList.toggle('keyboard-visible', this.keyboardVisible);
    };
    window.addEventListener('resize', updateVH);
    window.addEventListener('orientationchange', () => setTimeout(updateVH, 100));
    updateVH();
  }

  setupSafeAreaSupport() {
    if (CSS.supports('top: env(safe-area-inset-top)')) {
      document.documentElement.classList.add('supports-safe-area');
      const style = document.createElement('style');
      style.textContent = `:root{--safe-area-top: env(safe-area-inset-top,0px);--safe-area-bottom: env(safe-area-inset-bottom,0px);--safe-area-left: env(safe-area-inset-left,0px);--safe-area-right: env(safe-area-inset-right,0px);}`;
      document.head.appendChild(style);
    }
  }

  setupScrollFixes() {
    document.body.addEventListener('touchmove', (e) => {
      const scrollable = e.target.closest('.scrollable, .modal-content, .page-content, .content');
      if (!scrollable) e.preventDefault();
    }, { passive: false });
  }

  setupKeyboardHandling() {
    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => this.handleKeyboardToggle(), 100);
    });
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, textarea')) this.handleInputFocus(e.target);
    });
    document.addEventListener('focusout', (e) => {
      if (e.target.matches('input, textarea')) this.handleInputBlur(e.target);
    });
  }

  handleKeyboardToggle() {
    const root = document.documentElement;
    if (this.keyboardVisible) {
      root.classList.add('nav-hidden');
      if (window.Telegram?.WebApp?.expand) window.Telegram.WebApp.expand();
    } else {
      root.classList.remove('nav-hidden');
    }
  }

  handleInputFocus(input) {
    setTimeout(() => {
      const rect = input.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom > vh * 0.5) input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    input.classList.add('input-focused');
  }
  handleInputBlur(input) {
    input.classList.remove('input-focused');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  }

  setupTelegramSpecificFixes() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.expand?.();
    tg.setHeaderColor?.('#D2452C');
    tg.setBackgroundColor?.('#F5F2EC');
    tg.onEvent?.('themeChanged', () => this.updateThemeColors());
  }
  updateThemeColors() {
    const tg = window.Telegram.WebApp;
    const isDark = tg.colorScheme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    tg.setHeaderColor?.(isDark ? '#E85A42' : '#D2452C');
    tg.setBackgroundColor?.(isDark ? '#1A1A1A' : '#F5F2EC');
  }

  // NEW: mobile-only raised state toggle without touching .bottom-nav
  setupRaisedNavOnScroll() {
    const isMobilePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isMobilePointer) return; // desktop unaffected

    const root = document.documentElement;
    const scroller = document.getElementById('page-content') || window;
    let lastY = 0;
    let ticking = false;

    const getY = () => scroller === window ? window.scrollY : scroller.scrollTop;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = getY();
        const delta = y - lastY;
        if (y > 16 && delta > 2) {
          root.classList.add('nav-raised');
        } else if (delta < -2) {
          root.classList.remove('nav-raised');
        }
        lastY = y;
        ticking = false;
      });
    };

    (scroller === window ? window : scroller).addEventListener('scroll', onScroll, { passive: true });
  }

  addIOSStyles() {
    const style = document.createElement('style');
    style.id = 'ios-fixes-styles';
    style.textContent = `
      .ios-device{ height: 100dvh; overflow-x: hidden; }
      .modal-overlay{ height: 100dvh; height: calc(var(--vh, 1vh) * 100); }
      .keyboard-visible .bottom-nav{ transition: transform 0.3s ease; }
      .supports-safe-area .header, .supports-safe-area .home-header, .supports-safe-area .page-header{ padding-top: calc(16px + var(--safe-area-top)); }
      .supports-safe-area .bottom-nav{ padding-bottom: calc(8px + var(--safe-area-bottom)); }
      .scrollable, .modal-content, .content{ -webkit-overflow-scrolling: touch; overflow-y: auto; }
    `;
    document.head.appendChild(style);
    if (this.isIOSDevice) document.documentElement.classList.add('ios-device');
  }
}

let iosFixes = null;
function initIOSFixes(){ if(isIOS() && !iosFixes){ iosFixes = new IOSFixes(); iosFixes.addIOSStyles(); window.iosFixes = iosFixes; } }
function isIOSFixesActive(){ return iosFixes !== null; }
if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', initIOSFixes); } else { initIOSFixes(); }
window.IOSFixes = IOSFixes; window.initIOSFixes = initIOSFixes; window.isIOSFixesActive = isIOSFixesActive; window.isIOS = isIOS;