// Plateau run event system
import { CONSTANTS, NPC_PRINCES } from '../core/constants.js';
import { log, triggerNotification, startTitleFlash, stopTitleFlash, flashScreen } from '../core/utils.js';

export function spawnEvent(gameState) {
    const now = Date.now();
    gameState.state.activeRun = {
        id: Math.floor(Math.random() * 999),
        phase: 'WARNING',
        warnEndTime: now + 30000,
        difficulty: Math.random() > 0.5 ? 'Medium' : 'Hard',
        enemyPower: 50 + Math.floor(Math.random() * 100),
        participants: [],
        playerForces: null
    };

    document.getElementById('plateau-event-container').classList.remove('hidden');
    document.getElementById('screen-overlay').classList.add('warn-flash');
    setTimeout(() => document.getElementById('screen-overlay').classList.remove('warn-flash'), 2000);
    log(`SCOUT REPORT: Chasmfiend spotted! 30 seconds to muster.`, "text-orange-400 font-bold");

    triggerNotification("Plateau Run Detected!", "A Chasmfiend has been spotted. Muster your forces!");
    startTitleFlash();

    simulateNPCJoin(gameState, true);
}

export function simulateNPCJoin(gameState, force = false) {
    if (!gameState.state.activeRun) return;
    const availableNPCs = Object.values(NPC_PRINCES).filter(n =>
        !gameState.state.activeRun.participants.find(p => p.name === n.name)
    );
    if (availableNPCs.length === 0) return;

    const npc = availableNPCs[Math.floor(Math.random() * availableNPCs.length)];
    const npcSpeed = 1.0 + (npc.bridgecrews * 0.01);
    const npcCarry = npc.chulls * 10; // Only chulls provide carry
    gameState.state.activeRun.participants.push({
        name: npc.name,
        power: npc.power,
        speed: npcSpeed,
        carry: npcCarry,
        isPlayer: false
    });

    if (document.getElementById('muster-leaderboard')?.offsetParent !== null) {
        updateEventUI(gameState);
    }
}

export function resolveRun(gameState) {
    const run = gameState.state.activeRun;
    gameState.state.activeRun = null;
    document.getElementById('plateau-event-container').classList.add('hidden');
    document.getElementById('muster-leaderboard').classList.add('hidden');
    stopTitleFlash();

    const totalAlliedPower = run.participants.reduce((acc, p) => acc + p.power, 0);
    const victory = totalAlliedPower >= run.enemyPower;
    const sortedParticipants = run.participants.sort((a, b) => b.speed - a.speed);
    const gemheartWinner = sortedParticipants[0];

    const result = {
        victory: victory,
        totalPower: totalAlliedPower,
        enemyPower: run.enemyPower,
        gemheartWon: victory && gemheartWinner.isPlayer,
        gemheartWinnerName: victory ? gemheartWinner.name : null,
        lootShare: 0
    };

    if (victory && run.playerForces) {
        // Option 4: Gemheart winner gets fixed reward, losers split pool by power×carry
        if (result.gemheartWon) {
            // Winner gets gemheart + finder's fee
            result.lootShare = 5000;
        } else {
            // Losers split 50k consolation pool
            const CONSOLATION_POOL = 50000;
            const losers = run.participants.filter(p => p !== gemheartWinner);
            
            // Calculate weights (power × carry) for all losers
            let totalWeight = 0;
            let playerWeight = 0;
            
            for (let participant of losers) {
                const weight = participant.power * participant.carry;
                totalWeight += weight;
                if (participant.isPlayer) {
                    playerWeight = weight;
                }
            }
            
            // Player gets proportional share based on power×carry weight
            if (totalWeight > 0 && playerWeight > 0) {
                result.lootShare = Math.floor((playerWeight / totalWeight) * CONSOLATION_POOL);
            } else {
                // If no carry, get small consolation (5% of pool)
                result.lootShare = Math.floor(CONSOLATION_POOL * 0.05);
            }
        }
    }

    log("The Coalition has departed for the Plateau.", "text-slate-400 italic");

    if (run.playerForces) {
        const durationMs = 2 * CONSTANTS.DAY_MS;
        gameState.state.deployments.push({
            id: Date.now(),
            type: 'run',
            units: run.playerForces.units,
            returnTime: Date.now() + durationMs,
            runResult: result
        });
    } else {
        if (victory) log(`News: The Coalition defeated the Parshendi. ${gemheartWinner.name} took the Gemheart.`, "text-slate-500");
        else log(`News: The Coalition was defeated.`, "text-red-900");
    }
}

export function updateEventUI(gameState) {
    const run = gameState.state.activeRun;
    if (!run) return;
    const leaderboardEl = document.getElementById('leaderboard-content');
    if (leaderboardEl) {
        leaderboardEl.innerHTML = '';
        const sorted = [...run.participants].sort((a, b) => b.speed - a.speed);
        sorted.forEach((p, idx) => {
            const div = document.createElement('div');
            div.className = "flex justify-between text-[10px] text-slate-400";
            div.innerHTML = `<span>${idx + 1}. ${p.name}</span> <span class="text-orange-300 font-bold">${(p.speed * 100).toFixed(0)}% Speed</span>`;
            leaderboardEl.appendChild(div);
        });
    }
}
