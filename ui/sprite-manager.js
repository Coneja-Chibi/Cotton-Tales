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
import { EXTENSION_NAME, DEFAULT_EXPRESSIONS } from '../core/constants.js';
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

    // Load sprites for each character
    for (const char of result) {
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
    }

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
                <div class="ct-sm-section">
                    <div class="ct-sm-section-header">
                        <i class="fa-solid fa-shirt"></i>
                        <span>Outfits</span>
                    </div>
                    <div class="ct-sm-outfit-carousel-wrapper">
                        <button class="ct-sm-carousel-arrow ct-sm-carousel-left">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <div class="ct-sm-outfit-carousel"></div>
                        <button class="ct-sm-carousel-arrow ct-sm-carousel-right">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
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
            avatarEl.innerHTML = `<img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}">`;
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
 * Render expression grid for selected outfit
 */
function renderExpressionGrid(char) {
    const container = document.querySelector('.ct-sm-expression-grid');
    const outfitLabel = document.querySelector('.ct-sm-outfit-label');
    if (!container) return;

    container.innerHTML = '';

    if (outfitLabel) {
        outfitLabel.textContent = `— ${selectedOutfit}`;
    }

    // Filter sprites for selected outfit
    const outfitSprites = char.sprites.filter(s => {
        if (selectedOutfit === 'default') {
            return !s.label?.includes('/');
        }
        return s.label?.startsWith(selectedOutfit + '/');
    });

    // Group by expression label
    const expressionMap = new Map();
    for (const sprite of outfitSprites) {
        const label = sprite.label?.split('/').pop() || sprite.label;
        if (!expressionMap.has(label)) {
            expressionMap.set(label, []);
        }
        expressionMap.get(label).push(...(sprite.files || []));
    }

    for (const [expression, files] of expressionMap) {
        const previewFile = files[0];
        const tile = document.createElement('div');
        tile.className = 'ct-sm-expression-tile';
        tile.dataset.expression = expression;

        tile.innerHTML = `
            <div class="ct-sm-expression-preview">
                ${previewFile
                    ? `<img src="${previewFile.imageSrc}" alt="${expression}">`
                    : `<i class="fa-solid fa-image"></i>`
                }
                ${files.length > 1 ? `<span class="ct-sm-expression-count">${files.length}</span>` : ''}
            </div>
            <div class="ct-sm-expression-label">${expression}</div>
        `;

        tile.addEventListener('click', () => previewExpression(expression, files));
        container.appendChild(tile);
    }

    // Add expression button
    const addTile = document.createElement('div');
    addTile.className = 'ct-sm-expression-tile ct-sm-expression-add';
    addTile.innerHTML = `
        <div class="ct-sm-expression-preview">
            <i class="fa-solid fa-plus"></i>
        </div>
        <div class="ct-sm-expression-label">Add</div>
    `;
    addTile.addEventListener('click', () => addExpression());
    container.appendChild(addTile);
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
    const name = prompt('Enter NPC name:');
    if (!name) return;

    const folderName = prompt('Sprite folder name (leave blank to use NPC name):', name);

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
    } catch (e) {
        console.debug(`[${MODULE_NAME}] No sprites found for ${name}`);
    }

    await saveNpcData();
    selectCharacter(characterList.length - 1);
}

async function addOutfit() {
    const name = prompt('Enter outfit name:');
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
    toastr.info('To add expressions, place sprite images in the character\'s sprite folder.', 'Adding Expressions');
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
    const trigger = prompt('Enter trigger phrase:');
    if (!trigger) return;

    const char = characterList[currentCharacterIndex];
    if (!char.triggers.includes(trigger)) {
        char.triggers.push(trigger);
        await saveNpcData();
        renderTriggers(char);
    }
}

async function addOutfitTrigger(outfit) {
    const trigger = prompt(`Enter trigger phrase for "${outfit}":`);
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

// =============================================================================
// MODAL CONTROL
// =============================================================================

/**
 * Open the sprite manager modal
 */
export async function openSpriteManager() {
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

    // Show modal
    modal.classList.add('open');
    isOpen = true;

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
}

/**
 * Bind event listeners to modal
 */
function bindModalEvents() {
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

    // Outfit carousel arrows
    modal.querySelector('.ct-sm-carousel-left')?.addEventListener('click', () => {
        const carousel = modal.querySelector('.ct-sm-outfit-carousel');
        if (carousel) carousel.scrollBy({ left: -200, behavior: 'smooth' });
    });
    modal.querySelector('.ct-sm-carousel-right')?.addEventListener('click', () => {
        const carousel = modal.querySelector('.ct-sm-outfit-carousel');
        if (carousel) carousel.scrollBy({ left: 200, behavior: 'smooth' });
    });

    // Add trigger button
    modal.querySelector('.ct-sm-add-trigger')?.addEventListener('click', addTrigger);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') closeSpriteManager();
        if (e.key === 'ArrowLeft') navigateCharacter(-1);
        if (e.key === 'ArrowRight') navigateCharacter(1);
    });
}

// =============================================================================
// EXPORTS
// =============================================================================

export { MODULE_NAME };
