/**
 * ============================================================================
 * COTTON-TALES SCENE PARSER
 * ============================================================================
 * Parses Director output to extract narrative text and scene directions.
 *
 * Director responses contain:
 * 1. Narrative text (displayed in chat)
 * 2. ```vn-scene JSON block (scene directions)
 *
 * This module extracts both, validates the JSON, and applies scene changes.
 *
 * @version 1.0.0
 * ============================================================================
 */

import { updateSceneState, getSceneState } from './macro-resolver.js';
import { getSettings } from './settings-manager.js';
import { showChoices, hideChoices, initChoicePanel, isChoicePanelVisible } from '../ui/choice-panel.js';

const MODULE_NAME = 'CT-SceneParser';

// =============================================================================
// PARSING
// =============================================================================

/**
 * Pattern to match ```vn-scene code blocks
 */
const VN_SCENE_PATTERN = /```vn-scene\s*([\s\S]*?)```/gi;

/**
 * Alternative patterns for flexibility (some LLMs may vary format)
 */
const ALT_PATTERNS = [
    /```json\s*\/\/\s*vn-scene\s*([\s\S]*?)```/gi,
    /\[VN-SCENE\]\s*([\s\S]*?)\[\/VN-SCENE\]/gi,
    /<vn-scene>\s*([\s\S]*?)<\/vn-scene>/gi,
];

/**
 * Parse a Director response to extract narrative and scene data
 * @param {string} response - Full Director response
 * @returns {{ narrative: string, scene: Object|null, raw: string }}
 */
export function parseDirectorResponse(response) {
    if (!response || typeof response !== 'string') {
        return { narrative: '', scene: null, raw: '' };
    }

    let sceneJson = null;
    let narrative = response;

    // Try main pattern first
    const mainMatch = VN_SCENE_PATTERN.exec(response);
    VN_SCENE_PATTERN.lastIndex = 0; // Reset regex state

    if (mainMatch) {
        sceneJson = mainMatch[1].trim();
        narrative = response.replace(mainMatch[0], '').trim();
    } else {
        // Try alternative patterns
        for (const pattern of ALT_PATTERNS) {
            const altMatch = pattern.exec(response);
            pattern.lastIndex = 0;

            if (altMatch) {
                sceneJson = altMatch[1].trim();
                narrative = response.replace(altMatch[0], '').trim();
                break;
            }
        }
    }

    // Parse JSON if found
    let scene = null;
    if (sceneJson) {
        try {
            scene = JSON.parse(sceneJson);
            scene = validateAndNormalizeScene(scene);
        } catch (error) {
            console.warn(`[${MODULE_NAME}] Failed to parse scene JSON:`, error.message);
            console.debug(`[${MODULE_NAME}] Raw JSON:`, sceneJson);
            scene = null;
        }
    }

    return {
        narrative,
        scene,
        raw: sceneJson || '',
    };
}

/**
 * Validate and normalize scene data
 * @param {Object} scene - Raw parsed scene object
 * @returns {Object} Normalized scene object
 */
function validateAndNormalizeScene(scene) {
    const normalized = {
        scene: {
            background: null,
            music: null,
            sfx: null,
        },
        characters: [],
        choices: [],
    };

    // Scene settings
    if (scene.scene && typeof scene.scene === 'object') {
        normalized.scene.background = sanitizeString(scene.scene.background);
        normalized.scene.music = sanitizeString(scene.scene.music);
        normalized.scene.sfx = sanitizeString(scene.scene.sfx);
    }

    // Characters
    if (Array.isArray(scene.characters)) {
        normalized.characters = scene.characters
            .filter(c => c && typeof c.name === 'string')
            .map(c => ({
                name: sanitizeString(c.name),
                expression: sanitizeString(c.expression),
                outfit: sanitizeString(c.outfit),
                position: normalizePosition(c.position),
                action: normalizeAction(c.action),
            }));
    }

    // Choices
    if (Array.isArray(scene.choices)) {
        normalized.choices = scene.choices
            .filter(c => c && typeof c.label === 'string')
            .map(c => ({
                label: sanitizeString(c.label) || 'Continue',
                prompt: sanitizeString(c.prompt) || '',
            }));
    }

    return normalized;
}

/**
 * Sanitize a string value
 * @param {any} value - Value to sanitize
 * @returns {string|null} Sanitized string or null
 */
function sanitizeString(value) {
    if (value === null || value === undefined || value === 'null') {
        return null;
    }
    if (typeof value !== 'string') {
        return String(value);
    }
    return value.trim() || null;
}

/**
 * Normalize position value
 * @param {any} position - Position value
 * @returns {string} Normalized position
 */
function normalizePosition(position) {
    const valid = ['left', 'center', 'right'];
    const normalized = String(position || 'center').toLowerCase();
    return valid.includes(normalized) ? normalized : 'center';
}

/**
 * Normalize action value
 * @param {any} action - Action value
 * @returns {string|null} Normalized action
 */
function normalizeAction(action) {
    if (!action || action === 'null') return null;
    const valid = ['enters', 'exits', 'speaks'];
    const normalized = String(action).toLowerCase();
    return valid.includes(normalized) ? normalized : null;
}

// =============================================================================
// SCENE APPLICATION
// =============================================================================

/**
 * Apply parsed scene data to the VN display
 * @param {Object} scene - Parsed and validated scene object
 * @returns {{ applied: boolean, changes: string[] }}
 */
export function applyScene(scene) {
    if (!scene) {
        return { applied: false, changes: [] };
    }

    const changes = [];
    const currentState = getSceneState();
    const newState = {};

    // Apply background change
    if (scene.scene?.background && scene.scene.background !== currentState.background) {
        newState.background = scene.scene.background;
        changes.push(`background: ${scene.scene.background}`);
        applyBackground(scene.scene.background);
    }

    // Apply music change
    if (scene.scene?.music && scene.scene.music !== currentState.music) {
        newState.music = scene.scene.music;
        changes.push(`music: ${scene.scene.music}`);
        applyMusic(scene.scene.music);
    }

    // Apply SFX (one-shot, doesn't update state)
    if (scene.scene?.sfx) {
        changes.push(`sfx: ${scene.scene.sfx}`);
        applySfx(scene.scene.sfx);
    }

    // Apply character changes
    if (scene.characters?.length > 0) {
        const charChanges = applyCharacters(scene.characters, currentState.characters);
        newState.characters = charChanges.newCharacters;
        changes.push(...charChanges.changes);
    }

    // Update state
    if (Object.keys(newState).length > 0) {
        updateSceneState(newState);
    }

    // Return choices for UI to handle
    if (scene.choices?.length > 0) {
        changes.push(`choices: ${scene.choices.length}`);
    }

    console.log(`[${MODULE_NAME}] Applied scene:`, changes);

    return {
        applied: true,
        changes,
        choices: scene.choices || [],
    };
}

/**
 * Apply background change
 * @param {string} background - Background name
 */
function applyBackground(background) {
    // Dispatch event for background handler to pick up
    const event = new CustomEvent('ct:background:change', {
        detail: { background },
    });
    document.dispatchEvent(event);

    console.debug(`[${MODULE_NAME}] Background change requested: ${background}`);
}

/**
 * Apply music change
 * @param {string} track - Music track name
 */
function applyMusic(track) {
    const event = new CustomEvent('ct:music:change', {
        detail: { track },
    });
    document.dispatchEvent(event);

    console.debug(`[${MODULE_NAME}] Music change requested: ${track}`);
}

/**
 * Apply sound effect
 * @param {string} sfx - SFX name
 */
function applySfx(sfx) {
    const event = new CustomEvent('ct:sfx:play', {
        detail: { sfx },
    });
    document.dispatchEvent(event);

    console.debug(`[${MODULE_NAME}] SFX requested: ${sfx}`);
}

/**
 * Apply character changes
 * @param {Object[]} newChars - New character states
 * @param {Object[]} currentChars - Current character states
 * @returns {{ newCharacters: Object[], changes: string[] }}
 */
function applyCharacters(newChars, currentChars) {
    const changes = [];
    const charMap = new Map(currentChars.map(c => [c.name, c]));

    for (const char of newChars) {
        const current = charMap.get(char.name);

        // Handle enters/exits
        if (char.action === 'enters' && !current) {
            charMap.set(char.name, char);
            changes.push(`${char.name} enters`);

            const event = new CustomEvent('ct:character:enter', {
                detail: { character: char },
            });
            document.dispatchEvent(event);
        } else if (char.action === 'exits' && current) {
            charMap.delete(char.name);
            changes.push(`${char.name} exits`);

            const event = new CustomEvent('ct:character:exit', {
                detail: { name: char.name },
            });
            document.dispatchEvent(event);
        } else {
            // Update existing or add new
            const merged = {
                ...current,
                ...char,
                expression: char.expression || current?.expression || 'neutral',
                outfit: char.outfit || current?.outfit || 'default',
                position: char.position || current?.position || 'center',
            };

            // Check what changed
            if (current) {
                if (char.expression && char.expression !== current.expression) {
                    changes.push(`${char.name}: ${char.expression}`);
                }
                if (char.outfit && char.outfit !== current.outfit) {
                    changes.push(`${char.name} outfit: ${char.outfit}`);
                }
                if (char.position && char.position !== current.position) {
                    changes.push(`${char.name} moved: ${char.position}`);
                }
            }

            charMap.set(char.name, merged);

            const event = new CustomEvent('ct:character:update', {
                detail: { character: merged },
            });
            document.dispatchEvent(event);
        }
    }

    return {
        newCharacters: Array.from(charMap.values()),
        changes,
    };
}

// =============================================================================
// CHOICE HANDLING
// =============================================================================

/**
 * Display choices to the user using the choice panel component
 * @param {Object[]} choices - Array of choice objects
 * @returns {Promise<{text: string, isCustom: boolean}|null>} Selected choice or null if cancelled
 */
export async function displayChoices(choices) {
    if (!choices || choices.length === 0) {
        return null;
    }

    // Initialize panel if needed
    initChoicePanel();

    return new Promise((resolve) => {
        let resolved = false;

        const onChoice = (choiceText, isCustom) => {
            if (resolved) return;
            resolved = true;

            console.log(`[${MODULE_NAME}] Choice selected: "${choiceText}" (custom: ${isCustom})`);

            // Dispatch legacy event for compatibility
            const event = new CustomEvent('ct:choices:selected', {
                detail: {
                    choice: {
                        label: choiceText,
                        prompt: choiceText,
                        isCustom,
                    },
                },
            });
            document.dispatchEvent(event);

            resolve({ text: choiceText, isCustom });
        };

        // Show the choice panel with options
        showChoices(choices, onChoice);

        // Auto-resolve after timeout (prevents hanging)
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                hideChoices();
                resolve(null);
            }
        }, 300000); // 5 minute timeout
    });
}

/**
 * Inject selected choice as user message
 * @param {Object|string} choice - Selected choice object or string
 */
export function injectChoice(choice) {
    if (!choice) return;

    const choiceText = typeof choice === 'string' ? choice : (choice.prompt || choice.label || choice.text);

    const event = new CustomEvent('ct:choice:inject', {
        detail: {
            text: choiceText,
            label: typeof choice === 'object' ? choice.label : choiceText,
            prompt: typeof choice === 'object' ? choice.prompt : choiceText,
            isCustom: typeof choice === 'object' ? choice.isCustom : false,
        },
    });
    document.dispatchEvent(event);

    console.log(`[${MODULE_NAME}] Choice injected: "${choiceText}"`);
}

/**
 * Check if choices are currently displayed
 * @returns {boolean}
 */
export function areChoicesVisible() {
    return isChoicePanelVisible();
}

/**
 * Dismiss currently shown choices
 */
export function dismissChoices() {
    hideChoices();
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if a response contains VN scene data
 * @param {string} response - Response to check
 * @returns {boolean} True if scene data is present
 */
export function hasSceneData(response) {
    if (!response) return false;

    VN_SCENE_PATTERN.lastIndex = 0;
    if (VN_SCENE_PATTERN.test(response)) return true;

    for (const pattern of ALT_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(response)) return true;
    }

    return false;
}

/**
 * Strip scene data from response (for clean display)
 * @param {string} response - Response to clean
 * @returns {string} Narrative only
 */
export function stripSceneData(response) {
    if (!response) return '';

    let clean = response;

    VN_SCENE_PATTERN.lastIndex = 0;
    clean = clean.replace(VN_SCENE_PATTERN, '');

    for (const pattern of ALT_PATTERNS) {
        pattern.lastIndex = 0;
        clean = clean.replace(pattern, '');
    }

    return clean.trim();
}

/**
 * Extract just the scene JSON from a response
 * @param {string} response - Response to extract from
 * @returns {string|null} Raw JSON string or null
 */
export function extractSceneJson(response) {
    const parsed = parseDirectorResponse(response);
    return parsed.raw || null;
}
