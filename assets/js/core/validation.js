// State validation module for multiplayer-safe operations
// These functions can be executed client-side for UX feedback
// and replicated server-side for security

import { BUILDING_DATA, FABRIAL_DATA, UNIT_STATS } from './constants.js';
import { getBuildingCost } from '../buildings/buildings.js';
import { getArmyStats, getAvailableTroops } from '../military/military.js';

/**
 * Validates that a player has enough spheres to afford a cost
 * @param {Object} gameState - Current game state
 * @param {number} cost - Resource cost
 * @returns {Object} { valid: boolean, reason: string }
 */
export function canAffordResource(gameState, cost, resourceType = 'spheres') {
    const available = gameState.state[resourceType] || 0;
    
    if (available < cost) {
        return {
            valid: false,
            reason: `Insufficient ${resourceType}. Have ${available}, need ${cost}.`,
            have: available,
            need: cost
        };
    }
    
    return { valid: true, have: available, need: cost };
}

/**
 * Validates that a building can be constructed
 * @param {Object} gameState - Current game state
 * @param {string} buildingKey - Building identifier
 * @returns {Object} { valid: boolean, reason: string, cost: number }
 */
export function canBuild(gameState, buildingKey) {
    const buildData = BUILDING_DATA[buildingKey];
    
    if (!buildData) {
        return { valid: false, reason: `Unknown building: ${buildingKey}` };
    }
    
    // Check if already at max
    if (buildData.max && gameState.state.buildings[buildingKey] >= buildData.max) {
        return {
            valid: false,
            reason: `${buildingKey} is already at maximum (${buildData.max}).`,
            maxed: true
        };
    }
    
    // Check cost
    const cost = getBuildingCost(gameState, buildingKey);
    const affordCheck = canAffordResource(gameState, cost, 'spheres');
    if (!affordCheck.valid) {
        return {
            valid: false,
            reason: affordCheck.reason,
            cost: cost
        };
    }

    // Check land availability
    const landCost = buildData.landCost || 0;
    const usedLand = gameState.state.land || 0;
    const maxLand = gameState.state.maxLand || 25;
    const availableLand = maxLand - usedLand;
    if (landCost > 0 && availableLand < landCost) {
        return {
            valid: false,
            reason: `Insufficient territory. Need ${landCost} land, have ${availableLand} available. Conquer more territory.`,
            cost: cost,
            landCost: landCost,
            availableLand: availableLand
        };
    }
    
    // Check prerequisites
    if (buildData.requires) {
        const preReqBuilding = gameState.state.buildings[buildData.requires];
        if (!preReqBuilding || preReqBuilding === 0) {
            return {
                valid: false,
                reason: `Requires ${buildData.requires} to be built first.`,
                requiresFirst: buildData.requires,
                cost: cost
            };
        }
    }
    
    return { valid: true, cost: cost, landCost: landCost };
}

/**
 * Validates that a unit can be recruited
 * @param {Object} gameState - Current game state
 * @param {string} unitType - Unit key (bridgecrews, spearmen, etc.)
 * @param {number} count - Number to recruit
 * @returns {Object} { valid: boolean, reason: string, cost: number, totalCost: number }
 */
export function canRecruit(gameState, unitType, count = 1) {
    const stats = UNIT_STATS[unitType];
    if (!stats) {
        return { valid: false, reason: `Unknown unit type: ${unitType}` };
    }
    
    const currencyType = (unitType === 'shardbearers') ? 'gemhearts' : 'spheres';
    const costPerUnit = (unitType === 'shardbearers' && stats.gemheartCost) ? stats.gemheartCost : stats.cost;
    const totalCost = costPerUnit * count;
    
    // Check resource availability
    const resourceCheck = canAffordResource(gameState, totalCost, currencyType);
    if (!resourceCheck.valid) {
        return { valid: false, reason: resourceCheck.reason, unitType, count, cost: costPerUnit, totalCost };
    }
    
    // Check provision capacity
    const armyStats = getArmyStats(gameState, false);
    const provisionCost = stats.provision || 1;
    const totalProvisionsNeeded = armyStats.pop + (provisionCost * count);
    if (totalProvisionsNeeded > armyStats.cap) {
        return {
            valid: false,
            reason: `Not enough food capacity. Need ${totalProvisionsNeeded}, have ${armyStats.cap}.`,
            currentFood: armyStats.pop,
            needed: totalProvisionsNeeded,
            capacity: armyStats.cap,
            unitType,
            count
        };
    }
    
    return {
        valid: true,
        unitType,
        count,
        cost: stats.cost,
        totalCost,
        provisionsUsed: provisionCost * count
    };
}

/**
 * Validates that a fabrial can be constructed
 * @param {Object} gameState - Current game state
 * @param {string} fabrialKey - Fabrial identifier
 * @returns {Object} { valid: boolean, reason: string, cost: number }
 */
export function canConstructFabrial(gameState, fabrialKey) {
    const fabData = FABRIAL_DATA[fabrialKey];
    
    if (!fabData) {
        return { valid: false, reason: `Unknown fabrial: ${fabrialKey}` };
    }
    
    // Check for research library
    if (gameState.state.buildings.research_library === 0) {
        return {
            valid: false,
            reason: `Requires Research Library to be built first.`,
            requiresFirst: 'research_library'
        };
    }
    
    // Check gemheart cost
    const cost = fabData.cost;
    const affordCheck = canAffordResource(gameState, cost, 'gemhearts');
    if (!affordCheck.valid) {
        return { valid: false, reason: affordCheck.reason, cost: cost };
    }
    
    return { valid: true, cost: cost, fabrialKey };
}

/**
 * Validates that a deployment can happen
 * @param {Object} gameState - Current game state
 * @param {string} deployType - 'scout', 'attack', or 'run'
 * @param {Object} troops - { bridgecrews, spearmen, archers, shardbearers, chulls }
 * @returns {Object} { valid: boolean, reason: string, totalPower: number }
 */
export function canDeploy(gameState, deployType, troops) {
    const available = getAvailableTroops(gameState);
    
    // Validate troop counts
    for (const [unit, count] of Object.entries(troops)) {
        if (count > available[unit]) {
            return {
                valid: false,
                reason: `Insufficient ${unit}. Have ${available[unit]}, trying to deploy ${count}.`,
                unit,
                have: available[unit],
                trying: count
            };
        }
    }
    
    // Check that at least some troops are deployed
    const totalDeployed = Object.values(troops).reduce((a, b) => a + b, 0);
    if (totalDeployed === 0) {
        return {
            valid: false,
            reason: `Must deploy at least one unit.`,
            totalDeployed
        };
    }
    
    // Deployment type specific rules
    if (deployType === 'attack') {
        if (totalDeployed < 10) {
            return {
                valid: false,
                reason: `Attacks require at least 10 units. You're deploying ${totalDeployed}.`,
                deployType,
                required: 10,
                deploying: totalDeployed
            };
        }
    }
    
    return {
        valid: true,
        deployType,
        totalDeployed,
        troopsDeployed: troops
    };
}

/**
 * Validates a spy action can be performed
 * @param {Object} gameState - Current game state
 * @param {string} action - Spy action type
 * @param {number} requiredAgents - Agents needed for this action
 * @returns {Object} { valid: boolean, reason: string, agentPower: number }
 */
export function canSpyAction(gameState, action, requiredAgents = 1) {
    // Check spy network exists
    if (gameState.state.buildings.spy_network === 0) {
        return {
            valid: false,
            reason: `Requires Spy Network to be built first.`,
            requiresFirst: 'spy_network'
        };
    }
    
    // Check if player has agents
    const myAgents = (gameState.state.military.noble || 0) + 
                    (gameState.state.military.spy || 0) + 
                    (gameState.state.military.ghostblood || 0);
    
    if (myAgents === 0) {
        return {
            valid: false,
            reason: `You have no spy agents. Recruit some from Espionage.`,
            agentPower: 0
        };
    }
    
    if (myAgents < requiredAgents) {
        return {
            valid: false,
            reason: `Not enough agents. Have ${myAgents}, need ${requiredAgents}.`,
            have: myAgents,
            need: requiredAgents
        };
    }
    
    return {
        valid: true,
        action,
        agentPower: myAgents,
        meetsRequirements: true
    };
}

/**
 * Comprehensive validation function - runs all checks before an action
 * @param {Object} gameState - Current game state
 * @param {string} actionType - Type of action (build, recruit, deploy, etc.)
 * @param {Object} params - Action-specific parameters
 * @returns {Object} { valid: boolean, message: string, details: Object }
 */
export function validateAction(gameState, actionType, params = {}) {
    let result;
    
    switch(actionType) {
        case 'build':
            result = canBuild(gameState, params.buildingKey);
            break;
        case 'recruit':
            result = canRecruit(gameState, params.unitType, params.count || 1);
            break;
        case 'fabrial':
            result = canConstructFabrial(gameState, params.fabrialKey);
            break;
        case 'deploy':
            result = canDeploy(gameState, params.deployType, params.troops);
            break;
        case 'spy':
            result = canSpyAction(gameState, params.action, params.requiredAgents);
            break;
        default:
            result = { valid: false, reason: `Unknown action type: ${actionType}` };
    }
    
    return {
        valid: result.valid,
        actionType,
        message: result.reason || (result.valid ? 'Action allowed' : 'Action blocked'),
        details: result
    };
}
