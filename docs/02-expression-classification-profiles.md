# Cotton-Tales: Expression Classification Profiles Implementation

## Overview

This document details how expression classification works with different API profiles and how to make expression options dynamic based on the selected classification method.

---

## 1. Classification APIs & Label Constraints

| API | Enum Value | Label Source | Constraint |
|-----|------------|--------------|------------|
| **LOCAL** | 0 | CLASSIFIER_MODELS[model].labelList | Fixed to model's labels (6-28) |
| **EXTRAS** | 1 | Extras server | Fixed to server's trained labels |
| **LLM** | 2 | User-defined | **UNLOCKED** - any custom expressions |
| **WEBLLM** | 3 | User-defined | **UNLOCKED** - any custom expressions |
| **VECTHARE** | 4 | Semantic matching | **UNLOCKED** - requires metadata |
| **NONE** | 99 | Fallback only | N/A |

---

## 2. Classifier Models (Local BERT)

**From `constants.js` CLASSIFIER_MODELS:**

| Model ID | Name | Labels | Label List |
|----------|------|--------|------------|
| `roberta_go_emotions` | RoBERTa GoEmotions | 28 | admiration, amusement, anger, annoyance, approval, caring, confusion, curiosity, desire, disappointment, disapproval, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise, neutral |
| `distilroberta_dialogue` | DistilRoBERTa Dialogue | 7 | anger, disgust, fear, joy, neutral, sadness, surprise |
| `bert_emotion_rp` | BERT Emotion (RP) | 13 | anger, disgust, fear, guilt, joy, love, sadness, shame, surprise, desire, sarcasm, neutral, embarrassment |
| `distilbert_high_accuracy` | DistilBERT | 6 | sadness, joy, love, anger, fear, surprise |
| `emoberta_dialogue` | EmoBERTa Large | 7 | neutral, joy, surprise, anger, sadness, disgust, fear |

---

## 3. Dynamic Expression Options UI

### 3.1 Show/Hide Based on API Selection

**In `settings-panel.js` bindEvents():**

```javascript
apiSelect?.addEventListener('change', (e) => {
    const api = parseInt(e.target.value, 10);
    updateSetting('expressionApi', api);

    // Show/hide sections based on API
    const showLlm = api === EXPRESSION_API.llm;
    const showVecthare = api === EXPRESSION_API.vecthare;
    const showLocal = api === EXPRESSION_API.local;
    const showCustomExpressions = api === EXPRESSION_API.llm || api === EXPRESSION_API.webllm;

    if (llmSettings) llmSettings.style.display = showLlm ? 'block' : 'none';
    if (vecthareSettings) vecthareSettings.style.display = showVecthare ? 'block' : 'none';
    if (localClassifierSettings) localClassifierSettings.style.display = showLocal ? 'block' : 'none';
    if (customExpressionSection) customExpressionSection.style.display = showCustomExpressions ? 'block' : 'none';

    // Update available expressions list
    updateAvailableExpressionsList(api);
});
```

### 3.2 Get Available Expressions by API

```javascript
function getAvailableExpressions(api, classifierModel = null) {
    switch (api) {
        case EXPRESSION_API.local:
            // Return model's fixed label list
            const model = CLASSIFIER_MODELS[classifierModel || 'roberta_go_emotions'];
            return model?.labelList || DEFAULT_EXPRESSIONS;

        case EXPRESSION_API.extras:
            // Return Extras server's labels (fetch from /api/extra/classify/labels)
            return fetchExtrasLabels();

        case EXPRESSION_API.llm:
        case EXPRESSION_API.webllm:
            // Unlocked - return all available + custom
            return [...DEFAULT_EXPRESSIONS, ...getCustomExpressions()];

        case EXPRESSION_API.vecthare:
            // Return configured labels + custom with metadata
            return [...DEFAULT_EXPRESSIONS, ...getVectHareCustomLabels()];

        case EXPRESSION_API.none:
        default:
            return ['neutral'];
    }
}
```

---

## 4. Custom Expression Mapping (LLM Mode)

### 4.1 Storage Structure

**Add to `default-settings.js`:**

```javascript
// Custom expression mappings for LLM/WebLLM modes
customExpressionMappings: [
    // { label: 'custom_emotion_name', spriteLabel: 'existing_sprite_label' }
],

// Per-character expression profiles
characterExpressionProfiles: {
    // [characterFolder]: {
    //     classificationApi: EXPRESSION_API value,
    //     classifierModel: modelId,
    //     customExpressions: [{ label, spriteLabel, metadata }]
    // }
}
```

### 4.2 UI for Custom Expression Entry

**Add to Expressions Tab HTML:**

```html
<!-- Custom Expression Mapping (shown when API = LLM/WEBLLM) -->
<div id="ct_custom_expressions_section" style="display: none;">
    <div class="ct-section-label">
        <i class="fa-solid fa-sparkles"></i>
        Custom Expression Mapping
    </div>

    <p style="font-size: 11px; color: var(--ct-text-light); margin-bottom: 12px;">
        Map custom emotion labels to available sprites. The LLM can output these labels.
    </p>

    <!-- Character Scope -->
    <div class="ct-slider-row">
        <div class="ct-slider-header">
            <span class="ct-slider-label">Apply to</span>
        </div>
        <select class="ct-select" id="ct_custom_expr_scope">
            <option value="global">All Characters</option>
            <!-- Populated with character options -->
        </select>
    </div>

    <!-- Mapping Table -->
    <div id="ct_custom_expr_list" class="ct-mapping-table">
        <!-- Populated by JS -->
    </div>

    <button class="ct-btn secondary" id="ct_add_custom_expr">
        <i class="fa-solid fa-plus"></i>
        Add Custom Expression
    </button>
</div>
```

### 4.3 Event Binding for Custom Expressions

```javascript
// Add custom expression row
document.getElementById('ct_add_custom_expr')?.addEventListener('click', () => {
    const container = document.getElementById('ct_custom_expr_list');
    const availableSprites = getAvailableSpriteLabels(); // From sprite cache

    const row = document.createElement('div');
    row.className = 'ct-custom-expr-row';
    row.innerHTML = `
        <input type="text" class="ct-input ct-expr-label" placeholder="e.g., smug">
        <select class="ct-select ct-expr-sprite">
            <option value="">-- Map to Sprite --</option>
            ${availableSprites.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <button class="ct-btn-icon danger ct-remove-expr">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;

    container.appendChild(row);

    // Bind remove button
    row.querySelector('.ct-remove-expr').addEventListener('click', () => {
        row.remove();
        saveCustomExpressionMappings();
    });

    // Bind change events
    row.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', saveCustomExpressionMappings);
    });
});

function saveCustomExpressionMappings() {
    const scope = document.getElementById('ct_custom_expr_scope')?.value || 'global';
    const rows = document.querySelectorAll('.ct-custom-expr-row');

    const mappings = Array.from(rows).map(row => ({
        label: row.querySelector('.ct-expr-label').value.toLowerCase().trim(),
        spriteLabel: row.querySelector('.ct-expr-sprite').value
    })).filter(m => m.label && m.spriteLabel);

    if (scope === 'global') {
        updateSetting('customExpressionMappings', mappings);
    } else {
        const profiles = getSettings().characterExpressionProfiles || {};
        profiles[scope] = profiles[scope] || {};
        profiles[scope].customExpressions = mappings;
        updateSetting('characterExpressionProfiles', profiles);
    }
}
```

---

## 5. Integration with getExpressionLabel()

### 5.1 Enhanced Function Signature

```javascript
async function getExpressionLabel(text, apiOverride = null, characterFolder = null) {
    const settings = getSettings();

    // Check for character-specific profile
    let api = apiOverride ?? settings.expressionApi ?? EXPRESSION_API.local;
    let classifierModel = settings.classifierModel;

    if (characterFolder && settings.characterExpressionProfiles?.[characterFolder]) {
        const profile = settings.characterExpressionProfiles[characterFolder];
        api = profile.classificationApi ?? api;
        classifierModel = profile.classifierModel ?? classifierModel;
    }

    // Get available labels for this API
    const availableLabels = getAvailableExpressions(api, classifierModel);

    // ... classification logic using availableLabels ...
}
```

### 5.2 Map Custom Expression to Sprite

```javascript
function resolveExpressionToSprite(expression, characterFolder) {
    const settings = getSettings();

    // Check character-specific mapping first
    const charProfile = settings.characterExpressionProfiles?.[characterFolder];
    const charMapping = charProfile?.customExpressions?.find(m => m.label === expression);
    if (charMapping) return charMapping.spriteLabel;

    // Check global mapping
    const globalMapping = settings.customExpressionMappings?.find(m => m.label === expression);
    if (globalMapping) return globalMapping.spriteLabel;

    // Return original expression (assume sprite exists with that name)
    return expression;
}
```

---

## 6. Model-Locked Expression Display

### 6.1 Show Available Expressions for Selected Model

```javascript
function updateModelExpressionDisplay(modelId) {
    const model = CLASSIFIER_MODELS[modelId];
    if (!model) return;

    const container = document.getElementById('ct_model_expressions');
    if (!container) return;

    container.innerHTML = `
        <div class="ct-expression-chips">
            ${model.labelList.map(label => `
                <span class="ct-expression-chip">${label}</span>
            `).join('')}
        </div>
        <p style="font-size: 10px; color: var(--ct-text-light); margin-top: 8px;">
            This model can only classify into these ${model.labels} expressions.
            Sprites should be named to match these labels.
        </p>
    `;
}

// Bind to model selector
document.getElementById('ct_classifier_model')?.addEventListener('change', (e) => {
    updateSetting('classifierModel', e.target.value);
    updateModelExpressionDisplay(e.target.value);
});
```

### 6.2 CSS for Expression Chips

```css
.ct-expression-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.ct-expression-chip {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 10px;
    color: var(--ct-text-light);
}
```

---

## 7. Per-Character Profile UI

### 7.1 Character Profile Section

```html
<div class="ct-section-label" style="margin-top: 24px;">
    <i class="fa-solid fa-user-gear"></i>
    Per-Character Settings
</div>

<div class="ct-slider-row">
    <div class="ct-slider-header">
        <span class="ct-slider-label">Select Character</span>
    </div>
    <select class="ct-select" id="ct_char_profile_select">
        <option value="">-- Select Character --</option>
        <!-- Populated with available characters -->
    </select>
</div>

<div id="ct_char_profile_settings" style="display: none;">
    <!-- Classification API Override -->
    <div class="ct-slider-row">
        <div class="ct-slider-header">
            <span class="ct-slider-label">Classification API</span>
        </div>
        <select class="ct-select" id="ct_char_expr_api">
            <option value="">Use Global Setting</option>
            <option value="0">Local (BERT)</option>
            <option value="2">LLM</option>
            <option value="4">VectHare</option>
        </select>
    </div>

    <!-- Model Override (if Local) -->
    <div class="ct-slider-row" id="ct_char_model_row" style="display: none;">
        <div class="ct-slider-header">
            <span class="ct-slider-label">Classifier Model</span>
        </div>
        <select class="ct-select" id="ct_char_classifier_model">
            <!-- Populated with CLASSIFIER_MODELS -->
        </select>
    </div>

    <!-- Custom Expressions for this character -->
    <div id="ct_char_custom_expr_section">
        <!-- Custom expression mapping UI specific to this character -->
    </div>

    <button class="ct-btn" id="ct_save_char_profile">
        <i class="fa-solid fa-save"></i>
        Save Character Profile
    </button>
</div>
```

---

## 8. Diagnostics Checks

| Check | What to Validate | Fix |
|-------|------------------|-----|
| Model Label Match | Selected model's labelList exists | Reset to default model |
| Sprite Availability | Expression labels have matching sprites | Warn user, show missing |
| Custom Mapping Valid | All custom labels have sprite mappings | Remove invalid mappings |
| Character Profile Valid | Referenced character folder exists | Clean up stale profiles |
| API Availability | Selected API is available (Extras, VectHare) | Fall back to Local |

---

## 9. Implementation Checklist

### Phase 1: Foundation
- [ ] Add `customExpressionMappings` to default-settings.js
- [ ] Add `characterExpressionProfiles` to default-settings.js
- [ ] Add validators to settings-manager.js

### Phase 2: UI
- [ ] Add custom expressions section to Expressions tab
- [ ] Show/hide based on API selection
- [ ] Add expression chip display for locked models
- [ ] Add per-character profile selector

### Phase 3: Integration
- [ ] Update `getExpressionLabel()` to accept character parameter
- [ ] Add `resolveExpressionToSprite()` function
- [ ] Update all callers to pass character context

### Phase 4: Validation
- [ ] Add diagnostic checks
- [ ] Validate custom expression labels
- [ ] Warn on missing sprites
