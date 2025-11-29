# Cotton-Tales: Unimplemented Settings & UI Elements

This document tracks all placeholder/dummy settings found by the settings reviewer.

---

## HIGH PRIORITY - User-Facing Features

### 1. Stage Composer Button
- **Location:** `settings-panel.js:1290`
- **Current:** Shows "Coming soon!" toast
- **Needed:** Modal for visually arranging characters, previewing scenes

### 2. PRT Layout Mode
- **Location:** `settings-panel.js:620`
- **Current:** Disabled option with "Coming Soon" text
- **Needed:** Portrait-style layout with side panels

### 3. Add Character/NPC Button (Settings Panel)
- **Location:** `settings-panel.js:1097`
- **Current:** Shows "Coming soon!" toast
- **Needed:** Connect to NPC creation modal

### 4. NPC Carousel Loading
- **Location:** `settings-panel.js:1049`
- **Current:** TODO comment, NPCs not loaded
- **Needed:** Load from `settings.cardNpcs[cardId]`

---

## MEDIUM PRIORITY - Upload Functionality

### 5. Upload Background Button
- **Location:** `settings-panel.js:595`
- **Current:** Button exists, no handler bound
- **Needed:** File upload to `/api/backgrounds/upload`

### 6. Upload Sprite Button
- **Location:** `settings-panel.js:985`
- **Current:** Button exists, no handler
- **Needed:** Single sprite upload with expression input

### 7. Upload Pack Button
- **Location:** `settings-panel.js:989`
- **Current:** Button exists, no handler
- **Needed:** ZIP upload to `/api/sprites/upload-zip`

### 8. Add Expression (Sprite Manager)
- **Location:** `sprite-manager.js:692`
- **Current:** Shows info toast only
- **Needed:** File picker + expression name input

### 9. Add Costume Button
- **Location:** `settings-panel.js:966`
- **Current:** Button rendered, no handler
- **Needed:** Input modal for costume name, create folder

---

## MEDIUM PRIORITY - Expression Preview

### 10. Expression Preview Modal
- **Location:** `sprite-manager.js:696`
- **Current:** Logs to console, shows toast
- **Needed:** Large preview modal with sprite navigation

---

## LOW PRIORITY - Missing Setting UI Bindings

### 11. Choice Animation Setting
- **In:** `default-settings.js:76` as `choiceAnimation`
- **Missing:** No selector in Scenes tab

### 12. Background Transition Duration
- **In:** `default-settings.js:152` as `backgroundTransitionDuration`
- **Missing:** No slider in Scenes tab

### 13. VectHare Use Provider Toggle
- **In:** `default-settings.js:136` as `vecthareUseProvider`
- **Missing:** No toggle in Expressions tab

### 14. Custom Schema Prompt
- **In:** `default-settings.js:162` as `customSchemaPrompt`
- **Missing:** No textarea in settings

---

## FUTURE - Phase 6 Features

### 15. Audio Settings Tab
- **In:** `default-settings.js:165-178`
- **Settings:** `audioEnabled`, `masterVolume`, `musicVolume`, `sfxVolume`
- **Missing:** Entire Audio tab not implemented

---

## COSMETIC

### 16. Window Control Buttons
- **Location:** `settings-panel.js:184-189`
- **Current:** Only Close button works
- **Needed:** Minimize/Maximize functionality (low priority)
