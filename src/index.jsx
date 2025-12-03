/**
 * Cotton-Tales React Entry Point
 *
 * This module provides React components that can be mounted into the DOM
 * by our vanilla JS code. We export mount functions rather than auto-mounting.
 */

import { createRoot } from 'react-dom/client';
import { ChoicePanel } from './components/ChoicePanel';

// Store active roots for cleanup
const activeRoots = new Map();

/**
 * Mount the choice panel into a container
 * @param {string} containerId - ID of the container element
 * @param {Object} props - Props to pass to ChoicePanel
 * @returns {Function} Cleanup function to unmount
 */
export function mountChoicePanel(containerId, props = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[Cotton-Tales React] Container #${containerId} not found`);
        return () => {};
    }

    // Unmount existing root if any
    if (activeRoots.has(containerId)) {
        activeRoots.get(containerId).unmount();
    }

    const root = createRoot(container);
    activeRoots.set(containerId, root);

    root.render(<ChoicePanel {...props} />);

    // Return cleanup function
    return () => {
        root.unmount();
        activeRoots.delete(containerId);
    };
}

/**
 * Update props on an existing mounted component
 * @param {string} containerId - ID of the container element
 * @param {Object} props - New props to pass
 */
export function updateChoicePanel(containerId, props = {}) {
    const container = document.getElementById(containerId);
    const root = activeRoots.get(containerId);

    if (!container || !root) {
        console.warn(`[Cotton-Tales React] No mounted panel at #${containerId}`);
        return;
    }

    root.render(<ChoicePanel {...props} />);
}

/**
 * Unmount a choice panel
 * @param {string} containerId - ID of the container element
 */
export function unmountChoicePanel(containerId) {
    const root = activeRoots.get(containerId);
    if (root) {
        root.unmount();
        activeRoots.delete(containerId);
    }
}

// Expose to window for vanilla JS access
window.CottonTalesReact = {
    mountChoicePanel,
    updateChoicePanel,
    unmountChoicePanel,
};
