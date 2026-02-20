// ===== Timer Page Module =====
window.PageModules = window.PageModules || {};

window.PageModules.timer = {
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
        // TODO: Lisää timer-sivun DOM-elementit ja event listenerit tähän
    }
};
