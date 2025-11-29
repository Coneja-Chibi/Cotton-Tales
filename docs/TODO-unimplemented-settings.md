# Cotton-Tales: Unimplemented Settings & UI Elements

This document tracks all placeholder/dummy settings found by the settings reviewer.

**Last Updated:** 2024-11-28

---

## HIGH PRIORITY - User-Facing Features

### 1. Stage Composer Button
- **Location:** `settings-panel.js:1290`
- **Current:** Shows "Coming soon!" toast
- **Needed:** Modal for visually arranging characters, previewing scenes
- **Status:** ⏳ FUTURE FEATURE

### 2. PRT Layout Mode
- **Location:** `settings-panel.js:620`
- **Current:** Disabled option with "Coming Soon" text
- **Needed:** Portrait-style layout with side panels
- **Status:** ⏳ FUTURE FEATURE

### 3. Add Character/NPC Button (Settings Panel) ✅ IMPLEMENTED
- **Location:** `settings-panel.js:1097`
- **Current:** ~~Shows "Coming soon!" toast~~ Connected to NPC modal
- **Needed:** ~~Connect to NPC creation modal~~
- **Status:** ✅ COMPLETE

### 4. NPC Carousel Loading ✅ IMPLEMENTED
- **Location:** `settings-panel.js:1049`
- **Current:** ~~TODO comment, NPCs not loaded~~ NPCs load from cardNpcs
- **Needed:** ~~Load from `settings.cardNpcs[cardId]`~~
- **Status:** ✅ COMPLETE

---

## MEDIUM PRIORITY - Upload Functionality

### 5. Upload Background Button ✅ IMPLEMENTED
- **Location:** `settings-panel.js:595`
- **Current:** ~~Button exists, no handler bound~~ Handler via upload-manager.js
- **Needed:** ~~File upload to `/api/backgrounds/upload`~~
- **Status:** ✅ COMPLETE

### 6. Upload Sprite Button ✅ IMPLEMENTED
- **Location:** `settings-panel.js:985`
- **Current:** ~~Button exists, no handler~~ Handler via upload-manager.js
- **Needed:** ~~Single sprite upload with expression input~~
- **Status:** ✅ COMPLETE

### 7. Upload Pack Button ✅ IMPLEMENTED
- **Location:** `settings-panel.js:989`
- **Current:** ~~Button exists, no handler~~ Handler via upload-manager.js
- **Needed:** ~~ZIP upload to `/api/sprites/upload-zip`~~
- **Status:** ✅ COMPLETE

### 8. Add Expression (Sprite Manager) ✅ IMPLEMENTED
- **Location:** `sprite-manager.js:692`
- **Current:** ~~Shows info toast only~~ File picker + expression name
- **Needed:** ~~File picker + expression name input~~
- **Status:** ✅ COMPLETE

### 9. Add Costume Button
- **Location:** `settings-panel.js:966`
- **Current:** Button rendered, no handler
- **Needed:** Input modal for costume name, create folder
- **Status:** ⏳ PENDING

---

## MEDIUM PRIORITY - Expression Preview

### 10. Expression Preview Modal
- **Location:** `sprite-manager.js:696`
- **Current:** Logs to console, shows toast
- **Needed:** Large preview modal with sprite navigation
- **Status:** ⏳ PENDING (non-critical)

---

## LOW PRIORITY - Missing Setting UI Bindings

### 11. Choice Animation Setting ✅ IMPLEMENTED
- **In:** `default-settings.js:76` as `choiceAnimation`
- **Missing:** ~~No selector in Scenes tab~~ Selector added
- **Status:** ✅ COMPLETE

### 12. Background Transition Duration ✅ IMPLEMENTED
- **In:** `default-settings.js:152` as `backgroundTransitionDuration`
- **Missing:** ~~No slider in Scenes tab~~ Slider added
- **Status:** ✅ COMPLETE

### 13. VectHare Use Provider Toggle ✅ IMPLEMENTED
- **In:** `default-settings.js:136` as `vecthareUseProvider`
- **Missing:** ~~No toggle in Expressions tab~~ Toggle added
- **Status:** ✅ COMPLETE

### 14. Custom Schema Prompt
- **In:** `default-settings.js:162` as `customSchemaPrompt`
- **Missing:** No textarea in settings
- **Status:** ⏳ DEFERRED (needs design decision)

---

## FUTURE - Phase 6 Features

### 15. Audio Settings Tab
- **In:** `default-settings.js:165-178`
- **Settings:** `audioEnabled`, `masterVolume`, `musicVolume`, `sfxVolume`
- **Missing:** Entire Audio tab not implemented
- **Status:** ⏳ PHASE 6

---

## COSMETIC

### 16. Window Control Buttons
- **Location:** `settings-panel.js:184-189`
- **Current:** Only Close button works
- **Needed:** Minimize/Maximize functionality (low priority)
- **Status:** ⏳ LOW PRIORITY

---

## Summary

| Category | Total | Complete | Pending |
|----------|-------|----------|---------|
| High Priority | 4 | 2 | 2 |
| Upload Functionality | 5 | 4 | 1 |
| Expression Preview | 1 | 0 | 1 |
| Setting Bindings | 4 | 3 | 1 |
| Future Features | 1 | 0 | 1 |
| Cosmetic | 1 | 0 | 1 |
| **TOTAL** | **16** | **9** | **7** |
