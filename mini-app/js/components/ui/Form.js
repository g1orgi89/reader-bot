/**
 * 📝 ФОРМЫ С ВАЛИДАЦИЕЙ - Form.js
 * 
 * Функциональность:
 * - Различные типы полей: text, textarea, select, checkbox, radio
 * - Валидация в реальном времени
 * - Состояния ошибок и успеха
 * - Touch-friendly интерфейс  
 * - Интеграция с API
 * - Автосохранение в localStorage
 * - Поддержка файлов и изображений
 */

class Form {
    constructor(options = {}) {
        this.options = {
            fields: [],               // Конфигурация полей
            submitButton: null,       // Конфигурация кнопки отправки
            resetButton: null,        // Конфигурация кнопки сброса
            validation: 'realtime',   // realtime, submit, manual
            autoSave: false,          // Автосохранение в localStorage
            autoSaveKey: null,        // Ключ для автосохранения
            className: '',            // Дополнительные CSS классы  
            haptic: true,             // Haptic feedback
            ...options
        };
        
        this.element = null;
        this.fields = new Map();
        this.data = {};
        this.errors = {};
        this.touched = {};
        this.telegram = window.Telegram?.WebApp;
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация формы
     */
    init() {
        this.createElement();
        this.initializeFields();
        this.attachEventListeners();
        this.loadAutoSavedData();
    }
    
    /**
     * 🎨 Создание DOM элемента формы
     */
    createElement() {
        this.element = document.createElement('form');
        this.element.className = this.getClasses();
        this.element.innerHTML = this.getContent();
        
        // Предотвращение стандартной отправки формы
        this.element.setAttribute('novalidate', 'true');
    }
    
    /**
     * 🎭 Получение CSS классов
     */
    getClasses() {
        const classes = ['form'];
        
        if (this.options.className) {
            classes.push(this.options.className);
        }
        
        return classes.join(' ');
    }
    
    /**
     * 📄 Получение содержимого формы
     */
    getContent() {
        const fields = this.options.fields.map(field => this.renderField(field)).join('');
        const buttons = this.renderButtons();
        
        return `
            <div class="form__fields">
                ${fields}
            </div>
            ${buttons}
        `;
    }
    
    /**
     * 📝 Рендер поля формы
     */
    renderField(field) {
        const fieldId = `field-${field.name}`;
        const hasError = this.errors[field.name];
        const fieldClasses = [
            'form__field',
            `form__field--${field.type}`,
            hasError ? 'form__field--error' : '',
            field.required ? 'form__field--required' : ''
        ].filter(Boolean).join(' ');
        
        return `
            <div class="${fieldClasses}" data-field="${field.name}">
                ${field.label ? this.renderLabel(field, fieldId) : ''}
                ${this.renderInput(field, fieldId)}
                ${this.renderFieldHelp(field)}
                ${this.renderFieldError(field)}
            </div>
        `;
    }
    
    /**
     * 🏷️ Рендер лейбла поля
     */
    renderLabel(field, fieldId) {
        return `
            <label class="form__label" for="${fieldId}">
                ${field.label}
                ${field.required ? '<span class="form__required">*</span>' : ''}
            </label>
        `;
    }
    
    /**
     * ✍️ Рендер элемента ввода
     */
    renderInput(field, fieldId) {
        switch (field.type) {
            case 'textarea':
                return this.renderTextarea(field, fieldId);
            case 'select':
                return this.renderSelect(field, fieldId);
            case 'checkbox':
                return this.renderCheckbox(field, fieldId);
            case 'radio':
                return this.renderRadio(field, fieldId);
            case 'file':
                return this.renderFile(field, fieldId);
            case 'text':
            case 'email':
            case 'password':
            case 'number':
            case 'tel':
            case 'url':
            default:
                return this.renderTextInput(field, fieldId);
        }
    }
    
    /**
     * 📝 Рендер текстового поля
     */
    renderTextInput(field, fieldId) {
        const value = this.data[field.name] || field.defaultValue || '';
        
        return `
            <input 
                type="${field.type || 'text'}"
                id="${fieldId}"
                name="${field.name}"
                class="form__input"
                value="${this.escapeHtml(value)}"
                placeholder="${field.placeholder || ''}"
                ${field.required ? 'required' : ''}
                ${field.disabled ? 'disabled' : ''}
                ${field.readonly ? 'readonly' : ''}
                ${field.min !== undefined ? `min="${field.min}"` : ''}
                ${field.max !== undefined ? `max="${field.max}"` : ''}
                ${field.minLength !== undefined ? `minlength="${field.minLength}"` : ''}
                ${field.maxLength !== undefined ? `maxlength="${field.maxLength}"` : ''}
                ${field.pattern ? `pattern="${field.pattern}"` : ''}
                autocomplete="${field.autocomplete || 'off'}"
            >
        `;
    }
    
    /**
     * 📄 Рендер текстовой области
     */
    renderTextarea(field, fieldId) {
        const value = this.data[field.name] || field.defaultValue || '';
        
        return `
            <textarea 
                id="${fieldId}"
                name="${field.name}"
                class="form__textarea"
                placeholder="${field.placeholder || ''}"
                ${field.required ? 'required' : ''}
                ${field.disabled ? 'disabled' : ''}
                ${field.readonly ? 'readonly' : ''}
                ${field.minLength !== undefined ? `minlength="${field.minLength}"` : ''}
                ${field.maxLength !== undefined ? `maxlength="${field.maxLength}"` : ''}
                rows="${field.rows || 3}"
            >${this.escapeHtml(value)}</textarea>
            ${field.maxLength ? `
                <div class="form__char-counter">
                    <span class="form__char-current">${value.length}</span>/<span class="form__char-max">${field.maxLength}</span>
                </div>
            ` : ''}
        `;
    }
    
    /**
     * 📋 Рендер выпадающего списка
     */
    renderSelect(field, fieldId) {
        const value = this.data[field.name] || field.defaultValue || '';
        
        return `
            <select 
                id="${fieldId}"
                name="${field.name}"
                class="form__select"
                ${field.required ? 'required' : ''}
                ${field.disabled ? 'disabled' : ''}
                ${field.multiple ? 'multiple' : ''}
            >
                ${!field.required && !field.multiple ? '<option value="">Выберите...</option>' : ''}
                ${(field.options || []).map(option => `
                    <option value="${this.escapeHtml(option.value)}" 
                            ${option.value === value ? 'selected' : ''}>
                        ${this.escapeHtml(option.label)}
                    </option>
                `).join('')}
            </select>
        `;
    }
    
    /**
     * ☑️ Рендер чекбокса
     */
    renderCheckbox(field, fieldId) {
        const checked = this.data[field.name] || field.defaultValue || false;
        
        return `
            <div class="form__checkbox-wrapper">
                <input 
                    type="checkbox"
                    id="${fieldId}"
                    name="${field.name}"
                    class="form__checkbox"
                    value="${field.value || 'true'}"
                    ${checked ? 'checked' : ''}
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                >
                <label class="form__checkbox-label" for="${fieldId}">
                    <span class="form__checkbox-indicator"></span>
                    <span class="form__checkbox-text">${field.text || field.label}</span>
                </label>
            </div>
        `;
    }
    
    /**
     * 🔘 Рендер радио кнопок
     */
    renderRadio(field, fieldId) {
        const value = this.data[field.name] || field.defaultValue || '';
        
        return `
            <div class="form__radio-group">
                ${(field.options || []).map((option, index) => {
                    const optionId = `${fieldId}-${index}`;
                    return `
                        <div class="form__radio-wrapper">
                            <input 
                                type="radio"
                                id="${optionId}"
                                name="${field.name}"
                                class="form__radio"
                                value="${this.escapeHtml(option.value)}"
                                ${option.value === value ? 'checked' : ''}
                                ${field.required ? 'required' : ''}
                                ${field.disabled ? 'disabled' : ''}
                            >
                            <label class="form__radio-label" for="${optionId}">
                                <span class="form__radio-indicator"></span>
                                <span class="form__radio-text">${this.escapeHtml(option.label)}</span>
                            </label>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    /**
     * 📁 Рендер поля загрузки файлов
     */
    renderFile(field, fieldId) {
        return `
            <div class="form__file-wrapper">
                <input 
                    type="file"
                    id="${fieldId}"
                    name="${field.name}"
                    class="form__file"
                    ${field.accept ? `accept="${field.accept}"` : ''}
                    ${field.multiple ? 'multiple' : ''}
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                >
                <label class="form__file-label" for="${fieldId}">
                    <span class="form__file-icon">📁</span>
                    <span class="form__file-text">
                        ${field.multiple ? 'Выберите файлы' : 'Выберите файл'}
                    </span>
                </label>
                <div class="form__file-list" id="file-list-${field.name}"></div>
            </div>
        `;
    }
    
    /**
     * ❓ Рендер справки поля
     */
    renderFieldHelp(field) {
        if (!field.help) return '';
        
        return `
            <div class="form__help">
                ${field.help}
            </div>
        `;
    }
    
    /**
     * ⚠️ Рендер ошибки поля
     */
    renderFieldError(field) {
        const error = this.errors[field.name];
        if (!error) return '';
        
        return `
            <div class="form__error" role="alert">
                ${error}
            </div>
        `;
    }
    
    /**
     * 🔲 Рендер кнопок формы
     */
    renderButtons() {
        if (!this.options.submitButton && !this.options.resetButton) {
            return '';
        }
        
        return `
            <div class="form__buttons">
                ${this.options.resetButton ? this.renderResetButton() : ''}
                ${this.options.submitButton ? this.renderSubmitButton() : ''}
            </div>
        `;
    }
    
    /**
     * ✅ Рендер кнопки отправки
     */
    renderSubmitButton() {
        const btn = this.options.submitButton;
        return `
            <button 
                type="submit" 
                class="form__submit form__submit--${btn.variant || 'primary'}"
                ${btn.disabled ? 'disabled' : ''}
            >
                ${btn.icon ? `<span class="form__button-icon">${btn.icon}</span>` : ''}
                <span class="form__button-text">${btn.text || 'Отправить'}</span>
            </button>
        `;
    }
    
    /**
     * 🔄 Рендер кнопки сброса
     */
    renderResetButton() {
        const btn = this.options.resetButton;
        return `
            <button 
                type="button" 
                class="form__reset form__reset--${btn.variant || 'secondary'}"
                ${btn.disabled ? 'disabled' : ''}
            >
                ${btn.icon ? `<span class="form__button-icon">${btn.icon}</span>` : ''}
                <span class="form__button-text">${btn.text || 'Сбросить'}</span>
            </button>
        `;
    }
    
    /**
     * 🔧 Инициализация полей
     */
    initializeFields() {
        this.options.fields.forEach(field => {
            this.fields.set(field.name, field);
            
            // Установка значений по умолчанию
            if (field.defaultValue !== undefined) {
                this.data[field.name] = field.defaultValue;
            }
        });
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        if (!this.element) return;
        
        // Отправка формы
        this.element.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(e);
        });
        
        // Сброс формы  
        const resetButton = this.element.querySelector('.form__reset');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.handleReset());
        }
        
        // События полей
        this.attachFieldListeners();
    }
    
    /**
     * 🎯 Навешивание обработчиков полей
     */
    attachFieldListeners() {
        this.options.fields.forEach(field => {
            const element = this.element.querySelector(`[name="${field.name}"]`);
            if (!element) return;
            
            // Основные события
            element.addEventListener('input', (e) => this.handleFieldInput(e, field));
            element.addEventListener('change', (e) => this.handleFieldChange(e, field));
            element.addEventListener('blur', (e) => this.handleFieldBlur(e, field));
            element.addEventListener('focus', (e) => this.handleFieldFocus(e, field));
            
            // Специальные события для файлов
            if (field.type === 'file') {
                element.addEventListener('change', (e) => this.handleFileChange(e, field));
            }
            
            // Счетчик символов для textarea
            if (field.type === 'textarea' && field.maxLength) {
                element.addEventListener('input', (e) => this.updateCharCounter(e, field));
            }
        });
    }
    
    /**
     * ✍️ Обработчик ввода в поле
     */
    handleFieldInput(event, field) {
        const value = this.getFieldValue(event.target, field);
        this.updateFieldData(field.name, value);
        
        // Валидация в реальном времени
        if (this.options.validation === 'realtime' && this.touched[field.name]) {
            this.validateField(field.name);
        }
        
        // Автосохранение
        if (this.options.autoSave) {
            this.autoSave();
        }
    }
    
    /**
     * 🔄 Обработчик изменения поля
     */
    handleFieldChange(event, field) {
        const value = this.getFieldValue(event.target, field);
        this.updateFieldData(field.name, value);
        
        // Haptic feedback
        if (this.options.haptic) {
            this.triggerHaptic('light');
        }
        
        // Валидация
        if (this.options.validation === 'realtime') {
            this.validateField(field.name);
        }
        
        // Колбэк изменения поля
        if (field.onChange) {
            field.onChange(value, field, this);
        }
    }
    
    /**
     * 👆 Обработчик потери фокуса
     */
    handleFieldBlur(event, field) {
        this.touched[field.name] = true;
        
        // Валидация при потере фокуса
        if (this.options.validation === 'realtime') {
            this.validateField(field.name);
        }
        
        // Колбэк потери фокуса
        if (field.onBlur) {
            field.onBlur(event, field, this);
        }
    }
    
    /**
     * 🎯 Обработчик получения фокуса
     */
    handleFieldFocus(event, field) {
        // Колбэк получения фокуса
        if (field.onFocus) {
            field.onFocus(event, field, this);
        }
    }
    
    /**
     * 📁 Обработчик изменения файлов
     */
    handleFileChange(event, field) {
        const files = Array.from(event.target.files);
        this.updateFieldData(field.name, files);
        
        // Обновление списка файлов
        this.updateFileList(field.name, files);
        
        // Колбэк изменения файлов
        if (field.onFileChange) {
            field.onFileChange(files, field, this);
        }
    }
    
    /**
     * 📝 Обновление счетчика символов
     */
    updateCharCounter(event, field) {
        const counter = this.element.querySelector(`[data-field="${field.name}"] .form__char-current`);
        if (counter) {
            counter.textContent = event.target.value.length;
        }
    }
    
    /**
     * 📋 Обновление списка файлов
     */
    updateFileList(fieldName, files) {
        const listElement = this.element.querySelector(`#file-list-${fieldName}`);
        if (!listElement) return;
        
        listElement.innerHTML = files.map((file, index) => `
            <div class="form__file-item">
                <span class="form__file-name">${file.name}</span>
                <span class="form__file-size">${this.formatFileSize(file.size)}</span>
                <button type="button" class="form__file-remove" data-index="${index}">✕</button>
            </div>
        `).join('');
        
        // Обработчики удаления файлов
        listElement.querySelectorAll('.form__file-remove').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeFile(fieldName, index);
            });
        });
    }
    
    /**
     * 🗑️ Удаление файла
     */
    removeFile(fieldName, index) {
        const files = [...(this.data[fieldName] || [])];
        files.splice(index, 1);
        this.updateFieldData(fieldName, files);
        
        // Обновление input
        const input = this.element.querySelector(`[name="${fieldName}"]`);
        if (input) {
            // Создаем новый FileList (к сожалению, нельзя модифицировать существующий)
            const dt = new DataTransfer();
            files.forEach(file => dt.items.add(file));
            input.files = dt.files;
        }
        
        this.updateFileList(fieldName, files);
    }
    
    /**
     * 📊 Форматирование размера файла
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * 📝 Получение значения поля
     */
    getFieldValue(element, field) {
        switch (field.type) {
            case 'checkbox':
                return element.checked;
            case 'radio':
                const radioGroup = this.element.querySelectorAll(`[name="${field.name}"]:checked`);
                return radioGroup.length > 0 ? radioGroup[0].value : '';
            case 'select':
                if (field.multiple) {
                    return Array.from(element.selectedOptions).map(option => option.value);
                }
                return element.value;
            case 'file':
                return Array.from(element.files);
            case 'number':
                return element.value ? parseFloat(element.value) : '';
            default:
                return element.value;
        }
    }
    
    /**
     * 🔄 Обновление данных поля
     */
    updateFieldData(fieldName, value) {
        this.data[fieldName] = value;
        
        // Очистка ошибки при изменении значения
        if (this.errors[fieldName]) {
            delete this.errors[fieldName];
            this.updateFieldError(fieldName, null);
        }
    }
    
    /**
     * ✅ Валидация поля
     */
    validateField(fieldName) {
        const field = this.fields.get(fieldName);
        if (!field) return true;
        
        const value = this.data[fieldName];
        const errors = [];
        
        // Обязательное поле
        if (field.required && this.isEmpty(value)) {
            errors.push(field.requiredMessage || `Поле "${field.label}" обязательно для заполнения`);
        }
        
        // Пользовательская валидация
        if (field.validate && typeof field.validate === 'function') {
            const customError = field.validate(value, this.data, field);
            if (customError) {
                errors.push(customError);
            }
        }
        
        // Встроенная валидация
        if (value && !this.isEmpty(value)) {
            const builtInError = this.validateBuiltIn(value, field);
            if (builtInError) {
                errors.push(builtInError);
            }
        }
        
        // Обновление ошибок
        if (errors.length > 0) {
            this.errors[fieldName] = errors[0];
            this.updateFieldError(fieldName, errors[0]);
            return false;
        } else {
            delete this.errors[fieldName];
            this.updateFieldError(fieldName, null);
            return true;
        }
    }
    
    /**
     * 🔍 Встроенная валидация
     */
    validateBuiltIn(value, field) {
        switch (field.type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    return 'Введите корректный email адрес';
                }
                break;
                
            case 'url':
                try {
                    new URL(value);
                } catch {
                    return 'Введите корректный URL';
                }
                break;
                
            case 'tel':
                const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
                if (!phoneRegex.test(value)) {
                    return 'Введите корректный номер телефона';
                }
                break;
        }
        
        // Минимальная длина
        if (field.minLength && value.length < field.minLength) {
            return `Минимальная длина: ${field.minLength} символов`;
        }
        
        // Максимальная длина
        if (field.maxLength && value.length > field.maxLength) {
            return `Максимальная длина: ${field.maxLength} символов`;
        }
        
        // Минимальное значение
        if (field.min !== undefined && parseFloat(value) < field.min) {
            return `Минимальное значение: ${field.min}`;
        }
        
        // Максимальное значение
        if (field.max !== undefined && parseFloat(value) > field.max) {
            return `Максимальное значение: ${field.max}`;
        }
        
        // Паттерн
        if (field.pattern && !new RegExp(field.pattern).test(value)) {
            return field.patternMessage || 'Неверный формат данных';
        }
        
        return null;
    }
    
    /**
     * 🔄 Обновление отображения ошибки поля
     */
    updateFieldError(fieldName, error) {
        const fieldElement = this.element.querySelector(`[data-field="${fieldName}"]`);
        if (!fieldElement) return;
        
        const errorElement = fieldElement.querySelector('.form__error');
        
        if (error) {
            fieldElement.classList.add('form__field--error');
            if (errorElement) {
                errorElement.textContent = error;
            }
        } else {
            fieldElement.classList.remove('form__field--error');
            if (errorElement) {
                errorElement.textContent = '';
            }
        }
    }
    
    /**
     * 📤 Обработчик отправки формы
     */
    async handleSubmit(event) {
        event.preventDefault();
        
        // Haptic feedback
        if (this.options.haptic) {
            this.triggerHaptic('medium');
        }
        
        // Валидация всех полей
        const isValid = this.validateAll();
        if (!isValid) {
            this.focusFirstError();
            return;
        }
        
        // Колбэк отправки
        if (this.options.onSubmit) {
            try {
                const result = await this.options.onSubmit(this.data, this);
                
                // Очистка автосохранения при успешной отправке
                if (result && this.options.autoSave) {
                    this.clearAutoSave();
                }
                
                return result;
            } catch (error) {
                console.error('Form submission error:', error);
                
                // Показываем ошибку пользователю
                if (this.options.onError) {
                    this.options.onError(error, this);
                }
            }
        }
    }
    
    /**
     * 🔄 Обработчик сброса формы
     */
    handleReset() {
        // Haptic feedback
        if (this.options.haptic) {
            this.triggerHaptic('light');
        }
        
        // Сброс данных
        this.data = {};
        this.errors = {};
        this.touched = {};
        
        // Установка значений по умолчанию
        this.options.fields.forEach(field => {
            if (field.defaultValue !== undefined) {
                this.data[field.name] = field.defaultValue;
            }
        });
        
        // Обновление UI
        this.updateUI();
        
        // Очистка автосохранения
        if (this.options.autoSave) {
            this.clearAutoSave();
        }
        
        // Колбэк сброса
        if (this.options.onReset) {
            this.options.onReset(this);
        }
    }
    
    /**
     * ✅ Валидация всех полей
     */
    validateAll() {
        let isValid = true;
        
        this.options.fields.forEach(field => {
            const fieldValid = this.validateField(field.name);
            if (!fieldValid) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    /**
     * 🎯 Фокус на первое поле с ошибкой
     */
    focusFirstError() {
        const firstErrorField = this.element.querySelector('.form__field--error input, .form__field--error textarea, .form__field--error select');
        if (firstErrorField) {
            firstErrorField.focus();
            firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    /**
     * 🔄 Обновление UI
     */
    updateUI() {
        this.options.fields.forEach(field => {
            const element = this.element.querySelector(`[name="${field.name}"]`);
            if (!element) return;
            
            const value = this.data[field.name];
            
            switch (field.type) {
                case 'checkbox':
                    element.checked = Boolean(value);
                    break;
                case 'radio':
                    const radioButtons = this.element.querySelectorAll(`[name="${field.name}"]`);
                    radioButtons.forEach(radio => {
                        radio.checked = radio.value === value;
                    });
                    break;
                case 'select':
                    if (field.multiple && Array.isArray(value)) {
                        Array.from(element.options).forEach(option => {
                            option.selected = value.includes(option.value);
                        });
                    } else {
                        element.value = value || '';
                    }
                    break;
                case 'file':
                    // Файлы нужно обновлять через updateFileList
                    if (Array.isArray(value)) {
                        this.updateFileList(field.name, value);
                    }
                    break;
                default:
                    element.value = value || '';
                    break;
            }
            
            // Обновление ошибок
            this.updateFieldError(field.name, this.errors[field.name] || null);
        });
    }
    
    /**
     * 💾 Автосохранение
     */
    autoSave() {
        if (!this.options.autoSave || !this.options.autoSaveKey) return;
        
        try {
            localStorage.setItem(this.options.autoSaveKey, JSON.stringify(this.data));
        } catch (error) {
            console.warn('Auto-save failed:', error);
        }
    }
    
    /**
     * 📥 Загрузка автосохраненных данных
     */
    loadAutoSavedData() {
        if (!this.options.autoSave || !this.options.autoSaveKey) return;
        
        try {
            const savedData = localStorage.getItem(this.options.autoSaveKey);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                this.data = { ...this.data, ...parsedData };
                this.updateUI();
            }
        } catch (error) {
            console.warn('Auto-save load failed:', error);
        }
    }
    
    /**
     * 🗑️ Очистка автосохранения
     */
    clearAutoSave() {
        if (!this.options.autoSave || !this.options.autoSaveKey) return;
        
        try {
            localStorage.removeItem(this.options.autoSaveKey);
        } catch (error) {
            console.warn('Auto-save clear failed:', error);
        }
    }
    
    /**
     * 📳 Вибрация через Telegram API
     */
    triggerHaptic(type = 'light') {
        if (!this.options.haptic) return;
        
        if (this.telegram && this.telegram.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred(type);
        }
    }
    
    /**
     * 🔍 Проверка пустого значения
     */
    isEmpty(value) {
        if (value === null || value === undefined || value === '') return true;
        if (Array.isArray(value) && value.length === 0) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        return false;
    }
    
    /**
     * 🛡️ Экранирование HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 📤 Получение данных формы
     */
    getData() {
        return { ...this.data };
    }
    
    /**
     * 📥 Установка данных формы
     */
    setData(data) {
        this.data = { ...this.data, ...data };
        this.updateUI();
        
        if (this.options.autoSave) {
            this.autoSave();
        }
    }
    
    /**
     * 📝 Установка значения поля
     */
    setFieldValue(fieldName, value) {
        this.updateFieldData(fieldName, value);
        this.updateUI();
    }
    
    /**
     * 📖 Получение значения поля
     */
    getFieldValue(fieldName) {
        return this.data[fieldName];
    }
    
    /**
     * ⚠️ Установка ошибки поля
     */
    setFieldError(fieldName, error) {
        if (error) {
            this.errors[fieldName] = error;
        } else {
            delete this.errors[fieldName];
        }
        this.updateFieldError(fieldName, error);
    }
    
    /**
     * 🚫 Блокировка/разблокировка поля
     */
    setFieldDisabled(fieldName, disabled = true) {
        const element = this.element.querySelector(`[name="${fieldName}"]`);
        if (element) {
            element.disabled = disabled;
        }
    }
    
    /**
     * 🧹 Очистка ресурсов
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        this.fields.clear();
        this.data = {};
        this.errors = {};
        this.touched = {};
    }
    
    /**
     * 📤 Получение DOM элемента
     */
    getElement() {
        return this.element;
    }
    
    /**
     * 🏭 Статические методы-фабрики для быстрого создания форм
     */
    
    /**
     * Создание простой формы с текстовыми полями
     */
    static simple(fields, onSubmit, options = {}) {
        const formFields = fields.map(field => ({
            type: 'text',
            ...field
        }));
        
        return new Form({
            fields: formFields,
            submitButton: { text: 'Отправить', variant: 'primary' },
            onSubmit,
            ...options
        });
    }
    
    /**
     * Создание формы с автосохранением
     */
    static withAutoSave(fields, autoSaveKey, onSubmit, options = {}) {
        return new Form({
            fields,
            submitButton: { text: 'Сохранить', variant: 'primary' },
            autoSave: true,
            autoSaveKey,
            onSubmit,
            ...options
        });
    }
    
    /**
     * Создание формы опроса
     */
    static survey(questions, onSubmit, options = {}) {
        const fields = questions.map((question, index) => ({
            name: `question_${index}`,
            label: question.text,
            type: question.type || 'text',
            required: question.required !== false,
            options: question.options,
            ...question
        }));
        
        return new Form({
            fields,
            submitButton: { text: 'Завершить опрос', variant: 'primary' },
            onSubmit,
            ...options
        });
    }
}

// 📤 Экспорт класса
window.Form = Form;