// ===== DOM Elements =====
const backBtn = document.getElementById('backBtn'); // nappi joka palauttaa pääsivulle
const headerTitle = document.getElementById('headerTitle'); // headerin otsikko joka vaihtuu sivun mukaan
const focusToggleBtn = document.getElementById('focusToggleBtn'); // nappi joka käynnistää tai lopettaa focus modin
const statusDot = document.querySelector('.status-dot'); // pieni piste joka näyttää focus modin tilan (vihreä = päällä, punainen = pois päältä)
const statusText = document.querySelector('.status-text'); // teksti joka näyttää focus modin tilan (esim. "Focus Mode: ON" tai "Focus Mode: OFF")
const menuItems = document.querySelectorAll('.menu-item'); // sivun info (pitää varmaan muuttaa kun ominaisuudet tehty)
const pages = document.querySelectorAll('.page'); // kaikki "sivut"

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

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    // Load focus mode state from storage
    chrome.storage.local.get(['focusMode'], (result) => {
        if (result.focusMode) {
            focusMode = true;
            updateFocusUI();
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

function navigateTo(pageId) {
    // Ilmoita vanhalle sivulle että poistutaan
    const oldModule = window.PageModules?.[currentPage];
    if (oldModule?.onLeave) {
        oldModule.onLeave();
    }

    // Hide all pages
    pages.forEach(page => page.classList.remove('active'));

    // Show target page
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Update header
    headerTitle.textContent = pageTitles[pageId] || '🧠 Brainrot Blocker';

    // Show/hide back button
    if (pageId === 'main') {
        backBtn.classList.add('hidden');
    } else {
        backBtn.classList.remove('hidden');
    }

    // Ilmoita uudelle sivulle että se on aktiivinen
    currentPage = pageId;
    const newModule = window.PageModules?.[pageId];
    if (newModule?.onEnter) {
        newModule.onEnter();
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