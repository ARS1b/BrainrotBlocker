// ===== Blocked Sites Page Module =====
window.PageModules = window.PageModules || {};

window.PageModules['blocked-sites'] = {
    blockedSites: [],

    // Kutsutaan kun sivu avataan
    onEnter() {
        this.init();
    },

    // Kutsutaan kun sivulta poistutaan
    onLeave() {
    },

    // Alustus - kutsutaan joka kerta kun sivu avataan
    init() {
        this.input = document.getElementById('blockedSiteInput');
        this.addButton = document.getElementById('addBlockedSiteBtn');
        this.addCurrentSiteButton = document.getElementById('addCurrentSiteBtn');
        this.list = document.getElementById('blockedSitesList');
        this.message = document.getElementById('blockedSiteMessage');

        if (!this.input || !this.addButton || !this.addCurrentSiteButton || !this.list || !this.message) {
            return;
        }

        this.addButton.addEventListener('click', () => {
            this.addCurrentInput();
        });

        this.addCurrentSiteButton.addEventListener('click', () => {
            this.addCurrentTabSite();
        });

        this.input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.addCurrentInput();
            }
        });

        this.loadBlockedSites();
    },

    addCurrentInput() {
        const rawValue = this.input.value.trim();

        if (this.isNonBlockableGoogleInput(rawValue)) {
            this.setMessage('Google front page cannot be added to the block list.', true);
            return;
        }

        const normalizedHost = this.normalizeSiteInput(rawValue);

        this.addNormalizedHost(normalizedHost, 'Site added to block list.');
    },

    addCurrentTabSite() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                this.setMessage('Failed to retrieve current page.', true);
                return;
            }

            const activeTab = tabs && tabs[0];
            const tabUrl = activeTab && typeof activeTab.url === 'string' ? activeTab.url : '';

            if (this.isNonBlockableUrl(tabUrl)) {
                this.setMessage('Chrome\'s start page cannot be added to the block list.', true);
                return;
            }

            if (this.isNonBlockableGoogleInput(tabUrl)) {
                this.setMessage('Google front page cannot be added to the block list.', true);
                return;
            }

            const normalizedHost = this.normalizeSiteInput(tabUrl);

            if (!normalizedHost) {
                this.setMessage('The current page cannot be added to the block list.', true);
                return;
            }

            this.addNormalizedHost(normalizedHost, 'Site added to block list.');
        });
    },

    addNormalizedHost(normalizedHost, successMessage) {

        if (!normalizedHost) {
            this.setMessage('Please enter a valid URL or domain, e.g., youtube.com', true);
            return;
        }

        if (this.blockedSites.includes(normalizedHost)) {
            this.setMessage('Site is already on the block list.', true);
            return;
        }

        this.blockedSites.push(normalizedHost);
        this.blockedSites.sort();
        this.persistBlockedSites(() => {
            this.input.value = '';
            this.setMessage(successMessage, false);
            this.renderBlockedSites();
        });
    },

    removeSite(hostToRemove) {
        this.blockedSites = this.blockedSites.filter((host) => host !== hostToRemove);
        this.persistBlockedSites(() => {
            this.setMessage('Site removed from block list.', false);
            this.renderBlockedSites();
        });
    },

    loadBlockedSites() {
        chrome.storage.local.get(['blockedSites'], (result) => {
            const stored = Array.isArray(result.blockedSites) ? result.blockedSites : [];
            this.blockedSites = stored
                .map((entry) => this.normalizeSiteInput(entry))
                .filter(Boolean);

            this.blockedSites = [...new Set(this.blockedSites)].sort();
            this.renderBlockedSites();
        });
    },

    persistBlockedSites(callback) {
        chrome.storage.local.set({ blockedSites: this.blockedSites }, () => {
            if (chrome.runtime.lastError) {
                this.setMessage('Failed to save changes. Please try again.', true);
                return;
            }

            if (callback) {
                callback();
            }
        });
    },

    renderBlockedSites() {
        if (!this.list) {
            return;
        }

        this.list.innerHTML = '';

        if (this.blockedSites.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'blocked-sites-empty';
            emptyItem.textContent = 'No blocked sites yet.';
            this.list.appendChild(emptyItem);
            return;
        }

        this.blockedSites.forEach((site) => {
            const item = document.createElement('li');
            item.className = 'blocked-sites-item';

            const siteText = document.createElement('span');
            siteText.className = 'blocked-sites-item-text';
            siteText.textContent = site;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'blocked-sites-remove-btn';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                this.removeSite(site);
            });

            item.appendChild(siteText);
            item.appendChild(removeBtn);
            this.list.appendChild(item);
        });
    },

    setMessage(text, isError) {
        if (!this.message) {
            return;
        }

        this.message.textContent = text;
        this.message.classList.toggle('error', Boolean(isError));
    },

    normalizeSiteInput(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }

        let input = value.trim().toLowerCase();
        if (!input) {
            return null;
        }

        if (this.isNonBlockableUrl(input)) {
            return null;
        }

        const hasCustomScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(input);
        const isHttpScheme = input.startsWith('http://') || input.startsWith('https://');

        if (hasCustomScheme && !isHttpScheme) {
            return null;
        }

        if (!isHttpScheme) {
            input = `https://${input}`;
        }

        try {
            const parsed = new URL(input);
            if (!parsed.hostname) {
                return null;
            }

            const normalizedHost = parsed.hostname.replace(/^www\./, '');
            if (this.isNonBlockableHost(normalizedHost)) {
                return null;
            }

            return normalizedHost;
        } catch (_error) {
            return null;
        }
    },

    isNonBlockableUrl(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }

        const input = value.trim().toLowerCase();
        return (
            input.startsWith('chrome://newtab') ||
            input.startsWith('chrome-search://') ||
            input.startsWith('about:newtab')
        );
    },

    isNonBlockableHost(host) {
        if (!host || typeof host !== 'string') {
            return false;
        }

        const normalizedHost = host.trim().toLowerCase().replace(/^www\./, '');
        return normalizedHost === 'google.com' || normalizedHost.endsWith('.google.com');
    },

    isNonBlockableGoogleInput(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }

        let input = value.trim().toLowerCase();
        if (!input) {
            return false;
        }

        const hasCustomScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(input);
        const isHttpScheme = input.startsWith('http://') || input.startsWith('https://');

        if (hasCustomScheme && !isHttpScheme) {
            return false;
        }

        if (!isHttpScheme) {
            input = `https://${input}`;
        }

        try {
            const parsed = new URL(input);
            return this.isNonBlockableHost(parsed.hostname || '');
        } catch (_error) {
            return false;
        }
    }
};
