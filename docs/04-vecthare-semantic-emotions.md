# Cotton-Tales: VectHare Semantic Emotion Enhancement

## Executive Summary

This document outlines enhanced VectHare integration for semantic emotion classification with custom definitions, trigger keywords with boost scores, and per-character configurations.

---

## 1. Current VectHare Classification Flow

**Location:** `ct-expressions.js` lines 955-1038

```javascript
async function classifyWithVectHare(text, labels) {
    // 1. Check availability
    if (!isVectHareAvailable()) return null;

    // 2. Try VectHare's dedicated classifier API
    if (isVectHareClassifierAvailable()) {
        const result = await classifierAPI.classifyEmotion(text);
        // Match against allowed labels
    }

    // 3. Use embedding similarity (fallback)
    const textEmbedding = await generateEmbedding(text);

    // 4. Get emotion embeddings using EMOTION_DESCRIPTIONS
    let emotionEmbeddings = {};
    for (const label of labels) {
        const description = EMOTION_DESCRIPTIONS[label] || label;
        const embedding = await generateEmbedding(description);
        emotionEmbeddings[label] = embedding;
    }

    // 5. Compute cosine similarity
    let bestLabel = null, bestScore = -Infinity;
    for (const [label, embedding] of Object.entries(emotionEmbeddings)) {
        const similarity = cosineSimilarity(textEmbedding, embedding);
        if (similarity > bestScore) {
            bestScore = similarity;
            bestLabel = label;
        }
    }

    return bestLabel;
}
```

---

## 2. EMOTION_DESCRIPTIONS (Current)

**Location:** `constants.js` lines 233-262

```javascript
export const EMOTION_DESCRIPTIONS = {
    admiration: 'feeling admiration, respect, awe, impressed, looking up to someone',
    amusement: 'feeling amused, entertained, finding something funny, laughing',
    anger: 'feeling angry, mad, furious, enraged, irritated',
    // ... 25 more emotions
    neutral: 'feeling neutral, calm, balanced, no strong emotion'
};
```

**Purpose:** Provides semantic text for embedding generation, enabling similarity matching beyond just emotion label names.

---

## 3. Custom Emotion Data Structure

### 3.1 Storage Format

**Add to `default-settings.js`:**

```javascript
// Global custom emotions
customEmotions: {
    // [emotionName]: CustomEmotionDefinition
},

// Per-character custom emotions
characterEmotions: {
    // [characterFolder]: {
    //     customEmotions: { [emotionName]: CustomEmotionDefinition },
    //     spriteEmotionMap: { [customEmotion]: spriteLabel }
    // }
},

// Threshold for custom emotion matching
customEmotionScoreThreshold: 0.5
```

### 3.2 CustomEmotionDefinition Interface

```javascript
{
    // Required
    baseEmotions: string[],      // Maps to existing labels (1-3 emotions)
    description: string,          // Semantic description for embedding

    // Optional
    keywords: {
        [keyword: string]: number // Boost score (>1.0 increases, <1.0 decreases)
    },
    enabled: boolean,

    // Metadata
    createdAt: number,
    characterSpecific: boolean
}
```

### 3.3 Example Custom Emotions

```javascript
customEmotions: {
    "smug": {
        baseEmotions: ["pride", "amusement"],
        description: "smugly confident, self-satisfied, arrogant smirk, knowing superiority",
        keywords: {
            "smirk": 1.5,
            "sneer": 1.4,
            "arrogant": 1.3,
            "confident": 1.2
        },
        enabled: true
    },
    "flustered": {
        baseEmotions: ["embarrassment", "nervousness"],
        description: "flustered, blushing, stammering, caught off guard, overwhelmed",
        keywords: {
            "blush": 1.5,
            "flushed": 1.5,
            "stammer": 1.3,
            "tongue-tied": 1.4
        },
        enabled: true
    },
    "tsundere": {
        baseEmotions: ["annoyance", "love"],
        description: "acting cold or hostile despite actual affection, tsundere behavior",
        keywords: {
            "tch": 2.0,
            "hmph": 1.8,
            "baka": 1.7,
            "idiot": 1.6,
            "it's not like": 1.5
        },
        enabled: true
    }
}
```

---

## 4. Keyword Boost Implementation

### 4.1 Boost Calculation Function

```javascript
/**
 * Apply keyword boosts to similarity score
 * @param {string} text - Input text to analyze
 * @param {Object} customDef - Custom emotion definition with keywords
 * @returns {number} Cumulative boost factor
 */
function calculateKeywordBoost(text, customDef) {
    if (!customDef?.keywords) return 1.0;

    const lowerText = text.toLowerCase();
    let boostFactor = 1.0;
    const matchedKeywords = [];

    for (const [keyword, boostScore] of Object.entries(customDef.keywords)) {
        if (lowerText.includes(keyword.toLowerCase())) {
            boostFactor *= boostScore;
            matchedKeywords.push(`${keyword}(${boostScore}x)`);
        }
    }

    if (matchedKeywords.length > 0) {
        console.debug(`[Cotton-Tales] Keyword boosts: ${matchedKeywords.join(', ')} = ${boostFactor.toFixed(2)}x`);
    }

    return boostFactor;
}
```

### 4.2 Apply Boost to Similarity Score

```javascript
// In enhanced classifyWithVectHare:
for (const [label, embedding] of Object.entries(emotionEmbeddings)) {
    let similarity = cosineSimilarity(textEmbedding, embedding);

    // Check if this is a custom emotion with keyword boosts
    const customDef = customEmotions[label] || characterCustomEmotions[label];
    if (customDef) {
        const boost = calculateKeywordBoost(text, customDef);
        similarity *= boost;
    }

    if (similarity > bestScore) {
        bestScore = similarity;
        bestLabel = label;
    }
}
```

---

## 5. Enhanced classifyWithVectHare()

```javascript
async function classifyWithVectHare(text, labels, charFolder = null) {
    const settings = getSettings();

    if (!isVectHareAvailable()) return null;

    // ========================================
    // Step 1: Try VectHare dedicated classifier
    // ========================================
    if (isVectHareClassifierAvailable()) {
        try {
            const result = await VectHareEmotionClassifier.classifyEmotion(text);
            if (result?.label && labels.includes(result.label.toLowerCase())) {
                return result.label.toLowerCase();
            }
        } catch (e) {
            console.debug('Classifier failed, using similarity');
        }
    }

    // ========================================
    // Step 2: Generate text embedding
    // ========================================
    const textEmbedding = await generateEmbedding(text);
    if (!textEmbedding) return null;

    // ========================================
    // Step 3: Get custom emotions
    // ========================================
    const globalCustom = settings.customEmotions || {};
    const charCustom = charFolder
        ? settings.characterEmotions?.[charFolder]?.customEmotions || {}
        : {};
    const allCustomEmotions = { ...globalCustom, ...charCustom };

    // ========================================
    // Step 4: Build emotion embeddings
    // ========================================
    const emotionEmbeddings = {};

    // Standard emotions from EMOTION_DESCRIPTIONS
    for (const label of labels) {
        const description = EMOTION_DESCRIPTIONS[label] || label;
        const embedding = await generateEmbedding(description);
        if (embedding) emotionEmbeddings[label] = { embedding, isCustom: false };
    }

    // Custom emotions
    for (const [name, def] of Object.entries(allCustomEmotions)) {
        if (!def.enabled) continue;
        const embedding = await generateEmbedding(def.description);
        if (embedding) {
            emotionEmbeddings[name] = {
                embedding,
                isCustom: true,
                definition: def
            };
        }
    }

    // ========================================
    // Step 5: Compute similarity with boosts
    // ========================================
    let bestLabel = null;
    let bestScore = -Infinity;
    let matchType = 'similarity';

    for (const [label, data] of Object.entries(emotionEmbeddings)) {
        let similarity = cosineSimilarity(textEmbedding, data.embedding);

        // Apply keyword boost for custom emotions
        if (data.isCustom && data.definition) {
            const boost = calculateKeywordBoost(text, data.definition);
            similarity *= boost;

            if (boost > 1.0) {
                matchType = 'keyword-boosted';
            }
        }

        if (similarity > bestScore) {
            bestScore = similarity;
            bestLabel = label;
        }
    }

    // ========================================
    // Step 6: Resolve custom emotion to sprite
    // ========================================
    if (allCustomEmotions[bestLabel]) {
        const customDef = allCustomEmotions[bestLabel];
        const resolvedLabel = customDef.baseEmotions[0];

        console.log(`[Cotton-Tales] Custom emotion: "${bestLabel}" → "${resolvedLabel}" (${matchType}, score: ${bestScore.toFixed(4)})`);

        // Check character-specific sprite mapping
        const spriteMap = settings.characterEmotions?.[charFolder]?.spriteEmotionMap;
        if (spriteMap?.[bestLabel]) {
            return spriteMap[bestLabel];
        }

        return labels.includes(resolvedLabel) ? resolvedLabel : null;
    }

    console.log(`[Cotton-Tales] VectHare: "${bestLabel}" (${matchType}, score: ${bestScore.toFixed(4)})`);
    return bestLabel;
}
```

---

## 6. UI Design: Custom Emotions Panel

### 6.1 Add to Settings Modal

**New Tab: "Custom Emotions"**

```html
<button class="ct-sidebar-item" data-tab="custom_emotions"
    id="ct-sidebar-custom-emotions" role="tab" aria-selected="false"
    aria-controls="ct-tab-custom-emotions">
    <i class="fa-solid fa-sparkles" aria-hidden="true"></i>
    <span>Custom Emotions</span>
</button>

<div class="ct-modal-tab" data-tab="custom_emotions"
    id="ct-tab-custom-emotions" role="tabpanel"
    aria-labelledby="ct-sidebar-custom-emotions">
    ${getCustomEmotionsTabHTML()}
</div>
```

### 6.2 Custom Emotions Tab Content

```javascript
function getCustomEmotionsTabHTML() {
    const settings = getSettings();
    const customEmotions = settings.customEmotions || {};

    return `
        <div class="ct-section-label">
            <i class="fa-solid fa-sparkles"></i>
            Custom Emotion Definitions
        </div>

        <p style="font-size: 12px; color: var(--ct-text-light); margin-bottom: 16px;">
            Create custom emotions with semantic descriptions and keyword triggers.
            These work with VectHare semantic classification.
        </p>

        <!-- Custom Emotions List -->
        <div id="ct_custom_emotions_list" class="ct-custom-emotions-list">
            ${Object.entries(customEmotions).map(([name, def]) =>
                generateCustomEmotionCard(name, def, false)
            ).join('')}
        </div>

        <button class="ct-btn" id="ct_add_custom_emotion" style="margin-top: 16px;">
            <i class="fa-solid fa-plus"></i>
            Add Custom Emotion
        </button>

        <div class="ct-section-label" style="margin-top: 32px;">
            <i class="fa-solid fa-user-gear"></i>
            Character-Specific Emotions
        </div>

        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Select Character</span>
            </div>
            <select class="ct-select" id="ct_char_emotion_select">
                <option value="">-- Select Character --</option>
                <!-- Populated with characters -->
            </select>
        </div>

        <div id="ct_char_emotions_container" style="display: none;">
            <!-- Character-specific emotions will appear here -->
        </div>
    `;
}

function generateCustomEmotionCard(name, def, isCharSpecific) {
    const keywordList = Object.entries(def.keywords || {})
        .map(([kw, score]) => `${kw}(${score}x)`)
        .join(', ');

    return `
        <div class="ct-custom-emotion-card" data-emotion="${name}">
            <div class="ct-emotion-card-header">
                <div class="ct-emotion-card-name">
                    <span class="ct-emotion-name">${name}</span>
                    ${isCharSpecific ?
                        '<span class="ct-emotion-badge char">Character</span>' :
                        '<span class="ct-emotion-badge global">Global</span>'
                    }
                    ${def.enabled ?
                        '<span class="ct-emotion-badge enabled">Enabled</span>' :
                        '<span class="ct-emotion-badge disabled">Disabled</span>'
                    }
                </div>
                <div class="ct-emotion-card-actions">
                    <button class="ct-btn-icon ct-edit-emotion" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="ct-btn-icon danger ct-delete-emotion" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            <div class="ct-emotion-card-body">
                <div class="ct-emotion-field">
                    <label>Maps to:</label>
                    <span>${def.baseEmotions.join(', ')}</span>
                </div>
                <div class="ct-emotion-field">
                    <label>Description:</label>
                    <span class="ct-emotion-description">${def.description}</span>
                </div>
                ${keywordList ? `
                    <div class="ct-emotion-field">
                        <label>Keywords:</label>
                        <span class="ct-emotion-keywords">${keywordList}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}
```

### 6.3 Add/Edit Emotion Modal

```html
<div id="ct-emotion-editor-modal" class="ct-modal-overlay" style="display: none;">
    <div class="ct-modal" style="max-width: 600px;">
        <div class="ct-modal-header">
            <div class="ct-modal-header-left">
                <i class="fa-solid fa-sparkles"></i>
                <span class="ct-modal-title" id="ct_emotion_editor_title">Add Custom Emotion</span>
            </div>
            <button class="ct-modal-close" id="ct_emotion_editor_close">&times;</button>
        </div>

        <div class="ct-modal-body" style="padding: 20px;">
            <!-- Emotion Name -->
            <div class="ct-form-group">
                <label>Emotion Name <span class="required">*</span></label>
                <input type="text" id="ct_emotion_name" class="ct-input"
                    placeholder="e.g., smug, flustered, tsundere">
                <small>Unique identifier (lowercase, no spaces)</small>
            </div>

            <!-- Base Emotions -->
            <div class="ct-form-group">
                <label>Maps To (Base Emotions) <span class="required">*</span></label>
                <div class="ct-checkbox-grid" id="ct_base_emotions">
                    <!-- Populated with checkboxes for each standard emotion -->
                </div>
                <small>Select 1-3 emotions this custom emotion represents</small>
            </div>

            <!-- Semantic Description -->
            <div class="ct-form-group">
                <label>Semantic Description <span class="required">*</span></label>
                <textarea id="ct_emotion_description" class="ct-textarea" rows="3"
                    placeholder="Describe the emotion for semantic matching..."></textarea>
                <small>Used for embedding similarity. Include synonyms and contextual phrases.</small>
            </div>

            <!-- Keywords & Boosts -->
            <div class="ct-form-group">
                <label>Trigger Keywords & Boost Scores</label>

                <div id="ct_keywords_list" class="ct-keywords-list">
                    <!-- Keyword rows added here -->
                </div>

                <button class="ct-btn secondary" id="ct_add_keyword" style="margin-top: 8px;">
                    <i class="fa-solid fa-plus"></i>
                    Add Keyword
                </button>

                <small style="display: block; margin-top: 8px;">
                    Boost scores: &gt;1.0 increases match likelihood, &lt;1.0 decreases.
                    Example: "smirk" with 1.5x boost makes "smug" 50% more likely when "smirk" appears.
                </small>
            </div>

            <!-- Scope -->
            <div class="ct-form-group">
                <label>Scope</label>
                <select id="ct_emotion_scope" class="ct-select">
                    <option value="global">Global (All Characters)</option>
                    <option value="character">Character-Specific</option>
                </select>

                <div id="ct_emotion_char_select" style="display: none; margin-top: 8px;">
                    <select id="ct_emotion_character" class="ct-select">
                        <!-- Populated with characters -->
                    </select>
                </div>
            </div>

            <!-- Sprite Mapping (for character-specific) -->
            <div id="ct_sprite_mapping_section" style="display: none;">
                <div class="ct-form-group">
                    <label>Map to Sprite Label</label>
                    <input type="text" id="ct_emotion_sprite_label" class="ct-input"
                        placeholder="e.g., shy_angry, smirk">
                    <small>Override the sprite label for this character (optional)</small>
                </div>
            </div>

            <!-- Actions -->
            <div class="ct-form-actions" style="margin-top: 24px;">
                <button class="ct-btn" id="ct_save_emotion">
                    <i class="fa-solid fa-check"></i>
                    Save
                </button>
                <button class="ct-btn secondary" id="ct_cancel_emotion">Cancel</button>
            </div>
        </div>
    </div>
</div>
```

---

## 7. Event Handlers

### 7.1 Add Custom Emotion

```javascript
document.getElementById('ct_add_custom_emotion')?.addEventListener('click', () => {
    // Reset form
    document.getElementById('ct_emotion_name').value = '';
    document.getElementById('ct_emotion_description').value = '';
    document.getElementById('ct_keywords_list').innerHTML = '';
    document.querySelectorAll('#ct_base_emotions input[type="checkbox"]')
        .forEach(cb => cb.checked = false);

    // Set title
    document.getElementById('ct_emotion_editor_title').textContent = 'Add Custom Emotion';

    // Show modal
    document.getElementById('ct-emotion-editor-modal').style.display = 'flex';
});
```

### 7.2 Add Keyword Row

```javascript
document.getElementById('ct_add_keyword')?.addEventListener('click', () => {
    const container = document.getElementById('ct_keywords_list');

    const row = document.createElement('div');
    row.className = 'ct-keyword-row';
    row.innerHTML = `
        <input type="text" class="ct-input ct-keyword-text" placeholder="keyword">
        <input type="number" class="ct-input ct-keyword-score"
            placeholder="1.5" min="0.1" max="5" step="0.1" value="1.5">
        <button class="ct-btn-icon danger ct-remove-keyword">
            <i class="fa-solid fa-times"></i>
        </button>
    `;

    container.appendChild(row);

    row.querySelector('.ct-remove-keyword').addEventListener('click', () => row.remove());
});
```

### 7.3 Save Custom Emotion

```javascript
document.getElementById('ct_save_emotion')?.addEventListener('click', async () => {
    const name = document.getElementById('ct_emotion_name').value.toLowerCase().trim();
    const description = document.getElementById('ct_emotion_description').value.trim();
    const scope = document.getElementById('ct_emotion_scope').value;

    // Validation
    if (!name || !description) {
        notify.warning('Name and description are required');
        return;
    }

    if (!/^[a-z_]+$/.test(name)) {
        notify.warning('Name must be lowercase letters and underscores only');
        return;
    }

    // Get base emotions
    const baseEmotions = Array.from(
        document.querySelectorAll('#ct_base_emotions input:checked')
    ).map(cb => cb.value);

    if (baseEmotions.length === 0) {
        notify.warning('Select at least one base emotion');
        return;
    }

    // Get keywords
    const keywords = {};
    document.querySelectorAll('.ct-keyword-row').forEach(row => {
        const kw = row.querySelector('.ct-keyword-text').value.trim();
        const score = parseFloat(row.querySelector('.ct-keyword-score').value) || 1.0;
        if (kw) keywords[kw] = score;
    });

    // Build definition
    const definition = {
        baseEmotions,
        description,
        keywords,
        enabled: true,
        createdAt: Date.now()
    };

    // Save
    const settings = getSettings();

    if (scope === 'global') {
        if (!settings.customEmotions) settings.customEmotions = {};
        settings.customEmotions[name] = definition;
        updateSetting('customEmotions', settings.customEmotions);
    } else {
        const charFolder = document.getElementById('ct_emotion_character').value;
        if (!charFolder) {
            notify.warning('Select a character');
            return;
        }

        if (!settings.characterEmotions) settings.characterEmotions = {};
        if (!settings.characterEmotions[charFolder]) {
            settings.characterEmotions[charFolder] = { customEmotions: {} };
        }
        settings.characterEmotions[charFolder].customEmotions[name] = definition;

        // Save sprite mapping if provided
        const spriteLabel = document.getElementById('ct_emotion_sprite_label')?.value.trim();
        if (spriteLabel) {
            if (!settings.characterEmotions[charFolder].spriteEmotionMap) {
                settings.characterEmotions[charFolder].spriteEmotionMap = {};
            }
            settings.characterEmotions[charFolder].spriteEmotionMap[name] = spriteLabel;
        }

        updateSetting('characterEmotions', settings.characterEmotions);
    }

    // Close modal and refresh
    document.getElementById('ct-emotion-editor-modal').style.display = 'none';
    refreshCustomEmotionsList();
    notify.success(`Custom emotion "${name}" saved`);
});
```

---

## 8. Diagnostics

| Check | What to Validate | Fix |
|-------|------------------|-----|
| VectHare Available | Extension installed | Warn, suggest install |
| Embedding Source | Provider configured | Show available sources |
| Custom Emotion Valid | Required fields present | Highlight missing |
| Keywords Valid | Scores in range 0.1-5.0 | Clamp to range |
| Base Emotions Exist | Labels in DEFAULT_EXPRESSIONS | Remove invalid |
| Sprite Mapping Valid | Sprite file exists | Warn on missing |

---

## 9. Implementation Checklist

### Phase 1: Data Structure
- [ ] Add `customEmotions` to default-settings.js
- [ ] Add `characterEmotions` to default-settings.js
- [ ] Add validators to settings-manager.js

### Phase 2: Classification Logic
- [ ] Implement `calculateKeywordBoost()` function
- [ ] Update `classifyWithVectHare()` with custom emotions
- [ ] Add character folder parameter to function

### Phase 3: UI
- [ ] Add "Custom Emotions" tab to modal
- [ ] Create emotion card component
- [ ] Create add/edit emotion modal
- [ ] Implement keyword management UI
- [ ] Add character-specific section

### Phase 4: Integration
- [ ] Update getExpressionLabel() to pass character
- [ ] Connect sprite mappings to display
- [ ] Test with various custom emotions

### Phase 5: Diagnostics
- [ ] Add all diagnostic checks
- [ ] Validate on settings load
- [ ] Clear warnings on fix
