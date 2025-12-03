/**
 * VN-Style Choice Panel Component
 *
 * Displays AI-suggested choices + custom input option
 */

import { useState, useRef, useEffect } from 'react';
import './ChoicePanel.css';

export function ChoicePanel({
    choices = [],           // Array of { text: string, id?: string }
    onChoiceSelect,         // (choice: { text, isCustom }) => void
    visible = false,
    position = 'bottom',    // 'top' | 'center' | 'bottom'
    maxChoices = 4,         // Maximum AI choices to show
    showCustomInput = true, // Whether to show the custom input option
    disabled = false,
}) {
    const [customText, setCustomText] = useState('');
    const [isCustomExpanded, setIsCustomExpanded] = useState(false);
    const inputRef = useRef(null);

    // Focus input when custom is expanded
    useEffect(() => {
        if (isCustomExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCustomExpanded]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!visible || disabled) return;

        const handleKeyDown = (e) => {
            // Number keys 1-9 for choices
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (index < choices.length && !isCustomExpanded) {
                    e.preventDefault();
                    handleChoiceClick(choices[index]);
                }
            }
            // Enter to submit custom input
            if (e.key === 'Enter' && isCustomExpanded && customText.trim()) {
                e.preventDefault();
                handleCustomSubmit();
            }
            // Escape to collapse custom input
            if (e.key === 'Escape' && isCustomExpanded) {
                e.preventDefault();
                setIsCustomExpanded(false);
                setCustomText('');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [visible, disabled, choices, isCustomExpanded, customText]);

    const handleChoiceClick = (choice) => {
        if (disabled) return;
        onChoiceSelect?.({ text: choice.text, isCustom: false, id: choice.id });
    };

    const handleCustomSubmit = () => {
        if (disabled || !customText.trim()) return;
        onChoiceSelect?.({ text: customText.trim(), isCustom: true });
        setCustomText('');
        setIsCustomExpanded(false);
    };

    const handleCustomClick = () => {
        if (disabled) return;
        setIsCustomExpanded(true);
    };

    if (!visible) return null;

    const displayChoices = choices.slice(0, maxChoices);

    return (
        <div className={`ct-choice-panel ct-position-${position} ${visible ? 'ct-visible' : ''}`}>
            <div className="ct-choice-list">
                {/* AI Choices */}
                {displayChoices.map((choice, index) => (
                    <button
                        key={choice.id || index}
                        className="ct-choice-btn ct-choice-prefilled"
                        onClick={() => handleChoiceClick(choice)}
                        disabled={disabled}
                        style={{ animationDelay: `${index * 0.08}s` }}
                    >
                        <span className="ct-choice-number">{index + 1}</span>
                        <span className="ct-choice-text">{choice.text}</span>
                    </button>
                ))}

                {/* Custom Input Option */}
                {showCustomInput && (
                    <div className={`ct-choice-custom ${isCustomExpanded ? 'ct-expanded' : ''}`}>
                        {!isCustomExpanded ? (
                            <button
                                className="ct-choice-btn ct-choice-custom-trigger"
                                onClick={handleCustomClick}
                                disabled={disabled}
                                style={{ animationDelay: `${displayChoices.length * 0.08}s` }}
                            >
                                <span className="ct-choice-icon">
                                    <i className="fa-solid fa-pen"></i>
                                </span>
                                <span className="ct-choice-text">Write your own response...</span>
                            </button>
                        ) : (
                            <div className="ct-choice-input-wrapper">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="ct-choice-input"
                                    placeholder="Type your response..."
                                    value={customText}
                                    onChange={(e) => setCustomText(e.target.value)}
                                    disabled={disabled}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && customText.trim()) {
                                            e.preventDefault();
                                            handleCustomSubmit();
                                        }
                                    }}
                                />
                                <button
                                    className="ct-choice-send"
                                    onClick={handleCustomSubmit}
                                    disabled={disabled || !customText.trim()}
                                >
                                    <i className="fa-solid fa-paper-plane"></i>
                                </button>
                                <button
                                    className="ct-choice-cancel"
                                    onClick={() => {
                                        setIsCustomExpanded(false);
                                        setCustomText('');
                                    }}
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Keyboard hint */}
            {!isCustomExpanded && displayChoices.length > 0 && (
                <div className="ct-choice-hint">
                    Press <kbd>1</kbd>-<kbd>{Math.min(displayChoices.length, 9)}</kbd> to select
                </div>
            )}
        </div>
    );
}

export default ChoicePanel;
