# Импорт каталога разборов из csvjson.json

Эта инструкция конвертирует файл csvjson.json (в корне репозитория) в формат API и импортирует его в каталог книг, который подхватывает мини‑приложение.

## 1) Сгенерировать файл для импорта

Запуск скрипта конвертации создаст data/bookCatalog.import.json:

```bash
node scripts/prepare_book_catalog_from_csvjson.js
```

Выход:
- data/bookCatalog.import.json — объект вида `{ "books": [ ... ] }`

В каждой записи присутствуют:
- title, author, description
- price (строка, legacy), priceByn (число), priceRub (null)
- categories (нормализованная 1 категория из 14), targetThemes (массив)
- bookSlug (из ссылки или транслитерации названия)
- isActive, priority, reasoning

UTM ссылка генерируется автоматически виртуальным полем `utmLink` по `bookSlug` в модели BookCatalog.

## 2) Импорт в бэкенд

Требуется admin токен и адрес API:

```bash
curl -X POST "$API_BASE/api/reader/bookCatalog/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-binary @data/bookCatalog.import.json
```

Где:
- `API_BASE` — например, `http://localhost:3000`
- `ADMIN_TOKEN` — токен админа (см. авторизацию админ-панели)

Успешный импорт добавит/обновит записи по `bookSlug`.

## 3) Проверка

- GET `$API_BASE/api/reader/bookCatalog?limit=100`
- Убедитесь, что в ответе присутствуют поля `utmLink`, `categories`, `priceByn` и пр.
- Мини‑приложение подхватывает каталог автоматически через этот API

## Примечания
- Значение базы для UTM можно задать переменной окружения `ANNA_WEBSITE_URL`; по умолчанию `https://anna-busel.com/books`.
- Скрипт использует `server/utils/categoryMapper.mapThemesToCategory` если доступен; иначе категория по умолчанию — "ПОИСК СЕБЯ".
- Источник не содержит `priceRub`; фронт покажет BYN или сконвертирует legacy `price`.