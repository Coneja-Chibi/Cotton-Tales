/**
 * ============================================================================
 * COTTON-TALES SPRITE MANAGER UI
 * ============================================================================
 * A cozy RPG-styled sprite/expression manager modal.
 *
 * Layout:
 * - Character flipbook header (prev/next navigation)
 * - Outfit carousel with default expression preview
 * - Expression grid for selected outfit
 * - Character triggers section
 * - RPG party dock at bottom for quick character switching
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import { getRequestHeaders, getThumbnailUrl, characters, this_chid } from '../../../../../script.js';
import { getContext } from '../../../../extensions.js';
import { getSettings, saveSettings } from '../core/settings-manager.js';
import { EXTENSION_NAME, DEFAULT_EXPRESSIONS, CLASSIFIER_MODELS, EXPRESSION_API } from '../core/constants.js';
import { getSpritesList, spriteCache, validateImages } from '../ct-expressions.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODULE_NAME = 'ct-sprite-manager';

// =============================================================================
// STATE
// =============================================================================

let isOpen = false;
let currentCharacterIndex = 0;
let selectedOutfit = 'default';
let characterList = []; // { name, avatar, isNpc, sprites, outfits, triggers }
let modalEventsBound = false;
let keyboardHandler = null;

// Expression method state
let selectedMethod = 'bert'; // 'bert' | 'llm' | 'vecthare'
let selectedBertModel = 'roberta_go_emotions';
let customLabels = []; // For LLM/VectHare - user-added labels

// =============================================================================
// INPUT MODAL (replaces blocking prompt())
// =============================================================================

/**
 * Show a non-blocking input modal dialog
 * @param {string} title - Modal title
 * @param {string} placeholder - Input placeholder text
 * @param {string} defaultValue - Default input value
 * @returns {Promise<string|null>} User input or null if cancelled
 */
function showInputModal(title, placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="ct-input-modal-overlay" id="ct_input_modal_overlay">
                <div class="ct-input-modal">
                    <div class="ct-input-modal-header">
                        <span>${escapeHtml(title)}</span>
                        <button class="ct-input-modal-close" id="ct_input_modal_close">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                    <div class="ct-input-modal-body">
                        <input type="text"
                               class="ct-input-modal-input"
                               id="ct_input_modal_input"
                               placeholder="${escapeHtml(placeholder)}"
                               value="${escapeHtml(defaultValue)}" />
                    </div>
                    <div class="ct-input-modal-footer">
                        <button class="ct-btn secondary" id="ct_input_modal_cancel">Cancel</button>
                        <button class="ct-btn primary" id="ct_input_modal_confirm">OK</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        document.body.appendChild(wrapper.firstElementChild);

        const overlay = document.getElementById('ct_input_modal_overlay');
        const input = document.getElementById('ct_input_modal_input');
        const closeBtn = document.getElementById('ct_input_modal_close');
        const cancelBtn = document.getElementById('ct_input_modal_cancel');
        const confirmBtn = document.getElementById('ct_input_modal_confirm');

        // Focus input
        setTimeout(() => input?.focus(), 50);

        let isClosing = false;
        const cleanup = (result) => {
            if (isClosing) return; // Prevent double-clicks/rapid submissions
            isClosing = true;
            overlay?.remove();
            resolve(result);
        };

        // Event handlers
        closeBtn?.addEventListener('click', () => cleanup(null));
        cancelBtn?.addEventListener('click', () => cleanup(null));
        confirmBtn?.addEventListener('click', () => cleanup(input?.value?.trim() || null));

        // Enter key confirms, Escape cancels
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                cleanup(input?.value?.trim() || null);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(null);
            }
        });

        // Click outside closes
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(null);
        });
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Show a confirmation dialog
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="ct-input-modal-overlay" id="ct_confirm_modal_overlay">
                <div class="ct-input-modal">
                    <div class="ct-input-modal-header">
                        <span>${escapeHtml(title)}</span>
                        <button class="ct-input-modal-close" id="ct_confirm_modal_close">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                    <div class="ct-input-modal-body">
                        <p style="margin: 0; padding: 12px 0;">${escapeHtml(message)}</p>
                    </div>
                    <div class="ct-input-modal-footer">
                        <button class="ct-btn secondary" id="ct_confirm_modal_cancel">Cancel</button>
                        <button class="ct-btn danger" id="ct_confirm_modal_confirm">Confirm</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        document.body.appendChild(wrapper.firstElementChild);

        const overlay = document.getElementById('ct_confirm_modal_overlay');
        const closeBtn = document.getElementById('ct_confirm_modal_close');
        const cancelBtn = document.getElementById('ct_confirm_modal_cancel');
        const confirmBtn = document.getElementById('ct_confirm_modal_confirm');

        let isClosing = false;
        const cleanup = (result) => {
            if (isClosing) return;
            isClosing = true;
            overlay?.remove();
            resolve(result);
        };

        // Event handlers
        closeBtn?.addEventListener('click', () => cleanup(false));
        cancelBtn?.addEventListener('click', () => cleanup(false));
        confirmBtn?.addEventListener('click', () => cleanup(true));

        // Escape cancels
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Click outside closes
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });
    });
}

// =============================================================================
// DATA MANAGEMENT
// =============================================================================

/**
 * Get all characters for current card (main + NPCs)
 * @returns {Promise<Object[]>} Array of character data
 */
async function getCharactersForCard() {
    const context = getContext();
    const settings = getSettings();
    const result = [];

    // Get main character
    if (context.characterId !== undefined && characters[this_chid]) {
        const mainChar = characters[this_chid];
        const folderName = mainChar.avatar?.replace(/\.[^/.]+$/, '') || mainChar.name;

        result.push({
            name: mainChar.name,
            avatar: mainChar.avatar,
            isNpc: false,
            folderName: folderName,
            sprites: [],
            outfits: ['default'],
            triggers: [mainChar.name],
            outfitTriggers: {}
        });
    }

    // Get NPCs from per-card settings
    const cardId = context.characterId;
    const cardNpcs = settings.cardNpcs?.[cardId] || [];

    for (const npc of cardNpcs) {
        result.push({
            name: npc.name,
            avatar: npc.avatar || null,
            isNpc: true,
            folderName: npc.folderName || npc.name,
            sprites: [],
            outfits: npc.outfits || ['default'],
            triggers: npc.triggers || [npc.name],
            outfitTriggers: npc.outfitTriggers || {}
        });
    }

    // Load sprites for all characters in parallel
    await Promise.all(result.map(async (char) => {
        try {
            const sprites = await getSpritesList(char.folderName);
            char.sprites = sprites;

            // Extract unique outfits from sprite paths
            const detectedOutfits = new Set(['default']);
            for (const sprite of sprites) {
                // Check if sprite path contains outfit subfolder
                const pathParts = sprite.label?.split('/') || [];
                if (pathParts.length > 1) {
                    detectedOutfits.add(pathParts[0]);
                }
            }
            char.outfits = [...detectedOutfits];
        } catch (e) {
            console.debug(`[${MODULE_NAME}] Failed to load sprites for ${char.name}:`, e);
        }
    }));

    return result;
}

/**
 * Save NPC data for current card
 */
async function saveNpcData() {
    const context = getContext();
    const settings = getSettings();
    const cardId = context.characterId;

    if (!settings.cardNpcs) {
        settings.cardNpcs = {};
    }

    // Filter to only NPCs
    const npcs = characterList.filter(c => c.isNpc).map(npc => ({
        name: npc.name,
        avatar: npc.avatar,
        folderName: npc.folderName,
        outfits: npc.outfits,
        triggers: npc.triggers,
        outfitTriggers: npc.outfitTriggers
    }));

    settings.cardNpcs[cardId] = npcs;
    await saveSettings();
}

// =============================================================================
// RENDER FUNCTIONS
// =============================================================================

/**
 * Generate the main modal HTML
 */
function generateModalHtml() {
    return `
    <div id="ct-sprite-manager-modal" class="ct-sprite-manager">
        <div class="ct-sm-backdrop"></div>
        <div class="ct-sm-container">
            <!-- Header with Character Flipbook -->
            <div class="ct-sm-header">
                <div class="ct-sm-title">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <span>Sprite Manager</span>
                </div>
                <button class="ct-sm-close" title="Close">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Character Flipbook Navigation -->
            <div class="ct-sm-flipbook">
                <button class="ct-sm-flip-btn ct-sm-flip-prev" title="Previous Character">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="ct-sm-character-display">
                    <div class="ct-sm-character-avatar"></div>
                    <div class="ct-sm-character-info">
                        <span class="ct-sm-character-name">Character Name</span>
                        <span class="ct-sm-character-badge">MAIN</span>
                    </div>
                </div>
                <button class="ct-sm-flip-btn ct-sm-flip-next" title="Next Character">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
                <button class="ct-sm-flip-btn ct-sm-edit-char" title="Edit NPC" style="display: none;">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="ct-sm-flip-btn ct-sm-delete-char" title="Delete NPC" style="display: none;">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="ct-sm-flip-btn ct-sm-add-char" title="Add NPC">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>

            <!-- Character Counter -->
            <div class="ct-sm-counter">
                <span class="ct-sm-counter-current">1</span>
                <span class="ct-sm-counter-sep">of</span>
                <span class="ct-sm-counter-total">1</span>
            </div>

            <!-- Main Content Area -->
            <div class="ct-sm-content">
                <!-- Outfit Carousel -->
                <div class="ct-sm-section ct-sm-outfits-section">
                    <div class="ct-sm-section-header">
                        <i class="fa-solid fa-shirt"></i>
                        <span>Outfits</span>
                    </div>
                    <div class="ct-sm-outfit-carousel-wrapper">
                        <button class="ct-sm-carousel-arrow ct-sm-carousel-left" title="Previous outfits">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <div class="ct-sm-outfit-carousel"></div>
                        <button class="ct-sm-carousel-arrow ct-sm-carousel-right" title="Next outfits">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </div>

                <!-- Expression Method Selector -->
                <div class="ct-sm-section ct-sm-method-section">
                    <div class="ct-sm-section-header">
                        <i class="fa-solid fa-brain"></i>
                        <span>Expression Method</span>
                    </div>
                    <div class="ct-sm-method-tabs">
                        <button class="ct-sm-method-tab" data-method="bert" title="Local BERT classifier">
                            <i class="fa-solid fa-microchip"></i>
                            <span>BERT</span>
                        </button>
                        <button class="ct-sm-method-tab" data-method="llm" title="LLM via connection">
                            <i class="fa-solid fa-comments"></i>
                            <span>LLM</span>
                        </button>
                        <button class="ct-sm-method-tab" data-method="vecthare" title="VectHare semantic">
                            <i class="fa-solid fa-vector-square"></i>
                            <span>VectHare</span>
                        </button>
                    </div>
                    <!-- BERT Model Selector (shown when BERT selected) -->
                    <div class="ct-sm-method-options ct-sm-bert-options" style="display: none;">
                        <select class="ct-sm-model-select" id="ct_sm_bert_model">
                            ${Object.values(CLASSIFIER_MODELS).map(m => `
                                <option value="${m.id}">${m.name} (${m.labels} labels)</option>
                            `).join('')}
                        </select>
                    </div>
                    <!-- LLM Options (shown when LLM selected) -->
                    <div class="ct-sm-method-options ct-sm-llm-options" style="display: none;">
                        <p class="ct-sm-method-hint">
                            <i class="fa-solid fa-comments"></i>
                            LLM mode shows your existing sprites plus suggested labels. Click tiles to add sprites.
                        </p>
                        <div class="ct-sm-llm-suggestions">
                            <span class="ct-sm-llm-label">Quick Add:</span>
                            <div class="ct-sm-suggestion-chips" id="ct_sm_llm_suggestions"></div>
                        </div>
                        <div class="ct-sm-llm-import">
                            <span class="ct-sm-llm-label">Import preset:</span>
                            <select class="ct-sm-model-select" id="ct_sm_llm_source">
                                <option value="">-- Select preset --</option>
                                ${Object.values(CLASSIFIER_MODELS).map(m => `
                                    <option value="${m.id}">${m.name} (${m.labels})</option>
                                `).join('')}
                            </select>
                            <button class="ct-sm-btn-small" id="ct_sm_import_labels">Import</button>
                        </div>
                    </div>
                    <!-- VectHare Options (shown when VectHare selected) -->
                    <div class="ct-sm-method-options ct-sm-vecthare-options" style="display: none;">
                        <div class="ct-sm-vecthare-layout">
                            <div class="ct-sm-vecthare-info">
                                <div class="ct-sm-vecthare-status" id="ct_sm_vecthare_status">
                                    <i class="fa-solid fa-circle-question"></i>
                                    <span>Checking VectHare status...</span>
                                </div>
                                <p class="ct-sm-method-hint">
                                    <i class="fa-solid fa-vector-square"></i>
                                    VectHare uses AI embeddings to semantically match text to emotions.
                                    It understands context, not just keywords.
                                </p>
                            </div>
                            <div class="ct-sm-vecthare-emotions">
                                <div class="ct-sm-vecthare-section-label">
                                    <i class="fa-solid fa-sparkles"></i>
                                    <span>Custom Emotions</span>
                                    <button class="ct-sm-btn-add-emotion" id="ct_sm_add_emotion" title="Add custom emotion">
                                        <i class="fa-solid fa-plus"></i>
                                    </button>
                                </div>
                                <div class="ct-sm-emotion-chips" id="ct_sm_emotion_chips">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Expression Grid -->
                <div class="ct-sm-section">
                    <div class="ct-sm-section-header">
                        <i class="fa-solid fa-face-smile"></i>
                        <span>Expressions</span>
                        <span class="ct-sm-outfit-label">— Default</span>
                    </div>
                    <div class="ct-sm-expression-grid"></div>
                    <!-- Add Custom Label (for LLM/VectHare) -->
                    <div class="ct-sm-add-custom-label" style="display: none;">
                        <button class="ct-sm-btn-add-label" id="ct_sm_add_label">
                            <i class="fa-solid fa-plus"></i>
                            Add Custom Label
                        </button>
                    </div>
                </div>

                <!-- Triggers Section -->
                <div class="ct-sm-section ct-sm-triggers-section">
                    <div class="ct-sm-section-header">
                        <i class="fa-solid fa-tag"></i>
                        <span>Character Triggers</span>
                    </div>
                    <div class="ct-sm-triggers-container">
                        <div class="ct-sm-trigger-chips"></div>
                        <button class="ct-sm-add-trigger" title="Add Trigger">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>

                    <div class="ct-sm-section-header ct-sm-outfit-triggers-header">
                        <i class="fa-solid fa-tags"></i>
                        <span>Outfit Triggers</span>
                    </div>
                    <div class="ct-sm-outfit-triggers"></div>
                </div>
            </div>

            <!-- RPG Party Dock -->
            <div class="ct-sm-party-dock">
                <div class="ct-sm-party-label">Party</div>
                <div class="ct-sm-party-members"></div>
            </div>
        </div>
    </div>`;
}

/**
 * Render the current character's data
 */
function renderCurrentCharacter() {
    if (characterList.length === 0) {
        renderEmptyState();
        return;
    }

    const char = characterList[currentCharacterIndex];

    // Update flipbook
    const avatarEl = document.querySelector('.ct-sm-character-avatar');
    const nameEl = document.querySelector('.ct-sm-character-name');
    const badgeEl = document.querySelector('.ct-sm-character-badge');
    const counterCurrent = document.querySelector('.ct-sm-counter-current');
    const counterTotal = document.querySelector('.ct-sm-counter-total');

    if (avatarEl) {
        if (char.avatar) {
            // Use full avatar image, not thumbnail, for better quality in larger display
            const fullAvatarUrl = `/characters/${encodeURIComponent(char.avatar)}`;
            avatarEl.innerHTML = `<img src="${fullAvatarUrl}" alt="${char.name}">`;
        } else {
            avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
        }
    }

    if (nameEl) nameEl.textContent = char.name;
    if (badgeEl) {
        badgeEl.textContent = char.isNpc ? 'NPC' : 'MAIN';
        badgeEl.className = `ct-sm-character-badge ${char.isNpc ? 'npc' : 'main'}`;
    }

    if (counterCurrent) counterCurrent.textContent = currentCharacterIndex + 1;
    if (counterTotal) counterTotal.textContent = characterList.length;

    // Show/hide edit and delete buttons for NPCs
    const editBtn = document.querySelector('.ct-sm-edit-char');
    const deleteBtn = document.querySelector('.ct-sm-delete-char');
    if (editBtn) editBtn.style.display = char.isNpc ? 'flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = char.isNpc ? 'flex' : 'none';

    // Render outfits
    renderOutfitCarousel(char);

    // Render expressions
    renderExpressionGrid(char);

    // Render triggers
    renderTriggers(char);

    // Render party dock
    renderPartyDock();
}

/**
 * Render outfit carousel
 */
function renderOutfitCarousel(char) {
    const container = document.querySelector('.ct-sm-outfit-carousel');
    if (!container) return;

    container.innerHTML = '';

    for (const outfit of char.outfits) {
        // Find default expression for this outfit
        let previewSrc = '';
        const outfitSprites = char.sprites.filter(s => {
            if (outfit === 'default') {
                return !s.label?.includes('/');
            }
            return s.label?.startsWith(outfit + '/');
        });

        // Get neutral/default expression as preview
        const neutralSprite = outfitSprites.find(s =>
            s.label?.includes('neutral') || s.label?.includes('default')
        ) || outfitSprites[0];

        if (neutralSprite?.files?.[0]) {
            previewSrc = neutralSprite.files[0].imageSrc;
        }

        const card = document.createElement('div');
        card.className = `ct-sm-outfit-card ${outfit === selectedOutfit ? 'selected' : ''}`;
        card.dataset.outfit = outfit;

        card.innerHTML = `
            <div class="ct-sm-outfit-preview">
                ${previewSrc
                    ? `<img src="${previewSrc}" alt="${outfit}">`
                    : `<i class="fa-solid fa-image"></i>`
                }
            </div>
            <div class="ct-sm-outfit-name">${outfit}</div>
            <div class="ct-sm-outfit-count">${outfitSprites.length} sprites</div>
        `;

        card.addEventListener('click', () => selectOutfit(outfit));
        container.appendChild(card);
    }

    // Add "new outfit" card
    const addCard = document.createElement('div');
    addCard.className = 'ct-sm-outfit-card ct-sm-outfit-add';
    addCard.innerHTML = `
        <div class="ct-sm-outfit-preview">
            <i class="fa-solid fa-plus"></i>
        </div>
        <div class="ct-sm-outfit-name">Add Outfit</div>
    `;
    addCard.addEventListener('click', () => addOutfit());
    container.appendChild(addCard);
}

/**
 * Get the list of expression labels based on current method
 * Each method has its own isolated label set - no bleeding between methods
 */
function getExpectedLabels() {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Get labels that have existing sprites for this character
    const existingSpriteLabels = new Set();
    for (const sprite of char?.sprites || []) {
        const label = sprite.label?.split('/').pop() || sprite.label;
        if (label) existingSpriteLabels.add(label.toLowerCase());
    }

    switch (selectedMethod) {
        case 'bert': {
            // BERT: Fixed labels from the selected BERT model ONLY
            const model = CLASSIFIER_MODELS[selectedBertModel];
            return model?.labelList || [];
        }
        case 'llm': {
            // LLM: User's custom labels for this character
            // Start with existing sprites, then add any custom labels they've defined
            const charProfile = settings.characterExpressionProfiles?.[charFolder];
            const customList = charProfile?.customLabels || [];

            // If user has custom labels, show those
            if (customList.length > 0) {
                return customList;
            }

            // Otherwise, show only labels that have existing sprites (don't auto-show all 28 BERT labels)
            // Plus basic emotions if they want to add sprites
            const basicEmotions = ['neutral', 'joy', 'sadness', 'anger', 'fear', 'surprise', 'love'];
            const combined = new Set([...existingSpriteLabels, ...basicEmotions]);
            return [...combined].sort();
        }
        case 'vecthare': {
            // VectHare: Semantic matching - show existing sprites + any custom emotions defined
            const customEmotions = settings.customEmotions || {};
            const charEmotions = settings.characterEmotions?.[charFolder]?.customEmotions || {};
            const allCustom = [...Object.keys(customEmotions), ...Object.keys(charEmotions)];

            // Start with existing sprites, add custom emotions, then a minimal base set
            const minimalBase = ['neutral', 'joy', 'sadness', 'anger', 'love', 'surprise'];
            const combined = new Set([...existingSpriteLabels, ...allCustom, ...minimalBase]);
            return [...combined].sort();
        }
        default:
            return ['neutral'];
    }
}

/**
 * Render expression grid for selected outfit
 * Shows ALL expected labels with upload slots, filled or empty
 */
function renderExpressionGrid(char) {
    const container = document.querySelector('.ct-sm-expression-grid');
    const outfitLabel = document.querySelector('.ct-sm-outfit-label');
    const addCustomLabelSection = document.querySelector('.ct-sm-add-custom-label');
    if (!container) return;

    container.innerHTML = '';

    if (outfitLabel) {
        outfitLabel.textContent = `— ${selectedOutfit}`;
    }

    // Show/hide custom label button based on method
    if (addCustomLabelSection) {
        addCustomLabelSection.style.display = (selectedMethod === 'llm' || selectedMethod === 'vecthare') ? 'block' : 'none';
    }

    // Get all sprites for this outfit
    const outfitSprites = char.sprites.filter(s => {
        if (selectedOutfit === 'default') {
            return !s.label?.includes('/');
        }
        return s.label?.startsWith(selectedOutfit + '/');
    });

    // Group existing sprites by expression label (case-insensitive matching)
    const existingSpriteMap = new Map();
    for (const sprite of outfitSprites) {
        const label = (sprite.label?.split('/').pop() || sprite.label || '').toLowerCase();
        if (!existingSpriteMap.has(label)) {
            existingSpriteMap.set(label, []);
        }
        existingSpriteMap.get(label).push(...(sprite.files || []));
    }

    // Get ALL expected labels for current method
    const expectedLabels = getExpectedLabels();

    // Render a tile for EACH expected label
    for (const expression of expectedLabels) {
        const expressionLower = expression.toLowerCase();
        const files = existingSpriteMap.get(expressionLower) || [];
        const hasSprite = files.length > 0;
        const previewFile = files[0];

        const tile = document.createElement('div');
        tile.className = `ct-sm-expression-tile ${hasSprite ? 'has-sprite' : 'empty'}`;
        tile.dataset.expression = expression;

        // Check if this is a removable custom label (LLM mode only, not in BERT presets)
        const isCustomLabel = selectedMethod === 'llm' && !DEFAULT_EXPRESSIONS.includes(expression);
        const bertLabels = Object.values(CLASSIFIER_MODELS).flatMap(m => m.labelList);
        const isFromBertPreset = bertLabels.includes(expression);

        tile.innerHTML = `
            <div class="ct-sm-expression-preview ${hasSprite ? '' : 'ct-sm-empty-slot'}">
                ${hasSprite
                    ? `<img src="${previewFile.imageSrc}" alt="${expression}">`
                    : `<i class="fa-solid fa-plus"></i>`
                }
                ${files.length > 1 ? `<span class="ct-sm-expression-count">${files.length}</span>` : ''}
                ${hasSprite ? `
                    <button class="ct-sm-delete-sprite" data-expression="${expression}" title="Delete sprite">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : ''}
                ${isCustomLabel && !isFromBertPreset ? `
                    <button class="ct-sm-remove-label" data-label="${expression}" title="Remove label">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                ` : ''}
            </div>
            <div class="ct-sm-expression-label">${expression}</div>
        `;

        // Click to upload sprite for this expression
        tile.addEventListener('click', (e) => {
            if (e.target.closest('.ct-sm-delete-sprite')) {
                e.stopPropagation();
                deleteSpriteForExpression(expression, previewFile);
                return;
            }
            if (e.target.closest('.ct-sm-remove-label')) {
                e.stopPropagation();
                removeCustomLabel(expression);
                return;
            }
            uploadSpriteForExpression(expression);
        });

        container.appendChild(tile);
    }

    // Also show any extra sprites that don't match expected labels
    for (const [expression, files] of existingSpriteMap) {
        if (!expectedLabels.includes(expression)) {
            const previewFile = files[0];
            const tile = document.createElement('div');
            tile.className = 'ct-sm-expression-tile has-sprite extra';
            tile.dataset.expression = expression;

            tile.innerHTML = `
                <div class="ct-sm-expression-preview">
                    <img src="${previewFile.imageSrc}" alt="${expression}">
                    ${files.length > 1 ? `<span class="ct-sm-expression-count">${files.length}</span>` : ''}
                    <span class="ct-sm-extra-badge">Extra</span>
                </div>
                <div class="ct-sm-expression-label">${expression}</div>
            `;

            tile.addEventListener('click', () => uploadSpriteForExpression(expression));
            container.appendChild(tile);
        }
    }
}

/**
 * Upload a sprite for a specific expression label
 */
async function uploadSpriteForExpression(expressionLabel) {
    const char = characterList[currentCharacterIndex];
    if (!char) {
        toastr.error('No character selected');
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { uploadSprite } = await import('../core/upload-manager.js');
            toastr.info(`Uploading ${expressionLabel}...`);

            // Build path based on outfit
            const targetLabel = selectedOutfit === 'default'
                ? expressionLabel
                : `${selectedOutfit}/${expressionLabel}`;

            await uploadSprite(char.folderName, targetLabel, file);

            // Refresh sprites
            char.sprites = await getSpritesList(char.folderName);
            renderExpressionGrid(char);

            toastr.success(`Uploaded: ${expressionLabel}`);
        } catch (error) {
            toastr.error(`Failed: ${error.message}`);
        }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * Remove a custom label (LLM mode only)
 */
async function removeCustomLabel(label) {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Remove from character profile
    if (settings.characterExpressionProfiles?.[charFolder]?.customLabels) {
        settings.characterExpressionProfiles[charFolder].customLabels =
            settings.characterExpressionProfiles[charFolder].customLabels.filter(l => l !== label);
        await saveSettings();
    }

    // Remove from session state
    customLabels = customLabels.filter(l => l !== label);

    renderExpressionGrid(char);
    toastr.success(`Removed label: ${label}`);
}

/**
 * Delete a sprite file for an expression
 */
async function deleteSpriteForExpression(expressionLabel, spriteFile) {
    const char = characterList[currentCharacterIndex];
    if (!char || !spriteFile) {
        toastr.error('No sprite to delete');
        return;
    }

    // Confirm deletion
    const confirmed = confirm(`Delete sprite "${expressionLabel}"?\n\nThis will permanently remove the image file.`);
    if (!confirmed) return;

    try {
        // Extract filename from path
        const filename = spriteFile.imageSrc?.split('/').pop() || spriteFile.label;

        // Call ST's sprite delete API
        const response = await fetch('/api/sprites/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                name: char.folderName,
                label: filename.replace(/\.[^/.]+$/, '') // Remove extension
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        // Refresh sprites list
        char.sprites = await getSpritesList(char.folderName);

        // Clear sprite cache for this character
        if (spriteCache && char.folderName) {
            delete spriteCache[char.folderName];
        }

        renderExpressionGrid(char);
        toastr.success(`Deleted: ${expressionLabel}`);
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Failed to delete sprite:`, error);
        toastr.error(`Failed to delete: ${error.message}`);
    }
}

/**
 * Render character trigger chips
 */
function renderTriggers(char) {
    const container = document.querySelector('.ct-sm-trigger-chips');
    const outfitTriggersContainer = document.querySelector('.ct-sm-outfit-triggers');
    if (!container) return;

    // Character name triggers
    container.innerHTML = '';
    for (const trigger of char.triggers) {
        const chip = document.createElement('span');
        chip.className = 'ct-sm-trigger-chip';
        chip.innerHTML = `
            <span class="ct-sm-trigger-text">${trigger}</span>
            <button class="ct-sm-trigger-remove" data-trigger="${trigger}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        chip.querySelector('.ct-sm-trigger-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeTrigger(trigger);
        });
        container.appendChild(chip);
    }

    // Outfit triggers
    if (outfitTriggersContainer) {
        outfitTriggersContainer.innerHTML = '';

        for (const outfit of char.outfits) {
            if (outfit === 'default') continue;

            const triggers = char.outfitTriggers?.[outfit] || [];
            const row = document.createElement('div');
            row.className = 'ct-sm-outfit-trigger-row';

            row.innerHTML = `
                <span class="ct-sm-outfit-trigger-label">${outfit}</span>
                <span class="ct-sm-outfit-trigger-arrow">→</span>
                <div class="ct-sm-outfit-trigger-values">
                    ${triggers.map(t => `<span class="ct-sm-mini-chip">${t}</span>`).join('')}
                    <button class="ct-sm-add-outfit-trigger" data-outfit="${outfit}">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            `;

            row.querySelector('.ct-sm-add-outfit-trigger').addEventListener('click', () => {
                addOutfitTrigger(outfit);
            });

            outfitTriggersContainer.appendChild(row);
        }
    }
}

/**
 * Render party dock at bottom
 */
function renderPartyDock() {
    const container = document.querySelector('.ct-sm-party-members');
    if (!container) return;

    container.innerHTML = '';

    for (let i = 0; i < characterList.length; i++) {
        const char = characterList[i];
        const member = document.createElement('div');
        member.className = `ct-sm-party-member ${i === currentCharacterIndex ? 'active' : ''}`;
        member.dataset.index = i;

        if (char.avatar) {
            member.innerHTML = `<img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}">`;
        } else {
            member.innerHTML = `<span class="ct-sm-party-initial">${char.name.charAt(0).toUpperCase()}</span>`;
        }

        // Add badge for NPC
        if (char.isNpc) {
            member.innerHTML += `<span class="ct-sm-party-npc-badge">NPC</span>`;
        }

        member.addEventListener('click', () => selectCharacter(i));
        container.appendChild(member);
    }

    // Add character button
    const addBtn = document.createElement('div');
    addBtn.className = 'ct-sm-party-member ct-sm-party-add';
    addBtn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
    addBtn.addEventListener('click', () => addNpc());
    container.appendChild(addBtn);
}

/**
 * Render empty state when no characters
 */
function renderEmptyState() {
    const content = document.querySelector('.ct-sm-content');
    if (!content) return;

    content.innerHTML = `
        <div class="ct-sm-empty-state">
            <i class="fa-solid fa-ghost"></i>
            <p>No character loaded</p>
            <span>Open a chat to manage sprites</span>
        </div>
    `;
}

// =============================================================================
// INTERACTION HANDLERS
// =============================================================================

function selectCharacter(index) {
    currentCharacterIndex = index;
    selectedOutfit = 'default';
    renderCurrentCharacter();
}

function selectOutfit(outfit) {
    selectedOutfit = outfit;
    const char = characterList[currentCharacterIndex];
    renderOutfitCarousel(char);
    renderExpressionGrid(char);
}

function navigateCharacter(direction) {
    const newIndex = currentCharacterIndex + direction;
    if (newIndex >= 0 && newIndex < characterList.length) {
        selectCharacter(newIndex);
    }
}

async function addNpc() {
    const name = await showInputModal('Add NPC', 'Enter NPC name...');
    if (!name) return;

    // Validate duplicate name
    const existingChar = characterList.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existingChar) {
        if (typeof toastr !== 'undefined') {
            toastr.error(`Character with name "${name}" already exists!`);
        }
        return;
    }

    const folderName = await showInputModal('Sprite Folder', 'Leave blank to use NPC name', name);

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

    // Load sprites
    const newChar = characterList[characterList.length - 1];
    try {
        newChar.sprites = await getSpritesList(newChar.folderName);

        // Auto-detect outfits from sprite structure
        const detectedOutfits = new Set(['default']);
        for (const sprite of newChar.sprites) {
            const pathParts = sprite.label?.split('/') || [];
            if (pathParts.length > 1) {
                detectedOutfits.add(pathParts[0]);
            }
        }
        newChar.outfits = [...detectedOutfits];
    } catch (e) {
        console.debug(`[${MODULE_NAME}] No sprites found for ${name}`);
        if (typeof toastr !== 'undefined') {
            toastr.warning(`NPC "${name}" added, but no sprites found in folder "${newChar.folderName}"`);
        }
    }

    await saveNpcData();
    selectCharacter(characterList.length - 1);

    if (typeof toastr !== 'undefined') {
        toastr.success(`NPC "${name}" added successfully!`);
    }
}

async function addOutfit() {
    const name = await showInputModal('Add Outfit', 'Enter outfit name...');
    if (!name) return;

    const char = characterList[currentCharacterIndex];
    if (!char.outfits.includes(name)) {
        char.outfits.push(name);
        char.outfitTriggers[name] = [];
        await saveNpcData();
        renderOutfitCarousel(char);
        renderTriggers(char);
    }
}

async function addExpression() {
    const char = characterList[currentCharacterIndex];
    if (!char) {
        toastr.error('No character selected');
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const expressionName = await showInputModal(
            'New Expression',
            'Enter expression name',
            ''
        );
        if (!expressionName) return;

        try {
            const { uploadSprite } = await import('../core/upload-manager.js');
            toastr.info('Uploading...');
            await uploadSprite(char.folderName, expressionName, file);

            // Refresh sprites
            char.sprites = await getSpritesList(char.folderName);
            renderExpressionGrid(char);

            toastr.success(`Added: "${expressionName}"`);
        } catch (error) {
            toastr.error(`Failed: ${error.message}`);
        }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

function previewExpression(expression, files) {
    // TODO: Open a preview modal or show larger preview
    console.log(`Preview: ${expression}`, files);
    toastr.info(`${expression}: ${files.length} sprite(s)`, 'Expression Preview');
}

async function removeTrigger(trigger) {
    const char = characterList[currentCharacterIndex];
    char.triggers = char.triggers.filter(t => t !== trigger);
    await saveNpcData();
    renderTriggers(char);
}

async function addTrigger() {
    const trigger = await showInputModal('Add Trigger', 'Enter trigger phrase...');
    if (!trigger) return;

    const char = characterList[currentCharacterIndex];
    if (!char.triggers.includes(trigger)) {
        char.triggers.push(trigger);
        await saveNpcData();
        renderTriggers(char);
    }
}

async function addOutfitTrigger(outfit) {
    const trigger = await showInputModal(`Add Trigger for "${outfit}"`, 'Enter trigger phrase...');
    if (!trigger) return;

    const char = characterList[currentCharacterIndex];
    if (!char.outfitTriggers[outfit]) {
        char.outfitTriggers[outfit] = [];
    }
    if (!char.outfitTriggers[outfit].includes(trigger)) {
        char.outfitTriggers[outfit].push(trigger);
        await saveNpcData();
        renderTriggers(char);
    }
}

/**
 * Edit an existing NPC's properties
 * @param {number} npcIndex - Index of NPC in characterList
 */
async function editNpc(npcIndex) {
    const npc = characterList[npcIndex];
    if (!npc || !npc.isNpc) {
        if (typeof toastr !== 'undefined') {
            toastr.error('Can only edit NPCs, not main characters');
        }
        return;
    }

    // Edit name
    const newName = await showInputModal('Edit NPC Name', 'Enter new name...', npc.name);
    if (!newName) return;

    // Validate duplicate name (excluding self)
    const existingChar = characterList.find((c, i) =>
        i !== npcIndex && c.name.toLowerCase() === newName.toLowerCase()
    );
    if (existingChar) {
        if (typeof toastr !== 'undefined') {
            toastr.error(`Character with name "${newName}" already exists!`);
        }
        return;
    }

    // Edit folder name
    const newFolderName = await showInputModal(
        'Edit Sprite Folder',
        'Enter folder name...',
        npc.folderName
    );
    if (!newFolderName) return;

    // Update NPC
    npc.name = newName;
    npc.folderName = newFolderName;

    // Update triggers to include new name if old name was a trigger
    if (npc.triggers.includes(npc.name)) {
        npc.triggers = npc.triggers.filter(t => t !== npc.name);
        npc.triggers.push(newName);
    }

    // Reload sprites from new folder
    try {
        npc.sprites = await getSpritesList(npc.folderName);

        // Auto-detect outfits
        const detectedOutfits = new Set(['default']);
        for (const sprite of npc.sprites) {
            const pathParts = sprite.label?.split('/') || [];
            if (pathParts.length > 1) {
                detectedOutfits.add(pathParts[0]);
            }
        }
        npc.outfits = [...detectedOutfits];
    } catch (e) {
        console.debug(`[${MODULE_NAME}] No sprites found for ${newName}`);
        if (typeof toastr !== 'undefined') {
            toastr.warning(`Sprites not found in folder "${newFolderName}"`);
        }
    }

    await saveNpcData();
    renderCurrentCharacter();

    if (typeof toastr !== 'undefined') {
        toastr.success(`NPC "${newName}" updated successfully!`);
    }
}

/**
 * Delete an NPC
 * @param {number} npcIndex - Index of NPC in characterList
 */
async function deleteNpc(npcIndex) {
    const npc = characterList[npcIndex];
    if (!npc) return;

    if (!npc.isNpc) {
        if (typeof toastr !== 'undefined') {
            toastr.error('Cannot delete main characters, only NPCs');
        }
        return;
    }

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

    // Update UI - select previous character or stay at 0
    if (currentCharacterIndex >= characterList.length) {
        currentCharacterIndex = Math.max(0, characterList.length - 1);
    }
    renderPartyDock();
    renderCurrentCharacter();

    if (typeof toastr !== 'undefined') {
        toastr.success(`NPC "${npc.name}" deleted`);
    }
}

// =============================================================================
// MODAL CONTROL
// =============================================================================

/**
 * Open the sprite manager modal
 * @param {string|null} targetCharacterFolder - Optional folder name to navigate to
 */
export async function openSpriteManager(targetCharacterFolder = null) {
    if (isOpen) return;

    // Create modal if doesn't exist
    let modal = document.getElementById('ct-sprite-manager-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', generateModalHtml());
        modal = document.getElementById('ct-sprite-manager-modal');
        bindModalEvents();
    }

    // Load data
    characterList = await getCharactersForCard();
    currentCharacterIndex = 0;
    selectedOutfit = 'default';

    // If a target character was specified, find and select it
    if (targetCharacterFolder) {
        const targetIndex = characterList.findIndex(c => c.folderName === targetCharacterFolder);
        if (targetIndex !== -1) {
            currentCharacterIndex = targetIndex;
        }
    }

    // Show modal
    modal.classList.add('open');
    isOpen = true;

    // Initialize method selector to default state
    selectMethod(selectedMethod);

    // Render
    renderCurrentCharacter();
}

/**
 * Close the sprite manager modal
 */
export function closeSpriteManager() {
    const modal = document.getElementById('ct-sprite-manager-modal');
    if (modal) {
        modal.classList.remove('open');
    }
    isOpen = false;

    // Remove keyboard listener to prevent memory leak
    if (keyboardHandler) {
        document.removeEventListener('keydown', keyboardHandler);
        keyboardHandler = null;
    }
    modalEventsBound = false;
}

/**
 * Bind event listeners to modal (only once)
 */
function bindModalEvents() {
    if (modalEventsBound) return;

    const modal = document.getElementById('ct-sprite-manager-modal');
    if (!modal) return;

    // Close button
    modal.querySelector('.ct-sm-close')?.addEventListener('click', closeSpriteManager);

    // Backdrop click
    modal.querySelector('.ct-sm-backdrop')?.addEventListener('click', closeSpriteManager);

    // Character navigation
    modal.querySelector('.ct-sm-flip-prev')?.addEventListener('click', () => navigateCharacter(-1));
    modal.querySelector('.ct-sm-flip-next')?.addEventListener('click', () => navigateCharacter(1));
    modal.querySelector('.ct-sm-add-char')?.addEventListener('click', addNpc);
    modal.querySelector('.ct-sm-edit-char')?.addEventListener('click', () => editNpc(currentCharacterIndex));
    modal.querySelector('.ct-sm-delete-char')?.addEventListener('click', () => deleteNpc(currentCharacterIndex));

    // Outfit carousel arrows - scroll by card width
    modal.querySelector('.ct-sm-carousel-left')?.addEventListener('click', () => {
        const carousel = modal.querySelector('.ct-sm-outfit-carousel');
        if (carousel) carousel.scrollBy({ left: -220, behavior: 'smooth' });
    });
    modal.querySelector('.ct-sm-carousel-right')?.addEventListener('click', () => {
        const carousel = modal.querySelector('.ct-sm-outfit-carousel');
        if (carousel) carousel.scrollBy({ left: 220, behavior: 'smooth' });
    });

    // Add trigger button
    modal.querySelector('.ct-sm-add-trigger')?.addEventListener('click', addTrigger);

    // Expression Method tabs
    modal.querySelectorAll('.ct-sm-method-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const method = tab.dataset.method;
            selectMethod(method);
        });
    });

    // BERT model selector
    modal.querySelector('#ct_sm_bert_model')?.addEventListener('change', (e) => {
        selectedBertModel = e.target.value;
        const char = characterList[currentCharacterIndex];
        if (char) renderExpressionGrid(char);
    });

    // LLM import labels button
    modal.querySelector('#ct_sm_import_labels')?.addEventListener('click', importLabelsFromBert);

    // Add custom label button (LLM mode)
    modal.querySelector('#ct_sm_add_label')?.addEventListener('click', addCustomLabel);

    // Add custom emotion button (VectHare mode)
    modal.querySelector('#ct_sm_add_emotion')?.addEventListener('click', addVectHareEmotion);

    // Keyboard navigation - store reference for cleanup
    keyboardHandler = (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') closeSpriteManager();
        if (e.key === 'ArrowLeft') navigateCharacter(-1);
        if (e.key === 'ArrowRight') navigateCharacter(1);
    };
    document.addEventListener('keydown', keyboardHandler);

    modalEventsBound = true;
}

/**
 * Select expression method and update UI
 */
function selectMethod(method) {
    selectedMethod = method;

    const modal = document.getElementById('ct-sprite-manager-modal');
    if (!modal) return;

    // Update tab active states
    modal.querySelectorAll('.ct-sm-method-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.method === method);
    });

    // Show/hide method options
    modal.querySelector('.ct-sm-bert-options').style.display = method === 'bert' ? 'block' : 'none';
    modal.querySelector('.ct-sm-llm-options').style.display = method === 'llm' ? 'block' : 'none';
    modal.querySelector('.ct-sm-vecthare-options').style.display = method === 'vecthare' ? 'block' : 'none';

    // Render LLM suggestions if in LLM mode
    if (method === 'llm') {
        renderLLMSuggestions();
    }

    // Render VectHare status and emotions if in VectHare mode
    if (method === 'vecthare') {
        renderVectHareStatus();
        renderVectHareEmotions();
    }

    // Re-render expression grid with new labels
    const char = characterList[currentCharacterIndex];
    if (char) renderExpressionGrid(char);
}

/**
 * Render suggested expression labels for LLM mode
 * Shows 3 grayed-out suggestions user can click to add
 */
function renderLLMSuggestions() {
    const container = document.getElementById('ct_sm_llm_suggestions');
    if (!container) return;

    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';
    const settings = getSettings();

    // Get currently used labels
    const currentLabels = new Set(getExpectedLabels());

    // Suggested emotions not currently in use (from common RP emotions)
    const allSuggestions = [
        'embarrassment', 'excitement', 'nervousness', 'confusion',
        'curiosity', 'desire', 'disappointment', 'amusement',
        'caring', 'pride', 'relief', 'admiration', 'gratitude',
        'smug', 'flustered', 'teasing', 'shy', 'pouty'
    ];

    // Filter to suggestions not already used
    const available = allSuggestions.filter(s => !currentLabels.has(s));

    // Show 3 random suggestions
    const shuffled = available.sort(() => Math.random() - 0.5);
    const suggestions = shuffled.slice(0, 3);

    container.innerHTML = suggestions.map(label => `
        <button class="ct-sm-suggestion-chip" data-label="${label}" title="Click to add '${label}' label">
            <span>${label}</span>
            <i class="fa-solid fa-plus"></i>
        </button>
    `).join('');

    // Bind click handlers
    container.querySelectorAll('.ct-sm-suggestion-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            const label = chip.dataset.label;
            await addLabelToCharacter(label);
            renderLLMSuggestions(); // Refresh suggestions
        });
    });
}

/**
 * Add a label to the current character's LLM profile
 */
async function addLabelToCharacter(label) {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    if (!settings.characterExpressionProfiles) {
        settings.characterExpressionProfiles = {};
    }
    if (!settings.characterExpressionProfiles[charFolder]) {
        settings.characterExpressionProfiles[charFolder] = { customLabels: [] };
    }

    const normalized = label.toLowerCase().trim();
    if (!settings.characterExpressionProfiles[charFolder].customLabels.includes(normalized)) {
        settings.characterExpressionProfiles[charFolder].customLabels.push(normalized);
        customLabels = settings.characterExpressionProfiles[charFolder].customLabels;
        await saveSettings();
        renderExpressionGrid(char);
        toastr.success(`Added label: ${normalized}`);
    }
}

/**
 * Render VectHare connection status
 */
function renderVectHareStatus() {
    const container = document.getElementById('ct_sm_vecthare_status');
    if (!container) return;

    // Check if VectHare extension is available
    const vecthareAvailable = window.VectHare !== undefined ||
        document.querySelector('[id*="vecthare"]') !== null;

    if (vecthareAvailable) {
        container.innerHTML = `
            <i class="fa-solid fa-circle-check" style="color: var(--bw-coral);"></i>
            <span style="color: var(--bw-coral);">VectHare Active</span>
        `;
    } else {
        container.innerHTML = `
            <i class="fa-solid fa-circle-xmark" style="color: var(--ct-text-muted);"></i>
            <span>VectHare not detected. Install it for semantic emotion matching.</span>
        `;
    }
}

/**
 * Render VectHare custom emotion chips
 */
function renderVectHareEmotions() {
    const container = document.getElementById('ct_sm_emotion_chips');
    if (!container) return;

    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Get global and character-specific custom emotions
    const globalEmotions = settings.customEmotions || {};
    const charEmotions = settings.characterEmotions?.[charFolder]?.customEmotions || {};

    // Merge them
    const allEmotions = { ...globalEmotions, ...charEmotions };
    const emotionNames = Object.keys(allEmotions);

    if (emotionNames.length === 0) {
        container.innerHTML = `
            <div class="ct-sm-no-emotions">
                <i class="fa-solid fa-ghost"></i>
                <span>No custom emotions defined. Click + to add one.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = emotionNames.map(name => `
        <div class="ct-sm-emotion-chip" data-emotion="${name}">
            <span class="ct-sm-emotion-name">${name}</span>
            <button class="ct-sm-emotion-remove" data-emotion="${name}" title="Remove emotion">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');

    // Bind remove handlers
    container.querySelectorAll('.ct-sm-emotion-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const emotionName = btn.dataset.emotion;
            await removeVectHareEmotion(emotionName);
        });
    });
}

/**
 * Add a custom VectHare emotion
 */
async function addVectHareEmotion() {
    const emotionName = await showInputModal('Add Custom Emotion', 'Enter emotion name (e.g., smug, flustered)');
    if (!emotionName) return;

    const normalized = emotionName.toLowerCase().trim().replace(/\s+/g, '_');

    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Add to character-specific emotions
    if (!settings.characterEmotions) {
        settings.characterEmotions = {};
    }
    if (!settings.characterEmotions[charFolder]) {
        settings.characterEmotions[charFolder] = { customEmotions: {} };
    }

    if (settings.characterEmotions[charFolder].customEmotions[normalized]) {
        toastr.warning(`Emotion "${normalized}" already exists`);
        return;
    }

    // Add with default keyword boost
    settings.characterEmotions[charFolder].customEmotions[normalized] = {
        keywords: [normalized],
        boost: 1.0
    };

    await saveSettings();
    renderVectHareEmotions();
    renderExpressionGrid(char);
    toastr.success(`Added emotion: ${normalized}`);
}

/**
 * Remove a VectHare custom emotion
 */
async function removeVectHareEmotion(emotionName) {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Remove from character-specific emotions
    if (settings.characterEmotions?.[charFolder]?.customEmotions?.[emotionName]) {
        delete settings.characterEmotions[charFolder].customEmotions[emotionName];
        await saveSettings();
        renderVectHareEmotions();
        renderExpressionGrid(char);
        toastr.success(`Removed emotion: ${emotionName}`);
    }

    // Also check global emotions
    if (settings.customEmotions?.[emotionName]) {
        delete settings.customEmotions[emotionName];
        await saveSettings();
        renderVectHareEmotions();
        renderExpressionGrid(char);
        toastr.success(`Removed emotion: ${emotionName}`);
    }
}

/**
 * Import labels from a BERT model into LLM custom labels
 */
async function importLabelsFromBert() {
    const sourceSelect = document.getElementById('ct_sm_llm_source');
    const sourceModel = sourceSelect?.value;

    if (!sourceModel) {
        toastr.warning('Select a preset to import from');
        return;
    }

    const model = CLASSIFIER_MODELS[sourceModel];
    if (!model?.labelList) {
        toastr.error('Model not found');
        return;
    }

    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Initialize character profile if needed
    if (!settings.characterExpressionProfiles) {
        settings.characterExpressionProfiles = {};
    }
    if (!settings.characterExpressionProfiles[charFolder]) {
        settings.characterExpressionProfiles[charFolder] = { customLabels: [] };
    }

    // Merge labels (no duplicates)
    const existing = settings.characterExpressionProfiles[charFolder].customLabels || [];
    const merged = [...new Set([...existing, ...model.labelList])];
    settings.characterExpressionProfiles[charFolder].customLabels = merged;

    // Also update session state
    customLabels = merged;

    await saveSettings();
    renderExpressionGrid(char);

    toastr.success(`Imported ${model.labels} labels from ${model.name}`);
}

/**
 * Add a custom label (LLM/VectHare mode)
 */
async function addCustomLabel() {
    const labelName = await showInputModal('Add Custom Label', 'Enter label name (e.g., smug, flustered)');
    if (!labelName) return;

    const normalized = labelName.toLowerCase().trim().replace(/\s+/g, '_');

    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // For VectHare, we'd open the custom emotion editor
    if (selectedMethod === 'vecthare') {
        // TODO: Open VectHare emotion editor modal
        toastr.info('VectHare emotion editor coming soon - for now, use the Custom Emotions tab in settings');
        return;
    }

    // For LLM, add to character profile
    if (!settings.characterExpressionProfiles) {
        settings.characterExpressionProfiles = {};
    }
    if (!settings.characterExpressionProfiles[charFolder]) {
        settings.characterExpressionProfiles[charFolder] = { customLabels: [] };
    }

    if (!settings.characterExpressionProfiles[charFolder].customLabels.includes(normalized)) {
        settings.characterExpressionProfiles[charFolder].customLabels.push(normalized);
        customLabels = settings.characterExpressionProfiles[charFolder].customLabels;
        await saveSettings();
        renderExpressionGrid(char);
        toastr.success(`Added label: ${normalized}`);
    } else {
        toastr.warning(`Label "${normalized}" already exists`);
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { MODULE_NAME, showInputModal };
