// ===== Background Service Worker =====

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse, alarm) => {
    if (message.type === 'FOCUS_MODE_CHANGED') {
        console.log('Focus mode:', message.enabled ? 'ON' : 'OFF');
        // Future: handle site blocking, timer logic, etc.
    }
});

// Kun alarm laukeaa: lähetä notifikaatio
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'timerDone') return;

    chrome.notifications.create('timerNotification', {
        type:    'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'), // ← absoluuttinen polku
        title:   '⏰ Study Timer – Aika loppui!',
        message: 'Asettamasi aika on kulunut loppuun. Klikkaa avataksesi.',
        priority: 2
    });

    chrome.storage.local.remove(['endTime', 'totalSeconds']);

    // Ilmoita popupille jos se on auki
    chrome.runtime.sendMessage({ type: 'TIMER_DONE' }).catch(() => {});
}); // ← suljetaan onAlarm tässä

// Kun käyttäjä klikkaa notifikaatiota
chrome.notifications.onClicked.addListener((notifId) => {
    if (notifId !== 'timerNotification') return;

    chrome.notifications.clear(notifId);
    chrome.storage.local.set({ pendingPage: 'timer' });

    chrome.action.openPopup().catch(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
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

