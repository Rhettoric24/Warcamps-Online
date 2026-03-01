// Espionage and spy operations module with suspicion system
import { NPC_PRINCES, SUSPICION_LEVELS, SUSPICION_THRESHOLDS, CONSTANTS } from '../core/constants.js';
import { getSpyPower } from '../military/military.js';
import { log } from '../core/utils.js';
import { openSpyPlanningModal } from '../ui/modal-manager.js';
import { getCurrentGameTime } from '../core/server-api.js';
import { addReport } from '../ui/ui-manager.js';
import { isSpyBonusActive } from '../events/highstorm.js';

// Process daily suspicion decay for all rivals
export function processSuspicionDecay(gameState) {
    const currentDay = gameState.state.dayCount ?? 0;

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
}

function initializeRival(gameState, targetKey) {
    if (!gameState.state.rivals[targetKey]) {
        gameState.state.rivals[targetKey] = {
            suspicion: 0,
            suspicionLevel: SUSPICION_LEVELS.UNKNOWN,
            counterIntel: 0,
            spiesCaught: 0,
            daysSinceLastSpy: 0, // Track consecutive days without spying
            lastSpyDay: null
        };
    }
}

function updateSuspicionLevel(gameState, targetKey) {
    const rival = gameState.state.rivals[targetKey];
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

export function spyAction(gameState, action) {
    // Use modal select if available, otherwise use tab select
    const targetSelect = document.getElementById('spy-target-modal') || document.getElementById('spy-target');
    const targetKey = targetSelect.value;
    const target = NPC_PRINCES[targetKey];
    let myAgents = getSpyPower(gameState);

    if (myAgents === 0) return;

    // Apply Whisper Tower bonus
    myAgents *= getSpyPowerBonus(gameState);

    // Initialize rival if first interaction
    initializeRival(gameState, targetKey);
    const rival = gameState.state.rivals[targetKey];

    // Determine mission type and timing
    const isSabotage = action === 'sabotage_steal_spheres' || action === 'sabotage_steal_gems';
    const missionDuration = (isSabotage ? CONSTANTS.DAY_MS : CONSTANTS.DAY_MS / 2) * 24; // Convert to game milliseconds (24x speed)

    const actionLabelMap = {
        military: 'Scan Military',
        resources: 'Scan Resources',
        fabrials: 'Scan Tech',
        counter_intel: 'Counter Intel',
        agents: 'Scan Agents',
        scan_champion: 'Scan Champion',
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
        counterIntelSpent: 0,
        isSabotage: isSabotage
    };

    // Actions that require counter intel
    if (isSabotage) {
        if (rival.counterIntel < 15) {
            log(`Insufficient counter intel on ${target.name}. Need 15, have ${rival.counterIntel}.`, "text-red-400");
            return;
        }
        spyMission.counterIntelSpent = 15;
        rival.counterIntel -= 15;
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
    
    // Sabotage requires higher spy power threshold (1.5x target power)
    const requiredPower = isSabotage ? targetSpyPower * 1.5 : targetSpyPower;
    success = myEffectiveSpyPower >= requiredPower;

    // Intelligence gathering missions
    if (action === 'military') {
        if (success) {
            intel = `MILITARY: Power ${target.power} | ${target.shardbearers} Shardbearers | ${target.spearmen} Spearmen`;
            gainInfo = 'Intel gathered';
            // Gathering intel also builds counter intel on the rival
            rival.counterIntel += 5;
        }
    } else if (action === 'resources') {
        if (success) {
            intel = `RESOURCES: ${target.spheres} Spheres | ${target.gemhearts} Gemhearts | ${target.provisions} Provisions`;
            gainInfo = 'Intel gathered';
            rival.counterIntel += 5;
        }
    } else if (action === 'fabrials') {
        if (success) {
            intel = `TECHNOLOGY: ${target.fabrials.join(", ")}`;
            gainInfo = 'Intel gathered';
            rival.counterIntel += 5;
        }
    } else if (action === 'counter_intel') {
        // New action: gather counter intel on the rival
        if (success) {
            intel = `COUNTER INTELLIGENCE`;
            const gain = Math.floor(15 + Math.random() * 10);
            gainInfo = `+${gain} counter intel`;
            rival.counterIntel += gain;
        }
    } else if (action === 'agents') {
        if (success) {
            intel = `AGENTS: ${target.agents}`;
            gainInfo = 'Intel gathered';
            rival.counterIntel += 5;
        }
    } else if (action === 'scan_champion') {
        if (success) {
            const fabrialsText = target.championFabrials && target.championFabrials.length > 0 
                ? target.championFabrials.join(", ") 
                : "None";
            intel = `CHAMPION: Level ${target.championLevel} | HP: ${target.championHP}/${target.championMaxHP} | Fabrials: ${fabrialsText}`;
            gainInfo = 'Intel gathered';
            rival.counterIntel += 5;
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
            // When we catch an agent, the target gets counter intel on us
            rival.counterIntel += 8;
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
