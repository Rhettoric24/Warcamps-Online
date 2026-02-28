// Utility functions for logging, notifications, and effects

export function log(msg, color = 'text-slate-200') {
    const logEl = document.getElementById('game-log');
    if (logEl) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${color}`;
        entry.innerHTML = msg;
        logEl.prepend(entry);
    }
}

export function triggerNotification(title, body) {
    const disabled = localStorage.getItem('notificationsDisabled') === 'true';
    if (Notification.permission === "granted" && !disabled) {
        new Notification(title, { body: body });
    }
    playAlarm();
}

export function playAlarm() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.value = 440;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
}

export function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications");
        return;
    }
    
    // If already granted or denied, toggle state in localStorage
    if (Notification.permission === "granted") {
        const disabled = localStorage.getItem('notificationsDisabled') === 'true';
        localStorage.setItem('notificationsDisabled', disabled ? 'false' : 'true');
        if (disabled) {
            log("Notifications enabled!", "text-green-400");
        } else {
            log("Notifications disabled.", "text-slate-400");
        }
        updateNotificationButton();
    } else if (Notification.permission === "denied") {
        // Can't re-enable if denied by browser
        alert("Notifications are blocked by your browser. Check your browser settings.");
    } else {
        // Ask for permission
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                localStorage.setItem('notificationsDisabled', 'false');
                log("Notifications enabled!", "text-green-400");
                new Notification("Warcamp Command", { body: "Notifications are now active." });
            }
            updateNotificationButton();
        });
    }
}

export function updateNotificationButton() {
    const btn = document.getElementById('btn-notifications');
    if (!btn) return;

    const disabled = localStorage.getItem('notificationsDisabled') === 'true';

    if (Notification.permission === "granted" && !disabled) {
        btn.className = "text-xs bg-green-900/40 hover:bg-red-900/40 text-green-400 hover:text-red-400 border border-green-700 px-2 py-1 rounded transition-colors cursor-pointer font-bold";
        btn.innerHTML = "🔔 On";
        btn.title = "Click to disable notifications";
    } else if (Notification.permission === "granted" && disabled) {
        btn.className = "text-xs bg-red-900/40 hover:bg-green-900/40 text-red-400 hover:text-green-400 border border-red-700 px-2 py-1 rounded transition-colors cursor-pointer font-bold";
        btn.innerHTML = "🔕 Off";
        btn.title = "Click to enable notifications";
    } else if (Notification.permission === "denied") {
        btn.className = "text-xs bg-red-900/40 text-red-400 border border-red-700 px-2 py-1 rounded transition-colors cursor-not-allowed font-bold";
        btn.innerHTML = "🔕 Blocked";
        btn.title = "Notifications blocked by browser";
    } else {
        btn.className = "text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-2 py-1 rounded transition-colors cursor-pointer font-bold";
        btn.innerHTML = "🔔 Alerts";
        btn.title = "Enable Desktop Alerts";
    }
}

export function startTitleFlash() {
    if (window.titleInterval) return;
    let state = false;
    window.titleInterval = setInterval(() => {
        document.title = state ? "⚠️ PLATEAU RUN! ⚠️" : "Highprince: Warcamp Sim";
        state = !state;
    }, 1000);
}

export function stopTitleFlash() {
    if (window.titleInterval) {
        clearInterval(window.titleInterval);
        window.titleInterval = null;
        document.title = "Highprince: Warcamp Sim";
    }
}

export function formatTime(ms) {
    const totalSecs = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    } else if (mins > 0) {
        return `${mins}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

export function flashScreen(type = 'warn') {
    const screen = document.getElementById('screen-overlay');
    const className = type === 'alert' ? 'alert-flash' : 'warn-flash';
    screen.classList.add(className);
    setTimeout(() => screen.classList.remove(className), 4000);
}
