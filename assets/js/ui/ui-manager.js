// UI updates and rendering module
import { CONSTANTS, BUILDING_DATA, FABRIAL_DATA, NPC_PRINCES } from '../core/constants.js';
import { getArmyStats, getAvailableTroops, getSpyPower } from '../military/military.js';
import { getBuildingCost } from '../buildings/buildings.js';
import { formatTime } from '../core/utils.js';
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
    const totalDays = gameState.state.dayCount ?? 0;
    const daysPerYear = CONSTANTS.DAYS_PER_YEAR;
    const years = Math.floor(totalDays / daysPerYear) + 1;
    const remainingDays = totalDays % daysPerYear;
    const months = Math.floor(remainingDays / CONSTANTS.DAYS_PER_MONTH) + 1;
    const days = (remainingDays % CONSTANTS.DAYS_PER_MONTH) + 1;

    document.getElementById('display-date').innerText = `Year ${years}, Month ${months}, Day ${days}`;

    const lastTick = gameState.state.lastTickTime || Date.now();
    const msNext = CONSTANTS.DAY_MS - ((Date.now() - lastTick) % CONSTANTS.DAY_MS);
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
            const timeLeft = Math.max(0, (d.returnTime - Date.now()) / 1000).toFixed(0);
            const hrs = Math.floor(timeLeft / 3600);
            const mins = Math.floor((timeLeft % 3600) / 60);
            const secs = Math.floor(timeLeft % 60);

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
    const timeLeftMs = Math.max(0, active.returnTime - Date.now());
    const timeStr = formatTime(timeLeftMs);
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
        
        // Update enemy and reward info
        const enemyPower = document.getElementById('conquest-enemy-power');
        if (enemyPower) enemyPower.textContent = status.enemyPower;
        
        const landReward = document.getElementById('conquest-land-reward');
        if (landReward) landReward.textContent = status.landReward;
        
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
    
    if (!targetSelect || !displayEl) return;
    
    const targetKey = targetSelect.value;
    const rival = gameState.state.rivals[targetKey];
    
    if (rival) {
        const daysSinceSpy = rival.daysSinceLastSpy ?? 0;
        displayEl.textContent = `Suspicion: ${rival.suspicion}/100 (${rival.suspicionLevel}) | Counter Intel: ${rival.counterIntel} | Days Since Spy: ${daysSinceSpy}`;
    } else {
        displayEl.textContent = `Suspicion: 0/100 (unknown) | Counter Intel: 0 | Days Since Spy: 0`;
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
    document.getElementById('panel-' + tab).classList.remove('hidden');
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
    const timeLeftMs = Math.max(0, mission.returnTime - Date.now());
    const hrs = Math.floor(timeLeftMs / 3600000);
    const mins = Math.floor((timeLeftMs % 3600000) / 60000);
    const secs = Math.floor((timeLeftMs % 60000) / 1000);
    
    let timeStr = `${secs}s`;
    if (hrs > 0) timeStr = `${hrs}h ${mins}m ${secs}s`;
    else if (mins > 0) timeStr = `${mins}m ${secs}s`;
    
    document.getElementById('mission-detail-time').textContent = timeStr;
    document.getElementById('mission-detail-return').textContent = new Date(mission.returnTime).toLocaleString();
    
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

export function sendSpanreedMessage(gameState) {
    const input = document.getElementById('message-input');
    const recipientSelect = document.getElementById('message-recipient');
    
    if (!input || !recipientSelect || !input.value.trim()) return;
    
    const message = {
        from: 'You',
        to: recipientSelect.options[recipientSelect.selectedIndex].text,
        text: input.value.trim(),
        timestamp: Date.now()
    };
    
    gameState.state.messages.unshift(message);
    
    // Keep only last 50 messages
    if (gameState.state.messages.length > 50) {
        gameState.state.messages = gameState.state.messages.slice(0, 50);
    }
    
    input.value = '';
    updateMessagesList(gameState);
}

export function updateMessagesList(gameState) {
    const list = document.getElementById('messages-list');
    if (!list) return;
    
    if (gameState.state.messages.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-sm italic text-center py-8">No messages yet. Send a spanreed to another Highprince.</p>';
        return;
    }
    
    list.innerHTML = gameState.state.messages.map(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        return `
            <div class="bg-slate-900/50 border border-cyan-500/30 rounded p-3">
                <div class="flex justify-between items-start mb-1">
                    <span class="text-cyan-400 text-xs font-bold">${msg.from} → ${msg.to}</span>
                    <span class="text-slate-500 text-[10px]">${time}</span>
                </div>
                <p class="text-slate-300 text-sm">${msg.text}</p>
            </div>
        `;
    }).join('');}