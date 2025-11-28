# Cotton-Tales Documentation Index

## Design Review Documents

### 1. **review-html.md** - Current Cozy Aesthetic
- Existing HTML structure documentation
- Decorative element catalog
- Current CSS class naming convention
- Templates for the ornate pixel-art style

### 2. **review-css.md** - Cozy Styling
- Color palette for warm, cozy theme
- Decorative border patterns
- Animation styles (sparkles, floats)
- Complete CSS implementation for game-style UI

### 3. **review-javascript.md** - DOM Injection Patterns
- Detection methods for landing page vs active chat
- ST event listening patterns
- Safe DOM injection techniques
- JavaScript helper functions

### 4. **redesign-html.md** - NEW: Sleek OS Redesign (472 lines)
Modern, clean landing page design replacing ornate aesthetic.

## Redesign Document Contents

### Key Sections:
1. **Executive Summary** - What changes and why
2. **Current Structure Analysis** - What we're working with
3. **Modern OS Design Patterns** - Title bars, cards, minimal chrome
4. **New HTML Elements** - Classes to remove vs add
5. **Accessibility Foundation** - Focus states, contrast, reduced motion
6. **Modern Card Structure** - Complete semantic HTML example
7. **Title Bar** - macOS/Windows 11 style header
8. **Navigation Bar** - Semantic nav with proper structure
9. **Empty State** - Icon + title + CTA pattern
10. **Complete Landing Page Structure** - Full template example
11. **Implementation Checklist** - 6-phase rollout plan
12. **CSS Class Strategy** - What to keep/remove/add
13. **Data Attributes** - For styling and JS hooks
14. **Migration Guide** - Before/after examples
15. **Future-Proofing** - CSS variable system

## Key Changes from Cozy to Sleek

### HTML Structure
- Remove: 25+ decorative CSS classes (corners, sparkles, paws, flowers)
- Remove: Over-nested decorative frames (7 DOM nodes → 3-4 per card)
- Add: Semantic HTML5 elements (`<article>`, `<figure>`, `<time>`, `<nav>`)
- Add: Proper ARIA labels and accessibility attributes

### Design Pattern
- From: Ornate pixel-art frames with decorative borders/corners
- To: Clean modern cards with subtle shadows and status badges

### Components
| Element | Cozy | Sleek |
|---------|------|-------|
| Title Bar | Flowers + decorations | Minimal header (logo + title + version) |
| Cards | Thick borders + corner ornaments | Clean rounded cards with soft shadow |
| Avatar | 4 corner divs + frame | Simple figure with image |
| Status | Save badge number | Type indicator (single/group) |
| Navigation | Decorative separators | Semantic `<nav>` with proper divider |
| Empty State | Flowers and decorative text | Icon + title + CTA |
| Effects | Glowing divs + sparkles | CSS-only (::after, shadows) |

## CSS Class Naming

### Remove (Cozy - 25+ classes)
- `ct-corner*` (4 corner decorations)
- `ct-border*` (decorative borders)
- `ct-pixel-sparkle*` (sparkle animations)
- `ct-paw*`, `ct-flower` (decorations)
- `ct-save-badge*` (save number badge)
- `ct-avatar-frame`, `ct-frame-corner*` (nested frames)
- `ct-card-glow` (separate glow element)
- And 10+ others

### Add (Sleek - Modern OS style)
**Layout**: `ct-landing-viewport`, `ct-viewport-background`, `ct-content-wrapper`

**Header**: `ct-os-titlebar`, `ct-titlebar-left`, `ct-titlebar-right`, `ct-logo`, `ct-app-title`, `ct-version-badge`

**Navigation**: `ct-navigation`, `ct-nav-list`, `ct-nav-link`, `ct-nav-label`, `ct-nav-divider`

**Cards**: `ct-chat-card`, `ct-card-header`, `ct-card-content`, `ct-card-actions`

**Status**: `ct-status-badge`, `ct-status-single`, `ct-status-group`, `ct-metadata`, `ct-timestamp`

**Content**: `ct-avatar-section`, `ct-avatar`, `ct-chat-title`, `ct-chat-name`, `ct-preview-text`, `ct-stats-row`

**Effects (CSS)**: `ct-glass-effect`, `ct-glow-accent`, `ct-shadow-lifted`, `ct-shadow-soft`

**Accessibility**: `ct-sr-only`

**Empty**: `ct-empty-state`, `ct-empty-content`, `ct-empty-icon`, `ct-empty-title`, `ct-empty-description`

## Accessibility Improvements

### Focus States
- Old: Heavy borders
- New: `outline: 2px solid accent; outline-offset: 2px;`

### Color Contrast
- Text primary: #ffffff (21:1 on dark) ✓ WCAG AAA
- Text secondary: #b8b5c3 (10.2:1 on dark) ✓ WCAG AAA
- Accent colors: 4.5+ ratio minimum ✓ WCAG AA

### Reduced Motion
Respects `prefers-reduced-motion: reduce` media query

### Screen Readers
- Decorative icons: `aria-hidden="true"`
- Cards: Comprehensive `aria-label`
- Semantic elements: `<time>`, `<figure>`, `<article>`

## Implementation Phases

1. **Phase 1** - HTML Structure (remove decorative classes)
2. **Phase 2** - Navigation Updates (semantic nav)
3. **Phase 3** - Title Bar Redesign (modern header)
4. **Phase 4** - Empty State (icon + CTA)
5. **Phase 5** - CSS Updates (separate document)
6. **Phase 6** - Testing & Validation (keyboard, screen readers, mobile)

## File Location
📍 `/Cotton-Tales/docs/redesign-html.md`

## Next Steps
1. Review this HTML redesign specification
2. Create companion CSS redesign document (color palette, shadows, effects)
3. Create JavaScript updates for semantic HTML handling
4. Implement Phase 1-4 changes
5. Test comprehensively (keyboard, screen readers, mobile, responsive)
6. Update documentation with migration guide
