# Cotton-Tales: NPC System Implementation Document

## Executive Summary

The Cotton-Tales NPC system allows users to add non-playable characters with their own sprites, expressions, and trigger phrases. This document covers the complete NPC architecture.

---

## 1. NPC Data Structure

### 1.1 Storage Location

**File:** `core/default-settings.js`
**Key:** `cardNpcs`
**Structure:** Per-card storage indexed by character ID

```javascript
cardNpcs: {
    [cardId]: [
        {
            name: string,                    // NPC display name
            avatar: string | null,           // Avatar filename (optional)
            folderName: string,              // Sprite folder name
            outfits: string[],               // Available outfits ['default', 'casual']
            triggers: string[],              // Name triggers for detection
            outfitTriggers: {                // Outfit-specific triggers
                [outfitName]: string[]
            },
            expressionMappings: {            // Per-outfit expression mappings
                [outfit]: {
                    [emotion]: string[]      // emotion -> sprite files
                }
            }
        }
    ]
}
```

### 1.2 Example NPC

```javascript
{
    name: 'Luna',
    avatar: 'luna.png',
    folderName: 'luna_sprites',
    outfits: ['default', 'maid', 'school'],
    triggers: ['Luna', 'the girl', 'maid'],
    outfitTriggers: {
        'maid': ['maid outfit', 'uniform', 'working'],
        'school': ['school', 'academy', 'classroom']
    },
    expressionMappings: {
        'default': {
            'neutral': ['neutral.png'],
            'joy': ['happy.png', 'smile.png']
        },
        'maid': {
            'neutral': ['maid/neutral.png'],
            'joy': ['maid/happy.png']
        }
    }
}
```

---

## 2. Existing Implementation

### 2.1 addNpc() Function

**Location:** `ui/sprite-manager.js` lines 649-676

```javascript
async function addNpc() {
    // Step 1: Get NPC name
    const name = await showInputModal('Add NPC', 'Enter NPC name...');
    if (!name) return;

    // Step 2: Get sprite folder (optional, defaults to name)
    const folderName = await showInputModal(
        'Sprite Folder',
        'Leave blank to use NPC name',
        name
    );

    // Step 3: Create NPC with defaults
    characterList.push({
        name: name,
        avatar: null,
        isNpc: true,
        folderName: folderName || name,
        sprites: [],
        outfits: ['default'],
        triggers: [name],
        outfitTriggers: {}
    });

    // Step 4: Load sprites
    const newChar = characterList[characterList.length - 1];
    try {
        newChar.sprites = await getSpritesList(newChar.folderName);
    } catch (e) {
        console.debug(`No sprites found for ${name}`);
    }

    // Step 5: Persist and update UI
    await saveNpcData();
    selectCharacter(characterList.length - 1);
}
```

### 2.2 What Works
- Two-step modal input (name + folder)
- Creates NPC with sensible defaults
- Loads sprites immediately
- Saves to persistent storage
- Updates UI

### 2.3 What's Missing
- Avatar selection UI
- Edit NPC functionality
- Delete NPC with confirmation
- Sophisticated outfit discovery
- Expression mapping per NPC

---

## 3. NPC Loading in Character Carousel

### 3.1 Current State

**Location:** `ui/settings-panel.js` line 1049

```javascript
// TODO: Also load NPCs from our own storage
```

### 3.2 Implementation

**Add to `populateCharacterCarousel()` after line 1047:**

```javascript
// Load NPCs from card-specific storage
const settings = getSettings();
const cardId = context.characterId;
const cardNpcs = settings.cardNpcs?.[cardId] || [];

for (const npc of cardNpcs) {
    charList.push({
        name: npc.name,
        folder: npc.folderName,
        avatar: npc.avatar,
        data: { tags: [] }, // NPCs don't have character data
        isNPC: true,
        isActive: false
    });

    // Pre-fetch NPC sprites
    try {
        const res = await fetch(`/api/sprites/get?name=${encodeURIComponent(npc.folderName)}`);
        if (res.ok) {
            characterSpriteCache[npc.folderName] = await res.json();
        }
    } catch (e) {
        console.debug(`Could not fetch sprites for NPC ${npc.name}`);
    }
}
```

---

## 4. NPC Management UI

### 4.1 Add NPC Modal (Enhanced)

**Replace simple prompts with a proper form modal:**

```html
<div id="ct-add-npc-modal" class="ct-modal-overlay" style="display: none;">
    <div class="ct-modal" style="max-width: 500px;">
        <div class="ct-modal-header">
            <div class="ct-modal-header-left">
                <i class="fa-solid fa-user-plus"></i>
                <span class="ct-modal-title">Add NPC</span>
            </div>
            <div class="ct-modal-header-right">
                <button class="ct-modal-close" id="ct_add_npc_close">&times;</button>
            </div>
        </div>

        <div class="ct-modal-body" style="padding: 20px;">
            <!-- NPC Name -->
            <div class="ct-form-group">
                <label>NPC Name <span style="color: #f87171;">*</span></label>
                <input type="text" id="ct_npc_name" class="ct-input"
                    placeholder="e.g., Luna, Shopkeeper, Guard">
            </div>

            <!-- Sprite Folder -->
            <div class="ct-form-group">
                <label>Sprite Folder <span style="color: #f87171;">*</span></label>
                <input type="text" id="ct_npc_folder" class="ct-input"
                    placeholder="Folder name in /characters/">
                <small>The folder containing this NPC's sprite images</small>
            </div>

            <!-- Avatar (optional) -->
            <div class="ct-form-group">
                <label>Avatar Image (optional)</label>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div id="ct_npc_avatar_preview" class="ct-avatar-preview">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <button class="ct-btn secondary" id="ct_npc_upload_avatar">
                        <i class="fa-solid fa-upload"></i>
                        Upload Avatar
                    </button>
                </div>
            </div>

            <!-- Initial Triggers -->
            <div class="ct-form-group">
                <label>Trigger Phrases</label>
                <input type="text" id="ct_npc_triggers" class="ct-input"
                    placeholder="Luna, the girl, maid (comma-separated)">
                <small>Phrases that indicate this NPC is speaking/present</small>
            </div>

            <!-- Default Expression -->
            <div class="ct-form-group">
                <label>Default Expression</label>
                <select id="ct_npc_default_expr" class="ct-select">
                    <option value="neutral">neutral</option>
                    <option value="joy">joy</option>
                    <option value="sadness">sadness</option>
                </select>
            </div>

            <div class="ct-form-actions" style="margin-top: 20px;">
                <button class="ct-btn" id="ct_save_new_npc">
                    <i class="fa-solid fa-check"></i>
                    Add NPC
                </button>
                <button class="ct-btn secondary" id="ct_cancel_new_npc">Cancel</button>
            </div>
        </div>
    </div>
</div>
```

### 4.2 Edit NPC Interface

```javascript
async function editNpc(npcIndex) {
    const npc = characterList[npcIndex];
    if (!npc || !npc.isNpc) return;

    // Populate edit modal with current values
    document.getElementById('ct_edit_npc_name').value = npc.name;
    document.getElementById('ct_edit_npc_folder').value = npc.folderName;
    document.getElementById('ct_edit_npc_triggers').value = npc.triggers.join(', ');

    // Show avatar preview
    if (npc.avatar) {
        const preview = document.getElementById('ct_edit_npc_avatar_preview');
        preview.innerHTML = `<img src="/characters/${npc.avatar}" alt="${npc.name}">`;
    }

    // Populate outfit list
    renderNpcOutfits(npc);

    // Show modal
    document.getElementById('ct-edit-npc-modal').style.display = 'flex';
}

function renderNpcOutfits(npc) {
    const container = document.getElementById('ct_npc_outfits');
    container.innerHTML = npc.outfits.map((outfit, i) => `
        <div class="ct-outfit-row" data-outfit="${outfit}">
            <span class="ct-outfit-name">${outfit}</span>
            <input type="text" class="ct-input ct-outfit-triggers"
                value="${(npc.outfitTriggers[outfit] || []).join(', ')}"
                placeholder="Trigger words...">
            ${outfit !== 'default' ? `
                <button class="ct-btn-icon danger ct-remove-outfit">
                    <i class="fa-solid fa-trash"></i>
                </button>
            ` : ''}
        </div>
    `).join('');
}
```

### 4.3 Delete NPC

```javascript
async function deleteNpc(npcIndex) {
    const npc = characterList[npcIndex];
    if (!npc) return;

    // Confirmation
    const confirmed = await showConfirmModal(
        'Delete NPC',
        `Are you sure you want to delete "${npc.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    // Remove from list
    characterList.splice(npcIndex, 1);

    // Persist
    await saveNpcData();

    // Update UI
    if (currentCharacterIndex >= characterList.length) {
        currentCharacterIndex = Math.max(0, characterList.length - 1);
    }
    renderPartyDock();
    renderCurrentCharacter();

    toastr.success(`NPC "${npc.name}" deleted`);
}
```

---

## 5. NPC Integration with Expression System

### 5.1 VN Mode Character Detection

**Location:** `ct-expressions.js`

NPCs should appear in VN mode when their trigger words are detected:

```javascript
function detectNpcInMessage(messageText, npc) {
    if (!npc.triggers || npc.triggers.length === 0) {
        return false;
    }

    const lowerText = messageText.toLowerCase();
    return npc.triggers.some(trigger =>
        lowerText.includes(trigger.toLowerCase())
    );
}

// In VN mode update:
async function updateNpcExpressions(message) {
    const settings = getSettings();
    const cardId = getContext().characterId;
    const cardNpcs = settings.cardNpcs?.[cardId] || [];

    for (const npc of cardNpcs) {
        if (detectNpcInMessage(message.mes, npc)) {
            // Classify emotion and set expression
            const expression = await getExpressionLabel(message.mes, null, npc.folderName);
            await setNpcExpression(npc, expression);
        }
    }
}
```

### 5.2 NPC Sprite Display

```javascript
async function setNpcExpression(npc, expression) {
    const wrapper = document.getElementById('ct-visual-novel-wrapper');
    if (!wrapper) return;

    // Find or create NPC holder
    let holder = wrapper.querySelector(`[data-npc-id="${npc.name}"]`);
    if (!holder) {
        holder = document.createElement('div');
        holder.className = 'ct-expression-holder ct-npc-holder';
        holder.dataset.npcId = npc.name;
        wrapper.appendChild(holder);
    }

    // Get sprite for expression
    const sprites = spriteCache[npc.folderName] || [];
    const sprite = sprites.find(s => s.label === expression);

    if (sprite && sprite.files?.length > 0) {
        const imgSrc = sprite.files[0].imageSrc;
        holder.innerHTML = `
            <div class="drag-grabber"></div>
            <img src="${imgSrc}" alt="${npc.name} - ${expression}">
            <div class="ct-npc-name">${npc.name}</div>
        `;
    }
}
```

---

## 6. Outfit Detection & Switching

### 6.1 Auto-Discovery from Folder Structure

```javascript
function discoverOutfitsFromSprites(sprites) {
    const outfits = new Set(['default']);

    for (const sprite of sprites) {
        const pathParts = sprite.label?.split('/') || [];
        if (pathParts.length > 1) {
            outfits.add(pathParts[0]); // First part is outfit name
        }
    }

    return [...outfits];
}

// Example folder structure:
// /sprites/luna_sprites/
//   ├── neutral.png          -> outfit: 'default'
//   ├── happy.png            -> outfit: 'default'
//   └── maid/
//       ├── neutral.png      -> outfit: 'maid'
//       └── happy.png        -> outfit: 'maid'
```

### 6.2 Outfit Trigger Detection

```javascript
function detectOutfitFromMessage(messageText, npc) {
    const lowerText = messageText.toLowerCase();

    for (const [outfit, triggers] of Object.entries(npc.outfitTriggers || {})) {
        if (triggers.some(t => lowerText.includes(t.toLowerCase()))) {
            return outfit;
        }
    }

    return 'default';
}
```

---

## 7. Storage & Persistence

### 7.1 Save NPC Data

```javascript
async function saveNpcData() {
    const settings = getSettings();
    const cardId = getContext().characterId;

    if (!cardId) {
        console.warn('No active card to save NPC data');
        return;
    }

    // Filter to only NPC entries
    const npcs = characterList
        .filter(c => c.isNpc)
        .map(npc => ({
            name: npc.name,
            avatar: npc.avatar,
            folderName: npc.folderName,
            outfits: npc.outfits,
            triggers: npc.triggers,
            outfitTriggers: npc.outfitTriggers,
            expressionMappings: npc.expressionMappings || {}
        }));

    // Update settings
    if (!settings.cardNpcs) settings.cardNpcs = {};
    settings.cardNpcs[cardId] = npcs;

    await saveSettings();
}
```

### 7.2 Load NPC Data

```javascript
async function loadNpcDataForCard(cardId) {
    const settings = getSettings();
    const npcs = settings.cardNpcs?.[cardId] || [];

    const loadedNpcs = [];
    for (const npc of npcs) {
        // Load sprites for each NPC
        let sprites = [];
        try {
            sprites = await getSpritesList(npc.folderName);
        } catch (e) {
            console.debug(`Could not load sprites for NPC ${npc.name}`);
        }

        loadedNpcs.push({
            ...npc,
            isNpc: true,
            sprites: sprites,
            outfits: discoverOutfitsFromSprites(sprites)
        });
    }

    return loadedNpcs;
}
```

---

## 8. Diagnostics & Validation

| Check | Failure Point | Fix |
|-------|---------------|-----|
| NPC folder exists | Folder path invalid | Show error, suggest check path |
| Sprites load | No sprites in folder | Warn user, show folder path |
| Trigger detection | Message not matching | Show detected vs. expected |
| Outfit switching | Trigger words wrong | Show available triggers |
| Avatar display | File not found | Fall back to placeholder |
| Save/load | Settings corruption | Validate structure on load |

---

## 9. Implementation Checklist

### Phase 1: Core NPC Management
- [ ] Enhance `addNpc()` with full form modal
- [ ] Implement `editNpc()` function
- [ ] Implement `deleteNpc()` with confirmation
- [ ] Add avatar upload/selection

### Phase 2: Settings Panel Integration
- [ ] Load NPCs in `populateCharacterCarousel()`
- [ ] Display NPC cards with NPC badge
- [ ] Show NPC detail panel
- [ ] Connect "Add NPC" button to modal

### Phase 3: VN Mode Display
- [ ] Add NPC trigger detection
- [ ] Create NPC sprite holders
- [ ] Implement NPC positioning
- [ ] Handle outfit switching

### Phase 4: Expression System
- [ ] Per-NPC expression mappings
- [ ] Outfit-specific expressions
- [ ] Expression fallback chain

### Phase 5: Diagnostics
- [ ] Add all diagnostic checks
- [ ] Validate NPC data on load
- [ ] User-friendly error messages
