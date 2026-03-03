// Central game state management
import { DEV_MODE } from './constants.js';

export function createGameState() {
    return {
        username: null,
        state: {
            spheres: 10000,
            gemhearts: 2,
            provisions: 0,
            land: 0,
            maxLand: 25, // Starting land reduced for multiplayer
            freeLandPool: 250, // 50 × 5 players (1 player + 4 NPCs)
            military: {
                bridgecrews: 20, spearmen: 100, archers: 0,
                shardbearers: 0, chulls: 0,
                noble: 0, spy: 0, ghostblood: 0
            },
            arena: {
                level: 1,
                xp: 0,
                hp: 3,
                maxHp: 3,
                maxThrill: 10,
                wins: 0,
                thrillAmpUsedToday: false,
                halfShardUsedToday: false,
                regenPlateUsedToday: false
            },
            tournamentActive: false,
            activeDuel: null,
            thrillBid: 1,
            deployments: [],
            // Deprecated: conquest is now handled through the deployments array
            conquest: {
                active: false,
                startTime: null,
                endTime: null,
                enemyPower: 0,
                landReward: 0
            },
            buildings: {
                soulcaster: 0, market: 0, training_camp: 0,
                monastery: 0, shelter: 0, spy_network: 0, research_library: 0,
                stormshelter: 0, whisper_tower: 0
            },
            buildingLevels: {
                research_library: 1 // Upgradeable building levels
            },
            fabrials: {
                heatrial: 0,
                ledger: 0,
                gravity_lift: 0,
                regen_plate: 0,
                thrill_amp: 0,
                half_shard: 0
            },
            rivals: {
                // Track suspicion and intel on each NPC rival
                // Structure: { rivalKey: { suspicion: 0, suspicionLevel: 'unknown', intel: 0 } }
            },
            playerRivals: {
                // Track suspicion and intel on each player rival
                // Structure: { username: { suspicion: 0, suspicionLevel: 'unknown', intel: 0 } }
            },
            reports: [],
            messages: [],
            startTime: Date.now(),
            lastTickTime: Date.now(),
            lastActiveTime: Date.now(),
            dayCount: 0,
            activeRun: null,
            pendingDeployType: null,
            highstorm: {
                lastStormDay: -10,
                daysSinceStorm: 10,
                nextStormProbability: 0,
                active: false
            },
            npcState: {
                // Track NPC land and state (separate from constants)
                sadeas: { maxLand: 25 },
                vargo: { maxLand: 25 },
                sebarial: { maxLand: 25 },
                dalinar: { maxLand: 25 }
            }
                },
                attacksReceived: [],
                lastAttackCheckTime: 0
        }
    };
}

export function loadGameState(username, gameState) {
    const saved = localStorage.getItem(`highprince_save_v18_${username}`);
    if (!saved) return false;

    const parsed = JSON.parse(saved);
    return applyStateSnapshot(gameState, parsed);
}

export function applyStateSnapshot(gameState, parsed) {
    if (!parsed || typeof parsed !== 'object') return false;

    // Handle migration of fabrials from boolean to numbers
    let newFabrials = { ...gameState.state.fabrials };
    if (parsed.fabrials) {
        for (let k in parsed.fabrials) {
            if (typeof parsed.fabrials[k] === 'boolean') {
                newFabrials[k] = parsed.fabrials[k] ? 1 : 0;
            } else {
                newFabrials[k] = parsed.fabrials[k];
            }
        }
    }

    const mergedNpcState = { ...gameState.state.npcState };
    if (parsed.npcState) {
        for (const npcKey in parsed.npcState) {
            mergedNpcState[npcKey] = {
                ...(mergedNpcState[npcKey] || {}),
                ...parsed.npcState[npcKey]
            };
        }
    }

    gameState.state = {
        ...gameState.state,
        ...parsed,
        military: { ...gameState.state.military, ...parsed.military },
        buildings: { ...gameState.state.buildings, ...parsed.buildings },
        fabrials: newFabrials,
        arena: { ...gameState.state.arena, ...parsed.arena },
        npcState: mergedNpcState
    };
    if (parsed.activeRun) gameState.state.activeRun = parsed.activeRun;
    if (parsed.deployments) gameState.state.deployments = parsed.deployments;
    if (parsed.activeDuel) gameState.state.activeDuel = parsed.activeDuel;
    if (parsed.rivals) gameState.state.rivals = parsed.rivals;
    if (parsed.reports) gameState.state.reports = parsed.reports;
    if (parsed.messages) gameState.state.messages = parsed.messages;

    return true;
}

export function saveGameState(username, gameState) {
    // Always save locally first (for offline play)
    if (username) {
        localStorage.setItem(`highprince_save_v18_${username}`, JSON.stringify(gameState.state));
    }
    
    // Also send to server to keep it in sync (fire and forget, don't block on it)
    saveGameStateToServer(username, gameState.state);
}

/**
 * Send game state to server for persistence
 * This ensures multiplayer data stays consistent
 * We don't wait for response or block on failure
 */
function saveGameStateToServer(username, gameState) {
    if (!username || !gameState) return;
    
    // Import SERVER_URL from auth dynamically to avoid circular deps
    import('./auth.js').then(({ SERVER_URL, authFetch }) => {
        authFetch(`${SERVER_URL}/api/player/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ gameState })
        }).catch(error => {
            // Silent fail - local save already worked, server sync is best effort
            console.debug('Game state server sync failed (local save preserved):', error);
        });
    });
}
