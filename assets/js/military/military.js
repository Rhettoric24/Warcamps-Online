// Military recruitment and troop management module
import { UNIT_STATS } from '../core/constants.js';
import { log } from '../core/utils.js';
import { canRecruit } from '../core/validation.js';
import { getChullProtection } from '../events/highstorm.js';
import { getEffectiveBuildingBonus } from '../buildings/buildings.js';

export function getAvailableTroops(gameState) {
    const avail = { ...gameState.state.military };
    gameState.state.deployments.forEach(d => {
        for (let u in d.units) {
            if (avail[u]) avail[u] -= d.units[u];
        }
    });
    if (gameState.state.activeRun && gameState.state.activeRun.playerForces) {
        const committed = gameState.state.activeRun.playerForces.units;
        for (let u in committed) {
            if (avail[u]) avail[u] -= committed[u];
        }
    }
    return avail;
}

export function getArmyStats(gameState, availableOnly = false) {
    let basePower = 0;
    let totalCarry = 0;
    let speedMod = 1.0;
    let unitMultiplier = 1.0;
    let currentPop = 0;

    let counts = availableOnly ? getAvailableTroops(gameState) : gameState.state.military;

    for (const [unit, count] of Object.entries(counts)) {
        if (UNIT_STATS[unit]) {
            const stats = UNIT_STATS[unit];
            if (!stats.spy) {
                currentPop += count * (stats.provision || 1);
                basePower += count * stats.power;
                totalCarry += count * stats.carry;
                speedMod += count * stats.speed;
                if (stats.multiplier) {
                    for (let i = 0; i < count; i++) unitMultiplier *= stats.multiplier;
                }
            } else {
                currentPop += count * (stats.provision || 1);
            }
        }
    }

    const trainingBonus = 1 + (gameState.state.buildings.training_camp * 0.1 * getEffectiveBuildingBonus(gameState, 'training_camp')); // buildingData value
    const survivalBonus = gameState.state.buildings.monastery * 0.05 * getEffectiveBuildingBonus(gameState, 'monastery');
    
    let provisionCap = 150 + (gameState.state.buildings.soulcaster * 50 * getEffectiveBuildingBonus(gameState, 'soulcaster'));
    if (gameState.state.fabrials.heatrial > 0) {
        provisionCap *= (1 + (0.5 * gameState.state.fabrials.heatrial));
    }

    return {
        power: basePower * unitMultiplier * trainingBonus,
        carry: totalCarry,
        speed: Math.max(0.1, speedMod),
        pop: currentPop,
        cap: Math.floor(provisionCap),
        survivalBonus: survivalBonus
    };
}

export function getSpyPower(gameState) {
    let power = 0;
    if (gameState.state.military.noble) power += gameState.state.military.noble * 1; // UNIT_STATS.noble.spy
    if (gameState.state.military.spy) power += gameState.state.military.spy * 2;
    if (gameState.state.military.ghostblood) power += gameState.state.military.ghostblood * 5;
    return power;
}

export function recruit(gameState, type) {
    let amount = 1;
    if (['noble', 'spy', 'ghostblood'].includes(type)) {
        const spyInput = document.getElementById('recruit-amount-spy');
        if (spyInput) amount = Math.max(1, parseInt(spyInput.value) || 1);
    } else {
        const milInput = document.getElementById('recruit-amount');
        if (milInput) amount = Math.max(1, parseInt(milInput.value) || 1);
    }

    // Use validation framework (client-side feedback before server request)
    const validation = canRecruit(gameState, type, amount);
    if (!validation.valid) {
        log(validation.reason, "text-red-400");
        return;
    }

    // Deduct resources
    const resourceType = (type === 'shardbearers') ? 'gemhearts' : 'spheres';
    if (resourceType === 'gemhearts') {
        gameState.state.gemhearts -= validation.totalCost;
    } else {
        gameState.state.spheres -= validation.totalCost;
    }

    // Add units to military
    if (!gameState.state.military[type]) gameState.state.military[type] = 0;
    gameState.state.military[type] += amount;
    
    log(`Recruited ${amount} ${type}.`, "text-slate-300");
}

// Calculate archer protection chance (0 casualties)
export function getArcherProtection(units) {
    const archerCount = units.archers || 0;
    if (archerCount === 0) return 0;
    
    // Diminishing returns: 6% * sqrt(archerCount), capped at 90%
    // 10 archers = 19%, 25 = 30%, 50 = 42%, 100 = 60%, 200 = 85%
    const protection = Math.min(0.90, 0.06 * Math.sqrt(archerCount));
    return protection;
}

export function processCasualties(gameState, units, baseRate) {
    let report = [];
    let totalLost = 0;
    
    // Calculate chull protection
    const chullProtection = getChullProtection(units);
    const effectiveBaseRate = baseRate * (1 - chullProtection);
    
    for (let u in units) {
        const count = units[u];
        let lost = 0;
        let effectiveRate = effectiveBaseRate;
        if (u === 'shardbearers') effectiveRate = Math.min(effectiveBaseRate, 0.01);
        if (u === 'bridgecrews') effectiveRate = Math.min(0.9, effectiveBaseRate * 1.5);
        for (let i = 0; i < count; i++) {
            if (Math.random() < effectiveRate) lost++;
        }
        if (lost > 0) {
            gameState.state.military[u] = Math.max(0, gameState.state.military[u] - lost);
            totalLost += lost;
            report.push(`${lost} ${u}`);
            if (u === 'shardbearers') {
                log("A SHARDBEARER HAS FALLEN!", "text-red-600 font-bold bg-red-950 p-1 border border-red-500");
            }
        }
    }
    if (report.length > 0) {
        const protectionMsg = chullProtection > 0 ? ` (${Math.round(chullProtection * 100)}% protected by chulls)` : '';
        log(`Casualties: ${report.join(", ")}.${protectionMsg}`, "text-orange-500 text-xs");
    }
}
