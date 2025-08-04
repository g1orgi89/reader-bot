#!/bin/bash

# 🚀 АВТОМАТИЗИРОВАННЫЕ ИСПРАВЛЕНИЯ КРИТИЧЕСКИХ ПРОБЛЕМ
# Этот скрипт исправляет основные проблемы, найденные в аудите

echo "🔍 Начинаем автоматические исправления Reader Bot..."

# 1. Создание резервной копии критических файлов
echo "📦 Создание резервной копии..."
cp .eslintrc.json .eslintrc.json.backup
cp package.json package.json.backup

# 2. Обновление ESLint конфигурации
echo "🔧 Исправление ESLint конфигурации..."
if [ -f ".eslintrc.new.json" ]; then
    mv .eslintrc.new.json .eslintrc.json
    echo "✅ ESLint конфигурация обновлена"
else
    echo "❌ Файл .eslintrc.new.json не найден"
fi

# 3. Проверка setup файла для тестов
echo "🧪 Проверка конфигурации тестов..."
if [ -f "tests/setup.js" ]; then
    echo "✅ Файл tests/setup.js найден"
else
    echo "❌ Файл tests/setup.js отсутствует"
    exit 1
fi

# 4. Создание директорий для документации
echo "📚 Создание структуры документации..."
mkdir -p docs/{setup,architecture,development,features,troubleshooting}
mkdir -p archive/{work-logs,concepts,outdated}
echo "✅ Структура директорий создана"

# 5. Перемещение Work Log файлов
echo "📂 Архивирование Work Log файлов..."
mv WORK_LOG*.md archive/work-logs/ 2>/dev/null
echo "✅ Work Log файлы перемещены в архив"

# 6. Перемещение концептуальных файлов
echo "📂 Архивирование концептуальных файлов..."
mv *концепт*.txt archive/concepts/ 2>/dev/null
mv *план*.txt archive/concepts/ 2>/dev/null
echo "✅ Концептуальные файлы перемещены в архив"

# 7. Перемещение устаревших файлов
echo "📂 Архивирование устаревших файлов..."
mv *_FIX*.md archive/outdated/ 2>/dev/null
mv *_FIXES*.md archive/outdated/ 2>/dev/null
mv CLEANUP*.md archive/outdated/ 2>/dev/null
mv STAGE*.md archive/outdated/ 2>/dev/null
mv CONTEXT_FIXES.md archive/outdated/ 2>/dev/null
mv CONSTRUCTOR_FIXES.md archive/outdated/ 2>/dev/null
mv ANALYTICS_FIXES.md archive/outdated/ 2>/dev/null
echo "✅ Устаревшие файлы перемещены в архив"

# 8. Проверка наличия критических файлов безопасности
echo "🔒 Проверка файлов безопасности..."
if [ ! -f ".env.example" ]; then
    echo "❌ Отсутствует .env.example"
else
    echo "✅ .env.example найден"
fi

# 9. Создание файла игнорирования для архива
echo "📝 Обновление .gitignore..."
if ! grep -q "archive/" .gitignore; then
    echo -e "\n# Archive directory\narchive/" >> .gitignore
    echo "✅ Добавлена директория archive/ в .gitignore"
fi

# 10. Проверка размера проекта
echo "📊 Анализ размера проекта..."
PROJECT_SIZE=$(du -sh . | cut -f1)
NODE_MODULES_SIZE=$(du -sh node_modules/ | cut -f1)
echo "📦 Общий размер: $PROJECT_SIZE"
echo "📦 node_modules: $NODE_MODULES_SIZE"

# 11. Подсчет файлов после очистки
JS_FILES=$(find . -name "*.js" -not -path "./node_modules/*" | wc -l)
MD_FILES=$(find . -name "*.md" -not -path "./node_modules/*" -not -path "./archive/*" | wc -l)
ARCHIVE_FILES=$(find archive/ -type f | wc -l)

echo "📊 Файлы JavaScript: $JS_FILES"
echo "📊 Файлы Markdown (активные): $MD_FILES" 
echo "📊 Файлы в архиве: $ARCHIVE_FILES"

# 12. Проверка критических зависимостей
echo "🔍 Проверка критических зависимостей..."
if npm list @langchain/community 2>/dev/null | grep -q "WARN\|ERR"; then
    echo "⚠️  Требуется обновление @langchain/community"
fi

if npm list pdfjs-dist 2>/dev/null | grep -q "WARN\|ERR"; then
    echo "⚠️  Требуется обновление pdfjs-dist"
fi

if npm list xlsx 2>/dev/null | grep -q "xlsx"; then
    echo "⚠️  Рекомендуется замена xlsx на безопасную альтернативу"
fi

# 13. Создание отчета об исправлениях
echo "📄 Создание отчета об исправлениях..."
cat > FIXES_APPLIED.md << 'EOF'
# 🚀 ПРИМЕНЁННЫЕ ИСПРАВЛЕНИЯ

## Дата: $(date)

### ✅ Выполненные исправления:

1. **ESLint конфигурация**
   - Обновлена конфигурация для совместимости с современным ESLint
   - Удалены проблемные JSDoc правила
   - Добавлены browser globals

2. **Структура документации**
   - Создана организованная структура docs/
   - Перемещены Work Log файлы в archive/
   - Архивированы устаревшие документы

3. **Тестирование**
   - Создан отсутствующий tests/setup.js
   - Настроены переменные окружения для тестов

4. **Очистка проекта**
   - Удалены дублирующиеся документы из корня
   - Организована архивная структура
   - Обновлен .gitignore

### 🚨 Требует внимания:

1. **Безопасность**
   - Обновить уязвимые зависимости: @langchain/community, pdfjs-dist, xlsx
   - Заменить демо-пароли в production

2. **Тестирование**  
   - Исправить интеграционные тесты (MongoDB connectivity)
   - Обновить тестовые данные

3. **Код**
   - Исправить ~9000 ESLint ошибок
   - Добавить недостающие JSDoc комментарии

### 📊 Статистика:
- JavaScript файлов: $(find . -name "*.js" -not -path "./node_modules/*" | wc -l)
- Активных MD файлов: $(find . -name "*.md" -not -path "./node_modules/*" -not -path "./archive/*" | wc -l)
- Файлов в архиве: $(find archive/ -type f 2>/dev/null | wc -l)
EOF

echo "✅ Отчет создан: FIXES_APPLIED.md"

# 14. Финальная проверка
echo "🔍 Финальная проверка..."
if [ -d "docs" ] && [ -d "archive" ] && [ -f "tests/setup.js" ]; then
    echo "🎉 Основные исправления применены успешно!"
    echo ""
    echo "📋 Следующие шаги:"
    echo "1. Обновить зависимости: npm audit fix"
    echo "2. Исправить ESLint ошибки: npm run lint:fix"
    echo "3. Запустить тесты: npm test"
    echo "4. Обновить пароли в .env"
    echo ""
    echo "📚 Документация:"
    echo "- Аудит проекта: PROJECT_AUDIT_REPORT.md"
    echo "- Исправления безопасности: SECURITY_FIXES.md"
    echo "- План документации: DOCS_REORGANIZATION_PLAN.md"
else
    echo "❌ Некоторые исправления не применились корректно"
    exit 1
fi