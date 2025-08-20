# Book Catalog Import Guide

This guide explains how to import book catalog data from CSV-JSON format into the Reader Bot system.

## Overview

The book catalog system supports importing books with optional purchase URLs. When a book has a `purchaseUrl`, the system will generate UTM tracking links pointing to that URL instead of the default website.

## Data Format

The import process converts CSV-JSON data (from `csvjson.json`) into the BookCatalog format. The key field added in this implementation is:

- **purchaseUrl** (optional): Direct purchase link that will be used for UTM tracking

## Process

### 1. Prepare the Import Data

Run the conversion script to transform the CSV-JSON data:

```bash
node scripts/prepare_book_catalog_from_csvjson.js
```

This script:
- Reads `csvjson.json` from the project root
- Maps "Прямая ссылка на покупку" to `purchaseUrl`
- Generates transliterated slugs (e.g., "Тысячеликий герой" → "tysyachelikiy_geroy")
- Creates `data/bookCatalog.import.json`

### 2. Import the Data

Use the import API endpoint to load the data:

```bash
curl -X POST http://localhost:3002/api/reader/bookCatalog/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d @data/bookCatalog.import.json
```

## UTM Link Generation

The system automatically generates UTM links using the following logic:

### With purchaseUrl
When a book has a `purchaseUrl`, the system:
1. Parses the URL and existing query parameters
2. Adds UTM parameters (preserving existing ones):
   - `utm_source=telegram_bot`
   - `utm_medium=weekly_report`
   - `utm_campaign=reader_recommendations`
   - `utm_content={bookSlug}`
3. Returns the complete URL

Example:
```
purchaseUrl: "https://bebusel.info/hero"
utmLink: "https://bebusel.info/hero?utm_source=telegram_bot&utm_medium=weekly_report&utm_campaign=reader_recommendations&utm_content=tysyachelikiy_geroy"
```

### Without purchaseUrl (Fallback)
When no `purchaseUrl` is provided, falls back to:
```
utmLink: "https://anna-busel.com/books?utm_source=telegram_bot&utm_medium=weekly_report&utm_campaign=reader_recommendations&utm_content={bookSlug}"
```

## Data Fields

The import format includes these fields:

**Required:**
- `title`: Book/course title
- `description`: Analysis description
- `price`: Price in "$X" format
- `categories`: Array of category enums
- `bookSlug`: URL-safe identifier
- `reasoning`: Recommendation reason

**Optional:**
- `purchaseUrl`: Direct purchase link *(NEW)*
- `author`: Book author
- `targetThemes`: Array of theme keywords
- `isActive`: Active status (default: true)
- `priority`: Priority 1-10 (default: 5)

## Mini App Integration

When users interact with book recommendations in the Mini App, they will be directed to:
- The `purchaseUrl` with UTM tracking if available
- The default website with UTM tracking as fallback

This ensures proper attribution and conversion tracking for all book purchases.

## Validation

The system validates:
- `purchaseUrl` must be a valid URL format (if provided)
- `bookSlug` must match pattern: `^[a-z0-9_-]+$`
- All other existing validations remain unchanged

## Example Import Data

```json
{
  "books": [
    {
      "title": "Тысячеликий герой",
      "author": "Джозеф Кэмпбелл",
      "description": "Как найти свой путь и смысл жизни, преодолевая кризисы",
      "price": "$50",
      "categories": ["КРИЗИСЫ", "СМЫСЛ ЖИЗНИ"],
      "bookSlug": "tysyachelikiy_geroy",
      "purchaseUrl": "https://bebusel.info/hero",
      "reasoning": "Помогает найти смысл в кризисные моменты"
    }
  ]
}
```