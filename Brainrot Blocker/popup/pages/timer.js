// ===== Timer Page Module =====
// Kääritään kaikki koodi IIFE-funktioon (Immediately Invoked Function Expression)
// jotta muuttujat eivät vuoda globaaliin scopeen ja sotke muita sivuja
(function () {

    // ── Tila-muuttujat ────────────────────────────────────────────────────────
    let timerInterval = null;   // setInterval-viite, jolla tick() ajetaan toistuvasti
    let endTime       = null;   // millisekuntiaika (Date.now()-muodossa) jolloin timer loppuu
    let totalSeconds  = 0;      // timerin kokonaiskesto sekunteina (esim. 5min = 300)
    let isRunning     = false;  // onko timer käynnissä vai ei

    // DOM-elementtiviitteet — alustetaan getEls():ssä kun HTML on varmasti ladattu
    let elDisplay, elTime, elSublabel, elProgress, elMinutes, elStart, elReset, elDone;

    // ── Hakee DOM-elementit muuttujiin ────────────────────────────────────────
    // Kutsutaan onEnter():ssa, koska timer.html ladataan dynaamisesti —
    // elementit eivät ole olemassa ennen kuin HTML on lisätty sivulle
    function getEls() {
        elDisplay  = document.getElementById('t-display');   // kehys jonka reunaväri vaihtuu
        elTime     = document.getElementById('t-time');      // iso MM:SS-näyttö
        elSublabel = document.getElementById('t-sublabel'); // pieni teksti näytön alla
        elProgress = document.getElementById('t-progress'); // edistymispalkin täyttöosa
        elMinutes  = document.getElementById('t-minutes');  // minuutti-syöttökenttä
        elStart    = document.getElementById('t-start');    // käynnistä/pysäytä-nappi
        elReset    = document.getElementById('t-reset');    // nollaa-nappi
        elDone     = document.getElementById('t-done');     // "Aika loppui!" -banneri
    }

    // ── Muuntaa sekunnit MM:SS-merkkijonoksi ─────────────────────────────────
    // Esim. 125 sekuntia → "02:05"
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60); // kokonaiset minuutit
        const s = seconds % 60;             // jäljelle jäävät sekunnit
        // padStart(2, '0') lisää etunollan jos luku on yksittäinen, esim. 5 → "05"
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // ── Päivittää käyttöliittymän vastaamaan timerin tilaa ───────────────────
    // state-arvot:
    //   'idle'    = odottaa käynnistystä tai on pysäytetty
    //   'running' = timer käynnissä normaalisti
    //   'danger'  = alle 10 sekuntia jäljellä (punainen väri)
    //   'done'    = aika loppunut
    function setUiState(state) {
        // Vaihda kehyksen CSS-luokka → CSS hoitaa värinvaihdot automaattisesti
        elDisplay.className  = `t-display ${state}`;
        // Vaihda edistymispalkin väri punaiseksi danger/done-tiloissa
        elProgress.className = `t-progress-fill${state === 'danger' || state === 'done' ? ' danger' : ''}`;
        // Näytä tai piilota "Aika loppui!" -banneri
        elDone.classList.toggle('visible', state === 'done');

        if (state === 'running' || state === 'danger') {
            // Timer pyörii → nappi muuttuu pysäytysnapiksi, kenttä lukitaan
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop`;
            elMinutes.disabled = true;
            elSublabel.textContent = 'Time remaining';
        } else if (state === 'done') {
            // Aika loppui → nappi muuttuu "Uudelleen"-napiksi
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Restart`;
            elMinutes.disabled = false;
            elSublabel.textContent = 'Time is up!';
        } else {
            // Idle → näytä käynnistysnappi, avaa kenttä muokkaukselle
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Start`;
            elMinutes.disabled = false;
            elSublabel.textContent = 'Set timer duration';
        }
    }

    // ── Päivittää edistymispalkin leveyden ───────────────────────────────────
    // Laskee kuinka monta prosenttia ajasta on jäljellä ja asettaa palkin leveydeksi
    // Esim. 30s jäljellä / 60s yhteensä = 50% → palkki puolivälissä
    function updateProgress(remainingSeconds) {
        const pct = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 100;
        elProgress.style.width = `${pct}%`;
    }

    // ── Timerin "sydämenlyönti" — ajetaan joka 500ms ─────────────────────────
    // Laskee jäljellä olevan ajan, päivittää näytön ja tarkistaa onko aika loppunut
    function tick() {
        // Lasketaan jäljellä olevat sekunnit: loppumisaika miinus nyt
        // Math.max(0, ...) estää negatiiviset arvot jos tick() viivästyy
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));

        // Päivitä näyttö ja edistymispalkki
        elTime.textContent = formatTime(remaining);
        updateProgress(remaining);

        // Jos aika on loppunut, siirry finishTimer():iin eikä jatketa
        if (remaining <= 0) { finishTimer(); return; }

        // Alle 10 sekuntia jäljellä → varoitustila (punainen)
        if (remaining <= 10) setUiState('danger');
    }

    // ── Käynnistää timerin ───────────────────────────────────────────────────
    // Lukee minuutit kentästä, laskee loppumisajan ja käynnistää tick()-silmukan
    function startTimer() {
        const minutes = parseInt(elMinutes.value, 10);
        // Varmista että arvo on järkevä ennen käynnistystä
        if (!minutes || minutes < 1) { elMinutes.focus(); return; }

        totalSeconds = minutes * 60;
        // Tallenna loppumisaika: nykyhetki + kesto millisekunteina
        endTime = Date.now() + totalSeconds * 1000;
        isRunning = true;

        // Tallenna storage:en jotta background.js ja muut sivut tietävät timerista
        chrome.storage.local.set({ endTime, totalSeconds });
        // Pyydä background.js:ää laukaisemaan alarm kun aika on kulunut
        // → alarm toimii vaikka popup olisi suljettuna
        chrome.alarms.create('timerDone', { when: endTime });

        tick(); // aja heti ensimmäinen tick jotta näyttö päivittyy viiveettä
        timerInterval = setInterval(tick, 500); // jatka 500ms välein
        setUiState('running');
    }

    // ── Pysäyttää timerin väliaikaisesti ─────────────────────────────────────
    // Ei nollaa aikaa — käyttäjä voi jatkaa myöhemmin (tällä hetkellä jäljellä oleva aika näkyy)
    function pauseTimer() {
        clearInterval(timerInterval); timerInterval = null; // pysäytä tick-silmukka
        isRunning = false;

        // Peruuta alarm koska timer ei enää etene
        chrome.alarms.clear('timerDone');
        chrome.storage.local.remove(['endTime', 'totalSeconds']);

        // Näytä pysäytyshetken aika jottei näyttö hyppää
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        elTime.textContent = formatTime(remaining);
        setUiState('idle');
        elSublabel.textContent = 'Paused';
    }

    // ── Merkitsee timerin valmiiksi kun aika loppuu ───────────────────────────
    // Kutsutaan joko tick():stä (aika luonnollisesti nolla) tai background.js:n
    // TIMER_DONE-viestistä (timer loppui kun popup oli kiinni)
    function finishTimer() {
        clearInterval(timerInterval); timerInterval = null;
        isRunning = false;
        elTime.textContent = '00:00';
        elProgress.style.width = '0%';
        // Storage on jo siivottu background.js:ssä, mutta varmistetaan tässäkin
        chrome.storage.local.remove(['endTime', 'totalSeconds']);
        setUiState('done');
    }

    // ── Nollaa timerin täysin alkutilaan ─────────────────────────────────────
    function resetTimer() {
        clearInterval(timerInterval); timerInterval = null;
        isRunning = false; endTime = null; totalSeconds = 0;
        chrome.alarms.clear('timerDone');
        chrome.storage.local.remove(['endTime', 'totalSeconds']);
        elTime.textContent = '00:00';
        elProgress.style.width = '100%'; // palauta palkki täyteen
        elMinutes.value = '';            // tyhjennä syöttökenttä
        setUiState('idle');
    }

    // ── Käsittelee background.js:ltä tulevat viestit ─────────────────────────
    // Background lähettää TIMER_DONE:n kun alarm laukeaa ja popup on auki
    function onMessage(msg) {
        if (msg.type === 'TIMER_DONE') finishTimer();
    }

    // ── Rekisteröi moduuli navigointijärjestelmään ────────────────────────────
    // popup.js kutsuu onEnter():a kun timer-sivulle navigoidaan
    // ja onLeave():a kun sivulta poistutaan
    window.PageModules = window.PageModules || {};
    window.PageModules.timer = {

        // Kutsutaan kun timer-sivulle saavutaan
        // HTML on jo ladattu tässä vaiheessa joten DOM-elementit löytyvät
        onEnter() {
            getEls(); // hae DOM-viitteet nyt kun HTML on varmasti paikallaan

            // Tarkista storagesta onko timer jo käynnissä taustalla
            // (esim. käyttäjä navigoi pois ja tuli takaisin)
            chrome.storage.local.get(['endTime', 'totalSeconds'], (data) => {
                if (data.endTime && data.totalSeconds) {
                    const remaining = Math.round((data.endTime - Date.now()) / 1000);
                    if (remaining > 0) {
                        // Timer pyörii edelleen — jatka siitä mihin jäätiin
                        endTime      = data.endTime;
                        totalSeconds = data.totalSeconds;
                        isRunning    = true;
                        elMinutes.value = Math.ceil(totalSeconds / 60); // näytä alkuperäinen aika kentässä
                        tick();
                        timerInterval = setInterval(tick, 500);
                        setUiState(remaining <= 10 ? 'danger' : 'running');
                    } else {
                        // Timer on jo loppunut taustalla (esim. selain oli kiinni)
                        finishTimer();
                    }
                }
                // Jos storagessa ei ole dataa → timer ei ole käynnissä, jätetään idle-tilaan
            });

            // Rekisteröi napit — addEventListener lisätään joka kerta onEnter:ssa
            // koska HTML ladataan uudelleen joka kerta kun sivulle tullaan
            elStart.addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
            elReset.addEventListener('click', resetTimer);
            // Enter-näppäin käynnistää timerin syöttökentästä
            elMinutes.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !isRunning) startTimer();
            });

            // Ala kuunnella background.js:n viestejä
            chrome.runtime.onMessage.addListener(onMessage);
        },

        // Kutsutaan kun timer-sivulta poistutaan (esim. palataan pääsivulle)
        onLeave() {
            // Pysäytä tick-silmukka muistin säästämiseksi —
            // mutta ÄLÄ peruuta alarmia koska timer jatkaa laskentaa taustalla!
            // Storage säilyy joten onEnter() osaa jatkaa oikeasta kohdasta
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false; // vain lokaalisti — storagessa tila säilyy

            // Lopeta viestin kuuntelu jottei finishTimer() kutsuta väärällä sivulla
            chrome.runtime.onMessage.removeListener(onMessage);
        }
    };
})();
