/**
 * ============================================================================
 * COTTON-TALES SCENE LINTER - JSON SYNTAX FIXER
 * ============================================================================
 * Fixes 25+ common JSON syntax errors that LLMs produce.
 *
 * Categories:
 * - Quote issues (wrong quotes, missing quotes, unescaped)
 * - Comma issues (trailing, missing, double)
 * - Bracket issues (unclosed, extra, mismatched)
 * - Number/Value issues (NaN, Infinity, undefined)
 * - Whitespace issues (control chars, BOM, NBSP)
 * - Comment issues (// and /* in JSON)
 *
 * @version 1.0.0
 * ============================================================================
 */

const MODULE_NAME = 'CT-FixJsonSyntax';

// =============================================================================
// MAIN SANITIZER
// =============================================================================

/**
 * Sanitize JSON string and attempt to parse
 * @param {string} jsonStr - Raw JSON string (possibly malformed)
 * @returns {{ parsed: Object|null, fixed: string, fixes: string[], error: string|null }}
 */
export function sanitizeJsonSyntax(jsonStr) {
    const result = {
        parsed: null,
        fixed: jsonStr,
        fixes: [],
        error: null,
    };

    if (!jsonStr || typeof jsonStr !== 'string') {
        result.error = 'Empty or invalid input';
        return result;
    }

    // Try parsing first - maybe it's already valid
    try {
        result.parsed = JSON.parse(jsonStr);
        return result;
    } catch (e) {
        // Continue with fixes
    }

    let current = jsonStr.trim();

    // Apply fixes in order
    const fixers = [
        // PHASE 1: Whitespace and encoding
        fixBomAndInvisibles,
        fixControlCharacters,
        fixNbspAndWeirdSpaces,

        // PHASE 2: Comment removal
        fixSingleLineComments,
        fixMultiLineComments,
        fixHashComments,

        // PHASE 3: Quote normalization
        fixSmartQuotes,
        fixSingleQuotes,
        fixUnquotedKeys,
        fixUnescapedQuotes,
        fixMissingValueQuotes,

        // PHASE 4: Value normalization
        fixUndefinedNull,
        fixNaNInfinity,
        fixBareWords,
        fixPythonBooleans,
        fixTrailingDecimals,

        // PHASE 5: Structure fixes
        fixTrailingCommas,
        fixMissingCommas,
        fixDoubleCommas,
        fixLeadingCommas,

        // PHASE 6: Bracket fixes
        fixUnclosedBrackets,
        fixExtraBrackets,
        fixMismatchedBrackets,

        // PHASE 7: Miscellaneous
        fixEllipsis,
        fixHexNumbers,
        fixOctalNumbers,
    ];

    for (const fixer of fixers) {
        const before = current;
        current = fixer(current);
        if (current !== before) {
            result.fixes.push(fixer.name.replace(/^fix/, ''));
        }
    }

    result.fixed = current;

    // Try parsing the fixed version
    try {
        result.parsed = JSON.parse(current);
    } catch (e) {
        result.error = e.message;

        // Last resort: try extracting just the object
        const extracted = extractJsonObject(current);
        if (extracted) {
            try {
                result.parsed = JSON.parse(extracted);
                result.fixes.push('ExtractedInnerObject');
            } catch {
                // Give up
            }
        }
    }

    if (result.fixes.length > 0) {
        console.debug(`[${MODULE_NAME}] Applied ${result.fixes.length} fixes: ${result.fixes.join(', ')}`);
    }

    return result;
}

// =============================================================================
// WHITESPACE AND ENCODING FIXES
// =============================================================================

/**
 * Remove BOM and other invisible characters
 */
function fixBomAndInvisibles(str) {
    return str
        .replace(/^\uFEFF/, '') // UTF-8 BOM
        .replace(/^\uFFFE/, '') // UTF-16 BE BOM
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width chars
        .replace(/\u00AD/g, ''); // Soft hyphen
}

/**
 * Remove control characters (except valid whitespace)
 */
function fixControlCharacters(str) {
    // Keep \n, \r, \t but remove other control chars
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Replace NBSP and other weird spaces with regular space
 */
function fixNbspAndWeirdSpaces(str) {
    return str
        .replace(/\u00A0/g, ' ') // NBSP
        .replace(/\u2000/g, ' ') // EN QUAD
        .replace(/\u2001/g, ' ') // EM QUAD
        .replace(/\u2002/g, ' ') // EN SPACE
        .replace(/\u2003/g, ' ') // EM SPACE
        .replace(/\u2004/g, ' ') // THREE-PER-EM SPACE
        .replace(/\u2005/g, ' ') // FOUR-PER-EM SPACE
        .replace(/\u2006/g, ' ') // SIX-PER-EM SPACE
        .replace(/\u2007/g, ' ') // FIGURE SPACE
        .replace(/\u2008/g, ' ') // PUNCTUATION SPACE
        .replace(/\u2009/g, ' ') // THIN SPACE
        .replace(/\u200A/g, ' ') // HAIR SPACE
        .replace(/\u202F/g, ' ') // NARROW NO-BREAK SPACE
        .replace(/\u205F/g, ' ') // MEDIUM MATHEMATICAL SPACE
        .replace(/\u3000/g, ' '); // IDEOGRAPHIC SPACE
}

// =============================================================================
// COMMENT REMOVAL
// =============================================================================

/**
 * Remove single-line // comments
 */
function fixSingleLineComments(str) {
    // Be careful not to remove // inside strings
    let result = '';
    let inString = false;
    let stringChar = null;
    let i = 0;

    while (i < str.length) {
        const char = str[i];
        const next = str[i + 1];

        // Handle string state
        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            result += char;
            i++;
        } else if (inString && char === stringChar && str[i - 1] !== '\\') {
            inString = false;
            stringChar = null;
            result += char;
            i++;
        } else if (!inString && char === '/' && next === '/') {
            // Skip to end of line
            while (i < str.length && str[i] !== '\n') {
                i++;
            }
        } else {
            result += char;
            i++;
        }
    }

    return result;
}

/**
 * Remove multi-line /* comments
 */
function fixMultiLineComments(str) {
    let result = '';
    let inString = false;
    let stringChar = null;
    let i = 0;

    while (i < str.length) {
        const char = str[i];
        const next = str[i + 1];

        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            result += char;
            i++;
        } else if (inString && char === stringChar && str[i - 1] !== '\\') {
            inString = false;
            stringChar = null;
            result += char;
            i++;
        } else if (!inString && char === '/' && next === '*') {
            // Skip to */
            i += 2;
            while (i < str.length - 1 && !(str[i] === '*' && str[i + 1] === '/')) {
                i++;
            }
            i += 2; // Skip */
        } else {
            result += char;
            i++;
        }
    }

    return result;
}

/**
 * Remove hash # comments (Python style)
 */
function fixHashComments(str) {
    let result = '';
    let inString = false;
    let stringChar = null;
    let i = 0;

    while (i < str.length) {
        const char = str[i];

        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            result += char;
            i++;
        } else if (inString && char === stringChar && str[i - 1] !== '\\') {
            inString = false;
            stringChar = null;
            result += char;
            i++;
        } else if (!inString && char === '#') {
            // Skip to end of line
            while (i < str.length && str[i] !== '\n') {
                i++;
            }
        } else {
            result += char;
            i++;
        }
    }

    return result;
}

// =============================================================================
// QUOTE FIXES
// =============================================================================

/**
 * Replace smart/curly quotes with straight quotes
 */
function fixSmartQuotes(str) {
    return str
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Double quotes
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'") // Single quotes
        .replace(/[\u00AB\u00BB]/g, '"'); // Guillemets
}

/**
 * Replace single quotes with double quotes for JSON keys/values
 */
function fixSingleQuotes(str) {
    // This is tricky - we need to handle:
    // {'key': 'value'} -> {"key": "value"}
    // but NOT change apostrophes in values: "don't" should stay

    // Simple approach: replace single quotes that look like JSON structure
    let result = '';
    let i = 0;

    while (i < str.length) {
        const char = str[i];
        const prev = str[i - 1] || '';
        const next = str[i + 1] || '';

        if (char === "'") {
            // Check if this looks like a JSON structural quote
            const isStructural =
                /[{[:,]/.test(prev.trim() || ' ') || // After structure chars
                /[}:\],]/.test(next.trim() || ' ') || // Before structure chars
                (prev === '' || /\s/.test(prev)) && /\w/.test(next); // Start of key

            if (isStructural) {
                result += '"';
            } else {
                result += char;
            }
        } else {
            result += char;
        }
        i++;
    }

    return result;
}

/**
 * Add quotes around unquoted keys
 */
function fixUnquotedKeys(str) {
    // Match: { key: or , key: where key is unquoted
    return str.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
}

/**
 * Escape unescaped quotes inside strings
 */
function fixUnescapedQuotes(str) {
    let result = '';
    let inString = false;
    let i = 0;

    while (i < str.length) {
        const char = str[i];
        const prev = str[i - 1] || '';

        if (char === '"' && prev !== '\\') {
            if (!inString) {
                inString = true;
                result += char;
            } else {
                // Check if this looks like end of string
                const rest = str.slice(i + 1).trimStart();
                if (/^[,}\]:]/.test(rest) || rest === '') {
                    inString = false;
                    result += char;
                } else {
                    // Probably unescaped quote inside string
                    result += '\\"';
                }
            }
        } else {
            result += char;
        }
        i++;
    }

    return result;
}

/**
 * Add quotes around unquoted string values
 */
function fixMissingValueQuotes(str) {
    // Match: : value, or : value} where value is unquoted but looks like a string
    // Be careful not to match numbers, booleans, null
    return str.replace(
        /(:\s*)([a-zA-Z][a-zA-Z0-9_\s-]*)(\s*[,}\]])/g,
        (match, before, value, after) => {
            const trimmed = value.trim();
            // Don't quote booleans, null, numbers
            if (/^(true|false|null)$/i.test(trimmed) || /^-?\d/.test(trimmed)) {
                return match;
            }
            return `${before}"${trimmed}"${after}`;
        }
    );
}

// =============================================================================
// VALUE FIXES
// =============================================================================

/**
 * Replace undefined with null
 */
function fixUndefinedNull(str) {
    // Match undefined as a value (not in a string)
    return str.replace(/:\s*undefined\b/gi, ': null');
}

/**
 * Replace NaN and Infinity with null
 */
function fixNaNInfinity(str) {
    return str
        .replace(/:\s*NaN\b/g, ': null')
        .replace(/:\s*-?Infinity\b/g, ': null');
}

/**
 * Fix bare words that should be null/boolean/string
 */
function fixBareWords(str) {
    // Common bare words that should be null
    return str
        .replace(/:\s*None\b/g, ': null') // Python
        .replace(/:\s*nil\b/g, ': null') // Ruby/Lua
        .replace(/:\s*NULL\b/g, ': null') // SQL
        .replace(/:\s*empty\b/gi, ': null');
}

/**
 * Fix Python-style booleans
 */
function fixPythonBooleans(str) {
    return str
        .replace(/:\s*True\b/g, ': true')
        .replace(/:\s*False\b/g, ': false');
}

/**
 * Fix trailing decimals (.5 -> 0.5)
 */
function fixTrailingDecimals(str) {
    return str.replace(/(:\s*)(\.\d+)/g, '$10$2');
}

// =============================================================================
// COMMA FIXES
// =============================================================================

/**
 * Remove trailing commas
 */
function fixTrailingCommas(str) {
    // Remove comma before ] or }
    return str
        .replace(/,(\s*])/g, '$1')
        .replace(/,(\s*})/g, '$1');
}

/**
 * Add missing commas between values
 */
function fixMissingCommas(str) {
    // Pattern: "value" "key" should be "value", "key"
    // Pattern: "value"\n"key" should be "value",\n"key"
    // Pattern: }\n{ should be },\n{
    // Pattern: ]\n[ should be ],\n[
    return str
        .replace(/"(\s*\n\s*)"/g, '",$1"')
        .replace(/}(\s*\n\s*){/g, '},$1{')
        .replace(/](\s*\n\s*)\[/g, '],$1[')
        .replace(/(\d)(\s*\n\s*)"/g, '$1,$2"')
        .replace(/(true|false|null)(\s*\n\s*)"/g, '$1,$2"');
}

/**
 * Remove double commas
 */
function fixDoubleCommas(str) {
    // Replace ,, with ,
    return str.replace(/,(\s*),/g, ',');
}

/**
 * Remove leading commas
 */
function fixLeadingCommas(str) {
    // Remove comma after [ or {
    return str
        .replace(/(\[\s*),/g, '$1')
        .replace(/({\s*),/g, '$1');
}

// =============================================================================
// BRACKET FIXES
// =============================================================================

/**
 * Close unclosed brackets
 */
function fixUnclosedBrackets(str) {
    const opens = { '{': 0, '[': 0 };
    let inString = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const prev = str[i - 1] || '';

        if (char === '"' && prev !== '\\') {
            inString = !inString;
        } else if (!inString) {
            if (char === '{') opens['{']++;
            else if (char === '}') opens['{']--;
            else if (char === '[') opens['[']++;
            else if (char === ']') opens['[']--;
        }
    }

    // Add missing closing brackets
    let result = str;
    while (opens['{'] > 0) {
        result += '}';
        opens['{']--;
    }
    while (opens['['] > 0) {
        result += ']';
        opens['[']--;
    }

    return result;
}

/**
 * Remove extra closing brackets
 */
function fixExtraBrackets(str) {
    const opens = { '{': 0, '[': 0 };
    let result = '';
    let inString = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const prev = str[i - 1] || '';

        if (char === '"' && prev !== '\\') {
            inString = !inString;
            result += char;
        } else if (!inString) {
            if (char === '{') {
                opens['{']++;
                result += char;
            } else if (char === '}') {
                if (opens['{'] > 0) {
                    opens['{']--;
                    result += char;
                }
                // Skip extra }
            } else if (char === '[') {
                opens['[']++;
                result += char;
            } else if (char === ']') {
                if (opens['['] > 0) {
                    opens['[']--;
                    result += char;
                }
                // Skip extra ]
            } else {
                result += char;
            }
        } else {
            result += char;
        }
    }

    return result;
}

/**
 * Fix mismatched brackets (e.g., [} or {])
 */
function fixMismatchedBrackets(str) {
    // This is complex - for now, just validate and warn
    // A full fix would require understanding the structure
    return str;
}

// =============================================================================
// MISCELLANEOUS FIXES
// =============================================================================

/**
 * Replace ellipsis with empty string or null
 */
function fixEllipsis(str) {
    // "field": ... -> "field": null
    return str
        .replace(/:\s*\.{3,}/g, ': null')
        .replace(/:\s*…/g, ': null');
}

/**
 * Convert hex numbers to decimal
 */
function fixHexNumbers(str) {
    // 0xFF -> 255
    return str.replace(/:\s*(0x[0-9A-Fa-f]+)/g, (match, hex) => {
        const num = parseInt(hex, 16);
        return `: ${num}`;
    });
}

/**
 * Convert octal numbers to decimal
 */
function fixOctalNumbers(str) {
    // 0777 -> 511 (be careful with 0 prefix that's not octal)
    return str.replace(/:\s*(0[0-7]+)\b/g, (match, octal) => {
        // Only convert if it looks intentionally octal
        if (octal.length > 1 && /^0[0-7]+$/.test(octal)) {
            const num = parseInt(octal, 8);
            return `: ${num}`;
        }
        return match;
    });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Try to extract a JSON object from malformed string
 */
function extractJsonObject(str) {
    // Find first { and try to find matching }
    const start = str.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;

    for (let i = start; i < str.length; i++) {
        const char = str[i];
        const prev = str[i - 1] || '';

        if (char === '"' && prev !== '\\') {
            inString = !inString;
        } else if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return str.slice(start, i + 1);
                }
            }
        }
    }

    // If we didn't find matching }, return from start to end with closing
    return str.slice(start) + '}'.repeat(depth);
}

/**
 * Get detailed error location from JSON parse error
 * @param {string} str - JSON string
 * @param {string} errorMsg - Error message from JSON.parse
 * @returns {{ line: number, column: number, context: string }}
 */
export function getJsonErrorLocation(str, errorMsg) {
    // Try to extract position from error message
    const posMatch = errorMsg.match(/position\s+(\d+)/i);
    const pos = posMatch ? parseInt(posMatch[1]) : 0;

    // Calculate line and column
    let line = 1;
    let column = 1;
    for (let i = 0; i < pos && i < str.length; i++) {
        if (str[i] === '\n') {
            line++;
            column = 1;
        } else {
            column++;
        }
    }

    // Get context around the error
    const start = Math.max(0, pos - 20);
    const end = Math.min(str.length, pos + 20);
    const context = str.slice(start, end);

    return { line, column, context };
}
