// ===== DOM Elements =====
const backBtn = document.getElementById('backBtn'); // nappi joka palauttaa pääsivulle
const headerTitle = document.getElementById('headerTitle'); // headerin otsikko joka vaihtuu sivun mukaan
const focusToggleBtn = document.getElementById('focusToggleBtn'); // nappi joka käynnistää tai lopettaa focus modin
const statusDot = document.querySelector('.status-dot'); // pieni piste joka näyttää focus modin tilan (vihreä = päällä, punainen = pois päältä)
const statusText = document.querySelector('.status-text'); // teksti joka näyttää focus modin tilan (esim. "Focus Mode: ON" tai "Focus Mode: OFF")
const focusSessionTimer = document.getElementById('focusSessionTimer'); // näyttä nykyisen fokussession ajankesto
const menuItems = document.querySelectorAll('.menu-item'); // menu-napit jotka navigoivat alasivuille
const dynamicPage = document.getElementById('page-dynamic'); // dynaaminen container alasivuille

// ===== Page titles mapping =====
const pageTitles = {
    'main': '🧠 Brainrot Blocker',
    'blocked-sites': '🚫 Blocked Sites',
    'timer': '⏱️ Study Timer',
    'stats': '📊 Statistics',
    'settings': '⚙️ Settings'
};

// ===== State =====
let focusMode = false; // focus mode defaulttina pois päältä
let currentPage = 'main'; // seuraa nykyistä sivua
const loadedPages = {}; // välimuisti ladatuille HTML-sivuille
let focusTimerInterval = null;
const FOCUS_SESSION_STARTED_AT_KEY = 'focusSessionStartedAt';

function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateFocusTimerDisplay(milliseconds) {
    if (!focusSessionTimer) {
        return;
    }

    focusSessionTimer.textContent = formatDuration(milliseconds);
}

function refreshFocusSessionTimer() {
    chrome.runtime.sendMessage({ type: 'GET_FOCUS_SESSION_TIME' }, (response) => {
        if (chrome.runtime.lastError) {
            chrome.storage.local.get(['focusMode', FOCUS_SESSION_STARTED_AT_KEY], (result) => {
                if (!result.focusMode) {
                    updateFocusTimerDisplay(0);
                    return;
                }

                const startedAt = Number(result[FOCUS_SESSION_STARTED_AT_KEY]) || 0;
                const elapsedMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;
                updateFocusTimerDisplay(elapsedMs);
            });
            return;
        }

        if (!response || typeof response !== 'object') {
            return;
        }

        if (!response.focusMode) {
            updateFocusTimerDisplay(0);
            return;
        }

        updateFocusTimerDisplay(Number(response.sessionMs) || 0);
    });
}

function startFocusSessionTimerLoop() {
    if (focusTimerInterval) {
        clearInterval(focusTimerInterval);
    }

    refreshFocusSessionTimer();
    focusTimerInterval = setInterval(refreshFocusSessionTimer, 1000);
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    // Load focus mode state from storage
    chrome.storage.local.get(['focusMode'], (result) => {
        if (result.focusMode) {
            focusMode = true;
            updateFocusUI();
        }

        startFocusSessionTimerLoop();
    });

    // Tarkistaa onko background.js asettanut pendingPage:n (notifikaation klikkaus)
// ja navigoi sinne automaattisesti kun popup avautuu.
    chrome.storage.local.get('pendingPage', (data) => {
        if (data.pendingPage) {
            chrome.storage.local.remove('pendingPage');
            navigateTo(data.pendingPage); // käyttää olemassa olevaa navigateTo-funktiota
        }
    });
});

// ===== Navigation =====
menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetPage = item.dataset.page;
        navigateTo(targetPage);
    });
});

backBtn.addEventListener('click', () => {
    navigateTo('main');
}); // menee takaisin main pagelle

async function navigateTo(pageId) {
    // Ilmoita vanhalle sivulle että poistutaan
    const oldModule = window.PageModules?.[currentPage];
    if (oldModule?.onLeave) {
        oldModule.onLeave();
    }

    // Update header
    headerTitle.textContent = pageTitles[pageId] || '🧠 Brainrot Blocker';

    // Show/hide back button
    if (pageId === 'main') {
        backBtn.classList.add('hidden');
        // Näytä main, piilota dynaaminen sivu
        document.getElementById('page-main').classList.add('active');
        dynamicPage.classList.remove('active');
        dynamicPage.innerHTML = '';
    } else {
        backBtn.classList.remove('hidden');
        // Piilota main, näytä dynaaminen sivu
        document.getElementById('page-main').classList.remove('active');

        // Lataa sivun HTML (välimuistista tai fetchillä)
        await loadPageHTML(pageId);
        dynamicPage.classList.add('active');
    }

    // Ilmoita uudelle sivulle että se on aktiivinen
    currentPage = pageId;
    const newModule = window.PageModules?.[pageId];
    if (newModule?.onEnter) {
        newModule.onEnter();
    }
}

// ===== Sivun HTML:n lataus =====
async function loadPageHTML(pageId) {
    // Käytä välimuistia jos sivu on jo ladattu
    if (loadedPages[pageId]) {
        dynamicPage.innerHTML = loadedPages[pageId];
        return;
    }

    try {
        const response = await fetch(`pages/${pageId}.html`);
        if (!response.ok) throw new Error(`Sivua ${pageId}.html ei löytynyt`);
        const html = await response.text();
        loadedPages[pageId] = html; // tallenna välimuistiin
        dynamicPage.innerHTML = html;
    } catch (error) {
        console.error('Sivun lataus epäonnistui:', error);
        dynamicPage.innerHTML = '<div class="page-content"><p class="placeholder-text">⚠️ Sivun lataus epäonnistui</p></div>';
    }

    // Lataa sivun JS — ja ODOTA sen valmistumista ennen paluuta.
    // Ilman tätä odotusta navigateTo kutsuu onEnter() ennen kuin
    // window.PageModules.[pageId] on rekisteröity → napit eivät toimi.
    if (!document.querySelector(`script[data-page="${pageId}"]`)) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `pages/${pageId}.js`;
            script.dataset.page = pageId;
            script.onload  = resolve;
            script.onerror = resolve; // jatketaan vaikka JS-tiedostoa ei olisi
            document.body.appendChild(script);
        });
    }
}

// ===== Focus Mode Toggle =====
focusToggleBtn.addEventListener('click', () => {
    focusMode = !focusMode;
    updateFocusUI();

    // Save state
    chrome.storage.local.set({ focusMode: focusMode });

    // Notify background script
    chrome.runtime.sendMessage({
        type: 'FOCUS_MODE_CHANGED',
        enabled: focusMode
    });

    if (!focusMode) {
        updateFocusTimerDisplay(0);
    } else {
        refreshFocusSessionTimer();
    }
});

function updateFocusUI() {
    if (focusMode) {
        statusDot.classList.add('active');
        statusText.textContent = 'Focus Mode: ON';
        focusToggleBtn.textContent = 'Stop Focusing';
        focusToggleBtn.classList.add('active');
    } else {
        statusDot.classList.remove('active');
        statusText.textContent = 'Focus Mode: OFF';
        focusToggleBtn.textContent = 'Start Focusing';
        focusToggleBtn.classList.remove('active');
    }
}