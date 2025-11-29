# Cotton-Tales: Major Feature Implementation Tracker

This document tracks the major feature suites that need implementation.

---

## FEATURE 1: Upload System
**Reference Doc:** `01-sprite-upload-implementation.md`

### Components:
- [ ] Create `core/upload-manager.js` module
- [ ] Implement `uploadSprite()` function
- [ ] Implement `uploadSpritePackage()` function
- [ ] Implement `uploadBackground()` function
- [ ] Bind Upload Sprite button in settings-panel.js
- [ ] Bind Upload Pack button in settings-panel.js
- [ ] Bind Upload Background button in settings-panel.js
- [ ] Replace `addExpression()` in sprite-manager.js
- [ ] Add cache invalidation after uploads
- [ ] Test all upload flows

---

## FEATURE 2: Expression Classification Profiles
**Reference Doc:** `02-expression-classification-profiles.md`

### Components:
- [ ] Add `customExpressionMappings` to default-settings.js
- [ ] Add `characterExpressionProfiles` to default-settings.js
- [ ] Show model's labelList when Local BERT selected
- [ ] Add custom expression mapping UI for LLM/WebLLM
- [ ] Implement `getAvailableExpressions(api, model)` function
- [ ] Implement `resolveExpressionToSprite()` function
- [ ] Update `getExpressionLabel()` to accept character parameter
- [ ] Add per-character profile selector UI
- [ ] Dynamic show/hide of expression options based on API

---

## FEATURE 3: NPC System
**Reference Doc:** `03-npc-system-implementation.md`

### Components:
- [ ] Create enhanced Add NPC modal (full form)
- [ ] Implement Edit NPC functionality
- [ ] Implement Delete NPC with confirmation
- [ ] Load NPCs in `populateCharacterCarousel()`
- [ ] Display NPC cards with NPC badge
- [ ] Connect "Add NPC" button in settings-panel to modal
- [ ] Add NPC trigger detection in messages
- [ ] Display NPC sprites in VN mode
- [ ] Implement outfit trigger detection
- [ ] Save/load NPC data per card

---

## FEATURE 4: VectHare Semantic Emotions
**Reference Doc:** `04-vecthare-semantic-emotions.md`

### Components:
- [ ] Add `customEmotions` to default-settings.js
- [ ] Add `characterEmotions` to default-settings.js
- [ ] Implement `calculateKeywordBoost()` function
- [ ] Update `classifyWithVectHare()` with custom emotion support
- [ ] Add "Custom Emotions" tab to settings modal
- [ ] Create custom emotion card component
- [ ] Create add/edit emotion modal with keyword management
- [ ] Add character-specific emotion section
- [ ] Implement sprite mapping for custom emotions

---

## FEATURE 5: Missing Setting Bindings
**Reference Doc:** `TODO-unimplemented-settings.md` (items 11-14)

### Components:
- [ ] Add Choice Animation selector to Scenes tab
- [ ] Add Background Transition Duration slider to Scenes tab
- [ ] Add VectHare Use Provider toggle to Expressions tab
- [ ] Add Custom Schema Prompt textarea

---

## Implementation Order

1. **Upload System** - Foundation for loading sprites
2. **NPC System** - Enables multi-character management
3. **Expression Classification Profiles** - Dynamic expression options
4. **VectHare Semantic Emotions** - Advanced classification
5. **Missing Setting Bindings** - Polish/completion
