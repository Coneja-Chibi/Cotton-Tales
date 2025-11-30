/**
 * ============================================================================
 * COTTON-TALES SCENE LINTER - JSON EXTRACTION
 * ============================================================================
 * Finds and extracts JSON from LLM responses. Handles 25+ different formats
 * that various models might use.
 *
 * Priority order:
 * 1. Explicit VN tags (```vn-scene, <vn-scene>, [VN-SCENE])
 * 2. JSON blocks with scene-related comments
 * 3. Generic JSON/code blocks
 * 4. Raw JSON in response
 *
 * @version 1.0.0
 * ============================================================================
 */

const MODULE_NAME = 'CT-ExtractJSON';

// =============================================================================
// EXTRACTION PATTERNS (Ordered by priority)
// =============================================================================

/**
 * Pattern definitions with priority and extraction logic
 * Higher priority = checked first and preferred
 */
const EXTRACTION_PATTERNS = [
    // =========================================================================
    // PRIORITY 10: Explicit VN tags (best case)
    // =========================================================================
    {
        name: 'vn-scene-block',
        priority: 10,
        pattern: /```vn-scene\s*([\s\S]*?)```/gi,
        description: 'Standard ```vn-scene block',
    },
    {
        name: 'vn-xml-tag',
        priority: 10,
        pattern: /<vn-scene[^>]*>([\s\S]*?)<\/vn-scene>/gi,
        description: 'XML-style <vn-scene> tags',
    },
    {
        name: 'vn-bracket-tag',
        priority: 10,
        pattern: /\[VN-SCENE\]([\s\S]*?)\[\/VN-SCENE\]/gi,
        description: 'Bracket [VN-SCENE] tags',
    },

    // =========================================================================
    // PRIORITY 8: JSON blocks with VN hints
    // =========================================================================
    {
        name: 'json-vn-comment',
        priority: 8,
        pattern: /```json\s*(?:\/\/\s*vn-scene|\/\*\s*vn-scene\s*\*\/)\s*([\s\S]*?)```/gi,
        description: 'JSON block with vn-scene comment',
    },
    {
        name: 'json-scene-comment',
        priority: 8,
        pattern: /```json\s*(?:\/\/\s*scene|\/\*\s*scene\s*\*\/)\s*([\s\S]*?)```/gi,
        description: 'JSON block with scene comment',
    },

    // =========================================================================
    // PRIORITY 6: Generic JSON blocks
    // =========================================================================
    {
        name: 'json-block',
        priority: 6,
        pattern: /```json\s*([\s\S]*?)```/gi,
        description: 'Standard ```json block',
    },
    {
        name: 'json-block-no-lang',
        priority: 5,
        pattern: /```\s*(\{[\s\S]*?\})\s*```/gi,
        description: 'Code block with JSON object (no language tag)',
    },

    // =========================================================================
    // PRIORITY 4: Wrong language tags (common LLM mistake)
    // =========================================================================
    {
        name: 'javascript-block',
        priority: 4,
        pattern: /```(?:javascript|js)\s*(\{[\s\S]*?\})\s*```/gi,
        description: 'JavaScript block containing JSON',
    },
    {
        name: 'typescript-block',
        priority: 4,
        pattern: /```(?:typescript|ts)\s*(\{[\s\S]*?\})\s*```/gi,
        description: 'TypeScript block containing JSON',
    },
    {
        name: 'text-block',
        priority: 4,
        pattern: /```(?:text|txt|plain)\s*(\{[\s\S]*?\})\s*```/gi,
        description: 'Text block containing JSON',
    },

    // =========================================================================
    // PRIORITY 3: Malformed blocks
    // =========================================================================
    {
        name: 'unclosed-json-block',
        priority: 3,
        pattern: /```(?:json|vn-scene)?\s*(\{[\s\S]*?)$/gi,
        description: 'Unclosed code block (truncated response)',
    },
    {
        name: 'extra-backticks',
        priority: 3,
        pattern: /`{4,}(?:json|vn-scene)?\s*([\s\S]*?)`{4,}/gi,
        description: 'Extra backticks (4+)',
    },
    {
        name: 'double-fence',
        priority: 3,
        pattern: /```(?:json)?\s*```(?:json)?\s*(\{[\s\S]*?\})\s*```(?:\s*```)?/gi,
        description: 'Double fence (Llama quirk)',
    },

    // =========================================================================
    // PRIORITY 2: Raw JSON patterns
    // =========================================================================
    {
        name: 'raw-json-full',
        priority: 2,
        pattern: /^\s*(\{[\s\S]*\})\s*$/g,
        description: 'Response is just JSON',
    },
    {
        name: 'json-after-prose',
        priority: 2,
        pattern: /(?:here'?s|here is|the|scene).*?(?:json|data|scene).*?[:\n]\s*(\{[\s\S]*?\})/gi,
        description: 'JSON after prose introduction',
    },

    // =========================================================================
    // PRIORITY 1: Last resort patterns
    // =========================================================================
    {
        name: 'inline-json',
        priority: 1,
        pattern: /(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g,
        description: 'Any JSON object in text',
    },
];

// =============================================================================
// PREPROCESSING FUNCTIONS
// =============================================================================

/**
 * Strip Claude's <thinking> tags
 */
function stripThinkingTags(text) {
    return text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
}

/**
 * Strip other AI reasoning tags
 */
function stripReasoningTags(text) {
    return text
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .replace(/<internal>[\s\S]*?<\/internal>/gi, '')
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '');
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text) {
    const entities = {
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&amp;': '&',
        '&nbsp;': ' ',
    };

    return text.replace(/&[a-z]+;|&#\d+;/gi, match => entities[match] || match);
}

/**
 * Decode Unicode escapes
 */
function decodeUnicodeEscapes(text) {
    try {
        return text.replace(/\\u[\dA-Fa-f]{4}/g, match =>
            String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
        );
    } catch {
        return text;
    }
}

/**
 * Remove BOM and other invisible characters
 */
function removeInvisibles(text) {
    return text
        .replace(/^\uFEFF/, '') // BOM
        .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width chars
}

/**
 * Full preprocessing pipeline
 */
function preprocessResponse(text) {
    let processed = text;
    processed = removeInvisibles(processed);
    processed = stripThinkingTags(processed);
    processed = stripReasoningTags(processed);
    processed = decodeHtmlEntities(processed);
    // Note: Don't decode Unicode escapes here - they might be valid JSON escapes
    return processed;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Check if parsed JSON looks like a VN scene
 */
function isValidSceneJson(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Must have at least one expected field
    const hasScene = obj.scene && typeof obj.scene === 'object';
    const hasCharacters = Array.isArray(obj.characters);
    const hasChoices = Array.isArray(obj.choices);

    // Also check for common alternative structures
    const hasBackground = obj.background !== undefined;
    const hasNpcs = Array.isArray(obj.npcs);
    const hasOptions = Array.isArray(obj.options);

    return hasScene || hasCharacters || hasChoices || hasBackground || hasNpcs || hasOptions;
}

/**
 * Try to parse JSON string
 */
function tryParseJson(str) {
    try {
        return { parsed: JSON.parse(str), error: null };
    } catch (e) {
        return { parsed: null, error: e.message };
    }
}

// =============================================================================
// MAIN EXTRACTION
// =============================================================================

/**
 * Extract JSON from an LLM response
 * @param {string} response - Raw LLM response
 * @returns {{ rawJson: string|null, narrative: string, source: string, confidence: number, fixes: string[], attempts: number }}
 */
export function extractJsonFromResponse(response) {
    const result = {
        rawJson: null,
        narrative: response || '',
        source: 'none',
        confidence: 0,
        fixes: [],
        attempts: 0,
    };

    if (!response || typeof response !== 'string') {
        return result;
    }

    // Preprocess
    let processed = preprocessResponse(response);
    if (processed !== response) {
        result.fixes.push('Preprocessed response (stripped tags/entities)');
    }

    // Collect all candidates
    const candidates = extractAllJsonCandidates(processed);
    result.attempts = candidates.length;

    if (candidates.length === 0) {
        return result;
    }

    // Sort by priority (descending), then by confidence
    candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.confidence - a.confidence;
    });

    // Find first valid candidate
    for (const candidate of candidates) {
        if (candidate.isValid) {
            result.rawJson = candidate.raw;
            result.source = candidate.source;
            result.confidence = candidate.confidence;

            // Remove the JSON block from narrative
            result.narrative = processed.replace(candidate.fullMatch, '').trim();

            console.debug(`[${MODULE_NAME}] Extracted from ${candidate.source} (confidence: ${candidate.confidence})`);
            break;
        }
    }

    // If no valid candidates, return best raw JSON for further processing
    if (!result.rawJson && candidates.length > 0) {
        const best = candidates[0];
        result.rawJson = best.raw;
        result.source = best.source + '-invalid';
        result.confidence = Math.max(10, best.confidence - 30);
        result.narrative = processed.replace(best.fullMatch, '').trim();
        result.fixes.push('Using invalid JSON candidate for repair attempt');
    }

    return result;
}

/**
 * Extract ALL JSON candidates from response (for diagnostics)
 * @param {string} response - Preprocessed response
 * @returns {Array} Array of candidate objects
 */
export function extractAllJsonCandidates(response) {
    if (!response) return [];

    const candidates = [];
    const processed = preprocessResponse(response);

    for (const patternDef of EXTRACTION_PATTERNS) {
        // Reset regex state
        patternDef.pattern.lastIndex = 0;

        let match;
        while ((match = patternDef.pattern.exec(processed)) !== null) {
            const rawJson = match[1]?.trim();
            if (!rawJson) continue;

            // Skip duplicates
            if (candidates.some(c => c.raw === rawJson)) continue;

            // Try to parse
            const parseResult = tryParseJson(rawJson);
            const isValid = parseResult.parsed !== null && isValidSceneJson(parseResult.parsed);

            candidates.push({
                raw: rawJson,
                fullMatch: match[0],
                source: patternDef.name,
                priority: patternDef.priority,
                confidence: calculateConfidence(patternDef, isValid, rawJson),
                isValid,
                parseError: parseResult.error,
                parsed: parseResult.parsed,
            });
        }

        // Reset for potential re-use
        patternDef.pattern.lastIndex = 0;
    }

    return candidates;
}

/**
 * Calculate confidence score for a candidate
 */
function calculateConfidence(patternDef, isValid, rawJson) {
    let confidence = patternDef.priority * 10; // Base from priority (10-100)

    // Bonus for valid JSON
    if (isValid) {
        confidence += 20;
    }

    // Bonus for having expected fields
    if (rawJson.includes('"scene"')) confidence += 5;
    if (rawJson.includes('"characters"')) confidence += 5;
    if (rawJson.includes('"choices"')) confidence += 5;
    if (rawJson.includes('"background"')) confidence += 3;
    if (rawJson.includes('"expression"')) confidence += 3;

    // Penalty for being too short
    if (rawJson.length < 20) confidence -= 20;

    // Penalty for looking like debug/error JSON
    if (rawJson.includes('"error"') || rawJson.includes('"debug"')) {
        confidence -= 30;
    }

    return Math.max(0, Math.min(100, confidence));
}

// =============================================================================
// SPECIALIZED EXTRACTORS
// =============================================================================

/**
 * Extract from GPT function call format
 * @param {string} response - Response text
 * @returns {Object|null}
 */
export function extractFromFunctionCall(response) {
    const pattern = /"name"\s*:\s*"(?:update_scene|set_scene|vn_scene)"[\s\S]*?"arguments"\s*:\s*(\{[\s\S]*?\})/gi;
    const match = pattern.exec(response);

    if (match) {
        const parseResult = tryParseJson(match[1]);
        if (parseResult.parsed) {
            return parseResult.parsed;
        }
    }

    return null;
}

/**
 * Extract from YAML-like format (Mistral quirk)
 * @param {string} response - Response text
 * @returns {Object|null}
 */
export function extractFromYaml(response) {
    const yamlPattern = /```yaml\s*([\s\S]*?)```/gi;
    const match = yamlPattern.exec(response);

    if (!match) return null;

    // Very basic YAML to JSON conversion
    // Only handles simple key: value pairs
    try {
        const yaml = match[1];
        const lines = yaml.split('\n').filter(l => l.trim());
        const obj = {};
        let currentKey = null;
        let currentArray = null;

        for (const line of lines) {
            const trimmed = line.trim();

            // Array item
            if (trimmed.startsWith('- ')) {
                if (currentArray) {
                    currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
                }
                continue;
            }

            // Key: value
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx > 0) {
                const key = trimmed.slice(0, colonIdx).trim();
                const value = trimmed.slice(colonIdx + 1).trim();

                if (value === '' || value === '[]') {
                    obj[key] = [];
                    currentKey = key;
                    currentArray = obj[key];
                } else if (value === '{}' || value === 'null') {
                    obj[key] = null;
                    currentArray = null;
                } else {
                    obj[key] = value.replace(/^["']|["']$/g, '');
                    currentArray = null;
                }
            }
        }

        return isValidSceneJson(obj) ? obj : null;
    } catch {
        return null;
    }
}
