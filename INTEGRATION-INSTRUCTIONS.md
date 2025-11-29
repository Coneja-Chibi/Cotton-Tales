# Custom Emotions Integration Instructions

## Overview
The custom emotions feature has been implemented in separate modules. This file contains instructions for integrating it into `settings-panel.js`.

## Files Created/Modified

### Created:
- `ui/custom-emotions-ui.js` - Complete custom emotions UI module
- `core/default-settings.js` - Added custom emotion settings
- `ct-expressions.js` - Enhanced VectHare classification with custom emotions

### To Modify:
- `ui/settings-panel.js` - Add imports and integrate custom emotions tab

## Integration Steps for settings-panel.js

### Step 1: Add Import
At the top of `ui/settings-panel.js`, add this import after the existing imports:

```javascript
import { getCustomEmotionsTabHTML, bindCustomEmotionEvents } from './custom-emotions-ui.js';
```

### Step 2: Add Custom Emotions Sidebar Button
In the `getModalHTML()` function, find the sidebar section with the "Expressions" button and add the Custom Emotions button after it:

```javascript
<button class="ct-sidebar-item" data-tab="expressions" id="ct-sidebar-expressions" role="tab" aria-selected="false" aria-controls="ct-tab-expressions">
    <i class="fa-solid fa-face-smile" aria-hidden="true"></i>
    <span>Expressions</span>
</button>
<!-- ADD THIS BUTTON: -->
<button class="ct-sidebar-item" data-tab="custom_emotions" id="ct-sidebar-custom-emotions" role="tab" aria-selected="false" aria-controls="ct-tab-custom-emotions">
    <i class="fa-solid fa-sparkles" aria-hidden="true"></i>
    <span>Custom Emotions</span>
</button>
<button class="ct-sidebar-item" data-tab="backgrounds" id="ct-sidebar-backgrounds" role="tab" aria-selected="false" aria-controls="ct-tab-backgrounds">
    <i class="fa-solid fa-image" aria-hidden="true"></i>
    <span>Backgrounds</span>
</button>
```

### Step 3: Add Custom Emotions Tab Content
In the `getModalHTML()` function, find where the tab content is defined (after Expressions tab) and add:

```javascript
<!-- Expressions Tab -->
<div class="ct-modal-tab" data-tab="expressions" id="ct-tab-expressions" role="tabpanel" aria-labelledby="ct-sidebar-expressions">
    ${getExpressionsTabHTML()}
</div>

<!-- ADD THIS TAB: -->
<!-- Custom Emotions Tab -->
<div class="ct-modal-tab" data-tab="custom_emotions" id="ct-tab-custom-emotions" role="tabpanel" aria-labelledby="ct-sidebar-custom-emotions">
    ${getCustomEmotionsTabHTML()}
</div>

<!-- Backgrounds Tab -->
<div class="ct-modal-tab" data-tab="backgrounds" id="ct-tab-backgrounds" role="tabpanel" aria-labelledby="ct-sidebar-backgrounds">
    ${getBackgroundsTabHTML()}
</div>
```

### Step 4: Bind Custom Emotion Events
In the `bindModalEvents()` function, add this call after the sidebar navigation bindings (around line 1627):

```javascript
// Bind all the rest of the events (only once per session to avoid leaks)
if (!modalEventsBound) {
    bindEvents();
    // ADD THIS LINE:
    bindCustomEmotionEvents();
    modalEventsBound = true;
}
```

## Testing the Integration

1. Open SillyTavern
2. Navigate to Extensions > Cotton-Tales
3. Click "Open Settings Panel"
4. Verify the "Custom Emotions" tab appears in the sidebar between "Expressions" and "Backgrounds"
5. Click the tab to verify it loads correctly
6. Test creating a custom emotion:
   - Click "Add Custom Emotion"
   - Fill in:
     - Name: `smug`
     - Base Emotions: Check `pride` and `amusement`
     - Description: `smugly confident, self-satisfied, arrogant smirk, knowing superiority`
     - Add keywords: `smirk` (1.5), `sneer` (1.4)
   - Save and verify it appears in the list

7. Test VectHare classification with custom emotion:
   - Set Expression API to "VectHare Semantic"
   - Send a message containing "smirk" or related keywords
   - Check console logs to see if custom emotion is matched

## Troubleshooting

### Issue: Tab doesn't appear
- Verify the sidebar button was added correctly
- Check browser console for import errors

### Issue: Custom emotions don't save
- Check that `customEmotions` exists in settings
- Verify `updateSetting` is being called correctly

### Issue: Custom emotions don't classify
- Ensure VectHare extension is installed
- Verify Expression API is set to "VectHare Semantic" (API value 4)
- Check console logs for classification debug output

## Architecture Notes

The custom emotions system works as follows:

1. **Storage**: Custom emotions are stored in two places:
   - `settings.customEmotions` - Global custom emotions (apply to all characters)
   - `settings.characterEmotions[charFolder].customEmotions` - Character-specific emotions

2. **Classification Flow**:
   - When `classifyWithVectHare()` is called, it loads both global and character-specific custom emotions
   - It generates embeddings for both standard emotions (from DEFAULT_EXPRESSIONS) and custom emotions
   - For each emotion, it computes cosine similarity between the text and emotion description
   - For custom emotions, it applies keyword boosts by multiplying the similarity score
   - The emotion with the highest score wins
   - If a custom emotion wins, it returns the first base emotion from `baseEmotions[]`

3. **Keyword Boosts**:
   - Keywords are case-insensitive substring matches
   - Boost scores multiply together (e.g., if "smirk" (1.5x) and "sneer" (1.4x) both match, total boost is 2.1x)
   - Boosts >1.0 increase likelihood, <1.0 decrease likelihood

4. **Character-Specific Mappings**:
   - Character-specific custom emotions override global ones with the same name
   - Optional sprite mappings allow custom emotions to map to specific sprite labels per character
   - Stored in `settings.characterEmotions[charFolder].spriteEmotionMap`
