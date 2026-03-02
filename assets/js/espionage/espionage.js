// Espionage and spy operations module with suspicion system
import { NPC_PRINCES, SUSPICION_LEVELS, SUSPICION_THRESHOLDS, CONSTANTS } from '../core/constants.js';
import { getSpyPower } from '../military/military.js';
import { log } from '../core/utils.js';
import { openSpyPlanningModal } from '../ui/modal-manager.js';
import { getCurrentGameTime } from '../core/server-api.js';
import { addReport } from '../ui/ui-manager.js';
import { isSpyBonusActive } from '../events/highstorm.js';
import { SERVER_URL } from '../core/auth.js';

const LEADERBOARD_INTEL_STORAGE_KEY = 'warcamps_leaderboard_intel';
const PLAYER_SCAN_ACTIONS = new Set(['military', 'resources', 'fabrials', 'agents', 'gather_intel', 'sabotage_steal_spheres', 'sabotage_steal_gems']);

function storeLeaderboardIntel(gameState, username, partialIntel, updatedMetrics = []) {
    if (!username) return;

    gameState.state.playerLeaderboardIntel = gameState.state.playerLeaderboardIntel || {};

    const existingInState = gameState.state.playerLeaderboardIntel[username] || {};
    const metricTimestamps = {
        ...(existingInState.metricTimestamps || {})
    };

    const now = Date.now();
    for (const metric of updatedMetrics) {
        metricTimestamps[metric] = now;
    }

    const mergedStateIntel = {
        ...existingInState,
        ...partialIntel,
        username,
        capturedAt: now,
        metricTimestamps
    };
    gameState.state.playerLeaderboardIntel[username] = mergedStateIntel;

    try {
        const current = JSON.parse(localStorage.getItem(LEADERBOARD_INTEL_STORAGE_KEY) || '{}');
        const existing = current[username] || {};
        const storedMetricTimestamps = {
            ...(existing.metricTimestamps || {}),
            ...metricTimestamps
        };

        current[username] = {
            ...existing,
            ...partialIntel,
            username,
            capturedAt: now,
            metricTimestamps: storedMetricTimestamps
        };
        localStorage.setItem(LEADERBOARD_INTEL_STORAGE_KEY, JSON.stringify(current));
    } catch (error) {
        console.warn('Failed to persist leaderboard intel cache:', error);
    }

    window.dispatchEvent(new CustomEvent('warcamps:leaderboard-intel-updated', {
        detail: { username }
    }));
}

// Process daily suspicion decay for all rivals
export function processSuspicionDecay(gameState) {
    const currentDay = gameState.state.dayCount ?? 0;

    // Process NPC rivals
    for (const rivalKey in gameState.state.rivals) {
        const rival = gameState.state.rivals[rivalKey];

        // Initialize tracking if needed
        if (!Object.prototype.hasOwnProperty.call(rival, 'daysSinceLastSpy')) {
            rival.daysSinceLastSpy = 0;
        }
        if (rival.lastSpyDay === undefined || rival.lastSpyDay === null) {
            rival.lastSpyDay = currentDay;
        }

        // If we spied on this rival today, do not decay
        if (rival.lastSpyDay === currentDay) {
            continue;
        }

        // Increment consecutive days without spying
        rival.daysSinceLastSpy += 1;

        if (rival.suspicion > 0) {
            // Decay formula: -1 * 2^(days - 1)
            // Day 1: -1, Day 2: -2, Day 3: -4, Day 4: -8, etc.
            const decay = Math.pow(2, rival.daysSinceLastSpy - 1);
            const oldSuspicion = rival.suspicion;
            rival.suspicion = Math.max(0, rival.suspicion - decay);

            // Update suspicion level
            const oldLevel = rival.suspicionLevel;
            updateSuspicionLevel(gameState, rivalKey);

            // Log if suspicion level changed significantly
            if (rival.suspicion < oldSuspicion && (rival.suspicionLevel !== oldLevel || rival.suspicion === 0)) {
                const targetName = NPC_PRINCES[rivalKey]?.name || rivalKey;
                log(`${targetName}'s suspicion decreased to ${rival.suspicion}/100 (${rival.suspicionLevel}) after ${rival.daysSinceLastSpy} day(s) without activity.`, "text-cyan-400 italic");
            }

            if (oldSuspicion > 0 && rival.suspicion === 0) {
                const targetName = NPC_PRINCES[rivalKey]?.name || rivalKey;
                const reportMessage = `${targetName}'s suspicion has fully cooled (0/100).`;
                addReport(gameState, 'espionage', reportMessage, { target: rivalKey, suspicion: 0 });
            }
        }
    }

    // Process player rivals
    if (gameState.state.playerRivals) {
        for (const username in gameState.state.playerRivals) {
            const playerRival = gameState.state.playerRivals[username];

            // Initialize tracking if needed
            if (!Object.prototype.hasOwnProperty.call(playerRival, 'daysSinceLastSpy')) {
                playerRival.daysSinceLastSpy = 0;
            }
            if (playerRival.lastSpyDay === undefined || playerRival.lastSpyDay === null) {
                playerRival.lastSpyDay = currentDay;
            }

            // If we spied on this player today, do not decay
            if (playerRival.lastSpyDay === currentDay) {
                continue;
            }

            // Increment consecutive days without spying
            playerRival.daysSinceLastSpy += 1;

            if (playerRival.suspicion > 0) {
                const decay = Math.pow(2, playerRival.daysSinceLastSpy - 1);
                const oldSuspicion = playerRival.suspicion;
                playerRival.suspicion = Math.max(0, playerRival.suspicion - decay);

                // Update suspicion level
                const oldLevel = playerRival.suspicionLevel;
                updateSuspicionLevel(gameState, username, true);

                // Log if suspicion level changed significantly
                if (playerRival.suspicion < oldSuspicion && (playerRival.suspicionLevel !== oldLevel || playerRival.suspicion === 0)) {
                    log(`${username}'s suspicion decreased to ${playerRival.suspicion}/100 (${playerRival.suspicionLevel}) after ${playerRival.daysSinceLastSpy} day(s) without activity.`, "text-cyan-400 italic");
                }

                if (oldSuspicion > 0 && playerRival.suspicion === 0) {
                    const reportMessage = `${username}'s suspicion has fully cooled (0/100).`;
                    addReport(gameState, 'espionage', reportMessage, { target: username, suspicion: 0 });
                }
            }
        }
    }
}

function initializeRival(gameState, targetKey) {
    if (!gameState.state.rivals[targetKey]) {
        gameState.state.rivals[targetKey] = {
            suspicion: 0,
            suspicionLevel: SUSPICION_LEVELS.UNKNOWN,
            intel: 0,
            spiesCaught: 0,
            daysSinceLastSpy: 0, // Track consecutive days without spying
            lastSpyDay: null
        };
    }
}

function initializePlayerRival(gameState, targetUsername) {
    if (!gameState.state.playerRivals) {
        gameState.state.playerRivals = {};
    }
    if (!gameState.state.playerRivals[targetUsername]) {
        gameState.state.playerRivals[targetUsername] = {
            suspicion: 0,
            suspicionLevel: SUSPICION_LEVELS.UNKNOWN,
            intel: 0,
            spiesCaught: 0,
            daysSinceLastSpy: 0,
            lastSpyDay: null
        };
    }
}

function updateSuspicionLevel(gameState, targetKey, isPlayer = false) {
    const rival = isPlayer ? gameState.state.playerRivals[targetKey] : gameState.state.rivals[targetKey];
    if (!rival) return;
    
    if (rival.suspicion >= SUSPICION_THRESHOLDS.hostile) {
        rival.suspicionLevel = SUSPICION_LEVELS.HOSTILE;
    } else if (rival.suspicion >= SUSPICION_THRESHOLDS.suspicious) {
        rival.suspicionLevel = SUSPICION_LEVELS.SUSPICIOUS;
    } else if (rival.suspicion >= SUSPICION_THRESHOLDS.known) {
        rival.suspicionLevel = SUSPICION_LEVELS.KNOWN;
    } else {
        rival.suspicionLevel = SUSPICION_LEVELS.UNKNOWN;
    }
}

function getSuspicionMultiplier(suspicionLevel) {
    switch(suspicionLevel) {
        case SUSPICION_LEVELS.UNKNOWN: return 1.0;
        case SUSPICION_LEVELS.KNOWN: return 0.7;
        case SUSPICION_LEVELS.SUSPICIOUS: return 0.4;
        case SUSPICION_LEVELS.HOSTILE: return 0.1;
        default: return 1.0;
    }
}

function getSpyPowerBonus(gameState) {
    // Whisper Tower provides 1.5x spy power bonus
    if (gameState.state.buildings.whisper_tower > 0) return 1.5;
    return 1.0;
}

function getSelectedPlayerTarget() {
    const selectedPlayerInput = document.getElementById('spy-selected-player');
    if (!selectedPlayerInput) return '';
    return (selectedPlayerInput.value || '').trim();
}

function buildPlayerScanMission(gameState, action, myAgents, targetUsername) {
    const actionLabelMap = {
        military: 'Infiltrate Military',
        resources: 'Infiltrate Resources',
        fabrials: 'Infiltrate Tech',
        agents: 'Infiltrate Agents',
        gather_intel: 'Gather Intel',
        sabotage_steal_spheres: 'Sabotage: Steal Spheres',
        sabotage_steal_gems: 'Sabotage: Steal Gemheart'
    };

    // Initialize player rival tracking
    initializePlayerRival(gameState, targetUsername);
    const playerRival = gameState.state.playerRivals[targetUsername];

    const isSabotage = action === 'sabotage_steal_spheres' || action === 'sabotage_steal_gems';
    const missionDuration = (isSabotage ? CONSTANTS.DAY_MS : CONSTANTS.DAY_MS / 2) * 24; // 1 or 0.5 game days (in game time)

    // Add suspicion for player-targeted missions
    if (isSabotage) {
        playerRival.suspicion += 10; // Sabotage increases suspicion more
    } else {
        playerRival.suspicion += 2;
    }
    playerRival.daysSinceLastSpy = 0;
    playerRival.lastSpyDay = gameState.state.dayCount ?? 0;
    updateSuspicionLevel(gameState, targetUsername, true);

    return {
        id: getCurrentGameTime(),
        type: 'espionage',
        action,
        actionLabel: actionLabelMap[action] || action,
        targetPlayerUsername: targetUsername,
        targetName: targetUsername,
        myAgents: Math.floor(myAgents),
        units: { agents: Math.floor(myAgents) },
        returnTime: getCurrentGameTime() + missionDuration,
        isSabotage: isSabotage,
        isPlayerScan: true
    };
}

export function spyAction(gameState, action) {
    const selectedPlayerTarget = getSelectedPlayerTarget();
    const isPlayerScan = PLAYER_SCAN_ACTIONS.has(action) && !!selectedPlayerTarget;

    if (isPlayerScan) {
        let myAgents = getSpyPower(gameState);
        if (myAgents === 0) {
            log(`You need at least 1 spy agent to launch intelligence missions. Recruit agents from the Military tab.`, 'text-red-400');
            return;
        }

        // Check intel requirement for player sabotage
        const isSabotage = action === 'sabotage_steal_spheres' || action === 'sabotage_steal_gems';
        if (isSabotage) {
            initializePlayerRival(gameState, selectedPlayerTarget);
            const playerRival = gameState.state.playerRivals[selectedPlayerTarget];
            if (playerRival.intel < 15) {
                log(`Insufficient intel on ${selectedPlayerTarget}. Need 15, have ${playerRival.intel}.`, "text-red-400");
                return;
            }
            playerRival.intel -= 15;
        }

        myAgents *= getSpyPowerBonus(gameState);
        const mission = buildPlayerScanMission(gameState, action, myAgents, selectedPlayerTarget);
        gameState.state.deployments.push(mission);
        log(`Spies dispatched to ${selectedPlayerTarget} (${mission.actionLabel}).`, 'text-purple-400 italic');
        openSpyPlanningModal();
        return;
    }

    // Use modal select if available, otherwise use tab select
    const targetSelect = document.getElementById('spy-target-modal') || document.getElementById('spy-target');
    const targetKey = targetSelect.value;
    const target = NPC_PRINCES[targetKey];
    let myAgents = getSpyPower(gameState);

    if (myAgents === 0) {
        log(`You need at least 1 spy agent to launch intelligence missions. Recruit agents from the Military tab.`, 'text-red-400');
        return;
    }

    // Apply Whisper Tower bonus
    myAgents *= getSpyPowerBonus(gameState);

    // Initialize rival if first interaction
    initializeRival(gameState, targetKey);
    const rival = gameState.state.rivals[targetKey];

    // Determine mission type and timing
    const isSabotage = action === 'sabotage_steal_spheres' || action === 'sabotage_steal_gems';
    const missionDuration = (isSabotage ? CONSTANTS.DAY_MS : CONSTANTS.DAY_MS / 2) * 24; // 1 or 0.5 game days (in game time)

    const actionLabelMap = {
        military: 'Infiltrate Military',
        resources: 'Infiltrate Resources',
        fabrials: 'Infiltrate Tech',
        gather_intel: 'Gather Intel',
        agents: 'Infiltrate Agents',
        scan_champion: 'Scan Champion',
        investigate_player: 'Investigate Player',
        sabotage_steal_spheres: 'Sabotage: Steal Spheres',
        sabotage_steal_gems: 'Sabotage: Steal Gemheart'
    };
    const actionLabel = actionLabelMap[action] || action;
    
    const spyMission = {
        id: getCurrentGameTime(),
        type: 'espionage',
        action: action,
        actionLabel: actionLabel,
        targetKey: targetKey,
        targetName: target.name,
        myAgents: Math.floor(myAgents),
        units: { agents: Math.floor(myAgents) },
        returnTime: getCurrentGameTime() + missionDuration,
        targetAgents: target.agents,
        intelSpent: 0,
        isSabotage: isSabotage
    };

    // Actions that require intel
    if (isSabotage) {
        if (rival.intel < 15) {
            log(`Insufficient intel on ${target.name}. Need 15, have ${rival.intel}.`, "text-red-400");
            return;
        }
        spyMission.intelSpent = 15;
        rival.intel -= 15;
        // Sabotage increases suspicion moderately on success
        rival.suspicion += 10;
    } else {
        // Regular intel gathering increases suspicion minimally on success
        rival.suspicion += 2;
    }

    // Reset decay tracking when spying
    rival.daysSinceLastSpy = 0;
    rival.lastSpyDay = gameState.state.dayCount ?? 0;
    
    updateSuspicionLevel(gameState, targetKey);
    gameState.state.deployments.push(spyMission);
    log(`Spies dispatched to ${target.name} (${actionLabel}). Suspicion: ${rival.suspicion}/100 (${rival.suspicionLevel}).`, "text-purple-400 italic");
    openSpyPlanningModal();
}

export function resolveSpy(gameState, mission) {
    if (mission.isPlayerScan) {
        resolvePlayerScanMission(gameState, mission);
        return;
    }

    const target = NPC_PRINCES[mission.targetKey];
    const action = mission.action;
    const myAgents = mission.myAgents;
    const targetName = target.name;
    const rival = gameState.state.rivals[mission.targetKey];

    let success = false;
    let intel = '';
    let gainInfo = '';
    let capturedAgent = null;

    const suspicionMult = getSuspicionMultiplier(rival.suspicionLevel);
    
    // Apply highstorm spy bonus (2x effective spy power during storm chaos)
    const stormBonus = isSpyBonusActive(gameState) ? 2.0 : 1.0;
    
    // Deterministic success: If your spy power meets or beats theirs, you succeed
    // Suspicion reduces your effective spy power
    const myEffectiveSpyPower = myAgents * suspicionMult * stormBonus;
    const targetSpyPower = mission.targetAgents || 15;
    const isSabotage = action === 'sabotage_steal_spheres' || action === 'sabotage_steal_gems';
    
    // Sabotage requires higher spy power threshold
    // Stealing spheres: 2x target power, Stealing gemhearts: 3x target power
    let requiredPower = targetSpyPower;
    if (action === 'sabotage_steal_spheres') {
        requiredPower = targetSpyPower * 2.0;
    } else if (action === 'sabotage_steal_gems') {
        requiredPower = targetSpyPower * 3.0;
    }
    success = myEffectiveSpyPower >= requiredPower;

    // Intelligence gathering missions
    if (action === 'military') {
        if (success) {
            intel = `MILITARY: Power ${target.power} | ${target.shardbearers} Shardbearers | ${target.spearmen} Spearmen`;
            gainInfo = 'Intel gathered';
            // Gathering intel also builds intel on the rival
            rival.intel += 5;
        }
    } else if (action === 'resources') {
        if (success) {
            intel = `RESOURCES: ${target.spheres} Spheres | ${target.gemhearts} Gemhearts | ${target.provisions} Provisions`;
            gainInfo = 'Intel gathered';
            rival.intel += 5;
        }
    } else if (action === 'fabrials') {
        if (success) {
            intel = `TECHNOLOGY: ${target.fabrials.join(", ")}`;
            gainInfo = 'Intel gathered';
            rival.intel += 5;
        }
    } else if (action === 'gather_intel') {
        // New action: gather intel on the rival
        if (success) {
            intel = `INTELLIGENCE OPERATION`;
            const gain = Math.floor(15 + Math.random() * 10);
            gainInfo = `+${gain} intel`;
            rival.intel += gain;
        }
    } else if (action === 'agents') {
        if (success) {
            intel = `AGENTS: ${target.agents}`;
            gainInfo = 'Intel gathered';
            rival.intel += 5;
        }
    } else if (action === 'scan_champion') {
        if (success) {
            const fabrialsText = target.championFabrials && target.championFabrials.length > 0 
                ? target.championFabrials.join(", ") 
                : "None";
            intel = `CHAMPION: Level ${target.championLevel} | HP: ${target.championHP}/${target.championMaxHP} | Fabrials: ${fabrialsText}`;
            gainInfo = 'Intel gathered';
            rival.intel += 5;
        }
    } else if (action === 'sabotage_steal_spheres') {
        // Sabotage requires higher spy power (1.5x target power)
        if (success) {
            const stolen = Math.floor(500 + Math.random() * 500);
            gameState.state.spheres += stolen;
            intel = 'HEIST SUCCESSFUL';
            gainInfo = `+${stolen} Spheres`;
            log(`Successfully sabotaged ${targetName} and stole ${stolen} spheres!`, "text-yellow-400 font-bold");
        }
    } else if (action === 'sabotage_steal_gems') {
        // Sabotage requires higher spy power (1.5x target power)
        if (success && target.gemhearts > 0) {
            gameState.state.gemhearts += 1;
            intel = 'GEMHEART STOLEN';
            gainInfo = '+1 Gemheart';
            log(`Sabotaged ${targetName} and stole a Gemheart!`, "text-cyan-400 font-bold");
        } else {
            intel = 'HEIST FAILED';
            gainInfo = 'No gemhearts available';
        }
    }

    if (!success) {
        // Mission failed - agent(s) captured
        const spyTypes = ['noble', 'spy', 'ghostblood'];
        const available = spyTypes.filter(t => gameState.state.military[t] > 0);
        if (available.length > 0) {
            capturedAgent = available[Math.floor(Math.random() * available.length)];
            gameState.state.military[capturedAgent]--;
            // When we catch an agent, the target gets intel on us
            rival.intel += 8;
            // Failed missions cause major suspicion increase (your spy power was less than theirs)
            if (mission.isSabotage) {
                // Sabotage failure: +50 suspicion
                rival.suspicion += 50;
            } else {
                // Intel mission failure: +25 suspicion
                rival.suspicion += 25;
            }
            log(`Spy mission failed. A ${capturedAgent} was caught by ${targetName}.`, "text-red-500");
        } else {
            // Even without agents to lose, failure impacts suspicion (your spy power < theirs)
            if (mission.isSabotage) {
                rival.suspicion += 50;
            } else {
                rival.suspicion += 25;
            }
            log(`Spy mission failed against ${targetName}.`, "text-red-500");
        }
    }

    showSpyMissionResult(gameState, success, targetName, intel, gainInfo, capturedAgent, rival);
}

async function executeSabotage(gameState, targetUsername, resourceType, amount) {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${SERVER_URL}/api/sabotage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                targetUsername,
                resourceType,
                amount
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Sabotage execution failed:', error);
        return { success: false, message: 'Failed to execute sabotage' };
    }
}

function resolvePlayerScanMission(gameState, mission) {
    const targetUsername = mission.targetPlayerUsername || mission.targetName;
    if (!targetUsername) {
        showSpyMissionResult(gameState, false, 'Unknown Target', 'No infiltration data available.', '', null, null);
        return;
    }

    // Initialize player rival tracking
    initializePlayerRival(gameState, targetUsername);
    const playerRival = gameState.state.playerRivals[targetUsername];

    fetch(`${SERVER_URL}/api/player/${encodeURIComponent(targetUsername)}`)
        .then(response => response.json())
        .then(result => {
            if (!result.success || !result.player) {
                throw new Error('Player intel unavailable');
            }

            const player = result.player;
            const action = mission.action;
            const targetAgentPower = ((player.military_noble || 0) * 1) + ((player.military_spy || 0) * 2) + ((player.military_ghostblood || 0) * 5);
            
            // Apply suspicion multiplier
            const suspicionMult = getSuspicionMultiplier(playerRival.suspicionLevel);
            const stormBonus = isSpyBonusActive(gameState) ? 2.0 : 1.0;
            const myEffectiveSpyPower = mission.myAgents * suspicionMult * stormBonus;
            
            // Determine required power based on action
            const isSabotage = action === 'sabotage_steal_spheres' || action === 'sabotage_steal_gems';
            let requiredPower = Math.max(10, targetAgentPower);
            if (action === 'sabotage_steal_spheres') {
                requiredPower = Math.max(10, targetAgentPower * 2.0);
            } else if (action === 'sabotage_steal_gems') {
                requiredPower = Math.max(10, targetAgentPower * 3.0);
            }
            
            const success = myEffectiveSpyPower >= requiredPower;

            if (!success) {
                const spyTypes = ['noble', 'spy', 'ghostblood'];
                const available = spyTypes.filter(t => (gameState.state.military[t] || 0) > 0);
                let capturedAgent = null;
                if (available.length > 0) {
                    capturedAgent = available[Math.floor(Math.random() * available.length)];
                    gameState.state.military[capturedAgent]--;
                }
                // Failed missions increase suspicion
                playerRival.suspicion += 25;
                playerRival.intel += 8;
                updateSuspicionLevel(gameState, targetUsername, true);
                showSpyMissionResult(gameState, false, targetUsername, 'Infiltration compromised by enemy counter-intelligence.', 'No intel recovered', capturedAgent, playerRival);
                return;
            }

            // Success - add intel
            playerRival.intel += 5;

            const totalMilitary = (player.military_spearmen || 0) + (player.military_archers || 0) + (player.military_chulls || 0) + (player.military_shardbearers || 0);
            const totalLand = (player.buildings_market || 0) + (player.buildings_training_camp || 0) + (player.buildings_shelter || 0) + (player.buildings_monastery || 0) + (player.buildings_soulcaster || 0) + (player.buildings_spy_network || 0) + (player.buildings_research_library || 0) + (player.buildings_stormshelter || 0) + (player.buildings_whisper_tower || 0);

            if (action === 'military') {
                const unitBreakdown = `Bridgecrews ${player.military_bridgecrews || 0} | Spearmen ${player.military_spearmen || 0} | Archers ${player.military_archers || 0} | Chulls ${player.military_chulls || 0} | Shardbearers ${player.military_shardbearers || 0}`;
                storeLeaderboardIntel(gameState, player.username, {
                    totalMilitary,
                    militaryBreakdown: {
                        bridgecrews: player.military_bridgecrews || 0,
                        spearmen: player.military_spearmen || 0,
                        archers: player.military_archers || 0,
                        chulls: player.military_chulls || 0,
                        shardbearers: player.military_shardbearers || 0
                    }
                }, ['military']);
                showSpyMissionResult(gameState, true, targetUsername, `MILITARY: ${unitBreakdown}`, `Military leaderboard intel updated (${totalMilitary.toLocaleString()} power)`, null, playerRival);
                return;
            }

            if (action === 'resources') {
                storeLeaderboardIntel(gameState, player.username, {
                    spheres: player.spheres || 0,
                    gemhearts: player.gemhearts || 0
                }, ['spheres']);
                showSpyMissionResult(gameState, true, targetUsername, `RESOURCES: ${(player.spheres || 0).toLocaleString()} Spheres | ${player.gemhearts || 0} Gemhearts`, 'Wealth leaderboard intel updated', null, playerRival);
                return;
            }

            if (action === 'fabrials') {
                const fabrials = player.fabrials || {};
                const techText = `HEATRIAL ${fabrials.heatrial || 0} | LEDGER ${fabrials.ledger || 0} | GRAVITY LIFT ${fabrials.gravity_lift || 0} | REGEN PLATE ${fabrials.regen_plate || 0} | THRILL AMP ${fabrials.thrill_amp || 0} | HALF SHARD ${fabrials.half_shard || 0}`;
                storeLeaderboardIntel(gameState, player.username, {
                    totalLand,
                    fabrials,
                    buildingTech: {
                        research_library: player.buildings_research_library || 0,
                        whisper_tower: player.buildings_whisper_tower || 0,
                        soulcaster: player.buildings_soulcaster || 0
                    }
                }, ['land']);
                showSpyMissionResult(gameState, true, targetUsername, `TECH: ${techText}`, `Infrastructure intel updated (${totalLand.toLocaleString()} land value)`, null, playerRival);
                return;
            }

            if (action === 'agents') {
                const noble = player.military_noble || 0;
                const spy = player.military_spy || 0;
                const ghostblood = player.military_ghostblood || 0;
                storeLeaderboardIntel(gameState, player.username, {
                    agentsBreakdown: { noble, spy, ghostblood }
                }, []);
                showSpyMissionResult(gameState, true, targetUsername, `AGENTS: Nobles ${noble} | Spies ${spy} | Ghostbloods ${ghostblood}`, 'Agent network intel updated', null, playerRival);
                return;
            }

            if (action === 'gather_intel') {
                // Dedicated intel gathering mission - higher payoff
                const gain = Math.floor(15 + Math.random() * 10);
                playerRival.intel += gain;
                showSpyMissionResult(gameState, true, targetUsername, `INTELLIGENCE OPERATION`, `+${gain} intel gathered on ${targetUsername}`, null, playerRival);
                return;
            }

            // Handle sabotage missions
            if (action === 'sabotage_steal_spheres') {
                const stolen = Math.floor(500 + Math.random() * 500);
                // Make server call to execute the theft
                executeSabotage(gameState, targetUsername, 'spheres', stolen)
                    .then(sabotageResult => {
                        if (sabotageResult.success) {
                            gameState.state.spheres += stolen;
                            log(`Successfully sabotaged ${targetUsername} and stole ${stolen} spheres!`, "text-yellow-400 font-bold");
                            showSpyMissionResult(gameState, true, targetUsername, 'HEIST SUCCESSFUL', `+${stolen} Spheres stolen from ${targetUsername}`, null, playerRival);
                        } else {
                            showSpyMissionResult(gameState, false, targetUsername, 'HEIST FAILED', 'Unable to complete theft', null, playerRival);
                        }
                    })
                    .catch(() => {
                        showSpyMissionResult(gameState, false, targetUsername, 'HEIST FAILED', 'Server error during sabotage', null, playerRival);
                    });
                return;
            }

            if (action === 'sabotage_steal_gems') {
                if (player.gemhearts > 0) {
                    // Make server call to execute the theft
                    executeSabotage(gameState, targetUsername, 'gemhearts', 1)
                        .then(sabotageResult => {
                            if (sabotageResult.success) {
                                gameState.state.gemhearts += 1;
                                log(`Sabotaged ${targetUsername} and stole a Gemheart!`, "text-cyan-400 font-bold");
                                showSpyMissionResult(gameState, true, targetUsername, 'GEMHEART STOLEN', `+1 Gemheart stolen from ${targetUsername}`, null, playerRival);
                            } else {
                                showSpyMissionResult(gameState, false, targetUsername, 'HEIST FAILED', 'Unable to steal gemheart', null, playerRival);
                            }
                        })
                        .catch(() => {
                            showSpyMissionResult(gameState, false, targetUsername, 'HEIST FAILED', 'Server error during sabotage', null, playerRival);
                        });
                } else {
                    showSpyMissionResult(gameState, false, targetUsername, 'HEIST FAILED', 'Target has no gemhearts', null, playerRival);
                }
                return;
            }

            showSpyMissionResult(gameState, true, targetUsername, 'Infiltration completed.', 'Intel gathered', null, playerRival);
        })
        .catch((error) => {
            console.error('Player infiltration mission failed:', error);
            initializePlayerRival(gameState, targetUsername);
            const playerRival = gameState.state.playerRivals[targetUsername];
            showSpyMissionResult(gameState, false, targetUsername, 'Infiltration compromised.', 'No intel recovered', null, playerRival);
        });
}

function showSpyMissionResult(gameState, success, targetName, intel, gainInfo, capturedAgent, rival) {
    const statusEl = document.getElementById('espionage-result-status');
    const targetEl = document.getElementById('espionage-target-name');
    const intelEl = document.getElementById('espionage-intel-info');
    const gainEl = document.getElementById('espionage-result-gain');
    const gainInfoEl = document.getElementById('espionage-gain-info');
    const lossEl = document.getElementById('espionage-result-loss');
    const lossAgentEl = document.getElementById('espionage-loss-agent');
    const suspicionEl = document.getElementById('espionage-suspicion-display');
    
    if (!statusEl || !targetEl || !intelEl) return;
    
    if (success) {
        statusEl.textContent = '✓ MISSION SUCCESSFUL';
        statusEl.className = 'text-lg font-bold text-green-400 mb-6';
        gainEl.classList.remove('hidden');
        gainInfoEl.textContent = gainInfo;
        lossEl.classList.add('hidden');
    } else {
        statusEl.textContent = '✗ MISSION COMPROMISED';
        statusEl.className = 'text-lg font-bold text-red-400 mb-6';
        gainEl.classList.add('hidden');
        lossEl.classList.remove('hidden');
        if (capturedAgent) {
            lossAgentEl.textContent = `1 ${capturedAgent} was captured`;
        }
    }
    
    targetEl.textContent = targetName;
    intelEl.textContent = intel;
    
    // Add report to Spanreed Center
    const reportMessage = success 
        ? `Espionage mission against ${targetName} succeeded. ${gainInfo}` 
        : `Espionage mission against ${targetName} failed${capturedAgent ? ` - ${capturedAgent} captured` : ''}.`;
    addReport(gameState, 'espionage', reportMessage, { target: targetName, success, intel, gainInfo, capturedAgent });
    
    // Add suspicion display
    if (suspicionEl && rival) {
        suspicionEl.textContent = `Suspicion: ${rival.suspicion}/100 (${rival.suspicionLevel})`;
    }
    
    const modal = document.getElementById('espionage-result-modal');
    if (modal) modal.classList.add('show');
}
