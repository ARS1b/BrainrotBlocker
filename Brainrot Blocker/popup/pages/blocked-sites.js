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

    // Alustus - kutsutaan joka kerta kun sivu avataan (DOM ladataan uudelleen)
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
            this.setMessage('Google.com-sivuja ei voi lisätä estolistaan.', true);
            return;
        }

        const normalizedHost = this.normalizeSiteInput(rawValue);

        this.addNormalizedHost(normalizedHost, 'Sivu lisätty estolistalle.');
    },

    addCurrentTabSite() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                this.setMessage('Nykyisen sivun haku epäonnistui.', true);
                return;
            }

            const activeTab = tabs && tabs[0];
            const tabUrl = activeTab && typeof activeTab.url === 'string' ? activeTab.url : '';

            if (this.isNonBlockableUrl(tabUrl)) {
                this.setMessage('Chromen aloitus-sivua ei voi lisätä estolistalle.', true);
                return;
            }

            if (this.isNonBlockableGoogleInput(tabUrl)) {
                this.setMessage('Google.com-sivuja ei voi lisäta estolistaan.', true);
                return;
            }

            const normalizedHost = this.normalizeSiteInput(tabUrl);

            if (!normalizedHost) {
                this.setMessage('Tata sivua ei voi lisätä estolistalle.', true);
                return;
            }

            this.addNormalizedHost(normalizedHost, 'Nykyinen sivu lisätty estolistalle.');
        });
    },

    addNormalizedHost(normalizedHost, successMessage) {

        if (!normalizedHost) {
            this.setMessage('Anna kelvollinen URL tai domain, esim. youtube.com', true);
            return;
        }

        if (this.blockedSites.includes(normalizedHost)) {
            this.setMessage('Sivu on jo estolistalla.', true);
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
            this.setMessage('Sivu poistettu estolistalta.', false);
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
                this.setMessage('Tallennus epäonnistui. Yritä uudelleen.', true);
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
            emptyItem.textContent = 'Ei estettyjä sivuja vielä.';
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
            removeBtn.textContent = 'Poista';
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
