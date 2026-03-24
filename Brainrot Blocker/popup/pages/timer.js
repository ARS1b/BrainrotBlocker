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
        // ─── DOM ────────────────────────────────────────────────────────────────────
        const timeDisplay  = document.getElementById('timeDisplay');
        const displayLabel = document.getElementById('displayLabel');
        const minutesInput = document.getElementById('minutesInput');
        const startBtn     = document.getElementById('startBtn');
        const resetBtn     = document.getElementById('resetBtn');
        const display      = document.getElementById('display');
        const statusDot    = document.getElementById('statusDot');
        const progressFill = document.getElementById('progressFill');
        const doneBanner   = document.getElementById('doneBanner');
        
        // ─── State ──────────────────────────────────────────────────────────────────
        let timerInterval = null;
        let endTime       = null;   // ms timestamp when timer ends
        let totalSeconds  = 0;      // total duration in seconds
        let isRunning     = false;
        
        // ─── Helpers ─────────────────────────────────────────────────────────────────
        function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        
        function setUiState(state) {
        // state: 'idle' | 'running' | 'danger' | 'done'
        display.className    = `display ${state}`;
        statusDot.className  = `dot ${state === 'idle' ? 'idle' : state === 'done' || state === 'danger' ? 'danger' : ''}`;
        progressFill.className = `progress-fill ${state === 'danger' || state === 'done' ? 'danger' : ''}`;
        
        doneBanner.classList.toggle('visible', state === 'done');
        
        if (state === 'running' || state === 'danger') {
            startBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pysäytä`;
            minutesInput.disabled = true;
            displayLabel.textContent = 'Aikaa jäljellä';
        } else if (state === 'done') {
            startBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Uudelleen`;
            minutesInput.disabled = false;
            displayLabel.textContent = 'Aika loppui!';
        } else {
            startBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Käynnistä`;
            minutesInput.disabled = false;
            displayLabel.textContent = 'Aseta aika';
        }
        }
        
        function updateProgress(remainingSeconds) {
        const pct = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 100;
        progressFill.style.width = `${pct}%`;
        }

        
        // ─── Timer logic ─────────────────────────────────────────────────────────────
        function tick() {
        const now       = Date.now();
        const remaining = Math.max(0, Math.round((endTime - now) / 1000));
        
        timeDisplay.textContent = formatTime(remaining);
        updateProgress(remaining);
        
        if (remaining <= 0) {
            finishTimer();
            return;
        }
        
        // Switch to danger mode in last 10 seconds
        if (remaining <= 10) {
            setUiState('danger');
        }

        }
        
        function startTimer() {
        const minutes = parseInt(minutesInput.value, 10);
        if (!minutes || minutes < 1) {
            minutesInput.focus();
            return;
        }

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
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;

        chrome.alarms.clear('timerDone');
        chrome.storage.local.remove(['endTime', 'totalSeconds']);
        
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        timeDisplay.textContent = formatTime(remaining);
        setUiState('idle');
        displayLabel.textContent = 'Pysäytetty';
        }
        
        function finishTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;

        timeDisplay.textContent = '00:00';
        progressFill.style.width = '0%';
        setUiState('done');
        
        chrome.storage.local.remove(['endTime', 'totalSeconds']);
        }
        
        function resetTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;

        endTime = null;
        totalSeconds = 0;
        
        chrome.alarms.clear('timerDone');
        chrome.storage.local.remove(['endTime', 'totalSeconds']);
        
        timeDisplay.textContent = '00:00';
        progressFill.style.width = '100%';
        minutesInput.value = '';
        setUiState('idle');
        }
        
        // ─── Restore state when popup reopens ────────────────────────────────────────
        chrome.storage.local.get(['endTime', 'totalSeconds'], (data) => {
        if (data.endTime && data.totalSeconds) {
            const remaining = Math.round((data.endTime - Date.now()) / 1000);
            if (remaining > 0) {
            endTime      = data.endTime;
            totalSeconds = data.totalSeconds;
            isRunning    = true;
            const mins   = Math.ceil(totalSeconds / 60);
            minutesInput.value = mins;
            tick();
            timerInterval = setInterval(tick, 500);
            setUiState(remaining <= 10 ? 'danger' : 'running');
            } else {
            // Timer already finished while popup was closed
            finishTimer();
            }
        }
        });
        
        // ─── Listen for "done" message from background ───────────────────────────────
        chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'TIMER_DONE') {
            finishTimer();
        }
        });
        
        // ─── Event listeners ─────────────────────────────────────────────────────────
        startBtn.addEventListener('click', () => {
        if (isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
        });
        
        resetBtn.addEventListener('click', resetTimer);
        
        minutesInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !isRunning) startTimer();
        });
    }
};
