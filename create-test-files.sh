# Создание тестовых файлов для многоязычности

# English test
echo '{"message": "What is the SHROOMS token?", "userId": "test-en"}' > test-en.json

# Russian test  
echo '{"message": "Что такое токен SHROOMS?", "userId": "test-ru"}' > test-ru.json

# Spanish test
echo '{"message": "¿Qué es el token SHROOMS?", "userId": "test-es"}' > test-es.json

# Ticket creation tests (проблемные сообщения)
echo '{"message": "My transaction is stuck for 2 hours", "userId": "user-problem-1"}' > test-ticket-1.json
echo '{"message": "Error: wallet connection failed", "userId": "user-problem-2"}' > test-ticket-2.json  
echo '{"message": "Ошибка подключения кошелька", "userId": "user-problem-3"}' > test-ticket-3.json

# Context test
echo '{"message": "Hello", "userId": "test-context"}' > test-context-1.json
