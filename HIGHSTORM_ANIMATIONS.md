# Highstorm Notification Animations

## Overview
Comprehensive CSS animation suite for the three-phase highstorm notification system. All animations are GPU-accelerated using `will-change` properties where appropriate.

---

## Animation Keyframes

### Phase 1: Full-Screen Overlay (0-10 seconds)

**`textFlash` (0.3s, infinite alternate)**
- Rapidly flashes the main "⚡ HIGHSTORM ⚡" text
- Cycles between bright cyan (opacity 1, full glow) and dimmer cyan (opacity 0.7, reduced glow)
- Text shadow intensifies: from 30px total to 70px total blur radius
- Creates sense of urgency and danger

**`highlightFlash` (0.5s, infinite)**
- Pulsing radial gradient background behind text
- Cyan intensity oscillates: 0.15 → 0.35 opacity at center
- Outer ring fades: 0.02 → 0.1 opacity
- Complements text flash timing for cohesive effect

---

### Phase 2: Top Banner Alert (10 seconds - 10 minutes)

**`slideInDown` (0.3s, ease-out)**
- Banner slides down from top of screen
- Starts at opacity 0, translateY(-100%)
- Ends at opacity 1, translateY(0)
- Applied to both phase2 and phase3 for consistency

**`bannerPulse` (1.5s, infinite)**
- Box shadow gently pulses to draw attention
- Oscillates between:
  - Baseline: 15px blur, 0.25 opacity
  - Peak: 25px blur, 0.4 opacity
- Slower than phase 1 to avoid overload after initial alert

**`textPulse` (1.2s, infinite on `.phase2-text`)**
- Pulsing opacity and text glow on "⚡ Active Highstorm ⚡" text
- Cycles: opacity 0.8 → 1.0
- Text shadow: 10px blur → 20px blur
- Keeps attention without being as aggressive as Phase 1

---

### Phase 3: Small Persistent Banner (10 minutes - storm end)

**`slideInDown` (0.3s, ease-out with 0.3s delay)**
- Slides in after Phase 2, creating visual transition
- Uses `backwards` fill-mode so it starts off-screen during delay

**`subtleGlow` (2s, infinite on `.phase3-text`)**
- Very subtle pulsing for persistent but non-intrusive presence
- Cycles: opacity 0.7 → 1.0
- Text shadow: 4px blur → 8px blur
- Gentle enough to not distract while remaining visible

---

### Modal Effects

**`slideUp` (0.3s, ease-out on `#highstorm-details-modal`)**
- Modal slides up and scales in smoothly
- Starts: opacity 0, translateY(30px), scale(0.95)
- Ends: opacity 1, translateY(0), scale(1)

**`fadeInUp` (0.4s, ease-out on `.effect-category`)**
- Each effect category fades in and slides up
- Creates cascading entrance effect for readability
- Starts: opacity 0, translateY(10px)

**`categoryTitle` (0.6s, ease-out on `.effect-category h3`)**
- Section headers animate in with slight horizontal slide
- Starts: opacity 0, translateX(-10px)
- Emphasizes each category as distinct section

**`fadeOut` (0.4s, ease-out, forwards on `.notification-fadeout`)**
- Clean exit animation for notifications
- Opacity: 1 → 0
- Pointer-events disabled at end prevents residual clicks

---

## Interactive States

### Hover Effects

**Phase 2 Banner:**
```css
box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4);
border-bottom-color: rgba(6, 182, 212, 0.8);
```
- Shadow intensifies and moves down
- Border brightens to indicate clickability

**Phase 3 Banner:**
```css
background: linear-gradient(90deg, rgba(6, 182, 212, 0.12)...);
border-bottom-color: rgba(6, 182, 212, 0.5);
box-shadow: 0 2px 10px rgba(6, 182, 212, 0.15);
```
- Subtle background lightening
- Shadow and border highlight on hover

---

## Technical Details

### GPU Acceleration
- `#highstorm-phase1 .storm-text` uses `will-change: text-shadow`
- Prevents layout recalculations during rapid flashs
- `transform` and `opacity` animations are hardware-accelerated by default

### Z-Index Hierarchy
1. **Phase 1 (z-50):** Full-screen overlay, highest priority
2. **Phase 2 (z-45):** Top banner during mid-alert
3. **Phase 3 (z-40):** Persistent subtle banner
4. **Modal (inherited z-45++ from `.modal` class)**

### Animation Timing Strategy
- **Phase 1:** 0.3s cycles (rapid, urgent)
- **Phase 2:** 1.2-1.5s cycles (moderate, noticeable but not frantic)
- **Phase 3:** 2s cycles (slow, subtle, background-level)
- **Transition timings:** 0.3s for smooth phase switches

### Color Palette
All animations use cyan (#06B6D4) family colors:
- **Base:** rgb(6, 182, 212)
- **Text shadows:** rgba(6, 182, 212, 0.3-1.0)
- **Backgrounds:** rgba(6, 182, 212, 0.05-0.35)
- **Consistent throughout** for visual cohesion

---

## Browser Compatibility

All animations use standard CSS3 features:
- `@keyframes` - Supported in all modern browsers
- `transform` - Hardware accelerated
- `box-shadow` - GPU optimized when used with `will-change`
- `opacity` - Hardware accelerated
- `::before` pseudo-elements - Standard support
- `backdrop-filter: blur()` - Chrome 76+, Edge 79+, Safari 9+

---

## Performance Notes

1. **No Layout Thrashing:** Animations only modify:
   - `opacity` (composited layer only)
   - `transform` (including `scale`, `translateX/Y`)
   - `text-shadow` (with `will-change` optimization)
   - `box-shadow` (does trigger reflow but optimized)

2. **Staggered Animations:** Phase transitions prevent all animations running simultaneously

3. **Interval Management:** JavaScript intervals pause during Phase 1 and 2, resume steady cadence in Phase 3

4. **Memory Efficiency:** All timeouts and intervals cleared when highstorm ends via `hideHighstormNotification()`

---

## Visual Flow

```
Second 0-10: PHASE 1 (DRAMATIC)
├─ Full-screen overlay
├─ Intense text flash (0.3s cycle)
├─ Bright cyan glow effects
└─ "DEVASTATING WEATHER STRIKES" subtitle

Second 10-600 (10min): PHASE 2 (ALERT)
├─ Smooth slide-down from top
├─ Banner with pulsing elements (1.2-1.5s cycle)
├─ Time countdown displayed
└─ Moderate visual prominence

Minute 10 - Storm End: PHASE 3 (PERSISTENT)
├─ Smooth transition to small banner
├─ Subtle glow animation (2s cycle)
├─ Continues throughout remaining duration
└─ Minimal distraction, always visible

At Any Time: CLICK NOTIFICATION
├─ Modal slides up with `slideUp` animation
├─ Effect categories fade in sequentially
├─ Headings slide in from left
└─ Comprehensive effects overview displayed
```

---

## Testing Checklist

- [ ] Phase 1 text flashes rapidly (0.3s cycles) during first 10 seconds
- [ ] Phase 1 background has pulsing radial gradient
- [ ] Phase 2 slides in smoothly from top after 10s
- [ ] Phase 2 text pulses with glow effect (1.2s cycle)
- [ ] Phase 2 banner pulses with shadow effect (1.5s cycle)
- [ ] Phase 3 slides in after phase 2 transitions
- [ ] Phase 3 has subtle persistent glow (2s cycle)
- [ ] Modal slides up when notification clicked
- [ ] Effect categories fade in sequentially (staggered)
- [ ] Category headers slide in from left
- [ ] All animations smooth on 60+ FPS displays
- [ ] Notifications remain clickable during animations
- [ ] Hover states clearly visible on phase 2 and 3 banners
- [ ] Animations disable properly when highstorm ends
- [ ] No flickering or jank on animation transitions

---

## Customization Guide

### Adjust Flash Speed (Phase 1)
Edit `.storm-text` animation:
```css
animation: textFlash 0.3s infinite alternate;
/*                  ^^^^ Change to 0.2s for faster, 0.5s for slower */
```

### Adjust Banner Pulse (Phase 2)
Edit `.phase2-text` animation:
```css
animation: textPulse 1.2s infinite;
/*                   ^^^^ Adjust duration */
```

### Change Color Theme
Find and replace all `rgba(6, 182, 212` with your chosen color's RGBA values

### Adjust Glow Intensity
Modify `text-shadow` values in keyframes:
```css
text-shadow: 0 0 20px rgba(6, 182, 212, 1);
             /* Increase second value for more blur */
             /* Adjust opacity (1.0) for intensity */
```

