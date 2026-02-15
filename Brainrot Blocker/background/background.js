// ===== Background Service Worker =====

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FOCUS_MODE_CHANGED') {
        console.log('Focus mode:', message.enabled ? 'ON' : 'OFF');
        // Future: handle site blocking, timer logic, etc.
    }
});

// Listen for extension install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Brainrot Blocker installed!');

    // Set default state
    chrome.storage.local.set({
        focusMode: false,
        blockedSites: [],
        settings: {}
    });
});