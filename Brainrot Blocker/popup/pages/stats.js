// ===== Stats Page Module =====
window.PageModules = window.PageModules || {};

window.PageModules.stats = {
    // Kutsutaan kun sivu avataan
    onEnter() {
        this.init();
    },

    // Kutsutaan kun sivulta poistutaan
    onLeave() {
    },

    // Alustus - kutsutaan joka kerta kun sivu avataan (DOM ladataan uudelleen)
    init() {
        // TODO: Lisää stats-sivun DOM-elementit ja event listenerit tähän
    }
};
