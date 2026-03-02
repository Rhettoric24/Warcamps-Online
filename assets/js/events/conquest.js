// Conquest mission system - Players expand territory to build more
// Conquest missions are now integrated with the standard deployment system

import { CONSTANTS, NPC_PRINCES, UNIT_STATS, BUILDING_DATA } from '../core/constants.js';
import { getCurrentGameTime } from '../core/server-api.js';

/**
 * Calculate land used by buildings
 */
export function calculateLandUsed(buildings) {
    let used = 0;
    for (const building in buildings) {
        const data = BUILDING_DATA[building];
        if (data) {
            used += (buildings[building] || 0) * data.landCost;
        }
    }
    return used;
}

/**
 * Handle player losing land to conquest
 * Takes free land first, then destroys buildings based on tier system
 * Returns: { landTaken, buildingsDestroyed }
 */
export function handlePlayerLandLoss(gameState, landToTake) {
    const landUsed = calculateLandUsed(gameState.state.buildings);
    const freeLand = Math.max(0, gameState.state.maxLand - landUsed);
    
    let actualLandTaken = 0;
    let buildingsDestroyed = [];
    
    if (freeLand >= landToTake) {
        // Enough free land, just reduce maxLand
        actualLandTaken = landToTake;
        gameState.state.maxLand -= landToTake;
    } else {
        // Take all free land, then destroy buildings
        actualLandTaken = freeLand;
        gameState.state.maxLand -= freeLand;
        
        const landNeeded = landToTake - freeLand;
        let landFreed = 0;
        
        // Tier 1: Market and Soulcaster (random order)
        const tier1 = ['market', 'soulcaster'].sort(() => Math.random() - 0.5);
        for (const building of tier1) {
            while (gameState.state.buildings[building] > 0 && landFreed < landNeeded) {
                const destroyed = gameState.state.buildings[building];
                gameState.state.buildings[building]--;
                landFreed += BUILDING_DATA[building].landCost;
                buildingsDestroyed.push({ building, count: 1 });
            }
            if (landFreed >= landNeeded) break;
        }
        
        // Tier 2: Stormshelter
        if (landFreed < landNeeded) {
            while (gameState.state.buildings.stormshelter > 0 && landFreed < landNeeded) {
                gameState.state.buildings.stormshelter--;
                landFreed += BUILDING_DATA.stormshelter.landCost;
                buildingsDestroyed.push({ building: 'stormshelter', count: 1 });
            }
        }
        
        // Tier 3: Monastery and Training Camp (random order)
        if (landFreed < landNeeded) {
            const tier3 = ['monastery', 'training_camp'].sort(() => Math.random() - 0.5);
            for (const building of tier3) {
                while (gameState.state.buildings[building] > 0 && landFreed < landNeeded) {
                    gameState.state.buildings[building]--;
                    landFreed += BUILDING_DATA[building].landCost;
                    buildingsDestroyed.push({ building, count: 1 });
                }
                if (landFreed >= landNeeded) break;
            }
        }
        
        // Tier 4: Research Library (last resort)
        if (landFreed < landNeeded && gameState.state.buildings.research_library > 0) {
            gameState.state.buildings.research_library--;
            landFreed += BUILDING_DATA.research_library.landCost;
            buildingsDestroyed.push({ building: 'research_library', count: 1 });
        }
        
        actualLandTaken += Math.min(landFreed, landNeeded);
    }
    
    return { landTaken: actualLandTaken, buildingsDestroyed };
}

/**
 * Calculate enemy force power based on current max land
 * Formula: 80 + (maxLand - 25) * 2.5
 * At 25 land: 80 power
 * At 50 land: 142.5 power
 * At 100 land: 267.5 power
 */
export function calculateEnemyPower(maxLand) {
    return Math.floor(80 + (maxLand - 25) * 2.5);
}

/**
 * Calculate NPC "at home" power for conquest targeting
 * NPCs don't have active deployments, so this is their total military power
 */
export function calculateNPCPower(npcKey) {
    const npc = NPC_PRINCES[npcKey];
    if (!npc) return 0;
    
    const units = {
        bridgecrews: npc.bridgecrews || 0,
        spearmen: npc.spearmen || 0,
        archers: npc.archers || 0,
        shardbearers: npc.shardbearers || 0,
        chulls: npc.chulls || 0
    };
    
    let power = 0;
    for (let u in units) {
        const s = UNIT_STATS[u];
        power += units[u] * s.power;
    }
    
    // Apply shardbearer multiplier
    if (units.shardbearers > 0) {
        power *= (UNIT_STATS.shardbearers.multiplier * units.shardbearers);
    }
    
    return Math.floor(power);
}

/**
 * Calculate land reward based on victory margin
 * Tiered system makes it harder to reach higher rewards:
 * - 0-19 power margin: 10 land
 * - 20-49 power margin: 12 land
 * - 50-99 power margin: 15 land
 * - 100-249 power margin: 20 land
 * - 250+ power margin: 25 land
 */
export function calculateLandReward(playerPower, enemyPower) {
    if (playerPower <= enemyPower) {
        return 0; // No land on defeat
    }
    
    const margin = playerPower - enemyPower;
    
    // Tiered reward system - harder to farm land
    if (margin < 20) {
        return 10;
    } else if (margin < 50) {
        return 12;
    } else if (margin < 100) {
        return 15;
    } else if (margin < 250) {
        return 20;
    } else {
        return 25;
    }
}

/**
 * Get conquest status info from active deployments
 */
export function getConquestStatus(game) {
    const conquest = game.state.deployments.find(d => d.type === 'conquest');
    if (!conquest) {
        return null;
    }
    
    const now = getCurrentGameTime();
    const timeLeft = Math.max(0, conquest.returnTime - now);
    const totalTime = conquest.returnTime - getCurrentGameTime() + timeLeft;
    const progress = Math.floor(((totalTime - timeLeft) / totalTime) * 100);
    
    return {
        active: true,
        progress,
        timeLeft,
        enemyPower: conquest.enemyPower,
        landReward: conquest.landReward
    };
}

/**
 * Check if player can start a conquest
 */
export function canStartConquest(game) {
    const hasActiveConquest = game.state.deployments.some(d => d.type === 'conquest');
    if (hasActiveConquest) return false;
    return game.state.spheres >= 200;
}

