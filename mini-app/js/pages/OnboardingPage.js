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
        
        // RETAKE: Режим повторного прохождения
        this.isRetakeMode = false;
        
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
                id: 'lifestyle',
                title: 'Расскажите о себе:',
                type: 'radio',
                options: [
                    '👶 Я мама (дети - главная забота)',
                    '⚖️ Замужем, балансирую дом/работу/себя', 
                    '🌸 Без отношений, изучаю мир и себя'
                ],
                required: true
            },
            {
                id: 'timeForSelf',
                title: 'Как находите время для себя?',
                type: 'radio',
                options: [
                    '🌅 Рано утром, пока все спят',
                    '🌙 Поздно вечером, когда дела сделаны',
                    '📱 Урывками в течение дня',
                    '🤷‍♀️ Время для себя? Что это?'
                ],
                required: true
            },
            {
                id: 'priorities',
                title: 'Что сейчас важнее всего?',
                type: 'radio',
                options: [
                    '🧘‍♀️ Найти внутренний баланс',
                    '💭 Понять свои истинные желания',
                    '💕 Научиться любить себя',
                    '🏗️ Построить гармоничные отношения'
                ],
                required: true
            },
            {
                id: 'readingFeelings',
                title: 'Что чувствуете, читая книги?',
                type: 'radio',
                options: [
                    '🔍 Нахожу ответы на свои вопросы',
                    '⚡ Получаю вдохновение и энергию',
                    '😌 Успокаиваюсь и расслабляюсь',
                    '🌱 Учусь новому о себе и мире'
                ],
                required: true
            },
            {
                id: 'closestPhrase',
                title: 'Какая фраза ближе?',
                type: 'radio',
                options: [
                    '✨ "Счастье — это выбор"',
                    '❤️ "Любовь начинается с себя"',
                    '🌍 "Жизнь — это путешествие"',
                    '🧠 "Мудрость приходит с опытом"'
                ],
                required: true
            },
            {
                id: 'readingTime',
                title: 'Сколько времени читаете в неделю?',
                type: 'radio',
                options: [
                    '📚 Меньше часа (читаю редко)',
                    '⏰ 1-3 часа (по выходным)',
                    '📖  3-7 часов (несколько раз в неделю)',
                    '🤓 Больше 7 часов (читаю каждый день)'
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
    async init() {
        // RETAKE: Проверяем режим повторного прохождения
        this.detectRetakeMode();
        
        // Проверяем статус онбординга через API
        try {
            // ✅ ИСПРАВЛЕНО: Получаем userId из состояния приложения
            const profile = this.state.get('user.profile');
            const userId = profile?.telegramId || profile?.id || 'demo-user';
            console.log('🔍 OnboardingPage: Используем userId для проверки:', userId);
            
            const onboardingStatus = await this.api.checkOnboardingStatus(userId);
            console.log('📊 OnboardingPage: Статус онбординга:', onboardingStatus);
            
            // RETAKE: Только редиректим если завершен И НЕ в режиме повторного прохождения
            if (onboardingStatus.completed && !this.isRetakeMode) {
                // Перенаправляем на главную страницу
                this.app.router.navigate('/home');
                return;
            }
            
            // RETAKE: Если в режиме повторного прохождения, предзаполняем предыдущие ответы
            if (this.isRetakeMode && onboardingStatus.completed) {
                this.prefillPreviousAnswers(onboardingStatus);
            }
        } catch (error) {
            console.warn('⚠️ OnboardingPage: Ошибка проверки статуса онбординга:', error);
            
            // Fallback: проверяем локальное состояние
            const onboardingCompleted = this.state.get('user.profile.isOnboardingCompleted');
            // RETAKE: Только редиректим если завершен И НЕ в режиме повторного прохождения
            if (onboardingCompleted && !this.isRetakeMode) {
                this.app.router.navigate('/home');
                return;
            }
        }
        
        // Получаем данные пользователя из Telegram
        this.prefillUserData();
    }
    
    /**
     * 🔄 RETAKE: Определение режима повторного прохождения
     */
    detectRetakeMode() {
        // Проверяем URL параметр retake=1 или retake=true
        const urlParams = new URLSearchParams(window.location.search);
        const retakeParam = urlParams.get('retake');
        const isRetakeFromUrl = retakeParam === '1' || retakeParam === 'true';
        
        // Проверяем флаг в состоянии приложения
        const forceRetakeFlag = this.state.get('onboarding.forceRetake');
        
        this.isRetakeMode = isRetakeFromUrl || forceRetakeFlag;
        
        console.log('🔄 OnboardingPage: Режим повторного прохождения:', this.isRetakeMode, {
            urlParam: retakeParam,
            stateFlag: forceRetakeFlag
        });
        
        // Устанавливаем флаг в состоянии для последующего использования
        if (this.isRetakeMode) {
            this.state.set('onboarding.isRetake', true);
        }
    }
    
    /**
     * 📋 RETAKE: Предзаполнение предыдущих ответов
     */
    prefillPreviousAnswers(onboardingStatus) {
        if (onboardingStatus.answers) {
            console.log('📋 OnboardingPage: Предзаполняем предыдущие ответы:', onboardingStatus.answers);
            this.answers = { ...onboardingStatus.answers };
        } else if (onboardingStatus.testResults) {
            console.log('📋 OnboardingPage: Предзаполняем из testResults:', onboardingStatus.testResults);
            this.answers = { ...onboardingStatus.testResults };
        }
        
        // Также пытаемся получить контактные данные
        if (onboardingStatus.email) {
            this.contactData.email = onboardingStatus.email;
        }
        if (onboardingStatus.source) {
            this.contactData.source = onboardingStatus.source;
        }
    }
    
    /**
     * 👤 Предзаполнение данных пользователя
     */
    prefillUserData() {
        console.log('👤 OnboardingPage: Предзаполнение данных пользователя');
        
        // Получаем данные из Telegram
        let telegramUser = null;
        
        if (this.telegram && typeof this.telegram.getUser === 'function') {
            telegramUser = this.telegram.getUser();
            console.log('📱 OnboardingPage: Данные Telegram пользователя:', telegramUser);
        } else {
            console.warn('⚠️ OnboardingPage: TelegramService недоступен');
        }
        
        // Предзаполняем имя из Telegram
        if (telegramUser && telegramUser.first_name) {
            this.answers.name = telegramUser.first_name;
            console.log('✅ OnboardingPage: Имя предзаполнено:', telegramUser.first_name);
        } else {
            // Fallback: пытаемся получить из состояния приложения
            const userProfile = this.state.get('user.profile');
            if (userProfile && userProfile.firstName) {
                this.answers.name = userProfile.firstName;
                console.log('✅ OnboardingPage: Имя получено из состояния:', userProfile.firstName);
            } else {
                console.log('ℹ️ OnboardingPage: Имя пользователя не найдено, будет введено вручную');
            }
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        // RETAKE: Добавляем CSS класс для режима повторного прохождения
        const retakeClass = this.isRetakeMode ? ' is-retake' : '';
        
        return `
            <div class="onboarding-page${retakeClass}">
                ${this.renderHeader()}
                ${this.renderProgress()}
                <div class="onboarding-content-wrapper">
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
        // RETAKE: Разные заголовки для режима повторного прохождения
        if (this.isRetakeMode) {
            const titles = [
                'Повторное прохождение',
                'Знакомство', 'Знакомство', 'Ваш ритм жизни', 'Ваши приоритеты',
                'Ваше чтение', 'Ваша философия', 'Ваш ритм',
                'Готово!'
            ];
            
            const subtitles = [
                'Обновляем ваш профиль для лучших рекомендаций',
                'Расскажите о себе', 'Расскажите о себе', 'Понимаем ваши потребности', 'Что важно сейчас',
                'Понимаем ваш опыт', 'Что вам ближе', 'Последний вопрос',
                'Профиль обновлен'
            ];
            
            return `
                <div class="onboarding-header">
                    <div class="onboarding-title">${titles[this.currentStep]}</div>
                    <div class="onboarding-subtitle">${subtitles[this.currentStep]}</div>
                </div>
            `;
        }
        
        // Обычные заголовки для первого прохождения
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
        // ИСПРАВЛЕНО: Предотвращаем множественные вызовы
        if (this.loading) {
            console.log('⚠️ Онбординг уже в процессе, игнорируем повторный вызов');
            return;
        }
        
        if (!this.isContactDataValid()) {
            this.showError('Пожалуйста, заполните обязательные поля');
            return;
        }
        
        try {
            this.loading = true;
            this.updateNavigationButton();
            
            // Подготовка данных для отправки
            let telegramData = null;
            
            // Безопасное получение данных Telegram
            if (this.telegram && typeof this.telegram.getUser === 'function') {
                try {
                    telegramData = this.telegram.getUser();
                    console.log('📱 OnboardingPage: Данные Telegram для отправки:', telegramData);
                } catch (error) {
                    console.warn('⚠️ OnboardingPage: Ошибка получения данных Telegram:', error);
                }
            }
            
            const onboardingData = {
                user: telegramData,               // ✅ Backend ожидает "user"
                answers: this.answers,            // ✅ OK
                email: this.contactData.email,    // ✅ Backend ожидает "email"
                source: this.contactData.source,  // ✅ Backend ожидает "source"
                telegramData: telegramData,
                retake: this.isRetakeMode         // RETAKE: Передаем флаг повторного прохождения
            };
            
            // Отправка данных на сервер
            await this.api.completeOnboarding(onboardingData);
            
            // Обновление состояния пользователя
            this.state.update('user.profile', {
                isOnboardingCompleted: true,
                // RETAKE: Обновляем timestamp последнего онбординга
                lastOnboardingAt: new Date().toISOString()
            });
            this.state.set('user.onboardingData', onboardingData);
            
            // RETAKE: Очищаем флаги повторного прохождения
            if (this.isRetakeMode) {
                this.state.remove('onboarding.forceRetake');
                this.state.remove('onboarding.isRetake');
            }
            
            // Haptic feedback успеха
            this.telegram.hapticFeedback('success');
            
            // RETAKE: Разные сообщения для первого прохождения и повторного
            const successMessage = this.isRetakeMode 
                ? '✅ Обновлено!' 
                : '✅ Добро пожаловать в сообщество читателей!';
            
            // Показ уведомления об успехе
            this.showSuccess(successMessage);
            
            // Задержка перед переходом
            setTimeout(() => {
                this.app.router.navigate('/home');
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
            // RETAKE: Сохраняем CSS класс повторного прохождения при перерендере
            const retakeClass = this.isRetakeMode ? ' is-retake' : '';
            container.className = `onboarding-page${retakeClass}`;
            
            container.innerHTML = `
                ${this.renderHeader()}
                ${this.renderProgress()}
                <div class="onboarding-content-wrapper">
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
        const onboardingCompleted = this.state.get('user.profile.isOnboardingCompleted');
        if (onboardingCompleted) {
            this.app.router.navigate('/home');
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
