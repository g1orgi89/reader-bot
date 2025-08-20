# Book Categories Migration Guide

This document explains how to migrate the book catalog to the new 14 Russian categories taxonomy.

## Overview

The migration script `scripts/migrate_book_categories.js` updates existing BookCatalog documents to use the new 14-category display taxonomy while preserving legacy categories as tags.

## Before Migration

Ensure you have:
- MongoDB connection available (set in `.env` file)
- Backup of your database (recommended)
- Understanding of which books will be updated

## Running the Migration

### 1. Dry Run (Safe - No Changes)

```bash
# Preview what will be changed
node scripts/migrate_book_categories.js
```

This will show:
- How many books will be updated
- Which category each book will get
- Which legacy categories will become tags
- Books that don't match any title mapping

### 2. Apply Changes

```bash
# Actually update the database
node scripts/migrate_book_categories.js --apply
```

## What the Migration Does

1. **Title Matching**: Normalizes book titles and matches them to the new 14 categories
2. **Category Update**: Sets `categories` to a single-item array with the new category
3. **Tag Preservation**: Moves old categories/keywords to a `tags` array
4. **Deduplication**: Ensures the new category doesn't appear in tags

## Example Output

```
📚 Found 42 books in catalog
✅ UPDATED: "Искусство любить" → category=[ЛЮБОВЬ] tags=3
✅ UPDATED: "Атомные привычки" → category=[ВРЕМЯ И ПРИВЫЧКИ] tags=2
⚠️ Not matched by title:
  - Some Unknown Book
```

## New Category Taxonomy

The 14 display categories are:
- КРИЗИСЫ
- Я — ЖЕНЩИНА  
- ЛЮБОВЬ
- ОТНОШЕНИЯ
- ДЕНЬГИ
- ОДИНОЧЕСТВО
- СМЕРТЬ
- СЕМЕЙНЫЕ ОТНОШЕНИЯ
- СМЫСЛ ЖИЗНИ
- СЧАСТЬЕ
- ВРЕМЯ И ПРИВЫЧКИ
- ДОБРО И ЗЛО
- ОБЩЕСТВО
- ПОИСК СЕБЯ

## Frontend Changes

The Mini App now:
- Shows tabs for "ВСЕ" + 14 categories (instead of for-you/popular/new/classic/sales)
- Filters books by exact category match
- Maps API categories directly to the 14 taxonomy values
- Uses fallback category "ПОИСК СЕБЯ" for unmapped books

## Troubleshooting

**Books not matching**: If books aren't matched by title, you can:
1. Add more title mappings to `TITLE_TO_CATEGORY` in the script
2. Manually assign categories after migration
3. Use the default fallback category "ПОИСК СЕБЯ"

**Migration errors**: Check MongoDB connection and ensure the BookCatalog model is accessible.