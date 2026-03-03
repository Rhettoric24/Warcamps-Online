// Deployment and mission management module
import { UNIT_STATS, CONSTANTS, NPC_PRINCES } from '../core/constants.js';
import { log, triggerNotification } from '../core/utils.js';
import { getCurrentGameTime } from '../core/server-api.js';
import { processCasualties, getAvailableTroops, getArcherProtection } from '../military/military.js';
import { simulateNPCJoin } from './plateau-runs.js';
import { resolveSpy } from '../espionage/espionage.js';
import { addReport } from '../ui/ui-manager.js';
import { isGravityBoostActive, isGravityBurnout } from './highstorm.js';
import { calculateEnemyPower, calculateLandReward, calculateNPCPower, calculateLandUsed, handlePlayerLandLoss } from './conquest.js';
import { SERVER_URL, authFetch } from '../core/auth.js';
import { claimLand, applyActionResult } from '../core/actions.js';

const DEPLOYMENT_UNITS = ['bridgecrews', 'spearmen', 'archers', 'shardbearers', 'chulls'];

function clampDeployValue(value, max) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, Math.max(0, max));
}

function setDeployUnitValue(unit, value, gameState, shouldUpdate = true) {
    const input = document.getElementById(`deploy-${unit}`);
    const slider = document.getElementById(`deploy-${unit}-slider`);
    if (!input) return;

    const inputMax = parseInt(input.max, 10) || 0;
    const sliderMax = slider ? (parseInt(slider.max, 10) || 0) : inputMax;
    const max = Math.min(inputMax, sliderMax);
    const clamped = clampDeployValue(value, max);

    input.value = clamped;
    if (slider) slider.value = clamped;

    if (shouldUpdate) {
        updateMissionInfo(gameState);
    }
}

function isPlayerTarget(target) {
    return typeof target === 'string' && target.startsWith('player:');
}

function extractPlayerUsername(target) {
    return isPlayerTarget(target) ? target.slice('player:'.length) : '';
}

function calculatePublicPlayerPower(playerData) {
    const units = {
        bridgecrews: playerData?.military_bridgecrews || 0,
        spearmen: playerData?.military_spearmen || 0,
        archers: playerData?.military_archers || 0,
        shardbearers: playerData?.military_shardbearers || 0,
        chulls: playerData?.military_chulls || 0
    };

    let power = 0;
    for (const unitType of Object.keys(units)) {
        power += units[unitType] * (UNIT_STATS[unitType]?.power || 0);
    }

    if (units.shardbearers > 0) {
        power *= (UNIT_STATS.shardbearers.multiplier * units.shardbearers);
    }

    return Math.floor(power);
}

async function fetchPlayerConquestProfile(username) {
    if (!username) return null;

    try {
        const response = await fetch(`${SERVER_URL}/api/player/${encodeURIComponent(username)}`);
        const result = await response.json();
        if (!response.ok || !result.success || !result.player) return null;

        return {
            username,
            power: calculatePublicPlayerPower(result.player),
            maxLand: Number.isFinite(result.player.max_land) ? result.player.max_land : 25,
            totalMilitary: (result.player.military_bridgecrews || 0) + (result.player.military_spearmen || 0) + (result.player.military_archers || 0) + (result.player.military_chulls || 0) + (result.player.military_shardbearers || 0)
        };
    } catch (error) {
        console.warn('Failed to fetch player conquest profile:', error);
        return null;
    }
}

async function refreshConquestPlayerTargets(gameState) {
    const targetSelect = document.getElementById('conquest-target');
    if (!targetSelect) return;

    const previousValue = targetSelect.value;
    gameState.state.conquestPlayerTargets = gameState.state.conquestPlayerTargets || {};

    try {
        const response = await authFetch(`${SERVER_URL}/api/players?limit=100&excludeSelf=true`);
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.players)) return;

        Array.from(targetSelect.options)
            .filter(option => isPlayerTarget(option.value))
            .forEach(option => option.remove());

        gameState.state.conquestPlayerTargets = {};
        for (const player of result.players) {
            const username = player.username;
            const targetValue = `player:${username}`;
            gameState.state.conquestPlayerTargets[username] = player;

            const option = document.createElement('option');
            option.value = targetValue;
            option.text = `${username} (Land: ${player.maxLand ?? '?'})`;
            targetSelect.appendChild(option);
        }

        if (previousValue && Array.from(targetSelect.options).some(option => option.value === previousValue)) {
            targetSelect.value = previousValue;
        }
    } catch (error) {
        console.warn('Failed to refresh conquest player targets:', error);
    }
}

async function executePlayerConquest(targetUsername, landAmount) {
    console.log(`📤 SENDING PvP CONQUEST: targetUsername=${targetUsername}, landAmount=${landAmount}`);

    try {
        const response = await authFetch(`${SERVER_URL}/api/conquest-land`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUsername, landAmount })
        });

        const result = await response.json();
        console.log(`📥 PvP CONQUEST RESPONSE:`, result);
        if (!response.ok || !result.success) {
            return { success: false, error: result.error || 'Land transfer failed' };
        }

        return {
            success: true,
            landTransferred: result.landTransferred || 0,
            attackerNewMaxLand: result.attackerNewMaxLand,
            targetNewMaxLand: result.targetNewMaxLand,
            buildingsDestroyed: result.buildingsDestroyed || []
        };
    } catch (error) {
        console.error('PvP conquest error:', error);
        return { success: false, error: error.message || 'Land transfer failed' };
    }
}

export function openDeployModal(gameState, type) {
    if (type === 'run') {
        if (!gameState.state.activeRun || gameState.state.activeRun.phase !== 'OPEN') {
            log("Deployment window is closed.", "text-red-400");
            return;
        }
        if (gameState.state.activeRun.playerForces) {
            log("You have already committed forces to this run.", "text-yellow-400");
            return;
        }
    }
    
    if (type === 'conquest') {
        // Check if enough resources
        if (gameState.state.spheres < 200) {
            log("Conquest requires 200 spheres.", "text-red-400");
            return;
        }
        // Show conquest target section
        const targetSection = document.getElementById('conquest-target-section');
        if (targetSection) {
            targetSection.classList.remove('hidden');
            
            // Update conquest target dropdown with current land values
            const targetSelect = document.getElementById('conquest-target');
            if (targetSelect) {
                const freeLandPool = gameState.state.freeLandPool || 0;
                targetSelect.options[0].text = `Free Land (Pool: ${freeLandPool})`;
                
                // Update NPC options with their current land
                let optionIndex = 1;
                for (const key in NPC_PRINCES) {
                    const npc = NPC_PRINCES[key];
                    const npcLand = gameState.state.npcState?.[key]?.maxLand ?? 25;
                    if (targetSelect.options[optionIndex]) {
                        targetSelect.options[optionIndex].text = `${npc.name} (Land: ${npcLand})`;
                        optionIndex++;
                    }
                }

                refreshConquestPlayerTargets(gameState).finally(() => updateMissionInfo(gameState));
            }
        }
        
        // Add event listener for target selection changes
        const targetSelect = document.getElementById('conquest-target');
        if (targetSelect) {
            targetSelect.removeEventListener('change', () => updateMissionInfo(gameState));
            targetSelect.addEventListener('change', () => updateMissionInfo(gameState));
        }
    } else {
        // Hide conquest target section for non-conquest missions
        const targetSection = document.getElementById('conquest-target-section');
        if (targetSection) targetSection.classList.add('hidden');
    }

    gameState.state.pendingDeployType = type;
    const avail = getAvailableTroops(gameState);

    DEPLOYMENT_UNITS.forEach(u => {
        const total = gameState.state.military[u];
        const available = avail[u] || 0;
        document.getElementById(`avail-modal-${u}`).innerText = `${available}/${total}`;
        const input = document.getElementById(`deploy-${u}`);
        const slider = document.getElementById(`deploy-${u}-slider`);
        const zeroBtn = document.getElementById(`deploy-${u}-zero`);
        const maxBtn = document.getElementById(`deploy-${u}-max`);
        if (!input) return;

        input.max = available;
        input.value = 0;

        if (slider) {
            slider.max = available;
            slider.value = 0;
        }

        if (zeroBtn) {
            zeroBtn.onclick = () => setDeployUnitValue(u, 0, gameState);
        }

        if (maxBtn) {
            maxBtn.onclick = () => setDeployUnitValue(u, available, gameState);
        }
    });

    const typeLabel = type === 'run' ? "PLATEAU RUN FORCE" : 
                      (type === 'scout' ? "SCOUTING PARTY" : 
                      (type === 'attack' ? "RAIDING WARBAND" : 
                      (type === 'conquest' ? "CONQUEST FORCE" : "DEPLOYMENT")));
    document.getElementById('deploy-type-label').innerText = typeLabel;
    
    // Add event listeners to update mission info when inputs change
    DEPLOYMENT_UNITS.forEach(u => {
        const input = document.getElementById(`deploy-${u}`);
        const slider = document.getElementById(`deploy-${u}-slider`);
        if (!input) return;

        input.oninput = () => {
            setDeployUnitValue(u, input.value, gameState);
        };

        if (slider) {
            slider.oninput = () => {
                setDeployUnitValue(u, slider.value, gameState);
            };
        }
    });
    
    // Initial update
    updateMissionInfo(gameState);
    
    document.getElementById('deploy-modal').classList.add('open');
}

export function updateMissionInfo(gameState) {
    const units = {};
    let totalUnits = 0;
    
    DEPLOYMENT_UNITS.forEach(u => {
        const input = document.getElementById(`deploy-${u}`);
        if (!input) {
            units[u] = 0;
            return;
        }

        const max = parseInt(input.max, 10) || 0;
        const val = clampDeployValue(input.value, max);
        input.value = val;

        const slider = document.getElementById(`deploy-${u}-slider`);
        if (slider) slider.value = val;

        units[u] = val;
        totalUnits += val;
    });
    
    // Calculate power
    let power = 0;
    for (let u in units) {
        const s = UNIT_STATS[u];
        power += units[u] * s.power;
    }
    
    // Apply shardbearer multiplier
    if (units.shardbearers > 0) {
        power *= (UNIT_STATS.shardbearers.multiplier * units.shardbearers);
    }
    
    // Calculate speed
    let speed = 1.0;
    let carry = 0;
    for (let u in units) {
        const s = UNIT_STATS[u];
        speed += (units[u] * s.speed);
        carry += (units[u] * s.carry);
    }
    
    // Apply gravity lift bonuses (check for burnout and boost)
    if (gameState.state.fabrials.gravity_lift > 0 && !isGravityBurnout(gameState)) {
        if (isGravityBoostActive(gameState)) {
            // Storm overcharge: 3x speed boost
            speed *= 3.0;
        } else {
            // Normal gravity lift effect
            speed *= (1 + (0.5 * gameState.state.fabrials.gravity_lift));
        }
    }
    speed = Math.max(0.1, speed);
    
    // Calculate estimated duration
    const type = gameState.state.pendingDeployType;
    const baseDays = type === 'scout' ? 1 : (type === 'attack' ? 1.5 : (type === 'conquest' ? 1 : 2));
    const durationMs = type === 'run'
        ? (baseDays * CONSTANTS.DAY_MS)
        : (baseDays * CONSTANTS.DAY_MS) / speed;
    const durationHours = (durationMs / 3600000).toFixed(1);
    const durationMinutes = Math.round(durationMs / 60000);
    
    // Calculate carry bonus and sphere estimates
    const carryBonus = 1 + (carry * 0.01);
    let sphereEstimate = '';
    
    if (type === 'scout') {
        const minSpheres = Math.floor(500 * carryBonus);
        const maxSpheres = Math.floor(1000 * carryBonus);
        sphereEstimate = `${minSpheres.toLocaleString()}-${maxSpheres.toLocaleString()}`;
    } else if (type === 'attack') {
        const minSpheres = Math.floor(500 * carryBonus);
        const maxSpheres = Math.floor(1500 * carryBonus);
        sphereEstimate = `${minSpheres.toLocaleString()}-${maxSpheres.toLocaleString()}`;
    } else if (type === 'conquest') {
        // Get selected conquest target
        const targetSelect = document.getElementById('conquest-target');
        const target = targetSelect ? targetSelect.value : 'freeland';
        
        let targetName;
        let targetLand = 0;
        
        if (target === 'freeland') {
            targetName = 'Free Land';
            targetLand = gameState.state.freeLandPool || 0;
        } else if (isPlayerTarget(target)) {
            const username = extractPlayerUsername(target);
            const cachedPlayer = gameState.state.conquestPlayerTargets?.[username];
            targetName = username;
            targetLand = cachedPlayer?.maxLand ?? -1;
        } else {
            const npc = NPC_PRINCES[target];
            targetName = npc ? npc.name : 'Unknown';
            targetLand = gameState.state.npcState?.[target]?.maxLand ?? 25;
        }
        
        // Don't reveal enemy power until after battle - just show target status
        if (targetLand === 0) {
            sphereEstimate = `${targetName} has no territory left to conquer.`;
        } else if (targetLand < 0) {
            sphereEstimate = `Preparing conquest against ${targetName}... (land intel unavailable)`;
        } else {
            sphereEstimate = `Preparing conquest against ${targetName}...`;
        }
    } else {
        sphereEstimate = 'Varies by coalition';
    }
    
    // Update display
    document.getElementById('deploy-info-units').textContent = totalUnits;
    document.getElementById('deploy-info-power').textContent = power.toFixed(1);
    document.getElementById('deploy-info-speed').textContent = `${(speed * 100).toFixed(0)}%`;
    document.getElementById('deploy-info-carry').textContent = carry;
    document.getElementById('deploy-info-carry-bonus').textContent = `+${((carryBonus - 1) * 100).toFixed(0)}%`;
    document.getElementById('deploy-info-sphere-estimate').textContent = sphereEstimate;
    
    // Show duration in appropriate format
    if (CONSTANTS.DAY_MS >= 3600000) {
        // Production mode (1 hour days)
        document.getElementById('deploy-info-duration').textContent = `${durationHours}h`;
    } else {
        // Dev mode (short days)
        document.getElementById('deploy-info-duration').textContent = `${durationMinutes}m`;
    }
    
    // Show unit composition
    const compositionEl = document.getElementById('deploy-info-composition');
    const unitList = [];
    for (let u in units) {
        if (units[u] > 0) {
            const name = u.charAt(0).toUpperCase() + u.slice(1);
            unitList.push(`${units[u]} ${name}`);
        }
    }
    
    if (unitList.length > 0) {
        compositionEl.innerHTML = unitList.map(item => `<div class="text-slate-300">• ${item}</div>`).join('');
    } else {
        compositionEl.innerHTML = '<div class="text-slate-500 italic">No units assigned</div>';
    }
}

export function closeDeployModal() {
    document.getElementById('deploy-modal').classList.remove('open');
}

export async function confirmDeploy(gameState) {
    const units = {};
    let total = 0;
    DEPLOYMENT_UNITS.forEach(u => {
        const input = document.getElementById(`deploy-${u}`);
        if (!input) {
            units[u] = 0;
            return;
        }

        const max = parseInt(input.max, 10) || 0;
        const val = clampDeployValue(input.value, max);
        input.value = val;

        const slider = document.getElementById(`deploy-${u}-slider`);
        if (slider) slider.value = val;

        units[u] = val;
        total += val;
    });

    if (total === 0) {
        log("You must assign at least one unit.", "text-red-400");
        return;
    }

    const avail = getAvailableTroops(gameState);
    for (let u in units) {
        if (units[u] > (avail[u] || 0)) {
            log(`Not enough ${u} available!`, "text-red-400");
            return;
        }
    }

    let power = 0;
    let speed = 1.0;
    let carry = 0;
    for (let u in units) {
        const s = UNIT_STATS[u];
        power += units[u] * s.power;
        if (s.multiplier) power *= (s.multiplier * units[u]);
        speed += (units[u] * s.speed);
        carry += (units[u] * s.carry);
    }

    if (gameState.state.fabrials.gravity_lift > 0 && !isGravityBurnout(gameState)) {
        if (isGravityBoostActive(gameState)) {
            speed *= 3.0;
        } else {
            speed *= (1 + (0.5 * gameState.state.fabrials.gravity_lift));
        }
    }
    speed = Math.max(0.1, speed);

    if (gameState.state.pendingDeployType === 'run' && gameState.state.activeRun) {
        gameState.state.activeRun.playerForces = { units, power, speed, carry };
        gameState.state.activeRun.participants.push({
            name: "You",
            power: power,
            speed: speed,
            carry: carry,
            isPlayer: true
        });
        updateRunButtonState(gameState);
        log(`Forces committed. Speed Rating: ${(speed * 100).toFixed(0)}%.`, "text-cyan-400");
        closeDeployModal();
        return;
    }
    
    if (gameState.state.pendingDeployType === 'conquest') {
        // Get selected conquest target
        const targetSelect = document.getElementById('conquest-target');
        const target = targetSelect ? targetSelect.value : 'freeland';

        // Hard guard: block conquest if target has no land left
        if (target === 'freeland') {
            const freeLandPool = gameState.state.freeLandPool || 0;
            if (freeLandPool <= 0) {
                log("Free land pool is fully depleted. Choose a rival target.", "text-red-400");
                return;
            }
        } else if (isPlayerTarget(target)) {
            const username = extractPlayerUsername(target);
            const cachedPlayer = gameState.state.conquestPlayerTargets?.[username];
            if (cachedPlayer && (cachedPlayer.maxLand || 0) <= 0) {
                log(`${username} has no territory left to conquer. Choose another target.`, "text-red-400");
                return;
            }
        } else {
            const npc = NPC_PRINCES[target];
            const rivalLand = gameState.state.npcState?.[target]?.maxLand ?? 25;
            if (npc && rivalLand <= 0) {
                log(`${npc.name} has no territory left to conquer. Choose another target.`, "text-red-400");
                return;
            }
        }

        // Check and deduct spheres
        if (gameState.state.spheres < 200) {
            log("Conquest requires 200 spheres.", "text-red-400");
            return;
        }
        gameState.state.spheres -= 200;
        
        let enemyPower;
        let targetName;
        let targetLand;
        
        if (target === 'freeland') {
            // Free land uses static enemy power calculation
            enemyPower = calculateEnemyPower(gameState.state.maxLand);
            targetName = 'Free Land';
            targetLand = gameState.state.freeLandPool || 0;
        } else if (isPlayerTarget(target)) {
            const targetUsername = extractPlayerUsername(target);
            const profile = await fetchPlayerConquestProfile(targetUsername);
            const cachedPlayer = gameState.state.conquestPlayerTargets?.[targetUsername];

            enemyPower = profile?.power ?? calculateEnemyPower(gameState.state.maxLand);
            targetName = targetUsername;
            targetLand = profile?.maxLand ?? cachedPlayer?.maxLand ?? 25;
        } else {
            // Player/NPC target uses their at-home power
            const npc = NPC_PRINCES[target];
            if (npc) {
                enemyPower = calculateNPCPower(target);
                targetName = npc.name;
                targetLand = gameState.state.npcState?.[target]?.maxLand ?? 25;
            } else {
                // Fallback for multiplayer (not yet implemented)
                enemyPower = calculateEnemyPower(gameState.state.maxLand);
                targetName = 'Unknown';
                targetLand = 25;
            }
        }
        
        const landReward = calculateLandReward(power, enemyPower);
        console.log(`⚔️  CONQUEST DEPLOYMENT: target=${targetName}, playerPower=${power}, enemyPower=${enemyPower}, landReward=${landReward}`);
        
        const baseDays = 1;
        const durationMs = ((baseDays * CONSTANTS.DAY_MS) / speed) * 24;
        const deployment = {
            id: getCurrentGameTime(),
            type: 'conquest',
            units: units,
            power: power,
            returnTime: getCurrentGameTime() + durationMs,
            startDay: new Date().toLocaleTimeString(),
            enemyPower: enemyPower,
            landReward: landReward,
            target: target,  // Store the target (freeland or npc key)
            targetName: targetName
        };
        
        gameState.state.deployments.push(deployment);
        const actualHours = (durationMs / 3600000).toFixed(1);
        log(`Conquest against ${targetName} deployed! Speed: ${(speed * 100).toFixed(0)}%. Return: ${actualHours} hrs.`, "text-cyan-400 font-bold");
        closeDeployModal();
        return;
    }

    const baseDays = gameState.state.pendingDeployType === 'scout' ? 1 : 1.5;
    const durationMs = ((baseDays * CONSTANTS.DAY_MS) / speed) * 24; // Convert real time to game time
    const deployment = {
        id: getCurrentGameTime(),
        type: gameState.state.pendingDeployType,
        units: units,
        returnTime: getCurrentGameTime() + durationMs,
        startDay: new Date().toLocaleTimeString()
    };

    gameState.state.deployments.push(deployment);
    const actualHours = (durationMs / 3600000).toFixed(1);
    log(`Army deployed for ${gameState.state.pendingDeployType}. Speed: ${(speed * 100).toFixed(0)}%. Return: ${actualHours} hrs.`, "text-blue-400");
    closeDeployModal();
}

export async function checkDeployments(gameState) {
    const now = getCurrentGameTime();
    const finished = gameState.state.deployments.filter(d => now >= d.returnTime);
    gameState.state.deployments = gameState.state.deployments.filter(d => now < d.returnTime);
    
    // Collect promises for async operations (PvP conquests)
    const resolutionPromises = [];
    
    for (const d of finished) {
        if (d.type === 'espionage') {
            resolveSpy(gameState, d);
        } else {
            // resolveMission initiates async conquest transfers
            // We track the promise to ensure state is synced after completion
            const promise = resolveMission(gameState, d);
            if (promise && promise.then) {
                resolutionPromises.push(promise);
            }
        }
    }
    
    // Wait for any async PvP operations to complete before returning
    // This ensures the game state is fully updated and ready to save
    if (resolutionPromises.length > 0) {
        try {
            await Promise.all(resolutionPromises);
        } catch (error) {
            console.error('Error during deployment resolution:', error);
        }
    }
}

export function resolveMission(gameState, deployment) {
    // For PvP conquests with async server calls, return a promise
    // For other missions, execute synchronously and return null
    
    let power = 0;
    let carry = 0;
    let unitsBefore = 0;

    for (let u in deployment.units) {
        const count = deployment.units[u];
        const stats = UNIT_STATS[u];
        power += count * stats.power;
        carry += count * stats.carry;
        unitsBefore += count;
        if (stats.multiplier && count > 0) power *= (stats.multiplier * count);
    }

    if (deployment.type === 'run') {
        // Plateau run resolution - synchronous
        const res = deployment.runResult;
        if (res.victory) {
            log(`CAMPAIGN VICTORY! Coalition Power ${Math.floor(res.totalPower)} crushed ${res.enemyPower}.`, "text-green-400 font-bold");
            if (res.gemheartWon) {
                gameState.state.gemhearts++;
                log(`GEMHEART SECURED! Your army was the fastest.`, "text-cyan-400 font-bold border-l-4 border-cyan-400 pl-2");
            } else {
                log(`${res.gemheartWinnerName} secured the Gemheart before you arrived.`, "text-yellow-500");
            }
            gameState.state.spheres += res.lootShare;
            log(`You returned with ${res.lootShare.toLocaleString()} spheres.`, "text-slate-300");
            
            // Check for archer protection
            const archerProtection = getArcherProtection(deployment.units);
            let casualtiesCount = 0;
            if (archerProtection > 0 && Math.random() < archerProtection) {
                log(`⚔️ ARCHERS PROTECTED THE FORCE! No casualties sustained (${Math.round(archerProtection * 100)}% archer protection).`, "text-green-400 font-bold");
            } else {
                const casualtyRate = 0.05;
                processCasualties(gameState, deployment.units, casualtyRate);
                casualtiesCount = Math.floor(unitsBefore * casualtyRate);
            }
            showPlateauRunResult(gameState, true, res.lootShare, casualtiesCount, res.gemheartWon, res.gemheartWinnerName);
        } else {
            log(`CAMPAIGN DEFEAT. The Parshendi (${res.enemyPower}) held the plateau.`, "text-red-500 font-bold");
            
            // Check for archer protection
            const archerProtection = getArcherProtection(deployment.units);
            let casualtiesCount = 0;
            if (archerProtection > 0 && Math.random() < archerProtection) {
                log(`⚔️ ARCHERS PROTECTED THE FORCE! Minimal casualties despite defeat (${Math.round(archerProtection * 100)}% archer protection).`, "text-green-400 font-bold");
            } else {
                const casualtyRate = 0.3;
                processCasualties(gameState, deployment.units, casualtyRate);
                log("Heavy casualties sustained in the rout.", "text-orange-500");
                casualtiesCount = Math.floor(unitsBefore * casualtyRate);
            }
            showPlateauRunResult(gameState, false, 0, casualtiesCount, false, null);
        }
        return null;
    }

    const carryBonus = 1 + (carry * 0.01);

    if (deployment.type === 'scout') {
        if (Math.random() > 0.1) {
            const baseSpheres = 500 + Math.floor(Math.random() * 500);
            const spheres = Math.floor(baseSpheres * carryBonus);
            gameState.state.spheres += spheres;
            log(`Scouts returned with ${spheres} spheres (Carry Bonus: ${(carryBonus - 1) * 100}%).`, "text-green-300");
            
            // Check for archer protection
            const archerProtection = getArcherProtection(deployment.units);
            let casualtiesCount = 0;
            if (archerProtection > 0 && Math.random() < archerProtection) {
                log(`⚔️ ARCHERS PROTECTED THE SCOUTS! No casualties (${Math.round(archerProtection * 100)}% archer protection).`, "text-green-400 font-bold");
            } else {
                const casualtyRate = 0.02;
                processCasualties(gameState, deployment.units, casualtyRate);
                casualtiesCount = Math.floor(unitsBefore * casualtyRate);
            }
            showMissionResult(gameState, 'scout', true, spheres, casualtiesCount);
        } else {
            log("Scouting party lost.", "text-red-500");
            
            // Check for archer protection (even in total loss)
            const archerProtection = getArcherProtection(deployment.units);
            let casualtiesCount = 0;
            if (archerProtection > 0 && Math.random() < archerProtection) {
                log(`⚔️ ARCHERS COVERED THE RETREAT! Force escaped intact (${Math.round(archerProtection * 100)}% archer protection).`, "text-green-400 font-bold");
            } else {
                const casualtyRate = 1.0;
                processCasualties(gameState, deployment.units, casualtyRate);
                casualtiesCount = unitsBefore;
            }
            showMissionResult(gameState, 'scout', false, 0, casualtiesCount);
        }
    } else if (deployment.type === 'attack') {
        const enemyPower = 50 + Math.floor(Math.random() * 50);
        if (power > enemyPower) {
            const baseLoot = Math.floor(Math.random() * 1000) + 500;
            const spheres = Math.floor(baseLoot * carryBonus);
            gameState.state.spheres += spheres;
            let msg = `Raid successful! Looted ${spheres} spheres.`;
            let gotGemheart = false;
            if (Math.random() < 0.15) {
                gameState.state.gemhearts++;
                msg += " AND A GEMHEART!";
                gotGemheart = true;
            }
            log(msg, "text-cyan-400 font-bold");
            
            // Check for archer protection
            const archerProtection = getArcherProtection(deployment.units);
            let casualtiesCount = 0;
            if (archerProtection > 0 && Math.random() < archerProtection) {
                log(`⚔️ ARCHERS PROTECTED THE RAIDERS! No casualties (${Math.round(archerProtection * 100)}% archer protection).`, "text-green-400 font-bold");
            } else {
                const casualtyRate = 0.1;
                processCasualties(gameState, deployment.units, casualtyRate);
                casualtiesCount = Math.floor(unitsBefore * casualtyRate);
            }
            showMissionResult(gameState, 'attack', true, spheres, casualtiesCount, gotGemheart);
        } else {
            log("Raid failed.", "text-red-500");
            
            // Check for archer protection (even in defeat)
            const archerProtection = getArcherProtection(deployment.units);
            let casualtiesCount = 0;
            if (archerProtection > 0 && Math.random() < archerProtection) {
                log(`⚔️ ARCHERS COVERED THE RETREAT! Minimal casualties (${Math.round(archerProtection * 100)}% archer protection).`, "text-green-400 font-bold");
            } else {
                const casualtyRate = 0.5;
                processCasualties(gameState, deployment.units, casualtyRate);
                log("Heavy losses in the retreat.", "text-orange-500");
                casualtiesCount = Math.floor(unitsBefore * casualtyRate);
            }
            showMissionResult(gameState, 'attack', false, 0, casualtiesCount);
        }
    } else if (deployment.type === 'conquest') {
        // Use stored power or recalculate
        const playerPower = deployment.power || power;
        const enemyPower = deployment.enemyPower;
        let landReward = deployment.landReward;
        
        console.log(`🏆 CONQUEST RESOLUTION: playerPower=${playerPower}, enemyPower=${enemyPower}, landReward=${landReward}, target=${deployment.target}`);
        
        // Deterministic conquest: attacker wins only if power strictly beats defender
        const victory = playerPower > enemyPower;
        console.log(`   Victory: ${victory}, targetName: ${deployment.targetName}`);
        
        // Safety check: ensure victory always gives at least 10 land
        if (victory && landReward < 10) {
            console.warn(`Victory with landReward < 10 detected. Fixing: ${landReward} → 10`);
            landReward = 10;
        }
        
        // Check for archer protection
        const archerProtection = getArcherProtection(deployment.units);
        let casualtiesCount = 0;
        let casualtyPercent = 0;
        
        if (archerProtection > 0 && Math.random() < archerProtection) {
            log(`⚔️ ARCHERS PROTECTED THE ARMY! No casualties (${Math.round(archerProtection * 100)}% archer protection).`, "text-green-400 font-bold");
            casualtiesCount = 0;
            casualtyPercent = 0;
        } else {
            // Calculate casualties
            let casualtyRate;
            if (victory) {
                casualtyRate = 0.08 + (Math.random() * 0.07); // 8-15%
            } else {
                casualtyRate = 0.25 + (Math.random() * 0.10); // 25-35%
            }
            
            processCasualties(gameState, deployment.units, casualtyRate);
            casualtiesCount = Math.floor(unitsBefore * casualtyRate);
            casualtyPercent = Math.floor(casualtyRate * 100);
        }
        
        // Process result
        if (victory && landReward > 0) {
            const target = deployment.target || 'freeland';
            const targetName = deployment.targetName || 'Free Land';
            let actualLandGained = landReward;
            
            if (target === 'freeland') {
                // Use server-authoritative endpoint to claim from free land pool
                return claimLand(landReward)
                    .then(result => {
                        if (!result.success) {
                            const error = result.error || 'Unknown error';
                            log(`Conquest battle won, but land claim failed: ${error}`, "text-yellow-400 font-bold");
                            showConquestResult(gameState, true, 0, casualtiesCount, playerPower, enemyPower);
                            return;
                        }

                        const actualLandGained = result.landClaimed || 0;
                        
                        // Update local state with server response
                        applyActionResult(gameState, result);
                        
                        if (actualLandGained < landReward) {
                            log(`Conquest Victory! Conquered ${actualLandGained} land from ${targetName} (${casualtyPercent}% casualties). Free land pool depleted!`, "text-green-400 font-bold");
                        } else {
                            log(`Conquest Victory! Conquered ${actualLandGained} land from ${targetName} (${casualtyPercent}% casualties). Max land: ${gameState.state.maxLand}`, "text-green-400 font-bold");
                        }
                        
                        showConquestResult(gameState, true, actualLandGained, casualtiesCount, playerPower, enemyPower);
                    })
                    .catch(error => {
                        console.error('Free land claim failed:', error);
                        log(`Conquest battle won, but land claim failed due to server error.`, "text-yellow-400 font-bold");
                        showConquestResult(gameState, true, 0, casualtiesCount, playerPower, enemyPower);
                    });
            } else {
                // Taking from NPC/player
                const npc = NPC_PRINCES[target];
                if (npc && gameState.state.npcState[target]) {
                    const available = gameState.state.npcState[target].maxLand ?? 25;
                    actualLandGained = Math.min(landReward, available);
                    gameState.state.npcState[target].maxLand = Math.max(0, available - actualLandGained);
                    gameState.state.maxLand += actualLandGained;
                    
                    log(`Conquest Victory! Conquered ${actualLandGained} land from ${targetName} (${casualtyPercent}% casualties). ${targetName}'s land: ${gameState.state.npcState[target].maxLand}, Your land: ${gameState.state.maxLand}`, "text-green-400 font-bold");
                    showConquestResult(gameState, true, actualLandGained, casualtiesCount, playerPower, enemyPower);
                    return; // Important: return to avoid falling through to duplicate showConquestResult
                } else {
                    const targetUsername = extractPlayerUsername(target);
                    console.log(`🎯 PvP Conquest: target='${target}', extractedUsername='${targetUsername}', landReward=${actualLandGained}`);

                    // Return a promise that resolves after the PvP conquest completes
                    return executePlayerConquest(targetUsername, actualLandGained)
                        .then(result => {
                            console.log(`✅ PvP conquest result:`, result);
                            if (!result.success) {
                                log(`Conquest battle won vs ${targetName}, but land transfer failed: ${result.error}`, "text-yellow-400 font-bold");
                                showConquestResult(gameState, true, 0, casualtiesCount, playerPower, enemyPower);
                                return;
                            }

                            const gainedLand = result.landTransferred || 0;
                            gameState.state.maxLand = Number.isFinite(result.attackerNewMaxLand)
                                ? result.attackerNewMaxLand
                                : (gameState.state.maxLand + gainedLand);

                            if (gameState.state.conquestPlayerTargets?.[targetUsername]) {
                                gameState.state.conquestPlayerTargets[targetUsername].maxLand = result.targetNewMaxLand;
                            }

                            const destroyedCount = (result.buildingsDestroyed || []).reduce((sum, item) => sum + (item.count || 0), 0);
                            const buildingNote = destroyedCount > 0 ? ` ${targetName} lost ${destroyedCount} buildings.` : '';
                            log(`Conquest Victory! Conquered ${gainedLand} land from ${targetName} (${casualtyPercent}% casualties). Your land: ${gameState.state.maxLand}.${buildingNote}`, "text-green-400 font-bold");
                            showConquestResult(gameState, true, gainedLand, casualtiesCount, playerPower, enemyPower);
                        })
                        .catch(error => {
                            console.error('❌ PvP conquest transfer failed:', error);
                            log(`Conquest battle won vs ${targetName}, but land transfer failed due to server error.`, "text-yellow-400 font-bold");
                            showConquestResult(gameState, true, 0, casualtiesCount, playerPower, enemyPower);
                        });
                }
            }
            
            // Note: All conquest branches (freeland, NPC, player) now return,
            // so this code is never reached
        } else if (victory) {
            const targetName = deployment.targetName || 'Unknown';
            log(`Conquest Victory against ${targetName}! But power too low to hold land (${casualtyPercent}% casualties).`, "text-yellow-400 font-bold");
            showConquestResult(gameState, true, 0, casualtiesCount, playerPower, enemyPower);
        } else {
            const targetName = deployment.targetName || 'Unknown';
            log(`Conquest Defeat against ${targetName}! No land gained (${casualtyPercent}% casualties).`, "text-orange-400 font-bold");
            showConquestResult(gameState, false, 0, casualtiesCount, playerPower, enemyPower);
        }
    }
}

function showMissionResult(gameState, type, success, spheres, casualties, gotGemheart = false) {
    const prefix = type === 'scout' ? 'scout' : 'attack';
    const modalId = `${prefix}-result-modal`;
    const statusId = `${prefix}-result-status`;
    const spheresId = `${prefix}-result-spheres`;
    const casualtiesId = `${prefix}-result-casualties`;
    
    const statusEl = document.getElementById(statusId);
    const spheresEl = document.getElementById(spheresId);
    const casualtiesEl = document.getElementById(casualtiesId);
    
    if (!statusEl || !spheresEl || !casualtiesEl) return;
    
    if (success) {
        statusEl.textContent = type === 'scout' ? '✓ SCOUTS REPORTED' : '✓ RAID SUCCESSFUL!';
        statusEl.className = 'text-lg font-bold text-green-400 mb-6';
    } else {
        statusEl.textContent = type === 'scout' ? '✗ SCOUTS LOST' : '✗ RAID FAILED';
        statusEl.className = 'text-lg font-bold text-red-400 mb-6';
    }
    
    spheresEl.textContent = `+${spheres.toLocaleString()}`;
    casualtiesEl.textContent = casualties.toString();
    
    // Add report to Spanreed Center
    const missionType = type === 'scout' ? 'Scout' : 'Attack';
    const reportMessage = success 
        ? `${missionType} mission successful. Gained ${spheres.toLocaleString()} spheres${gotGemheart ? ' and a GEMHEART' : ''}. ${casualties} casualties.`
        : `${missionType} mission failed. ${casualties} casualties.`;
    addReport(gameState, type, reportMessage, { success, spheres, casualties, gotGemheart });
    
    if (type === 'attack' && gotGemheart) {
        const gemEl = document.getElementById('attack-result-gemheart');
        if (gemEl) gemEl.classList.remove('hidden');
    } else if (type === 'attack') {
        const gemEl = document.getElementById('attack-result-gemheart');
        if (gemEl) gemEl.classList.add('hidden');
    }
    
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
}

function showPlateauRunResult(gameState, victory, spheres, casualties, playerGotGem, gemheartWinnerName) {
    const statusEl = document.getElementById('plateau-result-status');
    const spheresEl = document.getElementById('plateau-result-spheres');
    const casualtiesEl = document.getElementById('plateau-result-casualties');
    const gemEl = document.getElementById('plateau-result-gemheart');
    const otherWinnerEl = document.getElementById('plateau-result-other-winner');
    const otherWinnerNameEl = document.getElementById('plateau-other-winner-name');
    
    if (!statusEl || !spheresEl || !casualtiesEl) return;
    
    if (victory) {
        statusEl.textContent = '🏆 VICTORY! 🏆';
        statusEl.className = 'text-lg font-bold text-green-400 mb-6';
    } else {
        statusEl.textContent = '💔 DEFEAT 💔';
        statusEl.className = 'text-lg font-bold text-red-400 mb-6';
    }
    
    spheresEl.textContent = `+${spheres.toLocaleString()}`;
    casualtiesEl.textContent = casualties.toString();
    
    // Add report to Spanreed Center
    const reportMessage = victory 
        ? `Plateau campaign victorious! Gained ${spheres.toLocaleString()} spheres. ${casualties} casualties.${playerGotGem ? ' GEMHEART secured!' : gemheartWinnerName ? ` Gemheart went to ${gemheartWinnerName}.` : ''}`
        : `Plateau campaign ended in defeat. ${casualties} casualties.`;
    addReport(gameState, 'plateau', reportMessage, { victory, spheres, casualties, playerGotGem, gemheartWinnerName });
    
    if (playerGotGem) {
        gemEl.classList.remove('hidden');
        otherWinnerEl.classList.add('hidden');
    } else if (victory && gemheartWinnerName) {
        gemEl.classList.add('hidden');
        otherWinnerEl.classList.remove('hidden');
        otherWinnerNameEl.textContent = gemheartWinnerName;
    } else {
        gemEl.classList.add('hidden');
        otherWinnerEl.classList.add('hidden');
    }
    
    const modal = document.getElementById('plateau-result-modal');
    if (modal) modal.classList.add('show');
}

function showConquestResult(gameState, victory, landGained, casualties, playerPower, enemyPower) {
    const statusEl = document.getElementById('conquest-result-status');
    const landEl = document.getElementById('conquest-result-land');
    const casualtiesEl = document.getElementById('conquest-result-casualties');
    const powerEl = document.getElementById('conquest-result-power');
    const enemyEl = document.getElementById('conquest-result-enemy');
    
    if (!statusEl || !landEl || !casualtiesEl) return;
    
    if (victory) {
        statusEl.textContent = landGained > 0 ? '⚔️ CONQUEST VICTORY! ⚔️' : '⚔️ PYRRHIC VICTORY ⚔️';
        statusEl.className = landGained > 0 ? 'text-lg font-bold text-green-400 mb-6' : 'text-lg font-bold text-yellow-400 mb-6';
    } else {
        statusEl.textContent = '💔 CONQUEST FAILED 💔';
        statusEl.className = 'text-lg font-bold text-red-400 mb-6';
    }
    
    landEl.textContent = `+${landGained}`;
    casualtiesEl.textContent = casualties.toString();
    if (powerEl) powerEl.textContent = Math.floor(playerPower).toString();
    if (enemyEl) enemyEl.textContent = Math.floor(enemyPower).toString();
    
    // Add report to Spanreed Center
    const reportMessage = victory && landGained > 0
        ? `Conquest successful! Conquered ${landGained} territory. Power ${Math.floor(playerPower)} vs ${Math.floor(enemyPower)}. ${casualties} casualties. Max Land: ${gameState.state.maxLand}`
        : victory
        ? `Battle won but insufficient power to hold land. Power ${Math.floor(playerPower)} vs ${Math.floor(enemyPower)}. ${casualties} casualties.`
        : `Conquest failed. Enemy too strong. Power ${Math.floor(playerPower)} vs ${Math.floor(enemyPower)}. ${casualties} casualties.`;
    addReport(gameState, 'conquest', reportMessage, { victory, landGained, casualties, playerPower, enemyPower, maxLand: gameState.state.maxLand });
    
    const modal = document.getElementById('conquest-result-modal');
    if (modal) modal.classList.add('show');
}

export function updateRunButtonState(gameState) {
    const btn = document.getElementById('btn-muster');
    const actions = document.getElementById('plateau-actions');
    if (gameState.state.activeRun && gameState.state.activeRun.playerForces) {
        actions.innerHTML = `<p class="text-green-400 font-bold text-center text-xs border border-green-900 bg-green-900/20 p-2 rounded">FORCES COMMITTED</p>`;
    } else if (gameState.state.activeRun) {
        actions.innerHTML = `
            <p class="text-xs text-center text-slate-300 mb-2">Coalition forming. Muster your forces.</p>
            <button id="btn-muster" onclick="window.gameInstance.openDeployModal('run')" class="w-full btn-alethi py-3 rounded font-bold text-sm mb-2">
                MUSTER FORCES
            </button>
        `;
    }
}

export function recallMission(gameState) {
    const missionIndex = gameState.state.selectedMissionIndex;
    if (missionIndex === undefined || missionIndex === null) {
        log("No mission selected.", "text-red-400");
        return;
    }
    
    const mission = gameState.state.deployments[missionIndex];
    if (!mission) {
        log("Mission not found.", "text-red-400");
        return;
    }
    
    // Calculate remaining time
    const timeLeftMs = Math.max(0, mission.returnTime - getCurrentGameTime());
    
    if (timeLeftMs === 0) {
        log("Mission is already returning.", "text-yellow-400");
        return;
    }
    
    // Set new return time to 50% of remaining time
    const recallTimeMs = timeLeftMs * 0.5;
    mission.returnTime = getCurrentGameTime() + recallTimeMs;
    mission.recalled = true;
    
    const hrs = Math.floor(recallTimeMs / 3600000);
    const mins = Math.floor((recallTimeMs % 3600000) / 60000);
    
    let timeStr = `${Math.round(recallTimeMs / 1000)}s`;
    if (hrs > 0) timeStr = `${hrs}h ${mins}m`;
    else if (mins > 0) timeStr = `${mins}m`;
    
    const typeLabel = mission.type === 'espionage' ? 'Espionage mission' : `${mission.type} mission`;
    log(`⚠️ ${typeLabel} recalled! Forces returning in ${timeStr}.`, "text-orange-400 font-bold");
    
    // Close the details modal
    const modal = document.getElementById('mission-details-modal');
    if (modal) modal.classList.remove('open');
}
