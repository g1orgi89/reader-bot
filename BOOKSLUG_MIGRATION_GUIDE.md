# Weekly Report BookSlug Synchronization

## Overview

This implementation achieves full synchronization between weekly report recommendations (WeeklyReport model) and the BookCatalog so that every saved recommendation contains a canonical bookSlug referencing an existing catalog entry (or a deterministic fallback), enabling stable deep links and highlight behavior in the Catalog page.

## Changes Made

### 1. Data Model Updates (`server/models/weeklyReport.js`)

Extended `bookRecommendationSchema` to include:
- `author` (optional String) - Book author
- `priceByn` (optional Number) - Price in Belarusian rubles  
- `bookSlug` (required String) - Canonical slug with validation `/^[a-z0-9_-]+$/`

Maintains compatibility with existing `title`, `description`, `price`, `link`, and `reasoning` fields.

### 2. Service Logic Updates (`server/services/weeklyReportService.js`)

- Centralized recommendation generation to pull from BookCatalog when possible
- Enhanced fallback logic with deterministic slugs for known books:
  - `art_of_loving` - Разбор "Искусство любить" Эриха Фромма
  - `letters_to_young_poet` - "Письма к молодому поэту" Рильке  
  - `be_yourself_course` - Курс "Быть собой"
  - `wise_mother_course` - Курс "Мудрая мама"
  - `little_prince` - "Маленький принц" с комментариями
- UTM link generation now always uses bookSlug
- Added Cyrillic-to-Latin transliteration helper for slug generation

### 3. Migration Script (`scripts/migrate-bookslug.js`)

Backfills bookSlug for existing WeeklyReport documents:

```bash
# Test migration (dry run)
node scripts/migrate-bookslug.js --dry-run

# Test with limited records  
node scripts/migrate-bookslug.js --dry-run --limit=10

# Apply migration
node scripts/migrate-bookslug.js
```

**Features:**
- ✅ Idempotent (safe to re-run)
- ✅ Matches catalog by title+author (case-insensitive)
- ✅ Falls back to known book mappings
- ✅ Generates transliterated slugs for unmatched books
- ✅ Provides detailed console summary
- ✅ Backfills priceByn and author from catalog when available

### 4. Frontend Updates (`mini-app/js/pages/ReportsPage.js`)

- Removed heavy ad-hoc catalog scanning
- Added lightweight fallback for legacy records only
- Uses `rec.bookSlug` directly in catalog links: `#/catalog?highlight={bookSlug}`
- Maintains backwards compatibility

## Usage Instructions

### For Developers

1. **Deploy the code changes** (already committed)

2. **Run migration to backfill existing data:**
   ```bash
   # First, test with dry run
   node scripts/migrate-bookslug.js --dry-run
   
   # Review the output, then apply
   node scripts/migrate-bookslug.js
   ```

3. **New weekly reports** will automatically include bookSlug

### For End Users

- **Clicking "Подробнее"** on recommendations now takes users directly to the highlighted book in the catalog
- **Stable links** - bookSlug provides consistent references regardless of title changes
- **Better performance** - no more client-side catalog scanning

## Technical Details

### BookSlug Format
- Lowercase alphanumeric with hyphens and underscores: `/^[a-z0-9_-]+$/`
- Cyrillic characters transliterated to Latin (а→a, б→b, ж→zh, etc.)
- Maximum 50 characters

### Transliteration Map
```javascript
{
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}
```

### Migration Statistics Example
```
📊 Migration Summary:
══════════════════════════════════════════════════
📋 Reports processed: 45
📋 Reports updated: 42
📋 Recommendations processed: 89
📋 Catalog matches: 67
📋 Known book matches: 15
📋 Generated slugs: 7
📋 Skipped (already have bookSlug): 12
```

## Verification

After running the migration, verify:

1. **Database**: Check that recommendations now have `bookSlug` field
2. **Frontend**: Test "Подробнее" links navigate to catalog with highlighting  
3. **New reports**: Confirm new weekly reports include bookSlug automatically

## Rollback Plan

If issues arise:
1. The migration is additive (only adds fields, doesn't remove)
2. Frontend falls back gracefully for missing bookSlug
3. Can revert code changes and re-deploy previous version
4. Migration script is idempotent and can be safely re-run

## Support

For questions or issues with the migration:
1. Check migration script output for detailed logs
2. Test with `--dry-run` flag first
3. Use `--limit=N` for testing small batches
4. Migration script provides detailed error messages and suggestions