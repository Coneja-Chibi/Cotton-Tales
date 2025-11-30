/**
 * ============================================================================
 * COTTON-TALES SCENE LINTER - SCHEMA STRUCTURE FIXER
 * ============================================================================
 * Fixes 25+ structural issues where JSON is valid but schema is wrong.
 *
 * Categories:
 * - Missing required fields (scene, characters, choices)
 * - Wrong field names (common typos, alternatives)
 * - Wrong nesting (flat vs nested)
 * - Wrong types (object vs array, string vs object)
 * - Extra/unexpected fields (graceful handling)
 *
 * @version 1.0.0
 * ============================================================================
 */

const MODULE_NAME = 'CT-FixSchema';

// =============================================================================
// EXPECTED SCHEMA STRUCTURE
// =============================================================================

/**
 * Expected VN scene schema for reference
 */
const EXPECTED_SCHEMA = {
    scene: {
        background: 'string|null',
        music: 'string|null',
        sfx: 'string|null',
    },
    characters: [
        {
            name: 'string',
            expression: 'string|null',
            outfit: 'string|null',
            position: 'left|center|right',
            action: 'enters|exits|speaks|null',
        },
    ],
    choices: [
        {
            label: 'string',
            prompt: 'string',
        },
    ],
};

// =============================================================================
// FIELD NAME MAPPINGS (Alternative names LLMs might use)
// =============================================================================

const FIELD_MAPPINGS = {
    // Scene object alternatives
    scene: ['scene', 'setting', 'environment', 'location', 'stage', 'backdrop', 'scenery'],

    // Scene properties
    background: ['background', 'bg', 'backdrop', 'image', 'backgroundImage', 'back', 'scenery'],
    music: ['music', 'bgm', 'backgroundMusic', 'track', 'audio', 'soundtrack', 'song'],
    sfx: ['sfx', 'soundEffect', 'sound', 'effect', 'soundFx', 'fx', 'sounds'],

    // Characters array alternatives
    characters: ['characters', 'chars', 'sprites', 'actors', 'npcs', 'people', 'cast', 'speakers'],

    // Character properties
    name: ['name', 'characterName', 'speaker', 'id', 'charName', 'who'],
    expression: ['expression', 'emotion', 'mood', 'face', 'feeling', 'state', 'emote', 'expr'],
    outfit: ['outfit', 'clothes', 'clothing', 'costume', 'attire', 'dress', 'wear'],
    position: ['position', 'pos', 'location', 'place', 'side', 'slot', 'alignment'],
    action: ['action', 'movement', 'move', 'act', 'transition', 'state', 'status'],

    // Choices array alternatives
    choices: ['choices', 'options', 'decisions', 'responses', 'buttons', 'actions', 'menu'],

    // Choice properties
    label: ['label', 'text', 'title', 'button', 'option', 'display', 'caption'],
    prompt: ['prompt', 'action', 'result', 'consequence', 'effect', 'description', 'outcome'],
};

// =============================================================================
// MAIN NORMALIZER
// =============================================================================

/**
 * Normalize schema structure
 * @param {Object} parsed - Parsed JSON object
 * @returns {{ normalized: Object|null, fixes: string[], warnings: string[] }}
 */
export function normalizeSchemaStructure(parsed) {
    const result = {
        normalized: null,
        fixes: [],
        warnings: [],
    };

    if (!parsed || typeof parsed !== 'object') {
        result.warnings.push('Input is not an object');
        return result;
    }

    // Start with empty normalized structure
    const normalized = {
        scene: null,
        characters: [],
        choices: [],
    };

    // Apply fixers in order
    const fixers = [
        // Handle wrapped structures
        unwrapDataEnvelope,
        unwrapResultEnvelope,
        unwrapSceneEnvelope,

        // Fix scene object
        findAndNormalizeScene,
        normalizeSceneFields,
        handleFlatSceneFields,

        // Fix characters
        findAndNormalizeCharacters,
        normalizeCharacterFields,
        splitCombinedCharacters,
        handleSingleCharacter,

        // Fix choices
        findAndNormalizeChoices,
        normalizeChoiceFields,
        handleStringChoices,
        splitChoiceText,

        // Cleanup
        removeUnknownTopLevel,
        ensureArrayTypes,
        ensureStringTypes,
    ];

    let current = { ...parsed };

    for (const fixer of fixers) {
        const before = JSON.stringify(current);
        const fixResult = fixer(current, normalized);
        if (fixResult.fix) {
            result.fixes.push(fixResult.fix);
        }
        if (fixResult.warning) {
            result.warnings.push(fixResult.warning);
        }
        if (fixResult.data) {
            current = fixResult.data;
        }
    }

    result.normalized = normalized;

    if (result.fixes.length > 0) {
        console.debug(`[${MODULE_NAME}] Applied ${result.fixes.length} schema fixes: ${result.fixes.join(', ')}`);
    }

    return result;
}

// =============================================================================
// ENVELOPE UNWRAPPERS
// =============================================================================

/**
 * Unwrap { data: { ... } } envelope
 */
function unwrapDataEnvelope(parsed, normalized) {
    if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
        return {
            fix: 'Unwrapped data envelope',
            data: parsed.data,
        };
    }
    return { data: parsed };
}

/**
 * Unwrap { result: { ... } } envelope
 */
function unwrapResultEnvelope(parsed, normalized) {
    if (parsed.result && typeof parsed.result === 'object' && !Array.isArray(parsed.result)) {
        return {
            fix: 'Unwrapped result envelope',
            data: parsed.result,
        };
    }
    return { data: parsed };
}

/**
 * Unwrap { vn_scene: { ... } } envelope
 */
function unwrapSceneEnvelope(parsed, normalized) {
    const wrapperKeys = ['vn_scene', 'vnScene', 'vn-scene', 'sceneData', 'scene_data'];
    for (const key of wrapperKeys) {
        if (parsed[key] && typeof parsed[key] === 'object') {
            return {
                fix: `Unwrapped ${key} envelope`,
                data: parsed[key],
            };
        }
    }
    return { data: parsed };
}

// =============================================================================
// SCENE FIXERS
// =============================================================================

/**
 * Find and normalize the scene object
 */
function findAndNormalizeScene(parsed, normalized) {
    // Try to find scene under various names
    for (const altName of FIELD_MAPPINGS.scene) {
        if (parsed[altName] && typeof parsed[altName] === 'object' && !Array.isArray(parsed[altName])) {
            normalized.scene = { ...parsed[altName] };
            if (altName !== 'scene') {
                return { fix: `Renamed ${altName} to scene` };
            }
            return {};
        }
    }

    // If no scene object but has flat scene-like fields, create one
    if (!normalized.scene) {
        normalized.scene = {};
    }

    return {};
}

/**
 * Normalize field names within scene object
 */
function normalizeSceneFields(parsed, normalized) {
    if (!normalized.scene) normalized.scene = {};

    const scene = normalized.scene;
    const fixes = [];

    // Normalize background
    for (const altName of FIELD_MAPPINGS.background) {
        if (scene[altName] !== undefined && altName !== 'background') {
            scene.background = scene[altName];
            delete scene[altName];
            fixes.push(`scene.${altName} -> background`);
        }
    }

    // Normalize music
    for (const altName of FIELD_MAPPINGS.music) {
        if (scene[altName] !== undefined && altName !== 'music') {
            scene.music = scene[altName];
            delete scene[altName];
            fixes.push(`scene.${altName} -> music`);
        }
    }

    // Normalize sfx
    for (const altName of FIELD_MAPPINGS.sfx) {
        if (scene[altName] !== undefined && altName !== 'sfx') {
            scene.sfx = scene[altName];
            delete scene[altName];
            fixes.push(`scene.${altName} -> sfx`);
        }
    }

    return fixes.length ? { fix: `Normalized scene fields: ${fixes.join(', ')}` } : {};
}

/**
 * Handle flat scene fields at root level
 */
function handleFlatSceneFields(parsed, normalized) {
    if (!normalized.scene) normalized.scene = {};

    let found = false;

    // Check for scene fields at root level
    for (const altName of FIELD_MAPPINGS.background) {
        if (parsed[altName] !== undefined && typeof parsed[altName] === 'string') {
            normalized.scene.background = parsed[altName];
            found = true;
        }
    }

    for (const altName of FIELD_MAPPINGS.music) {
        if (parsed[altName] !== undefined && typeof parsed[altName] === 'string') {
            normalized.scene.music = parsed[altName];
            found = true;
        }
    }

    for (const altName of FIELD_MAPPINGS.sfx) {
        if (parsed[altName] !== undefined && typeof parsed[altName] === 'string') {
            normalized.scene.sfx = parsed[altName];
            found = true;
        }
    }

    return found ? { fix: 'Collected flat scene fields into scene object' } : {};
}

// =============================================================================
// CHARACTER FIXERS
// =============================================================================

/**
 * Find and normalize the characters array
 */
function findAndNormalizeCharacters(parsed, normalized) {
    for (const altName of FIELD_MAPPINGS.characters) {
        if (Array.isArray(parsed[altName])) {
            normalized.characters = [...parsed[altName]];
            if (altName !== 'characters') {
                return { fix: `Renamed ${altName} to characters` };
            }
            return {};
        }
    }
    return {};
}

/**
 * Normalize field names within each character
 */
function normalizeCharacterFields(parsed, normalized) {
    if (!normalized.characters?.length) return {};

    const fixes = [];

    normalized.characters = normalized.characters.map((char, i) => {
        if (typeof char !== 'object' || char === null) {
            fixes.push(`characters[${i}] was not an object`);
            return { name: String(char) };
        }

        const normalized_char = {};

        // Map each field
        const fieldSets = [
            ['name', FIELD_MAPPINGS.name],
            ['expression', FIELD_MAPPINGS.expression],
            ['outfit', FIELD_MAPPINGS.outfit],
            ['position', FIELD_MAPPINGS.position],
            ['action', FIELD_MAPPINGS.action],
        ];

        for (const [target, alternatives] of fieldSets) {
            for (const alt of alternatives) {
                if (char[alt] !== undefined) {
                    normalized_char[target] = char[alt];
                    if (alt !== target) {
                        fixes.push(`char.${alt} -> ${target}`);
                    }
                    break;
                }
            }
        }

        return normalized_char;
    });

    return fixes.length ? { fix: `Normalized character fields: ${fixes.slice(0, 3).join(', ')}${fixes.length > 3 ? '...' : ''}` } : {};
}

/**
 * Split combined character strings like "Alice (happy)"
 */
function splitCombinedCharacters(parsed, normalized) {
    if (!normalized.characters?.length) return {};

    let fixed = false;

    normalized.characters = normalized.characters.map(char => {
        if (typeof char === 'string') {
            // Try to parse "Name (expression)" format
            const match = char.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
            if (match) {
                fixed = true;
                return {
                    name: match[1].trim(),
                    expression: match[2]?.trim() || null,
                };
            }
            return { name: char };
        }

        // Check if name contains expression like "Alice (happy)"
        if (char.name && typeof char.name === 'string') {
            const match = char.name.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
            if (match && match[2]) {
                fixed = true;
                return {
                    ...char,
                    name: match[1].trim(),
                    expression: char.expression || match[2].trim(),
                };
            }
        }

        return char;
    });

    return fixed ? { fix: 'Split combined name/expression strings' } : {};
}

/**
 * Handle single character object instead of array
 */
function handleSingleCharacter(parsed, normalized) {
    // Check if there's a character object at root level instead of array
    if (!normalized.characters?.length) {
        const charKeys = ['character', 'char', 'speaker', 'actor', 'npc'];
        for (const key of charKeys) {
            if (parsed[key] && typeof parsed[key] === 'object' && !Array.isArray(parsed[key])) {
                normalized.characters = [parsed[key]];
                return { fix: `Wrapped single ${key} object in array` };
            }
        }
    }
    return {};
}

// =============================================================================
// CHOICE FIXERS
// =============================================================================

/**
 * Find and normalize the choices array
 */
function findAndNormalizeChoices(parsed, normalized) {
    for (const altName of FIELD_MAPPINGS.choices) {
        if (Array.isArray(parsed[altName])) {
            normalized.choices = [...parsed[altName]];
            if (altName !== 'choices') {
                return { fix: `Renamed ${altName} to choices` };
            }
            return {};
        }
    }
    return {};
}

/**
 * Normalize field names within each choice
 */
function normalizeChoiceFields(parsed, normalized) {
    if (!normalized.choices?.length) return {};

    const fixes = [];

    normalized.choices = normalized.choices.map((choice, i) => {
        if (typeof choice !== 'object' || choice === null) {
            return { label: String(choice), prompt: String(choice) };
        }

        const normalized_choice = {};

        // Map label
        for (const alt of FIELD_MAPPINGS.label) {
            if (choice[alt] !== undefined) {
                normalized_choice.label = choice[alt];
                if (alt !== 'label') {
                    fixes.push(`choice.${alt} -> label`);
                }
                break;
            }
        }

        // Map prompt
        for (const alt of FIELD_MAPPINGS.prompt) {
            if (choice[alt] !== undefined) {
                normalized_choice.prompt = choice[alt];
                if (alt !== 'prompt') {
                    fixes.push(`choice.${alt} -> prompt`);
                }
                break;
            }
        }

        // If only one field, use it for both
        if (normalized_choice.label && !normalized_choice.prompt) {
            normalized_choice.prompt = normalized_choice.label;
        } else if (normalized_choice.prompt && !normalized_choice.label) {
            normalized_choice.label = normalized_choice.prompt;
        }

        return normalized_choice;
    });

    return fixes.length ? { fix: `Normalized choice fields: ${fixes.slice(0, 3).join(', ')}${fixes.length > 3 ? '...' : ''}` } : {};
}

/**
 * Handle string array choices
 */
function handleStringChoices(parsed, normalized) {
    if (!normalized.choices?.length) return {};

    let fixed = false;

    normalized.choices = normalized.choices.map(choice => {
        if (typeof choice === 'string') {
            fixed = true;
            return { label: choice, prompt: choice };
        }
        return choice;
    });

    return fixed ? { fix: 'Converted string choices to objects' } : {};
}

/**
 * Split "Label: Description" format
 */
function splitChoiceText(parsed, normalized) {
    if (!normalized.choices?.length) return {};

    let fixed = false;

    normalized.choices = normalized.choices.map(choice => {
        if (choice.label && !choice.prompt && choice.label.includes(':')) {
            const [label, ...rest] = choice.label.split(':');
            fixed = true;
            return {
                label: label.trim(),
                prompt: rest.join(':').trim() || label.trim(),
            };
        }
        return choice;
    });

    return fixed ? { fix: 'Split choice label:prompt format' } : {};
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Remove unknown top-level fields (with warning)
 */
function removeUnknownTopLevel(parsed, normalized) {
    const knownKeys = new Set(['scene', 'characters', 'choices', 'data', 'result', 'vn_scene']);
    const unknownKeys = Object.keys(parsed).filter(k => !knownKeys.has(k));

    if (unknownKeys.length > 0) {
        return { warning: `Ignored unknown fields: ${unknownKeys.join(', ')}` };
    }
    return {};
}

/**
 * Ensure arrays are actually arrays
 */
function ensureArrayTypes(parsed, normalized) {
    let fixed = false;

    // Characters must be array
    if (normalized.characters && !Array.isArray(normalized.characters)) {
        normalized.characters = [normalized.characters];
        fixed = true;
    }

    // Choices must be array
    if (normalized.choices && !Array.isArray(normalized.choices)) {
        normalized.choices = [normalized.choices];
        fixed = true;
    }

    return fixed ? { fix: 'Wrapped non-arrays in arrays' } : {};
}

/**
 * Ensure string fields are strings
 */
function ensureStringTypes(parsed, normalized) {
    let fixed = false;

    // Scene fields
    if (normalized.scene) {
        for (const key of ['background', 'music', 'sfx']) {
            if (normalized.scene[key] !== null && typeof normalized.scene[key] !== 'string') {
                normalized.scene[key] = String(normalized.scene[key]);
                fixed = true;
            }
        }
    }

    // Character fields
    if (normalized.characters) {
        normalized.characters = normalized.characters.map(char => ({
            ...char,
            name: char.name !== null && char.name !== undefined ? String(char.name) : null,
            expression: char.expression !== null && char.expression !== undefined ? String(char.expression) : null,
            outfit: char.outfit !== null && char.outfit !== undefined ? String(char.outfit) : null,
            position: char.position !== null && char.position !== undefined ? String(char.position) : null,
            action: char.action !== null && char.action !== undefined ? String(char.action) : null,
        }));
    }

    // Choice fields
    if (normalized.choices) {
        normalized.choices = normalized.choices.map(choice => ({
            ...choice,
            label: choice.label !== null && choice.label !== undefined ? String(choice.label) : '',
            prompt: choice.prompt !== null && choice.prompt !== undefined ? String(choice.prompt) : '',
        }));
    }

    return fixed ? { fix: 'Converted non-strings to strings' } : {};
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate normalized structure
 * @param {Object} normalized - Normalized scene data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateNormalizedSchema(normalized) {
    const errors = [];

    // Scene validation
    if (normalized.scene !== null && typeof normalized.scene !== 'object') {
        errors.push('scene must be object or null');
    }

    // Characters validation
    if (!Array.isArray(normalized.characters)) {
        errors.push('characters must be array');
    } else {
        normalized.characters.forEach((char, i) => {
            if (!char.name) {
                errors.push(`characters[${i}] missing name`);
            }
        });
    }

    // Choices validation
    if (!Array.isArray(normalized.choices)) {
        errors.push('choices must be array');
    } else {
        normalized.choices.forEach((choice, i) => {
            if (!choice.label) {
                errors.push(`choices[${i}] missing label`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
