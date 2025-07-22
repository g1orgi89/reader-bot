/**
 * 🔥 БЫСТРОЕ ИСПРАВЛЕНИЕ: Заменить ТОЛЬКО функцию renderQuotesList в app.js
 * 
 * ✅ ЧТО ДЕЛАТЬ:
 * 1. Открыть файл client/mini-app/js/app.js
 * 2. Найти функцию renderQuotesList (около строки 590)
 * 3. Заменить ВСЮ функцию на код ниже
 */

renderQuotesList(quotes) {
    const container = document.getElementById('quotesList');
    if (!container) return;

    if (!quotes || quotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-title">Дневник пуст</div>
                <div class="empty-state-text">Добавьте первую цитату, чтобы начать собирать мудрость</div>
            </div>
        `;
        return;
    }

    container.innerHTML = quotes.map(quote => {
        const quoteId = quote._id || quote.id;
        return `
            <div class="quote-card" data-quote-id="${quoteId}">
                
                <!-- 🔧 ИСПРАВЛЕНИЕ: Кнопка меню действий (3 точки) -->
                <button class="quote-menu-btn" 
                        onclick="event.stopPropagation(); app.toggleQuoteActions('${quoteId}')" 
                        title="Действия с цитатой">
                    ⋮
                </button>
                
                <!-- Основной контент цитаты -->
                <div class="quote-content" onclick="app.toggleQuoteActions('${quoteId}')">
                    <div class="quote-full-text">${this.escapeHtml(quote.text)}</div>
                    <div class="quote-author">— ${this.escapeHtml(quote.author || 'Неизвестный автор')}</div>
                    <div class="quote-meta">
                        <span>${this.formatDate(quote.createdAt)}</span>
                        ${quote.isFavorite ? '<span>❤️ Избранное</span>' : ''}
                    </div>
                    ${quote.analysis ? `
                        <div class="quote-analysis">
                            <div class="analysis-tags">
                                <span class="mood-tag">${quote.analysis.mood}</span>
                                <span class="category-tag">${quote.analysis.category}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- 🔧 ИСПРАВЛЕНИЕ: РАБОЧИЕ inline кнопки действий с иконками и текстом -->
                <div class="quote-actions-inline" id="actions-${quoteId}" style="display: none;">
                    <button class="action-btn edit-btn" 
                            onclick="event.stopPropagation(); app.editQuote('${quoteId}')" 
                            title="Редактировать цитату">
                        <span class="btn-icon">✏️</span>
                        <span class="btn-text">Редактировать</span>
                    </button>
                    <button class="action-btn favorite-btn ${quote.isFavorite ? 'active' : ''}" 
                            onclick="event.stopPropagation(); app.toggleFavorite('${quoteId}')" 
                            title="${quote.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                        <span class="btn-icon">${quote.isFavorite ? '❤️' : '🤍'}</span>
                        <span class="btn-text">${quote.isFavorite ? 'Избранное' : 'В избранное'}</span>
                    </button>
                    <button class="action-btn delete-btn" 
                            onclick="event.stopPropagation(); app.deleteQuote('${quoteId}')" 
                            title="Удалить цитату">
                        <span class="btn-icon">🗑️</span>
                        <span class="btn-text">Удалить</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 🚀 РЕЗУЛЬТАТ: После замены этой функции будет:
 * 
 * ✅ Кнопка 3 точки (⋮) в правом верхнем углу каждой цитаты
 * ✅ Рабочие кнопки редактирования, избранного и удаления
 * ✅ Красивые иконки и текст в кнопках действий
 * ✅ Правильная структура HTML для CSS стилей
 * ✅ События onclick привязаны к app методам
 * 
 * 🔧 ОСТАЛЬНЫЕ ФУНКЦИИ:
 * toggleQuoteActions, editQuote, toggleFavorite, deleteQuote
 * уже работают в app.js, нужно только улучшить их по желанию
 * из файла working-quote-functions.js
 * 
 * 💡 ГЛАВНОЕ: Эта замена решит основную UX проблему!
 */
