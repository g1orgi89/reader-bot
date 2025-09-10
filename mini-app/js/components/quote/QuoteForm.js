/**
 * 📝 QUOTE FORM COMPONENT
 * Форма добавления новой цитаты с AI-анализом в реальном времени
 * 
 * Функциональность:
 * - Интерактивная форма с валидацией
 * - AI-анализ в реальном времени при вводе
 * - Автосохранение черновиков
 * - Предпросмотр цитаты
 * - UX для быстрого добавления
 * - Интеграция с API Service и State Management
 * 
 * @author Claude
 * @version 2.0.0
 * @since 28.07.2025
 */

class QuoteForm {
    /**
     * @param {Object} options - Опции компонента
     * @param {HTMLElement} options.container - Контейнер для формы
     * @param {Function} options.onSave - Callback при сохранении
     * @param {Function} options.onCancel - Callback при отмене
     * @param {Object} options.initialData - Начальные данные для редактирования
     */
    constructor(options = {}) {
        this.options = {
            container: null,
            onSave: null,
            onCancel: null,
            initialData: null,
            showPreview: true,
            autoSaveDrafts: true,
            enableAiAnalysis: true,
            showPopularAuthors: true,
            maxLength: 2000,
            ...options
        };

        // Зависимости
        this.api = window.apiService;
        this.state = window.appState;
        this.storage = window.storageService;
        this.telegram = window.Telegram?.WebApp;

        // DOM элементы
        this.element = null;
        this.textArea = null;
        this.authorInput = null;
        this.saveButton = null;
        this.previewContainer = null;

        // Состояние формы
        this.formData = {
            text: '',
            author: '',
            source: 'manual', // manual, book
            category: null
        };

        // AI анализ
        this.aiAnalysis = null;
        this.aiAnalysisTimeout = null;
        this.isAnalyzing = false;

        // Популярные авторы (из кэша)
        this.popularAuthors = [];
        
        // Валидация
        this.validation = {
            isValid: false,
            errors: {},
            touched: {}
        };

        // Черновики
        this.draftKey = 'quote_draft_' + Date.now();
        this.autoSaveTimeout = null;

        // Инициализация
        this.init();
    }

    /**
     * Инициализация компонента
     */
    init() {
        this.loadInitialData();
        this.loadPopularAuthors();
        this.createElement();
        this.attachEventListeners();
        this.loadDraft();
        this.validateForm();
        
        // Установка фокуса на поле ввода
        setTimeout(() => {
            if (this.textArea) {
                this.textArea.focus();
            }
        }, 100);
    }

    /**
     * Загрузка начальных данных
     */
    loadInitialData() {
        if (this.options.initialData) {
            this.formData = { ...this.formData, ...this.options.initialData };
            this.draftKey = `quote_edit_${this.options.initialData.id}`;
        }
    }

    /**
     * Загрузка популярных авторов
     */
    async loadPopularAuthors() {
        try {
            if (this.storage) {
                const cached = this.storage.getLocal('popular_authors');
                if (cached) {
                    this.popularAuthors = cached;
                    return;
                }
            }

            if (this.api) {
                const stats = await this.api.getStats();
                this.popularAuthors = stats.favoriteAuthors || [];
                
                if (this.storage) {
                    this.storage.setLocal('popular_authors', this.popularAuthors, '1h');
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки популярных авторов:', error);
            this.popularAuthors = [
                'Эрих Фромм', 'Анна Бусел', 'Марина Цветаева', 
                'Антон Чехов', 'Лев Толстой', 'Федор Достоевский'
            ];
        }
    }

    /**
     * Создание DOM элемента формы
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'quote-form';
        
        this.element.innerHTML = this.renderForm();
        
        // Получаем ссылки на важные элементы
        this.textArea = this.element.querySelector('.quote-form__textarea');
        this.authorInput = this.element.querySelector('.quote-form__author-input');
        this.saveButton = this.element.querySelector('.quote-form__save-btn');
        this.previewContainer = this.element.querySelector('.quote-form__preview');
        
        // Добавляем в контейнер
        if (this.options.container) {
            this.options.container.appendChild(this.element);
        }
    }

    /**
     * Рендер формы
     */
    renderForm() {
        const characterCount = this.formData.text.length;
        const isOverLimit = characterCount > this.options.maxLength;
        
        return `
            <div class="quote-form__container">
                <!-- Заголовок формы -->
                <div class="quote-form__header">
                    <h3 class="quote-form__title">
                        ${this.options.initialData ? '✏️ Редактировать цитату' : '✍️ Добавить новую цитату'}
                    </h3>
                    <p class="quote-form__subtitle">
                        ${this.options.initialData ? 'Внесите изменения в цитату' : 'Поделитесь мудростью, которая вас вдохновила'}
                    </p>
                </div>

                <!-- Основная форма -->
                <div class="quote-form__main">
                    <!-- Поле для текста цитаты -->
                    <div class="quote-form__field">
                        <label class="quote-form__label" for="quote-text">
                            <span class="quote-form__label-icon">💭</span>
                            <span class="quote-form__label-text">Текст цитаты</span>
                            <span class="quote-form__label-required">*</span>
                        </label>
                        
                        <div class="quote-form__textarea-container">
                            <textarea 
                                id="quote-text"
                                class="quote-form__textarea ${isOverLimit ? 'quote-form__textarea--error' : ''}"
                                placeholder="Введите цитату, которая вас вдохновила..."
                                rows="4"
                                maxlength="${this.options.maxLength * 1.1}"
                            >${this.escapeHtml(this.formData.text)}</textarea>
                            
                            <div class="quote-form__character-count ${isOverLimit ? 'quote-form__character-count--error' : ''}">
                                <span class="quote-form__character-current">${characterCount}</span>
                                <span class="quote-form__character-separator">/</span>
                                <span class="quote-form__character-max">${this.options.maxLength}</span>
                            </div>
                        </div>
                        
                        ${this.validation.errors.text ? `
                            <div class="quote-form__field-error">
                                <span class="quote-form__error-icon">⚠️</span>
                                <span class="quote-form__error-text">${this.validation.errors.text}</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Поле для автора -->
                    <div class="quote-form__field">
                        <label class="quote-form__label" for="quote-author">
                            <span class="quote-form__label-icon">✍️</span>
                            <span class="quote-form__label-text">Автор</span>
                        </label>
                        
                        <div class="quote-form__author-container">
                            <input 
                                id="quote-author"
                                type="text"
                                class="quote-form__author-input"
                                placeholder="Кто автор этих слов?"
                                value="${this.escapeHtml(this.formData.author)}"
                                autocomplete="off"
                            />
                            
                            <!-- Популярные авторы -->
                            ${this.options.showPopularAuthors && this.popularAuthors.length > 0 ? `
                                <div class="quote-form__popular-authors">
                                    <div class="quote-form__popular-title">Популярные авторы:</div>
                                    <div class="quote-form__popular-list">
                                        ${this.popularAuthors.slice(0, 6).map(author => `
                                            <button type="button" class="quote-form__popular-author" data-author="${this.escapeHtml(author)}">
                                                ${this.escapeHtml(author)}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${this.validation.errors.author ? `
                            <div class="quote-form__field-error">
                                <span class="quote-form__error-icon">⚠️</span>
                                <span class="quote-form__error-text">${this.validation.errors.author}</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Источник цитаты -->
                    <div class="quote-form__field">
                        <label class="quote-form__label">
                            <span class="quote-form__label-icon">📚</span>
                            <span class="quote-form__label-text">Источник</span>
                        </label>
                        
                        <div class="quote-form__source-options">
                            <label class="quote-form__radio-option">
                                <input 
                                    type="radio" 
                                    name="source" 
                                    value="book" 
                                    class="quote-form__radio"
                                    ${this.formData.source === 'book' ? 'checked' : ''}
                                />
                                <span class="quote-form__radio-label">
                                    <span class="quote-form__radio-icon">📖</span>
                                    <span class="quote-form__radio-text">Из книги</span>
                                </span>
                            </label>
                            
                            <label class="quote-form__radio-option">
                                <input 
                                    type="radio" 
                                    name="source" 
                                    value="manual" 
                                    class="quote-form__radio"
                                    ${this.formData.source === 'manual' ? 'checked' : ''}
                                />
                                <span class="quote-form__radio-label">
                                    <span class="quote-form__radio-icon">💭</span>
                                    <span class="quote-form__radio-text">Собственная мысль</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <!-- AI-анализ -->
                    ${this.options.enableAiAnalysis ? this.renderAiAnalysis() : ''}
                </div>

                <!-- Предпросмотр -->
                ${this.options.showPreview ? this.renderPreview() : ''}

                <!-- Действия формы -->
                <div class="quote-form__actions">
                    <button 
                        type="button" 
                        class="quote-form__save-btn ${!this.validation.isValid ? 'quote-form__save-btn--disabled' : ''}"
                        ${!this.validation.isValid ? 'disabled' : ''}
                    >
                        <span class="quote-form__save-icon">💾</span>
                        <span class="quote-form__save-text">
                            ${this.options.initialData ? 'Сохранить изменения' : 'Добавить в дневник'}
                        </span>
                    </button>
                    
                    ${this.options.onCancel ? `
                        <button type="button" class="quote-form__cancel-btn">
                            <span class="quote-form__cancel-icon">❌</span>
                            <span class="quote-form__cancel-text">Отмена</span>
                        </button>
                    ` : ''}
                </div>

                <!-- Информация о черновиках -->
                ${this.options.autoSaveDrafts ? `
                    <div class="quote-form__draft-info">
                        <span class="quote-form__draft-icon">💾</span>
                        <span class="quote-form__draft-text">Черновик сохраняется автоматически</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Рендер AI-анализа
     */
    renderAiAnalysis() {
        if (!this.formData.text.trim() || this.formData.text.length < 10) {
            return `
                <div class="quote-form__ai-section">
                    <div class="quote-form__ai-placeholder">
                        <span class="quote-form__ai-placeholder-icon">✨</span>
                        <span class="quote-form__ai-placeholder-text">
                            Введите цитату, и Анна проанализирует её смысл
                        </span>
                    </div>
                </div>
            `;
        }

        if (this.isAnalyzing) {
            return `
                <div class="quote-form__ai-section quote-form__ai-section--loading">
                    <div class="quote-form__ai-header">
                        <span class="quote-form__ai-icon">✨</span>
                        <span class="quote-form__ai-title">Анализ от Анны</span>
                        <span class="quote-form__ai-loading">⏳</span>
                    </div>
                    <div class="quote-form__ai-content">
                        <div class="quote-form__ai-loading-text">
                            Анализирую смысл и подтекст цитаты...
                        </div>
                    </div>
                </div>
            `;
        }

        if (this.aiAnalysis) {
            return `
                <div class="quote-form__ai-section quote-form__ai-section--ready">
                    <div class="quote-form__ai-header">
                        <span class="quote-form__ai-icon">✨</span>
                        <span class="quote-form__ai-title">Анализ от Анны</span>
                        <span class="quote-form__ai-category" style="--category-color: ${this.getCategoryColor(this.aiAnalysis.category)}">
                            ${this.getCategoryName(this.aiAnalysis.category)}
                        </span>
                    </div>
                    <div class="quote-form__ai-content">
                        <div class="quote-form__ai-insight">
                            ${this.escapeHtml(this.aiAnalysis.insights || this.aiAnalysis.insight || 'Анализ недоступен')}
                        </div>
                        ${this.aiAnalysis.recommendations ? `
                            <div class="quote-form__ai-recommendations">
                                <div class="quote-form__ai-rec-title">💡 Рекомендации:</div>
                                <div class="quote-form__ai-rec-text">
                                    ${this.escapeHtml(this.aiAnalysis.recommendations)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        return '';
    }

    /**
     * Рендер предпросмотра
     */
    renderPreview() {
        if (!this.formData.text.trim()) {
            return `
                <div class="quote-form__preview">
                    <div class="quote-form__preview-header">
                        <span class="quote-form__preview-icon">👁️</span>
                        <span class="quote-form__preview-title">Предпросмотр</span>
                    </div>
                    <div class="quote-form__preview-placeholder">
                        Введите текст цитаты, чтобы увидеть, как она будет выглядеть
                    </div>
                </div>
            `;
        }

        return `
            <div class="quote-form__preview">
                <div class="quote-form__preview-header">
                    <span class="quote-form__preview-icon">👁️</span>
                    <span class="quote-form__preview-title">Предпросмотр</span>
                </div>
                <div class="quote-form__preview-content" id="quote-preview-container">
                    <!-- QuoteCard будет вставлена здесь через JavaScript -->
                </div>
            </div>
        `;
    }

    /**
     * Настройка обработчиков событий
     */
    attachEventListeners() {
        if (!this.element) return;

        // Ввод текста цитаты
        if (this.textArea) {
            this.textArea.addEventListener('input', this.handleTextInput.bind(this));
            this.textArea.addEventListener('blur', this.handleTextBlur.bind(this));
            this.textArea.addEventListener('keydown', this.handleKeyDown.bind(this));
        }

        // Ввод автора
        if (this.authorInput) {
            this.authorInput.addEventListener('input', this.handleAuthorInput.bind(this));
            this.authorInput.addEventListener('blur', this.handleAuthorBlur.bind(this));
        }

        // Клики по популярным авторам
        this.element.addEventListener('click', (e) => {
            const authorBtn = e.target.closest('.quote-form__popular-author');
            if (authorBtn) {
                this.selectPopularAuthor(authorBtn.dataset.author);
            }
        });

        // Изменение источника
        this.element.addEventListener('change', (e) => {
            if (e.target.name === 'source') {
                this.formData.source = e.target.value;
                this.autoSaveDraft();
                this.updatePreview();
            }
        });

        // Сохранение формы
        if (this.saveButton) {
            this.saveButton.addEventListener('click', this.handleSave.bind(this));
        }

        // Отмена
        const cancelButton = this.element.querySelector('.quote-form__cancel-btn');
        if (cancelButton) {
            cancelButton.addEventListener('click', this.handleCancel.bind(this));
        }

        // Автоматическое изменение размера textarea
        this.setupAutoResize();

        // Обработка вставки из буфера обмена
        if (this.textArea) {
            this.textArea.addEventListener('paste', this.handlePaste.bind(this));
        }
    }

    /**
     * Обработка ввода текста
     */
    handleTextInput(e) {
        this.formData.text = e.target.value;
        this.validation.touched.text = true;
        
        this.updateCharacterCount();
        this.validateForm();
        this.autoSaveDraft();
        this.scheduleAiAnalysis();
        this.updatePreview();
        
        // Haptic feedback при вводе
        this.triggerHapticFeedback('light');
    }

    /**
     * Обработка потери фокуса с текста
     */
    handleTextBlur() {
        this.validation.touched.text = true;
        this.validateForm();
    }

    /**
     * Обработка ввода автора
     */
    handleAuthorInput(e) {
        this.formData.author = e.target.value;
        this.validation.touched.author = true;
        
        this.validateForm();
        this.autoSaveDraft();
        this.updatePreview();
    }

    /**
     * Обработка потери фокуса с автора
     */
    handleAuthorBlur() {
        this.validation.touched.author = true;
        this.validateForm();
    }

    /**
     * Обработка нажатий клавиш
     */
    handleKeyDown(e) {
        // Ctrl/Cmd + Enter для сохранения
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (this.validation.isValid) {
                this.handleSave();
            }
        }
        
        // Escape для отмены
        if (e.key === 'Escape' && this.options.onCancel) {
            e.preventDefault();
            this.handleCancel();
        }
    }

    /**
     * Обработка вставки из буфера обмена
     */
    handlePaste(_e) {
        // Даем браузеру обработать вставку, затем анализируем
        setTimeout(() => {
            this.formData.text = this.textArea.value;
            this.updateCharacterCount();
            this.validateForm();
            this.scheduleAiAnalysis();
            this.updatePreview();
        }, 10);
    }

    /**
     * Выбор популярного автора
     */
    selectPopularAuthor(author) {
        if (this.authorInput) {
            this.authorInput.value = author;
            this.formData.author = author;
            this.validation.touched.author = true;
            
            this.validateForm();
            this.autoSaveDraft();
            this.updatePreview();
            
            // Haptic feedback
            this.triggerHapticFeedback('light');
            
            // Возвращаем фокус на textarea
            if (this.textArea) {
                this.textArea.focus();
            }
        }
    }

    /**
     * Обновление счетчика символов
     */
    updateCharacterCount() {
        const counter = this.element.querySelector('.quote-form__character-current');
        const container = this.element.querySelector('.quote-form__character-count');
        const textarea = this.element.querySelector('.quote-form__textarea');
        
        if (counter) {
            counter.textContent = this.formData.text.length;
        }
        
        const isOverLimit = this.formData.text.length > this.options.maxLength;
        
        if (container) {
            container.classList.toggle('quote-form__character-count--error', isOverLimit);
        }
        
        if (textarea) {
            textarea.classList.toggle('quote-form__textarea--error', isOverLimit);
        }
    }

    /**
     * Планирование AI-анализа
     */
    scheduleAiAnalysis() {
        if (!this.options.enableAiAnalysis) return;
        
        // Очищаем предыдущий таймер
        if (this.aiAnalysisTimeout) {
            clearTimeout(this.aiAnalysisTimeout);
        }
        
        // Анализируем только если есть достаточно текста
        if (this.formData.text.trim().length < 10) {
            this.aiAnalysis = null;
            this.updateAiSection();
            return;
        }
        
        // Планируем анализ через 1 секунду после окончания ввода
        this.aiAnalysisTimeout = setTimeout(() => {
            this.performAiAnalysis();
        }, 1000);
    }

    /**
     * Выполнение AI-анализа
     */
    async performAiAnalysis() {
        if (!this.api || this.isAnalyzing) return;

        try {
            this.isAnalyzing = true;
            this.updateAiSection();

            // Проверяем кэш
            if (this.storage) {
                const cached = this.storage.getCachedApiResponse(
                    '/quotes/analyze', 
                    'POST', 
                    { text: this.formData.text }
                );
                
                if (cached) {
                    this.aiAnalysis = cached.response;
                    this.isAnalyzing = false;
                    this.updateAiSection();
                    this.updatePreview();
                    return;
                }
            }

            // Выполняем анализ
            const result = await this.api.analyzeQuote(this.formData.text, this.formData.author);

            // Extract analysis from result.data.analysis with fallbacks
            let analysis;
            if (result && result.data && result.data.analysis) {
                analysis = result.data.analysis;
            } else if (result && result.analysis) {
                analysis = result.analysis;
            } else if (result) {
                analysis = result;
            } else {
                throw new Error('No analysis data in response');
            }

            // Normalize analysis to ensure consistent structure
            this.aiAnalysis = {
                category: typeof analysis.category === 'string' ? analysis.category : 'wisdom',
                themes: Array.isArray(analysis.themes) ? analysis.themes.slice(0, 3) : ['размышления'],
                sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment) ? analysis.sentiment : 'neutral',
                insights: analysis.insights || analysis.insight || 'Интересная мысль для размышления'
            };

            // Сохраняем в кэш
            if (this.storage) {
                this.storage.cacheApiResponse(
                    '/quotes/analyze', 
                    'POST', 
                    { text: this.formData.text }, 
                    analysis,
                    '10m'
                );
            }

        } catch (error) {
            console.error('Ошибка AI-анализа:', error);
            this.aiAnalysis = {
                category: 'wisdom',
                themes: ['размышления'],
                sentiment: 'neutral',
                insights: 'Не удалось проанализировать цитату. Попробуйте позже.',
                error: true
            };
        } finally {
            this.isAnalyzing = false;
            this.updateAiSection();
            this.updatePreview();
        }
    }

    /**
     * Обновление секции AI-анализа
     */
    updateAiSection() {
        console.log('LOG: QuoteForm.updateAiSection - обновляем секцию анализа, текущий aiAnalysis:', this.aiAnalysis);
        
        const aiSection = this.element.querySelector('.quote-form__ai-section');
        if (aiSection) {
            const newHtml = this.renderAiAnalysis();
            console.log('LOG: QuoteForm.updateAiSection - новый HTML для секции анализа создан');
            aiSection.outerHTML = newHtml;
            console.log('LOG: QuoteForm.updateAiSection - секция анализа обновлена');
        } else {
            console.warn('LOG: QuoteForm.updateAiSection - .quote-form__ai-section не найдена');
        }
    }

    /**
     * Обновление предпросмотра
     */
    updatePreview() {
        if (!this.options.showPreview) return;

        const previewContent = this.element.querySelector('.quote-form__preview-content');
        if (!previewContent) return;

        if (!this.formData.text.trim()) {
            const preview = this.element.querySelector('.quote-form__preview');
            if (preview) {
                preview.outerHTML = this.renderPreview();
            }
            return;
        }

        // Создаем предпросмотр цитаты
        const previewQuote = {
            id: 'preview',
            text: this.formData.text,
            author: this.formData.author || 'Неизвестный автор',
            createdAt: new Date(),
            isFavorite: false,
            source: this.formData.source,
            aiAnalysis: this.aiAnalysis
        };

        // Очищаем контейнер
        previewContent.innerHTML = '';

        // Создаем QuoteCard для предпросмотра
        if (window.QuoteCard) {
            const previewCard = new window.QuoteCard(previewQuote, {
                showActions: false,
                allowSwipe: false,
                compact: true
            });
            
            previewContent.appendChild(previewCard.getElement());
        }
    }

    /**
     * Валидация формы
     */
    validateForm() {
        this.validation.errors = {};

        // Валидация текста цитаты
        if (!this.formData.text.trim()) {
            if (this.validation.touched.text) {
                this.validation.errors.text = 'Введите текст цитаты';
            }
        } else if (this.formData.text.length < 5) {
            this.validation.errors.text = 'Цитата слишком короткая (минимум 5 символов)';
        } else if (this.formData.text.length > this.options.maxLength) {
            this.validation.errors.text = `Цитата слишком длинная (максимум ${this.options.maxLength} символов)`;
        }

        // Валидация автора (опционально)
        if (this.formData.author && this.formData.author.length > 100) {
            this.validation.errors.author = 'Имя автора слишком длинное (максимум 100 символов)';
        }

        // Общая валидность
        this.validation.isValid = Object.keys(this.validation.errors).length === 0 && 
                                  this.formData.text.trim().length >= 5;

        this.updateValidationUI();
    }

    /**
     * Обновление UI валидации
     */
    updateValidationUI() {
        // Обновляем состояние кнопки сохранения
        if (this.saveButton) {
            this.saveButton.disabled = !this.validation.isValid;
            this.saveButton.classList.toggle('quote-form__save-btn--disabled', !this.validation.isValid);
        }

        // Показываем/скрываем ошибки
        Object.keys(this.validation.errors).forEach(_field => {
            const errorElement = this.element.querySelector(`.quote-form__field-error`);
            if (errorElement) {
                // Перерендериваем поле с ошибкой
                const fieldElement = this.element.querySelector(`.quote-form__field`);
                if (fieldElement) {
                    // Здесь можно добавить обновление конкретного поля
                }
            }
        });
    }

    /**
     * Автосохранение черновика
     */
    autoSaveDraft() {
        if (!this.options.autoSaveDrafts || !this.storage) return;

        // Очищаем предыдущий таймер
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Сохраняем через 2 секунды после окончания ввода
        this.autoSaveTimeout = setTimeout(() => {
            if (this.formData.text.trim() || this.formData.author.trim()) {
                const draft = {
                    ...this.formData,
                    timestamp: Date.now(),
                    aiAnalysis: this.aiAnalysis
                };

                this.storage.setLocal(this.draftKey, draft, '7d');
            }
        }, 2000);
    }

    /**
     * Загрузка черновика
     */
    loadDraft() {
        if (!this.options.autoSaveDrafts || !this.storage) return;

        const draft = this.storage.getLocal(this.draftKey);
        if (draft && !this.options.initialData) {
            // Спрашиваем пользователя о восстановлении черновика
            const shouldRestore = confirm(
                'Найден сохраненный черновик. Восстановить его?'
            );

            if (shouldRestore) {
                this.formData = { ...this.formData, ...draft };
                this.aiAnalysis = draft.aiAnalysis;
                
                // Обновляем UI
                if (this.textArea) this.textArea.value = this.formData.text;
                if (this.authorInput) this.authorInput.value = this.formData.author;
                
                // Обновляем источник
                const sourceRadio = this.element.querySelector(`input[name="source"][value="${this.formData.source}"]`);
                if (sourceRadio) sourceRadio.checked = true;
                
                this.updateCharacterCount();
                this.validateForm();
                this.updateAiSection();
                this.updatePreview();
            }
        }
    }

    /**
     * Очистка черновика
     */
    clearDraft() {
        if (this.storage) {
            this.storage.removeLocal(this.draftKey);
        }
    }

    /**
     * Настройка автоматического изменения размера textarea
     */
    setupAutoResize() {
        if (!this.textArea) return;

        const autoResize = () => {
            this.textArea.style.height = 'auto';
            this.textArea.style.height = this.textArea.scrollHeight + 'px';
        };

        this.textArea.addEventListener('input', autoResize);
        
        // Начальная настройка размера
        setTimeout(autoResize, 100);
    }

    /**
     * Обработка сохранения
     */
    async handleSave() {
        console.log('LOG: QuoteForm.handleSave вызван');
        
        // Проверяем валидность формы
        if (!this.validation.isValid) {
            console.log('LOG: QuoteForm.handleSave - форма невалидна');
            return;
        }

        // Предотвращаем множественные сохранения - проверяем состояние кнопки
        if (this.saveButton && this.saveButton.disabled) {
            console.log('LOG: QuoteForm.handleSave - сохранение уже в процессе, игнорируем');
            return;
        }

        try {
            console.log('LOG: QuoteForm.handleSave - начинаем сохранение');
            this.updateLoadingState(true);

            const quoteData = {
                text: this.formData.text.trim(),
                author: this.formData.author.trim() || 'Неизвестный автор',
                source: this.formData.source || 'manual'
            };
            console.log('LOG: QuoteForm.handleSave - данные для сохранения:', quoteData);
            
            let savedQuote;
            
            if (this.options.initialData) {
                // Редактирование существующей цитаты
                savedQuote = await this.api.updateQuote(this.options.initialData.id, quoteData);
                console.log('LOG: QuoteForm - цитата обновлена:', savedQuote);
            } else {
                // Создание новой цитаты
                savedQuote = await this.api.addQuote(quoteData);
                console.log('LOG: QuoteForm - цитата создана, ответ сервера:', savedQuote);
            }

            // Извлекаем данные из ответа сервера
            const quoteDataFromServer = savedQuote?.data || savedQuote;
            console.log('LOG: QuoteForm - извлеченные данные цитаты:', quoteDataFromServer);

            // Обновляем локальный aiAnalysis из ответа сервера
            if (quoteDataFromServer && !this.options.initialData) {
                const serverAnalysis = {
                    category: quoteDataFromServer.category,
                    themes: quoteDataFromServer.themes,
                    sentiment: quoteDataFromServer.sentiment,
                    insights: quoteDataFromServer.insights,
                    summary: quoteDataFromServer.aiAnalysis?.summary || ''
                };
                
                console.log('LOG: QuoteForm - обновляем AI анализ из ответа сервера:', serverAnalysis);
                this.aiAnalysis = serverAnalysis;
                
                // Обновляем секцию анализа и предпросмотр
                this.updateAiSection();
                this.updatePreview();
            }

            // Обновляем состояние приложения
            if (this.state) {
                const quoteForState = {
                    ...quoteDataFromServer,
                    id: quoteDataFromServer.id || quoteDataFromServer._id,
                    aiAnalysis: this.aiAnalysis || quoteDataFromServer.aiAnalysis
                };

                if (this.options.initialData) {
                    this.state.updateQuoteInList(quoteForState.id, quoteForState);
                    console.log('LOG: QuoteForm - обновлена цитата в состоянии:', quoteForState.id);
                    
                    // Dispatch edit event
                    document.dispatchEvent(new CustomEvent('quotes:changed', { 
                        detail: { type: 'edited', id: quoteForState.id, quote: quoteForState } 
                    }));
                } else {
                    this.state.addQuote(quoteForState);
                    console.log('LOG: QuoteForm - добавлена цитата в состояние:', quoteForState.id);
                    
                    // Dispatch add event
                    document.dispatchEvent(new CustomEvent('quotes:changed', { 
                        detail: { type: 'added', id: quoteForState.id, quote: quoteForState } 
                    }));
                }
            }

            // Invalidate StatisticsService cache after successful save
            if (window.statisticsService) {
                try {
                    const userId = window.readerApp?.state?.getCurrentUserId?.();
                    if (userId) {
                        window.statisticsService.invalidateForUser(userId);
                        console.log('LOG: QuoteForm - инвалидирован кэш статистики для пользователя:', userId);
                    } else {
                        // Fallback to old method if userId not available
                        window.statisticsService.invalidate(['mainStats','latestQuotes_3','userProgress']);
                        console.log('LOG: QuoteForm - инвалидирован кэш статистики (fallback)');
                    }
                } catch (_e) {
                    console.debug('StatisticsService invalidation failed:', _e);
                }
            }

            // Очищаем черновик
            this.clearDraft();

            // Haptic feedback
            this.triggerHapticFeedback('success');

            // Вызываем callback
            if (this.options.onSave) {
                console.log('LOG: QuoteForm - вызываем callback onSave');
                this.options.onSave(quoteDataFromServer);
            }

            // Показываем успешное сообщение
            this.showSuccess(
                this.options.initialData ? 
                'Цитата успешно обновлена!' : 
                'Цитата добавлена в ваш дневник!'
            );
            
            console.log('LOG: QuoteForm.handleSave - сохранение завершено успешно');

        } catch (error) {
            console.error('LOG: QuoteForm.handleSave - ошибка при сохранении цитаты:', error);
            
            // Проверяем, была ли цитата на самом деле создана (код 201 или success: true)
            if (error.status === 201 || (error.data && error.data.success)) {
                console.log('LOG: QuoteForm.handleSave - цитата создана несмотря на ошибку, считаем успехом');
                this.showSuccess('Цитата добавлена в ваш дневник!');
            } else {
                this.showError('Не удалось сохранить цитату. Попробуйте еще раз.');
                this.triggerHapticFeedback('error');
            }
        } finally {
            console.log('LOG: QuoteForm.handleSave - обновляем состояние кнопки');
            this.updateLoadingState(false);
        }
    }

    /**
     * Обработка отмены
     */
    handleCancel() {
        // Проверяем, есть ли несохраненные изменения
        const hasChanges = this.formData.text.trim() || this.formData.author.trim();
        
        if (hasChanges) {
            const shouldDiscard = confirm(
                'У вас есть несохраненные изменения. Отменить редактирование?'
            );
            
            if (!shouldDiscard) return;
        }

        // Вызываем callback
        if (this.options.onCancel) {
            this.options.onCancel();
        }
    }

    /**
     * Обновление состояния загрузки
     */
    updateLoadingState(isLoading) {
        console.log('LOG: QuoteForm.updateLoadingState - isLoading:', isLoading);
        
        if (!this.saveButton) {
            console.warn('LOG: QuoteForm.updateLoadingState - saveButton не найдена');
            return;
        }

        const icon = this.saveButton.querySelector('.quote-form__save-icon');
        const text = this.saveButton.querySelector('.quote-form__save-text');
        
        if (isLoading) {
            console.log('LOG: QuoteForm.updateLoadingState - устанавливаем состояние загрузки');
            this.saveButton.disabled = true;
            this.saveButton.classList.add('quote-form__save-btn--loading');
            
            if (icon) icon.textContent = '⏳';
            if (text) text.textContent = 'Сохранение...';
            
            // Добавляем атрибут для предотвращения повторных кликов
            this.saveButton.setAttribute('data-saving', 'true');
        } else {
            console.log('LOG: QuoteForm.updateLoadingState - убираем состояние загрузки');
            
            // Убираем атрибут состояния сохранения
            this.saveButton.removeAttribute('data-saving');
            
            // Восстанавливаем состояние кнопки на основе валидности формы
            this.saveButton.disabled = !this.validation.isValid;
            this.saveButton.classList.remove('quote-form__save-btn--loading');
            
            if (icon) icon.textContent = '💾';
            if (text) {
                text.textContent = this.options.initialData ? 
                    'Сохранить изменения' : 
                    'Добавить в дневник';
            }
            
            console.log('LOG: QuoteForm.updateLoadingState - кнопка disabled:', this.saveButton.disabled, 'validation.isValid:', this.validation.isValid);
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Получение цвета категории AI-анализа
     */
    getCategoryColor(category) {
        const colors = {
            wisdom: '#D2452C',
            love: '#E85A42',
            growth: '#B53A23',
            philosophy: '#A0341F',
            inspiration: '#F16B52',
            reflection: '#C73E29'
        };
        
        return colors[category] || colors.wisdom;
    }

    /**
     * Получение названия категории
     */
    getCategoryName(category) {
        const names = {
            wisdom: 'Мудрость',
            love: 'Любовь',
            growth: 'Рост',
            philosophy: 'Философия',
            inspiration: 'Вдохновение',
            reflection: 'Размышления'
        };
        
        return names[category] || names.wisdom;
    }

    /**
     * Экранирование HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Haptic feedback для Telegram
     */
    triggerHapticFeedback(type = 'light') {
        if (this.telegram?.HapticFeedback) {
            switch (type) {
                case 'light':
                    this.telegram.HapticFeedback.impactOccurred('light');
                    break;
                case 'success':
                    this.telegram.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    this.telegram.HapticFeedback.notificationOccurred('error');
                    break;
            }
        }
    }

    /**
     * Показать уведомление об ошибке
     */
    showError(message) {
        // TODO: Интеграция с системой уведомлений
        console.error(message);
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(message);
        }
    }

    /**
     * Показать уведомление об успехе
     */
    showSuccess(message) {
        // TODO: Интеграция с системой уведомлений
        console.log(message);
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(message);
        }
    }

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Получить DOM элемент
     */
    getElement() {
        return this.element;
    }

    /**
     * Очистить форму
     */
    clearForm() {
        this.formData = {
            text: '',
            author: '',
            source: 'manual',
            category: null
        };

        this.aiAnalysis = null;
        this.validation.touched = {};
        
        if (this.textArea) this.textArea.value = '';
        if (this.authorInput) this.authorInput.value = '';
        
        this.validateForm();
        this.updateAiSection();
        this.updatePreview();
        this.clearDraft();
    }

    /**
     * Установить фокус на форму
     */
    focus() {
        if (this.textArea) {
            this.textArea.focus();
        }
    }

    /**
     * Получить данные формы
     */
    getFormData() {
        return {
            ...this.formData,
            aiAnalysis: this.aiAnalysis
        };
    }

    /**
     * Установить данные формы
     */
    setFormData(data) {
        this.formData = { ...this.formData, ...data };
        
        if (this.textArea) this.textArea.value = this.formData.text;
        if (this.authorInput) this.authorInput.value = this.formData.author;
        
        const sourceRadio = this.element.querySelector(`input[name="source"][value="${this.formData.source}"]`);
        if (sourceRadio) sourceRadio.checked = true;
        
        this.updateCharacterCount();
        this.validateForm();
        this.scheduleAiAnalysis();
        this.updatePreview();
    }

    /**
     * Проверить наличие изменений
     */
    hasChanges() {
        return this.formData.text.trim() || this.formData.author.trim();
    }

    /**
     * Уничтожить компонент
     */
    destroy() {
        // Очищаем таймеры
        if (this.aiAnalysisTimeout) {
            clearTimeout(this.aiAnalysisTimeout);
        }
        
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Удаляем элемент
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        this.element = null;
        this.textArea = null;
        this.authorInput = null;
        this.saveButton = null;
        this.previewContainer = null;
    }
}

// ========================================
// CSS STYLES (будут в отдельном файле)
// ========================================

/**
 * Добавляем стили компонента в head
 * В продакшене это будет отдельный CSS файл
 */
if (typeof document !== 'undefined' && !document.getElementById('quote-form-styles')) {
    const styles = document.createElement('style');
    styles.id = 'quote-form-styles';
    styles.textContent = `
        .quote-form {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
        }

        .quote-form__container {
            background: var(--surface, #FFFFFF);
            border-radius: var(--border-radius, 12px);
            border: 1px solid var(--border, #E6E0D6);
            box-shadow: 0 4px 16px var(--shadow-color, rgba(210, 69, 44, 0.08));
            overflow: hidden;
        }

        .quote-form__header {
            background: linear-gradient(135deg, var(--primary-color, #D2452C), var(--primary-dark, #B53A23));
            color: white;
            padding: 20px;
            text-align: center;
        }

        .quote-form__title {
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: 600;
        }

        .quote-form__subtitle {
            margin: 0;
            font-size: 14px;
            opacity: 0.9;
            line-height: 1.4;
        }

        .quote-form__main {
            padding: 20px;
        }

        .quote-form__field {
            margin-bottom: 20px;
        }

        .quote-form__label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary, #2D2D2D);
        }

        .quote-form__label-icon {
            font-size: 16px;
        }

        .quote-form__label-required {
            color: var(--primary-color, #D2452C);
        }

        .quote-form__textarea-container {
            position: relative;
        }

        .quote-form__textarea {
            width: 100%;
            border: 2px solid var(--border, #E6E0D6);
            border-radius: var(--border-radius-small, 8px);
            padding: 12px;
            font-family: Georgia, 'Times New Roman', serif;
            font-style: italic;
            font-size: 15px;
            line-height: 1.5;
            background: var(--surface-warm, #FEFCF8);
            color: var(--text-primary, #2D2D2D);
            resize: none;
            transition: all 0.3s ease;
        }

        .quote-form__textarea:focus {
            outline: none;
            border-color: var(--primary-color, #D2452C);
            box-shadow: 0 0 0 3px rgba(210, 69, 44, 0.15);
        }

        .quote-form__textarea--error {
            border-color: var(--error, #dc3545);
        }

        .quote-form__character-count {
            position: absolute;
            bottom: 8px;
            right: 12px;
            font-size: 11px;
            color: var(--text-secondary, #666666);
            background: var(--surface, #FFFFFF);
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid var(--border-light, #F0EBE3);
        }

        .quote-form__character-count--error {
            color: var(--error, #dc3545);
            border-color: var(--error, #dc3545);
        }

        .quote-form__character-current {
            font-weight: 600;
        }

        .quote-form__author-container {
            position: relative;
        }

        .quote-form__author-input {
            width: 100%;
            border: 2px solid var(--border, #E6E0D6);
            border-radius: var(--border-radius-small, 8px);
            padding: 12px;
            font-size: 14px;
            font-family: inherit;
            background: var(--surface-warm, #FEFCF8);
            color: var(--text-primary, #2D2D2D);
            transition: all 0.3s ease;
        }

        .quote-form__author-input:focus {
            outline: none;
            border-color: var(--primary-color, #D2452C);
            box-shadow: 0 0 0 3px rgba(210, 69, 44, 0.15);
        }

        .quote-form__popular-authors {
            margin-top: 12px;
        }

        .quote-form__popular-title {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-secondary, #666666);
            margin-bottom: 8px;
        }

        .quote-form__popular-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .quote-form__popular-author {
            background: var(--background-light, #FAF8F3);
            border: 1px solid var(--border, #E6E0D6);
            border-radius: 16px;
            padding: 6px 12px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--text-secondary, #666666);
        }

        .quote-form__popular-author:hover {
            background: var(--primary-color, #D2452C);
            color: white;
            border-color: var(--primary-color, #D2452C);
            transform: translateY(-1px);
        }

        .quote-form__source-options {
            display: flex;
            gap: 16px;
        }

        .quote-form__radio-option {
            flex: 1;
            cursor: pointer;
        }

        .quote-form__radio {
            display: none;
        }

        .quote-form__radio-label {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px;
            border: 2px solid var(--border, #E6E0D6);
            border-radius: var(--border-radius-small, 8px);
            background: var(--surface-warm, #FEFCF8);
            transition: all 0.3s ease;
        }

        .quote-form__radio:checked + .quote-form__radio-label {
            border-color: var(--primary-color, #D2452C);
            background: rgba(210, 69, 44, 0.05);
            color: var(--primary-color, #D2452C);
        }

        .quote-form__radio-icon {
            font-size: 16px;
        }

        .quote-form__radio-text {
            font-size: 13px;
            font-weight: 500;
        }

        .quote-form__ai-section {
            background: linear-gradient(135deg, var(--primary-color, #D2452C), var(--primary-dark, #B53A23));
            color: white;
            border-radius: var(--border-radius-small, 8px);
            padding: 16px;
            margin-bottom: 16px;
        }

        .quote-form__ai-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 13px;
            font-weight: 600;
        }

        .quote-form__ai-category {
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            margin-left: auto;
        }

        .quote-form__ai-content,
        .quote-form__ai-insight {
            font-family: Georgia, 'Times New Roman', serif;
            font-style: italic;
            font-size: 13px;
            color: var(--text-primary, #2D2D2D);
            line-height: 1.5;
            opacity: 0.92;
        }
        @media (max-width: 480px) {
            .quote-form__ai-content,
            .quote-form__ai-insight {
            font-size: 12px;
            }
        }

        .quote-form__ai-recommendations {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            padding: 10px;
        }

        .quote-form__ai-rec-title {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 6px;
            opacity: 0.9;
        }

        .quote-form__ai-rec-text {
            font-size: 12px;
            opacity: 0.85;
        }

        .quote-form__ai-placeholder {
            display: flex;
            align-items: center;
            gap: 8px;
            justify-content: center;
            padding: 20px;
            background: var(--background-light, #FAF8F3);
            border: 2px dashed var(--border, #E6E0D6);
            border-radius: var(--border-radius-small, 8px);
            color: var(--text-secondary, #666666);
            font-size: 13px;
        }

        .quote-form__ai-loading-text {
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0.9;
        }

        .quote-form__preview {
            background: var(--background-light, #FAF8F3);
            border-radius: var(--border-radius-small, 8px);
            padding: 16px;
            margin-bottom: 16px;
        }

        .quote-form__preview-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary, #2D2D2D);
        }

        .quote-form__preview-placeholder {
            text-align: center;
            color: var(--text-secondary, #666666);
            font-size: 12px;
            padding: 20px;
            border: 2px dashed var(--border, #E6E0D6);
            border-radius: 6px;
        }

        .quote-form__actions {
            display: flex;
            gap: 12px;
            padding: 16px 20px;
            background: var(--background-light, #FAF8F3);
            border-top: 1px solid var(--border-light, #F0EBE3);
        }

        .quote-form__save-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: var(--primary-color, #D2452C);
            color: white;
            border: none;
            border-radius: var(--border-radius-small, 8px);
            padding: 14px 20px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(210, 69, 44, 0.3);
        }

        .quote-form__save-btn:hover:not(:disabled) {
            background: var(--primary-light, #E85A42);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(210, 69, 44, 0.4);
        }

        .quote-form__save-btn--disabled {
            background: var(--text-muted, #999999);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .quote-form__save-btn--loading {
            pointer-events: none;
            opacity: 0.8;
        }

        .quote-form__cancel-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: transparent;
            color: var(--text-secondary, #666666);
            border: 2px solid var(--border, #E6E0D6);
            border-radius: var(--border-radius-small, 8px);
            padding: 14px 20px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .quote-form__cancel-btn:hover {
            border-color: var(--primary-color, #D2452C);
            color: var(--primary-color, #D2452C);
        }

        .quote-form__draft-info {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 12px 20px;
            background: var(--background-soft, #F0EBE3);
            font-size: 11px;
            color: var(--text-secondary, #666666);
        }

        .quote-form__field-error {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 6px;
            font-size: 12px;
            color: var(--error, #dc3545);
        }

        /* Адаптивность */
        @media (max-width: 480px) {
            .quote-form__container {
                border-radius: 0;
                border-left: none;
                border-right: none;
            }

            .quote-form__header,
            .quote-form__main,
            .quote-form__actions {
                padding-left: 16px;
                padding-right: 16px;
            }

            .quote-form__source-options {
                flex-direction: column;
                gap: 8px;
            }

            .quote-form__actions {
                flex-direction: column;
            }

            .quote-form__popular-list {
                justify-content: center;
            }
        }

        /* Анимации */
        @keyframes quote-form-appear {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .quote-form {
            animation: quote-form-appear 0.3s ease;
        }

        @keyframes ai-analysis-loading {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }

        .quote-form__ai-loading {
            animation: ai-analysis-loading 1.5s infinite;
        }
    `;
    
    document.head.appendChild(styles);
}

// ========================================
// EXPORT
// ========================================

// Экспорт для модульных систем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteForm;
}

// Глобальная доступность
if (typeof window !== 'undefined') {
    window.QuoteForm = QuoteForm;
}
