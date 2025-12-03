/**
 * ============================================================================
 * COTTON-TALES MACRO RESOLVER
 * ============================================================================
 * Resolves {{ct_*}} macros for Director prompts.
 *
 * ST handles standard macros ({{char}}, {{user}}, etc.) via substituteParams().
 * This module handles Cotton-Tales specific macros prefixed with ct_.
 *
 * @version 1.0.0
 * ============================================================================
 */

import { getSettings } from './settings-manager.js';
import { getContext } from '../../../../extensions.js';

const MODULE_NAME = 'CT-MacroResolver';

// =============================================================================
// RUNTIME STATE
// =============================================================================

/**
 * Current scene state - tracks what's currently displayed
 * Updated by scene-parser.js when Director output is applied
 */
const sceneState = {
    background: null,
    characters: [], // { name, position, expression, outfit }
    music: null,
    location: null,
};

/**
 * Update the current scene state
 * @param {Object} newState - Partial state to merge
 */
export function updateSceneState(newState) {
    Object.assign(sceneState, newState);
    console.debug(`[${MODULE_NAME}] Scene state updated:`, sceneState);
}

/**
 * Get current scene state
 * @returns {Object} Current scene state
 */
export function getSceneState() {
    return { ...sceneState };
}

/**
 * Reset scene state (on chat change, etc.)
 */
export function resetSceneState() {
    sceneState.background = null;
    sceneState.characters = [];
    sceneState.music = null;
    sceneState.location = null;
}

// =============================================================================
// ASSET FETCHERS
// =============================================================================

/**
 * Cache for expensive operations
 */
const cache = {
    backgrounds: null,
    backgroundsTimestamp: 0,
    expressions: {}, // { charFolder: string[] }
    outfits: {}, // { charFolder: string[] }
};

const CACHE_TTL = 30000; // 30 seconds

/**
 * Get all available backgrounds
 * @returns {Promise<string[]>} List of background filenames
 */
async function getBackgrounds() {
    const now = Date.now();
    if (cache.backgrounds && (now - cache.backgroundsTimestamp) < CACHE_TTL) {
        return cache.backgrounds;
    }

    try {
        const response = await fetch('/api/backgrounds/all');
        if (!response.ok) throw new Error('Failed to fetch backgrounds');

        const backgrounds = await response.json();
        cache.backgrounds = backgrounds.map(bg => {
            // Remove extension for cleaner output
            const name = typeof bg === 'string' ? bg : bg.name;
            return name.replace(/\.[^/.]+$/, '');
        });
        cache.backgroundsTimestamp = now;

        return cache.backgrounds;
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to fetch backgrounds:`, error);
        return [];
    }
}

/**
 * Get available expressions for a character
 * @param {string} charFolder - Character folder name
 * @returns {Promise<string[]>} List of expression names
 */
async function getCharacterExpressions(charFolder) {
    if (!charFolder) return [];

    if (cache.expressions[charFolder]) {
        return cache.expressions[charFolder];
    }

    try {
        const response = await fetch(`/api/sprites/get?name=${encodeURIComponent(charFolder)}`);
        if (!response.ok) return [];

        const sprites = await response.json();
        // sprites is array of filenames like "joy.png", "sad.png"
        const expressions = sprites
            .filter(s => typeof s === 'string' && !s.includes('/'))
            .map(s => s.replace(/\.[^/.]+$/, ''));

        cache.expressions[charFolder] = expressions;
        return expressions;
    } catch (error) {
        console.debug(`[${MODULE_NAME}] No sprites for ${charFolder}:`, error.message);
        return [];
    }
}

/**
 * Get available outfits for a character
 * @param {string} charFolder - Character folder name
 * @returns {Promise<string[]>} List of outfit names (subfolder names)
 */
async function getCharacterOutfits(charFolder) {
    if (!charFolder) return ['default'];

    if (cache.outfits[charFolder]) {
        return cache.outfits[charFolder];
    }

    try {
        const response = await fetch(`/api/sprites/get?name=${encodeURIComponent(charFolder)}`);
        if (!response.ok) return ['default'];

        const sprites = await response.json();
        // Look for paths with slashes (subfolders)
        const outfits = new Set(['default']);
        sprites.forEach(s => {
            if (typeof s === 'string' && s.includes('/')) {
                const folder = s.split('/')[0];
                outfits.add(folder);
            }
        });

        cache.outfits[charFolder] = Array.from(outfits);
        return cache.outfits[charFolder];
    } catch (error) {
        console.debug(`[${MODULE_NAME}] No outfits for ${charFolder}:`, error.message);
        return ['default'];
    }
}

/**
 * Clear cache for a specific character or all
 * @param {string} [charFolder] - Character to clear, or all if not specified
 */
export function clearCache(charFolder) {
    if (charFolder) {
        delete cache.expressions[charFolder];
        delete cache.outfits[charFolder];
    } else {
        cache.backgrounds = null;
        cache.expressions = {};
        cache.outfits = {};
    }
}

// =============================================================================
// NPC DATA
// =============================================================================

/**
 * Get NPCs for current card
 * @returns {Object} NPC data from settings
 */
function getCardNpcs() {
    const settings = getSettings();
    const context = getContext();
    const cardId = context?.characterId || context?.characters?.[context?.this_chid]?.avatar;

    if (!cardId || !settings.cardNpcs) {
        return {};
    }

    return settings.cardNpcs[cardId] || {};
}

/**
 * Format NPC data as structured text for the Director
 * @returns {string} Formatted NPC block
 */
function formatNpcData() {
    const npcs = getCardNpcs();
    const npcNames = Object.keys(npcs);

    if (npcNames.length === 0) {
        return 'No NPCs defined for this character.';
    }

    const lines = ['NPCs available:'];
    for (const [name, data] of Object.entries(npcs)) {
        const expressions = data.expressions?.length > 0
            ? `[expressions: ${data.expressions.join(', ')}]`
            : '';
        const outfits = data.outfits?.length > 0
            ? `[outfits: ${data.outfits.join(', ')}]`
            : '';
        lines.push(`- ${name} ${expressions} ${outfits}`.trim());
    }

    return lines.join('\n');
}

// =============================================================================
// MACRO DEFINITIONS
// =============================================================================

/**
 * All Cotton-Tales macro definitions
 * Each key is the macro name (without ct_ prefix and braces)
 */
const macroDefinitions = {
    // Background assets
    backgrounds: async () => {
        const settings = getSettings();
        const context = getContext();
        const cardId = context?.characterId;

        let backgrounds = await getBackgrounds();

        // Filter by enabled backgrounds if configured
        if (cardId && settings.enabledBackgrounds?.[cardId]) {
            const enabled = settings.enabledBackgrounds[cardId];
            backgrounds = backgrounds.filter(bg => enabled.includes(bg));
        }

        return backgrounds.join(', ');
    },

    bg_current: () => {
        return sceneState.background || 'none';
    },

    // Character sprites
    expressions: async () => {
        const context = getContext();
        const charName = context?.name2;
        if (!charName) return '';

        const expressions = await getCharacterExpressions(charName);
        return expressions.join(', ');
    },

    outfits: async () => {
        const context = getContext();
        const charName = context?.name2;
        if (!charName) return 'default';

        const outfits = await getCharacterOutfits(charName);
        return outfits.join(', ');
    },

    expression_current: () => {
        const context = getContext();
        const charName = context?.name2;
        if (!charName) return 'neutral';

        const charState = sceneState.characters.find(c => c.name === charName);
        return charState?.expression || 'neutral';
    },

    outfit_current: () => {
        const context = getContext();
        const charName = context?.name2;
        if (!charName) return 'default';

        const charState = sceneState.characters.find(c => c.name === charName);
        return charState?.outfit || 'default';
    },

    // NPCs
    npcs: () => {
        const npcs = getCardNpcs();
        return Object.keys(npcs).join(', ') || 'none';
    },

    npc_data: () => {
        return formatNpcData();
    },

    // Scene state
    scene_characters: () => {
        if (sceneState.characters.length === 0) {
            return 'No characters in scene';
        }

        return sceneState.characters
            .map(c => `${c.name} (${c.position || 'center'}, ${c.expression || 'neutral'})`)
            .join(', ');
    },

    scene_location: () => {
        if (sceneState.location) {
            return sceneState.location;
        }

        // Derive from background name
        if (sceneState.background) {
            // Convert "classroom_day" to "Classroom"
            const location = sceneState.background
                .split('_')[0]
                .replace(/([A-Z])/g, ' $1')
                .trim();
            return location.charAt(0).toUpperCase() + location.slice(1);
        }

        return 'Unknown';
    },

    // Audio (Phase 6 - placeholders for now)
    music: async () => {
        // TODO: Implement audio folder scanning
        return 'calm, tense, romantic, battle';
    },

    sfx: async () => {
        // TODO: Implement SFX folder scanning
        return 'door_open, footsteps, glass_break';
    },

    music_current: () => {
        return sceneState.music || 'none';
    },

    // Schema & settings
    vn_schema: () => {
        // Return the JSON schema the Director should use
        return JSON.stringify({
            scene: {
                background: 'string|null',
                music: 'string|null',
                sfx: 'string|null',
            },
            characters: [{
                name: 'string',
                expression: 'string|null',
                outfit: 'string|null',
                position: 'left|center|right',
                action: 'enters|exits|speaks|null',
            }],
            choices: [{
                label: 'string (button text)',
                prompt: 'string (what happens if selected)',
            }],
        }, null, 2);
    },

    choice_count: () => {
        const settings = getSettings();
        return String(settings.choiceCount || 3);
    },
};

// =============================================================================
// MAIN RESOLVER
// =============================================================================

/**
 * Resolve all {{ct_*}} macros in a string
 * @param {string} content - String containing macros
 * @returns {Promise<string>} String with macros resolved
 */
export async function resolveCtMacros(content) {
    if (!content || typeof content !== 'string') {
        return content || '';
    }

    // Match all {{ct_*}} patterns
    const macroPattern = /\{\{ct_([a-z_]+)\}\}/gi;
    const matches = [...content.matchAll(macroPattern)];

    if (matches.length === 0) {
        return content;
    }

    // Resolve all macros (some may be async)
    const replacements = new Map();

    for (const match of matches) {
        const fullMatch = match[0];
        const macroName = match[1].toLowerCase();

        if (replacements.has(fullMatch)) {
            continue; // Already resolved this macro
        }

        const resolver = macroDefinitions[macroName];
        if (resolver) {
            try {
                const value = await resolver();
                replacements.set(fullMatch, value);
            } catch (error) {
                console.error(`[${MODULE_NAME}] Failed to resolve {{ct_${macroName}}}:`, error);
                replacements.set(fullMatch, '');
            }
        } else {
            console.warn(`[${MODULE_NAME}] Unknown macro: {{ct_${macroName}}}`);
            replacements.set(fullMatch, '');
        }
    }

    // Apply all replacements
    let result = content;
    for (const [macro, value] of replacements) {
        result = result.split(macro).join(value);
    }

    return result;
}

/**
 * Check if a string contains any CT macros
 * @param {string} content - String to check
 * @returns {boolean} True if CT macros are present
 */
export function hasCtMacros(content) {
    return /\{\{ct_[a-z_]+\}\}/i.test(content);
}

/**
 * Get list of all available CT macro names
 * @returns {string[]} Array of macro names (without ct_ prefix)
 */
export function getAvailableMacros() {
    return Object.keys(macroDefinitions);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize macro resolver
 * Called on extension load
 */
export function initMacroResolver() {
    console.log(`[${MODULE_NAME}] Macro resolver initialized`);
    console.log(`[${MODULE_NAME}] Available macros: ${getAvailableMacros().map(m => `{{ct_${m}}}`).join(', ')}`);
}
