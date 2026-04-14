const APP_LOCALE_KEY = 'appLocale';
const SUPPORTED_LOCALES = ['en', 'fi'];
const DEFAULT_LOCALE_PREFERENCE = 'browser';

let localePreference = DEFAULT_LOCALE_PREFERENCE;
let activeLocale = 'en';
let messages = {};

function normalizeLocalePreference(value) {
    if (value === 'en' || value === 'fi' || value === 'browser') {
        return value;
    }

    return DEFAULT_LOCALE_PREFERENCE;
}

function resolveBrowserLocale() {
    const uiLanguage = (chrome.i18n?.getUILanguage?.() || navigator.language || 'en').toLowerCase();
    return uiLanguage.startsWith('fi') ? 'fi' : 'en';
}

function resolveEffectiveLocale(preference) {
    if (preference === 'browser') {
        return resolveBrowserLocale();
    }

    return SUPPORTED_LOCALES.includes(preference) ? preference : 'en';
}

async function loadMessages(locale) {
    const localeFileUrl = chrome.runtime.getURL(`popup/locales/${locale}.json`);

    try {
        const response = await fetch(localeFileUrl);
        if (!response.ok) {
            throw new Error(`Failed to load locale file: ${locale}`);
        }

        messages = await response.json();
    } catch (_error) {
        if (locale !== 'en') {
            await loadMessages('en');
            return;
        }

        messages = {};
    }
}

function interpolate(template, substitutions) {
    if (!substitutions || typeof substitutions !== 'object') {
        return template;
    }

    return Object.entries(substitutions).reduce((result, [key, value]) => {
        const placeholder = new RegExp(`\\{${key}\\}`, 'g');
        return result.replace(placeholder, String(value));
    }, template);
}

function t(key, substitutions) {
    const template = messages[key];
    if (typeof template !== 'string') {
        return `[${key}]`;
    }

    return interpolate(template, substitutions);
}

function apply(root = document) {
    if (!root) {
        return;
    }

    root.querySelectorAll('[data-i18n]').forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (!key) {
            return;
        }

        node.textContent = t(key);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
        const key = node.getAttribute('data-i18n-placeholder');
        if (!key) {
            return;
        }

        node.setAttribute('placeholder', t(key));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((node) => {
        const key = node.getAttribute('data-i18n-title');
        if (!key) {
            return;
        }

        node.setAttribute('title', t(key));
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
        const key = node.getAttribute('data-i18n-aria-label');
        if (!key) {
            return;
        }

        node.setAttribute('aria-label', t(key));
    });
}

function persistLocalePreference(nextPreference) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [APP_LOCALE_KEY]: nextPreference }, () => {
            resolve();
        });
    });
}

async function setLocalePreference(preference, persist = true) {
    localePreference = normalizeLocalePreference(preference);
    activeLocale = resolveEffectiveLocale(localePreference);

    if (persist) {
        await persistLocalePreference(localePreference);
    }

    await loadMessages(activeLocale);
    document.documentElement.setAttribute('lang', activeLocale);

    window.dispatchEvent(new CustomEvent('app-locale-changed', {
        detail: {
            localePreference,
            activeLocale
        }
    }));
}

async function init() {
    return new Promise((resolve) => {
        chrome.storage.local.get([APP_LOCALE_KEY], async (result) => {
            const storedPreference = normalizeLocalePreference(result[APP_LOCALE_KEY]);
            await setLocalePreference(storedPreference, false);
            resolve();
        });
    });
}

window.I18n = {
    init,
    t,
    apply,
    setLocalePreference,
    getLocalePreference() {
        return localePreference;
    },
    getResolvedLocale() {
        return activeLocale;
    }
};
