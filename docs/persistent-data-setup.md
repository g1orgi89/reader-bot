# Reader Bot - Persistent Data Setup

## Проблема с потерей данных

При перезапуске Docker контейнеров данные MongoDB удаляются. Эта инструкция поможет настроить постоянное хранение данных.

## Решение 1: Docker Compose (рекомендуется)

### Шаг 1: Остановите текущие контейнеры
```bash
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
```

### Шаг 2: Запустите через Docker Compose
```bash
git pull origin main
docker-compose up -d
```

### Шаг 3: Проверьте запуск
```bash
docker-compose ps
```

### Шаг 4: Запустите приложение
```bash
npm start
```

### Шаг 5: Проверьте подключение
- MongoDB: `mongodb://localhost:27017/reader_bot`
- Redis: `redis://localhost:6379`
- Админ-панель: `http://localhost:3002/admin-panel/users.html`

## Решение 2: Ручное создание volume (альтернатива)

Если не хотите использовать Docker Compose:

```bash
# Создать volume для MongoDB
docker volume create reader-mongodb-data

# Запустить MongoDB с volume
docker run -d \
  --name reader-mongodb \
  -p 27017:27017 \
  -v reader-mongodb-data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=reader_admin \
  -e MONGO_INITDB_ROOT_PASSWORD=reader_secure_2025 \
  -e MONGO_INITDB_DATABASE=reader_bot \
  mongo:7
```

## Преимущества Docker Compose

✅ **Данные сохраняются** между перезапусками
✅ **Автоматический запуск** зависимостей  
✅ **Простое управление** всеми сервисами
✅ **Изолированная сеть** для контейнеров
✅ **Настройка через файлы** конфигурации

## Управление

```bash
# Запуск всех сервисов
docker-compose up -d

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Просмотр логов
docker-compose logs -f mongodb

# Просмотр статуса
docker-compose ps
```

## Резервное копирование

```bash
# Создать backup MongoDB
docker exec reader-bot-mongodb mongodump --out /data/backup

# Восстановить backup
docker exec reader-bot-mongodb mongorestore /data/backup
```

Теперь ваши данные будут сохраняться между перезапусками!