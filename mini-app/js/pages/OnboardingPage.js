/**
 * 🎯 ОНБОРДИНГ ТЕСТ - OnboardingPage.js
 * 
 * Функциональность:
 * - Приветственный экран от Анны Бусел
 * - Тест из 7 вопросов согласно техническому заданию
 * - Прогресс-бар и навигация между вопросами
 * - Валидация ответов и сохранение данных
 * - Финальный экран с результатами и переходом в приложение
 * - Интеграция с API для сохранения результатов
 */

class OnboardingPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние теста
        this.currentStep = 0; // 0 = welcome, 1-7 = questions, 8 = completion
        this.totalSteps = 7;
        this.loading = false;
        this.error = null;
        
        // Данные теста - 7 вопросов из технического задания
        this.questions = [
            {
                id: 'name',
                title: 'Как вас зовут?',
                type: 'text',
                placeholder: 'Введите ваше имя...',
                required: true,
                maxLength: 50
            },
            {
                id: 'about',
                title: 'Расскажите о себе',
                type: 'radio',
                options: [
                    'Мама, воспитываю детей',
                    'Замужем, работаю', 
                    'Свободна, развиваюсь',
                    'В поиске себя',
                    'Предпочитаю не говорить'
                ],
                required: true
            },
            {
                id: 'time_for_self',
                title: 'Как находите время для себя?',
                type: 'textarea',
                placeholder: 'Расскажите, как вы уделяете время саморазвитию...',
                required: true,
                maxLength: 500
            },
            {
                id: 'priorities',
                title: 'Что сейчас важнее всего?',
                type: 'radio',
                options: [
                    'Карьера и профессиональный рост',
                    'Семья и отношения',
                    'Личностное развитие',
                    'Здоровье и самочувствие',
                    'Финансовая стабильность',
                    'Творчество и самовыражение'
                ],
                required: true
            },
            {
                id: 'reading_feelings',
                title: 'Что чувствуете, читая книги?',
                type: 'radio',
                options: [
                    'Вдохновение и энергию',
                    'Понимание себя и мира',
                    'Спокойствие и умиротворение', 
                    'Желание действовать и меняться',
                    'Иногда скуку, не всегда интересно'
                ],
                required: true
            },
            {
                id: 'life_philosophy',
                title: 'Какая фраза ближе?',
                type: 'radio',
                options: [
                    '"Принимаю жизнь такой, какая есть"',
                    '"Хорошая жизнь строится, а не дается"',
                    '"Главное — быть счастливым здесь и сейчас"',
                    '"Все происходит по судьбе"'
                ],
                required: true
            },
            {
                id: 'reading_time',
                title: 'Сколько времени читаете в неделю?',
                type: 'radio',
                options: [
                    'Меньше часа',
                    '1-3 часа',
                    '3-7 часов',
                    'Больше 7 часов',
                    'Читаю нерегулярно'
                ],
                required: true
            }
        ];
        
        // Ответы пользователя
        this.answers = {};
        
        // Контактные данные
        this.contactData = {
            email: '',
            source: '' // Откуда узнали о боте
        };
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        // Проверяем, не проходил ли пользователь онбординг
        const onboardingCompleted = this.state.get('user.onboardingCompleted');
        if (onboardingCompleted) {
            // Перенаправляем на главную страницу
            this.app.router.navigate('/');
            return;
        }
        
        // Получаем данные пользователя из Telegram
        this.prefillUserData();
    }
    
    /**
     * 👤 Предзаполнение данных пользователя
     */
    prefillUserData() {
        const telegramUser = this.telegram.getUser();
        if (telegramUser && telegramUser.first_name) {
            this.answers.name = telegramUser.first_name;
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        return `
            <div class="onboarding-page">
                ${this.renderHeader()}
                ${this.renderProgress()}
                <div class="content">
                    ${this.renderCurrentStep()}
                </div>
                ${this.renderNavigationButton()}
            </div>
        `;
    }
    
    /**
     * 📱 Рендер шапки
     */
    renderHeader() {
        const titles = [
            'Добро пожаловать!',
            'Знакомство', 'Знакомство', 'Ваш ритм жизни', 'Ваши приоритеты',
            'Ваше чтение', 'Ваша философия', 'Ваш ритм',
            'Готово!'
        ];
        
        const subtitles = [
            'Ваш персональный проводник в мире цитат',
            'Расскажите о себе', 'Расскажите о себе', 'Понимаем ваши потребности', 'Что важно сейчас',
            'Понимаем ваш опыт', 'Что вам ближе', 'Последний вопрос',
            'Добро пожаловать в сообщество'
        ];
        
        return `
            <div class="onboarding-header">
                <div class="onboarding-title">${titles[this.currentStep]}</div>
                <div class="onboarding-subtitle">${subtitles[this.currentStep]}</div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер прогресс-бара
     */
    renderProgress() {
        const progressPercent = this.currentStep === 0 ? 0 : 
                               this.currentStep > this.totalSteps ? 100 : 
                               Math.round((this.currentStep / this.totalSteps) * 100);
        
        const stepText = this.currentStep === 0 ? 'Знакомство' :
                        this.currentStep > this.totalSteps ? 'Тест завершен' :
                        `Вопрос ${this.currentStep}`;
        
        const stepCount = this.currentStep === 0 ? '0 / 7' :
                         this.currentStep > this.totalSteps ? '7 / 7' :
                         `${this.currentStep} / ${this.totalSteps}`;
        
        return `
            <div class="progress-section">
                <div class="progress-info">
                    <div class="progress-text">${stepText}</div>
                    <div class="progress-steps">${stepCount}</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📄 Рендер текущего шага
     */
    renderCurrentStep() {
        if (this.currentStep === 0) {
            return this.renderWelcome();
        } else if (this.currentStep > this.totalSteps) {
            return this.renderCompletion();
        } else {
            return this.renderQuestion(this.currentStep - 1);
        }
    }
    
    /**
     * 👋 Рендер приветственного экрана
     */
    renderWelcome() {
        return `
            <div class="welcome-screen">
                <div class="welcome-title">Здравствуйте!</div>
                <div class="welcome-description">
                    Вы попали в «Читатель» — ваш личный проводник в мире слов и цитат.
                    <br><br>
                    Меня зовут Анна Бусел, я психолог и основатель «Книжного клуба». 
                    Здесь мы превратим ваши случайные цитаты в персональный дневник роста.
                </div>
                
                <div class="anna-signature">
                    "Хорошая жизнь строится, а не дается по умолчанию. Давайте строить вашу вместе!"
                    <br><br>
                    — Анна Бусел
                </div>
            </div>
        `;
    }
    
    /**
     * ❓ Рендер вопроса
     */
    renderQuestion(questionIndex) {
        const question = this.questions[questionIndex];
        const currentAnswer = this.answers[question.id] || '';
        
        return `
            <div class="question-screen">
                <div class="question-section">
                    <div class="question-number">${questionIndex + 1}</div>
                    <div class="question-title">${question.title}</div>
                    ${this.renderQuestionInput(question, currentAnswer)}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔧 Рендер поля ввода для вопроса
     */
    renderQuestionInput(question, currentAnswer) {
        switch (question.type) {
            case 'text':
                return `
                    <input class="question-input" 
                           id="questionInput"
                           type="text"
                           placeholder="${question.placeholder}"
                           value="${currentAnswer}"
                           maxlength="${question.maxLength || 100}">
                `;
                
            case 'textarea':
                return `
                    <textarea class="question-input question-textarea" 
                              id="questionInput"
                              placeholder="${question.placeholder}"
                              maxlength="${question.maxLength || 500}">${currentAnswer}</textarea>
                `;
                
            case 'radio':
                return `
                    <div class="answer-options">
                        ${question.options.map((option, index) => `
                            <button class="answer-option ${currentAnswer === option ? 'selected' : ''}" 
                                    data-value="${option}">
                                ${option}
                            </button>
                        `).join('')}
                    </div>
                `;
                
            default:
                return '<div class="error">Неизвестный тип вопроса</div>';
        }
    }
    
    /**
     * ✅ Рендер экрана завершения
     */
    renderCompletion() {
        const userName = this.answers.name || 'Друг';
        
        return `
            <div class="completion-screen">
                <div class="completion-title">${userName}, спасибо за ответы!</div>
                <div class="completion-description">
                    Теперь я лучше понимаю ваши потребности и смогу давать персональные рекомендации.
                    <br><br>
                    Готовы начать собирать цитаты и получать еженедельные отчеты с анализом?
                </div>
                
                <div class="anna-signature">
                    "Ваши ответы показывают стремление к осознанному развитию. Это отличная основа для нашей работы вместе!"
                    <br><br>
                    — Анна Бусел
                </div>
                
                ${this.renderContactForm()}
            </div>
        `;
    }
    
    /**
     * 📧 Рендер формы контактных данных
     */
    renderContactForm() {
        return `
            <div class="contact-form" style="margin-top: 20px;">
                <div class="form-group">
                    <label class="form-label">📧 Email для отчетов</label>
                    <input class="question-input" 
                           id="emailInput"
                           type="email"
                           placeholder="your@email.com"
                           value="${this.contactData.email}">
                </div>
                
                <div class="form-group">
                    <label class="form-label">📱 Откуда узнали о боте?</label>
                    <div class="answer-options">
                        ${['Instagram', 'Telegram', 'YouTube', 'Threads', 'От друзей', 'Другое'].map(source => `
                            <button class="answer-option source-option ${this.contactData.source === source ? 'selected' : ''}" 
                                    data-source="${source}">
                                ${source}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * ⬇️ Рендер кнопки навигации
     */
    renderNavigationButton() {
        let buttonText, buttonId, disabled = false;
        
        if (this.currentStep === 0) {
            buttonText = 'Пройти тест (2 минуты)';
            buttonId = 'startBtn';
        } else if (this.currentStep > this.totalSteps) {
            buttonText = this.loading ? 'Сохраняем...' : 'Войти в приложение';
            buttonId = 'completeBtn';
            disabled = this.loading || !this.isContactDataValid();
        } else {
            buttonText = this.currentStep === this.totalSteps ? 'Завершить тест' : 'Далее →';
            buttonId = 'nextBtn';
            disabled = !this.isCurrentStepValid();
        }
        
        return `
            <button class="next-button" 
                    id="${buttonId}" 
                    ${disabled ? 'disabled' : ''}>
                ${buttonText}
            </button>
        `;
    }
    
    /**
     * 🎯 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Кнопка навигации
        this.attachNavigationListener();
        
        // Поля ввода
        this.attachInputListeners();
        
        // Варианты ответов (radio buttons)
        this.attachOptionListeners();
        
        // Контактная форма
        this.attachContactListeners();
    }
    
    /**
     * ➡️ Обработчик кнопки навигации
     */
    attachNavigationListener() {
        const navButton = document.querySelector('.next-button');
        if (navButton) {
            navButton.addEventListener('click', () => this.handleNavigation());
        }
    }
    
    /**
     * 📝 Обработчики полей ввода
     */
    attachInputListeners() {
        const input = document.getElementById('questionInput');
        if (input) {
            input.addEventListener('input', (e) => {
                this.saveCurrentAnswer(e.target.value);
                this.updateNavigationButton();
            });
            
            // Enter для перехода к следующему вопросу
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.isCurrentStepValid()) {
                    this.handleNavigation();
                }
            });
        }
    }
    
    /**
     * ⚪ Обработчики вариантов ответов
     */
    attachOptionListeners() {
        const options = document.querySelectorAll('.answer-option:not(.source-option)');
        options.forEach(option => {
            option.addEventListener('click', () => {
                // Убираем выделение с других опций
                options.forEach(opt => opt.classList.remove('selected'));
                
                // Выделяем текущую опцию
                option.classList.add('selected');
                
                // Сохраняем ответ
                const value = option.dataset.value;
                this.saveCurrentAnswer(value);
                this.updateNavigationButton();
                
                // Haptic feedback
                this.telegram.hapticFeedback('light');
            });
        });
    }
    
    /**
     * 📧 Обработчики контактной формы
     */
    attachContactListeners() {
        // Email
        const emailInput = document.getElementById('emailInput');
        if (emailInput) {
            emailInput.addEventListener('input', (e) => {
                this.contactData.email = e.target.value;
                this.updateNavigationButton();
            });
        }
        
        // Источник
        const sourceOptions = document.querySelectorAll('.source-option');
        sourceOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Убираем выделение с других опций
                sourceOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Выделяем текущую опцию
                option.classList.add('selected');
                
                // Сохраняем источник
                this.contactData.source = option.dataset.source;
                this.updateNavigationButton();
                
                // Haptic feedback
                this.telegram.hapticFeedback('light');
            });
        });
    }
    
    /**
     * 🎯 Обработка навигации
     */
    async handleNavigation() {
        this.telegram.hapticFeedback('medium');
        
        if (this.currentStep === 0) {
            // Начало теста
            this.nextStep();
        } else if (this.currentStep > this.totalSteps) {
            // Завершение онбординга
            await this.completeOnboarding();
        } else {
            // Следующий вопрос
            if (this.isCurrentStepValid()) {
                this.nextStep();
            }
        }
    }
    
    /**
     * ➡️ Переход к следующему шагу
     */
    nextStep() {
        this.currentStep++;
        this.rerender();
    }
    
    /**
     * 💾 Сохранение текущего ответа
     */
    saveCurrentAnswer(value) {
        if (this.currentStep > 0 && this.currentStep <= this.totalSteps) {
            const question = this.questions[this.currentStep - 1];
            this.answers[question.id] = value;
        }
    }
    
    /**
     * ✅ Проверка валидности текущего шага
     */
    isCurrentStepValid() {
        if (this.currentStep === 0 || this.currentStep > this.totalSteps) {
            return true;
        }
        
        const question = this.questions[this.currentStep - 1];
        const answer = this.answers[question.id];
        
        if (question.required) {
            return answer && answer.trim().length > 0;
        }
        
        return true;
    }
    
    /**
     * ✅ Проверка валидности контактных данных
     */
    isContactDataValid() {
        // Email не обязателен, но если введен - должен быть валидным
        if (this.contactData.email && !this.isValidEmail(this.contactData.email)) {
            return false;
        }
        
        // Источник обязателен
        return this.contactData.source && this.contactData.source.length > 0;
    }
    
    /**
     * 📧 Проверка валидности email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * 🔄 Обновление состояния кнопки навигации
     */
    updateNavigationButton() {
        const button = document.querySelector('.next-button');
        if (!button) return;
        
        let disabled = false;
        
        if (this.currentStep > this.totalSteps) {
            disabled = this.loading || !this.isContactDataValid();
        } else if (this.currentStep > 0) {
            disabled = !this.isCurrentStepValid();
        }
        
        button.disabled = disabled;
    }
    
    /**
     * ✅ Завершение онбординга
     */
    async completeOnboarding() {
        if (!this.isContactDataValid()) {
            this.showError('Пожалуйста, заполните обязательные поля');
            return;
        }
        
        try {
            this.loading = true;
            this.updateNavigationButton();
            
            // Подготовка данных для отправки
            const onboardingData = {
                answers: this.answers,
                contact: this.contactData,
                telegram: this.telegram.getUser(),
                completedAt: new Date().toISOString()
            };
            
            // Отправка данных на сервер
            await this.api.completeOnboarding(onboardingData);
            
            // Обновление состояния пользователя
            this.state.set('user.onboardingCompleted', true);
            this.state.set('user.onboardingData', onboardingData);
            
            // Haptic feedback успеха
            this.telegram.hapticFeedback('success');
            
            // Показ уведомления об успехе
            this.showSuccess('✅ Добро пожаловать в сообщество читателей!');
            
            // Задержка перед переходом
            setTimeout(() => {
                this.app.router.navigate('/');
            }, 1500);
            
        } catch (error) {
            console.error('❌ Ошибка завершения онбординга:', error);
            this.showError('Не удалось сохранить данные. Попробуйте еще раз.');
            this.loading = false;
            this.updateNavigationButton();
        }
    }
    
    /**
     * ✅ Показать успех
     */
    showSuccess(message) {
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    /**
     * ⚠️ Показать ошибку
     */
    showError(message) {
        this.error = message;
        
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    /**
     * 🔄 Перерендер страницы
     */
    rerender() {
        const container = document.querySelector('.onboarding-page');
        if (container) {
            container.innerHTML = `
                ${this.renderHeader()}
                ${this.renderProgress()}
                <div class="content">
                    ${this.renderCurrentStep()}
                </div>
                ${this.renderNavigationButton()}
            `;
            this.attachEventListeners();
        }
    }
    
    /**
     * 🔄 Получение прогресса в процентах
     */
    getProgressPercent() {
        if (this.currentStep === 0) return 0;
        if (this.currentStep > this.totalSteps) return 100;
        return Math.round((this.currentStep / this.totalSteps) * 100);
    }
    
    /**
     * 📊 Получение аналитики ответов
     */
    getAnswersAnalytics() {
        const analytics = {
            totalQuestions: this.totalSteps,
            answeredQuestions: Object.keys(this.answers).length,
            completionRate: (Object.keys(this.answers).length / this.totalSteps) * 100
        };
        
        return analytics;
    }
    
    /**
     * 📱 Lifecycle методы
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        // Проверяем, не завершен ли уже онбординг
        const onboardingCompleted = this.state.get('user.onboardingCompleted');
        if (onboardingCompleted) {
            this.app.router.navigate('/');
            return;
        }
        
        // Автофокус на поле ввода для текущего вопроса
        setTimeout(() => {
            const input = document.getElementById('questionInput');
            if (input && input.type !== 'radio') {
                input.focus();
            }
        }, 300);
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        // Сохраняем текущий прогресс в состоянии
        this.state.set('onboarding.progress', {
            currentStep: this.currentStep,
            answers: this.answers,
            contactData: this.contactData
        });
    }
    
    /**
     * 🧹 Очистка при уничтожении
     */
    destroy() {
        // Очистка состояния компонента
        this.loading = false;
        this.error = null;
        this.answers = {};
        this.contactData = { email: '', source: '' };
    }
}

// 📤 Экспорт класса
window.OnboardingPage = OnboardingPage;