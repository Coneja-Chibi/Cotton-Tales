/**
 * VectHare Summary Vectors & Keyword Boost Editors
 * Separated module to avoid file editing issues
 */

import { getSettings, updateSetting } from '../core/settings-manager.js';
import { generateSummaryVectorsList, generateKeywordBoostsList } from './settings-panel.js';

const notify = {
    success: (msg) => typeof toastr !== 'undefined' ? toastr.success(msg) : console.log(`[Cotton-Tales] ✓ ${msg}`),
    warning: (msg) => typeof toastr !== 'undefined' ? toastr.warning(msg) : console.warn(`[Cotton-Tales] ${msg}`),
};

/**
 * Open summary vector editor modal
 */
export function openSummaryVectorEditor(emotionName = null) {
    const settings = getSettings();
    const existing = emotionName ? settings.summaryVectors?.[emotionName] : null;
    const phrases = existing || [];

    const modalHtml = `
        <div id="ct-summary-vector-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="max-width: 500px; width: 90%; background: var(--SmartThemeBlurTintColor); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-diagram-project" style="color: #60a5fa;"></i>
                        <span style="font-size: 16px; font-weight: 600;">${emotionName ? 'Edit' : 'Add'} Summary Vector</span>
                    </div>
                    <button class="ct-close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--SmartThemeBodyColor); opacity: 0.7;">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Target Emotion</label>
                        <input type="text" id="ct_sv_emotion" value="${emotionName || ''}" placeholder="e.g., joy, sadness, embarrassment" ${emotionName ? 'disabled' : ''}
                            style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px;" />
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Semantic Phrases</label>
                        <textarea id="ct_sv_phrases" rows="5" placeholder="Enter phrases, one per line:&#10;I'm so happy!&#10;This is wonderful!&#10;What a great day!"
                            style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px; resize: vertical;">${phrases.join('\n')}</textarea>
                        <small style="display: block; margin-top: 4px; font-size: 10px; color: var(--ct-text-light);">Each phrase will be vectorized and matched semantically to text.</small>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button id="ct_sv_save" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #3b82f6, #2563eb); border: none; border-radius: 6px; color: white; font-weight: 600; cursor: pointer;">
                            <i class="fa-solid fa-check"></i> Save
                        </button>
                        <button class="ct-close-modal" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--SmartThemeBodyColor); font-weight: 600; cursor: pointer;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('ct-summary-vector-modal');

    // Close handlers
    modal.querySelectorAll('.ct-close-modal').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Save handler
    document.getElementById('ct_sv_save')?.addEventListener('click', () => {
        const emotion = document.getElementById('ct_sv_emotion')?.value?.toLowerCase().trim();
        const phrasesText = document.getElementById('ct_sv_phrases')?.value || '';
        const newPhrases = phrasesText.split('\n').map(p => p.trim()).filter(p => p);

        if (!emotion) { notify.warning('Please enter a target emotion'); return; }
        if (newPhrases.length === 0) { notify.warning('Please enter at least one phrase'); return; }

        const summaryVectors = { ...settings.summaryVectors };
        summaryVectors[emotion] = newPhrases;
        updateSetting('summaryVectors', summaryVectors);

        refreshSummaryVectorsList();
        modal.remove();
        notify.success(`Summary vector for "${emotion}" saved`);
    });
}

/**
 * Delete a summary vector
 */
export function deleteSummaryVector(emotionName) {
    if (!confirm(`Delete summary vector for "${emotionName}"?`)) return;

    const settings = getSettings();
    const summaryVectors = { ...settings.summaryVectors };
    delete summaryVectors[emotionName];
    updateSetting('summaryVectors', summaryVectors);

    refreshSummaryVectorsList();
    notify.success(`Summary vector for "${emotionName}" deleted`);
}

/**
 * Refresh the summary vectors list UI
 */
export function refreshSummaryVectorsList() {
    const container = document.getElementById('ct_summary_vectors_list');
    const emptyHint = document.getElementById('ct_summary_empty');
    if (!container) return;

    const settings = getSettings();
    const html = generateSummaryVectorsList(settings.summaryVectors || {});
    container.innerHTML = html;

    if (emptyHint) {
        emptyHint.style.display = Object.keys(settings.summaryVectors || {}).length === 0 ? 'block' : 'none';
    }
}

/**
 * Open keyword boost editor modal
 */
export function openKeywordBoostEditor(keyword = null) {
    const settings = getSettings();
    const existing = keyword ? settings.keywordBoosts?.[keyword] : null;

    const modalHtml = `
        <div id="ct-keyword-boost-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="max-width: 450px; width: 90%; background: var(--SmartThemeBlurTintColor); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-arrow-up-right-dots" style="color: #fbbf24;"></i>
                        <span style="font-size: 16px; font-weight: 600;">${keyword ? 'Edit' : 'Add'} Keyword Boost</span>
                    </div>
                    <button class="ct-close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--SmartThemeBodyColor); opacity: 0.7;">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Trigger Keyword</label>
                        <input type="text" id="ct_kb_keyword" value="${keyword || ''}" placeholder="e.g., blush, smirk, cry" ${keyword ? 'disabled' : ''}
                            style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px;" />
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Target Emotion</label>
                        <input type="text" id="ct_kb_emotion" value="${existing?.emotion || ''}" placeholder="e.g., embarrassment"
                            style="width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--SmartThemeBodyColor); font-size: 12px;" />
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Boost Multiplier: <span id="ct_kb_boost_val">${existing?.boost || 1.5}x</span></label>
                        <input type="range" id="ct_kb_boost" min="0.5" max="3" step="0.1" value="${existing?.boost || 1.5}" style="width: 100%;" />
                        <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--ct-text-light);">
                            <span>0.5x (reduce)</span>
                            <span>1.0x (neutral)</span>
                            <span>3.0x (strong)</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button id="ct_kb_save" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border: none; border-radius: 6px; color: black; font-weight: 600; cursor: pointer;">
                            <i class="fa-solid fa-check"></i> Save
                        </button>
                        <button class="ct-close-modal" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--SmartThemeBodyColor); font-weight: 600; cursor: pointer;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('ct-keyword-boost-modal');

    // Boost slider value display
    document.getElementById('ct_kb_boost')?.addEventListener('input', (e) => {
        document.getElementById('ct_kb_boost_val').textContent = e.target.value + 'x';
    });

    // Close handlers
    modal.querySelectorAll('.ct-close-modal').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Save handler
    document.getElementById('ct_kb_save')?.addEventListener('click', () => {
        const newKeyword = document.getElementById('ct_kb_keyword')?.value?.toLowerCase().trim();
        const emotion = document.getElementById('ct_kb_emotion')?.value?.toLowerCase().trim();
        const boost = parseFloat(document.getElementById('ct_kb_boost')?.value) || 1.0;

        if (!newKeyword) { notify.warning('Please enter a trigger keyword'); return; }
        if (!emotion) { notify.warning('Please enter a target emotion'); return; }

        const keywordBoosts = { ...settings.keywordBoosts };
        if (keyword && keyword !== newKeyword) delete keywordBoosts[keyword];
        keywordBoosts[newKeyword] = { emotion, boost };
        updateSetting('keywordBoosts', keywordBoosts);

        refreshKeywordBoostsList();
        modal.remove();
        notify.success(`Keyword boost for "${newKeyword}" saved`);
    });
}

/**
 * Delete a keyword boost
 */
export function deleteKeywordBoost(keyword) {
    if (!confirm(`Delete keyword boost for "${keyword}"?`)) return;

    const settings = getSettings();
    const keywordBoosts = { ...settings.keywordBoosts };
    delete keywordBoosts[keyword];
    updateSetting('keywordBoosts', keywordBoosts);

    refreshKeywordBoostsList();
    notify.success(`Keyword boost for "${keyword}" deleted`);
}

/**
 * Refresh the keyword boosts list UI
 */
export function refreshKeywordBoostsList() {
    const container = document.getElementById('ct_keyword_boosts_list');
    const emptyHint = document.getElementById('ct_keywords_empty');
    if (!container) return;

    const settings = getSettings();
    const html = generateKeywordBoostsList(settings.keywordBoosts || {});
    container.innerHTML = html;

    if (emptyHint) {
        emptyHint.style.display = Object.keys(settings.keywordBoosts || {}).length === 0 ? 'block' : 'none';
    }
}
