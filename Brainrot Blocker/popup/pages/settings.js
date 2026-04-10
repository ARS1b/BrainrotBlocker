// ===== Settings Page Module =====
window.PageModules = window.PageModules || {};

window.PageModules.settings = {
    themeToggleButton: null,
    themeValueLabel: null,
    themeToggleHandler: null,
    localeSelect: null,
    localeChangeHandler: null,

    // Kutsutaan kun sivu avataan
    onEnter() {
        this.init();
    },

    onLocaleChanged() {
        if (window.I18n?.apply) {
            window.I18n.apply(document.getElementById('page-dynamic'));
        }

        const activeTheme = window.ThemeManager?.getTheme?.() || 'dark';
        this.updateThemeUI(activeTheme);

        if (this.localeSelect && window.I18n?.getLocalePreference) {
            this.localeSelect.value = window.I18n.getLocalePreference();
        }
    },

    // Kutsutaan kun sivulta poistutaan
    onLeave() {
        if (this.themeToggleButton && this.themeToggleHandler) {
            this.themeToggleButton.removeEventListener('click', this.themeToggleHandler);
        }

        if (this.localeSelect && this.localeChangeHandler) {
            this.localeSelect.removeEventListener('change', this.localeChangeHandler);
        }

        this.themeToggleButton = null;
        this.themeValueLabel = null;
        this.themeToggleHandler = null;
        this.localeSelect = null;
        this.localeChangeHandler = null;
    },

    // Alustus - kutsutaan joka kerta kun sivu avataan (DOM ladataan uudelleen)
    init() {
        this.themeToggleButton = document.getElementById('themeToggle');
        this.themeValueLabel = document.getElementById('themeValue');
        this.localeSelect = document.getElementById('localeSelect');

        if (!this.themeToggleButton || !this.themeValueLabel || !this.localeSelect) {
            return;
        }

        if (window.I18n?.apply) {
            window.I18n.apply(document.getElementById('page-dynamic'));
        }

        const currentTheme = window.ThemeManager?.getTheme?.() || 'dark';
        this.updateThemeUI(currentTheme);

        const currentLocalePreference = window.I18n?.getLocalePreference?.() || 'browser';
        this.localeSelect.value = currentLocalePreference;

        this.themeToggleHandler = () => {
            const activeTheme = window.ThemeManager?.getTheme?.() || 'dark';
            const nextTheme = activeTheme === 'light' ? 'dark' : 'light';

            if (window.ThemeManager?.setTheme) {
                window.ThemeManager.setTheme(nextTheme, true);
            }

            this.updateThemeUI(nextTheme);
        };

        this.localeChangeHandler = async (event) => {
            const nextPreference = event.target?.value || 'browser';

            if (window.I18n?.setLocalePreference) {
                await window.I18n.setLocalePreference(nextPreference, true);
            }

            if (window.I18n?.apply) {
                window.I18n.apply(document.getElementById('page-dynamic'));
            }

            const activeTheme = window.ThemeManager?.getTheme?.() || 'dark';
            this.updateThemeUI(activeTheme);
        };

        this.themeToggleButton.addEventListener('click', this.themeToggleHandler);
        this.localeSelect.addEventListener('change', this.localeChangeHandler);
    },

    updateThemeUI(theme) {
        const isLight = theme === 'light';
        const t = window.I18n?.t || ((key) => key);

        this.themeToggleButton.classList.toggle('is-light', isLight);
        this.themeToggleButton.setAttribute('aria-checked', String(isLight));
        this.themeValueLabel.textContent = t('settings.theme.current', {
            theme: t(isLight ? 'settings.theme.light' : 'settings.theme.dark')
        });
    }
};
