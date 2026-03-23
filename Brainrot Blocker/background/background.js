// ===== Background Service Worker =====

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse, alarm) => {
    if (message.type === 'FOCUS_MODE_CHANGED') {
        console.log('Focus mode:', message.enabled ? 'ON' : 'OFF');
        // Future: handle site blocking, timer logic, etc.
    }
    if (alarm.name !== 'timerDone') return;

     // Send notification
    chrome.notifications.create('timerNotification', {
        type:     'basic',
        iconUrl:  'icon.png',
        title:    '⏰ Ajastin – Aika loppui!',
        message:  'Asettamasi aika on kulunut loppuun.',
        priority: 2
    });
    
    // Clean up storage
    chrome.storage.local.remove(['endTime', 'totalSeconds']);
    
    // Notify popup if it's open
    chrome.runtime.sendMessage({ type: 'TIMER_DONE' }).catch(() => {
        // Popup might be closed – that's fine
    });
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