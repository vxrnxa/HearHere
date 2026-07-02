/* =========================================================
   HearHere - Prototype logic
   Organized into sections:
   1. State / element references
   2. UI state switching (landing / syncing / playback)
   3. Creator (CMS) role switching + file upload
   4. Server time calibration
   5. Sync math (perfect-sync playback position)
   6. Demo start / sync sequence
   7. Playback controls (play/pause, volume, hardware nudge)
   ========================================================= */

/* ---------- 1. State / element references ---------- */

const audio = new Audio();
audio.volume = 0.8;

let serverOffset = 0;
let isCalibrated = false;
let manualNudge = 0;
let currentRuntimeTrackName = "Labisi - Ife";
let localAudioUrl = null;

let timeIntervalInstance = null;
let progressIntervalInstance = null;

const states = {
    landing: document.getElementById('state-landing'),
    syncing: document.getElementById('state-syncing'),
    playback: document.getElementById('state-playback')
};

const syncTimeDisplay = document.getElementById('syncTime');
const syncProgress = document.getElementById('syncProgress');
const syncStatusBtn = document.getElementById('syncStatusBtn');
const loadingStatusText = document.getElementById('loadingStatusText');
const finalSyncLabel = document.getElementById('finalSyncLabel');
const latencyDisplay = document.getElementById('latencyDisplay');
const trackNameDisplay = document.getElementById('trackNameDisplay');
const playBtn = document.getElementById('playBtn');
const volumeBar = document.getElementById('volumeBar');
const nudgeDisplay = document.getElementById('nudgeDisplay');
const nudgeBtns = document.querySelectorAll('.nudge-btn');
const waveformContainer = document.getElementById('waveformContainer');
const startDemoBtn = document.getElementById('startDemoBtn');

/* ---------- 2. UI state switching ---------- */

function setUIState(newState) {
    Object.values(states).forEach(state => state.classList.remove('active'));
    states[newState].classList.add('active');
}

/* ---------- 3. Creator (CMS) role switching + upload ---------- */

async function switchSystemRole(role) {
    const audBtn = document.getElementById('btnViewAudience');
    const creBtn = document.getElementById('btnViewCreator');
    const creatorScreen = document.getElementById('state-creator');
    const indicatorText = document.getElementById('roleContextIndicator');

    if (role === 'creator') {
        const username = prompt("Enter Administrator Username:");
        if (username !== "hbk.saar") {
            alert("Access Denied: Invalid Administrative Identity.");
            return;
        }

        const password = prompt("Enter Administrative Password:");
        if (!password) return;

        if (password !== "FacadeLive2026!") {
            alert("Access Denied: Security Signature Mismatch.");
            return;
        }

        audBtn.classList.remove('active');
        creBtn.classList.add('active');
        creatorScreen.classList.add('active');
        indicatorText.textContent = "CMS / Upload Node";
    } else {
        creBtn.classList.remove('active');
        audBtn.classList.add('active');
        creatorScreen.classList.remove('active');
        indicatorText.textContent = "HBK facade";
    }
}

function processLocalCreatorTrack(event) {
    const file = event.target.files[0];
    const badge = document.getElementById('uploadStatusLabel');
    if (!file) return;

    // Revoke old object URL if it exists to free up browser memory
    if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
    }

    // Create an optimal data stream link directly from client storage (handles any file size safely)
    localAudioUrl = URL.createObjectURL(file);
    audio.src = localAudioUrl;

    // Compute file size in MB for UI clarity
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    currentRuntimeTrackName = document.getElementById('creatorTrackTitle').value || file.name;

    badge.innerHTML = `✔ Active MP3 Source:<br>${file.name} (${sizeInMB} MB)`;
    badge.style.display = "block";

    // Enforce system reset to safely process the updated tracking track details
    audio.pause();
    if (waveformContainer) waveformContainer.classList.remove('playing');
    playBtn.textContent = '▶️';
}

/* ---------- 4. Server time calibration ---------- */

async function calibrateWithServer() {
    let bestOffset = 0;
    let lowestLatency = Infinity;
    const pingCount = 4;

    try {
        for (let i = 0; i < pingCount; i++) {
            const start = performance.now();
            const response = await fetch(`https://worldtimeapi.org/api/timezone/Etc/UTC?nocache=${Math.random()}`);
            const data = await response.json();
            const end = performance.now();

            const rtt = end - start;

            if (rtt < lowestLatency) {
                lowestLatency = rtt;
                const networkDelay = rtt / 2;
                const serverMs = new Date(data.utc_datetime).getTime();
                bestOffset = serverMs - (Date.now() - networkDelay);
            }
        }

        serverOffset = bestOffset;
        isCalibrated = true;
        latencyDisplay.textContent = `-${Math.round(lowestLatency / 2)}ms`;
        console.log(`Sync calibrated. Server Offset: ${serverOffset}ms`);

    } catch (e) {
        console.error("Sync failed.", e);
        latencyDisplay.textContent = `Fallback`;
    }
}

/* ---------- 5. Sync math ---------- */

function getPerfectSyncTime(durationSeconds) {
    if (!durationSeconds || isNaN(durationSeconds)) return 0;
    const exactNow = Date.now() + serverOffset + manualNudge;
    const syncedDate = new Date(exactNow);
    const midnight = new Date(Date.UTC(syncedDate.getUTCFullYear(), syncedDate.getUTCMonth(), syncedDate.getUTCDate(), 0, 0, 0));

    const msElapsedToday = exactNow - midnight.getTime();
    const durationMs = durationSeconds * 1000;

    return (msElapsedToday % durationMs) / 1000;
}

/* ---------- 6. Demo start / sync sequence ---------- */

function triggerManualResync() {
    calibrateWithServer();
    simulateSyncProcess(currentRuntimeTrackName);
}

function simulateSyncProcess(trackName) {
    clearInterval(timeIntervalInstance);
    clearInterval(progressIntervalInstance);

    syncProgress.style.width = `0%`;
    syncStatusBtn.textContent = "Syncing...";
    syncStatusBtn.style.background = "";
    syncStatusBtn.classList.add('btn-sync');
    finalSyncLabel.textContent = "";

    let progress = 0;
    timeIntervalInstance = setInterval(() => {
        const exactNow = Date.now() + serverOffset;
        const now = new Date(exactNow);
        syncTimeDisplay.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    }, 20);

    progressIntervalInstance = setInterval(() => {
        progress += 2.5;
        syncProgress.style.width = `${progress}%`;

        if (progress >= 100) {
            clearInterval(progressIntervalInstance);
            clearInterval(timeIntervalInstance);
            onSyncComplete(trackName);
        }
    }, 100);
}

function onSyncComplete(trackName) {
    syncStatusBtn.textContent = "Sync Complete!";
    syncStatusBtn.style.color = "var(--text-main)";
    syncStatusBtn.classList.remove('btn-sync');
    syncStatusBtn.style.background = "rgba(74, 222, 128, 0.2)";
    finalSyncLabel.textContent = "Ready!";

    setTimeout(() => {
        setUIState('playback');
        trackNameDisplay.innerHTML = `${trackName}<br> Watch the projection.`;

        if (!isNaN(audio.duration) && audio.duration > 0) {
            audio.currentTime = getPerfectSyncTime(audio.duration);
        } else {
            audio.addEventListener('loadedmetadata', () => {
                audio.currentTime = getPerfectSyncTime(audio.duration);
            }, { once: true });
        }
    }, 1500);
}

/* ---------- 7. Playback controls ---------- */

function startSyncedPlayback() {
    const jumpTo = getPerfectSyncTime(audio.duration);
    audio.currentTime = jumpTo;
    audio.play().catch(e => console.log("Playback blocked:", e));

    if (waveformContainer) waveformContainer.classList.add('playing');
    playBtn.textContent = '⏸️';
}

let nudgeTimeout;

function initEventListeners() {
    startDemoBtn.addEventListener('click', function () {
        if (!audio.src) {
            audio.src = "https://files.cvaultx.com/wp-content/uploads/music/2024/11/Labisi_-_Ife_CeeNaija.com_.mp3";
        }

        audio.muted = true;
        audio.play().then(() => {
            audio.pause();
            audio.muted = false;
        }).catch(err => console.log("Audio unlock failed:", err));

        setUIState('syncing');
        simulateSyncProcess(currentRuntimeTrackName);
    });

    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            startSyncedPlayback();
        } else {
            audio.pause();
            if (waveformContainer) waveformContainer.classList.remove('playing');
            playBtn.textContent = '▶️';
        }
    });

    audio.addEventListener('ended', () => {
        startSyncedPlayback();
    });

    volumeBar.addEventListener('input', () => {
        audio.volume = volumeBar.value / 100;
    });

    nudgeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const change = parseInt(btn.getAttribute('data-val'));
            manualNudge += change;

            nudgeDisplay.textContent = `${manualNudge > 0 ? '+' : ''}${manualNudge}ms`;

            if (!audio.paused && !isNaN(audio.duration) && audio.duration > 0) {
                clearTimeout(nudgeTimeout);

                const targetTime = getPerfectSyncTime(audio.duration);
                let diff = targetTime - audio.currentTime;

                if (diff > audio.duration / 2) diff -= audio.duration;
                if (diff < -audio.duration / 2) diff += audio.duration;

                try {
                    if (Math.abs(diff) > 1.0) {
                        audio.currentTime = targetTime;
                        audio.playbackRate = 1.0;
                    } else if (diff > 0.01) {
                        audio.playbackRate = 1.25;
                        const bendDurationMs = (diff / 0.25) * 1000;
                        nudgeTimeout = setTimeout(() => { audio.playbackRate = 1.0; }, bendDurationMs);
                    } else if (diff < -0.01) {
                        audio.playbackRate = 0.75;
                        const bendDurationMs = (Math.abs(diff) / 0.25) * 1000;
                        nudgeTimeout = setTimeout(() => { audio.playbackRate = 1.0; }, bendDurationMs);
                    }
                } catch (err) {
                    console.warn("Playback rate adjustment rejected by browser engine:", err);
                }
            }
        });
    });
}

/* ---------- Init ---------- */

initEventListeners();
calibrateWithServer();
