// ===== Timer Page Module =====
(function () {

    let timerInterval  = null;   // setInterval reference for the tick() loop
    let endTime        = null;   // timestamp (ms) when the timer ends
    let totalSeconds   = 0;      // total duration in seconds
    let pausedSeconds  = null;   // remaining seconds at pause time (null = not paused)
    let isRunning      = false;

    let elDisplay, elTime, elSublabel, elProgress, elMinutes, elStart, elReset, elDone;
    let elQuickBtns;             // array of the three quick-select buttons

    function getEls() {
        elDisplay   = document.getElementById('t-display');
        elTime      = document.getElementById('t-time');
        elSublabel  = document.getElementById('t-sublabel');
        elProgress  = document.getElementById('t-progress');
        elMinutes   = document.getElementById('t-minutes');
        elStart     = document.getElementById('t-start');
        elReset     = document.getElementById('t-reset');
        elDone      = document.getElementById('t-done');
        elQuickBtns = document.querySelectorAll('.t-btn-quick');
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Highlights the quick button matching the current totalSeconds, clears others
    function updateQuickActive() {
        elQuickBtns.forEach(btn => {
            const btnMinutes = parseInt(btn.dataset.minutes, 10);
            btn.classList.toggle('active', btnMinutes * 60 === totalSeconds);
        });
    }

    // Disables or enables the quick-select buttons
    function setQuickDisabled(disabled) {
        elQuickBtns.forEach(btn => { btn.disabled = disabled; });
    }

    function setUiState(state) {
        elDisplay.className  = `t-display ${state}`;
        elProgress.className = `t-progress-fill${state === 'danger' || state === 'done' ? ' danger' : ''}`;
        elDone.classList.toggle('visible', state === 'done');

        if (state === 'running' || state === 'danger') {
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
            elMinutes.disabled = true;
            elSublabel.textContent = 'Time remaining';
            setQuickDisabled(true);
        } else if (state === 'paused') {
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Resume`;
            elMinutes.disabled = true;
            elSublabel.textContent = 'Paused';
            setQuickDisabled(true);   // can't change duration mid-session
        } else if (state === 'done') {
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Start again`;
            elMinutes.disabled = false;
            elSublabel.textContent = "Time's up!";
            setQuickDisabled(false);
        } else {
            // idle
            elStart.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Start`;
            elMinutes.disabled = false;
            elSublabel.textContent = 'Set duration';
            setQuickDisabled(false);
        }
    }

    function updateProgress(remainingSeconds) {
        const pct = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 100;
        elProgress.style.width = `${pct}%`;
    }

    function tick() {
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        elTime.textContent = formatTime(remaining);
        updateProgress(remaining);
        if (remaining <= 0) { finishTimer(); return; }
        if (remaining <= 10) setUiState('danger');
    }

    function startTimer() {
        let seconds;

        if (pausedSeconds !== null) {
            // Resume from where we left off
            seconds = pausedSeconds;
            pausedSeconds = null;
        } else {
            // Fresh start — read from input field
            const minutes = parseInt(elMinutes.value, 10);
            if (!minutes || minutes < 1) { elMinutes.focus(); return; }
            seconds = minutes * 60;
            totalSeconds = seconds;
            updateQuickActive(); // highlight matching quick button if any
        }

        endTime   = Date.now() + seconds * 1000;
        isRunning = true;

        chrome.storage.local.set({ endTime, totalSeconds });
        chrome.alarms.create('timerDone', { when: endTime });

        tick();
        timerInterval = setInterval(tick, 500);
        setUiState('running');
    }

    function pauseTimer() {
        clearInterval(timerInterval); timerInterval = null;
        isRunning = false;

        // Save remaining time so startTimer() can resume from here
        pausedSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));

        chrome.alarms.clear('timerDone');
        chrome.storage.local.remove(['endTime', 'totalSeconds']);

        elTime.textContent = formatTime(pausedSeconds);
        updateProgress(pausedSeconds);
        setUiState('paused');
    }

    function finishTimer() {
        clearInterval(timerInterval); timerInterval = null;
        isRunning     = false;
        pausedSeconds = null;
        elTime.textContent = '00:00';
        elProgress.style.width = '0%';
        chrome.storage.local.remove(['endTime', 'totalSeconds']);
        setUiState('done');
    }

    function resetTimer() {
        clearInterval(timerInterval); timerInterval = null;
        isRunning     = false;
        pausedSeconds = null;
        endTime       = null;
        totalSeconds  = 0;
        chrome.alarms.clear('timerDone');
        chrome.storage.local.remove(['endTime', 'totalSeconds']);
        elTime.textContent = '00:00';
        elProgress.style.width = '100%';
        elMinutes.value = '';
        elQuickBtns.forEach(btn => btn.classList.remove('active'));
        setUiState('idle');
    }

    // Sets the input field to the chosen minutes and highlights the button
    function applyQuickSelect(minutes) {
        elMinutes.value = minutes;
        totalSeconds = minutes * 60;
        updateQuickActive();
    }

    function onMessage(msg) {
        if (msg.type === 'TIMER_DONE') finishTimer();
    }

    window.PageModules = window.PageModules || {};
    window.PageModules.timer = {

        onEnter() {
            getEls();

            // Restore state if timer is already running in the background
            chrome.storage.local.get(['endTime', 'totalSeconds'], (data) => {
                if (data.endTime && data.totalSeconds) {
                    const remaining = Math.round((data.endTime - Date.now()) / 1000);
                    if (remaining > 0) {
                        endTime      = data.endTime;
                        totalSeconds = data.totalSeconds;
                        isRunning    = true;
                        elMinutes.value = Math.ceil(totalSeconds / 60);
                        updateQuickActive();
                        tick();
                        timerInterval = setInterval(tick, 500);
                        setUiState(remaining <= 10 ? 'danger' : 'running');
                    } else {
                        finishTimer();
                    }
                }
            });

            // Quick-select buttons: fill the input and highlight the chosen button
            elQuickBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    applyQuickSelect(parseInt(btn.dataset.minutes, 10));
                });
            });

            elStart.addEventListener('click', () => {
                if (isRunning) {
                    pauseTimer();
                } else {
                    startTimer();
                }
            });

            elReset.addEventListener('click', resetTimer);

            elMinutes.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !isRunning && pausedSeconds === null) startTimer();
            });

            // Clear quick-button highlight when user types a custom value
            elMinutes.addEventListener('input', () => {
                elQuickBtns.forEach(btn => btn.classList.remove('active'));
            });

            chrome.runtime.onMessage.addListener(onMessage);
        },

        onLeave() {
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false;
            // pausedSeconds is kept in memory so resuming works if user comes back
            chrome.runtime.onMessage.removeListener(onMessage);
        }
    };
})();
