/**
 * 📱 VIEWPORT TRACKER для диагностики проблем Mini App
 * 
 * Отслеживает viewport изменения, собирает данные о проблемах
 * и отправляет их на сервер для анализа и исправления
 * 
 * @filesize ~6KB
 * @version 1.0.0
 */

/**
 * @typedef {Object} ViewportData
 * @property {number} innerHeight
 * @property {number} innerWidth
 * @property {number} telegramHeight
 * @property {number} calculatedContentHeight
 * @property {number} actualContentHeight
 * @property {number} difference
 */

class ViewportTracker {
    /**
     * @type {string} - Уникальный ID сессии
     */
    sessionId = null;

    /**
     * @type {boolean} - Активен ли трекер
     */
    isActive = false;

    /**
     * @type {number} - Интервал отправки данных (ms)
     */
    reportInterval = 10000; // 10 секунд

    /**
     * @type {number} - ID интервала
     */
    intervalId = null;

    /**
     * @type {Array} - Кэш данных для отправки
     */
    dataCache = [];

    /**
     * @type {Object} - Последние замеренные данные
     */
    lastMeasurement = null;

    /**
     * @type {boolean} - Режим отладки
     */
    debugMode = false;

    constructor() {
        this.sessionId = this.generateSessionId();
        this.debugMode = window.location.hostname === 'localhost' || 
                         window.location.search.includes('debug=true');
        
        // Привязываем методы к контексту
        this.measureViewport = this.measureViewport.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        console.log('📱 ViewportTracker initialized:', {
            sessionId: this.sessionId.substring(0, 8),
            debugMode: this.debugMode
        });
    }

    /**
     * 🚀 Запуск трекера
     */
    start() {
        if (this.isActive) {
            console.warn('⚠️ ViewportTracker already active');
            return;
        }

        this.isActive = true;
        
        // Первое измерение сразу
        setTimeout(() => this.measureAndReport(), 1000);
        
        // Периодическая отправка данных
        this.intervalId = setInterval(() => {
            this.measureAndReport();
        }, this.reportInterval);
        
        // Обработчики событий
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleResize);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Telegram specific events
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.onEvent('viewportChanged', this.handleResize);
        }
        
        console.log('✅ ViewportTracker started');
    }

    /**
     * ⏹️ Остановка трекера
     */
    stop() {
        if (!this.isActive) return;

        this.isActive = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Удаляем обработчики
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Отправляем оставшиеся данные
        if (this.dataCache.length > 0) {
            this.sendCachedData();
        }
        
        console.log('⏹️ ViewportTracker stopped');
    }

    /**
     * 📏 Измерение viewport параметров
     */
    measureViewport() {
        try {
            // Основные размеры viewport
            const innerHeight = window.innerHeight;
            const innerWidth = window.innerWidth;
            
            // Telegram специфичные размеры
            const telegramHeight = window.Telegram?.WebApp?.viewportHeight || null;
            const telegramStableHeight = window.Telegram?.WebApp?.viewportStableHeight || null;
            const telegramExpanded = window.Telegram?.WebApp?.isExpanded || null;
            
            // CSS переменные
            const cssVars = this.getCSSVariables();
            const bottomNavHeight = parseInt(cssVars.bottomNavHeight) || 64;
            const headerHeight = parseInt(cssVars.headerHeight) || 56;
            
            // Рассчитанная высота контента (по CSS формуле)
            const calculatedContentHeight = innerHeight - bottomNavHeight - headerHeight - 40;
            
            // Реальная высота контентного элемента
            const contentElement = document.querySelector('.content') || 
                                 document.querySelector('#page-content') ||
                                 document.querySelector('.page-content');
            
            const actualContentHeight = contentElement ? 
                contentElement.getBoundingClientRect().height : 0;
            
            // Разница между ожидаемым и фактическим
            const difference = calculatedContentHeight - actualContentHeight;
            
            // Safe area insets (для iOS)
            const safeBounds = this.getSafeAreaInsets();
            
            // Scroll информация
            const scrollData = this.getScrollData(contentElement);
            
            // Информация об устройстве
            const deviceInfo = this.getDeviceInfo();
            
            // Telegram контекст
            const telegramInfo = this.getTelegramInfo();
            
            // Определяем текущую страницу
            const currentPage = this.getCurrentPage();
            
            const measurement = {
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId,
                page: currentPage,
                url: window.location.href,
                
                viewport: {
                    innerHeight,
                    innerWidth,
                    telegramHeight,
                    telegramStableHeight,
                    telegramExpanded,
                    calculatedContentHeight,
                    actualContentHeight,
                    difference,
                    bottomNavHeight,
                    headerHeight,
                    safeBounds
                },
                
                device: deviceInfo,
                telegram: telegramInfo,
                
                problem: this.analyzeProblem(difference, scrollData),
                
                debugMode: this.debugMode,
                cssVariables: cssVars,
                
                scrollData
            };
            
            // Логируем в консоль в debug режиме
            if (this.debugMode) {
                console.log('📏 Viewport measurement:', {
                    page: currentPage,
                    innerHeight,
                    telegramHeight,
                    calculatedHeight: calculatedContentHeight,
                    actualHeight: actualContentHeight,
                    difference,
                    problem: measurement.problem.type
                });
            }
            
            this.lastMeasurement = measurement;
            return measurement;
            
        } catch (error) {
            console.error('❌ ViewportTracker measurement error:', error);
            return null;
        }
    }

    /**
     * 📊 Измерение и отправка отчета
     */
    async measureAndReport() {
        const measurement = this.measureViewport();
        if (!measurement) return;

        // Проверяем, есть ли проблема
        const hasProblem = Math.abs(measurement.viewport.difference) > 5;
        
        if (hasProblem || this.debugMode) {
            this.dataCache.push(measurement);
            
            // Отправляем данные, если кэш заполнен или проблема серьезная
            if (this.dataCache.length >= 3 || Math.abs(measurement.viewport.difference) > 30) {
                await this.sendCachedData();
            }
        }
    }

    /**
     * 📤 Отправка кэшированных данных на сервер
     */
    async sendCachedData() {
        if (this.dataCache.length === 0) return;

        try {
            // Отправляем последнее измерение (самое актуальное)
            const latestData = this.dataCache[this.dataCache.length - 1];
            
            const response = await fetch('/api/debug/viewport', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(latestData)
            });

            if (response.ok) {
                const result = await response.json();
                
                if (this.debugMode) {
                    console.log('✅ Viewport data sent successfully:', {
                        logId: result.logId,
                        analysis: result.analysis
                    });
                }
                
                // Очищаем кэш после успешной отправки
                this.dataCache = [];
                
            } else {
                console.warn('⚠️ Failed to send viewport data:', response.status);
            }
            
        } catch (error) {
            console.error('❌ Error sending viewport data:', error);
        }
    }

    /**
     * 🔍 Анализ проблемы viewport
     */
    analyzeProblem(difference, scrollData) {
        const abs = Math.abs(difference);
        
        let type, severity, description;
        
        if (difference > 10) {
            type = 'empty_space_bottom';
            description = `${difference}px empty space at bottom`;
        } else if (difference < -10) {
            type = 'content_overflow';
            description = `${Math.abs(difference)}px content overflow`;
        } else if (abs > 5) {
            type = 'height_mismatch';
            description = `${difference}px height calculation mismatch`;
        } else {
            type = 'scroll_issue';
            description = 'Minor viewport inconsistency';
        }
        
        if (abs < 10) severity = 'minor';
        else if (abs < 50) severity = 'moderate';
        else severity = 'severe';
        
        return {
            type,
            severity,
            description,
            ...scrollData
        };
    }

    // ===========================================
    // 🛠️ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ===========================================

    /**
     * Получить CSS переменные
     */
    getCSSVariables() {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        return {
            bottomNavHeight: computedStyle.getPropertyValue('--bottom-nav-height').trim(),
            headerHeight: computedStyle.getPropertyValue('--header-height').trim(),
            tgViewportHeight: computedStyle.getPropertyValue('--tg-viewport-height').trim()
        };
    }

    /**
     * Получить Safe Area Insets (iOS)
     */
    getSafeAreaInsets() {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        return {
            top: parseInt(computedStyle.getPropertyValue('--safe-area-top')) || 0,
            bottom: parseInt(computedStyle.getPropertyValue('--safe-area-bottom')) || 0,
            left: parseInt(computedStyle.getPropertyValue('--safe-area-left')) || 0,
            right: parseInt(computedStyle.getPropertyValue('--safe-area-right')) || 0
        };
    }

    /**
     * Получить данные о скролле
     */
    getScrollData(element) {
        if (!element) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
        
        return {
            scrollTop: element.scrollTop || window.pageYOffset,
            scrollHeight: element.scrollHeight || document.body.scrollHeight,
            clientHeight: element.clientHeight || window.innerHeight
        };
    }

    /**
     * Получить информацию об устройстве
     */
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: this.detectPlatform(),
            browser: this.detectBrowser(),
            devicePixelRatio: window.devicePixelRatio || 1,
            orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
            screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight
            }
        };
    }

    /**
     * Получить информацию о Telegram
     */
    getTelegramInfo() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return { isAvailable: false };
        
        return {
            isAvailable: true,
            version: tg.version,
            platform: tg.platform,
            colorScheme: tg.colorScheme,
            isVerticalSwipesEnabled: tg.isVerticalSwipesEnabled,
            headerColor: tg.headerColor,
            backgroundColor: tg.backgroundColor
        };
    }

    /**
     * Определить текущую страницу
     */
    getCurrentPage() {
        // Попробуем определить по активной навигации
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            const page = activeNav.getAttribute('data-page');
            if (page) return page;
        }
        
        // Попробуем по URL
        const path = window.location.pathname;
        if (path.includes('diary')) return 'diary';
        if (path.includes('reports')) return 'reports';
        if (path.includes('catalog')) return 'catalog';
        if (path.includes('community')) return 'community';
        if (path.includes('onboarding')) return 'onboarding';
        
        return 'home';
    }

    /**
     * Определить платформу
     */
    detectPlatform() {
        const ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
        if (/Android/i.test(ua)) return 'Android';
        return 'Desktop';
    }

    /**
     * Определить браузер
     */
    detectBrowser() {
        const ua = navigator.userAgent;
        if (window.Telegram?.WebApp) return 'Telegram';
        if (/Chrome/i.test(ua)) return 'Chrome';
        if (/Safari/i.test(ua)) return 'Safari';
        if (/Firefox/i.test(ua)) return 'Firefox';
        return 'Unknown';
    }

    /**
     * Сгенерировать ID сессии
     */
    generateSessionId() {
        return 'vp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ===========================================
    // 📡 ОБРАБОТЧИКИ СОБЫТИЙ
    // ===========================================

    /**
     * Обработчик изменения размера
     */
    handleResize() {
        // Измеряем с небольшой задержкой для стабилизации
        setTimeout(() => {
            if (this.isActive) {
                this.measureAndReport();
            }
        }, 300);
    }

    /**
     * Обработчик изменения видимости
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Отправляем данные перед скрытием
            if (this.dataCache.length > 0) {
                this.sendCachedData();
            }
        } else {
            // Измеряем при возвращении
            setTimeout(() => {
                if (this.isActive) {
                    this.measureAndReport();
                }
            }, 500);
        }
    }
}

// Экспорт и глобальная доступность
window.ViewportTracker = ViewportTracker;

// 🚀 Автоматический запуск для Mini App
if (typeof window !== 'undefined' && window.location.pathname.includes('mini-app')) {
    // Запускаем трекер после полной загрузки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                window.viewportTracker = new ViewportTracker();
                window.viewportTracker.start();
            }, 2000); // Ждем инициализации приложения
        });
    } else {
        setTimeout(() => {
            window.viewportTracker = new ViewportTracker();
            window.viewportTracker.start();
        }, 2000);
    }
}

console.log('📱 ViewportTracker module loaded');