# Warcamp Simulator - Balance Analysis & Progression Guide

## Current Game Economy

### Starting Resources
- **DEV_MODE ON**: 25,000 Spheres + 10 Gemhearts
- **Production Mode**: 15,000 Spheres + 0 Gemhearts

### Daily Income Sources
| Source | Rate | Requirement |
|--------|------|-------------|
| Gemheart Income | +20 S/day per Gemheart | Own Gemhearts |
| Market Income | +400 S/day per Market | Build Markets |
| Ledger Fabrial | ×1.5 Market Income | 3 Gemhearts |
| Multiple Markets | Stacking | Exponential cost |

**Example Daily Incomes:**
- Day 1 (no markets): 0 S/day (unless you have gemhearts)
- With 1 Market: 400 S/day
- With 2 Markets + 1 Ledger: 1,200 S/day (800 base + 400 from ledger multiplier)

---

## Progression Timeline (Production Mode)

### Week 1: Foundation Phase
**Goal:** Unlock espionage OR technology
**Choices:**
- Path A (Espionage): Build Spy Network (5,000 S) → Scout NPC lords
- Path B (Tech): Build Research Library (10,000 S) → Construct Fabrials
- Path C (Economy): Build markets and SoulCast Bunkers → Focus on income scaling

**Current Issue:** Players must choose 1-2 of these with 15,000 starting funds

### Week 2-4: Specialization Phase
**If Espionage Path:**
- Recruit spy agents (50-600 S each)
- Perform intelligence/heist missions
- Unlock black market Gemheart purchasing

**If Tech Path:**
- Unlock Fabrial construction
- Start crafting Ledgers and Heat Trials
- Exponential power growth via fabrials

**If Economy Path:**
- Multiple markets generating 100+ S/day
- Pyramid into other systems later

### Month 2+: Convergence Phase
- All systems should be accessible
- Exponential costs kick in
- Players can pursue multiple gameplay styles

---

## Current Cost Analysis

### Buildings (Escalating Costs)

| Building | Base Cost | Scale | Cap | Notes |
|----------|-----------|-------|-----|-------|
| Soulcaster | 150 S | Exponential | 50 | Food cap +50 each |
| Market | 250 S | Exponential | ∞ | +400 S/day income |
| Spy Network | 5,000 S | Flat | 1 | Unlocks espionage |
| Research Library | 10,000 S | Flat | 1 | Unlocks fabrials |
| Training Camp | 7,000 S | Linear | ∞ | +10% army power |
| Monastery | 7,000 S | Linear | ∞ | +5% survival rate |

**Concern:** Linear-scale buildings (Training Camp/Monastery) become incredibly expensive at scale:
- Training Camp #10: 7,000 + (9 × 5,000) = **52,000 S**
- This might be TOO steep mid-game

### Recruitment Costs

| Unit | Cost | Provision | Power | Specialization |
|------|------|-----------|-------|-----------------|
| Bridgecrew | 5 S | 1 | 0.1 | Cheap filler |
| Spearmen | 10 S | 2 | 1.0 | Standard infantry |
| Archers | 15 S | 2 | 1.0 | Standard ranged |
| Chulls | 50 S | 5 | 0.5 | Transport (carry) |
| Shardbearers | 1 GH | 3 | 2.0x multiplier | Endgame power |
| Spy Agents | 50-600 S | 2-5 | 0 (spies only) | Intelligence |

**Assessment:** Tight and balanced. Early units are cheap starters; later units demand resources.

### Fabrial Costs vs. Benefit
- **Heatrial (3 GH):** 1.5x Provision Cap → Strong utility
- **Ledger (3 GH):** 1.5x Market Income → Passive scaling
- **Gravity Rig (5 GH):** 2.0x Army Speed → Mission efficiency

**Gemheart Economy:**
- Only source: Purchases at 10,000 S each (after unlocking spy network)
- Usage: Shardbearers + Fabrials
- Tension: Limited supply forces strategic choices

---

## Balance Issues & Recommended Fixes

### Issue #1: Linear Building Costs Get Exponential
**Problem:** Training Camp #2 costs 12,000 S, but Market #2 costs 1,000 S (exponential but slow start)
- Makes mid-game linear buildings feel like dead ends

**Fix (Option A - Rebalance Costs):**
```javascript
training_camp: { baseCost: 5000, cap: 0, income: 0, powerMod: 0.1, survivalMod: 0, scale: 'exponential' },
monastery: { baseCost: 5000, cap: 0, income: 0, powerMod: 0, survivalMod: 0.05, scale: 'exponential' },
```

**Fix (Option B - Cap the multiplier):**
- Allow max 3-5 training camps/monasteries for players to specialize
- Encourages focused builds instead of "own all buildings"

### Issue #2: Early Game Choice is Too Restrictive
**Problem:** With 15,000 starting spheres:
- Spy Network = 5,000
- Library = 10,000
- Both = 15,000 (no buffer for other buildings)
- Only achievable by rushing one, then saving income for other

**Fix:** Adjust starting resources based on difficulty
```javascript
// Easy: 25,000 (already in DEV_MODE) - can pursue multiple paths
// Normal: 20,000 - comfortable progression
// Hard: 12,000 - forces tough early choices
```

### Issue #3: Gemheart Scarcity
**Problem:** Only way to get Gemhearts is:
1. Buy one for 10,000 S (after Spy Network unlocked)
2. Win Monthly Tournament (unreliable)
3. Steal from NPC (needs high spy power)

**Fix:** Add more Gemheart acquisition paths
- Rare mission rewards (5% drop chance)
- Plateau run coalition bonuses
- NPC population thresholds

### Issue #4: Ledger Fabrial Too Powerful
**Problem:** 1.5x multiplier on all market income is exponential scaling for only 3 Gemhearts
- With 10 Markets + 2 Ledgers = 12,000 S/day (4,000 base × 1.5 × 1.5 × 2)
- Makes military recruitment trivial

**Fix:** Cap Ledger benefits or increase cost
```javascript
ledger: { cost: 5, name: "Synchronized Ledger" }, // Up from 3
// OR make stack penalty: 1st = 1.5x, 2nd = 1.3x, 3rd = 1.1x
```

---

## Recommended Balance Adjustments (Optional)

### Conservative Changes (Minimal Impact)
1. **Increase linear building costs** from 7,000 to 6,000 S (make early economics better)
2. **Add +5 starting gemhearts** in normal mode (15,000 → 20,000)
3. **Reduce Market base cost** 250 → 200 S (encourage economic builds)

### Moderate Changes (Rebalance Progression)
1. **Switch Training Camp/Monastery to exponential scale**
2. **Implement Ledger stack penalty** (diminishing returns per fabrial)
3. **Increase Ghostblood spy cost** 600 → 800 S (they're powerful)

### Aggressive Changes (New Mechanics)
1. **Add Gemheart production** via Research Library buildings
2. **Implement building specialization** - choose 3/6 buildings as "mastery" for bonus effects
3. **Add rival lord scaling** - NPC lords grow stronger over time (pressure for player growth)

---

## Current Assessment

**What's Working Well:**
✅ Early game has meaningful choices (espionage vs. tech vs. economy)  
✅ Unit recruitment costs are well-tuned  
✅ Fabrial costs feel prestigious (3 GH is a big commitment)  
✅ Spy network creates an intelligence mini-game  
✅ Arena/tournaments add non-economic gameplay  

**What Needs Monitoring:**
⚠️ Linear building costs become brutal mid-game  
⚠️ Ledger fabrial might be too efficient  
⚠️ Limited early-game gemheart access  
⚠️ Market exponential cost curve vs. income rewards  

**Next Steps for Multiplayer:**
- Implement server-side cost validation (already done in validation.js!)
- Add player economy trading to compete for resources
- Implement market prices based on NPC demand
- Add taxes/tribute systems that drain resources
- Create seasonal events that reward different playstyles

---

## Calculation Reference

**Market Cost Formula (Exponential):**
```
cost = 250 × 2^(floor(owned / 10))
Market 1: 250 S
Market 2: 250 S (same tier)
Market 10: 250 S (same tier)
Market 11: 500 S (new tier)
```

**Linear Building Cost:**
```
cost = baseCost + (owned × 5000)
Training Camp 1: 7,000 S
Training Camp 2: 12,000 S
Training Camp 3: 17,000 S
```

**Income Example (Multiple Markets + Fabrials):**
```
Base: 10 Markets × 400 = 4,000 S/day
With Ledger #1: 4,000 × 1.5 = 6,000 S/day
With Ledger #2: 4,000 × 1.5 × 1.5 = 9,000 S/day (current stacking)
```

---

## User Testing Notes

Feel free to test these scenarios and report back:
1. Play through first week normally - does progression feel right?
2. Try both espionage path and tech path - is one clearly better?
3. Build 5+ markets - does late-game economy feel balanced?
4. Use spy actions against strongest NPC - is cost/reward fair?
5. Deploy army in plateau run - does casual combat feel engaging?
