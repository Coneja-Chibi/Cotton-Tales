/**
 * ============================================================================
 * COTTON-TALES SCENE LINTER - FALLBACK TEXT EXTRACTION
 * ============================================================================
 * When JSON parsing completely fails, extract scene data from plain narrative
 * using 25+ heuristic patterns.
 *
 * This is the last resort - we try to understand what the LLM meant even when
 * it completely ignored our JSON schema instructions.
 *
 * Categories:
 * - Character detection (names, actions, speech)
 * - Expression detection (emotional cues in text)
 * - Background detection (location descriptions)
 * - Choice detection (numbered options, dialogue branches)
 * - Action detection (stage directions, movements)
 *
 * @version 1.0.0
 * ============================================================================
 */

const MODULE_NAME = 'CT-FallbackExtract';

// =============================================================================
// EMOTION KEYWORDS FOR EXPRESSION DETECTION
// =============================================================================

const EMOTION_KEYWORDS = {
    happy: [
        'smiles', 'grins', 'beams', 'laughs', 'giggles', 'chuckles',
        'happily', 'cheerfully', 'joyfully', 'delighted', 'pleased',
        'excited', 'thrilled', 'overjoyed', 'gleefully',
    ],
    sad: [
        'frowns', 'sighs', 'tears', 'cries', 'weeps', 'sobs',
        'sadly', 'sorrowfully', 'mournfully', 'dejected', 'depressed',
        'heartbroken', 'disappointed', 'dismayed',
    ],
    angry: [
        'glares', 'scowls', 'snarls', 'growls', 'shouts', 'yells',
        'angrily', 'furiously', 'rage', 'raging', 'livid', 'fuming',
        'incensed', 'outraged', 'irritated',
    ],
    surprised: [
        'gasps', 'startled', 'shocked', 'stunned', 'amazed',
        'eyes widen', 'jaw drops', 'taken aback', 'dumbfounded',
        'astonished', 'incredulous', 'disbelief',
    ],
    afraid: [
        'trembles', 'shakes', 'shivers', 'cowers', 'flinches',
        'fearfully', 'terrified', 'frightened', 'scared', 'panicked',
        'alarmed', 'horrified', 'petrified',
    ],
    nervous: [
        'fidgets', 'stammers', 'stutters', 'hesitates', 'gulps',
        'nervously', 'anxiously', 'worriedly', 'uneasily', 'apprehensively',
        'sweating', 'trembling voice',
    ],
    blush: [
        'blushes', 'blushing', 'cheeks redden', 'face flushes',
        'embarrassed', 'flustered', 'shy', 'bashful', 'coyly',
        'demurely', 'sheepishly',
    ],
    thinking: [
        'ponders', 'considers', 'contemplates', 'muses', 'wonders',
        'thoughtfully', 'pensively', 'reflectively', 'curiously',
        'tilts head', 'chin in hand', 'brow furrows',
    ],
    smug: [
        'smirks', 'smugly', 'confidently', 'arrogantly', 'cockily',
        'self-satisfied', 'knowing look', 'raised eyebrow', 'sly smile',
        'triumphantly',
    ],
    neutral: [
        'calmly', 'evenly', 'flatly', 'impassively', 'stoically',
        'expressionless', 'blank expression', 'matter-of-factly',
    ],
};

// Build reverse lookup for quick keyword detection
const KEYWORD_TO_EMOTION = {};
for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
        KEYWORD_TO_EMOTION[keyword.toLowerCase()] = emotion;
    }
}

// =============================================================================
// LOCATION KEYWORDS FOR BACKGROUND DETECTION
// =============================================================================

const LOCATION_PATTERNS = [
    // Interior locations
    { pattern: /\b(bedroom|room)\b/i, background: 'bedroom' },
    { pattern: /\b(living room|lounge)\b/i, background: 'living_room' },
    { pattern: /\b(kitchen)\b/i, background: 'kitchen' },
    { pattern: /\b(bathroom)\b/i, background: 'bathroom' },
    { pattern: /\b(office|study)\b/i, background: 'office' },
    { pattern: /\b(classroom|class)\b/i, background: 'classroom' },
    { pattern: /\b(library)\b/i, background: 'library' },
    { pattern: /\b(cafeteria|cafe|coffee shop)\b/i, background: 'cafe' },
    { pattern: /\b(restaurant)\b/i, background: 'restaurant' },
    { pattern: /\b(bar|pub)\b/i, background: 'bar' },
    { pattern: /\b(gym)\b/i, background: 'gym' },
    { pattern: /\b(hospital|clinic)\b/i, background: 'hospital' },
    { pattern: /\b(store|shop)\b/i, background: 'shop' },
    { pattern: /\b(mall)\b/i, background: 'mall' },
    { pattern: /\b(hallway|corridor)\b/i, background: 'hallway' },

    // Exterior locations
    { pattern: /\b(park)\b/i, background: 'park' },
    { pattern: /\b(street|road|sidewalk)\b/i, background: 'street' },
    { pattern: /\b(beach|shore)\b/i, background: 'beach' },
    { pattern: /\b(forest|woods)\b/i, background: 'forest' },
    { pattern: /\b(garden)\b/i, background: 'garden' },
    { pattern: /\b(rooftop)\b/i, background: 'rooftop' },
    { pattern: /\b(balcony)\b/i, background: 'balcony' },
    { pattern: /\b(pool|swimming)\b/i, background: 'pool' },

    // Time/atmosphere modifiers (use as suffix)
    { pattern: /\b(at night|nighttime|evening)\b/i, suffix: '_night' },
    { pattern: /\b(sunset|dusk)\b/i, suffix: '_sunset' },
    { pattern: /\b(morning|dawn|sunrise)\b/i, suffix: '_morning' },
];

// =============================================================================
// CHARACTER ACTION PATTERNS
// =============================================================================

const ACTION_PATTERNS = [
    // Enter patterns
    { pattern: /\*?\s*(\w+)\s+(?:walks? in|enters?|arrives?|appears?|comes? in)\s*\*?/gi, action: 'enters' },
    { pattern: /\*?\s*(?:door opens?|footsteps).+?(\w+)\s*\*?/gi, action: 'enters' },

    // Exit patterns
    { pattern: /\*?\s*(\w+)\s+(?:walks? out|leaves?|exits?|departs?|goes?|walks? away)\s*\*?/gi, action: 'exits' },
    { pattern: /\*?\s*(\w+)\s+(?:storms? out|runs? off|disappears?)\s*\*?/gi, action: 'exits' },

    // Movement patterns
    { pattern: /\*?\s*(\w+)\s+(?:moves?|steps?|walks?|shifts?)\s+(?:to the\s+)?(left|right|center)\s*\*?/gi, action: 'moves' },
];

// =============================================================================
// CHOICE DETECTION PATTERNS
// =============================================================================

const CHOICE_PATTERNS = [
    // Numbered options: "1. Option text" or "1) Option text"
    /(?:^|\n)\s*(\d+)[.)]\s*(.+?)(?=\n\s*\d+[.)]|\n\n|$)/gm,

    // Lettered options: "A. Option" or "a) Option"
    /(?:^|\n)\s*([A-Da-d])[.)]\s*(.+?)(?=\n\s*[A-Da-d][.)]|\n\n|$)/gm,

    // Bracketed options: "[Option 1]" or "「Option」"
    /\[([^\]]+)\]|\「([^」]+)\」/g,

    // Arrow options: "→ Option" or "► Option"
    /(?:^|\n)\s*[→►•]\s*(.+?)(?=\n\s*[→►•]|\n\n|$)/gm,

    // Question with options: "What do you do?\n- Option 1\n- Option 2"
    /\?[\s\n]+(?:[-•]\s*(.+?)(?:\n|$))+/g,
];

// =============================================================================
// MAIN EXTRACTION FUNCTION
// =============================================================================

/**
 * Extract scene data from narrative text when JSON parsing fails
 * @param {string} text - Narrative text
 * @param {Object} options - Extraction options
 * @param {string[]} [options.validExpressions] - Valid expressions for matching
 * @param {string[]} [options.validBackgrounds] - Valid backgrounds for matching
 * @param {string[]} [options.validCharacters] - Valid character names
 * @returns {{ scene: Object|null, confidence: number, extractions: string[] }}
 */
export function extractFromNarrative(text, options = {}) {
    const {
        validExpressions = [],
        validBackgrounds = [],
        validCharacters = [],
    } = options;

    const result = {
        scene: null,
        confidence: 0,
        extractions: [],
    };

    if (!text || typeof text !== 'string') {
        return result;
    }

    // Initialize scene structure
    const scene = {
        scene: null,
        characters: [],
        choices: [],
    };

    // Extract background
    const bgResult = extractBackground(text, validBackgrounds);
    if (bgResult.background) {
        scene.scene = { background: bgResult.background };
        result.extractions.push(`Background: ${bgResult.background}`);
        result.confidence += 15;
    }

    // Extract characters and their states
    const charResult = extractCharacters(text, validCharacters, validExpressions);
    if (charResult.characters.length > 0) {
        scene.characters = charResult.characters;
        result.extractions.push(`Characters: ${charResult.characters.map(c => c.name).join(', ')}`);
        result.confidence += 10 * Math.min(charResult.characters.length, 3);
    }

    // Extract choices
    const choiceResult = extractChoices(text);
    if (choiceResult.choices.length > 0) {
        scene.choices = choiceResult.choices;
        result.extractions.push(`Choices: ${choiceResult.choices.length} options found`);
        result.confidence += 20;
    }

    // Only return scene if we found something
    if (scene.scene || scene.characters.length > 0 || scene.choices.length > 0) {
        result.scene = scene;
    }

    console.debug(`[${MODULE_NAME}] Fallback extraction: confidence ${result.confidence}%, extractions: ${result.extractions.join('; ')}`);

    return result;
}

// =============================================================================
// BACKGROUND EXTRACTION
// =============================================================================

/**
 * Extract background from narrative
 */
function extractBackground(text, validBackgrounds = []) {
    let background = null;
    let confidence = 0;

    // Try explicit location mentions first
    const locationMatch = text.match(/(?:in the|at the|inside the|outside the|enters? the|arrives? at)\s+([a-z]+(?:\s+[a-z]+)?)/i);
    if (locationMatch) {
        const location = locationMatch[1].toLowerCase();

        // Check against valid backgrounds
        if (validBackgrounds.length > 0) {
            const match = validBackgrounds.find(bg =>
                bg.toLowerCase().includes(location) || location.includes(bg.toLowerCase())
            );
            if (match) {
                background = match;
                confidence = 70;
            }
        }
    }

    // Try pattern matching for known locations
    if (!background) {
        for (const loc of LOCATION_PATTERNS) {
            if (loc.pattern.test(text)) {
                if (loc.background) {
                    background = loc.background;
                    confidence = 50;
                    break;
                }
            }
        }
    }

    // Apply time suffix if detected
    if (background) {
        for (const loc of LOCATION_PATTERNS) {
            if (loc.suffix && loc.pattern.test(text)) {
                // Check if valid backgrounds has this variant
                const withSuffix = background + loc.suffix;
                if (validBackgrounds.includes(withSuffix)) {
                    background = withSuffix;
                }
            }
        }
    }

    return { background, confidence };
}

// =============================================================================
// CHARACTER EXTRACTION
// =============================================================================

/**
 * Extract characters and their states from narrative
 */
function extractCharacters(text, validCharacters = [], validExpressions = []) {
    const characters = [];
    const seen = new Set();

    // Method 1: Look for known character names
    if (validCharacters.length > 0) {
        for (const charName of validCharacters) {
            // Skip if already found
            if (seen.has(charName.toLowerCase())) continue;

            // Check if character is mentioned
            const regex = new RegExp(`\\b${escapeRegex(charName)}\\b`, 'i');
            if (regex.test(text)) {
                const char = { name: charName };

                // Try to find their expression
                const expr = findCharacterExpression(text, charName, validExpressions);
                if (expr) {
                    char.expression = expr;
                }

                // Try to find their action
                const action = findCharacterAction(text, charName);
                if (action) {
                    char.action = action.action;
                    if (action.position) char.position = action.position;
                }

                characters.push(char);
                seen.add(charName.toLowerCase());
            }
        }
    }

    // Method 2: Look for dialogue patterns ("Name: dialogue" or *Name does something*)
    const dialoguePattern = /(?:^|\n)\s*\*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\*?:\s*["""]?(.+?)["""]?\s*(?:\n|$)/gm;
    let match;
    while ((match = dialoguePattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (!seen.has(name.toLowerCase())) {
            const char = { name, action: 'speaks' };

            // Try to find expression from dialogue content
            const dialogue = match[2];
            const expr = detectEmotionFromText(dialogue, validExpressions);
            if (expr) {
                char.expression = expr;
            }

            characters.push(char);
            seen.add(name.toLowerCase());
        }
    }

    // Method 3: Look for action patterns (*Name does something*)
    const actionPattern = /\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+([^*]+)\*/g;
    while ((match = actionPattern.exec(text)) !== null) {
        const name = match[1].trim();
        const action = match[2].trim();

        if (!seen.has(name.toLowerCase())) {
            const char = { name };

            // Detect expression from action
            const expr = detectEmotionFromText(action, validExpressions);
            if (expr) {
                char.expression = expr;
            }

            characters.push(char);
            seen.add(name.toLowerCase());
        }
    }

    return { characters };
}

/**
 * Find a character's expression from nearby text
 */
function findCharacterExpression(text, charName, validExpressions) {
    // Look for patterns like "CharName smiles" or "CharName, looking happy,"
    const patterns = [
        new RegExp(`${escapeRegex(charName)}(?:[,\\s]+(?:looking|appearing|seeming))?[,\\s]+(\\w+)`, 'i'),
        new RegExp(`${escapeRegex(charName)}[\\s,]+(smiles|grins|frowns|sighs|laughs|cries|blushes)`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const word = match[1].toLowerCase();
            // Check if this maps to a known emotion
            if (KEYWORD_TO_EMOTION[word]) {
                const emotion = KEYWORD_TO_EMOTION[word];
                // Try to match to valid expressions
                if (validExpressions.length > 0) {
                    const expr = validExpressions.find(e =>
                        e.toLowerCase() === emotion || e.toLowerCase().includes(emotion)
                    );
                    if (expr) return expr;
                }
                return emotion;
            }
        }
    }

    return null;
}

/**
 * Find a character's action from text
 */
function findCharacterAction(text, charName) {
    for (const ap of ACTION_PATTERNS) {
        ap.pattern.lastIndex = 0; // Reset regex state
        let match;
        while ((match = ap.pattern.exec(text)) !== null) {
            if (match[1]?.toLowerCase() === charName.toLowerCase()) {
                const result = { action: ap.action };

                // Check for position in movement actions
                if (ap.action === 'moves' && match[2]) {
                    result.position = match[2].toLowerCase();
                }

                return result;
            }
        }
    }

    return null;
}

/**
 * Detect emotion from text content
 */
function detectEmotionFromText(text, validExpressions = []) {
    const lower = text.toLowerCase();

    // Score each emotion based on keyword matches
    const scores = {};
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
        scores[emotion] = 0;
        for (const keyword of keywords) {
            if (lower.includes(keyword.toLowerCase())) {
                scores[emotion]++;
            }
        }
    }

    // Find highest scoring emotion
    let bestEmotion = null;
    let bestScore = 0;
    for (const [emotion, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            bestEmotion = emotion;
        }
    }

    if (bestEmotion && bestScore > 0) {
        // Try to match to valid expressions
        if (validExpressions.length > 0) {
            const expr = validExpressions.find(e =>
                e.toLowerCase() === bestEmotion || e.toLowerCase().includes(bestEmotion)
            );
            if (expr) return expr;
        }
        return bestEmotion;
    }

    return null;
}

// =============================================================================
// CHOICE EXTRACTION
// =============================================================================

/**
 * Extract choices from narrative
 */
function extractChoices(text) {
    const choices = [];

    // Method 1: Numbered options
    const numberedPattern = /(?:^|\n)\s*(\d+)[.)]\s*(.+?)(?=\n\s*\d+[.)]|\n\n|$)/gm;
    let match;
    while ((match = numberedPattern.exec(text)) !== null) {
        const label = match[2].trim();
        if (label && label.length > 2 && label.length < 200) {
            choices.push({ label, prompt: label });
        }
    }

    if (choices.length >= 2) {
        return { choices };
    }

    // Method 2: Bullet points after a question
    const bulletSection = text.match(/\?[^\n]*\n((?:\s*[-•]\s*.+\n?)+)/);
    if (bulletSection) {
        const bullets = bulletSection[1].match(/[-•]\s*(.+)/g);
        if (bullets) {
            for (const bullet of bullets) {
                const label = bullet.replace(/^[-•]\s*/, '').trim();
                if (label && label.length > 2) {
                    choices.push({ label, prompt: label });
                }
            }
        }
    }

    if (choices.length >= 2) {
        return { choices };
    }

    // Method 3: Lettered options
    const letteredPattern = /(?:^|\n)\s*([A-Da-d])[.)]\s*(.+?)(?=\n\s*[A-Da-d][.)]|\n\n|$)/gm;
    while ((match = letteredPattern.exec(text)) !== null) {
        const label = match[2].trim();
        if (label && label.length > 2) {
            choices.push({ label, prompt: label });
        }
    }

    if (choices.length >= 2) {
        return { choices };
    }

    // Method 4: Arrow options
    const arrowPattern = /(?:^|\n)\s*[→►]\s*(.+?)(?=\n\s*[→►]|\n\n|$)/gm;
    while ((match = arrowPattern.exec(text)) !== null) {
        const label = match[1].trim();
        if (label && label.length > 2) {
            choices.push({ label, prompt: label });
        }
    }

    return { choices };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Escape regex special characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get all emotion keywords for documentation/testing
 */
export function getEmotionKeywords() {
    return { ...EMOTION_KEYWORDS };
}

/**
 * Get all location patterns for documentation/testing
 */
export function getLocationPatterns() {
    return LOCATION_PATTERNS.map(p => ({
        pattern: p.pattern.source,
        background: p.background || null,
        suffix: p.suffix || null,
    }));
}
