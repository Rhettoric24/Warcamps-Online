// Plateau run event system
import { CONSTANTS, NPC_PRINCES } from '../core/constants.js';
import { log, triggerNotification, startTitleFlash, stopTitleFlash, flashScreen } from '../core/utils.js';
import { getCurrentGameTime } from '../core/server-api.js';

/**
 * Calculate enemy power based on game year
 * Base: 300 power in year 1
 * Scales by 15% per year
 */
function calculateEnemyPower(gameYear) {
    const year = Math.max(1, gameYear || 1);
    const base = 300;
    const scaled = base * Math.pow(1.15, year - 1);
    return Math.floor(scaled);
}

/**
 * Apply speed bonus based on sign-up order
 * 1st: +5%, 2nd: +4%, 3rd: +3%, etc.
 * Minimum 0% (floor at base speed)
 */
function getSignupOrderBonus(signupIndex) {
    // signupIndex is 0-based, so 1st player = index 0
    const maxBonus = 5;
    const bonus = Math.max(0, maxBonus - signupIndex);
    return bonus / 100; // Convert to decimal (e.g., 5% = 0.05)
}

/**
 * Calculate speed for a participant
 * Base speed from bridgemen + carry bonus, plus sign-up order bonus
 */
function calculateParticipantSpeed(bridgemen, chulls, signupIndex) {
    // Base speed: 1.0 + (bridgemen * 0.01)
    const baseSpeed = 1.0 + (bridgemen * 0.01);
    
    // Carry bonus: chulls contribute to speed (1 chull = 0.05 speed)
    const carryBonus = chulls * 0.05;
    
    // Sign-up order bonus
    const signupBonus = getSignupOrderBonus(signupIndex);
    
    // Total speed
    const totalSpeed = baseSpeed + carryBonus + signupBonus;
    
    return totalSpeed;
}

export function spawnEvent(gameState) {
    const now = Date.now(); // Use real-time for plateau runs
    
    // Calculate game year from day count
    const dayCount = gameState.state.dayCount || 0;
    const gameYear = Math.floor(dayCount / 7) + 1;
    
    const enemyPower = calculateEnemyPower(gameYear);
    
    gameState.state.activeRun = {
        id: Math.floor(Math.random() * 999),
        phase: 'WARNING',
        warningStartTime: now,
        warningEndTime: now + (5 * 60 * 1000), // 5 minutes real time
        musterStartTime: now + (5 * 60 * 1000),
        musterEndTime: now + (65 * 60 * 1000), // 5 min warning + 60 min muster = 65 minutes total
        difficulty: Math.random() > 0.5 ? 'Medium' : 'Hard',
        enemyPower: enemyPower,
        participants: [],
        signedUpPlayers: [], // Track players by sign-up order with millisecond timestamps
        playerForces: null,
        gameYear: gameYear
    };

    document.getElementById('plateau-event-container').classList.remove('hidden');
    document.getElementById('screen-overlay').classList.add('warn-flash');
    setTimeout(() => document.getElementById('screen-overlay').classList.remove('warn-flash'), 2000);
    log(`⚠️ SCOUT REPORT: Chasmfiend spotted! 5 minutes to prepare. ⚠️`, "text-orange-400 font-bold text-lg");

    triggerNotification("Plateau Run Detected!", "A Chasmfiend has been spotted. You have 5 minutes to prepare!");
    startTitleFlash();

    // NPCs join during warning phase
    simulateNPCJoin(gameState, true);
    updateEventUI(gameState);
}

/**
 * Player signs up for the plateau run
 * Tracks sign-up order by millisecond
 */
export function playerJoinRun(gameState) {
    if (!gameState.state.activeRun) {
        log("No plateau run active.", "text-yellow-400");
        return false;
    }

    const run = gameState.state.activeRun;
    
    // Check if player already signed up
    if (run.signedUpPlayers.find(p => p.username === gameState.username)) {
        log("You've already signed up for this plateau run!", "text-yellow-400");
        return false;
    }

    // Check if muster phase has started
    if (Date.now() < run.musterStartTime) {
        log("Muster phase hasn't started yet. Wait for the signal!", "text-yellow-400");
        return false;
    }

    // Check if muster phase has ended
    if (Date.now() >= run.musterEndTime) {
        log("The coalition has already departed!", "text-red-400");
        return false;
    }

    // Calculate player power from military units
    const military = gameState.state.military;
    const totalPower = (military.knights || 0) * 5 + 
                       (military.crossbowmen || 0) * 4 + 
                       (military.rangers || 0) * 3 + 
                       (military.cavalry || 0) * 8 +
                       (military.bridgecrews || 0) * 1;

    // Sign up the player with timestamp
    const signupIndex = run.signedUpPlayers.length;
    const bridgemen = gameState.state.military.bridgecrews || 0;
    const chulls = gameState.state.military.chulls || 0;
    const speed = calculateParticipantSpeed(bridgemen, chulls, signupIndex);
    const carry = chulls * 10; // Only chulls provide carry

    run.signedUpPlayers.push({
        username: gameState.username,
        signupTime: Date.now(),
        signupIndex: signupIndex,
        bridgemen: bridgemen,
        chulls: chulls,
        power: totalPower,
        military: JSON.parse(JSON.stringify(military)) // Store military snapshot for deployment
    });

    // Add to participants array
    run.participants.push({
        name: gameState.username,
        power: totalPower, // Include actual player power
        speed: speed,
        carry: carry,
        isPlayer: true,
        isPlayerCharacter: true // Flag to distinguish from NPCs
    });

    log(`✅ You've joined the coalition! Your speed bonus: ${(speed * 100).toFixed(0)}%`, "text-green-400 font-bold");
    updateEventUI(gameState);
    return true;
}

export function simulateNPCJoin(gameState, force = false) {
    if (!gameState.state.activeRun) return;
    const availableNPCs = Object.values(NPC_PRINCES).filter(n =>
        !gameState.state.activeRun.participants.find(p => p.name === n.name)
    );
    if (availableNPCs.length === 0) return;

    const npc = availableNPCs[Math.floor(Math.random() * availableNPCs.length)];
    const bridgemen = npc.bridgecrews || 0;
    const chulls = npc.chulls || 0;
    
    // NPCs don't get sign-up bonus, but do get speed from units
    const npcSpeed = calculateParticipantSpeed(bridgemen, chulls, 999); // 999 = way back in line, no bonus
    const npcCarry = chulls * 10;
    
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
    
    // Find gemheart winner (highest speed among participants)
    const sortedBySpeed = [...run.participants].sort((a, b) => b.speed - a.speed);
    const gemheartWinner = sortedBySpeed[0];

    // Determine base results that apply to all participants
    const baseResult = {
        victory: victory,
        totalPower: totalAlliedPower,
        enemyPower: run.enemyPower,
        gemheartWinnerName: victory ? gemheartWinner.name : null,
        gemheartWinnerIsPlayer: victory && (gemheartWinner.isPlayer || gemheartWinner.isPlayerCharacter)
    };

    log("The Coalition has departed for the Plateau.", "text-slate-400 italic");

    // Create deployments for each signed-up player with customized rewards
    if (run.signedUpPlayers.length > 0) {
        const durationMs = 2 * CONSTANTS.DAY_MS * 24; // 2 game days
        
        run.signedUpPlayers.forEach(playerData => {
            // Determine if this player won the gemheart
            const playerWonGemheart = victory && baseResult.gemheartWinnerIsPlayer && gemheartWinner.name === playerData.username;
            
            // Calculate loot share for this player
            let lootShare = 0;
            if (victory) {
                if (playerWonGemheart) {
                    // Gemheart winner gets 10,000 spheres
                    lootShare = 10000;
                } else {
                    // Other players get share based on carry
                    const totalCarry = run.participants.reduce((sum, p) => sum + p.carry, 0);
                    const playerCarry = playerData.chulls * 10;
                    const playerShare = totalCarry > 0 ? (playerCarry / totalCarry) * 100000 : 1000;
                    lootShare = Math.floor(playerShare);
                }
            }
            
            // Create customized result for this player
            const result = {
                ...baseResult,
                gemheartWon: playerWonGemheart,
                lootShare: lootShare
            };
            
            // Create deployment
            gameState.state.deployments.push({
                id: getCurrentGameTime(),
                type: 'run',
                units: playerData.military,
                returnTime: getCurrentGameTime() + durationMs,
                runResult: result
            });
        });
    } else {
        // No players joined, just NPCs
        if (victory) {
            log(`News: The Coalition defeated the Parshendi and the Chasmfiend. ${gemheartWinner.name} took the Gemheart.`, "text-slate-500");
        } else {
            log(`News: The Coalition was overwhelmed by the Parshendi and the Chasmfiend.`, "text-red-900");
        }
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
            const styling = p.name === gameState.username ? "bg-cyan-900/30 border-l-2 border-cyan-500 pl-2" : "";
            div.className = `flex justify-between text-[10px] text-slate-400 py-1 ${styling}`;
            const badge = p.name === gameState.username ? "👤 " : (p.isPlayer || p.isPlayerCharacter ? "⚔️ " : "🤖 ");
            div.innerHTML = `<span>${badge}${idx + 1}. ${p.name}</span> <span class="text-orange-300 font-bold">${(p.speed * 100).toFixed(1)}%</span>`;
            leaderboardEl.appendChild(div);
        });
    }
}
