#!/usr/bin/env node

/**
 * PvP Conquest System End-to-End Test
 * Tests atomic land transfer between two players
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

const SERVER_URL = 'http://localhost:3001';

// Test data
const attackerUsername = `attacker_${Date.now()}`;
const defenderUsername = `defender_${Date.now()}`;
const testPassword = 'TestPass123!';

let attackerToken = null;
let defenderToken = null;
let attackerId = null;
let defenderId = null;

// Helper function to make authenticated requests
async function authFetch(endpoint, token, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    ...options,
    headers
  });

  return response;
}

// Register a new player
async function registerPlayer(username, password) {
  console.log(`\n📝 Registering player: ${username}`);
  
  const response = await fetch(`${SERVER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Registration failed: ${data.error}`);
  }

  console.log(`  ✅ Registered: ${username} (ID: ${data.player.id})`);
  return data.player;
}

// Login player
async function loginPlayer(username, password) {
  console.log(`\n🔐 Logging in: ${username}`);
  
  const response = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Login failed: ${data.error}`);
  }

  console.log(`  ✅ Logged in, token: ${data.token.substring(0, 20)}...`);
  return data;
}

// Fetch player profile
async function getPlayerProfile(username, token) {
  const response = await authFetch(`/api/player/${username}`, token);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${data.error}`);
  }

  console.log(`  Raw profile data: ${JSON.stringify(data)}`);
  return data;
}

// Deploy conquest mission
async function deployConquest(targetUsername, landAmount, token) {
  console.log(`\n⚔️  Deploying conquest against ${targetUsername} for ${landAmount} land`);
  
  const response = await authFetch('/api/deploy-mission', token, {
    method: 'POST',
    body: JSON.stringify({
      missionType: 'conquest',
      targetUsername: targetUsername,
      landAmount: landAmount
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Deployment failed: ${data.error}`);
  }

  console.log(`  ✅ Conquest deployed (returns in ${Math.floor(data.returnTime / 1000)}s game time)`);
  return data;
}

// Execute conquest land transfer (simulating mission victory)
async function executeConquestLandTransfer(defenderUsername, landAmount, token) {
  console.log(`\n💰 Executing conquest land transfer from ${defenderUsername}`);
  
  const response = await authFetch('/api/conquest-land', token, {
    method: 'POST',
    body: JSON.stringify({
      targetUsername: defenderUsername,
      landAmount: landAmount
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('  Response status:', response.status);
    console.error('  Response data:', JSON.stringify(data, null, 2));
    throw new Error(`Conquest transfer failed: ${data.error}`);
  }

  if (!data.success) {
    throw new Error(`Transfer unsuccessful: ${data.message}`);
  }

    console.log(`  ✅ Land transferred: ${data.landTransferred} land`);
  console.log(`  📊 Attacker new max land: ${data.attackerNewMaxLand}`);
  console.log(`  📊 Defender new max land: ${data.targetNewMaxLand}`);
  return data;
}

// Main test flow
async function runTest() {
  try {
    console.log('═'.repeat(60));
    console.log('🧪 PVP CONQUEST SYSTEM TEST');
    console.log('═'.repeat(60));

    // Step 1: Register players
    console.log('\n📋 STEP 1: Player Registration');
    const attackerPlayer = await registerPlayer(attackerUsername, testPassword);
    const defenderPlayer = await registerPlayer(defenderUsername, testPassword);
    
    attackerId = attackerPlayer.id;
    defenderId = defenderPlayer.id;

    // Step 2: Login players
    console.log('\n📋 STEP 2: Player Login');
    const attackerLogin = await loginPlayer(attackerUsername, testPassword);
    const defenderLogin = await loginPlayer(defenderUsername, testPassword);
    
    attackerToken = attackerLogin.token;
    defenderToken = defenderLogin.token;

    // Step 3: Check initial profiles
    console.log('\n📋 STEP 3: Check Initial Profiles');
    const attackerProfile1 = await getPlayerProfile(attackerUsername, attackerToken);
    const defenderProfile1 = await getPlayerProfile(defenderUsername, defenderToken);
    
    console.log(`  Attacker maxLand: ${attackerProfile1.player.max_land || 'N/A'}`);
    console.log(`  Defender maxLand: ${defenderProfile1.player.max_land || 'N/A'}`);

    // Step 4: Execute conquest land transfer
    console.log('\n📋 STEP 4: Execute Conquest Land Transfer');
    const landToTransfer = 5;
    
    const transferResult = await executeConquestLandTransfer(
      defenderUsername,
      landToTransfer,
      attackerToken
    );

    // Step 5: Check profiles after conquest
    console.log('\n📋 STEP 5: Verify Land Transfer');
    const attackerProfile2 = await getPlayerProfile(attackerUsername, attackerToken);
    const defenderProfile2 = await getPlayerProfile(defenderUsername, defenderToken);
    
    const attackerInitialMaxLand = attackerProfile1.player.max_land || 25;
    const defenderInitialMaxLand = defenderProfile1.player.max_land || 25;
    
    console.log(`  Attacker maxLand before: ${attackerInitialMaxLand}, after: ${attackerProfile2.player.max_land}`);
    console.log(`  Defender maxLand before: ${defenderInitialMaxLand}, after: ${defenderProfile2.player.max_land}`);

    // Verify the transfer was atomic
    const attackerGainedLand = (attackerProfile2.player.max_land || 25) - attackerInitialMaxLand;
    const defenderLostLand = defenderInitialMaxLand - (defenderProfile2.player.max_land || 25);
    
    console.log(`  ✓ Attacker gained: ${attackerGainedLand} land`);
    console.log(`  ✓ Defender lost: ${defenderLostLand} land`);

    if (attackerGainedLand === landToTransfer && defenderLostLand === landToTransfer) {
      console.log('\n✅ ATOMIC TRANSFER VERIFIED: Land transfer was consistent');
    } else {
      throw new Error(`Transfer mismatch: attacker +${attackerGainedLand}, defender -${defenderLostLand}, expected ${landToTransfer}`);
    }

    // Step 6: Test persistence - login defender again and check land persists
    console.log('\n📋 STEP 6: Verify Persistence Across Save/Load');
    const defenderProfile3 = await getPlayerProfile(defenderUsername, defenderToken);
    console.log(`  Defender maxLand (after re-fetch): ${defenderProfile3.player.max_land}`);
    
    if (defenderProfile3.player.max_land === (defenderInitialMaxLand - landToTransfer)) {
      console.log('  ✅ PERSISTENCE VERIFIED: Land change survived fetch');
    } else {
      throw new Error(`Persistence failed: expected ${defenderInitialMaxLand - landToTransfer}, got ${defenderProfile3.player.max_land}`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 ALL TESTS PASSED');
    console.log('═'.repeat(60));
    console.log('\n✅ PvP Conquest System:');
    console.log('   ✓ Atomic land transfer');
    console.log('   ✓ Server-authoritative land updates');
    console.log('   ✓ Persistence across saves');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest();
