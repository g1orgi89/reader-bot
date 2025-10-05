/**
 * 📝 ОБРАБОТЧИКИ МЕНЮ И ДЕЙСТВИЙ
 * Размер: ~2 KB - обработчики меню для Mini App
 * 
 * Содержит обработчики для:
 * - Главного выдвижного меню (профиль, достижения, настройки)
 * - Действий пользователя (сохранение, удаление, экспорт)
 * - Модальных окон и переходов между страницами
 * - Интеграции с Telegram WebApp API
 */

// 🎯 КЛАСС ДЛЯ УПРАВЛЕНИЯ МЕНЮ

/**
 * Менеджер меню и действий пользователя
 */
class MenuHandler {
    constructor() {
        this.currentPage = window.PAGES?.HOME || 'home';
        this.isMenuOpen = false;
        this.activeModals = new Set();
        this.persistTimeout = null;
    }

    // 📱 ГЛАВНОЕ ВЫДВИЖНОЕ МЕНЮ

    /**
     * Переключает состояние главного меню
     * @param {boolean} forceState - Принудительное состояние (открыто/закрыто)
     */
    toggleMenu(forceState = null) {
        const overlay = document.querySelector('.menu-overlay');
        const menuButton = document.querySelector('.menu-button');
        
        if (!overlay) return;
        
        // Определяем новое состояние
        const newState = forceState !== null ? forceState : !this.isMenuOpen;
        
        if (newState) {
            // Открываем меню
            overlay.classList.add('show');
            if (menuButton) menuButton.classList.add('active');
            this.isMenuOpen = true;
            
            // Haptic feedback для Telegram
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
            
            // Добавляем обработчик клика вне меню
            setTimeout(() => {
                document.addEventListener('click', this.handleOutsideClick.bind(this));
            }, 100);
            
        } else {
            // Закрываем меню
            overlay.classList.remove('show');
            if (menuButton) menuButton.classList.remove('active');
            this.isMenuOpen = false;
            
            // Убираем обработчик клика вне меню
            document.removeEventListener('click', this.handleOutsideClick.bind(this));
        }
    }

    /**
     * Обработчик клика вне меню для закрытия
     * @param {Event} event - Событие клика
     */
    handleOutsideClick(event) {
        const menuPanel = document.querySelector('.menu-panel');
        const menuButton = document.querySelector('.menu-button');
        
        // Если клик не по панели меню и не по кнопке меню - закрываем
        if (!menuPanel?.contains(event.target) && !menuButton?.contains(event.target)) {
            this.toggleMenu(false);
        }
    }

    /**
     * Обработчик кликов по пунктам меню
     * @param {string} menuItemId - ID пункта меню
     */
    handleMenuItemClick(menuItemId) {
        const menuItems = window.MENU_ITEMS || [];
        const menuItem = menuItems.find(item => item.id === menuItemId);
        if (!menuItem) return;

        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }

        // Закрываем меню
        this.toggleMenu(false);

        // Выполняем действие в зависимости от пункта меню
        switch (menuItemId) {
            case 'profile':
                this.openProfileModal();
                break;
            case 'achievements':
                this.openAchievementsModal();
                break;
            case 'settings':
                this.openSettingsModal();
                break;
            case 'help':
                this.openHelpModal();
                break;
            case 'about':
                this.openAboutModal();
                break;
            default:
                console.warn(`Неизвестный пункт меню: ${menuItemId}`);
        }
    }

    // 🏠 МОДАЛЬНЫЕ ОКНА

    /**
     * Открывает модальное окно профиля
     */
    openProfileModal() {
        const modal = this.createModal('profile', 'Мой профиль', this.getProfileModalContent());
        this.showModal(modal);
    }

    /**
     * Открывает модальное окно достижений
     */
    openAchievementsModal() {
        const modal = this.createModal('achievements', 'Мои достижения', this.getAchievementsModalContent());
        this.showModal(modal);
    }

    /**
     * Открывает модальное окно настроек
     */
    openSettingsModal() {
        const modal = this.createModal('settings', 'Настройки', this.getSettingsModalContent());
        this.showModal(modal);
    }

    /**
     * Открывает модальное окно помощи
     */
    openHelpModal() {
        const modal = this.createModal('help', 'Помощь', this.getHelpModalContent());
        this.showModal(modal);
    }

    /**
     * Открывает модальное окно "О приложении"
     */
    openAboutModal() {
        const modal = this.createModal('about', 'О приложении', this.getAboutModalContent());
        this.showModal(modal);
    }

    // 🛠️ СОЗДАНИЕ И УПРАВЛЕНИЕ МОДАЛКАМИ

    /**
     * Создает базовую структуру модального окна
     * @param {string} id - ID модального окна
     * @param {string} title - Заголовок
     * @param {string} content - HTML контент
     * @returns {HTMLElement} - Элемент модального окна
     */
    createModal(id, title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.dataset.modalId = id;
        
        modal.innerHTML = `
            <div class="modal-panel">
                <div class="modal-header">
                    <button class="modal-back" onclick="menuHandler.closeModal('${id}')">←</button>
                    <span class="modal-title">${title}</span>
                    <button class="modal-close" onclick="menuHandler.closeModal('${id}')">&times;</button>
                </div>
                <div class="modal-content">
                    ${content}
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * Показывает модальное окно
     * @param {HTMLElement} modal - Элемент модального окна
     */
    showModal(modal) {
        document.body.appendChild(modal);
        
        // Добавляем в активные модалки
        const modalId = modal.dataset.modalId;
        this.activeModals.add(modalId);
        
        // Анимация появления
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
        
        // Фокус на первый интерактивный элемент
        const firstInput = modal.querySelector('input, button, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 300);
        }
    }

    /**
     * Закрывает модальное окно
     * @param {string} modalId - ID модального окна
     */
    closeModal(modalId) {
        const modal = document.querySelector(`[data-modal-id="${modalId}"]`);
        if (!modal) return;
        
        // Анимация скрытия
        modal.classList.remove('show');
        
        // Удаляем из активных модалок
        this.activeModals.delete(modalId);
        
        // Удаляем из DOM после анимации
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    /**
     * Закрывает все открытые модальные окна
     */
    closeAllModals() {
        this.activeModals.forEach(modalId => {
            this.closeModal(modalId);
        });
    }

    // 📄 КОНТЕНТ МОДАЛЬНЫХ ОКОН

    /**
     * Генерирует контент для модального окна профиля
     * @returns {string} - HTML контент
     */
    getProfileModalContent() {
        return `
            <div class="profile-section">
                <div class="profile-avatar">А</div>
                <div class="profile-name">Анна М.</div>
                <div class="profile-role">Читатель активист</div>
                
                <div class="profile-stats">
                    <div class="profile-stat">
                        <div class="profile-stat-number">47</div>
                        <div class="profile-stat-label">Цитат</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-number">12</div>
                        <div class="profile-stat-label">Дней</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-number">2</div>
                        <div class="profile-stat-label">Награды</div>
                    </div>
                </div>
            </div>
            
            <div class="profile-section">
                <div class="form-group">
                    <label class="form-label">Имя</label>
                    <input class="form-input" value="Анна" placeholder="Ваше имя">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input class="form-input" value="anna@example.com" placeholder="Ваш email">
                </div>
                
                <div class="form-group">
                    <label class="form-label">О себе</label>
                    <input class="form-input" value="Замужем, работаю" placeholder="Расскажите о себе">
                </div>
                
                <button class="save-btn" onclick="menuHandler.saveProfile()">Сохранить изменения</button>
            </div>
            
            <div class="profile-section">
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">Персонализация</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
                    Ваши ответы на вопросы влияют на рекомендации книг и анализ цитат от Анны
                </div>
                <button class="retake-test-btn" onclick="menuHandler.retakeTest()">
                    🔄 Пересдать тест (7 вопросов)
                </button>
            </div>
        `;
    }

    /**
     * Генерирует контент для модального окна достижений
     * @returns {string} - HTML контент
     */
    getAchievementsModalContent() {
        return `
            <div style="text-align: center; margin-bottom: 20px; padding: 16px; background: var(--surface); border-radius: var(--border-radius); border: 1px solid var(--border);">
                <div style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">2 из 8 достижений</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Продолжайте собирать цитаты для новых наград!</div>
            </div>
            
            <div class="achievement-item unlocked">
                <div class="achievement-icon unlocked">🌟</div>
                <div class="achievement-info">
                    <div class="achievement-title">Первые шаги</div>
                    <div class="achievement-description">Добавили первую цитату в дневник</div>
                    <div class="achievement-progress">Выполнено!</div>
                </div>
            </div>
            
            <div class="achievement-item unlocked">
                <div class="achievement-icon unlocked">📚</div>
                <div class="achievement-info">
                    <div class="achievement-title">Коллекционер мудрости</div>
                    <div class="achievement-description">Собрали 25 цитат</div>
                    <div class="achievement-progress">47/25 - Выполнено!</div>
                </div>
            </div>
            
            <div class="achievement-item">
                <div class="achievement-icon locked">🔥</div>
                <div class="achievement-info">
                    <div class="achievement-title">Философ недели</div>
                    <div class="achievement-description">7 дней подряд добавляйте цитаты</div>
                    <div class="achievement-progress">6/7 дней</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 85%;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Генерирует контент для модального окна настроек
     * @returns {string} - HTML контент
     */
    getSettingsModalContent() {
        // Get current settings from app state
        const appState = window.app?.state || window.appState;
        const settings = appState?.get('settings') || {};
        
        // Derive checked state from actual settings
        const dailyRemindersChecked = settings.reminders?.enabled !== false;
        const achievementsChecked = settings.achievements?.enabled !== false;
        
        return `
            <div class="settings-group">
                <div class="settings-group-title">Уведомления</div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-text">Ежедневные напоминания</span>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" ${dailyRemindersChecked ? 'checked' : ''} onchange="menuHandler.toggleNotifications('daily', this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-text">Достижения</span>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" ${achievementsChecked ? 'checked' : ''} onchange="menuHandler.toggleNotifications('achievements', this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            
            <div class="settings-group">
                <div class="settings-group-title">Приложение</div>
                
                <div class="settings-item" onclick="menuHandler.toggleDarkTheme()">
                    <div class="settings-item-info">
                        <span class="settings-text">Темная тема</span>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="dark-theme-toggle">
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="settings-item" onclick="menuHandler.exportData()">
                    <div class="settings-item-info">
                        <span class="settings-text">Экспорт данных</span>
                    </div>
                    <span class="chevron-icon">→</span>
                </div>
                
                <div class="settings-item" onclick="menuHandler.confirmDeleteData()">
                    <div class="settings-item-info">
                        <span class="settings-text" style="color: var(--error);">Удалить все данные</span>
                    </div>
                    <span class="chevron-icon">→</span>
                </div>
            </div>
        `;
    }

    /**
     * Генерирует контент для модального окна помощи
     * @returns {string} - HTML контент
     */
    getHelpModalContent() {
        const annaInfo = window.ANNA_INFO || {};
        const contacts = annaInfo.contacts || {};
        
        return `
            <div style="background: linear-gradient(135deg, var(--primary-color), var(--primary-dark)); color: white; border-radius: var(--border-radius); padding: 16px; text-align: center; margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">💬 Нужна помощь?</div>
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 12px;">Анна и команда поддержки готовы помочь</div>
                <button style="background: white; color: var(--primary-color); border: none; padding: 8px 16px; border-radius: 20px; font-weight: 600; cursor: pointer; font-size: 11px;" onclick="menuHandler.contactSupport()">
                    Написать в поддержку
                </button>
            </div>
            
            <div class="faq-section">
                <div class="faq-item" onclick="menuHandler.toggleFaq('quote-add')">
                    <div class="faq-question">❓ Как добавлять цитаты?</div>
                    <div class="faq-answer">Просто отправьте текст цитаты боту. Если есть автор - укажите в скобках или через тире.</div>
                </div>
                
                <div class="faq-item" onclick="menuHandler.toggleFaq('reports')">
                    <div class="faq-question">📊 Когда приходят отчеты?</div>
                    <div class="faq-answer">Еженедельные отчеты приходят в воскресенье в 11:00. Месячные - в первых числах месяца.</div>
                </div>
                
                <div class="faq-item" onclick="menuHandler.toggleFaq('analysis')">
                    <div class="faq-question">🤖 Как работает анализ Анны?</div>
                    <div class="faq-answer">ИИ анализирует ваши цитаты и на основе вашего теста подбирает персональные рекомендации книг.</div>
                </div>
            </div>
            
            <div class="contact-info">
                <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">📞 Связаться с нами</div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    • Telegram: ${contacts.telegram || '@annabusel_support'}<br>
                    • Email: ${contacts.email || 'help@annabusel.org'}<br>
                    • Время ответа: до 24 часов
                </div>
            </div>
        `;
    }

    /**
     * Генерирует контент для модального окна "О приложении"
     * @returns {string} - HTML контент
     */
    getAboutModalContent() {
        const annaInfo = window.ANNA_INFO || {};
        
        return `
            <div class="anna-card">
                <div class="anna-photo">${annaInfo.photo || 'А'}</div>
                <div class="anna-name">${annaInfo.name || 'Анна Бусел'}</div>
                <div class="anna-role">${annaInfo.role || 'Психолог • Основатель "Книжного клуба"'}</div>
                <div class="anna-quote">"${annaInfo.quote || 'Хорошая жизнь строится, а не дается по умолчанию'}"</div>
            </div>
            
            <div class="app-info">
                <div class="app-version">
                    <span class="version-label">Версия приложения</span>
                    <span class="version-number">1.0.2</span>
                </div>
                
                <div class="app-version">
                    <span class="version-label">Пользователей</span>
                    <span class="version-number">2,847</span>
                </div>
                
                <div class="app-version">
                    <span class="version-label">Цитат собрано</span>
                    <span class="version-number">15,392</span>
                </div>
            </div>
            
            <div class="contact-links">
                <a href="#" class="contact-link" onclick="menuHandler.openSocialLink('instagram')">📷</a>
                <a href="#" class="contact-link" onclick="menuHandler.openSocialLink('telegram')">✈️</a>
                <a href="#" class="contact-link" onclick="menuHandler.openSocialLink('website')">🌐</a>
            </div>
        `;
    }

    // ⚙️ ОБРАБОТЧИКИ ДЕЙСТВИЙ

    /**
     * Сохраняет данные профиля
     */
    saveProfile() {
        // Здесь будет интеграция с API
        const successMsg = window.SUCCESS_MESSAGES?.profileUpdated || 'Профиль обновлен!';
        this.showNotification(successMsg, 'success');
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    }

    /**
     * Запускает повторное прохождение теста
     */
    retakeTest() {
        this.closeAllModals();
        // Здесь будет переход на страницу онбординга
        console.log('Запуск повторного теста');
    }

    /**
     * Переключает настройки уведомлений
     * @param {string} type - Тип уведомлений
     * @param {boolean} enabled - Включены ли уведомления
     */
    toggleNotifications(type, enabled) {
        console.log(`Уведомления ${type}: ${enabled ? 'включены' : 'выключены'}`);
        
        // Get current settings from global state
        const appState = window.app?.state || window.appState;
        if (!appState) {
            console.warn('⚠️ App state not available, cannot persist notification settings');
            return;
        }
        
        const currentSettings = appState.get('settings') || {};
        
        // Map notification type to canonical settings structure
        const settingsUpdate = {};
        
        switch (type) {
            case 'daily':
                settingsUpdate.reminders = { ...currentSettings.reminders };
                settingsUpdate.reminders.enabled = enabled;
                // Ensure frequency has a safe default if missing
                if (!settingsUpdate.reminders.frequency) {
                    settingsUpdate.reminders.frequency = currentSettings.reminders?.frequency || 'standard';
                }
                break;
            case 'achievements':
                settingsUpdate.achievements = { enabled };
                break;
            default:
                console.warn(`⚠️ Unknown notification type: ${type}`);
                return;
        }
        
        // Update local state immediately
        const updatedSettings = { ...currentSettings, ...settingsUpdate };
        appState.set('settings', updatedSettings);
        
        // Persist to server with debounce
        this.debouncedPersistSettings(settingsUpdate);
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }
    
    /**
     * Debounced persist settings to server
     * @param {Object} settingsUpdate - Settings to persist
     */
    debouncedPersistSettings(settingsUpdate) {
        // Clear existing timeout
        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
        }
        
        // Set new timeout
        this.persistTimeout = setTimeout(async () => {
            try {
                const api = window.app?.api || window.api;
                if (!api) {
                    console.warn('⚠️ API service not available');
                    return;
                }
                
                await api.updateSettings(settingsUpdate);
                console.log('✅ Settings persisted successfully');
            } catch (error) {
                console.error('❌ Failed to persist settings:', error);
            }
        }, 600);
    }

    /**
     * Переключает темную тему
     */
    toggleDarkTheme() {
        const body = document.body;
        const isDark = body.classList.toggle('dark-theme');
        
        // Сохраняем в localStorage
        localStorage.setItem('reader-theme', isDark ? 'dark' : 'light');
        
        // Обновляем чекбокс
        const toggle = document.getElementById('dark-theme-toggle');
        if (toggle) toggle.checked = isDark;
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    /**
     * Экспортирует данные пользователя
     */
    exportData() {
        // Здесь будет логика экспорта данных
        const successMsg = window.SUCCESS_MESSAGES?.dataExported || 'Данные экспортированы!';
        this.showNotification(successMsg, 'success');
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    }

    /**
     * Подтверждение удаления всех данных
     */
    confirmDeleteData() {
        const confirmed = confirm('Вы уверены, что хотите удалить все свои данные? Это действие необратимо.');
        
        if (confirmed) {
            // Здесь будет логика удаления данных
            this.showNotification('Все данные удалены', 'info');
            
            // Haptic feedback
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
            }
        }
    }

    /**
     * Связь с поддержкой
     */
    contactSupport() {
        const annaInfo = window.ANNA_INFO || {};
        const contacts = annaInfo.contacts || {};
        const telegramContact = contacts.telegram || '@annabusel_support';
        
        // Открываем Telegram чат с поддержкой
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openTelegramLink(`https://t.me/${telegramContact.replace('@', '')}`);
        } else {
            // Fallback для тестирования в браузере
            window.open(`https://t.me/${telegramContact.replace('@', '')}`, '_blank');
        }
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    }

    /**
     * Переключает FAQ элемент
     * @param {string} faqId - ID FAQ элемента
     */
    toggleFaq(faqId) {
        const faqItem = document.querySelector(`[data-faq-id="${faqId}"]`);
        if (faqItem) {
            faqItem.classList.toggle('expanded');
        }
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    /**
     * Открывает социальную ссылку
     * @param {string} platform - Платформа (instagram, telegram, website)
     */
    openSocialLink(platform) {
        const annaInfo = window.ANNA_INFO || {};
        const contacts = annaInfo.contacts || {};
        const links = {
            instagram: `https://instagram.com/${contacts.instagram || 'annabusel'}`,
            telegram: `https://t.me/${(contacts.telegram || '@annabusel_support').replace('@', '')}`,
            website: `https://${contacts.website || 'annabusel.org'}`
        };
        
        const url = links[platform];
        if (!url) return;
        
        // Открываем ссылку
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    }

    // 🔔 УВЕДОМЛЕНИЯ

    /**
     * Показывает уведомление пользователю
     * @param {string} message - Текст уведомления
     * @param {string} type - Тип уведомления (success, error, warning, info)
     * @param {number} duration - Длительность показа в мс
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Добавляем в DOM
        document.body.appendChild(notification);
        
        // Анимация появления
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Автоматическое скрытие
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // 🚀 ИНИЦИАЛИЗАЦИЯ

    /**
     * Инициализирует обработчики меню
     */
    init() {
        // Загружаем сохраненную тему
        const savedTheme = localStorage.getItem('reader-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        
        // Добавляем глобальные обработчики событий
        document.addEventListener('keydown', (e) => {
            // ESC для закрытия модалок и меню
            if (e.key === 'Escape') {
                if (this.activeModals.size > 0) {
                    this.closeAllModals();
                } else if (this.isMenuOpen) {
                    this.toggleMenu(false);
                }
            }
        });
        
        // Обработчик для кнопки "Назад" в Telegram
        if (window.Telegram?.WebApp?.BackButton) {
            window.Telegram.WebApp.BackButton.onClick(() => {
                if (this.activeModals.size > 0) {
                    this.closeAllModals();
                } else if (this.isMenuOpen) {
                    this.toggleMenu(false);
                }
            });
        }
        
        console.log('MenuHandler инициализирован');
    }
}

// 🌐 СОЗДАНИЕ ГЛОБАЛЬНОГО ЭКЗЕМПЛЯРА
const menuHandler = new MenuHandler();

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => menuHandler.init());
} else {
    menuHandler.init();
}

// Глобальный доступ
window.MenuHandler = MenuHandler;
window.menuHandler = menuHandler;