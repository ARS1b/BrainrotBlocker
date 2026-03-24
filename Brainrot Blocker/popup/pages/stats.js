// ===== Stats Page Module =====
window.PageModules = window.PageModules || {};

const FOCUS_STATS_KEY = 'focusStats';
const FOCUS_SESSION_KEY = 'focusSessionStats';

window.PageModules.stats = {
    refreshButton: null,
    refreshHandler: null,
    resetButton: null,
    resetHandler: null,
    autoRefreshInterval: null,

    // Kutsutaan kun sivu avataan
    onEnter() {
        this.init();
    },

    // Kutsutaan kun sivulta poistutaan
    onLeave() {
        if (this.refreshButton && this.refreshHandler) {
            this.refreshButton.removeEventListener('click', this.refreshHandler);
        }

        if (this.resetButton && this.resetHandler) {
            this.resetButton.removeEventListener('click', this.resetHandler);
        }

        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        this.refreshButton = null;
        this.refreshHandler = null;
        this.resetButton = null;
        this.resetHandler = null;
        this.autoRefreshInterval = null;
    },

    // Alustus - kutsutaan joka kerta kun sivu avataan (DOM ladataan uudelleen)
    init() {
        this.sessionNode = document.getElementById('sessionFocusTime');
        this.overallNode = document.getElementById('overallFocusTime');
        this.siteListNode = document.getElementById('siteStatsList');
        this.emptyStateNode = document.getElementById('siteStatsEmpty');
        this.refreshButton = document.getElementById('refreshStatsBtn');
        this.resetButton = document.getElementById('resetStatsBtn');

        if (!this.sessionNode || !this.overallNode || !this.siteListNode || !this.emptyStateNode || !this.refreshButton || !this.resetButton) {
            return;
        }

        this.refreshHandler = () => {
            this.loadStats();
        };

        this.resetHandler = () => {
            this.resetOverallStats();
        };

        this.refreshButton.addEventListener('click', this.refreshHandler);
        this.resetButton.addEventListener('click', this.resetHandler);
        this.loadStats();

        // Keep stats live while this page is open.
        this.autoRefreshInterval = setInterval(() => {
            this.loadStats();
        }, 1000);
    },

    emptyStats() {
        return {
            totalMs: 0,
            sites: {}
        };
    },

    mergeStatsWithDelta(stats, host, deltaMs) {
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
    },

    resetOverallStats() {
        const accepted = window.confirm('Reset overall stats and site usage totals?');
        if (!accepted) {
            return;
        }

        chrome.storage.local.set({
            [FOCUS_STATS_KEY]: this.emptyStats()
        }, () => {
            this.loadStats();
        });
    },

    loadStats() {
        chrome.runtime.sendMessage({ type: 'GET_FOCUS_STATS' }, (response) => {
            if (!chrome.runtime.lastError && response && typeof response === 'object') {
                const sessionBase = response.session || this.emptyStats();
                const overallBase = response.overall || this.emptyStats();

                const session = {
                    totalMs: Number(sessionBase.totalMs) || 0,
                    sites: { ...(sessionBase.sites || {}) }
                };
                const overall = {
                    totalMs: Number(overallBase.totalMs) || 0,
                    sites: { ...(overallBase.sites || {}) }
                };

                this.renderStats(session, overall);
                return;
            }

            // Fallback to local storage if runtime messaging is unavailable.
            chrome.storage.local.get([FOCUS_SESSION_KEY, FOCUS_STATS_KEY], (result) => {
                const sessionBase = result[FOCUS_SESSION_KEY] || this.emptyStats();
                const overallBase = result[FOCUS_STATS_KEY] || this.emptyStats();

                const session = {
                    totalMs: Number(sessionBase.totalMs) || 0,
                    sites: { ...(sessionBase.sites || {}) }
                };
                const overall = {
                    totalMs: Number(overallBase.totalMs) || 0,
                    sites: { ...(overallBase.sites || {}) }
                };

                this.renderStats(session, overall);
            });
        });
    },

    renderStats(session, overall) {
        this.sessionNode.textContent = this.formatDuration(session.totalMs || 0);
        this.overallNode.textContent = this.formatDuration(overall.totalMs || 0);

        const entries = Object.entries(overall.sites || {})
            .filter(([, value]) => Number(value) > 0)
            .sort((a, b) => Number(b[1]) - Number(a[1]));

        this.siteListNode.innerHTML = '';

        if (entries.length === 0) {
            this.emptyStateNode.style.display = 'block';
            return;
        }

        this.emptyStateNode.style.display = 'none';

        entries.forEach(([host, ms]) => {
            const row = document.createElement('li');
            row.className = 'site-stats-item';

            const hostSpan = document.createElement('span');
            hostSpan.className = 'site-stats-host';
            hostSpan.textContent = host;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'site-stats-time';
            timeSpan.textContent = this.formatDuration(ms);

            row.appendChild(hostSpan);
            row.appendChild(timeSpan);
            this.siteListNode.appendChild(row);
        });
    },

    renderError() {
        this.sessionNode.textContent = '00:00:00';
        this.overallNode.textContent = '00:00:00';
        this.siteListNode.innerHTML = '';
        this.emptyStateNode.textContent = 'Unable to load stats right now.';
        this.emptyStateNode.style.display = 'block';
    },

    formatDuration(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
};
