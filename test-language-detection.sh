#!/bin/bash

# Тестовые curl команды для проверки автоматического определения языка
# Shrooms Support Bot - Language Detection Tests

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Базовый URL
BASE_URL="http://localhost:3000/api/chat"

echo -e "${BLUE}=== Тесты автоматического определения языка Shrooms Bot ===${NC}"
echo ""

# Функция для выполнения curl запроса с правильной кодировкой
test_language_detection() {
    local text="$1"
    local expected_lang="$2"
    local test_name="$3"
    
    echo -e "${YELLOW}Тест: $test_name${NC}"
    echo -e "Текст: $text"
    
    # Для Windows (Git Bash/PowerShell)
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        result=$(curl -s -X POST "$BASE_URL/detect-language" \
            -H "Content-Type: application/json; charset=utf-8" \
            -H "Accept-Charset: utf-8" \
            --data-raw "{\"text\": \"$text\"}")
    else
        # Для Linux/macOS
        result=$(curl -s -X POST "$BASE_URL/detect-language" \
            -H "Content-Type: application/json; charset=utf-8" \
            -H "Accept-Charset: utf-8" \
            -d "{\"text\": \"$text\"}")
    fi
    
    detected_lang=$(echo $result | grep -o '"detectedLanguage":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$detected_lang" = "$expected_lang" ]; then
        echo -e "${GREEN}✓ Успешно! Определен язык: $detected_lang${NC}"
    else
        echo -e "${RED}✗ Ошибка! Ожидался: $expected_lang, получен: $detected_lang${NC}"
        echo "Полный ответ: $result"
    fi
    echo ""
}

# 1. Тесты базового определения языка
echo -e "${BLUE}1. Базовое определение языка${NC}"

# Русский язык (с кириллицей)
test_language_detection "Привет, как подключить кошелек?" "ru" "Русский с кириллицей"

# Английский язык
test_language_detection "Hello, how to connect my wallet?" "en" "Английский"

# Испанский язык (с диакритиками)
test_language_detection "Hola, ¿cómo puedo conectar mi billetera?" "es" "Испанский с диакритиками"

# 2. Тесты смешанного контента
echo -e "${BLUE}2. Смешанный контент (текст + техническая информация)${NC}"

# Русский текст с английской ошибкой
test_language_detection "У меня ошибка подключения: Failed to connect wallet" "ru" "Русский + английская ошибка"

# Русский текст с JSON
test_language_detection "Мой конфиг: {\"network\": \"mainnet\"}" "ru" "Русский + JSON"

# 3. Тесты характерных слов
echo -e "${BLUE}3. Характерные слова для каждого языка${NC}"

# Русские вопросительные слова
test_language_detection "Что такое токен SHROOMS?" "ru" "Русские вопросительные слова"

# Испанские характерные слова
test_language_detection "Gracias por la ayuda con la billetera" "es" "Испанские характерные слова"

# Английские характерные слова
test_language_detection "Thanks for the help with wallet connection" "en" "Английские характерные слова"

# 4. Тест полного разговора с переключением языков
echo -e "${BLUE}4. Тест переключения языков в разговоре${NC}"

echo -e "${YELLOW}Создание разговора на русском...${NC}"
RESPONSE1=$(curl -s -X POST "$BASE_URL/message" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept-Charset: utf-8" \
    --data-raw '{"message": "Привет, мне нужна помощь", "userId": "test-user-lang"}')

CONV_ID=$(echo $RESPONSE1 | grep -o '"conversationId":"[^"]*"' | cut -d'"' -f4)
LANG1=$(echo $RESPONSE1 | grep -o '"language":"[^"]*"' | cut -d'"' -f4)
echo "Язык 1: $LANG1, Conversation ID: $CONV_ID"

echo -e "${YELLOW}Переключение на английский...${NC}"
RESPONSE2=$(curl -s -X POST "$BASE_URL/message" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept-Charset: utf-8" \
    --data-raw "{\"message\": \"Hello, I need help with wallet error\", \"userId\": \"test-user-lang\", \"conversationId\": \"$CONV_ID\"}")

LANG2=$(echo $RESPONSE2 | grep -o '"language":"[^"]*"' | cut -d'"' -f4)
echo "Язык 2: $LANG2"

echo -e "${YELLOW}Переключение на испанский...${NC}"
RESPONSE3=$(curl -s -X POST "$BASE_URL/message" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept-Charset: utf-8" \
    --data-raw "{\"message\": \"Hola, tengo problemas con mi billetera\", \"userId\": \"test-user-lang\", \"conversationId\": \"$CONV_ID\"}")

LANG3=$(echo $RESPONSE3 | grep -o '"language":"[^"]*"' | cut -d'"' -f4)
echo "Язык 3: $LANG3"

echo -e "${YELLOW}Возврат к русскому...${NC}"
RESPONSE4=$(curl -s -X POST "$BASE_URL/message" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept-Charset: utf-8" \
    --data-raw "{\"message\": \"Спасибо за помощь!\", \"userId\": \"test-user-lang\", \"conversationId\": \"$CONV_ID\"}")

LANG4=$(echo $RESPONSE4 | grep -o '"language":"[^"]*"' | cut -d'"' -f4)
echo "Язык 4: $LANG4"

# Проверка результатов
echo ""
echo -e "${BLUE}=== Результаты тестирования переключения языков ===${NC}"
if [ "$LANG1" = "ru" ] && [ "$LANG2" = "en" ] && [ "$LANG3" = "es" ] && [ "$LANG4" = "ru" ]; then
    echo -e "${GREEN}✓ Все переключения языков работают корректно!${NC}"
else
    echo -e "${RED}✗ Обнаружены проблемы с переключением языков:${NC}"
    echo -e "  Русский -> Английский -> Испанский -> Русский"
    echo -e "  $LANG1 -> $LANG2 -> $LANG3 -> $LANG4"
fi

# 5. Тест статистики языков
echo ""
echo -e "${BLUE}5. Получение статистики языков${NC}"
curl -s -X GET "$BASE_URL/languages" \
    -H "Accept: application/json; charset=utf-8" | \
    grep -o '"supportedLanguages":\[[^]]*\]'

echo ""
echo -e "${GREEN}=== Тестирование завершено ===${NC}"