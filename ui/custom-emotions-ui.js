/**
 * ============================================================================
 * COTTON-TALES CUSTOM EMOTIONS UI
 * ============================================================================
 * UI components for managing custom emotion definitions with keyword boosts
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import { getSettings, updateSetting } from '../core/settings-manager.js';
import { DEFAULT_EXPRESSIONS } from '../core/constants.js';

/**
 * Safe toastr wrapper
 */
const notify = {
    info: (msg) => typeof toastr !== 'undefined' ? toastr.info(msg) : console.info(`[Cotton-Tales] ${msg}`),
    success: (msg) => typeof toastr !== 'undefined' ? toastr.success(msg) : console.log(`[Cotton-Tales] ✓ ${msg}`),
    warning: (msg) => typeof toastr !== 'undefined' ? toastr.warning(msg) : console.warn(`[Cotton-Tales] ${msg}`),
    error: (msg) => typeof toastr !== 'undefined' ? toastr.error(msg) : console.error(`[Cotton-Tales] ${msg}`),
};

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
 * Get custom emotions tab HTML
 */
export function getCustomEmotionsTabHTML() {
    const settings = getSettings();
    const customEmotions = settings.customEmotions || {};

    return `
        <div class="ct-section-label">
            <i class="fa-solid fa-sparkles"></i>
            Custom Emotion Definitions
        </div>

        <p style="font-size: 12px; color: var(--ct-text-light); margin-bottom: 16px;">
            Create custom emotions with semantic descriptions and keyword triggers.
            These work with VectHare semantic classification to match nuanced emotions.
        </p>

        <!-- Info Box -->
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <i class="fa-solid fa-lightbulb" style="color: #a78bfa;"></i>
                <span style="font-weight: 600; color: #a78bfa; font-size: 12px;">How Custom Emotions Work</span>
            </div>
            <ul style="font-size: 11px; color: var(--ct-text-light); margin: 0; padding-left: 20px;">
                <li>Define emotions not in the standard set (e.g., "smug", "flustered", "tsundere")</li>
                <li>Map them to base emotions that have sprites</li>
                <li>Add keyword triggers with boost scores to improve accuracy</li>
                <li>Use semantic descriptions for context-aware matching</li>
            </ul>
        </div>

        <!-- Custom Emotions List -->
        <div id="ct_custom_emotions_list" class="ct-custom-emotions-list">
            ${Object.entries(customEmotions).length === 0 ? `
                <div class="ct-empty-state" style="padding: 40px; background: rgba(0,0,0,0.1); border-radius: 8px;">
                    <i class="fa-solid fa-face-meh" style="font-size: 48px; opacity: 0.3;"></i>
                    <div class="ct-empty-state-text">No custom emotions defined</div>
                    <p style="font-size: 11px; color: var(--ct-text-light); margin-top: 8px;">
                        Click "Add Custom Emotion" below to create your first one
                    </p>
                </div>
            ` : Object.entries(customEmotions).map(([name, def]) =>
                generateCustomEmotionCard(name, def, false)
            ).join('')}
        </div>

        <button class="ct-btn" id="ct_add_custom_emotion" style="margin-top: 16px;">
            <i class="fa-solid fa-plus"></i>
            Add Custom Emotion
        </button>

        <!-- Character-Specific Section -->
        <div class="ct-section-label" style="margin-top: 32px;">
            <i class="fa-solid fa-user-gear"></i>
            Character-Specific Emotions
        </div>

        <p style="font-size: 11px; color: var(--ct-text-light); margin-bottom: 12px;">
            Override custom emotions for specific characters. Character-specific emotions take priority over global ones.
        </p>

        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Select Character</span>
            </div>
            <select class="ct-select" id="ct_char_emotion_select">
                <option value="">-- Select Character --</option>
            </select>
        </div>

        <div id="ct_char_emotions_container" style="display: none; margin-top: 16px;">
            <div id="ct_char_emotions_list"></div>
            <button class="ct-btn secondary" id="ct_add_char_emotion" style="margin-top: 12px;">
                <i class="fa-solid fa-plus"></i>
                Add Character Emotion
            </button>
        </div>
    `;
}

/**
 * Generate custom emotion card
 */
function generateCustomEmotionCard(name, def, isCharSpecific) {
    const keywordList = Object.entries(def.keywords || {})
        .map(([kw, score]) => `${kw}(${score}x)`)
        .join(', ');

    const safeName = escapeHtml(name);
    const safeDesc = escapeHtml(def.description || '');
    const safeBase = def.baseEmotions?.map(e => escapeHtml(e)).join(', ') || '';

    return `
        <div class="ct-custom-emotion-card" data-emotion="${safeName}">
            <div class="ct-emotion-card-header">
                <div class="ct-emotion-card-name">
                    <span class="ct-emotion-name">${safeName}</span>
                    ${isCharSpecific ?
                        '<span class="ct-emotion-badge char" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">Character</span>' :
                        '<span class="ct-emotion-badge global" style="background: linear-gradient(135deg, #10b981, #14b8a6); color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">Global</span>'
                    }
                    ${def.enabled !== false ?
                        '<span class="ct-emotion-badge enabled" style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid #22c55e;">Enabled</span>' :
                        '<span class="ct-emotion-badge disabled" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid #ef4444;">Disabled</span>'
                    }
                </div>
                <div class="ct-emotion-card-actions">
                    <button class="ct-btn-icon ct-edit-emotion" title="Edit" style="padding: 6px 10px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; color: #60a5fa; cursor: pointer;">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="ct-btn-icon danger ct-delete-emotion" title="Delete" style="padding: 6px 10px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; color: #f87171; cursor: pointer;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            <div class="ct-emotion-card-body" style="margin-top: 12px;">
                <div class="ct-emotion-field" style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: var(--ct-text-light); font-weight: 600;">Maps to:</label>
                    <span style="font-size: 12px; margin-left: 8px;">${safeBase}</span>
                </div>
                <div class="ct-emotion-field" style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: var(--ct-text-light); font-weight: 600;">Description:</label>
                    <span class="ct-emotion-description" style="font-size: 11px; display: block; margin-top: 4px; font-style: italic; opacity: 0.8;">${safeDesc}</span>
                </div>
                ${keywordList ? `
                    <div class="ct-emotion-field">
                        <label style="font-size: 11px; color: var(--ct-text-light); font-weight: 600;">Keywords:</label>
                        <span class="ct-emotion-keywords" style="font-size: 11px; margin-left: 8px; color: #a78bfa;">${keywordList}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Get emotion editor modal HTML
 */
export function getEmotionEditorModalHTML() {
    return `
        <div id="ct-emotion-editor-modal" class="ct-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10100; align-items: center; justify-content: center;">
            <div class="ct-modal" style="max-width: 600px; max-height: 90vh; overflow-y: auto; background: var(--SmartThemeBlurTintColor); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div class="ct-modal-header" style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
                    <div class="ct-modal-header-left" style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-sparkles" style="color: #a78bfa;"></i>
                        <span class="ct-modal-title" id="ct_emotion_editor_title" style="font-size: 16px; font-weight: 600;">Add Custom Emotion</span>
                    </div>
                    <button class="ct-modal-close" id="ct_emotion_editor_close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--SmartThemeBodyColor); opacity: 0.7;">&times;</button>
                </div>

                <div class="ct-modal-body" style="padding: 20px;">
                    <!-- Emotion Name -->
                    <div class="ct-form-group" style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Emotion Name <span class="required" style="color: #ef4444;">*</span></label>
                        <input type="text" id="ct_emotion_name" class="ct-input" placeholder="e.g., smug, flustered, tsundere" style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px;" />
                        <small style="display: block; margin-top: 4px; font-size: 10px; color: var(--ct-text-light);">Unique identifier (lowercase, underscores allowed)</small>
                    </div>

                    <!-- Base Emotions -->
                    <div class="ct-form-group" style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Maps To (Base Emotions) <span class="required" style="color: #ef4444;">*</span></label>
                        <div class="ct-checkbox-grid" id="ct_base_emotions" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; max-height: 200px; overflow-y: auto; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                            ${DEFAULT_EXPRESSIONS.map(expr => `
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px;">
                                    <input type="checkbox" value="${expr}" style="cursor: pointer;" />
                                    <span>${expr}</span>
                                </label>
                            `).join('')}
                        </div>
                        <small style="display: block; margin-top: 4px; font-size: 10px; color: var(--ct-text-light);">Select 1-3 emotions this maps to (first one is primary)</small>
                    </div>

                    <!-- Semantic Description -->
                    <div class="ct-form-group" style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Semantic Description <span class="required" style="color: #ef4444;">*</span></label>
                        <textarea id="ct_emotion_description" class="ct-textarea" rows="3" placeholder="Describe the emotion for semantic matching..." style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px; resize: vertical;"></textarea>
                        <small style="display: block; margin-top: 4px; font-size: 10px; color: var(--ct-text-light);">Used for embedding similarity. Include synonyms and contextual phrases.</small>
                    </div>

                    <!-- Keywords & Boosts -->
                    <div class="ct-form-group" style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Trigger Keywords & Boost Scores</label>

                        <div id="ct_keywords_list" class="ct-keywords-list" style="margin-bottom: 8px;">
                            <!-- Keyword rows added here -->
                        </div>

                        <button class="ct-btn secondary" id="ct_add_keyword" style="font-size: 11px; padding: 6px 12px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; color: #60a5fa; cursor: pointer;">
                            <i class="fa-solid fa-plus"></i>
                            Add Keyword
                        </button>

                        <small style="display: block; margin-top: 8px; font-size: 10px; color: var(--ct-text-light);">
                            Boost scores: &gt;1.0 increases match likelihood, &lt;1.0 decreases.
                            Example: "smirk" with 1.5x boost makes "smug" 50% more likely when "smirk" appears.
                        </small>
                    </div>

                    <!-- Scope -->
                    <div class="ct-form-group" style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Scope</label>
                        <select id="ct_emotion_scope" class="ct-select" style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px; cursor: pointer;">
                            <option value="global">Global (All Characters)</option>
                            <option value="character">Character-Specific</option>
                        </select>

                        <div id="ct_emotion_char_select" style="display: none; margin-top: 8px;">
                            <select id="ct_emotion_character" class="ct-select" style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px;">
                                <!-- Populated with characters -->
                            </select>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="ct-form-actions" style="margin-top: 24px; display: flex; gap: 8px;">
                        <button class="ct-btn" id="ct_save_emotion" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #10b981, #14b8a6); border: none; border-radius: 6px; color: white; font-weight: 600; cursor: pointer;">
                            <i class="fa-solid fa-check"></i>
                            Save
                        </button>
                        <button class="ct-btn secondary" id="ct_cancel_emotion" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--SmartThemeBodyColor); font-weight: 600; cursor: pointer;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Bind custom emotion event handlers
 */
export function bindCustomEmotionEvents() {
    // Add custom emotion button
    document.getElementById('ct_add_custom_emotion')?.addEventListener('click', () => {
        openEmotionEditor();
    });

    // Edit/Delete emotion buttons (event delegation)
    document.getElementById('ct_custom_emotions_list')?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.ct-edit-emotion');
        const deleteBtn = e.target.closest('.ct-delete-emotion');

        if (editBtn) {
            const card = editBtn.closest('.ct-custom-emotion-card');
            const emotionName = card?.dataset.emotion;
            if (emotionName) {
                openEmotionEditor(emotionName);
            }
        } else if (deleteBtn) {
            const card = deleteBtn.closest('.ct-custom-emotion-card');
            const emotionName = card?.dataset.emotion;
            if (emotionName && confirm(`Delete custom emotion "${emotionName}"?`)) {
                deleteCustomEmotion(emotionName);
            }
        }
    });
}

/**
 * Open emotion editor modal
 */
function openEmotionEditor(emotionName = null) {
    // Check if modal exists, if not create it
    let modal = document.getElementById('ct-emotion-editor-modal');
    if (!modal) {
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = getEmotionEditorModalHTML();
        document.body.appendChild(modalWrapper.firstElementChild);
        modal = document.getElementById('ct-emotion-editor-modal');
    }

    // Reset/populate form
    const settings = getSettings();
    const editing = emotionName && settings.customEmotions?.[emotionName];

    document.getElementById('ct_emotion_editor_title').textContent = editing ? 'Edit Custom Emotion' : 'Add Custom Emotion';
    document.getElementById('ct_emotion_name').value = editing ? emotionName : '';
    document.getElementById('ct_emotion_name').disabled = !!editing;
    document.getElementById('ct_emotion_description').value = editing ? editing.description || '' : '';

    // Clear base emotions
    document.querySelectorAll('#ct_base_emotions input[type="checkbox"]').forEach(cb => cb.checked = false);
    if (editing?.baseEmotions) {
        editing.baseEmotions.forEach(em => {
            const checkbox = document.querySelector(`#ct_base_emotions input[value="${em}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // Clear keywords
    document.getElementById('ct_keywords_list').innerHTML = '';
    if (editing?.keywords) {
        Object.entries(editing.keywords).forEach(([kw, score]) => {
            addKeywordRow(kw, score);
        });
    }

    // Show modal
    modal.style.display = 'flex';

    // Bind modal events (once)
    bindEmotionEditorEvents();
}

/**
 * Add keyword row to the keywords list
 */
function addKeywordRow(keyword = '', score = 1.5) {
    const container = document.getElementById('ct_keywords_list');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'ct-keyword-row';
    row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px; align-items: center;';
    row.innerHTML = `
        <input type="text" class="ct-keyword-text" placeholder="keyword" value="${escapeHtml(keyword)}" style="flex: 1; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 11px;" />
        <input type="number" class="ct-keyword-score" placeholder="1.5" min="0.1" max="5" step="0.1" value="${score}" style="width: 80px; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 11px;" />
        <button class="ct-btn-icon danger ct-remove-keyword" style="padding: 6px 10px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; color: #f87171; cursor: pointer;">
            <i class="fa-solid fa-times"></i>
        </button>
    `;

    container.appendChild(row);

    // Bind remove button
    row.querySelector('.ct-remove-keyword')?.addEventListener('click', () => row.remove());
}

/**
 * Bind emotion editor modal events
 */
let editorEventsBound = false;
function bindEmotionEditorEvents() {
    if (editorEventsBound) return;
    editorEventsBound = true;

    // Close button
    document.getElementById('ct_emotion_editor_close')?.addEventListener('click', closeEmotionEditor);
    document.getElementById('ct_cancel_emotion')?.addEventListener('click', closeEmotionEditor);

    // Add keyword button
    document.getElementById('ct_add_keyword')?.addEventListener('click', () => addKeywordRow());

    // Save button
    document.getElementById('ct_save_emotion')?.addEventListener('click', saveCustomEmotion);

    // Scope selector
    document.getElementById('ct_emotion_scope')?.addEventListener('change', (e) => {
        const charSelectDiv = document.getElementById('ct_emotion_char_select');
        if (charSelectDiv) {
            charSelectDiv.style.display = e.target.value === 'character' ? 'block' : 'none';
        }
    });
}

/**
 * Close emotion editor
 */
function closeEmotionEditor() {
    const modal = document.getElementById('ct-emotion-editor-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Save custom emotion
 */
async function saveCustomEmotion() {
    const name = document.getElementById('ct_emotion_name')?.value?.toLowerCase().trim();
    const description = document.getElementById('ct_emotion_description')?.value?.trim();
    const scope = document.getElementById('ct_emotion_scope')?.value;

    // Validation
    if (!name || !description) {
        notify.warning('Name and description are required');
        return;
    }

    if (!/^[a-z_]+$/.test(name)) {
        notify.warning('Name must be lowercase letters and underscores only');
        return;
    }

    // Get base emotions
    const baseEmotions = Array.from(
        document.querySelectorAll('#ct_base_emotions input:checked')
    ).map(cb => cb.value);

    if (baseEmotions.length === 0) {
        notify.warning('Select at least one base emotion');
        return;
    }

    // Get keywords
    const keywords = {};
    document.querySelectorAll('.ct-keyword-row').forEach(row => {
        const kw = row.querySelector('.ct-keyword-text')?.value?.trim();
        const score = parseFloat(row.querySelector('.ct-keyword-score')?.value) || 1.0;
        if (kw) keywords[kw] = score;
    });

    // Build definition
    const definition = {
        baseEmotions,
        description,
        keywords,
        enabled: true,
        createdAt: Date.now()
    };

    // Save
    const settings = getSettings();

    if (scope === 'global') {
        if (!settings.customEmotions) settings.customEmotions = {};
        settings.customEmotions[name] = definition;
        updateSetting('customEmotions', settings.customEmotions);
    } else {
        const charFolder = document.getElementById('ct_emotion_character')?.value;
        if (!charFolder) {
            notify.warning('Select a character');
            return;
        }

        if (!settings.characterEmotions) settings.characterEmotions = {};
        if (!settings.characterEmotions[charFolder]) {
            settings.characterEmotions[charFolder] = { customEmotions: {} };
        }
        settings.characterEmotions[charFolder].customEmotions = settings.characterEmotions[charFolder].customEmotions || {};
        settings.characterEmotions[charFolder].customEmotions[name] = definition;

        updateSetting('characterEmotions', settings.characterEmotions);
    }

    // Close modal and refresh
    closeEmotionEditor();
    refreshCustomEmotionsList();
    notify.success(`Custom emotion "${name}" saved`);
}

/**
 * Delete custom emotion
 */
function deleteCustomEmotion(name) {
    const settings = getSettings();

    if (settings.customEmotions?.[name]) {
        delete settings.customEmotions[name];
        updateSetting('customEmotions', settings.customEmotions);
        refreshCustomEmotionsList();
        notify.success(`Custom emotion "${name}" deleted`);
    }
}

/**
 * Refresh custom emotions list
 */
function refreshCustomEmotionsList() {
    const container = document.getElementById('ct_custom_emotions_list');
    if (!container) return;

    const settings = getSettings();
    const customEmotions = settings.customEmotions || {};

    if (Object.keys(customEmotions).length === 0) {
        container.innerHTML = `
            <div class="ct-empty-state" style="padding: 40px; background: rgba(0,0,0,0.1); border-radius: 8px;">
                <i class="fa-solid fa-face-meh" style="font-size: 48px; opacity: 0.3;"></i>
                <div class="ct-empty-state-text">No custom emotions defined</div>
                <p style="font-size: 11px; color: var(--ct-text-light); margin-top: 8px;">
                    Click "Add Custom Emotion" below to create your first one
                </p>
            </div>
        `;
    } else {
        container.innerHTML = Object.entries(customEmotions).map(([name, def]) =>
            generateCustomEmotionCard(name, def, false)
        ).join('');
    }
}
