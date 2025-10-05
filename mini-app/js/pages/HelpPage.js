/**
 * ❓ ПОМОЩЬ - HelpPage.js
 * 
 * Полноэкранная страница помощи
 * Функциональность:
 * - Руководство пользователя (6 шагов)
 * - FAQ (часто задаваемые вопросы) с haptic feedback
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
                ${this.renderUserGuide()}
                ${this.renderFAQ()}
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
                <p>Узнайте, как максимально эффективно использовать приложение</p>
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
                            <h4>Главная</h4>
                            <p>На главной странице Вы видите краткую статистику, кнопку «Добавить цитату», топ 3 разбора недели и основные показатели активности. Отсюда начинается работа.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h4>Дневник</h4>
                            <p>Добавьте цитату (вкладка «Добавить»). После сохранения появится комментарий к цитате. Во вкладке «Мои цитаты» — есть кнопка "..." с функцией редактирования, удаления цитаты и "лайка" цитаты (добавление в избранное) и доступны поиск и фильтрация цитат.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h4>Отчёты</h4>
                            <p>Еженедельно автоматически формируются отчёты: темы недели, динамика и персональные рекомендации (на основе классификации добавленных цитат). Используйте их, чтобы корректировать чтение и интересы.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">4</div>
                        <div class="step-content">
                            <h4>Каталог</h4>
                            <p>На основе отчёта и актуальных тем показываются рекомендации, а также «Топ недели» (3 разбора). Отсюда можно перейти на сайт для покупки и изучения материалов глубже.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">5</div>
                        <div class="step-content">
                            <h4>Сообщество</h4>
                            <p>На странице сообщество Вы найдете: ленту свежих цитат, избранные цитаты других пользователей, тренд недели, последние покупки разборов, топы (пользователи / цитаты / разборы) и Ваш прогресс; лайк чужой цитаты добавляет её к Вашим избранным.</p>
                        </div>
                    </div>
                    
                    <div class="guide-step">
                        <div class="step-number">6</div>
                        <div class="step-content">
                            <h4>Кнопка "Меню" на главной странице</h4>
                            <p>В настройках Вы сможете сменить аватар, email, повторно  пройти тест и управлять уведомлениями , удалить профиль. 
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
     * 📋 Получить список FAQ
     */
    getFAQItems() {
        return [
            {
                id: 'daily-quote-limit',
                question: 'Сколько цитат можно добавить в день?',
                answer: 'Вы можете добавлять до 10 цитат в день. Это ограничение помогает сосредоточиться на качестве и глубоком осмыслении прочитанного.'
            },
            {
                id: 'comment-delay',
                question: 'Почему комментарий к цитате появляется не сразу?',
                answer: 'Комментарий формируется с небольшой задержкой — это нормально. Система анализирует контекст и смысл Вашей цитаты для создания качественного отклика.'
            },
            {
                id: 'like-favorites',
                question: 'Что значит "лайк" цитаты?',
                answer: 'Лайк добавляет цитату в избранное. Это работает как для Ваших цитат, так и для цитат других пользователей в Ленте.'
            },
            {
                id: 'edit-delete',
                question: 'Можно ли редактировать или удалять цитаты?',
                answer: 'Да, Вы можете редактировать и удалять свои цитаты в любое время. Откройте цитату в дневнике и выберите нужное действие.'
            },
            {
                id: 'filters-meaning',
                question: 'Что означают фильтры в дневнике?',
                answer: 'Фильтры помогают быстро находить цитаты: Неделя — за последние 7 дней, Месяц — за последние 30 дней, Избранное — цитаты, которые Вы отметили лайком. Есть также поиск по тексту.'
            },
            {
                id: 'streak-definition',
                question: 'Что такое серия?',
                answer: 'Серия — это количество дней подряд, когда Вы добавили хотя бы одну цитату. Если пропустите день, серия начнётся заново.'
            },
            {
                id: 'trend-recommendations',
                question: 'Откуда берутся тренд недели и рекомендации?',
                answer: 'Тренд недели определяется по самой популярной теме среди пользователей. Рекомендации книг формируются на основе тем из Вашего еженедельного отчёта и общей активности сообщества.'
            },
            {
                id: 'weekly-report-timing',
                question: 'Когда формируется еженедельный отчёт?',
                answer: 'Отчёт формируется автоматически каждую неделю. Ваши цитаты классифицируются по темам, и на основе анализа создаётся отчёт с комментариями и рекомендациями.'
            },
            {
                id: 'catalog-top-week',
                question: 'Что такое ТОП-3 недели в каталоге?',
                answer: 'Это три самых популярных разбора книг за неделю. Список обновляется еженедельно и отражает интересы всего сообщества.'
            },
            {
                id: 'retake-test',
                question: 'Можно ли пройти тест заново?',
                answer: 'Да, в настройках есть возможность пройти тест повторно. Это обновит Ваши ответы и может повлиять на рекомендации.'
            },
            {
                id: 'delete-profile',
                question: 'Как удалить профиль?',
                answer: 'В настройках есть опция удаления профиля. Обратите внимание: это действие удалит все Ваши данные без возможности восстановления.'
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
