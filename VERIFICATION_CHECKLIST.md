# Audio Feedback UI Redesign - Quick Verification Checklist

## Quick Start
1. `npm install` (if needed)
2. `npm run dev:reader`
3. Navigate to `/free-audios`

## Visual Checks

### Audio Card
- [ ] ⭐ **Pill** in top-right of cover
- [ ] **No text** overlapping cover (except pill)
- [ ] **Single button** in footer ("Оценить" or stats)
- [ ] **NO inline stars** in card

### Pill Behavior
- [ ] Shows `⭐ X.Y/5 • N отзывов` (single line)
- [ ] On narrow: switches to multiline
- [ ] Clickable (opens modal)

### Footer Button
- [ ] Primary color, no background
- [ ] Shows stats or "Оценить"
- [ ] Clickable (opens modal)

## Modal Checks

### Opening
- [ ] Clicks pill → modal opens
- [ ] Clicks footer → modal opens
- [ ] Smooth slide animation
- [ ] No errors in console

### Header (Card Preview)
- [ ] Cover image visible
- [ ] Title, author, description
- [ ] Rating stats
- [ ] NO action buttons

### Body (Reviews)
- [ ] Scrollable list
- [ ] Shows existing reviews
- [ ] OR "Отзывов пока нет"
- [ ] Visible while filling form

### Footer (Form)
- [ ] 5 clickable stars
- [ ] Textarea (≤300 chars)
- [ ] Submit button
- [ ] Sticky at bottom

### Submit Behavior
- [ ] Select star → becomes active
- [ ] Type text (optional)
- [ ] Click submit
- [ ] Button: "Отправка..."
- [ ] Reviews update
- [ ] Form resets
- [ ] **Modal stays open**
- [ ] Can add another review

### Console
- [ ] No NotFoundError
- [ ] No other errors

## Responsive
- [ ] Desktop: pill single-line
- [ ] Mobile: pill multiline if needed
- [ ] All elements fit viewport

## Success Criteria ✅
- Minimal visual changes
- Dynamic pill layout
- Working modal with preview + list + form
- No runtime errors
- Reviews visible during submission
- Modal doesn't close on submit

**Status: Ready for Manual Testing**
