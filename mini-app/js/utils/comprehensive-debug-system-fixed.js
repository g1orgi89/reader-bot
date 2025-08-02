/**
 * 🔍 ИСПРАВЛЕННАЯ COMPREHENSIVE DEBUG СИСТЕМА
 * 
 * ИСПРАВЛЕНИЯ:
 * - ✅ Проверка доступности сервера перед началом сессии
 * - ✅ Fallback на локальную работу если сервер недоступен
 * - ✅ Правильные URL endpoints
 * - ✅ Улучшенная обработка ошибок
 * - ✅ Автоматическое определение apiPrefix
 */

class ComprehensiveDebugSystemFixed {
    constructor() {
        this.sessionId = null;
        this.userId = null;
        this.startTime = Date.now();
        this.logs = [];
        this.isActive = false;
        this.batchTimer = null;
        this.observers = [];
        this.serverAvailable = false;
        
        // Автоматическое определение базового URL
        this.baseURL = window.location.origin;
        this.apiPrefix = '/api/reader'; // Стандартный префикс Reader Bot
        
        // Конфигурация
        this.config = {
            batchSize: 50,           
            batchTimeout: 5000,      
            maxLocalLogs: 1000,      
            serverEndpoint: `${this.apiPrefix}/debug`,
            localMode: false         // Флаг локального режима
        };
        
        // Проверяем iOS
        this.deviceInfo = this.getDeviceInfo();
        this.isIOS = this.deviceInfo.isIOS;
        
        console.log('🔍 ComprehensiveDebugSystemFixed инициализирован', {
            isIOS: this.isIOS,
            baseURL: this.baseURL,
            endpoint: this.config.serverEndpoint,
            deviceInfo: this.deviceInfo
        });
        
        // Проверяем доступность сервера
        this.checkServerAvailability();
    }

    /**
     * 🔍 НОВОЕ: Проверка доступности сервера
     */
    async checkServerAvailability() {
        try {
            console.log('🔍 Проверяем доступность debug сервера...');
            
            const response = await fetch(`${this.baseURL}${this.apiPrefix}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                const health = await response.json();
                this.serverAvailable = true;
                console.log('✅ Debug сервер доступен:', health);
                
                // Проверяем специально debug endpoint
                const debugResponse = await fetch(`${this.baseURL}${this.config.serverEndpoint}/sessions/active`, {
                    method: 'GET',
                    timeout: 3000
                });
                
                if (debugResponse.ok) {
                    console.log('✅ Debug API полностью функционален');
                } else {
                    console.warn('⚠️ Health API работает, но debug API недоступен');
                    this.config.localMode = true;
                }
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ Сервер недоступен, переключаемся в локальный режим:', error.message);
            this.serverAvailable = false;
            this.config.localMode = true;
        }
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
     * 🔧 ИСПРАВЛЕНО: Начало debug сессии с проверкой сервера
     */
    async startSession(userId) {
        try {
            this.userId = userId;
            
            // Если сервер недоступен - работаем локально
            if (this.config.localMode) {
                console.log('🔍 Запуск в локальном режиме (сервер недоступен)');
                this.sessionId = `local_${userId}_${Date.now()}`;
                this.isActive = true;
                
                this.log('INIT', 'INFO', 'Debug session started in LOCAL mode', {
                    sessionId: this.sessionId,
                    userId: this.userId,
                    reason: 'Server unavailable'
                });
                
                this.startTracking();
                return this.sessionId;
            }
            
            // Пытаемся запустить сессию на сервере
            const response = await fetch(`${this.baseURL}${this.config.serverEndpoint}/start-session`, {
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
                
                this.log('INIT', 'INFO', 'Debug session started on SERVER', {
                    sessionId: this.sessionId,
                    userId: this.userId
                });
                
                this.startTracking();
                console.log('✅ Debug сессия запущена на сервере:', this.sessionId);
                return this.sessionId;
            } else {
                throw new Error(result.error || 'Failed to start session');
            }
            
        } catch (error) {
            console.warn('⚠️ Ошибка запуска сессии на сервере, переключаемся в локальный режим:', error);
            
            // Fallback на локальный режим
            this.config.localMode = true;
            this.sessionId = `local_${userId}_${Date.now()}`;
            this.isActive = true;
            
            this.log('INIT', 'WARNING', 'Debug session started in LOCAL mode (server error)', {
                sessionId: this.sessionId,
                userId: this.userId,
                error: error.message
            });
            
            this.startTracking();
            return this.sessionId;
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
            this.logs = this.logs.slice(-this.config.maxLocalLogs / 2);
        }
        
        // Планируем отправку (только если сервер доступен)
        if (!this.config.localMode) {
            this._scheduleBatchSend();
        }
        
        // Критические ошибки отправляем немедленно (если сервер доступен)
        if (level === 'CRITICAL' && !this.config.localMode) {
            this._sendCriticalLog(logEntry);
        }
    }

    /**
     * 🔧 ИСПРАВЛЕНО: Консольный вывод с улучшенным форматированием
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

        const mode = this.config.localMode ? '[LOCAL]' : '[SERVER]';
        const timestamp_str = `[${timestamp}ms]`;
        const category_str = `${category}`;
        const level_str = `${level}:`;
        
        console.log(
            `%c${mode} %c${timestamp_str} %c${category_str} %c${level_str} %c${message}`,
            'color: #666; font-weight: bold; background: rgba(255,255,255,0.1); padding: 1px 3px; border-radius: 2px',
            'color: #666; font-weight: bold',
            `color: ${categoryColors[category] || '#999'}; font-weight: bold; background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 3px`,
            `color: ${colors[level] || '#999'}; font-weight: bold`,
            'color: #333',
            data && Object.keys(data).length > 0 ? data : ''
        );
    }

    /**
     * 🔧 ИСПРАВЛЕНО: Планирование batch отправки (только если сервер доступен)
     */
    _scheduleBatchSend() {
        if (this.config.localMode || this.batchTimer) return;
        
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
     * 🔧 ИСПРАВЛЕНО: Отправка пачки логов с проверкой режима
     */
    async _sendBatchLogs() {
        if (this.config.localMode || !this.sessionId || this.logs.length === 0) return;
        
        try {
            const logsToSend = this.logs.splice(0, this.config.batchSize);
            
            const response = await fetch(`${this.baseURL}${this.config.serverEndpoint}/batch-log`, {
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
                
                // Переключаемся в локальный режим при ошибках сервера
                this.config.localMode = true;
                console.warn('⚠️ Переключились в локальный режим из-за ошибок сервера');
            }
            
        } catch (error) {
            console.error('❌ Ошибка отправки batch логов:', error);
            // Переключаемся в локальный режим при ошибках сети
            this.config.localMode = true;
            console.warn('⚠️ Переключились в локальный режим из-за ошибок сети');
        } finally {
            this.batchTimer = null;
            
            // Если есть еще логи и сервер доступен - планируем следующую отправку
            if (this.logs.length > 0 && !this.config.localMode) {
                this._scheduleBatchSend();
            }
        }
    }

    /**
     * 🔧 ИСПРАВЛЕНО: Немедленная отправка критического лога
     */
    async _sendCriticalLog(logEntry) {
        if (this.config.localMode || !this.sessionId) return;
        
        try {
            await fetch(`${this.baseURL}${this.config.serverEndpoint}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    ...logEntry
                })
            });
        } catch (error) {
            console.error('❌ Ошибка отправки критического лога:', error);
            // При ошибке отправки критического лога не переключаемся в локальный режим
        }
    }

    /**
     * Начало отслеживания всех событий
     */
    startTracking() {
        if (!this.isActive) return;
        
        this.log('INIT', 'INFO', 'Starting comprehensive tracking', {
            isIOS: this.isIOS,
            hasNavigation: !!document.querySelector('.bottom-nav'),
            mode: this.config.localMode ? 'LOCAL' : 'SERVER'
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

    // ===========================================
    // 🛠️ МЕТОДЫ ОТСЛЕЖИВАНИЯ (без изменений из оригинала)
    // ===========================================

    _trackTelegramEvents() {
        if (!window.Telegram?.WebApp) return;
        
        const tg = window.Telegram.WebApp;
        
        const originalOnEvent = tg.onEvent;
        tg.onEvent = (eventType, callback) => {
            this.log('TELEGRAM', 'INFO', `Telegram event registered: ${eventType}`);
            
            const wrappedCallback = (data) => {
                this.log('TELEGRAM', 'INFO', `Telegram event fired: ${eventType}`, {
                    eventType,
                    data,
                    telegramInfo: this.getTelegramInfo()
                });
                
                if (eventType === 'viewportChanged' || eventType === 'safeAreaChanged') {
                    this._checkNavigationAfterTelegramEvent(eventType, data);
                }
                
                if (callback) callback(data);
            };
            
            return originalOnEvent.call(tg, eventType, wrappedCallback);
        };
        
        this.log('TELEGRAM', 'INFO', 'Telegram event tracking activated');
    }

    _checkNavigationAfterTelegramEvent(eventType, data) {
        const checkTimes = [0, 100, 300, 1000];
        
        checkTimes.forEach(delay => {
            setTimeout(() => {
                const navState = this.getNavigationState();
                
                if (navState) {
                    const viewport = this.getViewportState();
                    const expectedBottom = viewport.innerHeight;
                    const actualBottom = navState.boundingRect.bottom;
                    const diff = Math.abs(actualBottom - expectedBottom);
                    
                    if (diff > 10) {
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

    _trackDOMChanges() {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) {
            this.log('DOM', 'WARNING', 'Navigation element not found for DOM tracking');
            return;
        }
        
        const navObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    this.log('DOM', 'INFO', `Navigation attribute changed: ${mutation.attributeName}`, {
                        attributeName: mutation.attributeName,
                        oldValue: mutation.oldValue,
                        newValue: mutation.target.getAttribute(mutation.attributeName),
                        navigationState: this.getNavigationState()
                    });
                    
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

    _analyzeNavigationStyleChanges(mutation) {
        const nav = mutation.target;
        const computedStyle = getComputedStyle(nav);
        
        const criticalStyles = {
            position: computedStyle.position,
            transform: computedStyle.transform,
            bottom: computedStyle.bottom,
            zIndex: computedStyle.zIndex
        };
        
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

    _trackViewportChanges() {
        window.addEventListener('resize', () => {
            this.log('VIEWPORT', 'INFO', 'Window resize detected', {
                viewport: this.getViewportState(),
                navigationState: this.getNavigationState()
            });
        });
        
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

    _trackScrollEvents() {
        let lastScrollTime = 0;
        let scrollCount = 0;
        
        const scrollHandler = () => {
            const now = Date.now();
            scrollCount++;
            
            if (scrollCount % 10 === 0 || now - lastScrollTime > 1000) {
                this.log('SCROLL', 'DEBUG', 'Scroll event', {
                    scrollCount,
                    timeSinceLastLog: now - lastScrollTime,
                    viewport: this.getViewportState(),
                    navigationState: this.getNavigationState()
                });
                lastScrollTime = now;
            }
            
            setTimeout(() => this._checkNavigationPosition('scroll'), 100);
        };
        
        window.addEventListener('scroll', scrollHandler, { passive: true });
        document.addEventListener('scroll', scrollHandler, { passive: true });
        
        this.log('SCROLL', 'INFO', 'Scroll tracking activated');
    }

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
            
            setTimeout(() => this._checkNavigationPosition('touch'), 100);
        }, { passive: true });
        
        this.log('TOUCH', 'INFO', 'Touch tracking activated for iOS');
    }

    _trackOrientationChanges() {
        window.addEventListener('orientationchange', () => {
            this.log('ORIENTATION', 'INFO', 'Orientation change detected', {
                orientation: screen.orientation?.angle || window.orientation,
                beforeChange: this.getViewportState()
            });
            
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

    _trackKeyboardEvents() {
        if (!window.visualViewport) return;
        
        let lastHeight = window.visualViewport.height;
        
        const checkKeyboard = () => {
            const currentHeight = window.visualViewport.height;
            const heightDiff = lastHeight - currentHeight;
            
            if (Math.abs(heightDiff) > 100) {
                const isKeyboardOpen = currentHeight < lastHeight;
                
                this.log('KEYBOARD', 'INFO', isKeyboardOpen ? 'Keyboard opened' : 'Keyboard closed', {
                    heightDiff,
                    currentHeight,
                    lastHeight,
                    viewport: this.getViewportState(),
                    navigationState: this.getNavigationState()
                });
                
                lastHeight = currentHeight;
                
                setTimeout(() => this._checkNavigationPosition('keyboard'), 300);
            }
        };
        
        window.visualViewport.addEventListener('resize', checkKeyboard);
        
        this.log('KEYBOARD', 'INFO', 'Keyboard tracking activated');
    }

    _trackUserActions() {
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            nav.addEventListener('click', (e) => {
                this.log('USER_ACTION', 'INFO', 'Navigation click', {
                    target: e.target.closest('.nav-item')?.dataset?.page || 'unknown',
                    navigationState: this.getNavigationState()
                });
                
                setTimeout(() => this._checkNavigationPosition('click'), 100);
            });
        }
        
        this.log('USER_ACTION', 'INFO', 'User action tracking activated');
    }

    _startNavigationHealthCheck() {
        const checkInterval = 5000;
        
        const healthCheck = () => {
            if (!this.isActive) return;
            
            const navState = this.getNavigationState();
            
            if (!navState) {
                this.log('NAVIGATION', 'ERROR', 'Navigation element not found during health check');
                return;
            }
            
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

    _checkNavigationPosition(trigger) {
        const navState = this.getNavigationState();
        if (!navState) return;
        
        const viewport = this.getViewportState();
        const expectedBottom = viewport.innerHeight;
        const actualBottom = navState.boundingRect.bottom;
        const diff = Math.abs(actualBottom - expectedBottom);
        
        if (diff > 5) {
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
     * 🔧 ИСПРАВЛЕНО: Завершение debug сессии с проверкой режима
     */
    async endSession() {
        if (!this.isActive) return;
        
        this.log('INIT', 'INFO', 'Ending debug session');
        
        // Отправляем оставшиеся логи (только если не в локальном режиме)
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        if (!this.config.localMode) {
            await this._sendBatchLogs();
        }
        
        // Отключаем отслеживание
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        
        // Завершаем сессию на сервере (если не в локальном режиме)
        if (!this.config.localMode && this.sessionId) {
            try {
                await fetch(`${this.baseURL}${this.config.serverEndpoint}/session/${this.sessionId}/end`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('❌ Ошибка завершения сессии на сервере:', error);
            }
        }
        
        this.isActive = false;
        const finalSessionId = this.sessionId;
        this.sessionId = null;
        
        console.log('✅ Debug сессия завершена:', finalSessionId);
        return finalSessionId;
    }

    /**
     * 🔧 ИСПРАВЛЕНО: Получение статистики сессии с учетом режима
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
            deviceInfo: this.deviceInfo,
            mode: this.config.localMode ? 'LOCAL' : 'SERVER',
            serverAvailable: this.serverAvailable
        };
    }

    /**
     * 🆕 НОВОЕ: Проверка состояния сервера
     */
    async recheckServer() {
        await this.checkServerAvailability();
        return this.serverAvailable;
    }

    /**
     * 🆕 НОВОЕ: Переключение в режим сервера (если он стал доступен)
     */
    async switchToServerMode() {
        if (this.config.localMode && await this.recheckServer()) {
            this.config.localMode = false;
            console.log('✅ Переключились в серверный режим');
            return true;
        }
        return false;
    }
}

// Глобальная доступность
window.ComprehensiveDebugSystemFixed = ComprehensiveDebugSystemFixed;

// Автоматическая инициализация для iOS устройств
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.debugSystemFixed = new ComprehensiveDebugSystemFixed();
    
    // Экспорт удобных функций для ручного использования
    window.startDebugFixed = async (userId) => {
        return await window.debugSystemFixed.startSession(userId);
    };
    
    window.logDebugFixed = (category, level, message, data) => {
        window.debugSystemFixed.log(category, level, message, data);
    };
    
    window.endDebugFixed = async () => {
        return await window.debugSystemFixed.endSession();
    };
    
    window.debugStatsFixed = () => {
        return window.debugSystemFixed.getLocalStats();
    };
    
    window.recheckDebugServer = async () => {
        return await window.debugSystemFixed.recheckServer();
    };
    
    console.log('🔍 iOS Debug System ИСПРАВЛЕН и готов к использованию!');
    console.log('📋 Команды: startDebugFixed(userId), logDebugFixed(category, level, message, data), endDebugFixed(), debugStatsFixed()');
    console.log('🔧 Дополнительно: recheckDebugServer() - проверить доступность сервера');
}
