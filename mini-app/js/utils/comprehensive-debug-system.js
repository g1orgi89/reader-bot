/**
 * 🔍 ВСЕОБЪЕМЛЮЩАЯ DEBUG СИСТЕМА ДЛЯ iOS NAVIGATION
 * Автоматическое отслеживание и логирование всех аспектов навигации
 * Отправка данных на сервер для анализа
 */

class ComprehensiveDebugSystem {
    constructor() {
        this.sessionId = null;
        this.userId = null;
        this.startTime = Date.now();
        this.logs = [];
        this.isActive = false;
        this.batchTimer = null;
        this.observers = [];
        
        // Конфигурация
        this.config = {
            batchSize: 50,           // Отправляем логи пачками по 50
            batchTimeout: 5000,      // Или каждые 5 секунд
            maxLocalLogs: 1000,      // Максимум логов в памяти
            serverEndpoint: '/api/debug'
        };
        
        // Проверяем iOS
        this.deviceInfo = this.getDeviceInfo();
        this.isIOS = this.deviceInfo.isIOS;
        
        console.log('🔍 ComprehensiveDebugSystem инициализирован', {
            isIOS: this.isIOS,
            deviceInfo: this.deviceInfo
        });
    }

    /**
     * Получение информации об устройстве
     */
    getDeviceInfo() {
        const userAgent = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        let iosVersion = null;
        let deviceModel = null;
        
        if (isIOS) {
            const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
            if (match) {
                iosVersion = `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
            }
            
            if (userAgent.includes('iPhone')) deviceModel = 'iPhone';
            else if (userAgent.includes('iPad')) deviceModel = 'iPad';
            else if (userAgent.includes('iPod')) deviceModel = 'iPod';
        }
        
        return {
            userAgent,
            platform: navigator.platform,
            isIOS,
            iosVersion,
            deviceModel,
            screenWidth: screen.width,
            screenHeight: screen.height,
            pixelRatio: window.devicePixelRatio || 1
        };
    }

    /**
     * Получение информации о Telegram WebApp
     */
    getTelegramInfo() {
        if (!window.Telegram?.WebApp) return {};
        
        const tg = window.Telegram.WebApp;
        return {
            version: tg.version || 'unknown',
            platform: tg.platform || 'unknown',
            isExpanded: tg.isExpanded,
            viewportHeight: tg.viewportHeight,
            viewportStableHeight: tg.viewportStableHeight,
            headerHeight: tg.headerHeight,
            safeAreaInset: tg.safeAreaInset,
            isVerticalSwipesEnabled: tg.isVerticalSwipesEnabled,
            themeParams: tg.themeParams
        };
    }

    /**
     * Получение состояния viewport
     */
    getViewportState() {
        const visualViewport = window.visualViewport;
        
        return {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
            scrollX: window.scrollX || window.pageXOffset,
            scrollY: window.scrollY || window.pageYOffset,
            visualViewportHeight: visualViewport ? visualViewport.height : null,
            visualViewportWidth: visualViewport ? visualViewport.width : null,
            isKeyboardOpen: visualViewport ? 
                (visualViewport.height < window.innerHeight * 0.75) : false
        };
    }

    /**
     * Получение состояния навигации
     */
    getNavigationState() {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) return null;
        
        const computedStyle = getComputedStyle(nav);
        const rect = nav.getBoundingClientRect();
        
        return {
            position: computedStyle.position,
            transform: computedStyle.transform,
            bottom: computedStyle.bottom,
            zIndex: computedStyle.zIndex,
            boundingRect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height
            },
            isFixed: computedStyle.position === 'fixed',
            isVisible: rect.height > 0 && rect.width > 0,
            hasIOSFixes: nav.classList.contains('ios-fixed') || 
                        document.documentElement.classList.contains('ios-device')
        };
    }

    /**
     * Начало debug сессии
     */
    async startSession(userId) {
        try {
            this.userId = userId;
            
            const response = await fetch(`${this.config.serverEndpoint}/start-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    deviceInfo: this.deviceInfo,
                    telegramInfo: this.getTelegramInfo()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.sessionId = result.sessionId;
                this.isActive = true;
                
                this.log('INIT', 'INFO', 'Debug session started successfully', {
                    sessionId: this.sessionId,
                    userId: this.userId
                });
                
                // Начинаем отслеживание
                this.startTracking();
                
                console.log('✅ Debug сессия запущена:', this.sessionId);
                return this.sessionId;
            } else {
                throw new Error(result.error || 'Failed to start session');
            }
            
        } catch (error) {
            console.error('❌ Ошибка запуска debug сессии:', error);
            this.log('ERROR', 'CRITICAL', 'Failed to start debug session', { error: error.message });
            throw error;
        }
    }

    /**
     * Создание лога
     */
    log(category, level, message, data = {}) {
        if (!this.isActive && category !== 'ERROR') return;
        
        const timestamp = Date.now() - this.startTime;
        const logEntry = {
            category,
            level,
            message,
            data,
            context: {
                viewport: this.getViewportState(),
                navigationState: this.getNavigationState()
            },
            timestamp,
            clientTime: new Date().toISOString()
        };
        
        this.logs.push(logEntry);
        
        // Выводим в консоль с цветами
        this._consoleLog(category, level, message, data, timestamp);
        
        // Проверяем лимиты
        if (this.logs.length > this.config.maxLocalLogs) {
            this.logs = this.logs.slice(-this.config.maxLocalLogs / 2); // Оставляем половину
        }
        
        // Планируем отправку
        this._scheduleBatchSend();
        
        // Критические ошибки отправляем немедленно
        if (level === 'CRITICAL') {
            this._sendCriticalLog(logEntry);
        }
    }

    /**
     * Консольный вывод с цветами
     */
    _consoleLog(category, level, message, data, timestamp) {
        const colors = {
            DEBUG: '#36DFFF',      // cyan
            INFO: '#4CAF50',       // green  
            WARNING: '#FF9800',    // orange
            ERROR: '#F44336',      // red
            CRITICAL: '#9C27B0'    // purple
        };

        const categoryColors = {
            INIT: '#4CAF50',           // green
            TELEGRAM: '#2196F3',       // blue
            NAVIGATION: '#FF9800',     // orange
            VIEWPORT: '#9C27B0',       // purple
            CSS: '#F44336',            // red
            DOM: '#795548',            // brown
            SCROLL: '#607D8B',         // blue gray
            TOUCH: '#E91E63',          // pink
            ORIENTATION: '#00BCD4',    // cyan
            KEYBOARD: '#FF5722',       // deep orange
            USER_ACTION: '#4CAF50'     // green
        };

        const timestamp_str = `[${timestamp}ms]`;
        const category_str = `${category}`;
        const level_str = `${level}:`;
        
        console.log(
            `%c${timestamp_str} %c${category_str} %c${level_str} %c${message}`,
            'color: #666; font-weight: bold',
            `color: ${categoryColors[category] || '#999'}; font-weight: bold; background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 3px`,
            `color: ${colors[level] || '#999'}; font-weight: bold`,
            'color: #333',
            data && Object.keys(data).length > 0 ? data : ''
        );
    }

    /**
     * Планирование batch отправки
     */
    _scheduleBatchSend() {
        if (this.batchTimer) return;
        
        this.batchTimer = setTimeout(() => {
            this._sendBatchLogs();
        }, this.config.batchTimeout);
        
        // Если накопилось много логов - отправляем сразу
        if (this.logs.length >= this.config.batchSize) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
            this._sendBatchLogs();
        }
    }

    /**
     * Отправка пачки логов
     */
    async _sendBatchLogs() {
        if (!this.sessionId || this.logs.length === 0) return;
        
        try {
            const logsToSend = this.logs.splice(0, this.config.batchSize);
            
            const response = await fetch(`${this.config.serverEndpoint}/batch-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    logs: logsToSend
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                console.error('❌ Ошибка отправки batch логов:', result.error);
                // Возвращаем логи обратно в начало очереди
                this.logs = logsToSend.concat(this.logs);
            }
            
        } catch (error) {
            console.error('❌ Ошибка отправки batch логов:', error);
        } finally {
            this.batchTimer = null;
            
            // Если есть еще логи - планируем следующую отправку
            if (this.logs.length > 0) {
                this._scheduleBatchSend();
            }
        }
    }

    /**
     * Немедленная отправка критического лога
     */
    async _sendCriticalLog(logEntry) {
        if (!this.sessionId) return;
        
        try {
            await fetch(`${this.config.serverEndpoint}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    ...logEntry
                })
            });
        } catch (error) {
            console.error('❌ Ошибка отправки критического лога:', error);
        }
    }

    /**
     * Начало отслеживания всех событий
     */
    startTracking() {
        if (!this.isActive) return;
        
        this.log('INIT', 'INFO', 'Starting comprehensive tracking', {
            isIOS: this.isIOS,
            hasNavigation: !!document.querySelector('.bottom-nav')
        });
        
        // 1. Отслеживание Telegram событий
        this._trackTelegramEvents();
        
        // 2. Отслеживание DOM изменений
        this._trackDOMChanges();
        
        // 3. Отслеживание viewport изменений
        this._trackViewportChanges();
        
        // 4. Отслеживание скролла
        this._trackScrollEvents();
        
        // 5. Отслеживание touch событий (только iOS)
        if (this.isIOS) {
            this._trackTouchEvents();
        }
        
        // 6. Отслеживание смены ориентации
        this._trackOrientationChanges();
        
        // 7. Отслеживание клавиатуры
        this._trackKeyboardEvents();
        
        // 8. Отслеживание действий пользователя
        this._trackUserActions();
        
        // 9. Периодическая проверка состояния навигации
        this._startNavigationHealthCheck();
        
        this.log('INIT', 'INFO', 'All tracking systems activated');
    }

    /**
     * Отслеживание Telegram событий
     */
    _trackTelegramEvents() {
        if (!window.Telegram?.WebApp) return;
        
        const tg = window.Telegram.WebApp;
        
        // Перехватываем onEvent
        const originalOnEvent = tg.onEvent;
        tg.onEvent = (eventType, callback) => {
            this.log('TELEGRAM', 'INFO', `Telegram event registered: ${eventType}`);
            
            const wrappedCallback = (data) => {
                this.log('TELEGRAM', 'INFO', `Telegram event fired: ${eventType}`, {
                    eventType,
                    data,
                    telegramInfo: this.getTelegramInfo()
                });
                
                // Особое внимание к viewport событиям
                if (eventType === 'viewportChanged' || eventType === 'safeAreaChanged') {
                    this._checkNavigationAfterTelegramEvent(eventType, data);
                }
                
                if (callback) callback(data);
            };
            
            return originalOnEvent.call(tg, eventType, wrappedCallback);
        };
        
        this.log('TELEGRAM', 'INFO', 'Telegram event tracking activated');
    }

    /**
     * Проверка навигации после Telegram событий
     */
    _checkNavigationAfterTelegramEvent(eventType, data) {
        // Проверяем через несколько интервалов
        const checkTimes = [0, 100, 300, 1000];
        
        checkTimes.forEach(delay => {
            setTimeout(() => {
                const navState = this.getNavigationState();
                
                if (navState) {
                    // Проверяем, находится ли навигация в правильной позиции
                    const viewport = this.getViewportState();
                    const expectedBottom = viewport.innerHeight;
                    const actualBottom = navState.boundingRect.bottom;
                    const diff = Math.abs(actualBottom - expectedBottom);
                    
                    if (diff > 10) { // Если навигация сместилась больше чем на 10px
                        this.log('NAVIGATION', 'ERROR', 
                            `Navigation displaced after Telegram ${eventType}`, {
                            eventType,
                            telegramData: data,
                            expectedBottom,
                            actualBottom,
                            difference: diff,
                            navState,
                            viewport,
                            delay
                        });
                    } else {
                        this.log('NAVIGATION', 'DEBUG', 
                            `Navigation position OK after Telegram ${eventType}`, {
                            eventType,
                            delay,
                            difference: diff
                        });
                    }
                }
            }, delay);
        });
    }

    /**
     * Отслеживание DOM изменений
     */
    _trackDOMChanges() {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) {
            this.log('DOM', 'WARNING', 'Navigation element not found for DOM tracking');
            return;
        }
        
        // Отслеживаем изменения навигации
        const navObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    this.log('DOM', 'INFO', `Navigation attribute changed: ${mutation.attributeName}`, {
                        attributeName: mutation.attributeName,
                        oldValue: mutation.oldValue,
                        newValue: mutation.target.getAttribute(mutation.attributeName),
                        navigationState: this.getNavigationState()
                    });
                    
                    // Особое внимание к style и class изменениям
                    if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
                        this._analyzeNavigationStyleChanges(mutation);
                    }
                }
                
                if (mutation.type === 'childList') {
                    this.log('DOM', 'INFO', 'Navigation children changed', {
                        addedNodes: mutation.addedNodes.length,
                        removedNodes: mutation.removedNodes.length,
                        navigationState: this.getNavigationState()
                    });
                }
            });
        });
        
        navObserver.observe(nav, {
            attributes: true,
            attributeOldValue: true,
            childList: true,
            subtree: true
        });
        
        this.observers.push(navObserver);
        this.log('DOM', 'INFO', 'Navigation DOM tracking activated');
    }

    /**
     * Анализ изменений стилей навигации
     */
    _analyzeNavigationStyleChanges(mutation) {
        const nav = mutation.target;
        const computedStyle = getComputedStyle(nav);
        
        // Проверяем критически важные стили
        const criticalStyles = {
            position: computedStyle.position,
            transform: computedStyle.transform,
            bottom: computedStyle.bottom,
            zIndex: computedStyle.zIndex
        };
        
        // Ищем подозрительные изменения
        const suspiciousChanges = [];
        
        if (criticalStyles.position !== 'fixed') {
            suspiciousChanges.push(`position changed to ${criticalStyles.position}`);
        }
        
        if (criticalStyles.transform !== 'none' && criticalStyles.transform !== 'translateZ(0px)') {
            suspiciousChanges.push(`transform applied: ${criticalStyles.transform}`);
        }
        
        if (suspiciousChanges.length > 0) {
            this.log('CSS', 'WARNING', 'Suspicious navigation style changes detected', {
                changes: suspiciousChanges,
                computedStyles: criticalStyles,
                inlineStyles: nav.style.cssText,
                classList: Array.from(nav.classList)
            });
        }
    }

    /**
     * Отслеживание viewport изменений
     */
    _trackViewportChanges() {
        // Отслеживаем resize
        window.addEventListener('resize', () => {
            this.log('VIEWPORT', 'INFO', 'Window resize detected', {
                viewport: this.getViewportState(),
                navigationState: this.getNavigationState()
            });
        });
        
        // Отслеживаем Visual Viewport (если доступен)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                this.log('VIEWPORT', 'INFO', 'Visual viewport resize detected', {
                    viewport: this.getViewportState(),
                    navigationState: this.getNavigationState()
                });
            });
            
            window.visualViewport.addEventListener('scroll', () => {
                this.log('VIEWPORT', 'DEBUG', 'Visual viewport scroll detected', {
                    viewport: this.getViewportState()
                });
            });
        }
        
        this.log('VIEWPORT', 'INFO', 'Viewport tracking activated');
    }

    /**
     * Отслеживание скролла
     */
    _trackScrollEvents() {
        let lastScrollTime = 0;
        let scrollCount = 0;
        
        const scrollHandler = () => {
            const now = Date.now();
            scrollCount++;
            
            // Логируем каждый 10-й скролл или если прошло больше секунды
            if (scrollCount % 10 === 0 || now - lastScrollTime > 1000) {
                this.log('SCROLL', 'DEBUG', 'Scroll event', {
                    scrollCount,
                    timeSinceLastLog: now - lastScrollTime,
                    viewport: this.getViewportState(),
                    navigationState: this.getNavigationState()
                });
                lastScrollTime = now;
            }
            
            // Проверяем позицию навигации после скролла
            setTimeout(() => this._checkNavigationPosition('scroll'), 100);
        };
        
        window.addEventListener('scroll', scrollHandler, { passive: true });
        document.addEventListener('scroll', scrollHandler, { passive: true });
        
        this.log('SCROLL', 'INFO', 'Scroll tracking activated');
    }

    /**
     * Отслеживание touch событий (iOS)
     */
    _trackTouchEvents() {
        if (!this.isIOS) return;
        
        let touchStartTime = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchStartY = e.touches[0].clientY;
            
            this.log('TOUCH', 'DEBUG', 'Touch start', {
                touchCount: e.touches.length,
                startY: touchStartY,
                target: e.target.tagName
            });
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                this.log('TOUCH', 'WARNING', 'Multi-touch detected', {
                    touchCount: e.touches.length
                });
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            const duration = Date.now() - touchStartTime;
            const endY = e.changedTouches[0].clientY;
            const distance = Math.abs(endY - touchStartY);
            
            this.log('TOUCH', 'DEBUG', 'Touch end', {
                duration,
                distance,
                direction: endY > touchStartY ? 'down' : 'up'
            });
            
            // Проверяем навигацию после touch
            setTimeout(() => this._checkNavigationPosition('touch'), 100);
        }, { passive: true });
        
        this.log('TOUCH', 'INFO', 'Touch tracking activated for iOS');
    }

    /**
     * Отслеживание смены ориентации
     */
    _trackOrientationChanges() {
        window.addEventListener('orientationchange', () => {
            this.log('ORIENTATION', 'INFO', 'Orientation change detected', {
                orientation: screen.orientation?.angle || window.orientation,
                beforeChange: this.getViewportState()
            });
            
            // Проверяем навигацию после смены ориентации
            setTimeout(() => {
                this.log('ORIENTATION', 'INFO', 'Post-orientation state', {
                    viewport: this.getViewportState(),
                    navigationState: this.getNavigationState()
                });
                this._checkNavigationPosition('orientation');
            }, 500);
        });
        
        this.log('ORIENTATION', 'INFO', 'Orientation tracking activated');
    }

    /**
     * Отслеживание клавиатуры
     */
    _trackKeyboardEvents() {
        if (!window.visualViewport) return;
        
        let lastHeight = window.visualViewport.height;
        
        const checkKeyboard = () => {
            const currentHeight = window.visualViewport.height;
            const heightDiff = lastHeight - currentHeight;
            
            if (Math.abs(heightDiff) > 100) { // Значительное изменение высоты
                const isKeyboardOpen = currentHeight < lastHeight;
                
                this.log('KEYBOARD', 'INFO', isKeyboardOpen ? 'Keyboard opened' : 'Keyboard closed', {
                    heightDiff,
                    currentHeight,
                    lastHeight,
                    viewport: this.getViewportState(),
                    navigationState: this.getNavigationState()
                });
                
                lastHeight = currentHeight;
                
                // Проверяем навигацию после изменения клавиатуры
                setTimeout(() => this._checkNavigationPosition('keyboard'), 300);
            }
        };
        
        window.visualViewport.addEventListener('resize', checkKeyboard);
        
        this.log('KEYBOARD', 'INFO', 'Keyboard tracking activated');
    }

    /**
     * Отслеживание действий пользователя
     */
    _trackUserActions() {
        // Клики на навигации
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            nav.addEventListener('click', (e) => {
                this.log('USER_ACTION', 'INFO', 'Navigation click', {
                    target: e.target.closest('.nav-item')?.dataset?.page || 'unknown',
                    navigationState: this.getNavigationState()
                });
                
                // Проверяем навигацию после клика
                setTimeout(() => this._checkNavigationPosition('click'), 100);
            });
        }
        
        this.log('USER_ACTION', 'INFO', 'User action tracking activated');
    }

    /**
     * Периодическая проверка состояния навигации
     */
    _startNavigationHealthCheck() {
        const checkInterval = 5000; // Каждые 5 секунд
        
        const healthCheck = () => {
            if (!this.isActive) return;
            
            const navState = this.getNavigationState();
            
            if (!navState) {
                this.log('NAVIGATION', 'ERROR', 'Navigation element not found during health check');
                return;
            }
            
            // Проверяем основные показатели здоровья навигации
            const issues = [];
            
            if (navState.position !== 'fixed') {
                issues.push(`position is ${navState.position}, not fixed`);
            }
            
            if (!navState.isVisible) {
                issues.push('navigation is not visible');
            }
            
            if (navState.boundingRect.bottom < window.innerHeight - 50) {
                issues.push(`navigation is too high (${navState.boundingRect.bottom} vs ${window.innerHeight})`);
            }
            
            if (issues.length > 0) {
                this.log('NAVIGATION', 'ERROR', 'Navigation health check failed', {
                    issues,
                    navigationState: navState,
                    viewport: this.getViewportState()
                });
            } else {
                this.log('NAVIGATION', 'DEBUG', 'Navigation health check passed');
            }
        };
        
        setInterval(healthCheck, checkInterval);
        this.log('NAVIGATION', 'INFO', `Navigation health check started (every ${checkInterval}ms)`);
    }

    /**
     * Проверка позиции навигации
     */
    _checkNavigationPosition(trigger) {
        const navState = this.getNavigationState();
        if (!navState) return;
        
        const viewport = this.getViewportState();
        const expectedBottom = viewport.innerHeight;
        const actualBottom = navState.boundingRect.bottom;
        const diff = Math.abs(actualBottom - expectedBottom);
        
        if (diff > 5) { // Навигация сместилась больше чем на 5px
            this.log('NAVIGATION', 'WARNING', `Navigation position incorrect after ${trigger}`, {
                trigger,
                expectedBottom,
                actualBottom,
                difference: diff,
                navigationState: navState,
                viewport
            });
        }
    }

    /**
     * Завершение debug сессии
     */
    async endSession() {
        if (!this.isActive) return;
        
        this.log('INIT', 'INFO', 'Ending debug session');
        
        // Отправляем оставшиеся логи
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        await this._sendBatchLogs();
        
        // Отключаем отслеживание
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        
        // Завершаем сессию на сервере
        try {
            await fetch(`${this.config.serverEndpoint}/session/${this.sessionId}/end`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('❌ Ошибка завершения сессии на сервере:', error);
        }
        
        this.isActive = false;
        this.sessionId = null;
        
        console.log('✅ Debug сессия завершена');
    }

    /**
     * Получение статистики сессии
     */
    getLocalStats() {
        const categories = {};
        const levels = {};
        
        this.logs.forEach(log => {
            categories[log.category] = (categories[log.category] || 0) + 1;
            levels[log.level] = (levels[log.level] || 0) + 1;
        });
        
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            isActive: this.isActive,
            duration: Date.now() - this.startTime,
            totalLogs: this.logs.length,
            categories,
            levels,
            isIOS: this.isIOS,
            deviceInfo: this.deviceInfo
        };
    }
}

// Глобальная доступность
window.ComprehensiveDebugSystem = ComprehensiveDebugSystem;

// Автоматическая инициализация для iOS устройств
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.debugSystem = new ComprehensiveDebugSystem();
    
    // Экспорт удобных функций для ручного использования
    window.startDebug = async (userId) => {
        return await window.debugSystem.startSession(userId);
    };
    
    window.logDebug = (category, level, message, data) => {
        window.debugSystem.log(category, level, message, data);
    };
    
    window.endDebug = async () => {
        return await window.debugSystem.endSession();
    };
    
    window.debugStats = () => {
        return window.debugSystem.getLocalStats();
    };
    
    console.log('🔍 iOS Debug System готов к использованию!');
    console.log('📋 Команды: startDebug(userId), logDebug(category, level, message, data), endDebug(), debugStats()');
}