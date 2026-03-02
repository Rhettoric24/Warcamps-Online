// Modal management for system-specific pop-out windows
import { loadPlayerMessages } from './ui-manager.js';

const modals = {
    build: document.getElementById('build-modal'),
    spy: document.getElementById('spy-modal'),
    spy_planning: document.getElementById('spy-planning-modal'),
    offline_recap: document.getElementById('offline-recap-modal'),
    fabrial: document.getElementById('fabrial-modal'),
    arena: document.getElementById('arena-modal'),
    deploy: document.getElementById('deploy-modal'),
    spanreed: document.getElementById('spanreed-modal')
};

// Dynamically add player-profile modal when it's available
if (typeof document !== 'undefined') {
    const playerProfileModal = document.getElementById('player-profile-modal');
    if (playerProfileModal) {
        modals['player-profile'] = playerProfileModal;
    }
}

export function openModal(system) {
    closeAllModals();
    if (modals[system]) {
        modals[system].classList.add('open');
    }
}

export function closeModal(specificModal = null) {
    if (specificModal && modals[specificModal]) {
        modals[specificModal].classList.remove('open');
    } else {
        closeAllModals();
    }
}

export function openSpyPlanningModal() {
    if (modals.spy_planning) modals.spy_planning.classList.add('open');
}

export function closeSpyPlanningModal() {
    if (modals.spy_planning) modals.spy_planning.classList.remove('open');
}

export function openOfflineRecapModal() {
    closeAllModals();
    if (modals.offline_recap) modals.offline_recap.classList.add('open');
}

export function closeOfflineRecapModal() {
    if (modals.offline_recap) modals.offline_recap.classList.remove('open');
}

function closeAllModals() {
    Object.values(modals).forEach(modal => {
        if (modal) modal.classList.remove('open');
    });
}

export function updateModalStats(statsObj) {
    // Update arena modal stats
    if (statsObj.arenaLevel !== undefined) {
        const elem = document.getElementById('arena-level-modal');
        if (elem) elem.textContent = statsObj.arenaLevel;
    }
    if (statsObj.arenaHP !== undefined) {
        const elem = document.getElementById('arena-hp-modal');
        if (elem) elem.textContent = statsObj.arenaHP;
    }
    if (statsObj.arenaThrill !== undefined) {
        const elem = document.getElementById('arena-thrill-modal');
        if (elem) elem.textContent = statsObj.arenaThrill;
    }

    // Update fabrial modal counts
    if (statsObj.heatrialOwned !== undefined) {
        const elem = document.getElementById('owned-heatrial-modal');
        if (elem) elem.textContent = statsObj.heatrialOwned;
    }
    if (statsObj.ledgerOwned !== undefined) {
        const elem = document.getElementById('owned-ledger-modal');
        if (elem) elem.textContent = statsObj.ledgerOwned;
    }
    if (statsObj.gravityLiftOwned !== undefined) {
        const elem = document.getElementById('owned-gravity_lift-modal');
        if (elem) elem.textContent = statsObj.gravityLiftOwned;
    }
    if (statsObj.regenPlateOwned !== undefined) {
        const elem = document.getElementById('owned-regen_plate-modal');
        if (elem) elem.textContent = statsObj.regenPlateOwned;
    }
    if (statsObj.thrillAmpOwned !== undefined) {
        const elem = document.getElementById('owned-thrill_amp-modal');
        if (elem) elem.textContent = statsObj.thrillAmpOwned;
    }
    if (statsObj.halfShardOwned !== undefined) {
        const elem = document.getElementById('owned-half_shard-modal');
        if (elem) elem.textContent = statsObj.halfShardOwned;
    }

    // Update building modal counts
    if (statsObj.buildingCounts) {
        for (const [building, count] of Object.entries(statsObj.buildingCounts)) {
            const elem = document.getElementById(`modal-own-${building}`);
            if (elem) elem.textContent = count;
        }
    }

    // Update unit modal counts
    if (statsObj.unitCounts) {
        for (const [unit, count] of Object.entries(statsObj.unitCounts)) {
            const elem = document.getElementById(`modal-own-${unit}`);
            if (elem) elem.textContent = count;
        }
    }
}

export function updateSpyNetwork(unlocked) {
    const section = document.getElementById('spy-recruit-section');
    const locked = document.getElementById('spy-recruit-locked');
    if (section) section.classList.toggle('hidden', !unlocked);
    if (locked) locked.classList.toggle('hidden', unlocked);
}

export function toggleTournamentCard(isActive) {
    const card = document.getElementById('tournament-card');
    if (card) card.classList.toggle('hidden', !isActive);
}

export function toggleBlackMarket(isUnlocked) {
    const section = document.getElementById('black-market-section');
    if (section) section.classList.toggle('hidden', !isUnlocked);
}

export function closeRecapModal() {
    const modal = document.getElementById('duel-recap-modal');
    if (modal) modal.classList.remove('show');
}

export function closeMissionModal(type) {
    const modalMap = {
        'scout': 'scout-result-modal',
        'attack': 'attack-result-modal',
        'plateau': 'plateau-result-modal',
        'espionage': 'espionage-result-modal',
        'conquest': 'conquest-result-modal'
    };
    const modalId = modalMap[type];
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
}

// Close modals on background click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeAllModals();
    }
});

// Close recap modal on background click
document.addEventListener('click', (e) => {
    if (e.target.id === 'duel-recap-modal') {
        closeRecapModal();
    }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});

// Sync spy target selectors between modal and tab
const spyTargetModal = document.getElementById('spy-target-modal');
const spyTargetTab = document.getElementById('spy-target');

if (spyTargetModal && spyTargetTab) {
    spyTargetModal.addEventListener('change', () => {
        spyTargetTab.value = spyTargetModal.value;
    });
    spyTargetTab.addEventListener('change', () => {
        spyTargetModal.value = spyTargetTab.value;
    });
}
// Spanreed Center Modal Management
export function openSpanreedModal() {
    const modal = document.getElementById('spanreed-modal');
    if (modal) {
        modal.classList.add('open');
        setSpanreedTab('reports'); // Default to reports tab
    }
}

export function closeSpanreedModal() {
    const modal = document.getElementById('spanreed-modal');
    if (modal) modal.classList.remove('open');
}

export function setSpanreedTab(tabName) {
    // Update tab buttons
    const reportsBtn = document.getElementById('spanreed-tab-reports');
    const messagesBtn = document.getElementById('spanreed-tab-messages');
    
    if (tabName === 'reports') {
        if (reportsBtn) {
            reportsBtn.classList.add('border-cyan-500', 'text-cyan-300');
            reportsBtn.classList.remove('border-transparent', 'text-slate-400');
        }
        if (messagesBtn) {
            messagesBtn.classList.remove('border-cyan-500', 'text-cyan-300');
            messagesBtn.classList.add('border-transparent', 'text-slate-400');
        }
    } else {
        if (messagesBtn) {
            messagesBtn.classList.add('border-cyan-500', 'text-cyan-300');
            messagesBtn.classList.remove('border-transparent', 'text-slate-400');
        }
        if (reportsBtn) {
            reportsBtn.classList.remove('border-cyan-500', 'text-cyan-300');
            reportsBtn.classList.add('border-transparent', 'text-slate-400');
        }
    }
    
    // Update content visibility
    const reportsContent = document.getElementById('spanreed-content-reports');
    const messagesContent = document.getElementById('spanreed-content-messages');
    
    if (reportsContent) reportsContent.classList.toggle('hidden', tabName !== 'reports');
    if (messagesContent) messagesContent.classList.toggle('hidden', tabName !== 'messages');
    
    // Load messages when switching to messages tab
    if (tabName === 'messages') {
        loadPlayerMessages();
    }
}