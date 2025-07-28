/**
 * ✅ ВАЛИДАЦИЯ ФОРМ И ДАННЫХ
 * Размер: ~2 KB - функции валидации для Mini App
 * 
 * Содержит валидаторы для:
 * - Форм пользователя (профиль, настройки)
 * - Цитат и текстовых данных
 * - Email, имен и контактных данных
 * - Ограничений и лимитов приложения
 * 
 * 🔧 ИСПРАВЛЕНО: Убраны дублирующиеся константы (используются из constants.js)
 */

// 📝 БАЗОВЫЕ ВАЛИДАТОРЫ

/**
 * Проверяет обязательное поле
 * @param {string} value - Значение для проверки
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateRequired(value) {
    const isValid = value && value.toString().trim().length > 0;
    return {
        isValid,
        message: isValid ? '' : window.VALIDATION_MESSAGES?.required || 'Поле обязательно для заполнения'
    };
}

/**
 * Проверяет минимальную длину строки
 * @param {string} value - Значение для проверки
 * @param {number} minLength - Минимальная длина
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateMinLength(value, minLength) {
    const str = value ? value.toString().trim() : '';
    const isValid = str.length >= minLength;
    return {
        isValid,
        message: isValid ? '' : (window.VALIDATION_MESSAGES?.minLength?.(minLength) || `Минимум ${minLength} символов`)
    };
}

/**
 * Проверяет максимальную длину строки
 * @param {string} value - Значение для проверки
 * @param {number} maxLength - Максимальная длина
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateMaxLength(value, maxLength) {
    const str = value ? value.toString().trim() : '';
    const isValid = str.length <= maxLength;
    return {
        isValid,
        message: isValid ? '' : (window.VALIDATION_MESSAGES?.maxLength?.(maxLength) || `Максимум ${maxLength} символов`)
    };
}

/**
 * Проверяет значение по регулярному выражению
 * @param {string} value - Значение для проверки
 * @param {RegExp} pattern - Регулярное выражение
 * @param {string} message - Сообщение об ошибке
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validatePattern(value, pattern, message) {
    const str = value ? value.toString().trim() : '';
    const isValid = !str || pattern.test(str); // Пустое значение считается валидным
    return {
        isValid,
        message: isValid ? '' : message
    };
}

// 📧 ВАЛИДАТОРЫ КОНТАКТНЫХ ДАННЫХ

/**
 * Валидирует email адрес
 * @param {string} email - Email для проверки
 * @param {boolean} required - Обязательное ли поле
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateEmail(email, required = false) {
    // Проверяем обязательность
    if (required) {
        const requiredCheck = validateRequired(email);
        if (!requiredCheck.isValid) return requiredCheck;
    }
    
    // Если поле пустое и не обязательное - валидно
    if (!email || !email.trim()) {
        return { isValid: true, message: '' };
    }
    
    // Проверяем формат email
    const emailPattern = window.VALIDATION_PATTERNS?.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailMessage = window.VALIDATION_MESSAGES?.email || 'Некорректный email адрес';
    return validatePattern(email, emailPattern, emailMessage);
}

/**
 * Валидирует имя пользователя
 * @param {string} name - Имя для проверки
 * @param {boolean} required - Обязательное ли поле
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateName(name, required = true) {
    // Проверяем обязательность
    if (required) {
        const requiredCheck = validateRequired(name);
        if (!requiredCheck.isValid) return requiredCheck;
    }
    
    // Если поле пустое и не обязательное - валидно
    if (!name || !name.trim()) {
        return { isValid: true, message: '' };
    }
    
    // Проверяем длину
    const nameMaxLength = window.LIMITS?.nameMaxLength || 100;
    const lengthCheck = validateMaxLength(name, nameMaxLength);
    if (!lengthCheck.isValid) return lengthCheck;
    
    // Проверяем формат имени
    const namePattern = window.VALIDATION_PATTERNS?.name || /^[а-яёА-ЯЁa-zA-Z\s-]+$/;
    const nameMessage = window.VALIDATION_MESSAGES?.name || 'Имя может содержать только буквы, пробелы и дефисы';
    return validatePattern(name, namePattern, nameMessage);
}

/**
 * Валидирует номер телефона
 * @param {string} phone - Телефон для проверки
 * @param {boolean} required - Обязательное ли поле
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validatePhone(phone, required = false) {
    // Проверяем обязательность
    if (required) {
        const requiredCheck = validateRequired(phone);
        if (!requiredCheck.isValid) return requiredCheck;
    }
    
    // Если поле пустое и не обязательное - валидно
    if (!phone || !phone.trim()) {
        return { isValid: true, message: '' };
    }
    
    // Проверяем формат телефона
    const phonePattern = window.VALIDATION_PATTERNS?.phone || /^\+?[1-9]\d{1,14}$/;
    const phoneMessage = window.VALIDATION_MESSAGES?.phone || 'Некорректный номер телефона';
    return validatePattern(phone, phonePattern, phoneMessage);
}

// 📚 ВАЛИДАТОРЫ ДЛЯ ЦИТАТ

/**
 * Валидирует текст цитаты
 * @param {string} quoteText - Текст цитаты
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateQuoteText(quoteText) {
    // Проверяем обязательность
    const requiredCheck = validateRequired(quoteText);
    if (!requiredCheck.isValid) return requiredCheck;
    
    // Проверяем минимальную длину
    const minLengthCheck = validateMinLength(quoteText, 5);
    if (!minLengthCheck.isValid) {
        return {
            isValid: false,
            message: 'Цитата слишком короткая. Минимум 5 символов.'
        };
    }
    
    // Проверяем максимальную длину
    const quoteMaxLength = window.LIMITS?.quoteMaxLength || 1000;
    const maxLengthCheck = validateMaxLength(quoteText, quoteMaxLength);
    if (!maxLengthCheck.isValid) {
        return {
            isValid: false,
            message: window.ERROR_MESSAGES?.quoteTooLong || `Цитата слишком длинная. Максимум ${quoteMaxLength} символов.`
        };
    }
    
    return { isValid: true, message: '' };
}

/**
 * Валидирует имя автора цитаты
 * @param {string} author - Имя автора
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateQuoteAuthor(author) {
    // Автор не обязателен (может быть собственная мысль)
    if (!author || !author.trim()) {
        return { isValid: true, message: '' };
    }
    
    // Проверяем максимальную длину
    const authorMaxLength = window.LIMITS?.authorMaxLength || 100;
    const maxLengthCheck = validateMaxLength(author, authorMaxLength);
    if (!maxLengthCheck.isValid) {
        return {
            isValid: false,
            message: `Имя автора слишком длинное. Максимум ${authorMaxLength} символов.`
        };
    }
    
    return { isValid: true, message: '' };
}

/**
 * Валидирует данные цитаты полностью
 * @param {Object} quoteData - Объект с данными цитаты
 * @param {string} quoteData.text - Текст цитаты
 * @param {string} quoteData.author - Автор цитаты
 * @returns {{isValid: boolean, errors: Object}} - Результат валидации
 */
function validateQuote(quoteData) {
    const errors = {};
    let isValid = true;
    
    // Валидируем текст цитаты
    const textValidation = validateQuoteText(quoteData.text);
    if (!textValidation.isValid) {
        errors.text = textValidation.message;
        isValid = false;
    }
    
    // Валидируем автора
    const authorValidation = validateQuoteAuthor(quoteData.author);
    if (!authorValidation.isValid) {
        errors.author = authorValidation.message;
        isValid = false;
    }
    
    return { isValid, errors };
}

// 👤 ВАЛИДАТОРЫ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ

/**
 * Валидирует описание "О себе"
 * @param {string} bio - Описание пользователя
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateBio(bio) {
    // Описание не обязательно
    if (!bio || !bio.trim()) {
        return { isValid: true, message: '' };
    }
    
    // Проверяем максимальную длину
    const bioMaxLength = window.LIMITS?.bioMaxLength || 500;
    return validateMaxLength(bio, bioMaxLength);
}

/**
 * Валидирует данные профиля пользователя
 * @param {Object} profileData - Данные профиля
 * @param {string} profileData.name - Имя пользователя
 * @param {string} profileData.email - Email пользователя
 * @param {string} profileData.bio - Описание пользователя
 * @returns {{isValid: boolean, errors: Object}} - Результат валидации
 */
function validateProfile(profileData) {
    const errors = {};
    let isValid = true;
    
    // Валидируем имя (обязательное)
    const nameValidation = validateName(profileData.name, true);
    if (!nameValidation.isValid) {
        errors.name = nameValidation.message;
        isValid = false;
    }
    
    // Валидируем email (обязательный)
    const emailValidation = validateEmail(profileData.email, true);
    if (!emailValidation.isValid) {
        errors.email = emailValidation.message;
        isValid = false;
    }
    
    // Валидируем описание (необязательное)
    const bioValidation = validateBio(profileData.bio);
    if (!bioValidation.isValid) {
        errors.bio = bioValidation.message;
        isValid = false;
    }
    
    return { isValid, errors };
}

// 🔍 ВАЛИДАТОРЫ ПОИСКА

/**
 * Валидирует поисковый запрос
 * @param {string} query - Поисковый запрос
 * @returns {{isValid: boolean, message: string}} - Результат валидации
 */
function validateSearchQuery(query) {
    // Пустой запрос валиден (показываем все)
    if (!query || !query.trim()) {
        return { isValid: true, message: '' };
    }
    
    // Проверяем минимальную длину
    const searchMinLength = window.LIMITS?.searchMinLength || 2;
    const minLengthCheck = validateMinLength(query, searchMinLength);
    if (!minLengthCheck.isValid) {
        return {
            isValid: false,
            message: `Введите минимум ${searchMinLength} символа для поиска`
        };
    }
    
    return { isValid: true, message: '' };
}

// 📊 ВАЛИДАТОРЫ ЛИМИТОВ

/**
 * Проверяет лимит цитат в день
 * @param {number} currentCount - Текущее количество цитат за день
 * @returns {{isValid: boolean, message: string}} - Результат проверки
 */
function validateDailyQuotesLimit(currentCount) {
    const quotesPerDay = window.LIMITS?.quotesPerDay || 10;
    const isValid = currentCount < quotesPerDay;
    return {
        isValid,
        message: isValid ? '' : (window.ERROR_MESSAGES?.quotesLimit || `Превышен лимит цитат в день (${quotesPerDay})`)
    };
}

// 🛠️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

/**
 * Очищает объект от пустых значений для валидации
 * @param {Object} obj - Объект для очистки
 * @returns {Object} - Очищенный объект
 */
function sanitizeForValidation(obj) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
            // Обрезаем строки
            if (typeof value === 'string') {
                sanitized[key] = value.trim();
            } else {
                sanitized[key] = value;
            }
        }
    }
    
    return sanitized;
}

/**
 * Валидирует форму полностью
 * @param {Object} formData - Данные формы
 * @param {Object} validationRules - Правила валидации
 * @returns {{isValid: boolean, errors: Object}} - Результат валидации
 */
function validateForm(formData, validationRules) {
    const errors = {};
    let isValid = true;
    
    // Очищаем данные
    const cleanData = sanitizeForValidation(formData);
    
    // Применяем правила валидации
    for (const [field, rules] of Object.entries(validationRules)) {
        const value = cleanData[field];
        
        for (const rule of rules) {
            const validation = rule.validator(value, ...rule.params || []);
            if (!validation.isValid) {
                errors[field] = validation.message;
                isValid = false;
                break; // Прерываем проверку поля на первой ошибке
            }
        }
    }
    
    return { isValid, errors };
}

// 🌐 ГЛОБАЛЬНЫЙ ДОСТУП
window.validateRequired = validateRequired;
window.validateMinLength = validateMinLength;
window.validateMaxLength = validateMaxLength;
window.validatePattern = validatePattern;
window.validateEmail = validateEmail;
window.validateName = validateName;
window.validatePhone = validatePhone;
window.validateQuoteText = validateQuoteText;
window.validateQuoteAuthor = validateQuoteAuthor;
window.validateQuote = validateQuote;
window.validateBio = validateBio;
window.validateProfile = validateProfile;
window.validateSearchQuery = validateSearchQuery;
window.validateDailyQuotesLimit = validateDailyQuotesLimit;
window.sanitizeForValidation = sanitizeForValidation;
window.validateForm = validateForm;

// Главный объект валидаторов
window.Validators = {
    // Базовые валидаторы
    validateRequired,
    validateMinLength,
    validateMaxLength,
    validatePattern,
    
    // Контактные данные
    validateEmail,
    validateName,
    validatePhone,
    
    // Цитаты
    validateQuoteText,
    validateQuoteAuthor,
    validateQuote,
    
    // Профиль
    validateBio,
    validateProfile,
    
    // Поиск
    validateSearchQuery,
    
    // Лимиты
    validateDailyQuotesLimit,
    
    // Вспомогательные
    sanitizeForValidation,
    validateForm
};