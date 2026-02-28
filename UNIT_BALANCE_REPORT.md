# Warcamp Simulator - Unit & Resource Balance Report

## Unit Cost & Provision Analysis

### Combat Units

| Unit Type | Sphere Cost | Provision Cost | Cost/Power | Cost/Provision | Notes |
|-----------|-------------|-----------------|-----------|----------------|-------|
| Bridgecrew | 5 S | 1 | 50 S/power | 5 S/prov | Filler unit, cheap |
| Spearmen | 10 S | 1 | 10 S/power | 10 S/prov | Standard infantry |
| Archers | 15 S | 1 | 15 S/power | 15 S/prov | Standard ranged (worse ratio) |
| Chulls | 50 S | 3 | 100 S/power | 16.7 S/prov | Transport focus, weak combat |
| Shardbearers | 1 GH | 3 | N/A (2x multiplier) | N/A | Endgame power, 2x multiplier |

**Assessment:** 
- Early game: Spearmen is most cost-efficient (10 S for 1 power + 1 provision)
- Archers worse ratio than spearmen despite same power (pay 50% more)
- Chulls for transport, not combat
- Shardbearers endgame only

### Spy Units

| Unit Type | Sphere Cost | Provision Cost | Spy Power | Cost/Spy | Cost/Provision |
|-----------|-------------|-----------------|-----------|----------|-----------------|
| Noble | 50 S | 2 | 1 | 50 S/spy | 25 S/prov |
| Spy | 150 S | 2 | 2 | 75 S/spy | 75 S/prov |
| Ghostblood | 600 S | 3 | 5 | 120 S/spy | 200 S/prov |

**Assessment:**
- Noble: Best ratio (50 S for 1 spy power)
- Spy: Mid-tier (150 S for 2 spy power)
- Ghostblood: Expensive but powerful (600 S for 5 spy power)

---

## Building Cost Analysis

### Income Generators

| Building | Cost | Cost Scale | Daily Income | ROI Days | Cap |
|----------|------|-------------|----|----------|-----|
| Market | 250 S | Exponential | +400 S/day | 0.625 days | ∞ |
| Training Camp | 7,000 S | Linear *| +10% army power | N/A | ∞ |
| Monastery | 7,000 S | Linear * | +5% survival | N/A | ∞ |

*Linear scale: Each new one costs base + (owned × 5,000)
- Training Camp #2: 12,000 S
- Training Camp #3: 17,000 S
- Training Camp #10: 52,000 S ⚠️ STEEP

**Issue:** Linear buildings become EXPONENTIALLY expensive early-mid game
- Market #2: 1,000 S (very reasonable)
- Training Camp #2: 12,000 S (12x more expensive!)

### Support Buildings

| Building | Cost | Scale | Benefit | Cap | Notes |
|----------|------|-------|---------|-----|-------|
| Soulcaster | 150 S | Exponential | +50 provisions | 50 | Food only |
| Shelter | 100 S | Exponential | ??? | 10 | Unclear benefit |
| Spy Network | 5,000 S | Flat | Unlocks espionage | 1 | One-time unlock |
| Research Library | 10,000 S | Flat | Unlocks fabrials | 1 | One-time unlock |

---

## Fabrial Costs vs. Benefits

### Production Fabrials

| Fabrial | Cost | Benefit | Stacking | Max Efficiency |
|---------|------|---------|----------|-----------------|
| Heatrial System | 3 GH | ×1.5 Provision Cap | Yes | 2.25× with 2 fabrials |
| Synchronized Ledger | 3 GH | ×1.5 Market Income | Yes | 2.25× with 2 fabrials |
| Gravity-Spanning Rig | 5 GH | ×2.0 Army Speed | Yes | 4× with 2 fabrials |

### Arena Fabrials

| Fabrial | Cost | Tournament Benefit | Daily Limit | Notes |
|---------|------|-------------------|-------------|-------|
| Regeneration Plate | 1 GH | Defensive | Once/day | Heals 1 HP |
| Thrill Amplifier | 2 GH | Aggressive | Once/day | Boost power |
| Half-Shard | 4 GH | Reactive | Once/day | Nullify boost |

**Cost Analysis:**
- Arena fabrials = 1+2+4 = 7 GH just to own all three
- Production fabrials = 3+3+5 = 11 GH for all three
- **Total investment needed: 18 GH for full loadout**

---

## Gemheart Economy

### Starting Gemheart Access
- **Dev Mode:** 10 gemhearts (unlimited testing)
- **Production Mode:** 0 gemhearts (must earn or purchase)

### Gemheart Acquisition Paths
1. **Purchase:** 10,000 S each (after Spy Network unlocked) - ONE option
2. **Arena:** Win monthly championship → 1 Gemheart (unreliable)
3. **NPC Heist:** Steal from NPC lords (requires high spy power)
4. **Research Library:** 5% daily chance per library (slow)

**Problem:** Gemheart scarcity is SEVERE in early production mode
- First purchase needed: Play 25+ days or steal from NPC
- Get 2 markets + 1 ledger fabrial = 3 GH needed
- That's 30,000 spheres in purchases (feasible with market income)

---

## Provisions Economy

### Base Provision Cap
- **Starting:** 150 provisions
- **Per Soulcaster:** +50 provisions
- **Per Heatrial:** ×1.5 multiplier

### Provision Consumption by Unit

**Low Cost:**
- Bridgecrew: 1 prov
- Spearmen: 1 prov
- Archer: 1 prov

**Mid Cost:**
- Noble: 2 prov
- Spy: 2 prov
- Chull: 3 prov

**High Cost:**
- Shard bearer: 3 prov
- Ghostblood: 3 prov

**Example Army (150 provision cap):**
- 100 Spearmen = 100 provisions (leaves 50 for others) ✓
- 50 Chulls = 150 provisions (full cap, no room for combat) ⚠️
- 40 Spearmen + 10 Ghostblood = 40 + 30 = 70 provisions (66.7% used)

---

## Balance Issues & Recommendations

### 🔴 CRITICAL ISSUES

**#1: Archer Units Have Terrible Cost Efficiency**
- Cost: 15 S (same power as Spearmen at 10 S)
- Provision: 1 (same as Spearmen)
- **Recommendation:** Either reduce archer cost to 12 S OR increase survival to 1.2x

**#2: Linear Building Costs Are Brutal**
- Training Camp #2: 12,000 S
- Training Camp #3: 17,000 S
- Players avoid buying more than 1 after early game
- **Recommendation:** Switch to exponential scale OR cap at 3-5 buildings

**#3: Ghastblood Might Be Overpowered**
- Cost: 600 S
- Spy Power: 5
- Provision: 3
- Compare to Noble: 50 S for 1 spy (10× cheaper per spy point)
- **Recommendation:** Increase cost to 750 S OR reduce spy power to 4

### 🟡 MODERATE ISSUES

**#4: Ledger Fabrial Too Efficient**
- Cost: 3 GH
- Benefit: ×1.5 market multiplier
- With 10 markets + 1 ledger = 6,000 S/day (400/market base × 10 × 1.5)
- **Recommendation:** Increase cost to 5 GH OR implement stacking penalty (1st=1.5x, 2nd=1.3x)

**#5: Early Game Gemheart Access Critical**
- Players need fabrials but can't afford them for 100+ days
- **Recommendation:** 
  - Add Research Library gem generation (1% daily chance)
  - Add rare mission rewards (+0.1 GH)
  - Increase starting gemhearts to 2 in Normal mode

**#6: Provisions Seem Abundant**
- Base 150 cap + soulcasters easily doubles this
- 100-150 unit armies common without issues
- **Recommendation:** Monitor in-game; may need cap increase OR more expensive units

---

## UI/Display Issues Found

✅ **Fixed:**
- Fabrial costs ARE displayed correctly (3 GH, 5 GH, 7 GH shown)

⚠️ **Needs Improvement:**
- Building costs not updated when prices are ethering/scaling
- Linear building costs don't show "Cost increases per purchase"
- No provision cost breakdown in recruit buttons

---

## Recommended Balance Changes (Priority Order)

### Phase 1: Quick Fixes (Low Risk)
1. **Reduce Archer cost** from 15 → 12 S (makes them competitive)
2. **Switch Training Camp to exponential** instead of linear
3. **Add tooltip** showing "How many X units fit in provisions"

### Phase 2: Gemheart Economy (Medium Risk)
1. **Increase starting gemhearts** to 2 in Normal mode
2. **Add Research Library generation** (0.5% daily chance)
3. **Add mission gem drops** (5% chance for +1 GH reward)

### Phase 3: Balance Fine-Tuning (High Risk - Test First)
1. **Increase Ghostblood cost** from 600 → 750 S
2. **Increase Ledger cost** from 3 GH → 5 GH
3. **Cap linear buildings** at 5 max (soft cap)

---

## Testing Checklist

- [ ] Can a new player afford a Ledger fabrial within 1 week?
- [ ] Is recruiting 50+ Archers ever better than Spearmen?
- [ ] Do multiple Training Camps feel rewarding or painful?
- [ ] Can spy economy support 3+ Ghostblood agents early?
- [ ] Do Chulls ever get mass-recruited (they should for supply) ?
- [ ] Is the Army cap ever hit without Soulcasters?

