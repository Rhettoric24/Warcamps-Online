// Plateau run event system
import { CONSTANTS, NPC_PRINCES, UNIT_STATS } from '../core/constants.js';
import { log, triggerNotification, startTitleFlash, stopTitleFlash, flashScreen } from '../core/utils.js';
import { getCurrentGameTime } from '../core/server-api.js';
import { SERVER_URL, authFetch } from '../core/auth.js';

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
 * Base speed from bridgemen + chull penalty, plus sign-up order bonus
 */
function calculateParticipantSpeed(bridgemen, chulls, signupIndex) {
    // Base speed: 1.0 + (bridgemen * 0.01)
    const baseSpeed = 1.0 + (bridgemen * 0.01);
    
    // Speed penalty from chulls: each chull reduces speed by 0.025 (2.5%)
    // Chulls are cargo units that slow you down, not speed them up
    const chullPenalty = chulls * -0.025;
    
    // Sign-up order bonus
    const signupBonus = getSignupOrderBonus(signupIndex);
    
    // Total speed
    const totalSpeed = baseSpeed + chullPenalty + signupBonus;
    
    return totalSpeed;
}

/**
 * Fetch active plateau run from server
 */
export async function fetchActivePlateauRun() {
    try {
        const response = await fetch(`${SERVER_URL}/api/plateau/active`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            return data.run;
        }
        return null;
    } catch (error) {
        console.error('Error fetching active plateau run:', error);
        return null;
    }
}

/**
 * Check and update active run from server
 */
export async function checkServerPlateauRun(gameState) {
    const serverRun = await fetchActivePlateauRun();
    
    // If server has no run but client thinks there is one, clear it
    if (!serverRun && gameState.state.activeRun) {
        gameState.state.activeRun = null;
        document.getElementById('plateau-event-container').classList.add('hidden');
        document.getElementById('muster-leaderboard').classList.add('hidden');
        stopTitleFlash();
        return;
    }
    
    // If server has a run
    if (serverRun) {
        // Check if this is a new run or existing run
        const isNewRun = !gameState.state.activeRun || gameState.state.activeRun.id !== serverRun.id;
        
        if (isNewRun) {
            // New run detected
            gameState.state.activeRun = {
                id: serverRun.id,
                phase: serverRun.phase,
                warningStartTime: serverRun.warning_start_time,
                warningEndTime: serverRun.warning_end_time,
                musterStartTime: serverRun.muster_start_time,
                musterEndTime: serverRun.muster_end_time,
                departedStartTime: serverRun.departed_start_time,
                departedEndTime: serverRun.departed_end_time,
                difficulty: serverRun.difficulty,
                enemyPower: serverRun.enemy_power,
                participants: [],
                signedUpPlayers: [],
                playerForces: null,
                gameYear: serverRun.game_year,
                serverRun: true
            };
            
            document.getElementById('plateau-event-container').classList.remove('hidden');
            document.getElementById('screen-overlay').classList.add('warn-flash');
            setTimeout(() => document.getElementById('screen-overlay').classList.remove('warn-flash'), 2000);
            log(`⚠️ SCOUT REPORT: Chasmfiend spotted! Prepare for the plateau run! ⚠️`, "text-orange-400 font-bold text-lg");
            triggerNotification("Plateau Run Detected!", "A Chasmfiend has been spotted on the Shattered Plains!");
            startTitleFlash();
        } else {
            // Update existing run phase and details
            gameState.state.activeRun.phase = serverRun.phase;
        }
        
        updateEventUI(gameState);
    }
}

/**
 * Legacy spawn event function - now replaced by server spawning
 */
export function spawnEvent(gameState) {
    console.log('Client-side spawn is disabled. Runs now spawn from server.');
}

/**
 * Player signs up for the plateau run via server
 */
export async function playerJoinRun(gameState) {
    if (!gameState.state.activeRun || !gameState.state.activeRun.serverRun) {
        log("No server plateau run active.", "text-yellow-400");
        return false;
    }

    const run = gameState.state.activeRun;
    
    // Check if player already signed up
    if (run.signedUpPlayers.find(p => p.username === gameState.username)) {
        log("You've already signed up for this plateau run!", "text-yellow-400");
        return false;
    }

    const now = Date.now();
    
    // Check if muster phase has started
    if (now < run.musterStartTime) {
        log("Muster phase hasn't started yet. Wait for the signal!", "text-yellow-400");
        return false;
    }

    // Check if muster phase has ended
    if (now >= run.musterEndTime) {
        log("The coalition has already departed!", "text-red-400");
        return false;
    }

    const military = gameState.state.military;
    const deployableUnits = ['bridgecrews', 'spearmen', 'archers', 'shardbearers', 'chulls'];

    // Snapshot only units that are valid for plateau deployments
    const militarySnapshot = {};
    deployableUnits.forEach(unitType => {
        militarySnapshot[unitType] = military[unitType] || 0;
    });

    // Calculate player power using UNIT_STATS (same model as other missions)
    let totalPower = 0;
    deployableUnits.forEach(unitType => {
        const count = militarySnapshot[unitType] || 0;
        totalPower += count * (UNIT_STATS[unitType]?.power || 0);
    });

    if ((militarySnapshot.shardbearers || 0) > 0) {
        totalPower *= (UNIT_STATS.shardbearers.multiplier * militarySnapshot.shardbearers);
    }

    // Get current participant count for signup index
    const serverRun = await fetchActivePlateauRun();
    const signupIndex = serverRun?.participants?.length || 0;
    
    const bridgemen = gameState.state.military.bridgecrews || 0;
    const chulls = gameState.state.military.chulls || 0;
    const speed = calculateParticipantSpeed(bridgemen, chulls, signupIndex);
    const carry = chulls * 10; // Only chulls provide carry

    // Join via server API
    try {
        const response = await authFetch(`${SERVER_URL}/api/plateau/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                runId: run.id,
                militarySnapshot,
                power: totalPower,
                speed,
                carry,
                bridgemen,
                chulls,
                signupIndex
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            log(data.error || 'Failed to join plateau run', "text-red-400");
            return false;
        }
        
        // Track locally
        run.signedUpPlayers.push({
            username: gameState.username,
            signupTime: Date.now(),
            signupIndex: signupIndex,
            bridgemen: bridgemen,
            chulls: chulls,
            power: totalPower,
            military: militarySnapshot
        });

        log(`✅ You've joined the coalition! Your speed bonus: ${(speed * 100).toFixed(0)}%`, "text-green-400 font-bold");
        
        // Refresh UI with updated participant list
        await checkServerPlateauRun(gameState);
        return true;
    } catch (error) {
        console.error('Error joining plateau run:', error);
        log('Failed to join plateau run', "text-red-400");
        return false;
    }
}

/**
 * Legacy NPC join simulation - no longer needed (server handles NPCs if desired)
 */
export function simulateNPCJoin(gameState, force = false) {
    // Server now handles all participants
}

/**
 * Legacy resolve function - server handles resolution
 */
export function resolveRun(gameState) {
    // Check server for results and award locally
    const run = gameState.state.activeRun;
    if (!run) return;
    
    // Find player's participation
    const playerParticipation = run.signedUpPlayers.find(p => p.username === gameState.username);
    
    if (playerParticipation) {
        // Create a deployment to track when loot arrives
        // The server has already awarded the loot, but we'll add it as a returning deployment
        const durationMs = 2 * CONSTANTS.DAY_MS * 24; // 2 game days
        
        gameState.state.deployments.push({
            id: getCurrentGameTime(),
            type: 'run',
            units: playerParticipation.military,
            returnTime: getCurrentGameTime() + durationMs,
            runResult: {
                victory: false, // Will be populated by server response if needed
                serverResolved: true
            }
        });
        
        log("Your forces are returning from the Plateau Run.", "text-cyan-400");
    }
    
    // Clear local run
    gameState.state.activeRun = null;
    document.getElementById('plateau-event-container').classList.add('hidden');
    document.getElementById('muster-leaderboard').classList.add('hidden');
    stopTitleFlash();
}

export function updateEventUI(gameState) {
    const run = gameState.state.activeRun;
    if (!run) return;
    
    const leaderboardEl = document.getElementById('leaderboard-content');
    if (leaderboardEl) {
        leaderboardEl.innerHTML = '';
        
        // For server runs, we need to fetch and display participants from the server
        fetchActivePlateauRun().then(serverRun => {
            if (serverRun && serverRun.participants) {
                // Convert server participants to display format
                const participants = serverRun.participants.map(p => ({
                    name: p.username,
                    power: p.power,
                    speed: p.speed,
                    carry: p.carry,
                    isPlayer: true,
                    isPlayerCharacter: p.username === gameState.username
                }));
                
                const sorted = [...participants].sort((a, b) => b.speed - a.speed);
                sorted.forEach((p, idx) => {
                    const div = document.createElement('div');
                    const styling = p.isPlayerCharacter ? "bg-cyan-900/30 border-l-2 border-cyan-500 pl-2" : "";
                    div.className = `flex justify-between text-[10px] text-slate-400 py-1 ${styling}`;
                    const badge = p.isPlayerCharacter ? "👤 " : "⚔️ ";
                    div.innerHTML = `<span>${badge}${idx + 1}. ${p.name}</span> <span class="text-orange-300 font-bold">${(p.speed * 100).toFixed(1)}%</span>`;
                    leaderboardEl.appendChild(div);
                });
            }
        });
    }
}
