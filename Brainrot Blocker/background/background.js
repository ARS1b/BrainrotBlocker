// ===== Background Service Worker =====

const FOCUS_STATS_KEY = 'focusStats';
const FOCUS_SESSION_KEY = 'focusSessionStats';
const FOCUS_SESSION_STARTED_AT_KEY = 'focusSessionStartedAt';
const FALLBACK_HOST = 'unknown-site';

const tracker = {
    focusMode: false,
    activeHost: null,
    lastTickMs: null,
    windowFocused: true
};

function emptyStats() {
    return {
        totalMs: 0,
        sites: {}
    };
}

function normalizeHostFromUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return null;
    }

    try {
        const parsed = new URL(url);
        return parsed.hostname ? parsed.hostname.toLowerCase().replace(/^www\./, '') : null;
    } catch (_error) {
        return null;
    }
}

function mergeStatsWithDelta(stats, host, deltaMs) {
    const nextStats = {
        totalMs: Number(stats.totalMs) || 0,
        sites: { ...(stats.sites || {}) }
    };

    nextStats.totalMs += deltaMs;

    if (!nextStats.sites[host]) {
        nextStats.sites[host] = 0;
    }

    nextStats.sites[host] += deltaMs;
    return nextStats;
}

function resetCurrentSession() {
    chrome.storage.local.set({
        [FOCUS_SESSION_KEY]: emptyStats(),
        [FOCUS_SESSION_STARTED_AT_KEY]: Date.now()
    });
}

function clearCurrentSession() {
    chrome.storage.local.set({
        [FOCUS_SESSION_KEY]: emptyStats()
    });
    chrome.storage.local.remove([FOCUS_SESSION_STARTED_AT_KEY]);
}

function getTrackingHost() {
    return tracker.activeHost || FALLBACK_HOST;
}

function resolveActiveHost(callback) {
    const pickHost = (tabs) => {
        if (!Array.isArray(tabs)) {
            return null;
        }

        for (const tab of tabs) {
            const host = normalizeHostFromUrl(tab && tab.url ? tab.url : '');
            if (host) {
                return host;
            }
        }

        return null;
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabsCurrent) => {
        const currentHost = pickHost(tabsCurrent);
        if (currentHost) {
            callback(currentHost);
            return;
        }

        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabsFocused) => {
            const focusedHost = pickHost(tabsFocused);
            if (focusedHost) {
                callback(focusedHost);
                return;
            }

            chrome.tabs.query({ active: true }, (tabsAny) => {
                callback(pickHost(tabsAny));
            });
        });
    });
}

function getLiveDeltaMs() {
    if (!tracker.focusMode || !tracker.lastTickMs) {
        return 0;
    }

    return Math.max(0, Date.now() - tracker.lastTickMs);
}

function readSessionMs(sendResponse) {
    const respondWithSession = () => {
        const liveDeltaMs = getLiveDeltaMs();

        chrome.storage.local.get([FOCUS_SESSION_KEY, FOCUS_SESSION_STARTED_AT_KEY], (result) => {
            const session = result[FOCUS_SESSION_KEY] || emptyStats();
            const baseMs = Number(session.totalMs) || 0;
            const startedAt = Number(result[FOCUS_SESSION_STARTED_AT_KEY]) || 0;
            const elapsedFromStartMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;

            if (liveDeltaMs > 0) {
                persistFocusDelta(getTrackingHost(), liveDeltaMs);
                tracker.lastTickMs = Date.now();
            }

            sendResponse({
                focusMode: tracker.focusMode,
                sessionMs: Math.max(baseMs + liveDeltaMs, elapsedFromStartMs)
            });
        });
    };

    if (!tracker.focusMode || tracker.activeHost) {
        respondWithSession();
        return;
    }

    resolveActiveHost((host) => {
        tracker.activeHost = host;
        tracker.lastTickMs = tracker.lastTickMs || Date.now();
        respondWithSession();
    });
}

function readFocusStats(sendResponse) {
    const respondWithStats = () => {
        const liveDeltaMs = getLiveDeltaMs();

        chrome.storage.local.get([FOCUS_SESSION_KEY, FOCUS_STATS_KEY], (result) => {
            const session = result[FOCUS_SESSION_KEY] || emptyStats();
            const overall = result[FOCUS_STATS_KEY] || emptyStats();

            if (liveDeltaMs > 0) {
                const host = getTrackingHost();
                const nextSession = mergeStatsWithDelta(session, host, liveDeltaMs);
                const nextOverall = mergeStatsWithDelta(overall, host, liveDeltaMs);

                chrome.storage.local.set({
                    [FOCUS_SESSION_KEY]: nextSession,
                    [FOCUS_STATS_KEY]: nextOverall
                });

                tracker.lastTickMs = Date.now();
                sendResponse({ session: nextSession, overall: nextOverall });
                return;
            }

            sendResponse({ session, overall });
        });
    };

    if (!tracker.focusMode || tracker.activeHost) {
        respondWithStats();
        return;
    }

    resolveActiveHost((host) => {
        tracker.activeHost = host;
        tracker.lastTickMs = tracker.lastTickMs || Date.now();
        respondWithStats();
    });
}

function updateActiveHostFromCurrentTab() {
    resolveActiveHost((host) => {
        tracker.activeHost = host;
        tracker.lastTickMs = Date.now();
    });
}

function persistFocusDelta(host, deltaMs) {
    if (!host || deltaMs <= 0) {
        return;
    }

    chrome.storage.local.get([FOCUS_STATS_KEY, FOCUS_SESSION_KEY], (result) => {
        const overall = result[FOCUS_STATS_KEY] || emptyStats();
        const session = result[FOCUS_SESSION_KEY] || emptyStats();

        const nextOverall = mergeStatsWithDelta(overall, host, deltaMs);
        const nextSession = mergeStatsWithDelta(session, host, deltaMs);

        chrome.storage.local.set({
            [FOCUS_STATS_KEY]: nextOverall,
            [FOCUS_SESSION_KEY]: nextSession
        });
    });
}

function flushTrackedTime() {
    const now = Date.now();

    if (!tracker.focusMode || !tracker.lastTickMs) {
        tracker.lastTickMs = now;
        return;
    }

    const deltaMs = now - tracker.lastTickMs;
    if (deltaMs > 0) {
        persistFocusDelta(getTrackingHost(), deltaMs);
    }

    tracker.lastTickMs = now;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'FOCUS_MODE_CHANGED') {
        flushTrackedTime();

        const nextFocusMode = Boolean(message.enabled);
        tracker.focusMode = nextFocusMode;
        tracker.lastTickMs = Date.now();

        if (nextFocusMode) {
            resetCurrentSession();
            updateActiveHostFromCurrentTab();
        } else {
            // Stop Focusing ends the current session.
            clearCurrentSession();
            tracker.activeHost = null;
        }

        console.log('Focus mode:', nextFocusMode ? 'ON' : 'OFF');
        return;
    }

    if (message.type === 'GET_FOCUS_SESSION_TIME') {
        readSessionMs(sendResponse);
        return true;
    }

    if (message.type === 'GET_FOCUS_STATS') {
        readFocusStats(sendResponse);
        return true;
    }
});

chrome.tabs.onActivated.addListener(() => {
    flushTrackedTime();
    updateActiveHostFromCurrentTab();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (!tab.active) {
        return;
    }

    if (changeInfo.status !== 'complete' && !changeInfo.url) {
        return;
    }

    flushTrackedTime();
    tracker.activeHost = normalizeHostFromUrl(tab.url || '');
    tracker.lastTickMs = Date.now();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    flushTrackedTime();
    tracker.windowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
    tracker.lastTickMs = Date.now();

    if (tracker.windowFocused) {
        updateActiveHostFromCurrentTab();
    } else {
        // Keep counting during focus mode even if popup/devtools changes focus.
        tracker.activeHost = tracker.activeHost || FALLBACK_HOST;
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || alarm.name !== 'timerDone') {
        return;
    }

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
        settings: {},
        focusStats: {
            totalMs: 0,
            sites: {}
        },
        focusSessionStats: {
            totalMs: 0,
            sites: {}
        },
        focusSessionStartedAt: null,
        endTime: null,
        totalSeconds: null,
        timerSiteHost: null,
        timerAccountedMs: null
    });

    chrome.storage.local.remove([
        'focusSessionStartedAt',
        'endTime',
        'totalSeconds',
        'timerSiteHost',
        'timerAccountedMs'
    ]);

    tracker.focusMode = false;
    tracker.activeHost = null;
    tracker.lastTickMs = Date.now();
    tracker.windowFocused = true;

    chrome.alarms.clearAll();
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['focusMode'], (result) => {
        tracker.focusMode = Boolean(result.focusMode);
        tracker.lastTickMs = Date.now();
        tracker.windowFocused = true;
        tracker.activeHost = null;
        updateActiveHostFromCurrentTab();
    });

    chrome.storage.local.set({
        focusSessionStats: {
            totalMs: 0,
            sites: {}
        }
    });
    chrome.storage.local.remove([FOCUS_SESSION_STARTED_AT_KEY]);
});

// Initialize tracker when service worker wakes up.
chrome.storage.local.get(['focusMode'], (result) => {
    tracker.focusMode = Boolean(result.focusMode);
    tracker.lastTickMs = Date.now();
    tracker.windowFocused = true;
    tracker.activeHost = null;
    updateActiveHostFromCurrentTab();
});

