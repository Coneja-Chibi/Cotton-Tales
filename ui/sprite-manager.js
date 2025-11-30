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
import { EXTENSION_NAME, DEFAULT_EXPRESSIONS, CLASSIFIER_MODELS, EXPRESSION_API, EMOTION_PRESETS } from '../core/constants.js';
import { getSpritesList, spriteCache, validateImages } from '../ct-expressions.js';
import { addVector, removeVector, setKeyword, removeKeyword, rebuildCharacterVectors } from '../core/custom-classifier.js';

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

    // Check if we have a chat open with a specific character
    const hasActiveChat = context.characterId !== undefined && characters[this_chid];

    if (hasActiveChat) {
        // Chat is open - load current character and their NPCs
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
    } else {
        // No chat open - load ALL characters for sprite browsing/management
        for (const char of characters) {
            if (!char || !char.name) continue;
            const folderName = char.avatar?.replace(/\.[^/.]+$/, '') || char.name;

            result.push({
                name: char.name,
                avatar: char.avatar,
                isNpc: false,
                folderName: folderName,
                sprites: [],
                outfits: ['default'],
                triggers: [char.name],
                outfitTriggers: {}
            });
        }
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

            <!-- Main Content Area - Everything scrolls together -->
            <div class="ct-sm-content">
                <!-- Character Flipbook Navigation -->
                <div class="ct-sm-flipbook">
                    <!-- Navigation Row with Card -->
                    <div class="ct-sm-flipbook-row">
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
                    </div>

                    <!-- Character Counter -->
                    <div class="ct-sm-counter">
                        <span class="ct-sm-counter-current">1</span>
                        <span class="ct-sm-counter-sep">of</span>
                        <span class="ct-sm-counter-total">1</span>
                    </div>

                    <!-- Action Buttons -->
                    <div class="ct-sm-flipbook-actions">
                        <button class="ct-sm-action-btn ct-sm-edit-char" title="Edit NPC" style="display: none;">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="ct-sm-action-btn ct-sm-delete-char" title="Delete NPC" style="display: none;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                        <button class="ct-sm-action-btn ct-sm-add-char" title="Add NPC">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                </div>
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
                        <div class="ct-sm-sharing-toggle-inline">
                            <label class="ct-sm-control-label" title="When off, each method has its own sprite configuration for this character">
                                <input type="checkbox" id="ct_sm_share_sprites" checked />
                                Share sprites across methods
                            </label>
                        </div>
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
                        <p class="ct-sm-method-hint">
                            <i class="fa-solid fa-vector-square"></i>
                            VectHare uses semantic matching. Add <strong>keywords</strong> to emotions and adjust <strong>weights</strong> (1.0-3.0x).
                        </p>
                        <div class="ct-sm-preset-selector">
                            <label class="ct-sm-control-label">Emotion Preset:</label>
                            <select class="ct-sm-model-select" id="ct_sm_vecthare_preset">
                                <option value="">-- Choose a preset --</option>
                                <option value="basic_6">Basic 6 (Ekman)</option>
                                <option value="extended_12">Extended 12</option>
                                <option value="roleplay_18">Roleplay 18</option>
                                <option value="nsfw_14">NSFW 14</option>
                                <option value="anime_16">Anime 16</option>
                                <option value="go_emotions_28">GoEmotions 28</option>
                                <option value="empty">Start Empty</option>
                            </select>
                            <button class="ct-sm-btn-small" id="ct_sm_apply_preset">Apply</button>
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

    // Update sharing toggle state
    updateSharingToggle();
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
            // Users have full control over their label set - no auto-populating
            const charProfile = settings.characterExpressionProfiles?.[charFolder];
            const customList = charProfile?.customLabels || [];

            console.log('[CT getExpectedLabels LLM] charFolder:', charFolder);
            console.log('[CT getExpectedLabels LLM] charProfile:', charProfile);
            console.log('[CT getExpectedLabels LLM] customList:', customList);

            // If a profile exists for this character, always use their custom list (even if empty)
            // This respects the user's choice to have an empty/minimal set
            if (charProfile) {
                console.log('[CT getExpectedLabels LLM] Returning user\'s customList with', customList.length, 'items');
                return customList;
            }

            // No profile yet - show only existing sprites (if any) so user can start fresh
            // Don't auto-populate with emotions they didn't ask for
            if (existingSpriteLabels.size > 0) {
                console.log('[CT getExpectedLabels LLM] No profile, showing', existingSpriteLabels.size, 'existing sprites');
                return [...existingSpriteLabels].sort();
            }

            // Brand new - show empty grid, user will add labels via "Add Label" button
            console.log('[CT getExpectedLabels LLM] No profile and no sprites, returning empty');
            return [];
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

    // Get settings for VectHare emotion configs
    const settings = getSettings();
    const charFolder = char?.folderName || '';

    // Get per-character fallback and thinking expressions
    const charProfile = settings.characterExpressionProfiles?.[charFolder] || {};
    const charFallback = charProfile.fallbackExpression || settings.fallbackExpression || 'neutral';
    const charThinking = charProfile.thinkingExpression || null;

    // Render a tile for EACH expected label
    for (const expression of expectedLabels) {
        const expressionLower = expression.toLowerCase();
        const files = existingSpriteMap.get(expressionLower) || [];
        const hasSprite = files.length > 0;
        const previewFile = files[0];

        // In LLM mode, ALL labels can be removed (user controls the label set)
        const canRemoveLabel = selectedMethod === 'llm';

        // VectHare mode: render expanded tiles with keyword/weight configuration
        if (selectedMethod === 'vecthare') {
            const tile = renderVectHareExpressionTile(expression, files, hasSprite, previewFile, settings, charFolder);
            container.appendChild(tile);
            continue;
        }

        // Check if this is the fallback or thinking expression
        const isFallback = expressionLower === charFallback.toLowerCase();
        const isThinking = charThinking && expressionLower === charThinking.toLowerCase();

        // BERT/LLM mode: standard compact tiles
        const tile = document.createElement('div');
        tile.className = `ct-sm-expression-tile ${hasSprite ? 'has-sprite' : 'empty'} ${isFallback ? 'is-fallback' : ''} ${isThinking ? 'is-thinking' : ''}`;
        tile.dataset.expression = expression;

        tile.innerHTML = `
            <div class="ct-sm-expression-preview ${hasSprite ? '' : 'ct-sm-empty-slot'}">
                ${hasSprite
                    ? `<img src="${previewFile.imageSrc}" alt="${expression}">`
                    : `<i class="fa-solid fa-plus"></i>`
                }
                ${files.length > 1 ? `<span class="ct-sm-expression-count">${files.length}</span>` : ''}
                ${isFallback ? `<span class="ct-sm-fallback-badge" title="Default/Fallback expression"><i class="fa-solid fa-star"></i></span>` : ''}
                ${isThinking ? `<span class="ct-sm-thinking-badge" title="Thinking expression"><i class="fa-solid fa-brain"></i></span>` : ''}
                ${hasSprite ? `
                    <button class="ct-sm-delete-sprite" data-expression="${expression}" title="Delete sprite">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : ''}
                ${canRemoveLabel ? `
                    <button class="ct-sm-remove-label" data-label="${expression}" title="Remove label">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                ` : ''}
            </div>
            <div class="ct-sm-expression-label">${expression}</div>
            <div class="ct-sm-expression-actions">
                <button class="ct-sm-set-fallback ${isFallback ? 'active' : ''}" data-expression="${expression}" title="Set as fallback">
                    <i class="fa-solid fa-star"></i>
                </button>
                <button class="ct-sm-set-thinking ${isThinking ? 'active' : ''}" data-expression="${expression}" title="Set as thinking">
                    <i class="fa-solid fa-brain"></i>
                </button>
            </div>
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
            if (e.target.closest('.ct-sm-set-fallback')) {
                e.stopPropagation();
                setCharacterFallback(charFolder, expression);
                return;
            }
            if (e.target.closest('.ct-sm-set-thinking')) {
                e.stopPropagation();
                setCharacterThinking(charFolder, expression);
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
 * Render a VectHare-specific expression tile with expandable keyword configuration
 * Clean, focused design - sprite preview + keywords list
 * @param {string} expression - Expression label
 * @param {Array} files - Sprite files for this expression
 * @param {boolean} hasSprite - Whether sprite exists
 * @param {Object} previewFile - First sprite file for preview
 * @param {Object} settings - Current settings
 * @param {string} charFolder - Character folder name
 * @returns {HTMLElement} Configured tile element
 */
function renderVectHareExpressionTile(expression, files, hasSprite, previewFile, settings, charFolder) {
    // Get existing emotion config for this expression (per-character or global)
    const charEmotionConfig = settings.characterEmotions?.[charFolder]?.customEmotions?.[expression];
    const globalEmotionConfig = settings.customEmotions?.[expression];
    const emotionConfig = charEmotionConfig || globalEmotionConfig || null;

    // Get per-character fallback and thinking expressions
    const charProfile = settings.characterExpressionProfiles?.[charFolder] || {};
    const charFallback = charProfile.fallbackExpression || settings.fallbackExpression || 'neutral';
    const charThinking = charProfile.thinkingExpression || null;
    const expressionLower = expression.toLowerCase();
    const isFallback = expressionLower === charFallback.toLowerCase();
    const isThinking = charThinking && expressionLower === charThinking.toLowerCase();

    // VECTORS: Semantic phrases that get vectorized and matched
    const vectors = emotionConfig?.vectors || [];
    const vectorCount = vectors.length;

    // KEYWORDS: Literal keyword triggers with boost weights
    const keywords = emotionConfig?.keywords || {};
    const keywordEntries = Object.entries(keywords);
    const keywordCount = keywordEntries.length;

    // Generate vector chips HTML
    const vectorChipsHtml = vectors.map((phrase, idx) => `
        <div class="ct-sm-vh-vector-chip" data-index="${idx}">
            <span class="ct-sm-vh-vector-text">${escapeHtml(phrase)}</span>
            <button class="ct-sm-vh-vector-remove" data-index="${idx}" title="Remove">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');

    // Generate keyword chips HTML
    const keywordChipsHtml = keywordEntries.map(([kw, weight]) => `
        <div class="ct-sm-vh-keyword-chip" data-keyword="${kw.replace(/"/g, '&quot;')}" data-weight="${weight}">
            <span class="ct-sm-vh-kw-text">${escapeHtml(kw)}</span>
            <span class="ct-sm-vh-kw-weight">${weight}x</span>
            <button class="ct-sm-vh-kw-remove" title="Remove">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');

    const tile = document.createElement('div');
    tile.className = `ct-sm-expression-tile ct-sm-vh-tile ${hasSprite ? 'has-sprite' : 'empty'} ${isFallback ? 'is-fallback' : ''} ${isThinking ? 'is-thinking' : ''}`;
    tile.dataset.expression = expression;
    tile.dataset.expanded = 'false';

    tile.innerHTML = `
        <!-- COMPACT HEADER -->
        <div class="ct-sm-vh-header">
            <div class="ct-sm-vh-preview ${hasSprite && previewFile?.imageSrc ? '' : 'empty'}" data-upload-trigger>
                ${hasSprite && previewFile?.imageSrc
                    ? `<img src="${previewFile.imageSrc}" alt="${expression}">`
                    : `<i class="fa-solid fa-image"></i>`
                }
            </div>
            <div class="ct-sm-vh-info">
                <span class="ct-sm-vh-label">${expression}</span>
                <div class="ct-sm-vh-stats">
                    <span class="ct-sm-vh-vector-count" title="Semantic vectors">
                        <i class="fa-solid fa-diagram-project"></i> ${vectorCount}
                    </span>
                    <span class="ct-sm-vh-keyword-count" title="Keyword boosters">
                        <i class="fa-solid fa-bolt"></i> ${keywordCount}
                    </span>
                </div>
            </div>
            <div class="ct-sm-vh-header-actions">
                <button class="ct-sm-set-fallback ${isFallback ? 'active' : ''}" data-expression="${expression}" title="Set as fallback">
                    <i class="fa-solid fa-star"></i>
                </button>
                <button class="ct-sm-vh-expand-toggle" title="Configure">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
        </div>

        <!-- EXPANDABLE CONFIG -->
        <div class="ct-sm-vh-config">
            <!-- VECTORS SECTION -->
            <div class="ct-sm-vh-section">
                <div class="ct-sm-vh-section-header">
                    <i class="fa-solid fa-diagram-project"></i>
                    <span>Semantic Vectors</span>
                    <small>Phrases that map to this emotion</small>
                </div>
                <div class="ct-sm-vh-vector-chips">
                    ${vectorChipsHtml || '<span class="ct-sm-vh-empty-hint">No vectors yet</span>'}
                </div>
                <button class="ct-sm-vh-add-vector">
                    <i class="fa-solid fa-plus"></i> Add Vector Phrase
                </button>
            </div>

            <!-- KEYWORDS SECTION -->
            <div class="ct-sm-vh-section">
                <div class="ct-sm-vh-section-header">
                    <i class="fa-solid fa-bolt"></i>
                    <span>Keyword Boosters</span>
                    <small>Words that boost this emotion's score</small>
                </div>
                <div class="ct-sm-vh-keyword-chips">
                    ${keywordChipsHtml || '<span class="ct-sm-vh-empty-hint">No keywords yet</span>'}
                </div>
                <button class="ct-sm-vh-add-keyword">
                    <i class="fa-solid fa-plus"></i> Add Keyword
                </button>
            </div>

            <div class="ct-sm-vh-config-footer">
                <button class="ct-sm-vh-remove-emotion" data-emotion="${expression}">
                    <i class="fa-solid fa-trash"></i> Remove Emotion
                </button>
            </div>
        </div>
    `;

    // Bind all events
    bindVectHareTileEvents(tile, expression, charFolder, previewFile, hasSprite);

    return tile;
}

/**
 * Bind all events for a VectHare tile
 */
function bindVectHareTileEvents(tile, expression, charFolder, previewFile, hasSprite) {
    // Toggle expansion on header click
    tile.querySelector('.ct-sm-vh-header').addEventListener('click', (e) => {
        if (e.target.closest('[data-upload-trigger]')) return;
        if (e.target.closest('.ct-sm-vh-expand-toggle')) return;
        if (e.target.closest('.ct-sm-set-fallback')) return;
        toggleVectHareTileExpansion(tile);
    });

    // Expand toggle button
    tile.querySelector('.ct-sm-vh-expand-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVectHareTileExpansion(tile);
    });

    // Fallback button
    tile.querySelector('.ct-sm-set-fallback')?.addEventListener('click', (e) => {
        e.stopPropagation();
        setCharacterFallback(charFolder, expression);
    });

    // Upload sprite on preview click
    tile.querySelector('[data-upload-trigger]').addEventListener('click', (e) => {
        e.stopPropagation();
        uploadSpriteForExpression(expression);
    });

    // ADD VECTOR button
    tile.querySelector('.ct-sm-vh-add-vector')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showAddVectHareVectorModal(expression, charFolder);
    });

    // REMOVE VECTOR buttons
    tile.querySelectorAll('.ct-sm-vh-vector-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            await removeVectHareVector(expression, idx, charFolder);
        });
    });

    // ADD KEYWORD button
    tile.querySelector('.ct-sm-vh-add-keyword')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showAddVectHareKeywordModal(expression, charFolder);
    });

    // Keyword chip clicks (edit weight)
    tile.querySelectorAll('.ct-sm-vh-keyword-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (e.target.closest('.ct-sm-vh-kw-remove')) return;
            e.stopPropagation();
            const keyword = chip.dataset.keyword;
            const weight = parseFloat(chip.dataset.weight);
            showVectHareWeightEditor(tile, expression, keyword, weight, charFolder);
        });
    });

    // Remove keyword buttons
    tile.querySelectorAll('.ct-sm-vh-kw-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const chip = btn.closest('.ct-sm-vh-keyword-chip');
            const keyword = chip.dataset.keyword;
            await removeVectHareKeyword(expression, keyword, charFolder);
        });
    });

    // Remove emotion button
    tile.querySelector('.ct-sm-vh-remove-emotion')?.addEventListener('click', (e) => {
        e.stopPropagation();
        removeVectHareEmotion(expression);
    });
}

/**
 * Toggle VectHare tile expansion
 */
function toggleVectHareTileExpansion(tile) {
    const isExpanded = tile.dataset.expanded === 'true';
    const configPanel = tile.querySelector('.ct-sm-vh-config');

    // Toggle state
    tile.dataset.expanded = (!isExpanded).toString();
    configPanel.style.display = !isExpanded ? 'flex' : 'none';

    // Collapse other expanded tiles
    document.querySelectorAll('.ct-sm-vh-tile[data-expanded="true"]').forEach(otherTile => {
        if (otherTile !== tile) {
            otherTile.dataset.expanded = 'false';
            otherTile.querySelector('.ct-sm-vh-config').style.display = 'none';
        }
    });
}

/**
 * Show modal to add a new keyword
 */
async function showAddVectHareKeywordModal(expression, charFolder) {
    const keyword = await showInputModal(
        `Add Keyword for "${expression}"`,
        'Enter keyword or /regex/ pattern (e.g., happy, /laugh\\w*/i)'
    );

    if (!keyword || !keyword.trim()) return;

    await addVectHareKeyword(expression, keyword.trim(), 1.5, charFolder);
}

/**
 * Show inline weight editor for a keyword
 */
function showVectHareWeightEditor(tile, expression, keyword, currentWeight, charFolder) {
    const editor = tile.querySelector('.ct-sm-vh-weight-editor');
    const slider = editor.querySelector('.ct-sm-vh-weight-slider');
    const valueDisplay = editor.querySelector('.ct-sm-vh-slider-value');
    const keywordDisplay = editor.querySelector('.ct-sm-vh-editor-keyword');

    // Update UI
    keywordDisplay.textContent = keyword;
    slider.value = currentWeight;
    valueDisplay.textContent = `${currentWeight}x`;
    editor.style.display = 'block';

    // Remove old listeners
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);

    // Slider input event (live update)
    newSlider.addEventListener('input', () => {
        valueDisplay.textContent = `${newSlider.value}x`;
    });

    // Slider change event (save)
    newSlider.addEventListener('change', async () => {
        await updateVectHareKeywordWeight(expression, keyword, parseFloat(newSlider.value), charFolder);
    });
}

/**
 * Add a new keyword to an emotion with weight
 */

/**
 * Show modal to add a new vector phrase
 */
async function showAddVectHareVectorModal(expression, charFolder) {
    const phrase = await showInputModal(
        `Add Vector for "${expression}"`,
        'Enter a semantic phrase (e.g., "I\'m so happy!", "This is wonderful!")'
    );
    if (!phrase) return;
    await addVectHareVector(expression, phrase.trim(), charFolder);
}

/**
 * Add a vector phrase to an emotion
 */
async function addVectHareVector(expression, phrase, charFolder) {
    // Use custom-classifier API which handles settings + VectHare sync
    await addVector(charFolder, expression, phrase);

    // Re-render
    const char = characterList[currentCharacterIndex];
    renderExpressionGrid(char);

    toastr.success(`Vector added to "${expression}"`);
}

/**
 * Remove a vector phrase from an emotion
 */
async function removeVectHareVector(expression, index, charFolder) {
    // Use custom-classifier API which handles settings + VectHare sync
    await removeVector(charFolder, expression, index);

    // Re-render
    const char = characterList[currentCharacterIndex];
    renderExpressionGrid(char);

    toastr.success(`Vector removed from "${expression}"`);
}

async function addVectHareKeyword(expression, keyword, weight, charFolder) {
    // Use custom-classifier API
    await setKeyword(charFolder, expression, keyword, weight);

    // Re-render
    const char = characterList[currentCharacterIndex];
    renderExpressionGrid(char);
    toastr.success(`Added: ${keyword} (${weight}x)`);
}

/**
 * Remove a keyword from an emotion
 */
async function removeVectHareKeyword(expression, keyword, charFolder) {
    // Use custom-classifier API
    await removeKeyword(charFolder, expression, keyword);

    // Re-render
    const char = characterList[currentCharacterIndex];
    renderExpressionGrid(char);
    toastr.success(`Removed: ${keyword}`);
}

/**
 * Update weight for a specific keyword
 */
async function updateVectHareKeywordWeight(expression, keyword, newWeight, charFolder) {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];

    const emotionConfig = settings.characterEmotions?.[charFolder]?.customEmotions?.[expression];
    if (!emotionConfig?.keywords) return;

    emotionConfig.keywords[keyword] = newWeight;
    emotionConfig.updatedAt = Date.now();

    await saveSettings();
    renderExpressionGrid(char);
    console.log(`[CT VectHare] Updated ${keyword} weight to ${newWeight}x`);
}

/**
 * Apply a preset emotion pack to the current character
 * @param {string} presetId - ID of the preset to apply
 */
async function applyVectHarePreset(presetId) {
    const preset = EMOTION_PRESETS[presetId];
    if (!preset) {
        toastr.error('Unknown preset');
        return;
    }

    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Initialize structure
    if (!settings.characterEmotions) settings.characterEmotions = {};
    if (!settings.characterEmotions[charFolder]) {
        settings.characterEmotions[charFolder] = { customEmotions: {} };
    }

    // Apply preset emotions
    settings.characterEmotions[charFolder].customEmotions = {};
    for (const [emotion, config] of Object.entries(preset.emotions)) {
        settings.characterEmotions[charFolder].customEmotions[emotion] = {
            keywords: { ...config.keywords },
            enabled: true,
            updatedAt: Date.now(),
        };
    }

    await saveSettings();
    renderExpressionGrid(char);
    toastr.success(`Applied preset: ${preset.name}`);
}

/**
 * Toggle sprite sharing for current character
 * @param {boolean} share - Whether to share sprites across methods
 */
async function toggleSpriteSharing(share) {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    if (!settings.characterExpressionProfiles) settings.characterExpressionProfiles = {};
    if (!settings.characterExpressionProfiles[charFolder]) {
        settings.characterExpressionProfiles[charFolder] = {};
    }

    settings.characterExpressionProfiles[charFolder].shareSpritesAcrossMethods = share;
    await saveSettings();

    toastr.success(share ? 'Sprites shared across methods' : 'VectHare has separate sprite config');
}

/**
 * Remove a VectHare emotion configuration
 * @param {string} expression - Expression to remove
 */
async function removeVectHareEmotion(expression) {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    // Remove from character-specific config
    if (settings.characterEmotions?.[charFolder]?.customEmotions?.[expression]) {
        delete settings.characterEmotions[charFolder].customEmotions[expression];
        await saveSettings();
    }

    // Remove from global config
    if (settings.customEmotions?.[expression]) {
        delete settings.customEmotions[expression];
        await saveSettings();
    }

    renderExpressionGrid(char);
    toastr.success(`Removed emotion: ${expression}`);
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
 * Set the fallback expression for a character
 */
async function setCharacterFallback(charFolder, expression) {
    const settings = getSettings();

    if (!settings.characterExpressionProfiles) {
        settings.characterExpressionProfiles = {};
    }
    if (!settings.characterExpressionProfiles[charFolder]) {
        settings.characterExpressionProfiles[charFolder] = {};
    }

    // Toggle off if already selected
    if (settings.characterExpressionProfiles[charFolder].fallbackExpression === expression) {
        delete settings.characterExpressionProfiles[charFolder].fallbackExpression;
        toastr.info(`Cleared fallback (using global default)`);
    } else {
        settings.characterExpressionProfiles[charFolder].fallbackExpression = expression;
        toastr.success(`Set fallback: ${expression}`);
    }

    await saveSettings();
    const char = characterList[currentCharacterIndex];
    renderExpressionGrid(char);
}

/**
 * Set the thinking expression for a character
 */
async function setCharacterThinking(charFolder, expression) {
    const settings = getSettings();

    if (!settings.characterExpressionProfiles) {
        settings.characterExpressionProfiles = {};
    }
    if (!settings.characterExpressionProfiles[charFolder]) {
        settings.characterExpressionProfiles[charFolder] = {};
    }

    // Toggle off if already selected
    if (settings.characterExpressionProfiles[charFolder].thinkingExpression === expression) {
        delete settings.characterExpressionProfiles[charFolder].thinkingExpression;
        toastr.info(`Cleared thinking expression`);
    } else {
        settings.characterExpressionProfiles[charFolder].thinkingExpression = expression;
        toastr.success(`Set thinking: ${expression}`);
    }

    await saveSettings();
    const char = characterList[currentCharacterIndex];
    renderExpressionGrid(char);
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
            <i class="fa-solid fa-folder-open"></i>
            <p>No characters found</p>
            <span>Create a character in SillyTavern to manage their sprites</span>
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

    console.log('[CT SpriteManager] Opening with targetCharacterFolder:', targetCharacterFolder);

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

    console.log('[CT SpriteManager] characterList:', characterList.map(c => ({ name: c.name, folderName: c.folderName })));

    // If a target character was specified, find and select it
    if (targetCharacterFolder) {
        const targetIndex = characterList.findIndex(c => c.folderName === targetCharacterFolder);
        console.log('[CT SpriteManager] Looking for folder:', targetCharacterFolder, 'found at index:', targetIndex);
        if (targetIndex !== -1) {
            currentCharacterIndex = targetIndex;
        } else {
            console.warn('[CT SpriteManager] Target character not found in list!');
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

    // VectHare preset apply button
    modal.querySelector('#ct_sm_apply_preset')?.addEventListener('click', () => {
        const presetSelect = modal.querySelector('#ct_sm_vecthare_preset');
        const presetId = presetSelect?.value;
        if (presetId) {
            applyVectHarePreset(presetId);
        } else {
            toastr.warning('Select a preset first');
        }
    });

    // VectHare sprite sharing toggle
    modal.querySelector('#ct_sm_share_sprites')?.addEventListener('change', (e) => {
        toggleSpriteSharing(e.target.checked);
    });

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

    // Update VectHare UI state if in VectHare mode
    if (method === 'vecthare') {
        updateVectHareUI();
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
 * Update sharing toggle state for current character
 */
function updateSharingToggle() {
    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';

    const sharingToggle = document.getElementById('ct_sm_share_sprites');
    if (sharingToggle) {
        const share = settings.characterExpressionProfiles?.[charFolder]?.shareSpritesAcrossMethods ?? true;
        sharingToggle.checked = share;
    }
}

/**
 * Update VectHare-specific UI (preset dropdown)
 */
function updateVectHareUI() {
    // Reset preset dropdown
    const presetSelect = document.getElementById('ct_sm_vecthare_preset');
    if (presetSelect) {
        presetSelect.value = '';
    }
}

/**
 * Import labels from a BERT model into LLM custom labels
 */
async function importLabelsFromBert() {
    const sourceSelect = document.getElementById('ct_sm_llm_source');
    const sourceModel = sourceSelect?.value;

    console.log('[CT Import] Starting import, sourceModel:', sourceModel);

    if (!sourceModel) {
        toastr.warning('Select a preset to import from');
        return;
    }

    const model = CLASSIFIER_MODELS[sourceModel];
    console.log('[CT Import] Found model:', model?.name, 'with', model?.labelList?.length, 'labels');

    if (!model?.labelList) {
        toastr.error('Model not found');
        return;
    }

    const settings = getSettings();
    const char = characterList[currentCharacterIndex];
    const charFolder = char?.folderName || '';
    console.log('[CT Import] charFolder:', charFolder, 'char:', char?.name);

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

    console.log('[CT Import] Merged labels:', merged.length, 'labels:', merged);

    // Also update session state
    customLabels = merged;

    await saveSettings();

    // Verify settings were saved correctly
    const verifySettings = getSettings();
    console.log('[CT Import] Verify after save - characterExpressionProfiles:', verifySettings.characterExpressionProfiles);
    console.log('[CT Import] Verify after save - charFolder customLabels:', verifySettings.characterExpressionProfiles?.[charFolder]?.customLabels);

    console.log('[CT Import] Settings saved, calling renderExpressionGrid');
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
