// ===== Timer Page Module =====
window.PageModules = window.PageModules || {};

window.PageModules.timer = {
    // Kutsutaan kun sivu avataan
    onEnter() {
        this.init();
    },

    // Kutsutaan kun sivulta poistutaan
    onLeave() {
    },

    // Alustus - kutsutaan joka kerta kun sivu avataan (DOM ladataan uudelleen)
    init() {
        
        let timerInterval = null;
        let endTime       = null;
        let totalSeconds  = 0;
        let isRunning     = false;
        
        // ─── DOM-viitteet (haetaan onEnter:ssa kun HTML on ladattu) ──────────────
        let elDisplay, elTime, elSublabel, elProgress, elMinutes, elStart, elReset, elDone;
        
        function getEls() {
            elDisplay  = document.getElementById('t-display');
            elTime     = document.getElementById('t-time');
            elSublabel = document.getElementById('t-sublabel');
            elProgress = document.getElementById('t-progress');
            elMinutes  = document.getElementById('t-minutes');
            elStart    = document.getElementById('t-start');
            elReset    = document.getElementById('t-reset');
            elDone     = document.getElementById('t-done');
        }
        
        // ─── Apufunktiot ─────────────────────────────────────────────────────────
        function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        
        function setUiState(state) {
            // state: 'idle' | 'running' | 'danger' | 'done'
            elDisplay.className = `t-display ${state}`;
            elProgress.className = `t-progress-fill${state === 'danger' || state === 'done' ? ' danger' : ''}`;
            elDone.classList.toggle('visible', state === 'done');
        
            if (state === 'running' || state === 'danger') {
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pysäytä`;
            elMinutes.disabled = true;
            elSublabel.textContent = 'Aikaa jäljellä';
            } else if (state === 'done') {
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Uudelleen`;
            elMinutes.disabled = false;
            elSublabel.textContent = 'Aika loppui!';
            } else {
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Käynnistä`;
            elMinutes.disabled = false;
            elSublabel.textContent = 'Aseta aika';
            }
        }
        
        function updateProgress(remainingSeconds) {
            const pct = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 100;
            elProgress.style.width = `${pct}%`;
        }
        
        // ─── Timerin logiikka ────────────────────────────────────────────────────
        function tick() {
            const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            elTime.textContent = formatTime(remaining);
            updateProgress(remaining);
        
            if (remaining <= 0) { finishTimer(); return; }
            if (remaining <= 10) setUiState('danger');
        }
        
        function startTimer() {
            const minutes = parseInt(elMinutes.value, 10);
            if (!minutes || minutes < 1) { elMinutes.focus(); return; }
        
            totalSeconds = minutes * 60;
            endTime      = Date.now() + totalSeconds * 1000;
            isRunning    = true;
        
            chrome.storage.local.set({ endTime, totalSeconds });
            chrome.alarms.create('timerDone', { when: endTime });
        
            tick();
            timerInterval = setInterval(tick, 500);
            setUiState('running');
        }
        
        function pauseTimer() {
            clearInterval(timerInterval); timerInterval = null;
            isRunning = false;
            chrome.alarms.clear('timerDone');
            chrome.storage.local.remove(['endTime', 'totalSeconds']);
        
            const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            elTime.textContent = formatTime(remaining);
            setUiState('idle');
            elSublabel.textContent = 'Pysäytetty';
        }
        
        function finishTimer() {
            clearInterval(timerInterval); timerInterval = null;
            isRunning = false;
            elTime.textContent = '00:00';
            elProgress.style.width = '0%';
            chrome.storage.local.remove(['endTime', 'totalSeconds']);
            setUiState('done');
        }
        
        function resetTimer() {
            clearInterval(timerInterval); timerInterval = null;
            isRunning = false; endTime = null; totalSeconds = 0;
            chrome.alarms.clear('timerDone');
            chrome.storage.local.remove(['endTime', 'totalSeconds']);
            elTime.textContent = '00:00';
            elProgress.style.width = '100%';
            elMinutes.value = '';
            setUiState('idle');
        }
        
        // ─── Kuuntele background.js:n "TIMER_DONE" -viesti ───────────────────────
        function onMessage(msg) {
            if (msg.type === 'TIMER_DONE') finishTimer();
        }
        
        // ─── PageModule hooks ────────────────────────────────────────────────────
        window.PageModules = window.PageModules || {};
        window.PageModules.timer = {
        
            onEnter() {
            getEls();
        
            // Palauta tila storagesta jos timer pyörii taustalla
            chrome.storage.local.get(['endTime', 'totalSeconds'], (data) => {
                if (data.endTime && data.totalSeconds) {
                const remaining = Math.round((data.endTime - Date.now()) / 1000);
                if (remaining > 0) {
                    endTime      = data.endTime;
                    totalSeconds = data.totalSeconds;
                    isRunning    = true;
                    elMinutes.value = Math.ceil(totalSeconds / 60);
                    tick();
                    timerInterval = setInterval(tick, 500);
                    setUiState(remaining <= 10 ? 'danger' : 'running');
                } else {
                    finishTimer();
                }
                }
            });
        
            // Napit
            elStart.addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
            elReset.addEventListener('click', resetTimer);
            elMinutes.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !isRunning) startTimer();
            });
        
            // Kuuntele background-viestejä
            chrome.runtime.onMessage.addListener(onMessage);
            },
        
            onLeave() {
            // Pysäytä vain tick-intervalli, älä sammuta alarmia —
            // timer jatkaa laskentaa taustalla
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false; // lokaalisti, storage pysyy
            chrome.runtime.onMessage.removeListener(onMessage);
            }
        };
    
    }
};
