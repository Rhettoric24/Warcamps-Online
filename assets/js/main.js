// Main entry point for Warcamp Simulator
import { CONSTANTS, NPC_PRINCES, DEV_MODE, BUILDING_DATA } from './core/constants.js';
import { createGameState, loadGameState, saveGameState } from './core/game-state.js';
import { initializeServerConnection, getCurrentGameTime, syncWithServer, gameMsToDays, formatGameTime, getTimeUntilNextDay } from './core/server-api.js';

// Log DEV_MODE status immediately on load
console.log('%c🎮 WARCAMP SIMULATOR LOADED', 'background: #1e3a8a; color: #00f2ff; font-weight: bold; padding: 8px; font-size: 14px;');
console.log(`DEV_MODE: ${DEV_MODE}`);
if (DEV_MODE) {
    console.log('%c⚡ DEV MODE IS ACTIVE', 'background: #fbbf24; color: black; font-weight: bold; padding: 4px 8px;');
    console.log('DAY_MS (milliseconds per game day):', CONSTANTS.DAY_MS);
} else {
    console.log('Dev mode is OFF. Change DEV_MODE to true in assets/js/core/constants.js');
}
import { log, requestNotificationPermission, updateNotificationButton, triggerNotification, flashScreen } from './core/utils.js';
import { updateUI, setTab, updateEspionageUI, addReport, updateReportsList, sendSpanreedMessage, updateMessagesList, toggleReportDetails, openMissionDetails, closeMissionDetailsModal } from './ui/ui-manager.js';
import { openModal, closeModal, updateModalStats, updateSpyNetwork, toggleTournamentCard, toggleBlackMarket, closeRecapModal, closeMissionModal, openSpanreedModal, closeSpanreedModal, setSpanreedTab, openSpyPlanningModal, closeSpyPlanningModal, openOfflineRecapModal, closeOfflineRecapModal } from './ui/modal-manager.js';
import { recruit, getArmyStats } from './military/military.js';
import { build, buyGemheart, constructFabrial, upgradeBuilding, getEffectiveBuildingBonus } from './buildings/buildings.js';
import { startDuel, commitThrill, enterTournament, useThrillAmplifier, useHalfShard, useRegenPlate, forfeitDuel } from './arena/arena.js';
import { spyAction, processSuspicionDecay } from './espionage/espionage.js';
import { openDeployModal, closeDeployModal, confirmDeploy, checkDeployments, updateMissionInfo, recallMission } from './events/deployments.js';
import { spawnEvent, simulateNPCJoin, resolveRun } from './events/plateau-runs.js';
import { checkHighstorm, updateHighstormEffects, hideHighstormNotification, showHighstormImpactModal } from './events/highstorm.js';
import { getConquestStatus, canStartConquest } from './events/conquest.js';

// Create global game instance
const gameInstance = {
    ...createGameState(),

    // Core methods
    async login() {
        const input = document.getElementById('username-input');
        const name = input.value.trim();
        if (!name) return;

        this.username = name;
        document.getElementById('player-name-display').innerText = name;
        
        // Connect to server before starting game
        log('Connecting to server...', 'text-cyan-400');
        const connected = await initializeServerConnection();
        if (!connected) {
            log('⚠️ Server connection failed. Please check your internet and refresh.', 'text-red-400 font-bold');
            return;
        }
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');

        loadGameState(name, this);
        this.processOfflineTime();
        updateUI(this);
        setInterval(() => this.loop(), CONSTANTS.UI_UPDATE_RATE);
        
        // Sync with server every 30 seconds to stay accurate
        setInterval(() => syncWithServer(), 30000);
        
        log(`Welcome, Highprince ${name}. Warcamp Command online.`, "text-cyan-400 font-bold");
        if (DEV_MODE) {
            log(`⚡ DEV MODE ACTIVE: 10-second days, 10k spheres, 2 gemhearts`, "text-yellow-400 font-bold");
            console.log('%c⚡ DEV MODE ENABLED', 'background: #fbbf24; color: black; font-weight: bold; padding: 4px 8px;');
            console.log('Day duration: 10 seconds');
            console.log('Starting spheres: 10,000');
            console.log('Starting gemhearts: 2');
        }
        updateNotificationButton();
    },

    init() {
        document.getElementById('username-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        // Update espionage display when target selection changes
        const targetSelects = [document.getElementById('spy-target-modal'), document.getElementById('spy-target')];
        targetSelects.forEach(select => {
            if (select) {
                select.addEventListener('change', () => {
                    updateEspionageUI(gameInstance);
                });
            }
        });
    },

    processOfflineTime() {
        const now = getCurrentGameTime();
        const currentDay = gameMsToDays(now);
        const lastDay = this.state.dayCount || 0;
        const daysPassed = currentDay - lastDay;
        const elapsed = daysPassed * (24 * 60 * 60 * 1000); // Convert days to game ms
        
        if (daysPassed > 0) {
            const summary = this.processDailyTicks(daysPassed, true);
            const completed = this.state.deployments.filter(d => {
                const deployReturnDay = gameMsToDays(d.returnTime);
                return deployReturnDay <= currentDay;
            });
            const missionCounts = completed.reduce((acc, d) => {
                const key = d.type || 'unknown';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            const completedTotal = completed.length;
            this.state.dayCount = currentDay;
            this.state.lastTickTime = now;
            saveGameState(this.username, this);
            const totalIncome = (summary.spheresFromGems || 0) + (summary.spheresFromMarkets || 0);
            const gemText = summary.researchGemsGained > 0
                ? `, +${summary.researchGemsGained} Gemheart${summary.researchGemsGained === 1 ? '' : 's'} from Research`
                : '';
            const missionText = completedTotal > 0
                ? `, ${completedTotal} mission${completedTotal === 1 ? '' : 's'} completed`
                : '';
            const daysAway = daysPassed;
            log(`Offline for ${daysPassed} days. +${totalIncome.toLocaleString()} spheres${gemText}${missionText}.`, "text-cyan-400");

            addReport(this, 'growth', `Offline catch-up: ${daysPassed} days, +${totalIncome.toLocaleString()} spheres${gemText}${missionText}.`, {
                days: daysPassed,
                spheres: totalIncome,
                fromGems: summary.spheresFromGems || 0,
                fromMarkets: summary.spheresFromMarkets || 0,
                gemhearts: summary.researchGemsGained || 0,
                missions: missionCounts,
                missionsTotal: completedTotal
            });

            const recapSummary = {
                ...summary,
                daysAway: daysAway,
                missions: missionCounts,
                missionsTotal: completedTotal
            };
            if (daysAway >= 2) this.showOfflineRecap(recapSummary);
        }
    },

    loop() {
        const now = getCurrentGameTime();
        const currentDay = gameMsToDays(now);
        const lastDay = this.state.dayCount || 0;
        const daysPassed = currentDay - lastDay;
        
        if (daysPassed > 0) {
            const isOffline = daysPassed > 1;
            this.processDailyTicks(daysPassed, isOffline);
            this.state.dayCount = currentDay;
            this.state.lastTickTime = now;
        }

        this.checkPlateau();
        checkDeployments(this);
        updateUI(this);
        this.state.lastActiveTime = now;
        this.state.lastGameTime = now; // Track server game time
        saveGameState(this.username, this);
    },

    checkPlateau() {
        if (!this.state.activeRun) return;

        const now = Date.now();
        const run = this.state.activeRun;

        if (run.phase === 'WARNING') {
            const timeLeft = (run.warnEndTime - now) / 1000;
            document.getElementById('plateau-timer').innerText = `WARNING: ${timeLeft.toFixed(1)}s`;
            if (now >= run.warnEndTime) {
                run.phase = 'OPEN';
                run.openEndTime = now + CONSTANTS.DAY_MS;
                document.getElementById('plateau-label').innerText = "MUSTER PHASE";
                document.getElementById('plateau-label').className = "absolute top-0 right-0 bg-green-600 text-[10px] font-bold px-2 py-1";
                document.getElementById('plateau-actions').classList.remove('hidden');
                document.getElementById('muster-leaderboard').classList.remove('hidden');
            }
        } else if (run.phase === 'OPEN') {
            const timeLeft = (run.openEndTime - now) / 1000;
            const hrs = Math.floor(timeLeft / 3600);
            const mins = Math.floor((timeLeft % 3600) / 60);
            const secs = Math.floor(timeLeft % 60);

            let timeStr = `${secs}s`;
            if (hrs > 0) timeStr = `${hrs}h ${mins}m`;
            else if (mins > 0) timeStr = `${mins}m ${secs}s`;

            document.getElementById('plateau-timer').innerText = `Departing: ${timeStr}`;

            if (Math.random() < 0.05) simulateNPCJoin(this);
            if (now >= run.openEndTime) {
                resolveRun(this);
            }
        }
    },

    processDailyTicks(count, isOffline = false) {
        let researchGemsGained = 0;
        let spheresFromGemsTotal = 0;
        let spheresFromMarketsTotal = 0;
        let suspicionChanges = [];
        let finalDeploymentCount = 0;
        let buildingUpkeepTotal = 0;
        let unitUpkeepReductionTotal = 0;
        let unitUpkeepTier = 'Low';
        let totalUnits = 0;
        
        for (let i = 0; i < count; i++) {
            const spheresFromGems = this.state.gemhearts * 75;
            this.state.spheres += spheresFromGems;
            spheresFromGemsTotal += spheresFromGems;

            // Calculate market income
            const marketIncome = BUILDING_DATA.market?.income ?? 100;
            const marketDamageMultiplier = getEffectiveBuildingBonus(this, 'market');
            let income = this.state.buildings.market * marketIncome * marketDamageMultiplier;
            if (this.state.fabrials.ledger > 0) income *= (1 + (0.5 * this.state.fabrials.ledger));

            // Calculate total army size for upkeep tier
            totalUnits = (this.state.military.bridgecrews || 0) +
                         (this.state.military.spearmen || 0) +
                         (this.state.military.archers || 0) +
                         (this.state.military.chulls || 0) +
                         (this.state.military.shardbearers || 0);

            // Determine unit upkeep tier and income penalty
            let unitUpkeepPenalty = 0;
            unitUpkeepTier = 'Low';
            if (totalUnits > 600) {
                unitUpkeepPenalty = 0.60;
                unitUpkeepTier = 'Crippling';
            } else if (totalUnits > 400) {
                unitUpkeepPenalty = 0.40;
                unitUpkeepTier = 'High';
            } else if (totalUnits > 200) {
                unitUpkeepPenalty = 0.20;
                unitUpkeepTier = 'Mild';
            }

            // Apply unit upkeep penalty to income
            const incomeBeforePenalty = income;
            income = Math.floor(income * (1 - unitUpkeepPenalty));
            const incomeReduction = incomeBeforePenalty - income;
            unitUpkeepReductionTotal += incomeReduction;

            this.state.spheres += income;
            spheresFromMarketsTotal += income;

            // Calculate building upkeep with soft caps
            let buildingUpkeep = 0;
            const buildingUpkeepDetails = [];

            // Market upkeep (after 10)
            const marketCount = this.state.buildings.market || 0;
            if (marketCount > 10) {
                if (marketCount > 20) {
                    const tier1 = 10 * 5; // Markets 11-20 at 5 S/day
                    const tier2 = (marketCount - 20) * 10; // Markets 21+ at 10 S/day
                    buildingUpkeep += tier1 + tier2;
                    buildingUpkeepDetails.push(`${tier1 + tier2} market upkeep`);
                } else {
                    const tier1 = (marketCount - 10) * 5; // Markets 11-20 at 5 S/day
                    buildingUpkeep += tier1;
                    buildingUpkeepDetails.push(`${tier1} market upkeep`);
                }
            }

            // Soulcaster upkeep (after 10)
            const bunkerCount = this.state.buildings.soulcaster || 0;
            if (bunkerCount > 10) {
                if (bunkerCount > 20) {
                    const tier1 = 10 * 8; // Bunkers 11-20 at 8 S/day
                    const tier2 = (bunkerCount - 20) * 15; // Bunkers 21+ at 15 S/day
                    buildingUpkeep += tier1 + tier2;
                    buildingUpkeepDetails.push(`${tier1 + tier2} bunker upkeep`);
                } else {
                    const tier1 = (bunkerCount - 10) * 8; // Bunkers 11-20 at 8 S/day
                    buildingUpkeep += tier1;
                    buildingUpkeepDetails.push(`${tier1} bunker upkeep`);
                }
            }

            // Monastery upkeep (50 S/day each)
            const monasteryCount = this.state.buildings.monastery || 0;
            if (monasteryCount > 0) {
                const monasteryUpkeep = monasteryCount * 50;
                buildingUpkeep += monasteryUpkeep;
                buildingUpkeepDetails.push(`${monasteryUpkeep} monastery upkeep`);
            }

            // Spy Network upkeep (75 S/day)
            const spyNetworkCount = this.state.buildings.spy_network || 0;
            if (spyNetworkCount > 0) {
                const spyNetworkUpkeep = spyNetworkCount * 75;
                buildingUpkeep += spyNetworkUpkeep;
                buildingUpkeepDetails.push(`${spyNetworkUpkeep} spy network upkeep`);
            }

            // Stormshelter upkeep (25 S/day each)
            const stormshelterCount = this.state.buildings.stormshelter || 0;
            if (stormshelterCount > 0) {
                const stormshelterUpkeep = stormshelterCount * 25;
                buildingUpkeep += stormshelterUpkeep;
                buildingUpkeepDetails.push(`${stormshelterUpkeep} stormshelter upkeep`);
            }

            // Apply building upkeep
            if (buildingUpkeep > 0) {
                this.state.spheres -= buildingUpkeep;
                buildingUpkeepTotal += buildingUpkeep;
            }

            // Reset champion HP to full every day
            this.state.arena.hp = this.state.arena.maxHp;
            
            // Reset daily arena fabrial use counts
            this.state.arena.thrillAmpUseCount = 0;
            this.state.arena.halfShardUseCount = 0;
            this.state.arena.regenPlateUseCount = 0;
            
            // Track gems gained THIS iteration (for daily report)
            let gemsThisDay = 0;
            const researchLibraries = this.state.buildings.research_library || 0;
            if (researchLibraries > 0) {
                // Base 10% chance per library, increased by +10% per upgrade level
                const libraryLevel = this.state.buildingLevels?.research_library || 1;
                const levelBonus = 1 + (0.10 * (libraryLevel - 1)); // 1.0 at lvl 1, 1.1 at lvl 2, etc.
                const chance = 0.10 * researchLibraries * levelBonus;
                if (Math.random() < chance) {
                    this.state.gemhearts += 1;
                    researchGemsGained += 1;
                    gemsThisDay = 1;
                }
            }
            if (!isOffline) {
                log("A new day! Your champion has recovered.", "text-green-400");
            }
            
            // Track day progression for per-day systems
            this.state.dayCount = (this.state.dayCount ?? 0) + 1;
            
            // Update highstorm effects (clear expired effects)
            updateHighstormEffects(this);
            
            // Process suspicion decay for all rivals and track changes if offline
            if (isOffline) {
                // Before decay, capture current suspicion levels
                const beforeSuspicion = {};
                for (const rivalKey in this.state.rivals) {
                    const rival = this.state.rivals[rivalKey];
                    beforeSuspicion[rivalKey] = {
                        suspicion: rival.suspicion || 0,
                        level: rival.suspicionLevel || 'unknown'
                    };
                }
                
                processSuspicionDecay(this);
                
                // After decay, check for significant changes
                for (const rivalKey in this.state.rivals) {
                    const rival = this.state.rivals[rivalKey];
                    const before = beforeSuspicion[rivalKey];
                    const after = {
                        suspicion: rival.suspicion || 0,
                        level: rival.suspicionLevel || 'unknown'
                    };
                    
                    // Track if suspicion changed significantly (dropped by 10+ or level changed)
                    if (before.suspicion > after.suspicion && 
                        (before.suspicion - after.suspicion >= 10 || before.level !== after.level)) {
                        const targetName = NPC_PRINCES[rivalKey]?.name || rivalKey;
                        suspicionChanges.push({
                            target: targetName,
                            before: before.suspicion,
                            after: after.suspicion,
                            levelBefore: before.level,
                            levelAfter: after.level
                        });
                    }
                }
            } else {
                processSuspicionDecay(this);
            }

            // Note: Conquest resolution is now handled by checkDeployments() as part of the deployment system

            if (!isOffline) {
                // Add daily growth report with detailed upkeep breakdown
                const netIncome = spheresFromGems + income - buildingUpkeep;
                const shouldReport = spheresFromGems > 0 || income > 0 || buildingUpkeep > 0 || incomeReduction > 0;
                
                if (shouldReport) {
                    // Count active deployments
                    const activeMissions = this.state.deployments.length;
                    const espionageMissions = this.state.deployments.filter(d => d.type === 'espionage').length;
                    
                    // Create concise summary line - always show all sections
                    let reportText = `${netIncome >= 0 ? '+' : ''}${netIncome.toLocaleString()} S | ${activeMissions} Mission${activeMissions === 1 ? '' : 's'} | ${espionageMissions} Espionage`;
                    
                    addReport(this, 'growth', reportText, { 
                        spheres: netIncome, 
                        fromGems: spheresFromGems, 
                        fromMarkets: income,
                        buildingUpkeep: buildingUpkeep,
                        buildingUpkeepDetails: buildingUpkeepDetails,
                        unitUpkeepPenalty: incomeReduction,
                        unitUpkeepTier: unitUpkeepTier,
                        totalUnits: totalUnits,
                        unitUpkeepPercent: unitUpkeepPenalty,
                        researchGemsGained: gemsThisDay,
                        activeMissions: this.state.deployments.length,
                        espionageMissions: this.state.deployments.filter(d => d.type === 'espionage').length,
                        deployments: [...this.state.deployments]
                    });
                }
                
                const totalDays = this.state.dayCount ?? 0;
                const dayOfMonth = (totalDays % 24) + 1;
                const canSpawn = dayOfMonth >= 10 && dayOfMonth <= 22;

                if (canSpawn && !this.state.activeRun && Math.random() < 0.2) {
                    spawnEvent(this);
                }

                if (Math.random() < 0.14) {
                    this.triggerDefenseEvent();
                }
                
                // Check for highstorm
                checkHighstorm(this);

                const dayOfMonth2 = (totalDays % 24) + 1;
                if (dayOfMonth2 === 12 && !this.state.tournamentActive && !isOffline) {
                    this.state.tournamentActive = true;
                    log("Tournament of Highprinces has begun!", "text-yellow-400 font-bold");
                } else if (dayOfMonth2 !== 12) {
                    this.state.tournamentActive = false;
                }
            }
            
            // Track active deployments count at the end of final day
            if (i === count - 1) {
                finalDeploymentCount = this.state.deployments.length;
            }
        }

        if (researchGemsGained > 0) {
            const label = researchGemsGained === 1 ? 'a Gemheart' : `${researchGemsGained} Gemhearts`;
            if (!isOffline) {
                log(`Research Library breakthrough: ${label} synthesized.`, "text-purple-400 font-bold");
                addReport(this, 'growth', `Research Library synthesized ${label}.`, { gemhearts: researchGemsGained });
            }
        }

        return {
            days: count,
            spheresFromGems: spheresFromGemsTotal,
            spheresFromMarkets: spheresFromMarketsTotal,
            researchGemsGained: researchGemsGained,
            buildingUpkeepTotal: buildingUpkeepTotal,
            unitUpkeepReductionTotal: unitUpkeepReductionTotal,
            unitUpkeepTier: unitUpkeepTier,
            totalUnits: totalUnits,
            suspicionChanges: suspicionChanges,
            activeDeployments: finalDeploymentCount
        };
    },

        showOfflineRecap(summary) {
            const daysEl = document.getElementById('offline-recap-days');
            const netIncomeEl = document.getElementById('offline-recap-net-income');
            const gemsEl = document.getElementById('offline-recap-gems');
            const marketsEl = document.getElementById('offline-recap-markets');
            const unitUpkeepEl = document.getElementById('offline-recap-unit-upkeep');
            const unitUpkeepRowEl = document.getElementById('offline-recap-unit-upkeep-row');
            const buildingUpkeepEl = document.getElementById('offline-recap-building-upkeep');
            const buildingUpkeepRowEl = document.getElementById('offline-recap-building-upkeep-row');
            const missionsEl = document.getElementById('offline-recap-missions');
            const missionsEmptyEl = document.getElementById('offline-recap-missions-empty');

            // Update modal title and subtitle based on single day vs multiple days
            const modalTitle = document.querySelector('#offline-recap-modal h2');
            const modalSubtitle = document.querySelector('#offline-recap-modal p');
            const daysLabel = document.querySelector('#offline-recap-modal .space-y-3 .flex:first-child span:first-child');
            if (summary.days === 1) {
                if (modalTitle) modalTitle.textContent = 'DAILY REPORT';
                if (modalSubtitle) modalSubtitle.textContent = 'A new day dawns at your Warcamp.';
                if (daysLabel) daysLabel.textContent = 'Day:';
            } else {
                if (modalTitle) modalTitle.textContent = 'OFFLINE REPORT';
                if (modalSubtitle) modalSubtitle.textContent = 'Warcamp activity processed while you were away.';
                if (daysLabel) daysLabel.textContent = 'Days Away:';
            }

            const totalIncome = (summary.spheresFromGems || 0) + (summary.spheresFromMarkets || 0);
            const totalCosts = (summary.buildingUpkeepTotal || 0) + (summary.unitUpkeepReductionTotal || 0);
            const netIncome = totalIncome - totalCosts;
            
            if (daysEl) daysEl.textContent = summary.days === 1 ? (summary.currentDay || 1) : summary.days;
            if (netIncomeEl) {
                netIncomeEl.textContent = (netIncome >= 0 ? '+' : '') + netIncome.toLocaleString();
                netIncomeEl.className = netIncome >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold';
            }
            if (gemsEl) gemsEl.textContent = '+' + (summary.spheresFromGems || 0).toLocaleString();
            if (marketsEl) marketsEl.textContent = '+' + (summary.spheresFromMarkets || 0).toLocaleString();
            
            // Unit upkeep penalty
            if (unitUpkeepEl && unitUpkeepRowEl) {
                if (summary.unitUpkeepReductionTotal > 0) {
                    unitUpkeepEl.textContent = '-' + summary.unitUpkeepReductionTotal.toLocaleString();
                    unitUpkeepRowEl.classList.remove('hidden');
                } else {
                    unitUpkeepRowEl.classList.add('hidden');
                }
            }
            
            // Building upkeep
            if (buildingUpkeepEl && buildingUpkeepRowEl) {
                if (summary.buildingUpkeepTotal > 0) {
                    buildingUpkeepEl.textContent = '-' + summary.buildingUpkeepTotal.toLocaleString();
                    buildingUpkeepRowEl.classList.remove('hidden');
                } else {
                    buildingUpkeepRowEl.classList.add('hidden');
                }
            }

            const researchEl = document.getElementById('offline-recap-research');
            if (researchEl) {
                if (summary.researchGemsGained > 0) {
                    researchEl.textContent = `+${summary.researchGemsGained} Gemheart${summary.researchGemsGained === 1 ? '' : 's'} (Research)`;
                    researchEl.classList.remove('hidden');
                } else {
                    researchEl.classList.add('hidden');
                }
            }
            
            // Active deployments status
            const deploymentsEl = document.getElementById('offline-recap-deployments');
            const deploymentsSectionEl = document.getElementById('offline-recap-deployments-section');
            if (deploymentsEl && deploymentsSectionEl) {
                if (summary.activeDeployments > 0) {
                    deploymentsEl.textContent = `${summary.activeDeployments} mission${summary.activeDeployments === 1 ? '' : 's'} currently active`;
                    deploymentsSectionEl.classList.remove('hidden');
                } else {
                    deploymentsSectionEl.classList.add('hidden');
                }
            }
            
            // Suspicion changes
            const suspicionEl = document.getElementById('offline-recap-suspicion');
            const suspicionSectionEl = document.getElementById('offline-recap-suspicion-section');
            if (suspicionEl && suspicionSectionEl) {
                if (summary.suspicionChanges && summary.suspicionChanges.length > 0) {
                    const items = summary.suspicionChanges.map(change => {
                        const arrow = '→';
                        return `<div class="flex justify-between items-center"><span class="text-slate-400">${change.target}</span><span class="text-cyan-400">${change.before} ${arrow} ${change.after} (${change.levelAfter})</span></div>`;
                    }).join('');
                    suspicionEl.innerHTML = items;
                    suspicionSectionEl.classList.remove('hidden');
                } else {
                    suspicionSectionEl.classList.add('hidden');
                }
            }

            if (missionsEl && missionsEmptyEl) {
                if (summary.missionsTotal > 0) {
                    const items = Object.entries(summary.missions || {}).map(([type, count]) => {
                        return `<div class="flex justify-between"><span class="text-slate-400">${type.toUpperCase()}</span><span class="text-emerald-300 font-bold">${count}</span></div>`;
                    }).join('');
                    missionsEl.innerHTML = items;
                    missionsEl.classList.remove('hidden');
                    missionsEmptyEl.classList.add('hidden');
                } else {
                    missionsEl.classList.add('hidden');
                    missionsEmptyEl.classList.remove('hidden');
                }
            }

            openOfflineRecapModal();
        },

    triggerDefenseEvent() {
        flashScreen('alert');
        
        const attackPower = 20 + Math.floor(Math.random() * 100);
        log(`ATTACK! Parshendi raiding party detected (Power: ${attackPower}).`, "text-red-500 font-bold bg-red-900/20 border-l-4 border-red-600 pl-2");
        triggerNotification("Warcamp Attack!", "Parshendi are raiding your camp!");

        // Calculate available defense power (units not on missions)
        const availableStats = getArmyStats(this, true);
        const defensePower = availableStats.power;
        
        const success = defensePower >= attackPower;
        if (success) {
            log(`DEFENSE SUCCESSFUL. Your forces (${defensePower.toFixed(1)}) repelled the attack.`, "text-green-400");
            const reportMessage = `Parshendi raid repelled successfully. Your power: ${defensePower.toFixed(1)}, Enemy power: ${attackPower}.`;
            addReport(this, 'defense', reportMessage, { success: true, defensePower, attackPower });
        } else {
            // Defense failed - consequences
            const spheresStolen = 500 + Math.floor(Math.random() * 1500); // 500-2000 spheres
            const actualStolen = Math.min(spheresStolen, this.state.spheres);
            this.state.spheres -= actualStolen;
            
            let buildingsDestroyed = [];
            
            // 10% chance per market to destroy one
            if (this.state.buildings.market > 0) {
                for (let i = 0; i < this.state.buildings.market; i++) {
                    if (Math.random() < 0.1) {
                        this.state.buildings.market--;
                        buildingsDestroyed.push('Market');
                        break; // Only destroy one
                    }
                }
            }
            
            // 10% chance per soulcaster to destroy one
            if (this.state.buildings.soulcaster > 0) {
                for (let i = 0; i < this.state.buildings.soulcaster; i++) {
                    if (Math.random() < 0.1) {
                        this.state.buildings.soulcaster--;
                        buildingsDestroyed.push('Soulcast Bunker');
                        break; // Only destroy one
                    }
                }
            }
            
            let lossDetails = `Lost ${actualStolen.toLocaleString()} spheres.`;
            if (buildingsDestroyed.length > 0) {
                lossDetails += ` ${buildingsDestroyed.join(', ')} destroyed!`;
            }
            
            log(`DEFENSES BREACHED. Your forces (${defensePower.toFixed(1)}) were overwhelmed. ${lossDetails}`, "text-orange-500 font-bold");
            const reportMessage = `Defenses breached by Parshendi raid. Your power: ${defensePower.toFixed(1)}, Enemy power: ${attackPower}. ${lossDetails}`;
            addReport(this, 'defense', reportMessage, { success: false, defensePower, attackPower, spheresLost: actualStolen, buildingsDestroyed });
        }
    },

    // Public API methods for HTML onclick handlers
    setTab: (tab) => setTab(tab),
    openModal: (system) => openModal(system),
    closeModal: () => closeModal(),
    setThrillBid: (amount) => { gameInstance.state.thrillBid = amount; },
    closeRecapModal: () => closeRecapModal(),
    closeMissionModal: (type) => closeMissionModal(type),
    openSpanreedModal: () => openSpanreedModal(),
    closeSpanreedModal: () => closeSpanreedModal(),
    setSpanreedTab: (tab) => setSpanreedTab(tab),
    openSpyPlanningModal: () => openSpyPlanningModal(),
    closeSpyPlanningModal: () => closeSpyPlanningModal(),
    closeOfflineRecapModal: () => closeOfflineRecapModal(),
    sendSpanreedMessage: () => sendSpanreedMessage(gameInstance),
    toggleReportDetails: (detailsId) => toggleReportDetails(detailsId),
    recruit: (type) => recruit(gameInstance, type),
    build: (type) => build(gameInstance, type),
    upgradeBuilding: (type) => upgradeBuilding(gameInstance, type),
    buyGemheart: () => buyGemheart(gameInstance),
    constructFabrial: (type) => constructFabrial(gameInstance, type),
    startDuel: () => startDuel(gameInstance),
    commitThrill: () => commitThrill(gameInstance),
    forfeitDuel: () => forfeitDuel(gameInstance),
    enterTournament: () => enterTournament(gameInstance),
    useThrillAmplifier: () => useThrillAmplifier(gameInstance),
    useHalfShard: () => useHalfShard(gameInstance),
    useRegenPlate: () => useRegenPlate(gameInstance),
    spyAction: (action) => spyAction(gameInstance, action),
    openDeployModal: (type) => openDeployModal(gameInstance, type),
    closeDeployModal: () => closeDeployModal(),
    confirmDeploy: () => confirmDeploy(gameInstance),
    openMissionDetails: (index) => openMissionDetails(gameInstance, index),
    closeMissionDetailsModal: () => closeMissionDetailsModal(),
    recallMission: () => recallMission(gameInstance),
    startConquest: () => openDeployModal(gameInstance, 'conquest'),
    /* Conquest status and availability */
    getConquestStatus: () => getConquestStatus(gameInstance),
    canStartConquest: () => canStartConquest(gameInstance),
    openHighstormDetails: () => openHighstormDetails(),
    closeHighstormModal: () => closeHighstormModal(),
    closeHighstormImpactModal: () => closeHighstormImpactModal(),
    showHighstormImpact: () => showHighstormImpactModal(gameInstance),
    requestNotificationPermission: () => requestNotificationPermission(),
    _updateModalStats: (stats) => updateModalStats(stats),
    _updateSpyNetwork: (unlocked) => updateSpyNetwork(unlocked),
    _toggleTournamentCard: (active) => toggleTournamentCard(active),
    _toggleBlackMarket: (unlocked) => toggleBlackMarket(unlocked)
};

// Helper functions for highstorm modal
function openHighstormDetails() {
    const modal = document.getElementById('highstorm-details-modal');
    if (modal) modal.classList.add('open');
}

function closeHighstormModal() {
    const modal = document.getElementById('highstorm-details-modal');
    if (modal) modal.classList.remove('open');
}

function closeHighstormImpactModal() {
    const modal = document.getElementById('highstorm-impact-modal');
    if (modal) modal.classList.remove('open');
}

// Make notifications clickable to open details
document.addEventListener('DOMContentLoaded', () => {
    const phase2 = document.getElementById('highstorm-phase2');
    const phase3 = document.getElementById('highstorm-phase3');
    
    if (phase2) {
        phase2.addEventListener('click', () => showHighstormImpactModal(gameInstance));
    }
    if (phase3) {
        phase3.addEventListener('click', () => showHighstormImpactModal(gameInstance));
    }
});

// Expose game instance globally so HTML can call methods
window.gameInstance = gameInstance;
window.game = gameInstance; // Alias for backward compatibility

// Initialize on page load
window.addEventListener('load', () => gameInstance.init());
