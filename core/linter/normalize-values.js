/**
 * ============================================================================
 * COTTON-TALES SCENE LINTER - VALUE NORMALIZER
 * ============================================================================
 * Normalizes 25+ types of value format issues within valid schema.
 *
 * Categories:
 * - Expression normalization (synonyms, case, format)
 * - Position normalization (left/right/center variants)
 * - Action normalization (enter/exit/speak variants)
 * - Background normalization (path cleanup, format)
 * - Choice normalization (trim, length limits)
 *
 * @version 1.0.0
 * ============================================================================
 */

const MODULE_NAME = 'CT-NormalizeValues';

// =============================================================================
// EXPRESSION SYNONYMS
// =============================================================================

/**
 * Map of expression synonyms to canonical names
 * Key = canonical expression, Value = array of synonyms
 */
const EXPRESSION_SYNONYMS = {
    // Happy family
    happy: ['happy', 'joy', 'joyful', 'cheerful', 'pleased', 'delighted', 'glad', 'content', 'elated', 'merry'],
    smile: ['smile', 'smiling', 'grin', 'grinning', 'beam', 'beaming'],

    // Sad family
    sad: ['sad', 'unhappy', 'sorrowful', 'depressed', 'melancholy', 'blue', 'down', 'dejected', 'gloomy'],
    cry: ['cry', 'crying', 'tears', 'tearful', 'weeping', 'sobbing'],

    // Angry family
    angry: ['angry', 'mad', 'furious', 'enraged', 'irate', 'livid', 'outraged', 'incensed', 'wrathful'],
    annoyed: ['annoyed', 'irritated', 'frustrated', 'bothered', 'peeved', 'vexed', 'agitated'],

    // Fear family
    afraid: ['afraid', 'scared', 'frightened', 'terrified', 'fearful', 'panicked', 'alarmed'],
    nervous: ['nervous', 'anxious', 'worried', 'uneasy', 'apprehensive', 'jittery', 'tense'],

    // Surprise family
    surprised: ['surprised', 'shocked', 'astonished', 'amazed', 'stunned', 'startled', 'taken_aback'],

    // Love family
    love: ['love', 'loving', 'adoring', 'affectionate', 'romantic', 'smitten', 'infatuated'],
    blush: ['blush', 'blushing', 'flustered', 'embarrassed', 'shy', 'bashful'],

    // Neutral family
    neutral: ['neutral', 'default', 'normal', 'calm', 'composed', 'relaxed', 'idle', 'base'],

    // Thinking family
    thinking: ['thinking', 'ponder', 'pondering', 'contemplating', 'thoughtful', 'musing', 'curious'],
    confused: ['confused', 'puzzled', 'perplexed', 'bewildered', 'baffled', 'uncertain'],

    // Smug/confident family
    smug: ['smug', 'confident', 'proud', 'cocky', 'arrogant', 'haughty', 'self_satisfied'],
    smirk: ['smirk', 'smirking', 'sly', 'cunning', 'devious', 'mischievous'],

    // Tired family
    tired: ['tired', 'exhausted', 'sleepy', 'drowsy', 'weary', 'fatigued', 'worn_out'],

    // Disgust family
    disgust: ['disgust', 'disgusted', 'grossed_out', 'revolted', 'repulsed', 'nauseated'],

    // Pain family
    pain: ['pain', 'hurt', 'pained', 'aching', 'suffering', 'wincing', 'grimace'],

    // Determined family
    determined: ['determined', 'resolute', 'focused', 'serious', 'stern', 'intense'],
};

// Build reverse lookup
const EXPRESSION_LOOKUP = {};
for (const [canonical, synonyms] of Object.entries(EXPRESSION_SYNONYMS)) {
    for (const syn of synonyms) {
        EXPRESSION_LOOKUP[syn.toLowerCase()] = canonical;
    }
}

// =============================================================================
// POSITION MAPPINGS
// =============================================================================

const POSITION_MAPPINGS = {
    left: ['left', 'l', 'left_side', 'leftside', 'stage_left', 'far_left', 'screen_left'],
    right: ['right', 'r', 'right_side', 'rightside', 'stage_right', 'far_right', 'screen_right'],
    center: ['center', 'c', 'middle', 'm', 'centre', 'mid', 'center_stage', 'front'],
    'left-center': ['left-center', 'left_center', 'lc', 'center-left', 'mid_left'],
    'right-center': ['right-center', 'right_center', 'rc', 'center-right', 'mid_right'],
};

const POSITION_LOOKUP = {};
for (const [canonical, variants] of Object.entries(POSITION_MAPPINGS)) {
    for (const v of variants) {
        POSITION_LOOKUP[v.toLowerCase()] = canonical;
    }
}

// =============================================================================
// ACTION MAPPINGS
// =============================================================================

const ACTION_MAPPINGS = {
    enters: ['enters', 'enter', 'entering', 'arrives', 'appears', 'shows', 'joins', 'comes_in'],
    exits: ['exits', 'exit', 'exiting', 'leaves', 'departs', 'disappears', 'goes', 'walks_out'],
    speaks: ['speaks', 'speak', 'speaking', 'says', 'talks', 'talking', 'dialogue'],
    moves: ['moves', 'move', 'moving', 'shifts', 'transitions', 'slides'],
};

const ACTION_LOOKUP = {};
for (const [canonical, variants] of Object.entries(ACTION_MAPPINGS)) {
    for (const v of variants) {
        ACTION_LOOKUP[v.toLowerCase()] = canonical;
    }
}

// =============================================================================
// MAIN NORMALIZER
// =============================================================================

/**
 * Normalize all values in a scene object
 * @param {Object} scene - Normalized schema scene object
 * @param {Object} options - Normalization options
 * @param {string[]} [options.validExpressions] - List of valid expression names
 * @param {string[]} [options.validBackgrounds] - List of valid background names
 * @param {string[]} [options.validCharacters] - List of valid character names
 * @returns {{ normalized: Object, fixes: string[], warnings: string[] }}
 */
export function normalizeAllValues(scene, options = {}) {
    const {
        validExpressions = [],
        validBackgrounds = [],
        validCharacters = [],
    } = options;

    const result = {
        normalized: JSON.parse(JSON.stringify(scene)), // Deep clone
        fixes: [],
        warnings: [],
    };

    const normalized = result.normalized;

    // Normalize scene values
    if (normalized.scene) {
        normalizeSceneValues(normalized.scene, result, { validBackgrounds });
    }

    // Normalize character values
    if (normalized.characters?.length) {
        normalizeCharacterValues(normalized.characters, result, { validExpressions, validCharacters });
    }

    // Normalize choice values
    if (normalized.choices?.length) {
        normalizeChoiceValues(normalized.choices, result);
    }

    if (result.fixes.length > 0) {
        console.debug(`[${MODULE_NAME}] Applied ${result.fixes.length} value normalizations`);
    }

    return result;
}

// =============================================================================
// SCENE VALUE NORMALIZATION
// =============================================================================

/**
 * Normalize scene values
 */
function normalizeSceneValues(scene, result, options) {
    // Background normalization
    if (scene.background) {
        const original = scene.background;
        scene.background = normalizeBackground(scene.background, options.validBackgrounds);
        if (scene.background !== original) {
            result.fixes.push(`Background: "${original}" -> "${scene.background}"`);
        }
    }

    // Music normalization
    if (scene.music) {
        scene.music = normalizeAudioPath(scene.music);
    }

    // SFX normalization
    if (scene.sfx) {
        scene.sfx = normalizeAudioPath(scene.sfx);
    }
}

/**
 * Normalize background value
 */
function normalizeBackground(value, validBackgrounds = []) {
    if (!value || typeof value !== 'string') return null;

    let normalized = value.trim();

    // Remove common prefixes/suffixes
    normalized = normalized
        .replace(/^(backgrounds?[/\\])/i, '')
        .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
        .replace(/^["']|["']$/g, '');

    // Convert to lowercase for matching
    const lower = normalized.toLowerCase();

    // Try to match against valid backgrounds
    if (validBackgrounds.length > 0) {
        // Exact match
        const exact = validBackgrounds.find(b => b.toLowerCase() === lower);
        if (exact) return exact;

        // Partial match
        const partial = validBackgrounds.find(b =>
            b.toLowerCase().includes(lower) || lower.includes(b.toLowerCase())
        );
        if (partial) return partial;

        // Fuzzy match (remove spaces/underscores)
        const fuzzy = validBackgrounds.find(b =>
            b.toLowerCase().replace(/[\s_-]/g, '') === lower.replace(/[\s_-]/g, '')
        );
        if (fuzzy) return fuzzy;
    }

    // Clean up common patterns
    normalized = normalized
        .replace(/[\s_]+/g, '_') // Normalize separators
        .replace(/_+/g, '_') // Remove double underscores
        .replace(/^_|_$/g, ''); // Remove leading/trailing

    return normalized || null;
}

/**
 * Normalize audio path
 */
function normalizeAudioPath(value) {
    if (!value || typeof value !== 'string') return null;

    let normalized = value.trim();

    // Remove quotes
    normalized = normalized.replace(/^["']|["']$/g, '');

    // Remove common prefixes
    normalized = normalized
        .replace(/^(music|audio|sounds?|sfx)[/\\]/i, '')
        .replace(/\.(mp3|ogg|wav|m4a)$/i, '');

    return normalized || null;
}

// =============================================================================
// CHARACTER VALUE NORMALIZATION
// =============================================================================

/**
 * Normalize character values
 */
function normalizeCharacterValues(characters, result, options) {
    for (let i = 0; i < characters.length; i++) {
        const char = characters[i];

        // Name normalization
        if (char.name) {
            const original = char.name;
            char.name = normalizeCharacterName(char.name, options.validCharacters);
            if (char.name !== original) {
                result.fixes.push(`Name: "${original}" -> "${char.name}"`);
            }
        }

        // Expression normalization
        if (char.expression) {
            const original = char.expression;
            char.expression = normalizeExpression(char.expression, options.validExpressions);
            if (char.expression !== original) {
                result.fixes.push(`Expression: "${original}" -> "${char.expression}"`);
            }
        }

        // Position normalization
        if (char.position) {
            const original = char.position;
            char.position = normalizePosition(char.position);
            if (char.position !== original) {
                result.fixes.push(`Position: "${original}" -> "${char.position}"`);
            }
        }

        // Action normalization
        if (char.action) {
            const original = char.action;
            char.action = normalizeAction(char.action);
            if (char.action !== original) {
                result.fixes.push(`Action: "${original}" -> "${char.action}"`);
            }
        }
    }
}

/**
 * Normalize character name
 */
function normalizeCharacterName(name, validCharacters = []) {
    if (!name || typeof name !== 'string') return null;

    let normalized = name.trim();

    // Remove quotes
    normalized = normalized.replace(/^["']|["']$/g, '');

    // Remove common prefixes
    normalized = normalized
        .replace(/^(character|char|npc|speaker):\s*/i, '')
        .replace(/^{{/g, '')
        .replace(/}}$/g, '');

    // Try to match against valid characters
    if (validCharacters.length > 0) {
        const lower = normalized.toLowerCase();

        // Exact match
        const exact = validCharacters.find(c => c.toLowerCase() === lower);
        if (exact) return exact;

        // Partial match (name contains or is contained)
        const partial = validCharacters.find(c =>
            c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase())
        );
        if (partial) return partial;
    }

    return normalized;
}

/**
 * Normalize expression value
 */
function normalizeExpression(expr, validExpressions = []) {
    if (!expr || typeof expr !== 'string') return null;

    let normalized = expr.trim().toLowerCase();

    // Remove quotes
    normalized = normalized.replace(/^["']|["']$/g, '');

    // Remove common prefixes
    normalized = normalized
        .replace(/^(expression|emotion|mood|feeling):\s*/i, '')
        .replace(/^(sprites?[/\\])/i, '')
        .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');

    // Convert spaces/dashes to underscores
    normalized = normalized.replace(/[\s-]+/g, '_');

    // Try synonym lookup first
    if (EXPRESSION_LOOKUP[normalized]) {
        normalized = EXPRESSION_LOOKUP[normalized];
    }

    // If we have valid expressions, try to match
    if (validExpressions.length > 0) {
        const lower = normalized.toLowerCase();

        // Exact match
        const exact = validExpressions.find(e => e.toLowerCase() === lower);
        if (exact) return exact;

        // Synonym match - check if any valid expression matches a synonym
        for (const validExpr of validExpressions) {
            const validLower = validExpr.toLowerCase();
            if (EXPRESSION_LOOKUP[validLower] === normalized ||
                EXPRESSION_LOOKUP[normalized] === validLower) {
                return validExpr;
            }
        }

        // Partial match
        const partial = validExpressions.find(e =>
            e.toLowerCase().includes(lower) || lower.includes(e.toLowerCase())
        );
        if (partial) return partial;
    }

    return normalized;
}

/**
 * Normalize position value
 */
function normalizePosition(pos) {
    if (!pos || typeof pos !== 'string') return null;

    const normalized = pos.trim().toLowerCase()
        .replace(/^["']|["']$/g, '')
        .replace(/[\s-]+/g, '_');

    // Look up canonical position
    if (POSITION_LOOKUP[normalized]) {
        return POSITION_LOOKUP[normalized];
    }

    // Try to extract from complex strings
    if (normalized.includes('left')) return 'left';
    if (normalized.includes('right')) return 'right';
    if (normalized.includes('center') || normalized.includes('middle')) return 'center';

    // Default to center if unrecognized
    return 'center';
}

/**
 * Normalize action value
 */
function normalizeAction(action) {
    if (!action || typeof action !== 'string') return null;

    const normalized = action.trim().toLowerCase()
        .replace(/^["']|["']$/g, '')
        .replace(/[\s-]+/g, '_');

    // Look up canonical action
    if (ACTION_LOOKUP[normalized]) {
        return ACTION_LOOKUP[normalized];
    }

    // Try to extract from complex strings
    if (normalized.includes('enter') || normalized.includes('appear')) return 'enters';
    if (normalized.includes('exit') || normalized.includes('leave')) return 'exits';
    if (normalized.includes('speak') || normalized.includes('talk') || normalized.includes('say')) return 'speaks';

    return null;
}

// =============================================================================
// CHOICE VALUE NORMALIZATION
// =============================================================================

/**
 * Normalize choice values
 */
function normalizeChoiceValues(choices, result) {
    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];

        // Label normalization
        if (choice.label) {
            const original = choice.label;
            choice.label = normalizeChoiceLabel(choice.label);
            if (choice.label !== original) {
                result.fixes.push(`Choice label trimmed`);
            }
        }

        // Prompt normalization
        if (choice.prompt) {
            const original = choice.prompt;
            choice.prompt = normalizeChoicePrompt(choice.prompt);
            if (choice.prompt !== original) {
                result.fixes.push(`Choice prompt normalized`);
            }
        }
    }
}

/**
 * Normalize choice label
 */
function normalizeChoiceLabel(label) {
    if (!label || typeof label !== 'string') return '';

    let normalized = label.trim();

    // Remove quotes
    normalized = normalized.replace(/^["']|["']$/g, '');

    // Remove numbering prefixes
    normalized = normalized.replace(/^\d+[.):\s]+/, '');

    // Remove emoji prefixes (keep them if they're content)
    // Only remove if followed by actual text
    normalized = normalized.replace(/^[\u{1F300}-\u{1F9FF}]\s+(?=[A-Za-z])/u, '');

    // Limit length for button display
    if (normalized.length > 100) {
        normalized = normalized.slice(0, 97) + '...';
    }

    return normalized;
}

/**
 * Normalize choice prompt
 */
function normalizeChoicePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return '';

    let normalized = prompt.trim();

    // Remove quotes
    normalized = normalized.replace(/^["']|["']$/g, '');

    // Clean up markdown
    normalized = normalized
        .replace(/^\*+|\*+$/g, '') // Remove leading/trailing asterisks
        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

    return normalized;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all known expression synonyms
 * @returns {Object} Map of canonical expressions to their synonyms
 */
export function getExpressionSynonyms() {
    return { ...EXPRESSION_SYNONYMS };
}

/**
 * Find canonical expression for a synonym
 * @param {string} synonym - Expression synonym
 * @returns {string|null} Canonical expression or null
 */
export function findCanonicalExpression(synonym) {
    if (!synonym) return null;
    return EXPRESSION_LOOKUP[synonym.toLowerCase()] || null;
}

/**
 * Check if a string looks like a valid expression
 * @param {string} value - Value to check
 * @returns {boolean}
 */
export function isValidExpression(value) {
    if (!value || typeof value !== 'string') return false;
    const normalized = value.toLowerCase().replace(/[\s-]/g, '_');
    return EXPRESSION_LOOKUP[normalized] !== undefined;
}

/**
 * Suggest closest matching expression
 * @param {string} value - Input expression
 * @param {string[]} validExpressions - List of valid expressions
 * @returns {string|null} Closest match or null
 */
export function suggestExpression(value, validExpressions = []) {
    if (!value) return null;

    const normalized = value.toLowerCase().replace(/[\s-]/g, '_');

    // Check synonyms first
    const canonical = EXPRESSION_LOOKUP[normalized];
    if (canonical) {
        // If we have valid expressions, find one that matches canonical
        if (validExpressions.length > 0) {
            return validExpressions.find(e =>
                e.toLowerCase() === canonical ||
                EXPRESSION_LOOKUP[e.toLowerCase()] === canonical
            ) || canonical;
        }
        return canonical;
    }

    // Levenshtein distance matching
    if (validExpressions.length > 0) {
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const expr of validExpressions) {
            const dist = levenshteinDistance(normalized, expr.toLowerCase());
            if (dist < bestDistance && dist <= 3) { // Max 3 edits
                bestDistance = dist;
                bestMatch = expr;
            }
        }

        return bestMatch;
    }

    return null;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
