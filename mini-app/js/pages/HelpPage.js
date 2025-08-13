/**
 * ❓ ПОМОЩЬ - HelpPage.js
 * 
 * Полноэкранная страница помощи и поддержки
 * Функциональность:
 * - FAQ (часто задаваемые вопросы)
 * - Руководство пользователя
 * - Контакты для поддержки
 * - Обратная связь
 * - Использует существующий дизайн-систему
 */

class HelpPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние компонента
        this.loading = false;
        this.error = null;
        this.expandedFaq = new Set();
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        // Страница помощи не требует загрузки внешних данных
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        return `
            <div class="content">
                ${this.renderHeader()}
                ${this.renderQuickActions()}
                ${this.renderUserGuide()}
                ${this.renderFAQ()}
                ${this.renderSupportSection()}
                ${this.renderError()}
            </div>
        `;
    }
    
    /**
     * 📋 Рендер заголовка страницы
     */
    renderHeader() {
        return `
            <div class="page-header">
                <h1>❓ Помощь</h1>
                <p>Найдите ответы на вопросы или свяжитесь с поддержкой</p>
            </div>
        `;
    }
    
    /**
     * ⚡ Рендер быстрых действий
     */
    renderQuickActions() {
        return `
            <div class="help-section">
                <h3>⚡ Быстрые действия</h3>
                <div class="quick-actions">
                    <button class="quick-action-btn" id="reportBugBtn">
                        <span class="action-emoji">🐛</span>
                        <div class="action-text">
                            <div class="action-title">Сообщить об ошибке</div>
                            <div class="action-subtitle">Нашли баг? Расскажите нам</div>
                        </div>
                    </button>
                    
                    <button class="quick-action-btn" id="featureRequestBtn">
                        <span class="action-emoji">💡</span>
                        <div class="action-text">
                            <div class="action-title">Предложить улучшение</div>
                            <div class="action-subtitle">Ваши идеи помогают развивать приложение</div>
                        </div>
                    </button>
                    
                    <button class="quick-action-btn" id="contactSupportBtn">
                        <span class="action-emoji">💬</span>
                        <div class="action-text">
                            <div class="action-title">Связаться с поддержкой</div>
                            <div class="action-subtitle">Задайте вопрос напрямую</div>
                        </div>
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 📖 Рендер руководства пользователя
     */
    renderUserGuide() {
        return `
            <div class="help-section">
                <h3>📖 Как пользоваться приложением</h3>
                <div class="guide-steps">
                    <div class="guide-step">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <h4>Добавьте первую цитату</h4>
                            <p>Перейдите в "Дневник" и нажмите кнопку "Добавить цитату". Введите текст и укажите автора или источник.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h4>Изучите каталог книг</h4>
                            <p>В разделе "Каталог" вы найдете рекомендуемые книги с интересными отрывками и цитатами.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h4>Отслеживайте прогресс</h4>
                            <p>В "Отчетах" смотрите статистику: сколько цитат добавили, какие авторы любимые, как долго поддерживаете привычку.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">4</div>
                        <div class="step-content">
                            <h4>Получайте достижения</h4>
                            <p>За активность в приложении вы получаете награды. Проверяйте их в меню профиля.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * ❓ Рендер FAQ
     */
    renderFAQ() {
        const faqItems = this.getFAQItems();
        
        return `
            <div class="help-section">
                <h3>❓ Часто задаваемые вопросы</h3>
                <div class="faq-list">
                    ${faqItems.map(item => this.renderFAQItem(item)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔍 Рендер элемента FAQ
     */
    renderFAQItem(item) {
        const isExpanded = this.expandedFaq.has(item.id);
        
        return `
            <div class="faq-item ${isExpanded ? 'expanded' : ''}" data-faq-id="${item.id}">
                <div class="faq-question">
                    <span>${item.question}</span>
                    <span class="faq-toggle">${isExpanded ? '−' : '+'}</span>
                </div>
                <div class="faq-answer">
                    <p>${item.answer}</p>
                </div>
            </div>
        `;
    }
    
    /**
     * 🆘 Рендер секции поддержки
     */
    renderSupportSection() {
        return `
            <div class="help-section">
                <h3>🆘 Нужна дополнительная помощь?</h3>
                <div class="support-card">
                    <p>Если вы не нашли ответ на свой вопрос, мы всегда готовы помочь!</p>
                    
                    <div class="support-options">
                        <button class="support-option" id="emailSupportBtn">
                            <span class="support-emoji">✉️</span>
                            <div class="support-text">
                                <div class="support-title">Email поддержка</div>
                                <div class="support-subtitle">support@annabusel.org</div>
                            </div>
                        </button>
                        
                        <button class="support-option" id="telegramSupportBtn">
                            <span class="support-emoji">📱</span>
                            <div class="support-text">
                                <div class="support-title">Telegram поддержка</div>
                                <div class="support-subtitle">@annabusel_support</div>
                            </div>
                        </button>
                    </div>
                    
                    <div class="support-hours">
                        <small>⏰ Время ответа: обычно в течение 24 часов</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * ⚠️ Рендер ошибки
     */
    renderError() {
        if (!this.error) return '';
        
        return `
            <div class="error-message" id="errorMessage">
                <span>⚠️ ${this.error}</span>
                <button onclick="this.parentElement.style.display='none'">✕</button>
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // FAQ items
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            item.addEventListener('click', () => {
                const faqId = item.dataset.faqId;
                this.toggleFAQ(faqId);
            });
        });
        
        // Quick actions
        const reportBugBtn = document.getElementById('reportBugBtn');
        if (reportBugBtn) {
            reportBugBtn.addEventListener('click', () => this.handleReportBug());
        }
        
        const featureRequestBtn = document.getElementById('featureRequestBtn');
        if (featureRequestBtn) {
            featureRequestBtn.addEventListener('click', () => this.handleFeatureRequest());
        }
        
        const contactSupportBtn = document.getElementById('contactSupportBtn');
        if (contactSupportBtn) {
            contactSupportBtn.addEventListener('click', () => this.handleContactSupport());
        }
        
        // Support options
        const emailSupportBtn = document.getElementById('emailSupportBtn');
        if (emailSupportBtn) {
            emailSupportBtn.addEventListener('click', () => this.handleEmailSupport());
        }
        
        const telegramSupportBtn = document.getElementById('telegramSupportBtn');
        if (telegramSupportBtn) {
            telegramSupportBtn.addEventListener('click', () => this.handleTelegramSupport());
        }
    }
    
    /**
     * 🔄 Переключение FAQ
     */
    toggleFAQ(faqId) {
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        const faqItem = document.querySelector(`[data-faq-id="${faqId}"]`);
        if (!faqItem) return;
        
        if (this.expandedFaq.has(faqId)) {
            this.expandedFaq.delete(faqId);
            faqItem.classList.remove('expanded');
            faqItem.querySelector('.faq-toggle').textContent = '+';
        } else {
            this.expandedFaq.add(faqId);
            faqItem.classList.add('expanded');
            faqItem.querySelector('.faq-toggle').textContent = '−';
        }
    }
    
    /**
     * 🐛 Обработчик сообщения об ошибке
     */
    handleReportBug() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('medium');
        }
        
        const message = `
Сообщить об ошибке:

1. Опишите, что произошло
2. Что вы делали перед ошибкой  
3. Какой результат ожидали
4. Приложите скриншот, если возможно

Отправить на: support@annabusel.org
        `.trim();
        
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * 💡 Обработчик предложения улучшения
     */
    handleFeatureRequest() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('medium');
        }
        
        const message = `
Предложить улучшение:

1. Опишите вашу идею
2. Объясните, как это поможет
3. Предложите, как это могло бы работать

Мы рассматриваем все предложения!

Отправить на: ideas@annabusel.org
        `.trim();
        
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * 💬 Обработчик связи с поддержкой
     */
    handleContactSupport() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('medium');
        }
        
        this.handleTelegramSupport();
    }
    
    /**
     * ✉️ Обработчик email поддержки
     */
    handleEmailSupport() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        const email = 'support@annabusel.org';
        const subject = 'Вопрос по Reader Bot';
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
        
        if (this.telegram?.openLink) {
            this.telegram.openLink(mailtoUrl);
        } else {
            window.open(mailtoUrl);
        }
    }
    
    /**
     * 📱 Обработчик Telegram поддержки
     */
    handleTelegramSupport() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        const telegramUrl = 'https://t.me/annabusel_support';
        
        if (this.telegram?.openLink) {
            this.telegram.openLink(telegramUrl);
        } else {
            window.open(telegramUrl, '_blank');
        }
    }
    
    /**
     * 📋 Получить список FAQ
     */
    getFAQItems() {
        return [
            {
                id: 'how-to-add-quote',
                question: 'Как добавить цитату?',
                answer: 'Перейдите в раздел "Дневник" и нажмите кнопку "Добавить цитату". Введите текст цитаты, укажите автора и источник (книгу), затем нажмите "Сохранить".'
            },
            {
                id: 'edit-quote',
                question: 'Можно ли редактировать цитаты?',
                answer: 'Да, вы можете редактировать свои цитаты. Нажмите на цитату в дневнике и выберите "Редактировать".'
            },
            {
                id: 'sync-data',
                question: 'Синхронизируются ли мои данные?',
                answer: 'Да, все ваши цитаты, настройки и прогресс автоматически сохраняются в облаке и синхронизируются между устройствами.'
            },
            {
                id: 'privacy',
                question: 'Кто может видеть мои цитаты?',
                answer: 'По умолчанию ваши цитаты видны только вам. В настройках вы можете разрешить другим пользователям видеть ваш публичный профиль.'
            },
            {
                id: 'achievements',
                question: 'Как получить достижения?',
                answer: 'Достижения получаются автоматически за различные активности: добавление цитат, поддержание ежедневной привычки, изучение книг и другие действия.'
            },
            {
                id: 'export-data',
                question: 'Можно ли экспортировать свои данные?',
                answer: 'Да, в настройках есть функция экспорта всех ваших данных в удобном формате.'
            },
            {
                id: 'notifications',
                question: 'Как настроить уведомления?',
                answer: 'Перейдите в "Настройки" и настройте ежедневные напоминания, уведомления о достижениях и время их получения.'
            },
            {
                id: 'book-recommendations',
                question: 'Откуда берутся рекомендации книг?',
                answer: 'Рекомендации формируются на основе популярных книг среди пользователей, экспертных мнений и ваших предпочтений.'
            }
        ];
    }
    
    /**
     * 🧹 Очистка ресурсов при уничтожении
     */
    destroy() {
        // Очистка состояния компонента
        this.loading = false;
        this.error = null;
        this.expandedFaq.clear();
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        console.log('❓ HelpPage: onShow');
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        console.log('❓ HelpPage: onHide');
    }
}

// 📤 Экспорт класса
window.HelpPage = HelpPage;