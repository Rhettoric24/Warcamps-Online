// Arena combat system module
import { log } from '../core/utils.js';
import { isFabrialBurnedOut, isArenaBoostActive } from '../events/highstorm.js';

// Calculate XP needed to reach a specific level
// Level 2: 20 XP, Level 3: 40 XP, Level 4: 80 XP, etc.
function getXPForLevel(level) {
    if (level <= 1) return 0;
    return 20 * Math.pow(2, level - 2);
}

export function startDuel(gameState) {
    if (gameState.state.arena.hp <= 0) {
        log("Champion is injured and cannot fight until healed.", "text-red-500");
        return;
    }
    gameState.state.activeDuel = {
        playerHp: gameState.state.arena.hp,
        playerMaxHp: gameState.state.arena.maxHp,
        playerThrill: gameState.state.arena.maxThrill || 10,
        enemyHp: Math.max(3, gameState.state.arena.level + 1),
        enemyMaxHp: Math.max(3, gameState.state.arena.level + 1),
        enemyThrill: (gameState.state.arena.maxThrill || 10) + Math.floor(Math.random() * 3),
        log: ["Duel Started. Place your bids."],
        blockActive: false
    };
}

export function generateThrillButtons(maxThrill) {
    const container = document.getElementById('thrill-buttons-container');
    if (!container) return;
    
    container.innerHTML = '';
    const maxColumns = Math.min(5, Math.ceil((maxThrill + 1) / 2));
    container.className = `grid gap-2 grid-cols-${maxColumns}`;
    
    // Add 0 button first
    const btn0 = document.createElement('button');
    btn0.textContent = '0';
    btn0.className = 'bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded py-2 transition-all';
    btn0.onclick = () => {
        window.gameInstance.setThrillBid(0);
        window.gameInstance.commitThrill();
    };
    container.appendChild(btn0);
    
    for (let i = 1; i <= maxThrill; i++) {
        const btn = document.createElement('button');
        btn.textContent = i.toString();
        btn.className = 'bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded py-2 transition-all';
        btn.onclick = () => {
            window.gameInstance.setThrillBid(i);
            window.gameInstance.commitThrill();
        };
        container.appendChild(btn);
    }
}

export function commitThrill(gameState) {
    if (!gameState.state.activeDuel) return;
    let bid = gameState.state.thrillBid || 0;
    if (bid < 0) bid = 0;
    if (bid > gameState.state.activeDuel.playerThrill) bid = gameState.state.activeDuel.playerThrill;
    
    let enemyBid = Math.floor(Math.random() * (gameState.state.activeDuel.enemyThrill + 1));
    gameState.state.activeDuel.playerThrill -= bid;
    gameState.state.activeDuel.enemyThrill -= enemyBid;
    
    let msg = `You pushed ${bid}. Enemy pushed ${enemyBid}. `;
    let color = "text-slate-300";
    
    if (bid > enemyBid) {
        gameState.state.activeDuel.enemyHp--;
        msg += "YOU HIT!";
        color = "text-green-400";
    } else if (enemyBid > bid) {
        // Check if Half-Shard block is active
        if (gameState.state.activeDuel.blockActive) {
            msg += "BLOCKED BY HALF-SHARD!";
            color = "text-cyan-400";
            gameState.state.activeDuel.blockActive = false;
        } else {
            gameState.state.activeDuel.playerHp--;
            msg += "ENEMY HIT!";
            color = "text-red-400";
        }
    } else {
        msg += "CLASH!";
        color = "text-yellow-200";
    }
    gameState.state.activeDuel.log.push(`<span class="${color}">${msg}</span>`);
    
    if (gameState.state.activeDuel.playerHp <= 0) {
        gameState.state.arena.hp = 0;
        const xpGain = 5;
        gameState.state.arena.xp += xpGain;
        log("Duel Lost. Champion Injured.", "text-red-600 font-bold");
        showDuelRecap(gameState, false, xpGain);
        gameState.state.activeDuel = null;
    } else if (gameState.state.activeDuel.enemyHp <= 0) {
        gameState.state.arena.hp = gameState.state.activeDuel.playerHp;
        const reward = 1000 + (100 * gameState.state.arena.level);
        const xpGain = 10;
        gameState.state.spheres += reward;
        gameState.state.arena.xp += xpGain;
        log(`Duel Won! +${reward} S, +${xpGain} XP`, "text-green-400 font-bold");
        
        let leveledUp = false;
        const xpNeededForNextLevel = getXPForLevel(gameState.state.arena.level + 1);
        if (gameState.state.arena.xp >= xpNeededForNextLevel) {
            gameState.state.arena.level++;
            gameState.state.arena.xp = 0;
            gameState.state.arena.maxHp++;
            gameState.state.arena.maxThrill = (gameState.state.arena.maxThrill || 10) + 1;
            gameState.state.arena.hp = gameState.state.arena.maxHp;
            log("Champion Level Up! +1 HP, +1 Thrill.", "text-yellow-400 font-bold");
            leveledUp = true;
        }
        showDuelRecap(gameState, true, xpGain, leveledUp);
        gameState.state.activeDuel = null;
    } else {
        if (gameState.state.activeDuel.playerThrill === 0 && gameState.state.activeDuel.enemyThrill === 0) {
            gameState.state.arena.hp = gameState.state.activeDuel.playerHp;
            const xpGain = 2;
            gameState.state.arena.xp += xpGain;
            log("Duel ended in Draw (Exhaustion).", "text-slate-400");
            showDuelRecap(gameState, false, xpGain);
            gameState.state.activeDuel = null;
        }
    }
}

export function forfeitDuel(gameState) {
    if (!gameState.state.activeDuel) {
        log("No active duel to forfeit.", "text-red-400");
        return;
    }
    
    // Save current HP back to champion
    gameState.state.arena.hp = gameState.state.activeDuel.playerHp;
    
    // No XP gain for forfeiting
    log("You forfeited the duel. No rewards.", "text-yellow-400");
    
    // End the duel
    gameState.state.activeDuel = null;
}

function showDuelRecap(gameState, isVictory, xpGain, leveledUp = false) {
    const modal = document.getElementById('duel-recap-modal');
    if (!modal) return;
    
    const winnerEl = document.getElementById('recap-winner');
    const xpGainedEl = document.getElementById('recap-xp-gained');
    const xpCurrentEl = document.getElementById('recap-xp-current');
    const xpNeededEl = document.getElementById('recap-xp-needed');
    const levelUpEl = document.getElementById('recap-level-up');
    const levelNewEl = document.getElementById('recap-level-new');
    
    if (isVictory) {
        winnerEl.textContent = '🏆 VICTORY! 🏆';
        winnerEl.className = 'text-lg font-bold text-green-400 mb-6';
    } else {
        winnerEl.textContent = '💔 DEFEAT 💔';
        winnerEl.className = 'text-lg font-bold text-red-400 mb-6';
    }
    
    xpGainedEl.textContent = `+${xpGain} XP`;
    const currentXP = gameState.state.arena.xp;
    const nextLevel = gameState.state.arena.level + 1;
    const xpRequired = getXPForLevel(nextLevel);
    const xpNeeded = xpRequired - currentXP;
    
    xpCurrentEl.textContent = `${currentXP}/${xpRequired}`;
    xpNeededEl.textContent = `${xpNeeded > 0 ? '+' : ''}${xpNeeded}`;
    
    if (leveledUp) {
        levelUpEl.classList.remove('hidden');
        levelNewEl.textContent = `Now Level ${gameState.state.arena.level}`;
    } else {
        levelUpEl.classList.add('hidden');
    }
    
    modal.classList.add('show');
}

export function enterTournament(gameState) {
    if (!gameState.state.tournamentActive) return;
    if (gameState.state.arena.hp <= 0) {
        log("Champion is injured! Cannot enter tournament.", "text-red-500 font-bold");
        return;
    }
    const chance = 0.3 + (gameState.state.arena.level * 0.05);
    if (Math.random() < chance) {
        gameState.state.gemhearts++;
        log("TOURNAMENT CHAMPION! You won a Gemheart!", "text-purple-400 font-bold text-lg");
    } else {
        log("Eliminated from tournament. Better luck next month.", "text-slate-400");
    }
    gameState.state.tournamentActive = false;
}

// Trade HP for thrill using Thrill Amplifier fabrial
export function useThrillAmplifier(gameState) {
    if (!gameState.state.activeDuel) return;
    const thrillAmpCount = gameState.state.fabrials.thrill_amp || 0;
    if (thrillAmpCount === 0) {
        log("No Thrill Amplifiers available!", "text-red-500");
        return;
    }
    
    // Check for highstorm burnout
    if (isFabrialBurnedOut(gameState, 'thrill_amp')) {
        log("Thrill Amplifier is burned out from the storm!", "text-red-500");
        return;
    }
    
    // Check usage limit (can use twice during highstorm boost)
    const maxUses = isArenaBoostActive(gameState) ? 2 : 1;
    const usageCount = gameState.state.arena.thrillAmpUseCount || 0;
    if (usageCount >= maxUses) {
        const msg = maxUses === 2 ? "Thrill Amplifier used twice today!" : "Thrill Amplifier already used today!";
        log(msg, "text-yellow-400");
        return;
    }
    
    if (gameState.state.activeDuel.playerHp <= 1) {
        log("Too low on HP to amplify thrill!", "text-red-500");
        return;
    }
    
    // Trade 1 HP for 3 thrill per amplifier owned
    const thrillGain = 3 * thrillAmpCount;
    gameState.state.activeDuel.playerHp -= 1;
    gameState.state.activeDuel.playerThrill += thrillGain;
    gameState.state.arena.thrillAmpUseCount = usageCount + 1;
    
    gameState.state.activeDuel.log.push(`<span class="text-purple-400">⚡ Amplified thrill! -1 HP, +${thrillGain} Thrill</span>`);
    log(`Thrill Amplified: +${thrillGain} thrill`, "text-purple-400");
}

// Activate Half-Shard to block next attack
export function useHalfShard(gameState) {
    if (!gameState.state.activeDuel) return;
    const halfShardCount = gameState.state.fabrials.half_shard || 0;
    if (halfShardCount === 0) {
        log("No Half-Shards available!", "text-red-500");
        return;
    }
    
    // Check for highstorm burnout
    if (isFabrialBurnedOut(gameState, 'half_shard')) {
        log("Half-Shard is burned out from the storm!", "text-red-500");
        return;
    }
    
    // Check usage limit (can use twice during highstorm boost)
    const maxUses = isArenaBoostActive(gameState) ? 2 : 1;
    const usageCount = gameState.state.arena.halfShardUseCount || 0;
    if (usageCount >= maxUses) {
        const msg = maxUses === 2 ? "Half-Shard used twice today!" : "Half-Shard already used today!";
        log(msg, "text-yellow-400");
        return;
    }
    
    if (gameState.state.activeDuel.blockActive) {
        log("Half-Shard block already active!", "text-yellow-400");
        return;
    }
    
    gameState.state.activeDuel.blockActive = true;
    gameState.state.arena.halfShardUseCount = usageCount + 1;
    gameState.state.activeDuel.log.push(`<span class="text-cyan-400">🛡️ Half-Shard activated! Next attack blocked.</span>`);
    log("Half-Shard block active!", "text-cyan-400");
}

// Manually activate Regeneration Plate to heal champion (once per day)
export function useRegenPlate(gameState) {
    const regenPlates = gameState.state.fabrials.regen_plate || 0;
    if (regenPlates === 0) {
        log("No Regeneration Plates available!", "text-red-500");
        return;
    }
    
    // Check for highstorm burnout
    if (isFabrialBurnedOut(gameState, 'regen_plate')) {
        log("Regeneration Plate is burned out from the storm!", "text-red-500");
        return;
    }
    
    // Check usage limit (can use twice during highstorm boost)
    const maxUses = isArenaBoostActive(gameState) ? 2 : 1;
    const usageCount = gameState.state.arena.regenPlateUseCount || 0;
    if (usageCount >= maxUses) {
        const msg = maxUses === 2 ? "Regeneration Plate used twice today!" : "Regeneration Plate already used today!";
        log(msg, "text-yellow-400");
        return;
    }
    
    if (gameState.state.arena.hp >= gameState.state.arena.maxHp) {
        log("Champion is already at full health!", "text-green-400");
        return;
    }
    
    const healAmount = regenPlates;
    const oldHp = gameState.state.arena.hp;
    gameState.state.arena.hp = Math.min(gameState.state.arena.hp + healAmount, gameState.state.arena.maxHp);
    const actualHeal = gameState.state.arena.hp - oldHp;
    gameState.state.arena.regenPlateUseCount = usageCount + 1;
    
    log(`Regeneration Plate: Champion healed +${actualHeal} HP.`, "text-green-400 font-bold");
}
