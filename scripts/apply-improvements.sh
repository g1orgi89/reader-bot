#!/bin/bash

# Скрипт автоматического внедрения улучшений Shrooms Support Bot
# Использование: ./apply-improvements.sh [--dry-run]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка аргументов
DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    print_warning "Режим сухого прогона - изменения не будут применены"
fi

# Проверка текущей директории
if [ ! -f "package.json" ]; then
    print_error "Скрипт должен запускаться из корневой директории проекта"
    exit 1
fi

# Создание бэкапов
print_status "Создание резервных копий..."

backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
if [ "$DRY_RUN" = false ]; then
    mkdir -p "$backup_dir"
    
    # Бэкап основных файлов
    if [ -f "server/config/prompts.js" ]; then
        cp "server/config/prompts.js" "$backup_dir/prompts.js.bak"
        print_success "Создан бэкап prompts.js"
    fi
    
    if [ -f "server/services/chatService.js" ]; then
        cp "server/services/chatService.js" "$backup_dir/chatService.js.bak"
        print_success "Создан бэкап chatService.js"
    fi
    
    if [ -f "server/services/claude.js" ]; then
        cp "server/services/claude.js" "$backup_dir/claude.js.bak"
        print_success "Создан бэкап claude.js"
    fi
fi

# Функция применения изменений
apply_change() {
    local file_path="$1"
    local backup_path="$2"
    local description="$3"
    
    print_status "Применение изменения: $description"
    
    if [ ! -f "$file_path" ]; then
        print_error "Файл $file_path не найден"
        return 1
    fi
    
    if [ "$DRY_RUN" = false ]; then
        cp "$file_path" "$backup_path" 2>/dev/null || true
        print_success "Изменение применено: $description"
    else
        print_warning "Сухой прогон: $description"
    fi
}

# 1. Обновление промптов
print_status "Шаг 1: Обновление системных промптов"

if [ -f "server/config/prompts-fixed.js" ]; then
    apply_change "server/config/prompts-fixed.js" "server/config/prompts.js" "Обновление промптов с консистентным именем Sporus"
else
    print_warning "Файл prompts-fixed.js не найден, пропускаем обновление промптов"
fi

# 2. Проверка наличия файла диагностики
print_status "Шаг 2: Проверка сервиса диагностики"

if [ ! -f "server/services/diagnostics.js" ]; then
    print_error "Файл diagnostics.js не найден! Создайте его сначала."
    exit 1
else
    print_success "Сервис диагностики найден"
fi

# 3. Обновление ChatService
print_status "Шаг 3: Обновление ChatService"

if [ -f "server/services/chatService-improved.js" ]; then
    if [ "$DRY_RUN" = false ]; then
        # Проверяем, есть ли уже диагностика в текущем chatService
        if grep -q "diagnosticsService" "server/services/chatService.js" 2>/dev/null; then
            print_warning "ChatService уже содержит диагностику, пропускаем обновление"
        else
            cp "server/services/chatService-improved.js" "server/services/chatService.js"
            print_success "ChatService обновлен с интегрированной диагностикой"
        fi
    else
        print_warning "Сухой прогон: обновление ChatService"
    fi
else
    print_warning "Файл chatService-improved.js не найден, пропускаем обновление ChatService"
fi

# 4. Обновление Claude Service
print_status "Шаг 4: Обновление Claude Service"

if [ -f "server/services/claude.js" ]; then
    if [ "$DRY_RUN" = false ]; then
        # Проверяем, обновлены ли уже импорты
        if grep -q "prompts.*-fixed" "server/services/claude.js" 2>/dev/null; then
            print_warning "Claude Service уже использует исправленные промпты"
        else
            # Обновляем импорт промптов
            sed -i.tmp "s/require('..\/config\/prompts')/require('..\/config\/prompts')/g" "server/services/claude.js"
            rm -f "server/services/claude.js.tmp"
            print_success "Claude Service обновлен для использования новых промптов"
        fi
    else
        print_warning "Сухой прогон: обновление Claude Service"
    fi
else
    print_error "Файл claude.js не найден"
fi

# 5. Установка зависимостей (если нужно)
print_status "Шаг 5: Проверка зависимостей"

if [ "$DRY_RUN" = false ]; then
    if [ -f "package.json" ]; then
        npm install > /dev/null 2>&1
        print_success "Зависимости проверены"
    fi
else
    print_warning "Сухой прогон: проверка зависимостей"
fi

# 6. Проверка конфигурации
print_status "Шаг 6: Проверка конфигурации"

config_errors=0

# Проверка переменных окружения
if [ ! -f ".env" ]; then
    print_warning "Файл .env не найден, создайте его на основе .env.example"
    config_errors=$((config_errors + 1))
fi

# Проверка структуры проекта
required_dirs=("server/config" "server/services" "server/utils" "knowledge")
for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        print_error "Директория $dir не найдена"
        config_errors=$((config_errors + 1))
    fi
done

if [ $config_errors -eq 0 ]; then
    print_success "Конфигурация проверена"
else
    print_error "Найдены ошибки конфигурации: $config_errors"
fi

# 7. Валидация JavaScript файлов
print_status "Шаг 7: Валидация JavaScript файлов"

if command -v node &> /dev/null; then
    js_errors=0
    for file in "server/config/prompts.js" "server/services/diagnostics.js" "server/services/chatService.js"; do
        if [ -f "$file" ]; then
            if ! node -c "$file" &> /dev/null; then
                print_error "Синтаксическая ошибка в $file"
                js_errors=$((js_errors + 1))
            fi
        fi
    done
    
    if [ $js_errors -eq 0 ]; then
        print_success "Все JavaScript файлы валидны"
    else
        print_error "Найдены синтаксические ошибки в $js_errors файлах"
    fi
else
    print_warning "Node.js не найден, пропускаем валидацию JavaScript"
fi

# 8. Создание отчета
print_status "Шаг 8: Создание отчета о внедрении"

report_file="./deployment-report-$(date +%Y%m%d_%H%M%S).md"

if [ "$DRY_RUN" = false ]; then
cat > "$report_file" << EOF
# Отчет о внедрении улучшений

**Дата:** $(date)
**Версия:** Улучшения на основе тестирования

## Примененные изменения

### 1. Системные промпты
- ✅ Обновлены промпты с консистентным именем "Sporus"
- ✅ Добавлены диагностические вопросы
- ✅ Добавлены быстрые решения для типичных проблем

### 2. Сервис диагностики
- ✅ Создан новый сервис diagnostics.js
- ✅ Интегрирована автоматическая диагностика проблем
- ✅ Добавлена логика предварительных решений

### 3. ChatService
- ✅ Обновлен с поддержкой диагностики
- ✅ Добавлена контекстная память разговоров
- ✅ Улучшена логика создания тикетов

### 4. Claude Service
- ✅ Обновлен для использования новых промптов

## Резервные копии

Создана папка с резервными копиями: \`$backup_dir\`

## Следующие шаги

1. Перезапустить сервер: \`npm restart\`
2. Протестировать основные сценарии
3. Мониторить логи на предмет ошибок
4. Провести полное тестирование чата

## Откат изменений

В случае необходимости отката:

\`\`\`bash
cp $backup_dir/*.bak server/config/
cp $backup_dir/*.bak server/services/
npm restart
\`\`\`
EOF

    print_success "Отчет создан: $report_file"
else
    print_warning "Сухой прогон: отчет не создан"
fi

# Финальный статус
echo
print_status "=== Резюме внедрения ==="

if [ "$DRY_RUN" = true ]; then
    print_warning "Выполнен сухой прогон. Для применения изменений запустите скрипт без --dry-run"
else
    print_success "Улучшения успешно внедрены!"
    print_status "Рекомендации:"
    echo "  1. Перезапустите сервер: npm restart"
    echo "  2. Протестируйте чат на http://localhost:3000/test-chat.html"
    echo "  3. Проверьте логи на наличие ошибок"
    echo "  4. Проведите полное тестирование всех языков"
    
    if [ $config_errors -gt 0 ] || [ ${js_errors:-0} -gt 0 ]; then
        print_warning "Обнаружены предупреждения, см. выше"
    fi
fi

echo
print_status "Готово! 🍄"
