/**
 * ============================================================================
 * COTTON-TALES SCENE LINTER - MAIN ORCHESTRATOR
 * ============================================================================
 * Robust parsing pipeline that handles all the creative ways LLMs butcher JSON.
 *
 * Pipeline:
 * 1. Extract JSON from response (handles 25+ block formats)
 * 2. Fix JSON syntax errors (handles 25+ common mistakes)
 * 3. Fix schema structure (handles 25+ structural problems)
 * 4. Normalize values (handles 25+ value format issues)
 * 5. Fallback: Extract from plain text if all else fails
 *
 * @version 1.0.0
 * ============================================================================
 */

import { extractJsonFromResponse, extractAllJsonCandidates } from './extract-json.js';
import { sanitizeJsonSyntax } from './fix-json-syntax.js';
import { normalizeSchemaStructure } from './fix-schema.js';
import { normalizeAllValues } from './normalize-values.js';
import { extractFromNarrative } from './fallback-extract.js';

const MODULE_NAME = 'CT-Linter';

// =============================================================================
// MAIN LINTING PIPELINE
// =============================================================================

/**
 * Full linting pipeline result
 * @typedef {Object} LintResult
 * @property {Object|null} scene - Parsed and normalized scene data
 * @property {string} narrative - Clean narrative text (JSON stripped)
 * @property {string} source - Where the data came from
 * @property {number} confidence - 0-100 confidence score
 * @property {string[]} fixes - List of fixes applied
 * @property {string[]} warnings - Non-fatal issues encountered
 * @property {Object} diagnostics - Detailed diagnostic info
 */

/**
 * Run the full linting pipeline on an LLM response
 * @param {string} response - Raw LLM response text
 * @param {Object} options - Linting options
 * @param {string[]} [options.validExpressions] - Valid expression names
 * @param {string[]} [options.validBackgrounds] - Valid background names
 * @param {string[]} [options.validCharacters] - Known character names
 * @param {boolean} [options.allowFallback=true] - Try text extraction if JSON fails
 * @param {boolean} [options.strict=false] - Fail on any issues vs graceful degradation
 * @returns {LintResult}
 */
export function lintSceneResponse(response, options = {}) {
    const {
        validExpressions = [],
        validBackgrounds = [],
        validCharacters = [],
        allowFallback = true,
        strict = false,
    } = options;

    const result = {
        scene: null,
        narrative: response || '',
        source: 'none',
        confidence: 0,
        fixes: [],
        warnings: [],
        diagnostics: {
            originalLength: response?.length || 0,
            extractionAttempts: 0,
            syntaxFixesApplied: 0,
            schemaFixesApplied: 0,
            valueNormalizationsApplied: 0,
        },
    };

    if (!response || typeof response !== 'string') {
        result.warnings.push('Empty or invalid response');
        return result;
    }

    // =========================================================================
    // PHASE 1: Extract JSON from response
    // =========================================================================
    console.debug(`[${MODULE_NAME}] Phase 1: Extracting JSON...`);

    const extraction = extractJsonFromResponse(response);
    result.diagnostics.extractionAttempts = extraction.attempts;
    result.narrative = extraction.narrative;

    if (!extraction.rawJson) {
        // No JSON found - try fallback if enabled
        if (allowFallback) {
            console.debug(`[${MODULE_NAME}] No JSON found, trying fallback extraction...`);
            return tryFallbackExtraction(response, result, options);
        }
        result.warnings.push('No JSON block found in response');
        return result;
    }

    result.source = extraction.source;
    result.confidence = extraction.confidence;
    result.fixes.push(...extraction.fixes);

    // =========================================================================
    // PHASE 2: Fix JSON syntax errors
    // =========================================================================
    console.debug(`[${MODULE_NAME}] Phase 2: Fixing JSON syntax...`);

    const syntaxResult = sanitizeJsonSyntax(extraction.rawJson);
    result.diagnostics.syntaxFixesApplied = syntaxResult.fixes.length;
    result.fixes.push(...syntaxResult.fixes);

    if (!syntaxResult.parsed) {
        result.warnings.push('JSON syntax unfixable: ' + syntaxResult.error);

        if (allowFallback) {
            return tryFallbackExtraction(response, result, options);
        }
        return result;
    }

    // =========================================================================
    // PHASE 3: Fix schema structure
    // =========================================================================
    console.debug(`[${MODULE_NAME}] Phase 3: Fixing schema structure...`);

    const schemaResult = normalizeSchemaStructure(syntaxResult.parsed);
    result.diagnostics.schemaFixesApplied = schemaResult.fixes.length;
    result.fixes.push(...schemaResult.fixes);
    result.warnings.push(...schemaResult.warnings);

    if (!schemaResult.normalized) {
        result.warnings.push('Schema structure unfixable');

        if (allowFallback) {
            return tryFallbackExtraction(response, result, options);
        }
        return result;
    }

    // =========================================================================
    // PHASE 4: Normalize values
    // =========================================================================
    console.debug(`[${MODULE_NAME}] Phase 4: Normalizing values...`);

    const valueResult = normalizeAllValues(schemaResult.normalized, {
        validExpressions,
        validBackgrounds,
        validCharacters,
    });
    result.diagnostics.valueNormalizationsApplied = valueResult.fixes.length;
    result.fixes.push(...valueResult.fixes);
    result.warnings.push(...valueResult.warnings);

    result.scene = valueResult.normalized;

    // Adjust confidence based on fixes applied
    const totalFixes = result.fixes.length;
    if (totalFixes > 0) {
        // Reduce confidence slightly for each fix (but not below 50 if we got valid data)
        result.confidence = Math.max(50, result.confidence - (totalFixes * 2));
    }

    console.log(`[${MODULE_NAME}] Linting complete: ${result.fixes.length} fixes, confidence ${result.confidence}%`);

    return result;
}

/**
 * Try fallback text extraction
 * @param {string} response - Original response
 * @param {LintResult} result - Result object to update
 * @param {Object} options - Linting options
 * @returns {LintResult}
 */
function tryFallbackExtraction(response, result, options) {
    console.debug(`[${MODULE_NAME}] Running fallback text extraction...`);

    const fallback = extractFromNarrative(response, {
        validExpressions: options.validExpressions || [],
        validBackgrounds: options.validBackgrounds || [],
        validCharacters: options.validCharacters || [],
    });

    if (fallback.scene && fallback.confidence > 30) {
        result.scene = fallback.scene;
        result.source = 'fallback-text';
        result.confidence = fallback.confidence;
        result.fixes.push('Used fallback text extraction');
        result.fixes.push(...fallback.extractions);
        result.warnings.push('Scene data extracted from narrative (no JSON found)');
    } else {
        result.warnings.push('Fallback extraction failed or low confidence');
    }

    return result;
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Quick check if response likely contains scene data
 * @param {string} response - Response to check
 * @returns {boolean}
 */
export function hasSceneData(response) {
    if (!response) return false;

    // Check for JSON-like patterns
    const jsonPatterns = [
        /```(?:json|vn-scene)/i,
        /\[VN-SCENE\]/i,
        /<vn-scene>/i,
        /"scene"\s*:/,
        /"characters"\s*:/,
        /"choices"\s*:/,
    ];

    return jsonPatterns.some(p => p.test(response));
}

/**
 * Strip scene JSON from response for display
 * @param {string} response - Response to clean
 * @returns {string} Narrative only
 */
export function stripSceneJson(response) {
    if (!response) return '';

    const extraction = extractJsonFromResponse(response);
    return extraction.narrative;
}

/**
 * Get diagnostic info about a response
 * @param {string} response - Response to analyze
 * @returns {Object} Diagnostic info
 */
export function diagnoseResponse(response) {
    const candidates = extractAllJsonCandidates(response);

    return {
        totalLength: response?.length || 0,
        jsonCandidates: candidates.length,
        candidates: candidates.map(c => ({
            source: c.source,
            length: c.raw.length,
            confidence: c.confidence,
            parseError: c.parseError || null,
        })),
        hasExplicitTag: /```vn-scene|<vn-scene>|\[VN-SCENE\]/i.test(response),
        hasGenericJson: /```json/i.test(response),
        hasRawJson: /^\s*\{/.test(response),
    };
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Lint multiple responses (for testing/debugging)
 * @param {string[]} responses - Array of responses
 * @param {Object} options - Linting options
 * @returns {LintResult[]}
 */
export function lintBatch(responses, options = {}) {
    return responses.map(r => lintSceneResponse(r, options));
}

/**
 * Get statistics from batch linting
 * @param {LintResult[]} results - Array of lint results
 * @returns {Object} Statistics
 */
export function getBatchStats(results) {
    const total = results.length;
    const successful = results.filter(r => r.scene !== null).length;
    const fromJson = results.filter(r => r.source !== 'fallback-text' && r.source !== 'none').length;
    const fromFallback = results.filter(r => r.source === 'fallback-text').length;
    const failed = results.filter(r => r.scene === null).length;

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / total;
    const totalFixes = results.reduce((sum, r) => sum + r.fixes.length, 0);

    // Count fix types
    const fixCounts = {};
    results.forEach(r => {
        r.fixes.forEach(fix => {
            const key = fix.split(':')[0].trim();
            fixCounts[key] = (fixCounts[key] || 0) + 1;
        });
    });

    return {
        total,
        successful,
        fromJson,
        fromFallback,
        failed,
        successRate: (successful / total * 100).toFixed(1) + '%',
        avgConfidence: avgConfidence.toFixed(1),
        totalFixes,
        avgFixesPerResponse: (totalFixes / total).toFixed(1),
        fixCounts,
    };
}
