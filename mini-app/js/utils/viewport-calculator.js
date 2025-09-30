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
        
        // Привязываем методы к контексту
        this.updateViewportHeight = this.updateViewportHeight.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        console.log('🔧 ViewportHeightCalculator initialized');
    }

    /**
     * 🚀 Запуск калькулятора
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        
        // Первоначальное обновление
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
            const realSizes = this.measureRealElementSizes();

            const tg = window.Telegram?.WebApp;
            const baseHeight = tg?.viewportHeight || window.innerHeight;
            
            // Используем стабильную высоту во время открытой клавиатуры
            let telegramHeight = baseHeight;
            
            // Рассчитываем доступную высоту для контента
            const availableHeight = telegramHeight - realSizes.headerHeight - realSizes.bottomNavHeight;
            
            // Обновляем ОСНОВНЫЕ CSS переменные
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
                realNav: realSizes.bottomNavHeight,
                available: availableHeight
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
            console.warn(`⚠️ Found ${visibleNavElements.length} visible bottom navigation elements!`);
            
            // Используем элемент с максимальной высотой (скорее всего правильный)
            const maxHeightNav = visibleNavElements.reduce((prev, current) => 
                current.height > prev.height ? current : prev
            );
            bottomNavHeight = maxHeightNav.height;
        } else if (visibleNavElements.length === 1) {
            bottomNavHeight = visibleNavElements[0].height;
        }

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