/**
 * ============================================================================
 * COTTON-TALES DIRECTOR TAB UI
 * ============================================================================
 * UI component for the Director settings tab.
 *
 * @version 1.0.0
 * ============================================================================
 */

import { getSettings, updateSetting } from '../core/settings-manager.js';
import { DEFAULT_DIRECTOR_PROMPT, MINIMAL_DIRECTOR_PROMPT, DETAILED_DIRECTOR_PROMPT, getResolvedDirectorPrompt } from '../core/director-prompts.js';

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Generate the Director tab HTML
 * @returns {string} HTML for Director tab
 */
export function getDirectorTabHTML() {
    const settings = getSettings();

    return `
        <div class="ct-section-label">
            <i class="fa-solid fa-scroll"></i>
            Director Prompt
        </div>

        <p style="font-size: 12px; color: var(--ct-text-light); margin-bottom: 16px;">
            The Director prompt tells the AI how to output VN scene directions alongside narrative.
        </p>

        <!-- Prompt Preset Selector -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Prompt Preset</span>
            </div>
            <select class="ct-select" id="ct_director_preset">
                <option value="default" ${settings.directorPromptStyle === 'default' ? 'selected' : ''}>Default - Balanced</option>
                <option value="minimal" ${settings.directorPromptStyle === 'minimal' ? 'selected' : ''}>Minimal - Compact</option>
                <option value="detailed" ${settings.directorPromptStyle === 'detailed' ? 'selected' : ''}>Detailed - With Examples</option>
                <option value="custom" ${settings.directorPromptStyle === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
        </div>

        <!-- Custom Prompt Editor -->
        <div class="ct-custom-prompt-section" id="ct_custom_prompt_section" style="display: ${settings.directorPromptStyle === 'custom' ? 'block' : 'none'};">
            <div class="ct-slider-row">
                <div class="ct-slider-header">
                    <span class="ct-slider-label">Custom Director Prompt</span>
                </div>
                <textarea class="ct-textarea" id="ct_custom_director_prompt" rows="12" placeholder="Enter your custom Director prompt here...
Use macros like {{ct_backgrounds}}, {{ct_expressions}}, etc.">${escapeHtml(settings.customDirectorPrompt || '')}</textarea>
            </div>
            <div class="ct-action-row" style="margin-top: 8px;">
                <button class="ct-btn ct-btn-sm" id="ct_load_default_prompt">
                    <i class="fa-solid fa-file-import"></i>
                    Load Default
                </button>
                <button class="ct-btn ct-btn-sm" id="ct_preview_prompt">
                    <i class="fa-solid fa-eye"></i>
                    Preview Resolved
                </button>
            </div>
        </div>

        <!-- Injection Position -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Injection Position</span>
            </div>
            <select class="ct-select" id="ct_director_position">
                <option value="system_end" ${settings.directorPromptPosition === 'system_end' ? 'selected' : ''}>End of System Prompt</option>
                <option value="system_start" ${settings.directorPromptPosition === 'system_start' ? 'selected' : ''}>Start of System Prompt</option>
                <option value="after_scenario" ${settings.directorPromptPosition === 'after_scenario' ? 'selected' : ''}>After Scenario</option>
            </select>
        </div>

        <div class="ct-section-label" style="margin-top: 24px;">
            <i class="fa-solid fa-code"></i>
            Available Macros
        </div>

        <p style="font-size: 12px; color: var(--ct-text-light); margin-bottom: 12px;">
            These macros are replaced with actual data when the prompt is sent. Click to copy.
        </p>

        <div class="ct-macro-grid" id="ct_macro_grid">
            <div class="ct-macro-category">
                <div class="ct-macro-category-label">ST Built-in (auto-resolved)</div>
                <div class="ct-macro-chips">
                    <span class="ct-macro-chip ct-macro-builtin" data-macro="{{char}}">{{char}}</span>
                    <span class="ct-macro-chip ct-macro-builtin" data-macro="{{user}}">{{user}}</span>
                    <span class="ct-macro-chip ct-macro-builtin" data-macro="{{lastMessage}}">{{lastMessage}}</span>
                    <span class="ct-macro-chip ct-macro-builtin" data-macro="{{description}}">{{description}}</span>
                    <span class="ct-macro-chip ct-macro-builtin" data-macro="{{personality}}">{{personality}}</span>
                </div>
            </div>
            <div class="ct-macro-category">
                <div class="ct-macro-category-label">Cotton-Tales Assets</div>
                <div class="ct-macro-chips">
                    <span class="ct-macro-chip" data-macro="{{ct_backgrounds}}">{{ct_backgrounds}}</span>
                    <span class="ct-macro-chip" data-macro="{{ct_bg_current}}">{{ct_bg_current}}</span>
                    <span class="ct-macro-chip" data-macro="{{ct_expressions}}">{{ct_expressions}}</span>
                    <span class="ct-macro-chip" data-macro="{{ct_outfits}}">{{ct_outfits}}</span>
                </div>
            </div>
            <div class="ct-macro-category">
                <div class="ct-macro-category-label">NPCs & Scene</div>
                <div class="ct-macro-chips">
                    <span class="ct-macro-chip" data-macro="{{ct_npcs}}">{{ct_npcs}}</span>
                    <span class="ct-macro-chip" data-macro="{{ct_npc_data}}">{{ct_npc_data}}</span>
                    <span class="ct-macro-chip" data-macro="{{ct_scene_characters}}">{{ct_scene_characters}}</span>
                    <span class="ct-macro-chip" data-macro="{{ct_scene_location}}">{{ct_scene_location}}</span>
                </div>
            </div>
            <div class="ct-macro-category">
                <div class="ct-macro-category-label">Schema & Settings</div>
                <div class="ct-macro-chips">
                    <span class="ct-macro-chip" data-macro="{{ct_vn_schema}}">{{ct_vn_schema}}</span>
                    <span class="ct-macro-chip" data-macro="{{ct_choice_count}}">{{ct_choice_count}}</span>
                </div>
            </div>
        </div>

        <div class="ct-section-label" style="margin-top: 24px;">
            <i class="fa-solid fa-file-code"></i>
            Output Schema
        </div>

        <p style="font-size: 12px; color: var(--ct-text-light); margin-bottom: 12px;">
            The AI outputs this JSON structure in a <code>\`\`\`vn-scene</code> block after narrative.
        </p>

        <div class="ct-schema-preview">
            <pre id="ct_schema_preview">{
  "scene": {
    "background": "string|null",
    "music": "string|null",
    "sfx": "string|null"
  },
  "characters": [{
    "name": "string",
    "expression": "string|null",
    "outfit": "string|null",
    "position": "left|center|right",
    "action": "enters|exits|speaks|null"
  }],
  "choices": [{
    "label": "Button text",
    "prompt": "What happens if selected"
  }]
}</pre>
        </div>

        <div class="ct-section-label" style="margin-top: 24px;">
            <i class="fa-solid fa-sliders"></i>
            Director Settings
        </div>

        <!-- Enable Director Toggle -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Enable AI Director</div>
                <div class="ct-toggle-sublabel">Inject Director prompt into system message</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_director_enabled" ${settings.directorEnabled ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Parse Responses Toggle -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Auto-Parse Responses</div>
                <div class="ct-toggle-sublabel">Automatically apply scene changes from AI output</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_auto_parse" ${settings.autoParseResponses !== false ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Strip Scene JSON Toggle -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Hide Scene JSON in Chat</div>
                <div class="ct-toggle-sublabel">Remove vn-scene blocks from displayed messages</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_strip_json" ${settings.stripSceneJson !== false ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>
    `;
}

/**
 * Bind event handlers for Director tab
 */
export function bindDirectorTabEvents() {
    // Preset selector
    const presetSelect = document.getElementById('ct_director_preset');
    const customSection = document.getElementById('ct_custom_prompt_section');

    presetSelect?.addEventListener('change', async (e) => {
        const value = e.target.value;
        await updateSetting('directorPromptStyle', value);

        if (customSection) {
            customSection.style.display = value === 'custom' ? 'block' : 'none';
        }
    });

    // Custom prompt textarea
    const customPrompt = document.getElementById('ct_custom_director_prompt');
    let saveTimeout = null;

    customPrompt?.addEventListener('input', (e) => {
        // Debounce saves
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            await updateSetting('customDirectorPrompt', e.target.value);
        }, 500);
    });

    // Load default button
    document.getElementById('ct_load_default_prompt')?.addEventListener('click', () => {
        if (customPrompt) {
            customPrompt.value = DEFAULT_DIRECTOR_PROMPT;
            updateSetting('customDirectorPrompt', DEFAULT_DIRECTOR_PROMPT);
        }
    });

    // Preview button
    document.getElementById('ct_preview_prompt')?.addEventListener('click', async () => {
        try {
            const resolved = await getResolvedDirectorPrompt();

            // Show in a popup/modal
            const popup = document.createElement('div');
            popup.className = 'ct-preview-popup';
            popup.innerHTML = `
                <div class="ct-preview-popup-content">
                    <div class="ct-preview-popup-header">
                        <span>Resolved Director Prompt</span>
                        <button class="ct-preview-popup-close">&times;</button>
                    </div>
                    <pre class="ct-preview-popup-body">${escapeHtml(resolved)}</pre>
                </div>
            `;
            document.body.appendChild(popup);

            popup.querySelector('.ct-preview-popup-close')?.addEventListener('click', () => {
                popup.remove();
            });
            popup.addEventListener('click', (e) => {
                if (e.target === popup) popup.remove();
            });
        } catch (error) {
            console.error('Failed to preview prompt:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Failed to resolve macros');
            }
        }
    });

    // Injection position
    document.getElementById('ct_director_position')?.addEventListener('change', async (e) => {
        await updateSetting('directorPromptPosition', e.target.value);
    });

    // Toggles
    document.getElementById('ct_director_enabled')?.addEventListener('change', async (e) => {
        await updateSetting('directorEnabled', e.target.checked);
    });

    document.getElementById('ct_auto_parse')?.addEventListener('change', async (e) => {
        await updateSetting('autoParseResponses', e.target.checked);
    });

    document.getElementById('ct_strip_json')?.addEventListener('change', async (e) => {
        await updateSetting('stripSceneJson', e.target.checked);
    });

    // Macro chips - click to copy
    document.querySelectorAll('.ct-macro-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const macro = chip.dataset.macro;
            navigator.clipboard.writeText(macro).then(() => {
                if (typeof toastr !== 'undefined') {
                    toastr.success(`Copied ${macro}`);
                }
                chip.classList.add('ct-macro-copied');
                setTimeout(() => chip.classList.remove('ct-macro-copied'), 300);
            });
        });
    });
}
