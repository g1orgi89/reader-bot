/**
 * 🔍 iOS NAVIGATION DEBUGGER
 * ВЫЯСНЯЕМ БЛЯТЬ НАСТОЯЩУЮ ПРИЧИНУ ПРОБЛЕМЫ!
 */

class NavigationDebugger {
    constructor() {
        this.isDebugging = false;
        this.measurements = [];
        this.init();
    }

    init() {
        console.log('🔍 Navigation Debugger запущен');
        
        // Запускаем через 2 секунды после загрузки
        setTimeout(() => {
            this.startDebugging();
        }, 2000);
        
        // Слушаем события скролла
        this.setupScrollListener();
        
        // Слушаем изменения размера
        this.setupResizeListener();
        
        // Слушаем касания
        this.setupTouchListener();
    }

    startDebugging() {
        this.isDebugging = true;
        console.log('🚨 НАЧИНАЕМ ДИАГНОСТИКУ НАВИГАЦИИ');
        
        // Измеряем изначальное состояние
        this.measureNavigation('INITIAL');
        
        // Измеряем каждые 100мс
        this.debugInterval = setInterval(() => {
            this.measureNavigation('INTERVAL');
        }, 100);
        
        // Создаем визуальный индикатор
        this.createDebugOverlay();
    }

    measureNavigation(trigger) {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) return;

        const rect = nav.getBoundingClientRect();
        const computed = window.getComputedStyle(nav);
        
        const measurement = {
            timestamp: Date.now(),
            trigger: trigger,
            position: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height
            },
            computed: {
                position: computed.position,
                bottom: computed.bottom,
                transform: computed.transform,
                zIndex: computed.zIndex,
                contain: computed.contain,
                isolation: computed.isolation
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                scrollY: window.scrollY,
                visualViewport: window.visualViewport ? {
                    width: window.visualViewport.width,
                    height: window.visualViewport.height,
                    offsetTop: window.visualViewport.offsetTop
                } : null
            },
            document: {
                scrollHeight: document.documentElement.scrollHeight,
                clientHeight: document.documentElement.clientHeight
            }
        };
        
        this.measurements.push(measurement);
        
        // Проверяем на аномалии
        this.checkForAnomalies(measurement);
        
        // Обновляем визуальный индикатор
        this.updateDebugOverlay(measurement);
    }

    checkForAnomalies(measurement) {
        const nav = document.querySelector('.bottom-nav');
        const expectedBottom = window.innerHeight;
        const actualBottom = measurement.position.bottom;
        const deviation = Math.abs(expectedBottom - actualBottom);
        
        if (deviation > 50) {
            console.error('🚨 АНОМАЛИЯ ОБНАРУЖЕНА!', {
                trigger: measurement.trigger,
                expectedBottom: expectedBottom,
                actualBottom: actualBottom,
                deviation: deviation,
                navRect: measurement.position,
                computed: measurement.computed
            });
            
            // Дополнительная диагностика
            this.deepDiagnosis(nav);
        }
    }

    deepDiagnosis(nav) {
        console.group('🔬 ГЛУБОКАЯ ДИАГНОСТИКА');
        
        // Проверяем родителей
        let parent = nav.parentElement;
        while (parent) {
            const parentStyles = window.getComputedStyle(parent);
            console.log(`👨‍👦 Родитель ${parent.tagName}:`, {
                position: parentStyles.position,
                transform: parentStyles.transform,
                overflow: parentStyles.overflow,
                contain: parentStyles.contain,
                isolation: parentStyles.isolation
            });
            parent = parent.parentElement;
            if (parent === document.body) break;
        }
        
        // Проверяем конфликтующие CSS
        const allStyles = [];
        for (let sheet of document.styleSheets) {
            try {
                for (let rule of sheet.cssRules) {
                    if (rule.selectorText && rule.selectorText.includes('.bottom-nav')) {
                        allStyles.push({
                            selector: rule.selectorText,
                            cssText: rule.cssText
                        });
                    }
                }
            } catch (e) {
                // CORS блокировка
            }
        }
        console.log('📋 CSS правила для .bottom-nav:', allStyles);
        
        // Проверяем вычисленные стили
        const computed = window.getComputedStyle(nav);
        console.log('💻 Все вычисленные стили:', {
            position: computed.position,
            top: computed.top,
            bottom: computed.bottom,
            left: computed.left,
            right: computed.right,
            transform: computed.transform,
            transformOrigin: computed.transformOrigin,
            willChange: computed.willChange,
            contain: computed.contain,
            isolation: computed.isolation,
            zIndex: computed.zIndex,
            display: computed.display,
            width: computed.width,
            height: computed.height
        });
        
        console.groupEnd();
    }

    setupScrollListener() {
        let lastScrollTop = 0;
        
        window.addEventListener('scroll', (e) => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const direction = scrollTop > lastScrollTop ? 'DOWN' : 'UP';
            
            this.measureNavigation(`SCROLL_${direction}`);
            lastScrollTop = scrollTop;
        }, { passive: true });
    }

    setupResizeListener() {
        window.addEventListener('resize', () => {
            this.measureNavigation('RESIZE');
        });
        
        // Visual Viewport API для iOS
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                this.measureNavigation('VISUAL_VIEWPORT_RESIZE');
            });
        }
    }

    setupTouchListener() {
        document.addEventListener('touchstart', () => {
            this.measureNavigation('TOUCH_START');
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            this.measureNavigation('TOUCH_END');
        }, { passive: true });
    }

    createDebugOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'nav-debug-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 99999;
            pointer-events: none;
            max-width: 300px;
        `;
        document.body.appendChild(overlay);
    }

    updateDebugOverlay(measurement) {
        const overlay = document.getElementById('nav-debug-overlay');
        if (!overlay) return;
        
        const nav = document.querySelector('.bottom-nav');
        const rect = nav.getBoundingClientRect();
        
        overlay.innerHTML = `
            <div>🔍 NAV DEBUG</div>
            <div>Position: ${measurement.computed.position}</div>
            <div>Bottom: ${Math.round(rect.bottom)}px (expected: ${window.innerHeight}px)</div>
            <div>Transform: ${measurement.computed.transform}</div>
            <div>Scroll: ${window.scrollY}px</div>
            <div>Viewport: ${window.innerWidth}x${window.innerHeight}</div>
            <div>Trigger: ${measurement.trigger}</div>
        `;
    }

    // Экспорт данных для анализа
    exportDiagnostics() {
        const data = {
            userAgent: navigator.userAgent,
            measurements: this.measurements,
            timestamp: new Date().toISOString()
        };
        
        console.log('📊 ПОЛНАЯ ДИАГНОСТИКА:', data);
        
        // Создаем ссылку для скачивания
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'navigation-debug.json';
        a.click();
        
        return data;
    }

    stop() {
        this.isDebugging = false;
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
        }
        
        const overlay = document.getElementById('nav-debug-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        console.log('🔍 Navigation Debugger остановлен');
    }
}

// Автоматический запуск в debug режиме
if (window.location.search.includes('debug=nav') || window.location.hash.includes('debug')) {
    window.navigationDebugger = new NavigationDebugger();
}

// Глобальные команды для debug
window.debugNavigation = {
    start: () => {
        if (!window.navigationDebugger) {
            window.navigationDebugger = new NavigationDebugger();
        }
    },
    stop: () => {
        if (window.navigationDebugger) {
            window.navigationDebugger.stop();
        }
    },
    measure: () => {
        if (window.navigationDebugger) {
            window.navigationDebugger.measureNavigation('MANUAL');
        }
    },
    export: () => {
        if (window.navigationDebugger) {
            return window.navigationDebugger.exportDiagnostics();
        }
    }
};

console.log('🔍 Navigation Debug доступен через window.debugNavigation');
console.log('🚀 Запустить: window.debugNavigation.start()');
console.log('📊 Экспорт: window.debugNavigation.export()');
