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
        
        // === RETAKE FIX START ===
        // Защита от двойных переходов между шагами
        this.transitioning = false;
        // === RETAKE FIX END ===
        
        // Haptic feedback debouncing
        this.lastHapticAt = 0;
        this.hapticDebounceMs = 120;
        
        // === ONBOARDING STABILITY START ===
        // Навигационная блокировка для предотвращения двойных кликов
        this._navLock = false;
        this._navLockTimeout = null;
        // Флаг анимации для отключения повторных анимаций
        this._animationPlayed = false;
        // === ONBOARDING STABILITY END ===
        
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
        
        // Parse query parameters early to set isRetakeMode before any status checks
        this.parseQuery();
        
        this.init();
    }
    
    /**
     * 🔍 Parse URL query parameters early
     */
    parseQuery() {
        const urlParams = new URLSearchParams(window.location.search);
        const retakeParam = urlParams.get('retake');
        const isRetakeFromUrl = retakeParam === '1' || retakeParam === 'true';
        
        // Check flag in application state
        const forceRetakeFlag = this.state.get('onboarding.forceRetake');
        
        this.isRetakeMode = isRetakeFromUrl || forceRetakeFlag;
        
        console.log('🔍 OnboardingPage: Early retake mode detection:', this.isRetakeMode, {
            urlParam: retakeParam,
            stateFlag: forceRetakeFlag
        });
        
        // Set flag in state for later use
        if (this.isRetakeMode) {
            this.state.set('onboarding.isRetake', true);
        }
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    async init() {
        // Guard against duplicate status checks
        if (this._statusLoaded) {
            console.log('📊 OnboardingPage: Status already loaded, skipping duplicate check');
            this.prefillUserData();
            return;
        }
        
        // RETAKE: Проверяем режим повторного прохождения (redundant but keeping for compatibility)
        this.detectRetakeMode();
        
        // Устанавливаем guard против выхода из онбординга
        this.setupPopstateGuard();
        
        // === ONBOARDING STABILITY START ===
        // Проверяем, не применен ли уже onboarding gate в App.js
        // чтобы избежать дублирующих navigate('/onboarding')
        const onboardingGateApplied = this.app._onboardingGateApplied;
        if (onboardingGateApplied) {
            console.log('🚪 OnboardingPage: Onboarding gate уже применен в App.js, пропускаем повторную проверку');
            this.prefillUserData();
            return;
        }
        // === ONBOARDING STABILITY END ===
        
        // Проверяем статус онбординга через API
        try {
            // ✅ ИСПРАВЛЕНО: Получаем userId из состояния приложения
            const profile = this.state.get('user.profile');
            const userId = profile?.telegramId || profile?.id || 'demo-user';
            console.log('🔍 OnboardingPage: Используем userId для проверки:', userId);
            
            const onboardingStatus = await this.api.checkOnboardingStatus(userId);
            console.log('📊 OnboardingPage: Статус онбординга:', onboardingStatus);
            
            // Mark status as loaded to prevent duplicate calls
            this._statusLoaded = true;
            
            // RETAKE: Только редиректим если завершен И НЕ в режиме повторного прохождения
            if (onboardingStatus.isOnboardingComplete && !this.isRetakeMode) {
                // Перенаправляем на главную страницу
                this.app.router.navigate('/home');
                return;
            }
            
            // RETAKE: Если в режиме повторного прохождения, предзаполняем предыдущие ответы
            if (this.isRetakeMode && onboardingStatus.isOnboardingComplete) {
                this.prefillPreviousAnswers(onboardingStatus);
            }
        } catch (error) {
            console.warn('⚠️ OnboardingPage: Ошибка проверки статуса онбординга:', error);
            
            // Fallback: проверяем локальное состояние
            const onboardingCompleted = this.state.get('user.profile.isOnboardingComplete');
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
     * 🚪 Установка защиты от выхода из онбординга через кнопку "Назад"
     */
    setupPopstateGuard() {
        // Проверяем, не установлен ли уже guard
        if (this._popstateGuardActive) {
            return;
        }
        
        this._popstateGuardActive = true;
        
        // Обработчик popstate событий (кнопка "Назад" браузера)
        this._popstateHandler = (event) => {
            // Проверяем, завершен ли онбординг
            const isOnboardingComplete = this.state.get('user.profile.isOnboardingComplete');
            
            // Если онбординг не завершен и мы не в режиме retake, блокируем выход
            if (!isOnboardingComplete && !this.isRetakeMode) {
                console.log('🚪 OnboardingPage: Блокируем выход из незавершенного онбординга');
                
                // Предотвращаем навигацию назад
                event.preventDefault();
                history.pushState(null, null, window.location.pathname);
                
                // Показываем предупреждение пользователю
                if (this.telegram && this.telegram.showAlert) {
                    this.telegram.showAlert('Пожалуйста, завершите тест для продолжения работы с ботом');
                }
                
                return false;
            }
        };
        
        // Устанавливаем слушатель
        window.addEventListener('popstate', this._popstateHandler);
        
        // Добавляем состояние в историю для корректной работы guard
        history.pushState(null, null, window.location.pathname);
        
        console.log('🚪 OnboardingPage: Popstate guard установлен');
    }
    
    /**
     * 🚪 Снятие защиты от выхода из онбординга
     */
    removePopstateGuard() {
        if (this._popstateHandler && this._popstateGuardActive) {
            window.removeEventListener('popstate', this._popstateHandler);
            this._popstateHandler = null;
            this._popstateGuardActive = false;
            console.log('🚪 OnboardingPage: Popstate guard снят');
        }
    }
    
    /**
     * 📋 RETAKE: Предзаполнение предыдущих ответов
     */
    prefillPreviousAnswers(onboardingStatus) {
        console.log('📋 OnboardingPage: Предзаполняем предыдущие ответы в режиме retake:', onboardingStatus);
        
        if (onboardingStatus.answers) {
            console.log('📋 OnboardingPage: Предзаполняем из answers:', onboardingStatus.answers);
            this.answers = { ...onboardingStatus.answers };
        } else if (onboardingStatus.testResults) {
            console.log('📋 OnboardingPage: Предзаполняем из testResults:', onboardingStatus.testResults);
            this.answers = { ...onboardingStatus.testResults };
        }
        
        // RETAKE: Предзаполняем контактные данные для повторного прохождения
        if (onboardingStatus.email) {
            this.contactData.email = onboardingStatus.email;
            console.log('📧 OnboardingPage: Предзаполнен email:', onboardingStatus.email);
        } else {
            // Пытаемся получить email из профиля пользователя
            const profileEmail = this.state.get('user.profile.email');
            if (profileEmail) {
                this.contactData.email = profileEmail;
                console.log('📧 OnboardingPage: Email предзаполнен из профиля:', profileEmail);
            }
        }
        
        if (onboardingStatus.source) {
            this.contactData.source = onboardingStatus.source;
            console.log('📱 OnboardingPage: Предзаполнен source:', onboardingStatus.source);
        } else {
            // Очищаем source в режиме retake, чтобы пользователь мог заново выбрать
            this.contactData.source = '';
            console.log('📱 OnboardingPage: Source очищен для повторного выбора');
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
        
        // === ONBOARDING STABILITY START ===
        // Добавляем data-animated флаг для управления анимациями
        const animatedAttr = this._animationPlayed ? ' data-animated="true"' : '';
        // === ONBOARDING STABILITY END ===
        
        return `
            <div class="onboarding-page${retakeClass}"${animatedAttr}>
                ${this.renderHeader()}
                ${this.renderProgress()}
                <div class="onboarding-content-wrapper">
                    <div class="onboarding-dynamic">
                        ${this.renderCurrentStep()}
                    </div>
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
        
        // === RETAKE FIX START ===
        // В режиме повторного прохождения не показываем форму контактов
        if (this.isRetakeMode) {
            return `
                <div class="completion-screen retake-mode">
                    <div class="completion-title">${userName}, ваш профиль обновлен!</div>
                    <div class="completion-description">
                        Спасибо за актуализацию ваших данных. Теперь я смогу давать еще более точные персональные рекомендации.
                        <br><br>
                        Готовы продолжить работу с обновленным профилем?
                    </div>
                    
                    <div class="anna-signature">
                        "Регулярное обновление профиля помогает мне лучше понимать ваши изменения и потребности!"
                        <br><br>
                        — Анна Бусел
                    </div>
                </div>
            `;
        }
        // === RETAKE FIX END ===
        
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
                        ${['Instagram', 'Telegram', 'YouTube', 'Threads', 'Друзья', 'Другое'].map(source => `
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
        // === RETAKE FIX START ===
        // Удаляем старый делегированный обработчик если существует
        if (this.delegatedClickHandler) {
            const container = document.querySelector('.onboarding-page');
            if (container) {
                container.removeEventListener('click', this.delegatedClickHandler);
            }
        }
        
        // Создаем единый делегированный обработчик для всех кликов
        this.delegatedClickHandler = (event) => {
            const target = event.target;
            
            // Кнопка навигации
            if (target.classList.contains('next-button') || target.id === 'startBtn' || 
                target.id === 'nextBtn' || target.id === 'completeBtn') {
                this.handleNavigation();
                return;
            }
            
            // Варианты ответов (кроме источников)
            if (target.classList.contains('answer-option') && !target.classList.contains('source-option')) {
                this.handleAnswerOptionClick(target);
                return;
            }
            
            // Опции источников
            if (target.classList.contains('source-option')) {
                this.handleSourceOptionClick(target);
                return;
            }
        };
        
        // Привязываем делегированный обработчик к корневому элементу
        const container = document.querySelector('.onboarding-page');
        if (container) {
            container.addEventListener('click', this.delegatedClickHandler);
        }
        // === RETAKE FIX END ===
        
        // Поля ввода (обрабатываем отдельно, так как нужны события input/keypress)
        this.attachInputListeners();
        
        // Контактная форма email (если присутствует)
        this.attachContactListeners();
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
    
    // === RETAKE FIX START ===
    /**
     * 🎯 Обработчик клика по варианту ответа (для делегированных событий)
     */
    handleAnswerOptionClick(option) {
        // Убираем выделение с других опций
        const options = document.querySelectorAll('.answer-option:not(.source-option)');
        options.forEach(opt => opt.classList.remove('selected'));
        
        // Выделяем текущую опцию
        option.classList.add('selected');
        
        // Сохраняем ответ
        const value = option.dataset.value;
        this.saveCurrentAnswer(value);
        this.updateNavigationButton();
        
        // Haptic feedback
        this.triggerHapticFeedback('light');
    }
    
    /**
     * 📱 Обработчик клика по опции источника (для делегированных событий)
     */
    handleSourceOptionClick(option) {
        // Убираем выделение с других опций
        const sourceOptions = document.querySelectorAll('.source-option');
        sourceOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Выделяем текущую опцию
        option.classList.add('selected');
        
        // Сохраняем источник
        this.contactData.source = option.dataset.source;
        this.updateNavigationButton();
        
        // Haptic feedback
        this.triggerHapticFeedback('light');
    }
    // === RETAKE FIX END ===
    
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
                this.triggerHapticFeedback('light');
            });
        });
    }
    
    /**
     * 🎯 Обработка навигации
     */
    async handleNavigation() {
        // === ONBOARDING STABILITY START ===
        // Debounce защита от двойных кликов (200-250ms)
        if (this._navLock) {
            console.log('🚫 OnboardingPage: Навигация заблокирована (debounce), игнорируем');
            return;
        }
        
        this._navLock = true;
        
        // Освобождаем блокировку через 250ms
        if (this._navLockTimeout) {
            clearTimeout(this._navLockTimeout);
        }
        this._navLockTimeout = setTimeout(() => {
            this._navLock = false;
        }, 250);
        // === ONBOARDING STABILITY END ===
        
        this.triggerHapticFeedback('medium');
        
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
        // === RETAKE FIX START ===
        // Защита от двойных переходов
        if (this.transitioning) {
            console.log('🚫 OnboardingPage: Переход уже в процессе, игнорируем');
            return;
        }
        
        this.transitioning = true;
        
        // Освобождаем блокировку через 150ms
        setTimeout(() => {
            this.transitioning = false;
        }, 150);
        // === RETAKE FIX END ===
        
        this.currentStep++;
        
        // === ONBOARDING STABILITY START ===
        // Используем частичный перерендер вместо полного для предотвращения повторных анимаций
        if (this.currentStep > 1) {
            this.partialRerender();
        } else {
            this.rerender();
        }
        
        // После завершения (когда currentStep > totalSteps) обновляем кнопку навигации
        if (this.currentStep > this.totalSteps) {
            setTimeout(() => {
                this.updateNavigationButton();
            }, 100);
        }
        // === ONBOARDING STABILITY END ===
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
        // В режиме повторного прохождения пропускаем всю валидацию контактов!
        if (this.isRetakeMode) {
            return true;
        }

        // В остальных случаях — валидация email и source
        // (Оставляем только для НЕ retake режима)

        // Собираем актуальные данные из формы
        const contactData = this.gatherContactData();

        // Email обязателен
        if (!contactData.email || contactData.email.trim().length === 0) {
            console.log('📧 OnboardingPage: Email is missing or empty');
            return false;
        }

        // Email должен быть валидным
        if (!this.isValidEmail(contactData.email)) {
            console.log('📧 OnboardingPage: Email format is invalid');
            return false;
        }

        // Источник обязателен
        if (!contactData.source || contactData.source.length === 0) {
            console.log('📱 OnboardingPage: Source is missing');
            return false;
        }

        return true;
    }
        
        // Собираем актуальные данные из формы
        const contactData = this.gatherContactData();
        
        // Email обязателен
        if (!contactData.email || contactData.email.trim().length === 0) {
            console.log('📧 OnboardingPage: Email is missing or empty');
            return false;
        }
        
        // Email должен быть валидным
        if (!this.isValidEmail(contactData.email)) {
            console.log('📧 OnboardingPage: Email format is invalid');
            return false;
        }
        
        // Источник обязателен
        if (!contactData.source || contactData.source.length === 0) {
            console.log('📱 OnboardingPage: Source is missing');
            return false;
        }
        
        return true;
    }
    
    /**
     * 📧 Проверка валидности email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * 📊 Сбор и нормализация контактных данных
     * Обеспечивает соответствие с backend enum
     */
    gatherContactData() {
        // Always read from DOM first if available, then fallback to stored state
        const emailInput = document.getElementById('emailInput');
        let currentEmail = this.contactData.email || '';
        
        if (emailInput) {
            currentEmail = emailInput.value.trim();
            // Update stored state to keep in sync
            this.contactData.email = currentEmail;
        } else if (this.currentStep > this.totalSteps) {
            // If we're at completion step but no input found, this is a problem
            console.warn('⚠️ OnboardingPage: Email input missing at completion step');
        }
        
        // Карта нормализации источников (совпадает с серверной)
        const sourceMapping = {
            'Instagram': 'Instagram',
            'Telegram': 'Telegram', 
            'YouTube': 'YouTube',
            'Threads': 'Threads',
            'Друзья': 'Друзья',
            'Другое': 'Другое',
            
            // Проблематичные варианты для нормализации
            'telegram': 'Telegram',
            'От друзей': 'Друзья',        // локализованная строка -> enum значение
            'от друзей': 'Друзья',
            'instagram': 'Instagram',
            'youtube': 'YouTube',
            'threads': 'Threads',
            'другое': 'Другое',
            'друзья': 'Друзья'
        };
        
        // Нормализация source с fallback
        const rawSource = this.contactData.source || 'Другое';
        const normalizedSource = sourceMapping[rawSource] || 'Другое';
        
        return {
            email: currentEmail,
            source: normalizedSource
        };
    }
    
    /**
     * 🔄 Обновление состояния кнопки навигации (с debounce защитой)
     */
    updateNavigationButton() {
        // Debounce защита от множественных вызовов
        if (this._updateButtonTimeout) {
            clearTimeout(this._updateButtonTimeout);
        }
        
        this._updateButtonTimeout = setTimeout(() => {
            this._updateNavigationButtonNow();
        }, 50);
    }
    
    /**
     * 🔄 Непосредственное обновление состояния кнопки навигации
     */
    _updateNavigationButtonNow() {
        const button = document.querySelector('.next-button');
        if (!button) return;
        
        let disabled = false;
        
        if (this.currentStep > this.totalSteps) {
            disabled = this.loading || !this.isContactDataValid();
        } else if (this.currentStep > 0) {
            disabled = !this.isCurrentStepValid();
        }
        
        // === RETAKE FIX START ===
        // Отладочное логирование для диагностики состояния кнопки
        console.log('🔘 OnboardingPage: updateNavigationButton', {
            currentStep: this.currentStep,
            totalSteps: this.totalSteps,
            loading: this.loading,
            isRetakeMode: this.isRetakeMode,
            isContactDataValid: this.isContactDataValid(),
            isCurrentStepValid: this.isCurrentStepValid(),
            disabled: disabled
        });
        // === RETAKE FIX END ===
        
        button.disabled = disabled;
    }
    
    /**
     * ✅ Завершение онбординга
     */
    async completeOnboarding() {
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

            let telegramData = null;
            if (this.telegram && typeof this.telegram.getUser === 'function') {
                try {
                    telegramData = this.telegram.getUser();
                    console.log('📱 OnboardingPage: Данные Telegram для отправки:', telegramData);
                } catch (error) {
                    console.warn('⚠️ OnboardingPage: Ошибка получения данных Telegram:', error);
                }
            }

            this.ensureCompletionFormMounted();

            if (!this.isContactDataValid()) {
                this.showError('Пожалуйста, заполните обязательные поля корректно');
                return;
            }

            const contactData = this.gatherContactData();

            const onboardingData = {
                user: telegramData,
                answers: this.answers,
                email: contactData.email,
                source: contactData.source,
                telegramData: telegramData
            };

            if (this.isRetakeMode && (!contactData.email || contactData.email.trim() === '')) {
                const profileEmail = this.state.get('user.profile.email');
                if (profileEmail) {
                    onboardingData.email = profileEmail;
                    console.log('📧 OnboardingPage: Инжектирован email из профиля:', profileEmail);
                }
            }
            if (this.isRetakeMode) {
                onboardingData.forceRetake = true;
                console.log('🔄 OnboardingPage: Добавлен forceRetake флаг для повторного прохождения');
            }

            console.log('📤 OnboardingPage: Отправляем нормализованные данные:', onboardingData);

            const response = await this.api.completeOnboarding(onboardingData);

            // Универсальная обработка успеха (ретейк, alreadyCompleted, обычный success)
            if (response && response.success && (response.retake || response.alreadyCompleted || response.user)) {
                console.log('✅ Онбординг успешно завершён или обновлён:', response);

                this.removePopstateGuard();

                this.state.update('user.profile', {
                    isOnboardingComplete: true,
                    lastOnboardingAt: new Date().toISOString()
                });
                this.state.set('user.onboardingData', onboardingData);

                if (this.isRetakeMode) {
                    this.state.remove('onboarding.forceRetake');
                    this.state.remove('onboarding.isRetake');
                }

                this.triggerHapticFeedback('success');

                let successMessage =
                    response.alreadyCompleted
                        ? '✅ Онбординг уже завершён!'
                        : this.isRetakeMode
                            ? '✅ Ответы обновлены!'
                            : '✅ Добро пожаловать в сообщество читателей!';
                this.showSuccess(successMessage);

                setTimeout(() => {
                    this.app.router.navigate('/home');
                }, 1500);

            } else {
                this.showError('Не удалось сохранить профиль. Попробуйте еще раз.');
            }

        } catch (error) {
            console.error('❌ Ошибка завершения онбординга:', error);
            this.showError('Не удалось сохранить данные. Попробуйте еще раз.');
        } finally {
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
    /**
     * 🔄 Полный перерендер страницы
     */
    rerender() {
        const container = document.querySelector('.onboarding-page');
        if (container) {
            // RETAKE: Сохраняем CSS класс повторного прохождения при перерендере
            const retakeClass = this.isRetakeMode ? ' is-retake' : '';
            
            // === ONBOARDING STABILITY START ===
            // Добавляем data-animated флаг для управления анимациями
            const animatedAttr = this._animationPlayed ? ' data-animated="true"' : '';
            container.className = `onboarding-page${retakeClass}`;
            if (this._animationPlayed) {
                container.setAttribute('data-animated', 'true');
            }
            // === ONBOARDING STABILITY END ===
            
            // === RETAKE FIX START ===
            // Обновляем только внутренний HTML, сохраняя корневой контейнер
            // для предотвращения пересоздания делегированных обработчиков
            container.innerHTML = `
                ${this.renderHeader()}
                ${this.renderProgress()}
                <div class="onboarding-content-wrapper">
                    <div class="onboarding-dynamic">
                        ${this.renderCurrentStep()}
                    </div>
                </div>
                ${this.renderNavigationButton()}
            `;
            // Переустанавливаем обработчики событий один раз
            this.attachEventListeners();
            // === RETAKE FIX END ===
        }
    }
    
    /**
     * 🔄 Частичный перерендер - обновляет только динамический контент
     * Используется для предотвращения пересоздания анимаций
     * 
     * @JSDoc Метод для минимального обновления контента без потери анимаций
     */
    partialRerender() {
        // === ONBOARDING STABILITY START ===
        const dynamicContainer = document.querySelector('.onboarding-dynamic');
        const progressSection = document.querySelector('.progress-section');
        const navigationButton = document.querySelector('.next-button');
        
        if (dynamicContainer) {
            // Обновляем только динамический контент
            dynamicContainer.innerHTML = this.renderCurrentStep();
            console.log('🔄 OnboardingPage: Частичный перерендер выполнен');
        }
        
        if (progressSection) {
            // Обновляем прогресс-бар
            progressSection.outerHTML = this.renderProgress();
        }
        
        if (navigationButton) {
            // Обновляем кнопку навигации
            navigationButton.outerHTML = this.renderNavigationButton();
        }
        
        // Переустанавливаем обработчики событий только для обновленных элементов
        this.attachEventListeners();
        
        // Если мы на этапе завершения, сразу обновляем состояние кнопки навигации
        if (this.currentStep > this.totalSteps) {
            this.updateNavigationButton();
        }
        
        // Отмечаем что анимация уже была проиграна
        if (!this._animationPlayed) {
            this._animationPlayed = true;
            const container = document.querySelector('.onboarding-page');
            if (container) {
                container.setAttribute('data-animated', 'true');
            }
        }
        // === ONBOARDING STABILITY END ===
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
     * 📝 Ensure completion form is mounted when at completion step
     */
    ensureCompletionFormMounted() {
        if (this.currentStep <= this.totalSteps) {
            return; // Not at completion step
        }
        
        const emailInput = document.getElementById('emailInput');
        if (emailInput) {
            return; // Form is already mounted
        }
        
        console.warn('⚠️ OnboardingPage: Completion form not mounted, re-rendering');
        this.rerender();
    }
    
    /**
     * 📳 Debounced haptic feedback to prevent spam
     * @param {string} type - Type of haptic feedback ('light', 'medium', 'heavy', 'success')
     */
    triggerHapticFeedback(type = 'light') {
        const now = Date.now();
        if (now - this.lastHapticAt < this.hapticDebounceMs) {
            console.log('📳 OnboardingPage: Haptic feedback debounced');
            return;
        }
        
        this.lastHapticAt = now;
        
        if (this.telegram && this.telegram.hapticFeedback) {
            this.telegram.hapticFeedback(type);
        }
    }
    
    /**
     * 🧹 Очистка при уничтожении
     */
    destroy() {
        // Снимаем popstate guard
        this.removePopstateGuard();
        
        // === RETAKE FIX START ===
        // Очищаем делегированный обработчик событий
        if (this.delegatedClickHandler) {
            const container = document.querySelector('.onboarding-page');
            if (container) {
                container.removeEventListener('click', this.delegatedClickHandler);
            }
            this.delegatedClickHandler = null;
        }
        // === RETAKE FIX END ===
        
        // === ONBOARDING STABILITY START ===
        // Очищаем таймаут навигационной блокировки
        if (this._navLockTimeout) {
            clearTimeout(this._navLockTimeout);
            this._navLockTimeout = null;
        }
        
        // Очищаем таймаут обновления кнопки
        if (this._updateButtonTimeout) {
            clearTimeout(this._updateButtonTimeout);
            this._updateButtonTimeout = null;
        }
        
        this._navLock = false;
        this._animationPlayed = false;
        // === ONBOARDING STABILITY END ===
        
        // Очистка состояния компонента
        this.loading = false;
        this.error = null;
        this.answers = {};
        this.contactData = { email: '', source: '' };
    }
}

// 📤 Экспорт класса
window.OnboardingPage = OnboardingPage;
