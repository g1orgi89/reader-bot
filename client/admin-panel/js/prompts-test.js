/**
 * 🧪 TEMPORARY: Cache-busting test for prompts.js
 * Этот файл поможет убедиться, что браузер загружает новый код
 */

// 🔥 CACHE BUSTER - обновите эту строку, если изменения не видны
console.log('🧪 CACHE BUSTER VERSION: 2025-07-12-21:00 - FULL RENDER FIX');

/**
 * 🔍 Проверка работы renderPrompts - временная диагностика
 */
function checkRenderPromptsFunction() {
    console.log('🔍 === ДИАГНОСТИКА renderPrompts ===');
    
    // Проверяем наличие функции
    if (typeof renderPrompts === 'function') {
        console.log('✅ renderPrompts функция существует');
        
        // Тестируем с пустым массивом
        console.log('🧪 Тест с пустым массивом...');
        renderPrompts([]);
        
        // Тестируем с тестовыми данными
        console.log('🧪 Тест с тестовыми данными...');
        const testPrompts = [{
            _id: 'test-id-123',
            name: 'Тестовый промпт',
            category: 'onboarding',
            language: 'ru',
            variables: ['user_name', 'test_var'],
            status: 'active',
            priority: 'normal',
            description: 'Это тестовое описание промпта'
        }];
        
        renderPrompts(testPrompts);
        
    } else {
        console.error('❌ renderPrompts функция НЕ НАЙДЕНА');
        console.log('🔍 Доступные функции в window:', Object.keys(window).filter(key => key.includes('render')));
    }
    
    // Проверяем таблицу
    const tableBody = document.querySelector('#prompts-table tbody');
    if (tableBody) {
        console.log('✅ Таблица найдена');
        console.log('📊 Содержимое таблицы:', tableBody.innerHTML.substring(0, 200) + '...');
    } else {
        console.error('❌ Таблица НЕ НАЙДЕНА');
    }
}

/**
 * 🎯 Простая функция для принудительного рендеринга тестовых данных
 */
function forceRenderTest() {
    console.log('🎯 Принудительный рендеринг тестовых данных...');
    
    const tableBody = document.querySelector('#prompts-table tbody');
    if (!tableBody) {
        console.error('❌ Таблица не найдена!');
        return;
    }
    
    // Очищаем таблицу
    tableBody.innerHTML = '';
    
    // Принудительно вставляем тестовую строку
    const testHTML = `
        <tr data-id="test-123">
            <td class="col-name">
                <div class="prompt-name">🧪 Тестовый промпт</div>
                <small class="text-muted">Это тестовое описание для проверки рендеринга</small>
            </td>
            <td class="col-category">
                <span class="badge badge-primary">🎯 Онбординг</span>
            </td>
            <td class="col-language">Русский</td>
            <td class="col-variables">
                <span class="badge badge-secondary badge-sm">user_name</span>
                <span class="badge badge-secondary badge-sm">test_var</span>
            </td>
            <td class="col-status">
                <span class="badge badge-success">Активный</span>
            </td>
            <td class="col-priority">
                <span class="priority priority-normal">Обычный</span>
            </td>
            <td class="col-actions">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" title="Просмотр">👁️</button>
                    <button class="btn btn-outline-secondary" title="Редактировать">✏️</button>
                    <button class="btn btn-outline-success" title="Тестировать">🧪</button>
                    <button class="btn btn-outline-danger" title="Удалить">🗑️</button>
                </div>
            </td>
        </tr>
    `;
    
    tableBody.innerHTML = testHTML;
    console.log('✅ Тестовая строка добавлена в таблицу');
}

// Добавляем тестовые функции в window для доступа из консоли
window.checkRenderPromptsFunction = checkRenderPromptsFunction;
window.forceRenderTest = forceRenderTest;

// Автоматический запуск диагностики через 3 секунды после загрузки страницы
setTimeout(() => {
    console.log('🧪 === АВТОМАТИЧЕСКАЯ ДИАГНОСТИКА ===');
    checkRenderPromptsFunction();
}, 3000);

console.log('🧪 Тестовый модуль загружен. Используйте:');
console.log('   checkRenderPromptsFunction() - для диагностики');
console.log('   forceRenderTest() - для принудительного рендеринга тестовых данных');
