# Warcamps Online - Multiplayer Test Checklist

**Test Duration:** 2-3 hours  
**Players Needed:** 2-3 people online simultaneously  
**URL:** https://rhettoric24.github.io/Warcamps-Online/

---

## Phase 1: Foundation (15-20 min)

### Account Setup
- [ ] **Player 1** - Register new account (use email format: tester1@test.com)
- [ ] **Player 2** - Register new account (use email format: tester2@test.com)
- [ ] **Player 3** (optional) - Register new account (use email format: tester3@test.com)
- [ ] All players can login after creation
- [ ] Each player sees their own username and unique start data (15,000 spheres, 2 gemhearts)

### Basic UI Check
- [ ] Game loads without errors (open browser console, check for red errors)
- [ ] All panels visible: military, buildings, resources, events
- [ ] Time display shows consistent game clock across all players
- [ ] No console errors when performing actions

---

## Phase 2: Messaging System (15 min)

### Send Messages
- [ ] **Player 1** - Open the Messages tab
- [ ] **Player 1** - Search for Player 2's username and send a test message: "Hello from P1"
- [ ] **Player 2** - Check Messages tab and verify message received within 5 seconds
- [ ] **Player 2** - Reply: "Message received, P1!"
- [ ] **Player 1** - Verify reply shows up
- [ ] Message conversation displays both players' histories correctly

### Message Badge
- [ ] When Player 2 has unread messages, a badge should appear (red number in Messages tab)
- [ ] After Player 2 reads messages, badge should disappear
- [ ] Badge updates within 30-45 seconds

---

## Phase 3: Conquest System (PvP Land Transfer) (20 min)

### Setup Conquest
- [ ] **Player 1** - Open Conquest menu
- [ ] **Player 1** - Check "Target Selection" - search for Player 2's username
- [ ] **Player 1** - Enter land amount to conquer: `50` (Player 1 should have enough)
- [ ] **Player 1** - Click "Initiate Conquest"
- [ ] Check server console for: `✓ Land transfer successful` message

### Verify Land Transfer
- [ ] **Player 1** - Check own land count - should DECREASE by 50
- [ ] **Player 2** - Refresh page or check summary - land should INCREASE by 50
- [ ] Both players should see the new values immediately (or within 10 seconds)

### Repeat (Different Players)
- [ ] **Player 2** - Initiate conquest against Player 1 for 30 land
- [ ] **Player 1** - Verify land decreased by 30
- [ ] **Player 2** - Verify land increased by 30

**✓ CRITICAL:** If land values don't sync immediately, there's a sync issue.

---

## Phase 4: Plateau Runs - New System (60-90 min)

### Wait for Run Spawn
- [ ] All players stay in-game and wait (can take 5-15 minutes)
- [ ] Watch for orange warning in event log: `⚠️ SCOUT REPORT: Chasmfiend spotted!`
- [ ] A modal should also pop up (if browser notifications enabled)

**If no run spawns after 20 min:** This might be because we're not in days 10-22 of game month. Continue to next section.

### WARNING Phase (if run spawns)
- [ ] **All players** - Check event box at top of screen
- [ ] Status should show: `⚠️ WARNING` with red badge
- [ ] Timer should display: `WARNING: 4m 50s` (counts down from 5 minutes)
- [ ] Signup button should be DISABLED (grayed out)
- [ ] Check all players see the SAME timer (within 2 seconds of each other)

### MUSTER Phase
- [ ] After 5 minutes, phase should change to: `🎖️ MUSTER PHASE` (green badge)
- [ ] Timer changes to: `Minutes until departure: 59m 50s`
- [ ] Signup button becomes ENABLED
- [ ] **Player 1** - Click "Join Coalition"
  - Confirm: modal closes, message says "✅ You've joined the coalition!"
- [ ] **Player 2** - Click "Join Coalition"
- [ ] **Player 3** (if present) - Click "Join Coalition"

### Leaderboard Check
- [ ] Scroll down in plateau event box to see "Muster Leaderboard"
- [ ] Should list all players who joined with their **speed bonus** shown
- [ ] Example: `👤 Player1: 5.1%` | `⚔️ Player2: 5.0%`
- [ ] Check that leaderboard is the same for all players (no de-sync)

### DEPARTED Phase
- [ ] After ~60 minutes of MUSTER, phase should change to: `🚶 ON MISSION` (blue badge)
- [ ] Timer changes to: `Returning in: 1h 0m` or similar
- [ ] Join button should disappear
- [ ] Message in log: `🏔️️ The coalition has departed for the plateau!`
- [ ] All players should see this at roughly the same time

### Resolution Phase
- [ ] After the DEPARTED timer counts down (~1 hour), run should resolve
- [ ] Event box should disappear or show results summary
- [ ] Check server console for: `⚔️ Plateau Run #X: Forces returning home, resolving...`
- [ ] One player should receive gemheart award (modal popup)
- [ ] Winner should see: `✅ Plateau Run Victory!`
- [ ] All players should see updated resources (loot spheres + casualties)

---

## Phase 5: Stability & Cross-Check (30 min)

### Data Persistence
- [ ] **Player 1** - Note down exact sphere and gemheart count
- [ ] **Player 1** - Refresh page (F5)
- [ ] After reload, sphere and gemheart counts should be IDENTICAL
- [ ] Repeat for other players

### Simultaneous Actions
- [ ] **Player 1** - Build a Market (if resources allow)
- [ ] **Player 2** - At same time, send Player 1 a message
- [ ] **Player 3** - At same time, attempt a conquest
- [ ] All actions should complete without errors
- [ ] Check server console for any 500 errors

### Connection Stability
- [ ] Keep game open for 5+ minutes with no interactions
- [ ] Check browser console for failed network requests (red X's)
- [ ] Perform an action (send message, join event) - should work smoothly
- [ ] Check game still responsive

---

## Phase 6: Observed Behavior Log

### While Testing, Note Any Issues:

**Timing Issues (de-sync between players):**
- [ ] Do all players see same phase transitions at same time? ±5 seconds is OK
- [ ] Do player A and player B see different timers? If yes, note it

**Data Inconsistencies:**
- [ ] After conquest, does one player still show old land value? (even after refresh)
- [ ] Do messages fail to send or appear for one player but not other?
- [ ] Does a player see their own messages dropped?

**UI/Display Glitches:**
- [ ] Any visual bugs (text overlaps, buttons cut off, colors wrong)?
- [ ] Modal popups appearing but can't close?
- [ ] Buttons not responding/lag on click?

**Performance:**
- [ ] Noticeable lag or freezing during gameplay?
- [ ] Console errors slowing things down?

**Space for observations:**

```
[Tester Name]: [Observations]


```

---

## Success Criteria

**PASS if:**
- ✅ All 2-3 players can register, login, and stay connected
- ✅ Messages send and receive within 5 seconds between players
- ✅ Conquest transfers land correctly for both sides
- ✅ Plateau run spawns, goes through all phases visible to all players
- ✅ No major data inconsistencies (no ghost land, missing resources, etc.)
- ✅ No connection drops during 2+ hour test
- ✅ Server console shows NO red errors during tests

**FAIL if:**
- ❌ Players can't see each other's actions within 10 seconds
- ❌ Land transfers fail or show different values on different clients
- ❌ Plateau run doesn't spawn after full test duration
- ❌ Messages fail to deliver
- ❌ Server crashes or gives 500 errors
- ❌ Players get disconnected randomly

---

## After Test Complete

**Send back:**
1. Overall assessment (Pass/Fail/Issues Found)
2. Any issues with exact steps to reproduce
3. Time each game system worked vs. issues
4. Recommendation: Ready for week test? Yes/No + Why

**Contact:** Ping with results!
