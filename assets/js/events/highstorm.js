// Highstorm event system - devastating weather events
import { BUILDING_DATA, CONSTANTS } from '../core/constants.js';
import { log, triggerNotification } from '../core/utils.js';
import { getBuildingCost } from '../buildings/buildings.js';
import { processCasualties } from '../military/military.js';
import { addReport } from '../ui/ui-manager.js';

// Track timeouts for UI effects
let stormOverlayTimeout = null;
let phase2Timeout = null;
let phase3Timeout = null;
let notificationUpdateInterval = null;

/**
 * Check if a highstorm should occur and trigger it
 * @param {Object} gameState - Current game state
 */
export function checkHighstorm(gameState) {
    const storm = gameState.state.highstorm;
    
    // If no storm tracking exists, initialize it
    if (!storm) {
        gameState.state.highstorm = {
            lastStormDay: -10,
            daysSinceStorm: 10,
            nextStormProbability: 0
        };
        return;
    }
    
    storm.daysSinceStorm++;
    
    // Calculate highstorm probability
    if (storm.daysSinceStorm <= 3) {
        storm.nextStormProbability = 0; // Cannot happen 3 days after previous storm
    } else {
        // Increasing probability: 5% at day 4, then +5% each day
        storm.nextStormProbability = Math.min(0.5, (storm.daysSinceStorm - 3) * 0.05);
    }
    
    // Roll for highstorm
    if (Math.random() < storm.nextStormProbability) {
        triggerHighstorm(gameState);
    }
}

/**
 * Trigger a highstorm event with all effects
 * @param {Object} gameState - Current game state
 */
export function triggerHighstorm(gameState) {
    log("⚡ HIGHSTORM APPROACHING! ⚡", "text-cyan-300 font-bold text-lg bg-cyan-950 p-2 border border-cyan-500");
    triggerNotification("Highstorm", "A devastating highstorm strikes the Shattered Plains!");
    
    // Show visual storm effects with tiered notification system
    showHighstormNotification(gameState);
    
    // Update storm tracking
    gameState.state.highstorm.lastStormDay = gameState.state.dayCount;
    gameState.state.highstorm.daysSinceStorm = 0;
    gameState.state.highstorm.nextStormProbability = 0;
    gameState.state.highstorm.active = true;
    gameState.state.highstorm.effectsEndDay = gameState.state.dayCount + 2; // Effects last 2 days
    gameState.state.highstorm.triggerTime = Date.now(); // Track when the storm started
    
    let stormReport = [];
    let detailedEffects = []; // For the modal
    
    // EFFECT 1: Army Devastation
    const armyDamage = processArmyDamage(gameState);
    if (armyDamage.casualties > 0) {
        stormReport.push(`Lost ${armyDamage.casualties} troops in deployed forces`);
        detailedEffects.push({
            type: 'army',
            icon: '💀',
            title: 'ARMY CASUALTIES',
            description: `Lost ${armyDamage.casualties} troops in deployed missions`,
            severity: 'negative'
        });
    } else if (armyDamage.protected) {
        detailedEffects.push({
            type: 'army',
            icon: '🛡️',
            title: 'ARMY PROTECTED',
            description: 'Chull units absorbed all storm damage to deployed forces',
            severity: 'positive'
        });
    }
    
    // EFFECT 2: Building Destruction
    const buildingDamage = processBuildingDamage(gameState);
    if (buildingDamage.destroyedCount > 0) {
        stormReport.push(`${buildingDamage.destroyedCount} buildings destroyed`);
        const destroyedList = buildingDamage.destroyedBuildings.map(b => getBuildingDisplayName(b)).join(', ');
        detailedEffects.push({
            type: 'building',
            icon: '💥',
            title: 'BUILDINGS DESTROYED',
            description: `${buildingDamage.destroyedCount} buildings destroyed: ${destroyedList}. Rebuild them at Logistics Command.`,
            severity: 'negative'
        });
    }

    if (buildingDamage.savedCount > 0) {
        stormReport.push(`${buildingDamage.savedCount} buildings saved by stormshelters`);
        detailedEffects.push({
            type: 'building',
            icon: '🛡️',
            title: 'STORMSHELTERS HELD',
            description: `${buildingDamage.savedCount} building${buildingDamage.savedCount !== 1 ? 's' : ''} avoided destruction due to stormshelters.`,
            severity: 'positive'
        });
    }
    
    // EFFECT 3: Fabrial Overcharge
    const fabrialEffects = processFabrialOvercharge(gameState);
    if (fabrialEffects.effects.length > 0) {
        stormReport.push(...fabrialEffects.effects);
        fabrialEffects.effects.forEach(effect => {
            const isPositive = effect.includes('overcharged') || effect.includes('supercharged');
            detailedEffects.push({
                type: 'fabrial',
                icon: isPositive ? '⚡' : '⚠️',
                title: isPositive ? 'FABRIAL BOOST' : 'FABRIAL BURNOUT',
                description: effect,
                severity: isPositive ? 'positive' : 'negative'
            });
        });
    }
    
    // EFFECT 4: Spy opportunities
    gameState.state.highstorm.spyBonusActive = true;
    gameState.state.highstorm.spyBonusEndDay = gameState.state.dayCount + 1; // 24 hours
    stormReport.push("Spy operations more effective (2x success for 1 day)");
    detailedEffects.push({
        type: 'spy',
        icon: '🕵️',
        title: 'SPY ADVANTAGE',
        description: 'Espionage operations have 2x effectiveness for 1 day',
        severity: 'positive'
    });
    
    // EFFECT 5: Black market discount
    gameState.state.highstorm.blackMarketDiscount = true;
    gameState.state.highstorm.blackMarketEndDay = gameState.state.dayCount + 2; // 48 hours
    stormReport.push("Black market gemhearts discounted (7,500 S for 2 days)");
    detailedEffects.push({
        type: 'market',
        icon: '💰',
        title: 'BLACK MARKET DISCOUNT',
        description: 'Gemhearts reduced from 10,000 S to 7,500 S for 2 days',
        severity: 'positive'
    });
    
    // EFFECT 6: Postpone tournament if active
    if (gameState.state.tournamentActive) {
        gameState.state.tournamentActive = false;
        gameState.state.highstorm.tournamentPostponed = true;
        stormReport.push("Tournament postponed by 3 days");
        detailedEffects.push({
            type: 'tournament',
            icon: '🏆',
            title: 'TOURNAMENT POSTPONED',
            description: 'Arena tournament delayed by 3 days due to storm',
            severity: 'neutral'
        });
    }
    
    // Store detailed effects for the modal
    gameState.state.highstorm.lastImpactEffects = detailedEffects;
    
    // Log all effects
    log("Highstorm effects: " + stormReport.join("; "), "text-cyan-400 text-xs");
    addReport(gameState, 'storm', `Highstorm struck! ${stormReport.join("; ")}`, { 
        type: 'highstorm',
        effects: stormReport 
    });
    
    // Show impact modal after a short delay (after phase 1)
    setTimeout(() => {
        showHighstormImpactModal(gameState);
    }, 11000); // 11 seconds - after the 10 second phase 1
}

/**
 * Process army casualties from highstorm
 * @param {Object} gameState - Current game state
 * @returns {Object} Summary of casualties
 */
function processArmyDamage(gameState) {
    let totalCasualties = 0;
    
    // Check all deployments
    gameState.state.deployments.forEach(deployment => {
        const units = deployment.units;
        
        // Calculate chull protection
        const chullCount = units.chulls || 0;
        const totalUnits = Object.values(units).reduce((sum, count) => sum + count, 0);
        const chullProtection = Math.min(0.5, chullCount * 0.05); // 5% reduction per chull, max 50%
        
        // Base casualty rate: 20-30% depending on deployment type
        let baseCasualtyRate = deployment.type === 'attack' ? 0.25 : 0.20;
        baseCasualtyRate *= (1 - chullProtection);
        
        // Process casualties
        const casualties = countCasualties(gameState, units, baseCasualtyRate);
        totalCasualties += casualties;
        
        log(`Deployment took ${casualties} casualties from highstorm (${Math.round(chullProtection * 100)}% protected by chulls).`, "text-orange-400 text-xs");
    });
    
    // Check active plateau run
    if (gameState.state.activeRun && gameState.state.activeRun.playerForces) {
        const units = gameState.state.activeRun.playerForces.units;
        
        // Plateau runs are hit hardest (40% base rate)
        const chullCount = units.chulls || 0;
        const chullProtection = Math.min(0.5, chullCount * 0.05);
        let baseCasualtyRate = 0.40 * (1 - chullProtection);
        
        const casualties = countCasualties(gameState, units, baseCasualtyRate);
        totalCasualties += casualties;
        
        log(`Plateau run forces devastated: ${casualties} casualties from highstorm!`, "text-red-400 text-xs");
    }
    
    const hasDeployments = gameState.state.deployments.length > 0 || (gameState.state.activeRun && gameState.state.activeRun.playerForces);
    return { casualties: totalCasualties, protected: hasDeployments && totalCasualties === 0 };
}

/**
 * Count and process casualties for a unit group
 */
function countCasualties(gameState, units, baseRate) {
    let count = 0;
    for (let unitType in units) {
        const unitCount = units[unitType];
        let lost = 0;
        
        let effectiveRate = baseRate;
        if (unitType === 'shardbearers') effectiveRate = 0.01; // Shardbearers very resistant
        if (unitType === 'bridgecrews') effectiveRate = Math.min(0.9, baseRate * 3); // Bridgecrews vulnerable
        
        for (let i = 0; i < unitCount; i++) {
            if (Math.random() < effectiveRate) lost++;
        }
        
        if (lost > 0) {
            gameState.state.military[unitType] = Math.max(0, gameState.state.military[unitType] - lost);
            count += lost;
            
            if (unitType === 'shardbearers') {
                log("⚠️ A SHARDBEARER LOST IN THE STORM! ⚠️", "text-red-600 font-bold bg-red-950 p-1 border border-red-500");
            }
        }
    }
    return count;
}

/**
 * Destroy random buildings
 * @param {Object} gameState - Current game state
 * @returns {Object} Summary of destruction
 */
function processBuildingDamage(gameState) {
    // Build per-building list (markets and bunkers only)
    const ownedBuildings = [];
    const destroyable = ['market', 'soulcaster'];
    destroyable.forEach(building => {
        const count = gameState.state.buildings[building] || 0;
        for (let i = 0; i < count; i++) ownedBuildings.push(building);
    });

    if (ownedBuildings.length === 0) {
        return { destroyedCount: 0, destroyedBuildings: [], savedCount: 0, savedBuildings: [] };
    }

    // Roll 5% destruction chance per building
    const wouldDestroy = [];
    ownedBuildings.forEach(building => {
        if (Math.random() < 0.05) wouldDestroy.push(building);
    });

    if (wouldDestroy.length === 0) {
        return { destroyedCount: 0, destroyedBuildings: [], savedCount: 0, savedBuildings: [] };
    }

    // Apply stormshelter protection (1:1)
    const stormshelterCount = gameState.state.buildings.stormshelter || 0;
    const shuffled = wouldDestroy.sort(() => Math.random() - 0.5);
    const savedBuildings = shuffled.slice(0, Math.min(stormshelterCount, shuffled.length));
    const toBeDestroyed = shuffled.slice(savedBuildings.length);

    const destroyedList = [];
    toBeDestroyed.forEach(building => {
        gameState.state.buildings[building] = Math.max(0, gameState.state.buildings[building] - 1);
        destroyedList.push(building);
        const buildingName = getBuildingDisplayName(building);
        log(`${buildingName} destroyed by highstorm!`, "text-red-400 text-xs");
    });

    if (savedBuildings.length > 0) {
        log(`${savedBuildings.length} building${savedBuildings.length !== 1 ? 's' : ''} protected by stormshelters.`, "text-green-400 text-xs");
    }

    return {
        destroyedCount: destroyedList.length,
        destroyedBuildings: destroyedList,
        savedCount: savedBuildings.length,
        savedBuildings: savedBuildings
    };
}

/**
 * Process fabrial overcharge effects
 * @param {Object} gameState - Current game state
 * @returns {Object} Summary of effects
 */
function processFabrialOvercharge(gameState) {
    const effects = [];
    
    // Only affect Gravity Rigs and Arena Fabrials
    const gravityRigs = gameState.state.fabrials.gravity_lift || 0;
    const arenaFabrials = (gameState.state.fabrials.regen_plate || 0) + 
                          (gameState.state.fabrials.thrill_amp || 0) + 
                          (gameState.state.fabrials.half_shard || 0);
    
    // Gravity Rig Overcharge (60% positive, 40% negative)
    if (gravityRigs > 0) {
        if (Math.random() < 0.6) {
            // Positive: 3x speed boost for 3 days
            gameState.state.highstorm.gravityBoostActive = true;
            gameState.state.highstorm.gravityBoostEndDay = gameState.state.dayCount + 3;
            effects.push("Gravity Rigs overcharged (+3x speed for 3 days)");
            log("⚡ Gravity Rigs overcharged by storm energy! +3x speed for next deployment.", "text-purple-400 font-bold");
        } else {
            // Negative: Burnout for 3 days
            gameState.state.highstorm.gravityBurnout = true;
            gameState.state.highstorm.gravityBurnoutEndDay = gameState.state.dayCount + 3;
            effects.push("Gravity Rigs burned out (disabled for 3 days)");
            log("⚠️ Gravity Rigs overloaded and burned out! Disabled for 3 days.", "text-red-400");
        }
    }
    
    // Arena Fabrial Overcharge (60% positive, 40% negative)
    if (arenaFabrials > 0) {
        if (Math.random() < 0.6) {
            // Positive: Double activations for 3 days
            gameState.state.highstorm.arenaBoostActive = true;
            gameState.state.highstorm.arenaBoostEndDay = gameState.state.dayCount + 3;
            effects.push("Arena fabrials supercharged (2 uses/day for 3 days)");
            log("⚡ Arena fabrials supercharged! Can use twice per day for 3 days.", "text-purple-400 font-bold");
        } else {
            // Negative: One random arena fabrial burns out
            const burnoutOptions = [];
            if (gameState.state.fabrials.regen_plate > 0) burnoutOptions.push('regen_plate');
            if (gameState.state.fabrials.thrill_amp > 0) burnoutOptions.push('thrill_amp');
            if (gameState.state.fabrials.half_shard > 0) burnoutOptions.push('half_shard');
            
            if (burnoutOptions.length > 0) {
                const burnedFabrial = burnoutOptions[Math.floor(Math.random() * burnoutOptions.length)];
                if (!gameState.state.highstorm.burnedFabrials) {
                    gameState.state.highstorm.burnedFabrials = {};
                }
                gameState.state.highstorm.burnedFabrials[burnedFabrial] = gameState.state.dayCount + 3;
                
                const fabrialNames = {
                    regen_plate: 'Regeneration Plate',
                    thrill_amp: 'Thrill Amplifier',
                    half_shard: 'Half-Shard'
                };
                effects.push(`${fabrialNames[burnedFabrial]} burned out (3 days)`);
                log(`⚠️ ${fabrialNames[burnedFabrial]} overloaded! Disabled for 3 days.`, "text-red-400");
            }
        }
    }
    
    return { effects };
}

/**
 * Update highstorm effects each day
 * @param {Object} gameState - Current game state
 */
export function updateHighstormEffects(gameState) {
    const storm = gameState.state.highstorm;
    if (!storm) return;
    
    const currentDay = gameState.state.dayCount;
    
    // Clear main storm effects
    if (storm.effectsEndDay && currentDay >= storm.effectsEndDay) {
        storm.active = false;
        hideStormOverlay();
        hideHighstormNotification();
        log("☀️ The highstorm has passed. Skies clear...", "text-cyan-400 text-xs");
    }
    
    // Clear spy bonus
    if (storm.spyBonusEndDay && currentDay >= storm.spyBonusEndDay) {
        storm.spyBonusActive = false;
        log("Storm chaos subsiding - spy operations return to normal.", "text-slate-400 text-xs");
    }
    
    // Clear black market discount
    if (storm.blackMarketEndDay && currentDay >= storm.blackMarketEndDay) {
        storm.blackMarketDiscount = false;
        log("Black market prices return to normal.", "text-slate-400 text-xs");
    }
    
    // Clear gravity boost
    if (storm.gravityBoostEndDay && currentDay >= storm.gravityBoostEndDay) {
        storm.gravityBoostActive = false;
        log("Gravity Rig overcharge dissipated.", "text-slate-400 text-xs");
    }
    
    // Clear gravity burnout
    if (storm.gravityBurnoutEndDay && currentDay >= storm.gravityBurnoutEndDay) {
        storm.gravityBurnout = false;
        log("Gravity Rigs repaired and operational.", "text-green-400 text-xs");
    }
    
    // Clear arena boost
    if (storm.arenaBoostEndDay && currentDay >= storm.arenaBoostEndDay) {
        storm.arenaBoostActive = false;
        log("Arena fabrial overcharge faded.", "text-slate-400 text-xs");
    }
    
    // Clear burned fabrials
    if (storm.burnedFabrials) {
        for (let fabrial in storm.burnedFabrials) {
            if (currentDay >= storm.burnedFabrials[fabrial]) {
                delete storm.burnedFabrials[fabrial];
                const fabrialNames = {
                    regen_plate: 'Regeneration Plate',
                    thrill_amp: 'Thrill Amplifier',
                    half_shard: 'Half-Shard'
                };
                log(`${fabrialNames[fabrial]} repaired and operational.`, "text-green-400 text-xs");
            }
        }
    }
    
    // Restore postponed tournament after 3 days
    if (storm.tournamentPostponed && currentDay >= storm.lastStormDay + 3) {
        storm.tournamentPostponed = false;
        // Don't auto-restart tournament - let normal schedule handle it
    }
}

/**
 * Get chull protection bonus for a unit group
 * @param {Object} units - Unit composition
 * @returns {number} Protection multiplier (0-0.5)
 */
export function getChullProtection(units) {
    const chullCount = units.chulls || 0;
    return Math.min(0.5, chullCount * 0.05); // 5% per chull, max 50%
}

/**
 * Check if highstorm spy bonus is active
 * @param {Object} gameState - Current game state
 * @returns {boolean}
 */
export function isSpyBonusActive(gameState) {
    return gameState.state.highstorm?.spyBonusActive === true;
}

/**
 * Check if black market discount is active
 * @param {Object} gameState - Current game state
 * @returns {boolean}
 */
export function isBlackMarketDiscountActive(gameState) {
    return gameState.state.highstorm?.blackMarketDiscount === true;
}

/**
 * Check if gravity rig boost is active
 * @param {Object} gameState - Current game state
 * @returns {boolean}
 */
export function isGravityBoostActive(gameState) {
    return gameState.state.highstorm?.gravityBoostActive === true && !isGravityBurnout(gameState);
}

/**
 * Check if gravity rig is burned out
 * @param {Object} gameState - Current game state
 * @returns {boolean}
 */
export function isGravityBurnout(gameState) {
    return gameState.state.highstorm?.gravityBurnout === true;
}

/**
 * Check if arena fabrial boost is active
 * @param {Object} gameState - Current game state
 * @returns {boolean}
 */
export function isArenaBoostActive(gameState) {
    return gameState.state.highstorm?.arenaBoostActive === true;
}

/**
 * Check if a specific arena fabrial is burned out
 * @param {Object} gameState - Current game state
 * @param {string} fabrialType - Fabrial key
 * @returns {boolean}
 */
export function isFabrialBurnedOut(gameState, fabrialType) {
    return gameState.state.highstorm?.burnedFabrials?.[fabrialType] > gameState.state.dayCount;
}

/**
 * Show tiered highstorm notification system
 * Phase 1 (0-10s): Full screen flashing overlay
 * Phase 2 (10s-10m): Top banner alert with pulse
 * Phase 3 (10m-end): Small persistent banner
 */
export function showHighstormNotification(gameState) {
    const notif = document.getElementById('highstorm-notification');
    if (!notif) return;
    
    const phase1 = document.getElementById('highstorm-phase1');
    const phase2 = document.getElementById('highstorm-phase2');
    const phase3 = document.getElementById('highstorm-phase3');
    
    notif.classList.remove('hidden');
    
    // Clear any existing timeouts
    if (stormOverlayTimeout) clearTimeout(stormOverlayTimeout);
    if (phase2Timeout) clearTimeout(phase2Timeout);
    if (phase3Timeout) clearTimeout(phase3Timeout);
    if (notificationUpdateInterval) clearInterval(notificationUpdateInterval);
    
    // PHASE 1: Full screen overlay (10 seconds)
    if (phase1) {
        phase1.classList.remove('hidden');
        phase2.classList.add('hidden');
        phase3.classList.add('hidden');
    }
    
    // Show screen overlay effect
    showStormOverlay();
    
    // Transition to Phase 2 after 10 seconds
    phase2Timeout = setTimeout(() => {
        if (phase1) phase1.classList.add('hidden');
        if (phase2) phase2.classList.remove('hidden');
        
        // Start updating time remaining
        updateHighstormPhase2Time(gameState);
        notificationUpdateInterval = setInterval(() => updateHighstormPhase2Time(gameState), 1000);
        
        // Transition to Phase 3 after 10 minutes
        phase3Timeout = setTimeout(() => {
            if (phase2) phase2.classList.add('hidden');
            if (phase3) phase3.classList.remove('hidden');
            
            if (notificationUpdateInterval) clearInterval(notificationUpdateInterval);
            startPhase3Updates(gameState);
        }, 600000); // 10 minutes
    }, 10000); // 10 seconds
}

/**
 * Update Phase 2 time display
 */
function updateHighstormPhase2Time(gameState) {
    const timeEl = document.getElementById('highstorm-time-remaining');
    if (!timeEl) return;
    
    const effectsEndDay = gameState.state.highstorm?.effectsEndDay;
    const currentDay = gameState.state.dayCount;
    
    if (!effectsEndDay || currentDay >= effectsEndDay) {
        timeEl.textContent = 'Ending soon';
        return;
    }
    
    const daysRemaining = effectsEndDay - currentDay;
    timeEl.textContent = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
}

/**
 * Start Phase 3 updates (small persistent banner)
 */
function startPhase3Updates(gameState) {
    const timeEl = document.getElementById('highstorm-phase3-time');
    if (!timeEl) return;
    
    // Update every second
    notificationUpdateInterval = setInterval(() => {
        const effectsEndDay = gameState.state.highstorm?.effectsEndDay;
        const currentDay = gameState.state.dayCount;
        
        if (!effectsEndDay || currentDay >= effectsEndDay) {
            // Storm effects have ended, hide notification
            hideHighstormNotification();
            if (notificationUpdateInterval) clearInterval(notificationUpdateInterval);
            return;
        }
        
        const daysRemaining = effectsEndDay - currentDay;
        timeEl.textContent = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
    }, 1000);
}

/**
 * Hide the highstorm notification
 */
export function hideHighstormNotification() {
    const notif = document.getElementById('highstorm-notification');
    if (notif) notif.classList.add('hidden');
    
    // Clear all timeouts
    if (stormOverlayTimeout) clearTimeout(stormOverlayTimeout);
    if (phase2Timeout) clearTimeout(phase2Timeout);
    if (phase3Timeout) clearTimeout(phase3Timeout);
    if (notificationUpdateInterval) clearInterval(notificationUpdateInterval);
}

/**
 * Show flashing storm overlay effect (10 seconds)
 */
export function showStormOverlay() {
    // Clear any existing timeout
    if (stormOverlayTimeout) clearTimeout(stormOverlayTimeout);
    
    const overlay = document.getElementById('screen-overlay');
    if (overlay) {
        overlay.innerHTML = '<div class="highstorm-overlay"></div>';
        overlay.classList.add('highstorm-active');
        
        // Also add storm effect to the game container if it exists
        const gameContainer = document.getElementById('game-container');
        if (gameContainer && !gameContainer.classList.contains('highstorm-active')) {
            gameContainer.classList.add('highstorm-active');
        }
    }
    
    // Auto-hide after 10 seconds of real time
    stormOverlayTimeout = setTimeout(() => {
        hideStormOverlay();
        stormOverlayTimeout = null;
    }, 10000);
}

/**
 * Hide flashing storm overlay effect
 */
export function hideStormOverlay() {
    // Clear any pending timeout
    if (stormOverlayTimeout) clearTimeout(stormOverlayTimeout);
    stormOverlayTimeout = null;
    
    const overlay = document.getElementById('screen-overlay');
    if (overlay) {
        overlay.innerHTML = '';
        overlay.classList.remove('highstorm-active');
    }
    
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.classList.remove('highstorm-active');
    }
}

/**
 * Show highstorm impact modal with personalized effects
 * @param {Object} gameState - Current game state
 */
export function showHighstormImpactModal(gameState) {
    const modal = document.getElementById('highstorm-impact-modal');
    const content = document.getElementById('highstorm-impact-content');
    
    if (!modal || !content) return;
    
    const effects = gameState.state.highstorm.lastImpactEffects || [];
    
    if (effects.length === 0) {
        content.innerHTML = '<div class="text-slate-400 text-center p-4">No significant effects on your warcamp.</div>';
        modal.classList.add('open');
        return;
    }
    
    // Build modal content
    let html = '';
    
    effects.forEach(effect => {
        const colorClass = effect.severity === 'positive' ? 'border-green-700/50 bg-green-900/20' : 
                          effect.severity === 'negative' ? 'border-red-700/50 bg-red-900/20' : 
                          'border-slate-700/50 bg-slate-900/20';
        
        const titleColor = effect.severity === 'positive' ? 'text-green-400' : 
                          effect.severity === 'negative' ? 'text-red-400' : 
                          'text-cyan-400';
        
        html += `
            <div class="border ${colorClass} p-3 rounded">
                <div class="flex items-start gap-2">
                    <span class="text-2xl">${effect.icon}</span>
                    <div class="flex-1">
                        <div class="font-bold ${titleColor} text-sm mb-1">${effect.title}</div>
                        <div class="text-slate-300 text-xs">${effect.description}</div>
                        ${effect.action === 'repair' ? `
                            <button onclick="game.openBuildingRepairInterface()" class="mt-2 text-xs bg-orange-700 hover:bg-orange-600 px-3 py-1 rounded font-bold transition-colors">
                                Repair Buildings
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
    modal.classList.add('open');
}

function getBuildingDisplayName(buildingKey) {
    const nameMap = {
        market: 'Grand Market',
        soulcaster: 'Soulcast Bunkers',
        shelter: 'Bunkers',
        stormshelter: 'Stormshelter'
    };

    return nameMap[buildingKey] || buildingKey.replace(/_/g, ' ');
}