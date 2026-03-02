// UI updates and rendering module
import { CONSTANTS, BUILDING_DATA, FABRIAL_DATA, NPC_PRINCES } from '../core/constants.js';
import { getArmyStats, getAvailableTroops, getSpyPower } from '../military/military.js';
import { getBuildingCost } from '../buildings/buildings.js';
import { formatTime } from '../core/utils.js';
import { SERVER_URL, authFetch } from '../core/auth.js';
import { getCurrentGameTime, formatGameTime, getTimeUntilNextDay } from '../core/server-api.js';
import { updateModalStats, updateSpyNetwork, toggleTournamentCard, toggleBlackMarket } from './modal-manager.js';
import { generateThrillButtons } from '../arena/arena.js';
import { isArenaBoostActive, isFabrialBurnedOut, isGravityBoostActive, isGravityBurnout } from '../events/highstorm.js';
import { getConquestStatus, canStartConquest } from '../events/conquest.js';

export function updateUI(gameState) {
    updateTimeUI(gameState);
    updateResourcesUI(gameState);
    updateMilitaryUI(gameState);
    updateBuildingsUI(gameState);
    updateFabrialsUI(gameState);
    updateArenaUI(gameState);
    updateDeploymentsUI(gameState);
    updateSpyPlanningUI(gameState);
    updateTabVisibility(gameState);
    updateModalsUI(gameState);
    updateEspionageUI(gameState);
}

function updateModalsUI(gameState) {
    // Update modal visibility and stats
    const spyNetworkOwned = gameState.state.buildings.spy_network > 0;
    updateSpyNetwork(spyNetworkOwned);

    const tournamentActive = gameState.state.tournamentActive;
    toggleTournamentCard(tournamentActive);

    const blackMarketUnlocked = gameState.state.buildings.spy_network > 0;
    toggleBlackMarket(blackMarketUnlocked);

    // Collect building counts
    const buildingCounts = {
        spy_network: gameState.state.buildings.spy_network,
        research_library: gameState.state.buildings.research_library,
        market: gameState.state.buildings.market,
        stormshelter: gameState.state.buildings.stormshelter,
        soulcaster: gameState.state.buildings.soulcaster,
        training_camp: gameState.state.buildings.training_camp,
        monastery: gameState.state.buildings.monastery
    };

    // Collect spy unit counts
    const unitCounts = {
        noble: gameState.state.military.noble || 0,
        spy: gameState.state.military.spy || 0,
        ghostblood: gameState.state.military.ghostblood || 0
    };

    // Update arena modal stats
    updateModalStats({
        arenaLevel: gameState.state.arena.level,
        arenaHP: `${gameState.state.arena.hp}/${gameState.state.arena.maxHp}`,
        arenaThrill: `${gameState.state.arena.thrill}/${gameState.state.arena.maxThrill}`,
        heatrialOwned: gameState.state.fabrials.heatrial,
        ledgerOwned: gameState.state.fabrials.ledger,
        gravityLiftOwned: gameState.state.fabrials.gravity_lift,
        regenPlateOwned: gameState.state.fabrials.regen_plate,
        thrillAmpOwned: gameState.state.fabrials.thrill_amp,
        halfShardOwned: gameState.state.fabrials.half_shard,
        buildingCounts: buildingCounts,
        unitCounts: unitCounts
    });
    
    // Update Research Library modal upgrade section
    const researchLibraryOwned = gameState.state.buildings.research_library || 0;
    const modalUpgradeSection = document.getElementById('modal-research-library-upgrade-section');
    if (modalUpgradeSection) {
        if (researchLibraryOwned > 0) {
            modalUpgradeSection.classList.remove('hidden');
            
            const currentLevel = gameState.state.buildingLevels?.research_library || 1;
            const levelEl = document.getElementById('modal-research-library-level');
            const bonusEl = document.getElementById('modal-research-library-bonus');
            const upgradeCostEl = document.getElementById('modal-research-library-upgrade-cost');
            const upgradeBtn = document.getElementById('btn-modal-upgrade-research_library');
            
            if (levelEl) levelEl.innerText = currentLevel;
            if (bonusEl) {
                const bonus = 10 * currentLevel;
                bonusEl.innerText = `${bonus}%`;
            }
            
            const upgradeCost = Math.floor(12000 * Math.pow(2.5, currentLevel - 1));
            if (upgradeCostEl) upgradeCostEl.innerText = `${upgradeCost.toLocaleString()} S`;
            if (upgradeBtn) {
                const hasEnough = gameState.state.spheres >= upgradeCost;
                upgradeBtn.disabled = !hasEnough;
                if (hasEnough) {
                    upgradeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    upgradeBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        } else {
            modalUpgradeSection.classList.add('hidden');
        }
    }
}

export function updateTimeUI(gameState) {
    // Get current server time
    const currentGameMs = getCurrentGameTime();
    const formatted = formatGameTime(currentGameMs);
    
    // Display year, month, day
    document.getElementById('display-date').innerText = `Year ${formatted.year}, Month ${formatted.month}, Day ${formatted.day}`;

    // Calculate time until next day
    const msNext = getTimeUntilNextDay();
    const timeStr = formatTime(msNext);
    const displayTime = document.getElementById('display-time');
    if (displayTime) displayTime.innerText = `Next Day: ${timeStr}`;

    const hubTime = document.getElementById('command-hub-time');
    if (hubTime) hubTime.innerText = `Next Day: ${timeStr}`;
}

export function updateResourcesUI(gameState) {
    const stats = getArmyStats(gameState, false);
    document.getElementById('res-spheres').innerText = Math.floor(gameState.state.spheres).toLocaleString();
    document.getElementById('res-gemhearts').innerText = gameState.state.gemhearts;
    document.getElementById('res-pop-current').innerText = stats.pop;
    document.getElementById('res-food-cap').innerText = stats.cap;
    
    // Update land display
    const currentLand = gameState.state.land || 0;
    const maxLand = gameState.state.maxLand || 25;
    const freeLand = gameState.state.freeLandPool || 0;
    document.getElementById('res-land-current').innerText = currentLand;
    document.getElementById('res-land-max').innerText = maxLand;
    
    const freeLandEl = document.getElementById('res-free-land');
    if (freeLandEl) freeLandEl.innerText = freeLand;
}

export function updateMilitaryUI(gameState) {
    const stats = getArmyStats(gameState, false);
    const availStats = getArmyStats(gameState, true);
    const availTroops = getAvailableTroops(gameState);
    const spyPower = getSpyPower(gameState);

    document.getElementById('stat-power').innerText = Math.floor(availStats.power);
    document.getElementById('stat-avail').innerText = availStats.pop;
    document.getElementById('stat-speed').innerText = Math.round((stats.speed - 1) * 100) + "%";
    document.getElementById('stat-agents').innerText = spyPower;

    for (const unit in gameState.state.military) {
        const el = document.getElementById('det-' + unit);
        if (el) {
            const tot = gameState.state.military[unit];
            const av = availTroops[unit];
            el.innerText = `${av}/${tot}`;
        }
    }

    const totalSpies = (gameState.state.military.noble || 0) + (gameState.state.military.spy || 0) + (gameState.state.military.ghostblood || 0);
    const spyEl = document.getElementById('det-spies-total');
    if (spyEl) spyEl.innerText = totalSpies;

    const chullEl = document.getElementById('det-chulls');
    if (chullEl) chullEl.innerText = gameState.state.military.chulls;

    // Calculate and display unit upkeep tier
    const totalUnits = (gameState.state.military.bridgecrews || 0) +
                     (gameState.state.military.spearmen || 0) +
                     (gameState.state.military.archers || 0) +
                     (gameState.state.military.chulls || 0) +
                     (gameState.state.military.shardbearers || 0);

    let upkeepTier = 'Low';
    let upkeepPenalty = '0%';
    let upkeepDesc = '0-200 units = No penalty';
    let upkeepColor = 'text-green-400';

    if (totalUnits > 600) {
        upkeepTier = 'Crippling';
        upkeepPenalty = '-60%';
        upkeepDesc = '601+ units = -60% income';
        upkeepColor = 'text-red-400';
    } else if (totalUnits > 400) {
        upkeepTier = 'High';
        upkeepPenalty = '-40%';
        upkeepDesc = '401-600 units = -40% income';
        upkeepColor = 'text-orange-400';
    } else if (totalUnits > 200) {
        upkeepTier = 'Mild';
        upkeepPenalty = '-20%';
        upkeepDesc = '201-400 units = -20% income';
        upkeepColor = 'text-yellow-400';
    }

    const upkeepTierEl = document.getElementById('unit-upkeep-tier');
    const upkeepDescEl = document.getElementById('unit-upkeep-desc');

    if (upkeepTierEl) {
        upkeepTierEl.textContent = `${upkeepTier} (${upkeepPenalty})`;
        upkeepTierEl.className = `font-bold ${upkeepColor}`;
    }

    if (upkeepDescEl) {
        upkeepDescEl.textContent = upkeepDesc;
    }
}

export function updateBuildingsUI(gameState) {
    for (const bld in gameState.state.buildings) {
        const el = document.getElementById('own-' + bld);
        if (el) el.innerText = gameState.state.buildings[bld];

        const btn = document.getElementById('btn-build-' + bld);
        if (btn) {
            const data = BUILDING_DATA[bld];
            const owned = gameState.state.buildings[bld];
            const landCost = data.landCost || 0;
            const availableLand = (gameState.state.maxLand || 25) - (gameState.state.land || 0);
            const hasEnoughLand = landCost === 0 || availableLand >= landCost;
            
            if (data.max && owned >= data.max) {
                btn.innerText = "MAX";
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                const cost = getBuildingCost(gameState, bld);
                let buttonText = `${cost.toLocaleString()} S`;
                if (landCost > 0) buttonText += ` | ${landCost}🌍`;
                
                btn.innerText = buttonText;
                const hasEnoughSpherés = gameState.state.spheres >= cost;
                btn.disabled = !hasEnoughSpherés || !hasEnoughLand;
                
                if (!hasEnoughSpherés || !hasEnoughLand) {
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        }
    }
    
    // Update Research Library upgrade section
    const researchLibraryOwned = gameState.state.buildings.research_library || 0;
    const upgradeSection = document.getElementById('research-library-upgrade-section');
    if (upgradeSection) {
        if (researchLibraryOwned > 0) {
            upgradeSection.classList.remove('hidden');
            
            const currentLevel = gameState.state.buildingLevels?.research_library || 1;
            const levelEl = document.getElementById('research-library-level');
            const bonusEl = document.getElementById('research-library-bonus');
            const upgradeCostEl = document.getElementById('research-library-upgrade-cost');
            const upgradeBtn = document.getElementById('btn-upgrade-research_library');
            
            if (levelEl) levelEl.innerText = currentLevel;
            if (bonusEl) {
                const bonus = 10 * currentLevel;
                bonusEl.innerText = `${bonus}%`;
            }
            
            const upgradeCost = Math.floor(12000 * Math.pow(2.5, currentLevel - 1));
            if (upgradeCostEl) upgradeCostEl.innerText = `${upgradeCost.toLocaleString()} S`;
            if (upgradeBtn) {
                const hasEnough = gameState.state.spheres >= upgradeCost;
                upgradeBtn.disabled = !hasEnough;
                if (hasEnough) {
                    upgradeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    upgradeBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        } else {
            upgradeSection.classList.add('hidden');
        }
    }
}

export function updateFabrialsUI(gameState) {
    for (let fab in gameState.state.fabrials) {
        const btn = document.getElementById('btn-fab-' + fab);
        if (btn) {
            const cost = FABRIAL_DATA[fab].cost;
            btn.disabled = gameState.state.gemhearts < cost;

            const count = gameState.state.fabrials[fab] || 0;
            if (gameState.state.gemhearts < cost) btn.classList.add('opacity-50', 'cursor-not-allowed');
            else btn.classList.remove('opacity-50', 'cursor-not-allowed');

            const container = btn.parentElement;
            const descP = container.querySelector('div p:last-child');
            if (descP) {
                let baseDesc = "";
                if (fab === 'heatrial') baseDesc = "Increases Provision Cap by 1.5x (Stackable)";
                if (fab === 'ledger') baseDesc = "Increases Market Income by 1.5x (Stackable)";
                if (fab === 'gravity_lift') baseDesc = "Increases Army Speed by 2.0x (Stackable)";

                descP.innerText = `${baseDesc} | Owned: ${count}`;
            }
        }
    }

    updateFabrialOverchargeUI(gameState);
}

function updateFabrialOverchargeUI(gameState) {
    const gravityCount = gameState.state.fabrials.gravity_lift || 0;
    const gravityBoost = gravityCount > 0 && isGravityBoostActive(gameState);
    const gravityBurned = gravityCount > 0 && isGravityBurnout(gameState);
    setFabrialStatus('gravity_lift', gravityBoost, gravityBurned);

    const arenaBoost = isArenaBoostActive(gameState);
    ['regen_plate', 'thrill_amp', 'half_shard'].forEach(type => {
        const count = gameState.state.fabrials[type] || 0;
        const boosted = count > 0 && arenaBoost;
        const burned = count > 0 && isFabrialBurnedOut(gameState, type);
        setFabrialStatus(type, boosted, burned);
    });
}

function setFabrialStatus(fabrialKey, isBoosted, isBurned) {
    const card = document.getElementById(`fabrial-card-${fabrialKey}`);
    const note = document.getElementById(`fabrial-note-${fabrialKey}`);

    if (card) {
        card.classList.toggle('fabrial-overcharged', isBoosted);
        card.classList.toggle('fabrial-burned', isBurned);
    }

    if (note) {
        const text = getFabrialOverchargeText(fabrialKey, isBoosted, isBurned);
        if (text) {
            note.innerHTML = text;
            note.classList.remove('hidden');
        } else {
            note.innerHTML = '';
            note.classList.add('hidden');
        }
    }
}

function getFabrialOverchargeText(fabrialKey, isBoosted, isBurned) {
    if (isBoosted) {
        if (fabrialKey === 'gravity_lift') {
            return '<div class="text-emerald-300">Overcharge: +3x speed for 3 days.</div>';
        }
        return '<div class="text-emerald-300">Overcharge: 2 uses per day for 3 days.</div>';
    }

    if (isBurned) {
        if (fabrialKey === 'gravity_lift') {
            return '<div class="text-rose-300">Burnout: Disabled for 3 days.</div>';
        }
        return '<div class="text-rose-300">Burnout: This fabrial disabled for 3 days.</div>';
    }

    return '';
}

export function updateArenaUI(gameState) {
    document.getElementById('arena-level').innerText = gameState.state.arena.level;
    document.getElementById('arena-hp').innerText = `${gameState.state.arena.hp}/${gameState.state.arena.maxHp}`;
    document.getElementById('arena-thrill').innerText = `${gameState.state.arena.maxThrill || 10}`;

    if (gameState.state.activeDuel) {
        document.getElementById('combat-player-hp').innerText = `HP: ${gameState.state.activeDuel.playerHp}/${gameState.state.activeDuel.playerMaxHp}`;
        document.getElementById('combat-player-thrill').innerText = `Thrill: ${gameState.state.activeDuel.playerThrill}`;
        document.getElementById('combat-enemy-hp').innerText = `HP: ${gameState.state.activeDuel.enemyHp}/${gameState.state.activeDuel.enemyMaxHp}`;
        document.getElementById('combat-enemy-thrill').innerText = `Thrill: ${gameState.state.activeDuel.enemyThrill}`;

        document.getElementById('arena-lobby').classList.add('hidden');
        document.getElementById('arena-combat').classList.remove('hidden');

        // Generate dynamic thrill buttons
        generateThrillButtons(gameState.state.activeDuel.playerThrill);

        const log = document.getElementById('combat-log');
        log.innerHTML = gameState.state.activeDuel.log.map(l => `<p>${l}</p>`).join('');
        log.scrollTop = log.scrollHeight;
        
        // Show/hide fabrial actions based on ownership
        const fabrialsContainer = document.getElementById('fabrial-actions-container');
        const hasArenaFabrials = (gameState.state.fabrials.thrill_amp || 0) > 0 || 
                                 (gameState.state.fabrials.half_shard || 0) > 0;
        if (fabrialsContainer) {
            fabrialsContainer.style.display = hasArenaFabrials ? 'block' : 'none';
        }
    } else {
        document.getElementById('arena-lobby').classList.remove('hidden');
        document.getElementById('arena-combat').classList.add('hidden');
    }

    if (gameState.state.tournamentActive) {
        document.getElementById('tournament-active').classList.remove('hidden');
        const lobby = document.getElementById('arena-lobby');
        if (lobby) lobby.classList.add('opacity-50');
    } else {
        document.getElementById('tournament-active').classList.add('hidden');
        const lobby = document.getElementById('arena-lobby');
        if (lobby) lobby.classList.remove('opacity-50');
    }
}

export function updateDeploymentsUI(gameState) {
    const depList = document.getElementById('active-deployments');
    depList.innerHTML = '';
    if (gameState.state.deployments.length === 0) {
        depList.innerHTML = '<p class="text-xs text-slate-500 italic text-center">No active missions.</p>';
    } else {
        gameState.state.deployments.forEach((d, index) => {
            const timeLeftMs = Math.max(0, (d.returnTime - getCurrentGameTime()) / 24); // convert game ms to real ms
            const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
            const hrs = Math.floor(timeLeftSeconds / 3600);
            const mins = Math.floor((timeLeftSeconds % 3600) / 60);
            const secs = Math.floor(timeLeftSeconds % 60);

            let timeStr = `${secs}s`;
            if (hrs > 0) timeStr = `${hrs}h ${mins}m`;
            else if (mins > 0) timeStr = `${mins}m ${secs}s`;

            const unitCount = d.units ? Object.values(d.units).reduce((a, b) => a + b, 0) : (d.myAgents || 0);
            const typeLabel = d.type === 'espionage' ? 'ESPIONAGE' : (d.type === 'conquest' ? 'CONQUEST' : d.type.toUpperCase());
            let detailLine = `Returns: ${timeStr}`;
            if (d.type === 'espionage') {
                const action = d.actionLabel || d.action || 'Mission';
                const targetName = d.targetName || NPC_PRINCES[d.targetKey]?.name || d.targetKey || 'Unknown';
                detailLine = `${action} • ${targetName} • ${timeStr}`;
            } else if (d.type === 'conquest') {
                const landReward = d.landReward || 0;
                detailLine = `Intel classified • ${landReward} Land • ${timeStr}`;
            }

            const div = document.createElement('div');
            div.className = "bg-blue-900/30 border border-blue-800 p-2 rounded flex justify-between items-center text-[10px] cursor-pointer hover:bg-blue-900/50 transition-colors";
            div.onclick = () => window.gameInstance.openMissionDetails(index);
            div.innerHTML = `<div><span class="font-bold text-cyan-300 uppercase">${typeLabel}</span><span class="text-slate-400 block">${detailLine}</span></div><div class="text-right"><span class="block">${d.type === 'espionage' ? 'Agents' : 'Units'}: ${unitCount}</span></div>`;
            depList.appendChild(div);
        });
    }
}

export function updateSpyPlanningUI(gameState) {
    const modal = document.getElementById('spy-planning-modal');
    if (!modal) return;

    const emptyEl = document.getElementById('spy-planning-empty');
    const activeEl = document.getElementById('spy-planning-active');
    const targetEl = document.getElementById('spy-planning-target');
    const actionEl = document.getElementById('spy-planning-action');
    const agentsEl = document.getElementById('spy-planning-agents');
    const countdownEl = document.getElementById('spy-planning-countdown');
    const returnEl = document.getElementById('spy-planning-return');

    const activeMissions = gameState.state.deployments.filter(d => d.type === 'espionage');
    if (activeMissions.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (activeEl) activeEl.classList.add('hidden');
        return;
    }

    const active = activeMissions.sort((a, b) => a.returnTime - b.returnTime)[0];
    const timeLeftRealMs = Math.max(0, (active.returnTime - getCurrentGameTime()) / 24); // convert game ms to real ms
    const timeStr = formatTime(timeLeftRealMs);
    const targetName = active.targetName || NPC_PRINCES[active.targetKey]?.name || active.targetKey || 'Unknown';

    if (emptyEl) emptyEl.classList.add('hidden');
    if (activeEl) activeEl.classList.remove('hidden');
    if (targetEl) targetEl.textContent = targetName;
    if (actionEl) actionEl.textContent = active.actionLabel || active.action || 'Mission';
    if (agentsEl) agentsEl.textContent = active.myAgents || 0;
    if (countdownEl) countdownEl.textContent = timeStr;
    if (returnEl) returnEl.textContent = new Date(active.returnTime).toLocaleTimeString();
}

export function updateTabVisibility(gameState) {
    if (gameState.state.military.shardbearers > 0) {
        document.getElementById('tab-arena').classList.remove('hidden');
    } else {
        document.getElementById('tab-arena').classList.add('hidden');
    }

    if (gameState.state.buildings.market >= 30) {
        document.getElementById('black-market-option').classList.remove('hidden');
    } else {
        document.getElementById('black-market-option').classList.add('hidden');
    }

    if (gameState.state.buildings.spy_network > 0) {
        document.getElementById('tab-spy').classList.remove('hidden');
        document.getElementById('spy-recruit-locked').classList.add('hidden');
        document.getElementById('spy-recruit-unlocked').classList.remove('hidden');
    } else {
        document.getElementById('tab-spy').classList.add('hidden');
        document.getElementById('spy-recruit-locked').classList.remove('hidden');
        document.getElementById('spy-recruit-unlocked').classList.add('hidden');
    }

    if (gameState.state.buildings.research_library > 0) {
        document.getElementById('tab-fabrial').classList.remove('hidden');
    } else {
        document.getElementById('tab-fabrial').classList.add('hidden');
    }
}

export function updateConquestUI(gameState) {
    const currentLand = gameState.state.land || 0;
    const maxLand = gameState.state.maxLand || 25;
    const availableLand = maxLand - currentLand;
    
    // Update land display
    const landDisplay = document.getElementById('conquest-land-display');
    if (landDisplay) landDisplay.textContent = `${currentLand}/${maxLand}`;
    
    const landBar = document.getElementById('conquest-land-bar');
    if (landBar) {
        const percent = (currentLand / maxLand) * 100;
        landBar.style.width = percent + '%';
    }
    
    const landAvailable = document.getElementById('conquest-land-available');
    if (landAvailable) landAvailable.textContent = availableLand;
    
    // Update mission status and button
    const status = getConquestStatus(gameState);
    const statusContainer = document.getElementById('conquest-status-container');
    const launchContainer = document.getElementById('conquest-launch-container');
    const btn = document.getElementById('btn-start-conquest');
    
    if (status && status.active) {
        if (statusContainer) statusContainer.classList.remove('hidden');
        if (launchContainer) launchContainer.classList.add('hidden');
        
        // Update progress
        const progressPercent = document.getElementById('conquest-progress-percent');
        if (progressPercent) progressPercent.textContent = status.progress + '%';
        
        const progressBar = document.getElementById('conquest-progress-bar');
        if (progressBar) progressBar.style.width = status.progress + '%';
        
        // Update enemy power info
        const enemyPower = document.getElementById('conquest-enemy-power');
        if (enemyPower) enemyPower.textContent = status.enemyPower;
        
        // Disable button
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } else {
        if (statusContainer) statusContainer.classList.add('hidden');
        if (launchContainer) launchContainer.classList.remove('hidden');
        
        // Update button state
        if (btn) {
            const canStart = canStartConquest(gameState);
            btn.disabled = !canStart;
            if (!canStart) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }
}

export function updateEspionageUI(gameState) {
    const targetSelect = document.getElementById('spy-target-modal') || document.getElementById('spy-target');
    const displayEl = document.getElementById('espionage-suspicion-display');
    const selectedPlayerInput = document.getElementById('spy-selected-player');
    
    if (!displayEl) return;
    
    // Check if a player is selected
    const selectedPlayer = selectedPlayerInput ? (selectedPlayerInput.value || '').trim() : '';
    if (selectedPlayer && gameState.state.playerRivals && gameState.state.playerRivals[selectedPlayer]) {
        const playerRival = gameState.state.playerRivals[selectedPlayer];
        const daysSinceSpy = playerRival.daysSinceLastSpy ?? 0;
        displayEl.textContent = `Suspicion: ${playerRival.suspicion}/100 (${playerRival.suspicionLevel}) | Intel: ${playerRival.intel} | Days Since Spy: ${daysSinceSpy}`;
        return;
    }
    
    // Otherwise check NPC target
    if (!targetSelect) return;
    const targetKey = targetSelect.value;
    const rival = gameState.state.rivals[targetKey];
    
    if (rival) {
        const daysSinceSpy = rival.daysSinceLastSpy ?? 0;
        displayEl.textContent = `Suspicion: ${rival.suspicion}/100 (${rival.suspicionLevel}) | Intel: ${rival.intel} | Days Since Spy: ${daysSinceSpy}`;
    } else {
        displayEl.textContent = `Suspicion: 0/100 (unknown) | Intel: 0 | Days Since Spy: 0`;
    }
}

export function setTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('panel-build').classList.add('hidden');
    document.getElementById('panel-military').classList.add('hidden');
    document.getElementById('panel-conquest').classList.add('hidden');
    document.getElementById('panel-spy').classList.add('hidden');
    document.getElementById('panel-fabrial').classList.add('hidden');
    document.getElementById('panel-arena').classList.add('hidden');
    document.getElementById('panel-rankings').classList.add('hidden');
    document.getElementById('panel-' + tab).classList.remove('hidden');
    
    // Auto-load rankings when switching to rankings tab
    if (tab === 'rankings') {
        showRankings('spheres');
    }
}

// Spanreed Center - Reports & Messages
export function addReport(gameState, type, message, data = {}) {
    const report = {
        type, // 'espionage', 'battle', 'growth', 'scout', 'attack', 'plateau'
        message,
        data,
        timestamp: Date.now()
    };
    gameState.state.reports.unshift(report); // Add to beginning
    
    // Keep only last 50 reports
    if (gameState.state.reports.length > 50) {
        gameState.state.reports = gameState.state.reports.slice(0, 50);
    }
    
    updateReportsList(gameState);
}

export function updateReportsList(gameState) {
    const list = document.getElementById('reports-list');
    if (!list) return;
    
    if (gameState.state.reports.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-sm italic text-center py-8">No reports yet. Activity in espionage, battles, and daily reports will appear here.</p>';
        return;
    }
    
    const typeColors = {
        espionage: 'purple',
        battle: 'orange',
        scout: 'cyan',
        attack: 'orange',
        plateau: 'green',
        growth: 'blue',
        defense: 'red'
    };
    
    list.innerHTML = gameState.state.reports.map((report, index) => {
        const color = typeColors[report.type] || 'slate';
        const time = new Date(report.timestamp).toLocaleTimeString();
        const detailsId = `report-details-${index}`;
        
        // Display name mapping
        const displayName = report.type === 'growth' ? 'Daily Report' : report.type;
        
        // Generate detailed information HTML based on report type
        let detailsHTML = '';
        
        if (report.type === 'espionage' && report.data) {
            detailsHTML = `
                <div class="mt-2 pt-2 border-t border-${color}-500/20 space-y-1 text-xs">
                    <div><span class="text-slate-400">Target:</span> <span class="text-${color}-300">${report.data.target || 'Unknown'}</span></div>
                    <div><span class="text-slate-400">Result:</span> <span class="text-${report.data.success ? 'green' : 'red'}-400">${report.data.success ? 'SUCCESS' : 'FAILURE'}</span></div>
                    ${report.data.intel ? `<div><span class="text-slate-400">Intel:</span> <span class="text-slate-300">${report.data.intel}</span></div>` : ''}
                    ${report.data.gainInfo ? `<div><span class="text-slate-400">Gained:</span> <span class="text-cyan-300">${report.data.gainInfo}</span></div>` : ''}
                    ${report.data.capturedAgent ? `<div><span class="text-slate-400">Lost:</span> <span class="text-red-400">1 ${report.data.capturedAgent}</span></div>` : ''}
                </div>
            `;
        } else if ((report.type === 'scout' || report.type === 'attack') && report.data) {
            detailsHTML = `
                <div class="mt-2 pt-2 border-t border-${color}-500/20 space-y-1 text-xs">
                    <div><span class="text-slate-400">Result:</span> <span class="text-${report.data.success ? 'green' : 'red'}-400">${report.data.success ? 'SUCCESS' : 'FAILURE'}</span></div>
                    <div><span class="text-slate-400">Spheres:</span> <span class="text-yellow-300">+${report.data.spheres?.toLocaleString() || 0}</span></div>
                    <div><span class="text-slate-400">Casualties:</span> <span class="text-orange-400">${report.data.casualties || 0}</span></div>
                    ${report.data.gotGemheart ? `<div><span class="text-purple-400 font-bold">💎 GEMHEART CAPTURED!</span></div>` : ''}
                </div>
            `;
        } else if (report.type === 'plateau' && report.data) {
            detailsHTML = `
                <div class="mt-2 pt-2 border-t border-${color}-500/20 space-y-1 text-xs">
                    <div><span class="text-slate-400">Result:</span> <span class="text-${report.data.victory ? 'green' : 'red'}-400">${report.data.victory ? 'VICTORY' : 'DEFEAT'}</span></div>
                    <div><span class="text-slate-400">Loot Share:</span> <span class="text-yellow-300">+${report.data.spheres?.toLocaleString() || 0}</span></div>
                    <div><span class="text-slate-400">Casualties:</span> <span class="text-orange-400">${report.data.casualties || 0}</span></div>
                    ${report.data.playerGotGem ? `<div><span class="text-purple-400 font-bold">💎 GEMHEART SECURED!</span></div>` : ''}
                    ${report.data.gemheartWinnerName ? `<div><span class="text-slate-400">Gemheart Winner:</span> <span class="text-slate-300">${report.data.gemheartWinnerName}</span></div>` : ''}
                </div>
            `;
        } else if (report.type === 'growth' && report.data) {
            // Build detailed breakdown for daily report
            const netIncome = report.data.spheres || 0;
            const fromGems = report.data.fromGems || 0;
            const fromMarkets = report.data.fromMarkets || 0;
            const buildingUpkeep = report.data.buildingUpkeep || 0;
            const unitUpkeep = report.data.unitUpkeepPenalty || 0;
            const researchGems = report.data.researchGemsGained || 0;
            
            // Income section
            let incomeHTML = `
                <div class="mt-2 pt-2 border-t border-${color}-500/20">
                    <div class="text-[10px] uppercase text-emerald-400 font-bold mb-1">INCOME</div>
                    <div class="space-y-1 text-xs">
                        <div class="flex justify-between"><span class="text-slate-400">From Gemhearts:</span> <span class="text-cyan-300">+${fromGems.toLocaleString()}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">From Markets/Ledgers:</span> <span class="text-blue-300">+${fromMarkets.toLocaleString()}</span></div>
            `;
            
            if (researchGems > 0) {
                incomeHTML += `<div class="flex justify-between"><span class="text-purple-400">💎 Research Gemheart:</span> <span class="text-purple-300">+${researchGems}</span></div>`;
            }
            incomeHTML += `</div></div>`;
            
            // Costs section
            let costsHTML = '';
            if (buildingUpkeep > 0 || unitUpkeep > 0) {
                costsHTML = `
                    <div class="mt-2 pt-2 border-t border-${color}-500/20">
                        <div class="text-[10px] uppercase text-orange-400 font-bold mb-1">COSTS</div>
                        <div class="space-y-1 text-xs">
                `;
                
                if (unitUpkeep > 0) {
                    const tier = report.data.unitUpkeepTier || 'Unknown';
                    const totalUnits = report.data.totalUnits || 0;
                    const percent = report.data.unitUpkeepPercent ? Math.floor(report.data.unitUpkeepPercent * 100) : 0;
                    costsHTML += `<div class="flex justify-between"><span class="text-slate-400">Unit Upkeep (${tier}):</span> <span class="text-orange-400">-${unitUpkeep.toLocaleString()}</span></div>`;
                    costsHTML += `<div class="text-[10px] text-slate-500 ml-4">${totalUnits} units, -${percent}% income</div>`;
                }
                
                if (buildingUpkeep > 0) {
                    costsHTML += `<div class="flex justify-between"><span class="text-slate-400">Building Upkeep:</span> <span class="text-orange-400">-${buildingUpkeep.toLocaleString()}</span></div>`;
                    if (report.data.buildingUpkeepDetails && report.data.buildingUpkeepDetails.length > 0) {
                        costsHTML += `<div class="text-[10px] text-slate-500 ml-4">${report.data.buildingUpkeepDetails.join(', ')}</div>`;
                    }
                }
                
                costsHTML += `</div></div>`;
            }
            
            // Net income summary
            const netColor = netIncome >= 0 ? 'green' : 'red';
            const netHTML = `
                <div class="mt-2 pt-2 border-t border-${color}-500/20">
                    <div class="flex justify-between text-sm font-bold">
                        <span class="text-slate-300">Net Income:</span>
                        <span class="text-${netColor}-400">${netIncome >= 0 ? '+' : ''}${netIncome.toLocaleString()} S</span>
                    </div>
                </div>
            `;
            
            // Active missions section
            let missionsHTML = '';
            if (report.data.deployments && report.data.deployments.length > 0) {
                const now = Date.now();
                const missionRows = report.data.deployments.map(deployment => {
                    const timeLeft = deployment.returnTime - report.timestamp;
                    const hoursLeft = Math.max(0, timeLeft / 3600000);
                    const typeLabel = deployment.type === 'espionage' ? '🔍 Espionage' :
                                     deployment.type === 'scout' ? '👁️ Scout' :
                                     deployment.type === 'attack' ? '⚔️ Attack' :
                                     deployment.type === 'conquest' ? '🏰 Conquest' :
                                     deployment.type === 'plateau' ? '⛰️ Plateau Run' : deployment.type;
                    return `<div class="flex justify-between"><span class="text-slate-400">${typeLabel}</span> <span class="text-cyan-300">${hoursLeft.toFixed(1)}h left</span></div>`;
                }).join('');
                
                missionsHTML = `
                    <div class="mt-2 pt-2 border-t border-${color}-500/20">
                        <div class="text-[10px] uppercase text-cyan-400 font-bold mb-1">ACTIVE MISSIONS (${report.data.deployments.length})</div>
                        <div class="space-y-1 text-xs">
                            ${missionRows}
                        </div>
                    </div>
                `;
            }
            
            detailsHTML = incomeHTML + costsHTML + netHTML + missionsHTML;
        } else if (report.type === 'defense' && report.data) {
            detailsHTML = `
                <div class="mt-2 pt-2 border-t border-${color}-500/20 space-y-1 text-xs">
                    <div><span class="text-slate-400">Result:</span> <span class="text-${report.data.success ? 'green' : 'orange'}-400">${report.data.success ? 'REPELLED' : 'BREACHED'}</span></div>
                    <div><span class="text-slate-400">Enemy Power:</span> <span class="text-red-300">${report.data.attackPower || 0}</span></div>
                </div>
            `;
        }
        
        return `
            <div class="bg-slate-900/50 border border-${color}-500/30 rounded p-3 cursor-pointer hover:bg-slate-800/50 transition-colors" onclick="game.toggleReportDetails('${detailsId}')">
                <div class="flex justify-between items-start mb-1">
                    <div class="flex items-center gap-2">
                        <span id="${detailsId}-arrow" class="text-${color}-400 text-xs">▶</span>
                        <span class="text-${color}-400 text-xs font-bold uppercase">${displayName}</span>
                    </div>
                    <span class="text-slate-500 text-[10px]">${time}</span>
                </div>
                <p class="text-slate-300 text-sm ml-5">${report.message}</p>
                <div id="${detailsId}" class="hidden ml-5">
                    ${detailsHTML}
                </div>
            </div>
        `;
    }).join('');
}

export function toggleReportDetails(detailsId) {
    const detailsEl = document.getElementById(detailsId);
    const arrowEl = document.getElementById(`${detailsId}-arrow`);
    
    if (!detailsEl || !arrowEl) return;
    
    const isHidden = detailsEl.classList.contains('hidden');
    
    if (isHidden) {
        detailsEl.classList.remove('hidden');
        arrowEl.textContent = '▼';
    } else {
        detailsEl.classList.add('hidden');
        arrowEl.textContent = '▶';
    }
}

export function openMissionDetails(gameState, missionIndex) {
    const mission = gameState.state.deployments[missionIndex];
    if (!mission) return;
    
    // Store the mission index for recall
    gameState.state.selectedMissionIndex = missionIndex;
    
    const modal = document.getElementById('mission-details-modal');
    if (!modal) return;
    
    // Update mission type
    const typeLabel = mission.type === 'espionage' ? 'ESPIONAGE OPERATION' : 
                      mission.type === 'conquest' ? 'TERRITORIAL CONQUEST' :
                      mission.type.toUpperCase();
    document.getElementById('mission-detail-type').textContent = typeLabel;
    
    // Update time information
    const timeLeftRealMs = Math.max(0, (mission.returnTime - getCurrentGameTime()) / 24); // convert game ms to real ms
    const hrs = Math.floor(timeLeftRealMs / 3600000);
    const mins = Math.floor((timeLeftRealMs % 3600000) / 60000);
    const secs = Math.floor((timeLeftRealMs % 60000) / 1000);
    
    let timeStr = `${secs}s`;
    if (hrs > 0) timeStr = `${hrs}h ${mins}m ${secs}s`;
    else if (mins > 0) timeStr = `${mins}m ${secs}s`;
    
    document.getElementById('mission-detail-time').textContent = timeStr;
    
    // Convert game time back to real-world time for display
    // Mission returns at: now + (remaining game ms / 24x multiplier)
    const remainingGameMs = Math.max(0, mission.returnTime - getCurrentGameTime());
    const remainingRealMs = remainingGameMs / 24; // 24x game speed
    const realReturnTime = new Date(Date.now() + remainingRealMs);
    document.getElementById('mission-detail-return').textContent = realReturnTime.toLocaleString();
    
    // Update units deployed
    const unitsContainer = document.getElementById('mission-detail-units');
    const espionageSection = document.getElementById('mission-detail-espionage');
    const conquestSection = document.getElementById('mission-detail-conquest');
    
    if (mission.type === 'espionage') {
        // Show espionage-specific info
        espionageSection.classList.remove('hidden');
        if (conquestSection) conquestSection.classList.add('hidden');
        unitsContainer.innerHTML = '';
        document.getElementById('mission-detail-total').textContent = mission.myAgents || 0;
        
        const targetName = mission.targetName || NPC_PRINCES[mission.targetKey]?.name || mission.targetKey || 'Unknown';
        document.getElementById('mission-detail-target').textContent = targetName;
        document.getElementById('mission-detail-action').textContent = mission.actionLabel || mission.action || 'Mission';
        document.getElementById('mission-detail-agents').textContent = mission.myAgents || 0;
    } else if (mission.type === 'conquest') {
        // Show conquest-specific info
        espionageSection.classList.add('hidden');
        if (conquestSection) {
            conquestSection.classList.remove('hidden');
            
            const playerPower = mission.power || 0;
            const landReward = mission.landReward || 0;
            
            document.getElementById('mission-detail-conquest-power').textContent = Math.floor(playerPower);
            document.getElementById('mission-detail-conquest-enemy').textContent = 'Classified';
            document.getElementById('mission-detail-conquest-land').textContent = landReward;
            document.getElementById('mission-detail-conquest-chance').textContent = 'Deterministic';
        }
        
        // Show military units
        if (mission.units) {
            const unitLabels = {
                bridgecrews: 'Bridgecrews',
                spearmen: 'Spearmen',
                archers: 'Archers',
                shardbearers: 'Shardbearers',
                chulls: 'Chulls'
            };
            
            let unitsHtml = '';
            let totalUnits = 0;
            
            for (const [unitType, count] of Object.entries(mission.units)) {
                if (count > 0) {
                    unitsHtml += `
                        <div class="flex justify-between">
                            <span class="text-slate-400">${unitLabels[unitType] || unitType}:</span>
                            <span class="text-white font-bold">${count}</span>
                        </div>
                    `;
                    totalUnits += count;
                }
            }
            
            unitsContainer.innerHTML = unitsHtml || '<p class="text-slate-500 text-xs italic">No units</p>';
            document.getElementById('mission-detail-total').textContent = totalUnits;
        }
    } else {
        // Show military units (scout/attack/run)
        espionageSection.classList.add('hidden');
        if (conquestSection) conquestSection.classList.add('hidden');
        
        if (mission.units) {
            const unitLabels = {
                bridgecrews: 'Bridgecrews',
                spearmen: 'Spearmen',
                archers: 'Archers',
                shardbearers: 'Shardbearers',
                chulls: 'Chulls'
            };
            
            let unitsHtml = '';
            let totalUnits = 0;
            
            for (const [unitType, count] of Object.entries(mission.units)) {
                if (count > 0) {
                    unitsHtml += `
                        <div class="flex justify-between">
                            <span class="text-slate-400">${unitLabels[unitType] || unitType}:</span>
                            <span class="text-white font-bold">${count}</span>
                        </div>
                    `;
                    totalUnits += count;
                }
            }
            
            unitsContainer.innerHTML = unitsHtml || '<p class="text-slate-500 text-xs italic">No units</p>';
            document.getElementById('mission-detail-total').textContent = totalUnits;
        }
    }
    
    modal.classList.add('open');
}

export function closeMissionDetailsModal() {
    const modal = document.getElementById('mission-details-modal');
    if (modal) modal.classList.remove('open');
}

export async function sendSpanreedMessage() {
    const input = document.getElementById('message-input');
    const recipientInput = document.getElementById('message-recipient');
    
    if (!input || !recipientInput || !input.value.trim() || !recipientInput.value.trim()) {
        alert('Please enter a recipient username and message');
        return;
    }
    
    try {
        const response = await authFetch(`${SERVER_URL}/api/messages/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipientUsername: recipientInput.value.trim(),
                message: input.value.trim()
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            alert(data.error || 'Failed to send message');
            return;
        }
        
        input.value = '';
        recipientInput.value = '';
        
        // Reload messages to show the sent message
        await loadPlayerMessages();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

export async function loadPlayerMessages() {
    const list = document.getElementById('messages-list');
    if (!list) return;
    
    try {
        const response = await authFetch(`${SERVER_URL}/api/messages/inbox?limit=50`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            list.innerHTML = '<p class="text-red-500 text-sm text-center py-8">Failed to load messages</p>';
            return;
        }
        
        if (data.messages.length === 0) {
            list.innerHTML = '<p class="text-slate-500 text-sm italic text-center py-8">No messages yet. Send a spanreed to another player.</p>';
            return;
        }
        
        list.innerHTML = data.messages.map(msg => {
            const time = new Date(msg.sent_at).toLocaleString();
            const isUnread = !msg.read;
            
            return `
                <div class="bg-slate-900/50 border ${isUnread ? 'border-cyan-400/50' : 'border-cyan-500/30'} rounded p-3 ${isUnread ? 'shadow-lg shadow-cyan-500/20' : ''}">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-cyan-400 text-xs font-bold">
                            ${isUnread ? '🟢 ' : ''}From: ${msg.sender_username}
                        </span>
                        <span class="text-slate-500 text-[10px]">${time}</span>
                    </div>
                    <p class="text-slate-300 text-sm">${msg.message}</p>
                </div>
            `;
        }).join('');
        
        // Mark messages as read
        const unreadIds = data.messages.filter(m => !m.read).map(m => m.id);
        if (unreadIds.length > 0) {
            authFetch(`${SERVER_URL}/api/messages/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messageIds: unreadIds })
            }).catch(err => console.error('Failed to mark messages as read:', err));
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        list.innerHTML = '<p class="text-red-500 text-sm text-center py-8">Failed to load messages</p>';
    }
}

export function updateMessagesList(gameState) {
    // Now just calls loadPlayerMessages
    loadPlayerMessages();
}

export async function loadPlayerList() {
    const datalist = document.getElementById('player-list');
    if (!datalist) return;
    
    try {
        const token = localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await fetch(`${SERVER_URL}/api/players?limit=100&excludeSelf=true`, { headers });
        const data = await response.json();
        
        if (response.ok && data.success && data.players) {
            datalist.innerHTML = data.players.map(player => 
                `<option value="${player.username}">`
            ).join('');
        }
    } catch (error) {
        console.error('Error loading player list:', error);
    }
}

export function openMessageToPlayer(username) {
    // Open Spanreed modal
    const modal = document.getElementById('spanreed-modal');
    if (modal) {
        modal.classList.add('open');
    }
    
    // Switch to Messages tab
    if (window.game && typeof window.game.setSpanreedTab === 'function') {
        window.game.setSpanreedTab('messages');
    }
    
    // Pre-fill the recipient
    setTimeout(() => {
        const recipientInput = document.getElementById('message-recipient');
        if (recipientInput) {
            recipientInput.value = username;
            recipientInput.focus();
            
            // Focus on the message input
            setTimeout(() => {
                const messageInput = document.getElementById('message-input');
                if (messageInput) {
                    messageInput.focus();
                }
            }, 100);
        }
    }, 100);
}

// ============================================
// RANKINGS & PLAYER SEARCH
// ============================================

const LEADERBOARD_INTEL_STORAGE_KEY = 'warcamps_leaderboard_intel';

function loadLeaderboardIntelCache() {
    try {
        return JSON.parse(localStorage.getItem(LEADERBOARD_INTEL_STORAGE_KEY) || '{}');
    } catch (error) {
        console.warn('Failed to read leaderboard intel cache:', error);
        return {};
    }
}

function getMetricValue(player, metric) {
    if (metric === 'spheres') return player.spheres || 0;
    if (metric === 'military') return player.totalMilitary || 0;
    if (metric === 'land') return player.totalLand || 0;
    if (metric === 'days') return player.dayCount || 0;
    return player.rankValue || 0;
}

function applyInvestigationIntel(leaderboard, metric, snapshotGeneratedAt = 0) {
    const intelByPlayer = loadLeaderboardIntelCache();

    const merged = leaderboard.map((player) => {
        const intel = intelByPlayer[player.username];
        if (!intel) {
            return {
                ...player,
                isFreshIntel: false,
                intelCapturedAt: null
            };
        }

        const metricTimestamps = intel.metricTimestamps || {};
        const metricKey = metric === 'spheres' ? 'spheres'
            : metric === 'military' ? 'military'
            : metric === 'land' ? 'land'
            : metric === 'days' ? 'days'
            : metric;
        const metricUpdatedAt = metricTimestamps[metricKey] || 0;
        const isFreshIntel = metricUpdatedAt > snapshotGeneratedAt;
        return {
            ...player,
            spheres: typeof intel.spheres === 'number' ? intel.spheres : player.spheres,
            totalMilitary: typeof intel.totalMilitary === 'number' ? intel.totalMilitary : player.totalMilitary,
            totalLand: typeof intel.totalLand === 'number' ? intel.totalLand : player.totalLand,
            dayCount: typeof intel.dayCount === 'number' ? intel.dayCount : player.dayCount,
            isFreshIntel,
            intelCapturedAt: intel.capturedAt || null,
            metricUpdatedAt
        };
    });

    merged.sort((a, b) => {
        const diff = getMetricValue(b, metric) - getMetricValue(a, metric);
        if (diff !== 0) return diff;
        return (a.username || '').localeCompare(b.username || '');
    });

    return merged;
}

function updateLeaderboardSnapshotLabel(snapshotGeneratedAt, nextSnapshotAt) {
    const infoEl = document.getElementById('leaderboard-snapshot-info');
    if (!infoEl) return;

    if (!snapshotGeneratedAt || !nextSnapshotAt) {
        infoEl.textContent = 'Snapshot schedule unavailable.';
        return;
    }

    const nextUpdateText = new Date(nextSnapshotAt).toLocaleString();
    const generatedText = new Date(snapshotGeneratedAt).toLocaleString();
    infoEl.textContent = `Snapshot captured: ${generatedText} | Next 24h refresh: ${nextUpdateText}`;
}

export async function showRankings(metric = 'spheres') {
    // Update active button
    document.querySelectorAll('.ranking-metric-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.metric === metric) {
            btn.classList.add('active');
        }
    });
    
    // Update table header
    const headerMap = {
        spheres: '💰 Spheres',
        military: '⚔️ Military',
        land: '🏘️ Land',
        days: '📅 Days'
    };
    document.getElementById('ranking-header-value').textContent = headerMap[metric] || 'Amount';
    
    try {
        const response = await fetch(`${SERVER_URL}/api/rankings?metric=${metric}&limit=20`);
        const result = await response.json();
        
        if (!result.success || !result.leaderboard) {
            throw new Error('Failed to load rankings');
        }
        
        updateLeaderboardSnapshotLabel(result.snapshotGeneratedAt, result.nextSnapshotAt);

        const mergedLeaderboard = applyInvestigationIntel(
            result.leaderboard,
            metric,
            result.snapshotGeneratedAt || 0
        );

        const tbody = document.getElementById('rankings-table-body');
        if (mergedLeaderboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-slate-500">No players found</td></tr>';
            return;
        }
        
        tbody.innerHTML = mergedLeaderboard.map((player, index) => {
            let valueDisplay;
            switch(metric) {
                case 'spheres':
                    valueDisplay = player.spheres.toLocaleString();
                    break;
                case 'military':
                    valueDisplay = player.totalMilitary.toLocaleString();
                    break;
                case 'land':
                    valueDisplay = player.totalLand.toLocaleString();
                    break;
                case 'days':
                    valueDisplay = player.dayCount;
                    break;
                default:
                    valueDisplay = Math.floor(player.rankValue).toLocaleString();
            }
            
            const rank = index + 1;
            const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-orange-400' : 'text-slate-500';
            const freshnessBadge = player.isFreshIntel
                ? '<span class="ml-2 text-[10px] text-green-300 uppercase font-bold">LIVE INTEL</span>'
                : '';
            const rowClass = player.isFreshIntel
                ? 'border-b border-slate-800 hover:bg-slate-800/50 bg-green-900/20 ring-1 ring-green-500/40 animate-pulse cursor-pointer relative leaderboard-player-row'
                : 'border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer relative leaderboard-player-row';
            
            return `
                <tr class="${rowClass}" data-username="${player.username}" onclick="game.showLeaderboardContextMenu(event, '${player.username}')">
                    <td class="p-2 ${rankColor} font-bold">${rank}</td>
                    <td class="p-2 text-white">${player.username}${freshnessBadge}</td>
                    <td class="p-2 text-right text-cyan-400 font-mono">${valueDisplay}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading rankings:', error);
        updateLeaderboardSnapshotLabel(0, 0);
        document.getElementById('rankings-table-body').innerHTML = 
            '<tr><td colspan="3" class="text-center p-4 text-red-400">Failed to load rankings</td></tr>';
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('warcamps:leaderboard-intel-updated', () => {
        const rankingsPanel = document.getElementById('panel-rankings');
        if (!rankingsPanel || rankingsPanel.classList.contains('hidden')) return;
        refreshRankings();
    });
}

export async function searchPlayers() {
    const input = document.getElementById('player-search-input');
    const resultsDiv = document.getElementById('player-search-results');
    const searchTerm = input.value.trim();
    
    if (!searchTerm) {
        resultsDiv.innerHTML = '<p class="text-slate-500 text-xs">Enter a username to search</p>';
        return;
    }
    
    resultsDiv.innerHTML = '<p class="text-slate-400 text-xs">Searching...</p>';
    
    try {
        const token = localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await fetch(
            `${SERVER_URL}/api/players?search=${encodeURIComponent(searchTerm)}&limit=10&excludeSelf=true`,
            { headers }
        );
        const result = await response.json();
        
        if (!result.success || !result.players) {
            throw new Error('Failed to search players');
        }
        
        if (result.players.length === 0) {
            resultsDiv.innerHTML = '<p class="text-slate-500 text-xs">No players found</p>';
            return;
        }
        
        resultsDiv.innerHTML = result.players.map(player => `
            <div class="bg-slate-900/50 border border-slate-700 rounded p-2">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-white text-xs font-bold">${player.username}</p>
                        <p class="text-slate-400 text-[10px]">
                            ${player.spheres.toLocaleString()} S | 
                            ${player.totalMilitary} troops | 
                            Day ${player.dayCount}
                        </p>
                    </div>
                    <div class="flex flex-col gap-1">
                        <button 
                            onclick="event.stopPropagation(); game.targetPlayerForEspionage('${player.username}')" 
                            class="bg-purple-700 hover:bg-purple-600 text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap"
                        >
                            🕵️ Spy
                        </button>
                        <button 
                            onclick="event.stopPropagation(); game.startConquestOnPlayer('${player.username}')" 
                            class="bg-red-700 hover:bg-red-600 text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap"
                        >
                            ⚔️ Conquer
                        </button>
                        <button 
                            onclick="event.stopPropagation(); game.viewPlayerProfile('${player.username}')" 
                            class="bg-cyan-800 hover:bg-cyan-700 text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap"
                        >
                            📋 Profile
                        </button>
                        <button 
                            onclick="event.stopPropagation(); game.openMessageToPlayer('${player.username}')" 
                            class="bg-green-700 hover:bg-green-600 text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap"
                        >
                            💬 Message
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error searching players:', error);
        resultsDiv.innerHTML = '<p class="text-red-400 text-xs">Search failed</p>';
    }
}

export async function refreshRankings() {
    const activeBtn = document.querySelector('.ranking-metric-btn.active');
    const metric = activeBtn ? activeBtn.dataset.metric : 'spheres';
    await showRankings(metric);
}

// ============================================
// ESPIONAGE TARGET SELECTION
// ============================================

export function setEspionageTargetType(type) {
    const npcBtn = document.getElementById('spy-target-type-npc');
    const playerBtn = document.getElementById('spy-target-type-player');
    const npcTargets = document.getElementById('spy-npc-targets');
    const playerTargets = document.getElementById('spy-player-targets');
    
    if (type === 'npc') {
        npcBtn.classList.add('bg-slate-700', 'text-slate-300', 'border-green-500');
        npcBtn.classList.remove('bg-slate-800', 'text-slate-500', 'border-transparent');
        playerBtn.classList.add('bg-slate-800', 'text-slate-500', 'border-transparent');
        playerBtn.classList.remove('bg-slate-700', 'text-slate-300', 'border-green-500');
        npcTargets.classList.remove('hidden');
        playerTargets.classList.add('hidden');
    } else {
        playerBtn.classList.add('bg-slate-700', 'text-slate-300', 'border-green-500');
        playerBtn.classList.remove('bg-slate-800', 'text-slate-500', 'border-transparent');
        npcBtn.classList.add('bg-slate-800', 'text-slate-500', 'border-transparent');
        npcBtn.classList.remove('bg-slate-700', 'text-slate-300', 'border-green-500');
        npcTargets.classList.add('hidden');
        playerTargets.classList.remove('hidden');
    }
}

export async function searchEspionageTargets() {
    const input = document.getElementById('spy-player-search-input');
    const resultsDiv = document.getElementById('spy-player-search-results');
    const searchTerm = input.value.trim();
    
    if (!searchTerm) {
        resultsDiv.innerHTML = '<p class="text-slate-500 text-[10px] text-center py-2">Enter a username to search</p>';
        return;
    }
    
    resultsDiv.innerHTML = '<p class="text-slate-400 text-[10px] text-center py-2">Searching...</p>';
    
    try {
        const token = localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await fetch(
            `${SERVER_URL}/api/players?search=${encodeURIComponent(searchTerm)}&limit=10&excludeSelf=true`,
            { headers }
        );
        const result = await response.json();
        
        if (!result.success || !result.players) {
            throw new Error('Failed to search players');
        }
        
        if (result.players.length === 0) {
            resultsDiv.innerHTML = '<p class="text-slate-500 text-[10px] text-center py-2">No players found</p>';
            return;
        }
        
        resultsDiv.innerHTML = result.players.map(player => `
            <div 
                onclick="game.selectEspionageTarget('${player.username}')" 
                class="bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 rounded p-2 cursor-pointer transition-colors"
            >
                <p class="text-white text-[10px] font-bold">${player.username}</p>
                <p class="text-slate-400 text-[9px]">${player.totalMilitary} troops | Day ${player.dayCount}</p>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error searching players:', error);
        resultsDiv.innerHTML = '<p class="text-red-400 text-[10px] text-center py-2">Search failed</p>';
    }
}

export function selectEspionageTarget(username) {
    document.getElementById('spy-selected-player').value = username;
    document.getElementById('spy-selected-player-name').textContent = username;
    document.getElementById('spy-selected-player-display').classList.remove('hidden');
    document.getElementById('spy-player-search-results').innerHTML = 
        '<p class="text-green-400 text-[10px] text-center py-2">✓ Target selected</p>';
    
    // Trigger UI update to show player suspicion
    window.dispatchEvent(new CustomEvent('warcamps:update-ui'));
}

export function clearEspionageTarget() {
    document.getElementById('spy-selected-player').value = '';
    document.getElementById('spy-selected-player-display').classList.add('hidden');
    document.getElementById('spy-player-search-results').innerHTML = 
        '<p class="text-slate-500 text-[10px] text-center py-2">Search for a player to target</p>';
    
    // Trigger UI update to reset suspicion display
    window.dispatchEvent(new CustomEvent('warcamps:update-ui'));
}

// ============================================
// PLAYER PROFILE  
// ============================================

export async function viewPlayerProfile(username) {
    const modal = document.getElementById('player-profile-modal');
    const loading = document.getElementById('profile-loading');
    const content = document.getElementById('profile-content');
    const error = document.getElementById('profile-error');
    
    // Show modal and loading state
    modal.classList.add('open');
    loading.classList.remove('hidden');
    content.classList.add('hidden');
    error.classList.add('hidden');
    document.getElementById('profile-username').textContent = username;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/player/${encodeURIComponent(username)}`);
        const result = await response.json();
        
        if (!result.success || !result.player) {
            throw new Error('Failed to load player data');
        }
        
        const player = result.player;
        
        // Update profile fields
        document.getElementById('profile-created').textContent = new Date(player.created_at).toLocaleDateString();
        document.getElementById('profile-days').textContent = player.day_count || 0;
        document.getElementById('profile-spearmen').textContent = (player.military_spearmen || 0).toLocaleString();
        document.getElementById('profile-archers').textContent = (player.military_archers || 0).toLocaleString();
        document.getElementById('profile-chulls').textContent = (player.military_chulls || 0).toLocaleString();
        document.getElementById('profile-shardbearers').textContent = (player.military_shardbearers || 0).toLocaleString();
        document.getElementById('profile-markets').textContent = (player.buildings_market || 0).toLocaleString();
        
        const totalMilitary = (player.military_spearmen || 0) + (player.military_archers || 0) + 
                             (player.military_chulls || 0) + (player.military_shardbearers || 0);
        document.getElementById('profile-total-military').textContent = totalMilitary.toLocaleString();
        
        const totalBuildings = (player.buildings_market || 0);
        document.getElementById('profile-total-buildings').textContent = totalBuildings.toLocaleString();
        
        // Show content
        loading.classList.add('hidden');
        content.classList.remove('hidden');
        
    } catch (err) {
        console.error('Error loading player profile:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

export function targetPlayerForEspionage(username) {
    // Close profile modal
    document.getElementById('player-profile-modal').classList.remove('open');
    
    // Open spy modal and set to player targeting mode
    const spyModal = document.getElementById('spy-modal');
    spyModal.classList.add('open');
    
    // Switch to player targeting mode
    setEspionageTargetType('player');
    
    // Pre-select the player
    selectEspionageTarget(username);
}

// ============================================
// LEADERBOARD CONTEXT MENU
// ============================================

export function showLeaderboardContextMenu(event, username) {
    event.preventDefault();
    event.stopPropagation();
    
    // Close any existing menu
    const existingMenu = document.getElementById('leaderboard-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'leaderboard-context-menu';
    menu.className = 'fixed bg-slate-900 border border-slate-600 rounded shadow-lg z-50 overflow-hidden';
    menu.style.minWidth = '150px';
    
    // Calculate position based on click
    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.top = (rect.top + 10) + 'px';
    menu.style.left = (rect.left + 10) + 'px';
    
    menu.innerHTML = `
        <div class="text-slate-300 text-[10px] font-bold p-2 border-b border-slate-700 bg-slate-800">
            ${username}
        </div>
        <button 
            onclick="event.stopPropagation(); game.targetPlayerForEspionage('${username}'); document.getElementById('leaderboard-context-menu')?.remove();"
            class="w-full text-left px-3 py-2 hover:bg-purple-800 text-purple-300 text-[10px] font-bold transition-colors"
        >
            🕵️ Espionage
        </button>
        <button 
            onclick="event.stopPropagation(); game.startConquestOnPlayer('${username}'); document.getElementById('leaderboard-context-menu')?.remove();"
            class="w-full text-left px-3 py-2 hover:bg-red-800 text-red-300 text-[10px] font-bold transition-colors border-t border-slate-700"
        >
            ⚔️ Conquest
        </button>
        <button 
            onclick="event.stopPropagation(); game.viewPlayerProfile('${username}'); document.getElementById('leaderboard-context-menu')?.remove();"
            class="w-full text-left px-3 py-2 hover:bg-cyan-800 text-cyan-300 text-[10px] font-bold transition-colors border-t border-slate-700"
        >
            📋 View Profile
        </button>
        <button 
            onclick="event.stopPropagation(); game.openMessageToPlayer('${username}'); document.getElementById('leaderboard-context-menu')?.remove();"
            class="w-full text-left px-3 py-2 hover:bg-green-800 text-green-300 text-[10px] font-bold transition-colors border-t border-slate-700"
        >
            💬 Send Message
        </button>
    `;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking elsewhere
    const closeMenu = () => {
        if (document.getElementById('leaderboard-context-menu')) {
            document.getElementById('leaderboard-context-menu').remove();
        }
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

export function startConquestOnPlayer(username) {
    // Close profile modal if open
    const profileModal = document.getElementById('player-profile-modal');
    if (profileModal) {
        profileModal.classList.remove('open');
    }
    
    // Request the game instance to open deployment modal for conquest
    // The game instance will handle opening the modal and setting targets
    if (window.gameInstance && typeof window.gameInstance.openDeployModal === 'function') {
        window.gameInstance.openDeployModal('conquest');
        
        // After a brief delay, set the player target in the conquest dropdown
        setTimeout(() => {
            const targetSelect = document.getElementById('conquest-target');
            if (targetSelect) {
                targetSelect.value = `player:${username}`;
                // Trigger update to refresh mission info
                if (window.gameInstance && typeof window.gameInstance.updateMissionInfo === 'function') {
                    window.gameInstance.updateMissionInfo();
                }
            }
        }, 100);
    }
}
// ============================================
// MESSAGE POLLING
// ============================================

let messagePollingInterval = null;

export async function updateUnreadMessageCount() {
    try {
        const response = await authFetch(`/api/messages/unread-count`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            const badge = document.getElementById('unread-message-badge');
            if (badge) {
                if (data.count > 0) {
                    badge.textContent = data.count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }
    } catch (error) {
        console.error('Error fetching unread count:', error);
    }
}

export function startMessagePolling() {
    // Initial check
    updateUnreadMessageCount();
    
    // Poll every 30 seconds
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    messagePollingInterval = setInterval(updateUnreadMessageCount, 30000);
}

export function stopMessagePolling() {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
    }
}
