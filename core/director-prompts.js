/**
 * ============================================================================
 * COTTON-TALES DIRECTOR PROMPTS
 * ============================================================================
 * System prompts and schema definitions for the Director (Story LLM).
 *
 * The Director receives these prompts to understand:
 * 1. What assets are available (backgrounds, sprites, NPCs)
 * 2. What format to output (JSON schema)
 * 3. How to structure VN-style responses
 *
 * @version 1.0.0
 * ============================================================================
 */

import { getSettings } from './settings-manager.js';
import { resolveCtMacros } from './macro-resolver.js';

const MODULE_NAME = 'CT-DirectorPrompts';

// =============================================================================
// JSON SCHEMA
// =============================================================================

/**
 * The JSON schema that the Director must output alongside narrative
 */
export const VN_SCHEMA = {
    scene: {
        background: { type: 'string|null', description: 'Background to display. Use null to keep current.' },
        music: { type: 'string|null', description: 'Music track to play. Use null to keep current.' },
        sfx: { type: 'string|null', description: 'One-shot sound effect to play.' },
    },
    characters: {
        type: 'array',
        items: {
            name: { type: 'string', description: 'Character name exactly as defined' },
            expression: { type: 'string|null', description: 'Expression/emotion to show' },
            outfit: { type: 'string|null', description: 'Outfit to wear. Use null to keep current.' },
            position: { type: 'enum', values: ['left', 'center', 'right'], description: 'Screen position' },
            action: { type: 'enum|null', values: ['enters', 'exits', 'speaks'], description: 'Character action' },
        },
    },
    choices: {
        type: 'array',
        description: 'Interactive choices for the player. Empty array if no choices.',
        items: {
            label: { type: 'string', description: 'Button text shown to player (short, 2-6 words)' },
            prompt: { type: 'string', description: 'What happens narratively if player picks this' },
        },
    },
};

/**
 * Get schema as formatted string for prompts
 */
export function getSchemaString() {
    return JSON.stringify(VN_SCHEMA, null, 2);
}

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

/**
 * Default Director system prompt template
 * Uses {{ct_*}} macros that get resolved at runtime
 */
export const DEFAULT_DIRECTOR_PROMPT = `## Visual Novel Director Mode

You are running a visual novel. In addition to writing narrative, you control the scene.

### Available Assets

**Backgrounds:** {{ct_backgrounds}}
**Current Background:** {{ct_bg_current}}

**{{char}}'s Expressions:** {{ct_expressions}}
**{{char}}'s Outfits:** {{ct_outfits}}

{{ct_npc_data}}

### Current Scene State
{{ct_scene_characters}}
Location: {{ct_scene_location}}

### Output Format

After your narrative response, include a JSON block with scene directions:

\`\`\`vn-scene
{
  "scene": {
    "background": "background_name or null",
    "music": "track_name or null",
    "sfx": "effect_name or null"
  },
  "characters": [
    {
      "name": "Character Name",
      "expression": "emotion",
      "outfit": "outfit_name or null",
      "position": "left|center|right",
      "action": "enters|exits|speaks|null"
    }
  ],
  "choices": [
    {
      "label": "Short button text",
      "prompt": "What happens if selected"
    }
  ]
}
\`\`\`

### Guidelines

1. **Backgrounds:** Only change when location actually changes
2. **Expressions:** Match character's emotional state in the narrative
3. **Choices:** Offer {{ct_choice_count}} meaningful choices when appropriate (not every message)
4. **NPCs:** Can enter/exit scenes as story demands
5. **Keep JSON valid:** Use exact asset names from the available lists
`;

/**
 * Minimal Director prompt for users who want less guidance
 */
export const MINIMAL_DIRECTOR_PROMPT = `Output scene directions after narrative in \`\`\`vn-scene JSON block.

Assets: {{ct_backgrounds}} | {{ct_expressions}}
NPCs: {{ct_npcs}}

Schema: { scene: {background, music, sfx}, characters: [{name, expression, position, action}], choices: [{label, prompt}] }
`;

/**
 * Detailed Director prompt with examples
 */
export const DETAILED_DIRECTOR_PROMPT = `## Visual Novel Director System

You control both narrative AND visual presentation. Think of yourself as a VN game engine.

### Your Assets

**Backgrounds Available:**
{{ct_backgrounds}}

**Main Character ({{char}}):**
- Expressions: {{ct_expressions}}
- Outfits: {{ct_outfits}}
- Current: {{ct_expression_current}} / {{ct_outfit_current}}

**NPCs:**
{{ct_npc_data}}

**Current Scene:**
- Background: {{ct_bg_current}}
- Characters present: {{ct_scene_characters}}

### Output Structure

1. Write your narrative response normally
2. End with a \`\`\`vn-scene code block containing JSON

### Example Response

*Luna looked up from her book, startled by {{user}}'s sudden entrance.*

"O-oh! I didn't hear you come in..." *She clutched the book to her chest, cheeks flushing.*

\`\`\`vn-scene
{
  "scene": {
    "background": null,
    "music": null,
    "sfx": "door_open"
  },
  "characters": [
    {
      "name": "Luna",
      "expression": "embarrassed",
      "outfit": null,
      "position": "center",
      "action": "speaks"
    }
  ],
  "choices": [
    {
      "label": "Apologize",
      "prompt": "{{user}} apologizes for startling her"
    },
    {
      "label": "Tease her",
      "prompt": "{{user}} playfully teases Luna about being jumpy"
    },
    {
      "label": "Ask about book",
      "prompt": "{{user}} asks what Luna is reading"
    }
  ]
}
\`\`\`

### Rules

1. **Use exact asset names** - Don't invent backgrounds or expressions
2. **null = keep current** - Only specify what changes
3. **Choices are optional** - Include when player agency makes sense
4. **Position matters** - left/center/right for multi-character scenes
5. **actions:** enters (new to scene), exits (leaving), speaks (talking), null (just present)
`;

// =============================================================================
// PROMPT MANAGEMENT
// =============================================================================

/**
 * Get the appropriate Director prompt based on settings
 * @returns {string} The raw prompt template (macros not yet resolved)
 */
export function getDirectorPromptTemplate() {
    const settings = getSettings();

    // Check for custom user prompt first
    if (settings.customDirectorPrompt && settings.customDirectorPrompt.trim()) {
        return settings.customDirectorPrompt;
    }

    // Use preset based on setting
    switch (settings.directorPromptStyle) {
        case 'minimal':
            return MINIMAL_DIRECTOR_PROMPT;
        case 'detailed':
            return DETAILED_DIRECTOR_PROMPT;
        case 'default':
        default:
            return DEFAULT_DIRECTOR_PROMPT;
    }
}

/**
 * Get fully resolved Director prompt ready to inject
 * @returns {Promise<string>} Prompt with all macros resolved
 */
export async function getResolvedDirectorPrompt() {
    const template = getDirectorPromptTemplate();
    const resolved = await resolveCtMacros(template);
    return resolved;
}

/**
 * Validate that a prompt template contains required macros
 * @param {string} template - Prompt template to validate
 * @returns {{ valid: boolean, missing: string[], warnings: string[] }}
 */
export function validatePromptTemplate(template) {
    const required = ['ct_backgrounds', 'ct_expressions'];
    const recommended = ['ct_npc_data', 'ct_scene_characters', 'ct_choice_count'];

    const missing = required.filter(macro => !template.includes(`{{${macro}}}`));
    const warnings = recommended.filter(macro => !template.includes(`{{${macro}}}`));

    return {
        valid: missing.length === 0,
        missing,
        warnings,
    };
}

// =============================================================================
// INJECTION POINTS
// =============================================================================

/**
 * Injection position options for the Director prompt
 */
export const INJECTION_POSITIONS = {
    SYSTEM_START: 'system_start',      // Very beginning of system prompt
    SYSTEM_END: 'system_end',          // End of system prompt
    AFTER_SCENARIO: 'after_scenario',  // After character scenario
    BEFORE_EXAMPLES: 'before_examples', // Before example messages
};

/**
 * Get the injection position from settings
 * @returns {string} Injection position key
 */
export function getInjectionPosition() {
    const settings = getSettings();
    return settings.directorPromptPosition || INJECTION_POSITIONS.SYSTEM_END;
}

// =============================================================================
// PRESET MANAGEMENT
// =============================================================================

/**
 * Available prompt presets
 */
export const PROMPT_PRESETS = {
    default: {
        name: 'Default',
        description: 'Balanced prompt with all features',
        template: DEFAULT_DIRECTOR_PROMPT,
    },
    minimal: {
        name: 'Minimal',
        description: 'Compact prompt for capable models',
        template: MINIMAL_DIRECTOR_PROMPT,
    },
    detailed: {
        name: 'Detailed',
        description: 'Verbose prompt with examples',
        template: DETAILED_DIRECTOR_PROMPT,
    },
};

/**
 * Get all available presets
 * @returns {Object} Preset definitions
 */
export function getPresets() {
    return { ...PROMPT_PRESETS };
}

/**
 * Get a specific preset by key
 * @param {string} key - Preset key
 * @returns {Object|null} Preset or null if not found
 */
export function getPreset(key) {
    return PROMPT_PRESETS[key] || null;
}
