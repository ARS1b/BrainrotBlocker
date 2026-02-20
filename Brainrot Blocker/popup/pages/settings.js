// ===== Settings Page Module =====
window.PageModules = window.PageModules || {};

window.PageModules.settings = {
    initialized: false,

    // Kutsutaan kun sivu avataan
    onEnter() {
        if (!this.initialized) {
            this.init();
            this.initialized = true;
        }
    },

    // Kutsutaan kun sivulta poistutaan
    onLeave() {
    },

    // Kertaluontoinen alustus
    init() {
        // TODO: Lisää settings-sivun DOM-elementit ja event listenerit tähän
    }
};
