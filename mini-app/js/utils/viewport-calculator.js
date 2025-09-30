/**
 * 🔧 VIEWPORT HEIGHT CALCULATOR (ИСПРАВЛЕН)
 * 
 * Динамически вычисляет правильную высоту контента на основе 
 * РЕАЛЬНЫХ размеров header и navigation элементов
 * 
 * 🔧 ИСПРАВЛЕНО: Обновляет ОСНОВНЫЕ CSS переменные после удаления хедеров
 * 
 * @version 1.1.0
 */

class ViewportHeightCalculator {
    constructor() {
        this.isActive = false;
        this.lastUpdateTime = 0; // 🔧 FIX: Add debounce tracking
        this.minUpdateInterval = 150; // 🔧 FIX: Minimum 150ms between updates
        
        // Привязываем методы к контексту
        this.updateViewportHeight = this.updateViewportHeight.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        console.log('🔧 ViewportHeightCalculator initialized v1.2.0 with debounce');
    }

    /**
     * 🚀 Запуск калькулятора
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        
        // Обновляем сразу
        this.updateViewportHeight();
        
        // Обновляем при изменении размеров
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleResize);
        
        // Обновляем при изменениях DOM (появление/исчезновение header)
        if (window.MutationObserver) {
            this.observer = new MutationObserver(() => {
                setTimeout(this.updateViewportHeight, 100); // Небольшая задержка для DOM
            });
            
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        
        // Telegram специфичные события
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.onEvent('viewportChanged', this.handleResize);
        }
        
        console.log('✅ ViewportHeightCalculator started');
    }

    /**
     * ⏹️ Остановка калькулятора
     */
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        console.log('⏹️ ViewportHeightCalculator stopped');
    }

    /**
     * 📏 Основная функция - обновление viewport высоты
     */
    updateViewportHeight() {
        try {
            // 🔧 FIX: Check for page-content first
            const pageContent = document.getElementById('page-content');
            if (!pageContent) {
                console.warn('[viewport] ⚠️ No scroll container (#page-content) detected - using body');
            } else if (pageContent.clientHeight <= 0) {
                console.warn('[viewport] ⚠️ page-content has no height (clientHeight=0)');
            }
            
            // 🔧 FIX: Skip updates when keyboard is open to prevent layout jumps
            const isKeyboardOpen = document.body.classList.contains('keyboard-open');
            if (isKeyboardOpen) {
                console.log('🔧 Skipping viewport update - keyboard is open');
                return;
            }
            
            // 🔧 FIX: Debounce - skip if updated too recently
            const now = Date.now();
            if (now - this.lastUpdateTime < this.minUpdateInterval) {
                console.log('🔧 Skipping viewport update - too soon (debounce)');
                return;
            }
            this.lastUpdateTime = now;
            
            const realSizes = this.measureRealElementSizes();

            const tg = window.Telegram?.WebApp;
            const baseHeight = tg?.viewportHeight || window.innerHeight;
            
            // Используем стабильную высоту во время открытой клавиатуры
            let telegramHeight = baseHeight;
            
            // Рассчитываем доступную высоту для контента
            const availableHeight = telegramHeight - realSizes.headerHeight - realSizes.bottomNavHeight;
            
            // 🔧 ИСПРАВЛЕНО: Обновляем ОСНОВНЫЕ CSS переменные
            // Эти переменные используются в base.css для расчета высоты контента
            document.documentElement.style.setProperty('--header-height', `${realSizes.headerHeight}px`);
            document.documentElement.style.setProperty('--bottom-nav-height', `${realSizes.bottomNavHeight}px`);
            
            // Дополнительные переменные для отладки
            document.documentElement.style.setProperty('--real-header-height', `${realSizes.headerHeight}px`);
            document.documentElement.style.setProperty('--real-bottom-nav-height', `${realSizes.bottomNavHeight}px`);
            document.documentElement.style.setProperty('--real-available-height', `${availableHeight}px`);
            document.documentElement.style.setProperty('--real-viewport-height', `${telegramHeight}px`);
            
            console.log('🔧 Viewport heights updated:', {
                viewport: telegramHeight,
                stable: tg?.viewportStableHeight,
                keyboardOpen: false,
                realHeader: realSizes.headerHeight,
                realNav: realSizes.bottomNavHeight,
                available: availableHeight,
                page: this.getCurrentPage(),
                pageContentExists: !!pageContent,
                pageContentHeight: pageContent ? pageContent.clientHeight : 0,
                updated: {
                    '--header-height': `${realSizes.headerHeight}px`,
                    '--bottom-nav-height': `${realSizes.bottomNavHeight}px`
                }
            });
            
        } catch (error) {
            console.error('❌ ViewportHeightCalculator error:', error);
        }
    }

    /**
     * 📏 Измерение реальных размеров элементов
     */
    measureRealElementSizes() {
        let headerHeight = 0;
        let bottomNavHeight = 0;

        // 🔧 НОВОЕ: Поиск встроенного блока аватара на главной странице
        const inlineHeaderSelectors = ['.user-header-inline', '.home-header-inline'];
        for (const selector of inlineHeaderSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                headerHeight = element.getBoundingClientRect().height;
                console.log(`📏 Found inline header: ${selector} = ${headerHeight}px`);
                break;
            }
        }

        // Ищем обычные header элементы (не должны быть после удаления хедеров!)
        if (headerHeight === 0) {
            const headerSelectors = ['.header', '#header', 'header', '.top-nav', '.app-header', '.page-header'];
            for (const selector of headerSelectors) {
                const element = document.querySelector(selector);
                if (element && this.isElementVisible(element)) {
                    headerHeight = element.getBoundingClientRect().height;
                    console.log(`⚠️ Found external header: ${selector} = ${headerHeight}px (should be removed!)`);
                    break;
                }
            }
        }

        // 🔧 ИСПРАВЛЕНО: Ищем bottom navigation с защитой от дубликатов
        const navSelectors = ['.bottom-nav', '#bottom-nav', '.navigation', '.nav-bottom', '.footer-nav'];
        const allNavElements = [];
        
        for (const selector of navSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element && this.isElementVisible(element)) {
                    allNavElements.push({
                        element,
                        selector,
                        height: element.getBoundingClientRect().height
                    });
                }
            });
        }
        
        // Фильтруем только видимые элементы с положительной высотой
        const visibleNavElements = allNavElements.filter(item => item.height > 0);
        
        if (visibleNavElements.length > 1) {
            console.warn(`⚠️ Found ${visibleNavElements.length} visible bottom navigation elements! This may cause issues.`);
            console.warn('⚠️ To fix: Ensure BottomNav.js creates only one .bottom-nav with id="bottom-nav"');
            visibleNavElements.forEach((item, index) => {
                console.warn(`  Nav ${index + 1}: ${item.selector} = ${item.height}px`, item.element);
            });
            
            // Используем элемент с максимальной высотой (скорее всего правильный)
            const maxHeightNav = visibleNavElements.reduce((prev, current) => 
                current.height > prev.height ? current : prev
            );
            bottomNavHeight = maxHeightNav.height;
            console.log(`📏 Using largest bottom nav: ${maxHeightNav.selector} = ${bottomNavHeight}px`);
        } else if (visibleNavElements.length === 1) {
            bottomNavHeight = visibleNavElements[0].height;
            console.log(`📏 Found bottom nav: ${visibleNavElements[0].selector} = ${bottomNavHeight}px`);
        } else {
            console.warn('⚠️ No visible bottom navigation found');
        }

        // 🔧 НОВОЕ: Логирование для отладки
        console.log('📏 Real element sizes measured:', {
            headerHeight,
            bottomNavHeight,
            currentPage: this.getCurrentPage(),
            navElementsFound: visibleNavElements.length
        });

        return {
            headerHeight,
            bottomNavHeight
        };
    }

    /**
     * 👁️ Проверка видимости элемента
     */
    isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.height > 0 &&
            rect.width > 0
        );
    }

    /**
     * 📱 Определение текущей страницы
     */
    getCurrentPage() {
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            return activeNav.getAttribute('data-page') || 'unknown';
        }
        return 'unknown';
    }

    /**
     * 📡 Обработчик изменения размеров
     */
    handleResize() {
        // Задержка для стабилизации после resize
        setTimeout(() => {
            if (this.isActive) {
                this.updateViewportHeight();
            }
        }, 300);
    }
}

// Экспорт и глобальная доступность
window.ViewportHeightCalculator = ViewportHeightCalculator;

// 🚀 Автоматический запуск
if (typeof window !== 'undefined') {
    // Запускаем калькулятор после полной загрузки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                window.viewportCalculator = new ViewportHeightCalculator();
                window.viewportCalculator.start();
                console.log('🔧 ViewportCalculator auto-started after DOMContentLoaded');
            }, 1000); // Даем время другим скриптам инициализироваться
        });
    } else {
        setTimeout(() => {
            window.viewportCalculator = new ViewportHeightCalculator();
            window.viewportCalculator.start();
            console.log('🔧 ViewportCalculator auto-started immediately');
        }, 1000);
    }
}

console.log('🔧 ViewportHeightCalculator module loaded v1.2.0');