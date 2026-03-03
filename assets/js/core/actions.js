/**
 * Atomic Action Framework
 * Client-side wrappers for server-authoritative game actions
 * 
 * Instead of modifying state locally and hoping it syncs,
 * these functions make server calls that validate and apply changes atomically,
 * then update local state with the server response.
 */

import { SERVER_URL, authFetch } from './auth.js';

/**
 * Claim free land from the pool
 * Server validates availability and capacity
 * @param {number} amount - Land to claim
 * @returns {Promise<{success: boolean, landClaimed: number, newMaxLand: number}>}
 */
export async function claimLand(amount) {
  try {
    const response = await authFetch(`${SERVER_URL}/api/actions/claim-land`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error claiming land:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to claim land' 
    };
  }
}

/**
 * Build a structure
 * Server validates resources and land, deducts spheres, adds building
 * @param {string} buildingType - Type of building to build
 * @param {number} count - Number to build
 * @returns {Promise<{success: boolean, builtCount: number, newSpheres: number}>}
 */
export async function buildStructure(buildingType, count = 1) {
  try {
    const response = await authFetch(`${SERVER_URL}/api/actions/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildingType, count })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error building:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to build' 
    };
  }
}

/**
 * Recruit military units
 * Server validates resources, deducts spheres, adds units
 * @param {string} unitType - Type of unit to recruit
 * @param {number} count - Number to recruit
 * @returns {Promise<{success: boolean, recruitedCount: number, newSpheres: number}>}
 */
export async function recruitUnits(unitType, count = 1) {
  try {
    const response = await authFetch(`${SERVER_URL}/api/actions/recruit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitType, count })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error recruiting:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to recruit' 
    };
  }
}

/**
 * Apply server response to local game state
 * Used after atomic actions succeed to reconcile server state with client
 * @param {Object} gameState - Local game state object
 * @param {Object} actionResult - Response from server action endpoint
 */
export function applyActionResult(gameState, actionResult) {
  if (!gameState || !actionResult) return;

  // Update maxLand if provided
  if (actionResult.newMaxLand !== undefined) {
    gameState.state.maxLand = actionResult.newMaxLand;
  }

  // Update freeLandPool if provided
  if (actionResult.freeLandPool !== undefined) {
    gameState.state.freeLandPool = actionResult.freeLandPool;
  }

  // Update spheres if provided
  if (actionResult.newSpheres !== undefined) {
    gameState.state.spheres = actionResult.newSpheres;
  }

  // Update buildings if provided
  if (actionResult.newBuildings !== undefined && actionResult.buildingType) {
    if (!gameState.state.buildings) gameState.state.buildings = {};
    gameState.state.buildings[actionResult.buildingType] = actionResult.newBuildings;
  }

  // Update military if provided
  if (actionResult.newUnitCount !== undefined && actionResult.unitType) {
    if (!gameState.state.military) gameState.state.military = {};
    gameState.state.military[actionResult.unitType] = actionResult.newUnitCount;
  }
}
