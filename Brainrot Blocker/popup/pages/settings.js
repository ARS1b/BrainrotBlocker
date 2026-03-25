// ===== Settings Page Module =====
window.PageModules = window.PageModules || {};

window.PageModules.settings = {
    themeToggleButton: null,
    themeValueLabel: null,
    themeToggleHandler: null,

    // Kutsutaan kun sivu avataan
    onEnter() {
        this.init();
    },

    // Kutsutaan kun sivulta poistutaan
    onLeave() {
        if (this.themeToggleButton && this.themeToggleHandler) {
            this.themeToggleButton.removeEventListener('click', this.themeToggleHandler);
        }

        this.themeToggleButton = null;
        this.themeValueLabel = null;
        this.themeToggleHandler = null;
    },

    // Alustus - kutsutaan joka kerta kun sivu avataan (DOM ladataan uudelleen)
    init() {
        this.themeToggleButton = document.getElementById('themeToggle');
        this.themeValueLabel = document.getElementById('themeValue');

        if (!this.themeToggleButton || !this.themeValueLabel) {
            return;
        }

        const currentTheme = window.ThemeManager?.getTheme?.() || 'dark';
        this.updateThemeUI(currentTheme);

        this.themeToggleHandler = () => {
            const activeTheme = window.ThemeManager?.getTheme?.() || 'dark';
            const nextTheme = activeTheme === 'light' ? 'dark' : 'light';

            if (window.ThemeManager?.setTheme) {
                window.ThemeManager.setTheme(nextTheme, true);
            }

            this.updateThemeUI(nextTheme);
        };

        this.themeToggleButton.addEventListener('click', this.themeToggleHandler);
    },

    updateThemeUI(theme) {
        const isLight = theme === 'light';
        this.themeToggleButton.classList.toggle('is-light', isLight);
        this.themeToggleButton.setAttribute('aria-checked', String(isLight));
        this.themeValueLabel.textContent = `Current theme: ${isLight ? 'Light' : 'Dark'}`;
    }
};
