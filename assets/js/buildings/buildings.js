// Buildings and fabrials module
import { BUILDING_DATA, FABRIAL_DATA } from '../core/constants.js';
import { log } from '../core/utils.js';
import { canBuild, canConstructFabrial, canAffordResource } from '../core/validation.js';
import { isBlackMarketDiscountActive } from '../events/highstorm.js';
import { buildStructure, applyActionResult } from '../core/actions.js';

export function getBuildingCost(gameState, type) {
    const data = BUILDING_DATA[type];
    if (!data) return 0;
    if (data.scale === 'exponential') {
        const owned = gameState.state.buildings[type] || 0;
        return data.baseCost * Math.pow(2, Math.floor(owned / 10));
    }
    if (data.scale === 'linear') {
        const owned = gameState.state.buildings[type] || 0;
        return data.baseCost + (owned * 5000);
    }
    return data.baseCost;
}

export async function build(gameState, type) {
    const data = BUILDING_DATA[type];
    
    // Get bulk amount from input
    let amount = 1;
    const buildInput = document.getElementById('build-amount');
    if (buildInput) amount = Math.max(1, parseInt(buildInput.value) || 1);
    
    // Handle Whisper Tower (costs Ghostbloods instead of Spheres)
    if (type === 'whisper_tower') {
        if (data.max && gameState.state.buildings.whisper_tower >= data.max) {
            log("The Whisper Tower is already built.", "text-red-400");
            return;
        }
        if (gameState.state.military.ghostblood < 10) {
            log(`Insufficient Ghostbloods. Need 10, have ${gameState.state.military.ghostblood}.`, "text-red-400");
            return;
        }
        gameState.state.military.ghostblood -= 10;
        gameState.state.buildings.whisper_tower++;
        log("The Whisper Tower constructed. Espionage capabilities enhanced.", "text-purple-400 font-bold text-lg");
        return;
    }
    
    // Client-side validation for immediate feedback before server call
    const validation = canBuild(gameState, type, amount);
    if (!validation.valid) {
        log(validation.reason, "text-red-400 text-xs");
        return;
    }
    
    // Server-authoritative: Call atomic build endpoint
    const result = await buildStructure(type, amount);
    
    if (!result.success) {
        log(`Build failed: ${result.error}`, "text-red-400 text-xs");
        return;
    }
    
    // Update local state from server response
    applyActionResult(gameState, result);
    
    const msg = result.builtCount === 1 ? `Constructed ${type.replace('_', ' ')}.` : `Constructed ${result.builtCount} ${type.replace('_', ' ')}.`;
    log(msg, "text-green-400 text-xs");
}

export function buyGemheart(gameState) {
    // Check for storm discount
    const cost = isBlackMarketDiscountActive(gameState) ? 7500 : 10000;
    
    const validation = canAffordResource(gameState, cost, 'spheres');
    if (!validation.valid) {
        log(validation.reason, "text-red-400");
        return;
    }

    gameState.state.spheres -= cost;
    gameState.state.gemhearts++;
    
    if (cost === 7500) {
        log("Purchased a Gemheart from the black market at storm-reduced price!", "text-yellow-400 font-bold");
    } else {
        log("Purchased a Gemheart from the black market.", "text-yellow-400 font-bold");
    }
}

export function upgradeBuilding(gameState, type) {
    if (type === 'research_library') {
        const currentLevel = gameState.state.buildingLevels?.research_library || 1;
        const owned = gameState.state.buildings.research_library || 0;
        
        // Can't upgrade if building doesn't exist
        if (owned === 0) {
            log("You must build a Research Library before upgrading it.", "text-red-400");
            return;
        }
        
        // Calculate exponential cost: 12,000 * 2.5^(level-1)
        const upgradeCost = Math.floor(12000 * Math.pow(2.5, currentLevel - 1));
        
        if (gameState.state.spheres < upgradeCost) {
            log(`Insufficient spheres. Need ${upgradeCost.toLocaleString()} S.`, "text-red-400");
            return;
        }
        
        // Apply upgrade
        gameState.state.spheres -= upgradeCost;
        if (!gameState.state.buildingLevels) gameState.state.buildingLevels = {};
        gameState.state.buildingLevels.research_library = currentLevel + 1;
        
        const newLevel = currentLevel + 1;
        const bonusPercent = newLevel * 10;
        log(`Research Library upgraded to Level ${newLevel}! Gemheart generation: +${bonusPercent}% (base 10% + ${bonusPercent - 10}% bonus).`, "text-purple-400 font-bold");
    }
}

export function constructFabrial(gameState, type) {
    // Get bulk amount from input
    let amount = 1;
    const fabricInput = document.getElementById('fabrial-amount');
    if (fabricInput) amount = Math.max(1, parseInt(fabricInput.value) || 1);
    
    // Construct multiple fabrials with bulk purchase
    let constructed = 0;
    for (let i = 0; i < amount; i++) {
        // Use validation framework
        const validation = canConstructFabrial(gameState, type);
        if (!validation.valid) {
            if (constructed === 0) {
                log(validation.reason, "text-red-400");
            }
            break;
        }

        // Deduct cost and add fabrial
        gameState.state.gemhearts -= validation.cost;
        gameState.state.fabrials[type] = (gameState.state.fabrials[type] || 0) + 1;
        constructed++;
    }
    
    if (constructed > 0) {
        const fabrialName = FABRIAL_DATA[type]?.name || type;
        const msg = constructed === 1 ? `Fabricated ${fabrialName}.` : `Fabricated ${constructed} ${fabrialName}.`;
        log(msg, "text-purple-400 font-bold");
    }
}

export function getEffectiveBuildingBonus(gameState, buildingType) {
    // All buildings are either operational (count > 0) or non-existent (count = 0)
    // No more damaged state, so always return full effectiveness
    return 1.0;
}
