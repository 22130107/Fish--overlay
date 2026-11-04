# Mystery Treasure Chest System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Mystery Treasure Chest drop system where chests sink into the pond, fish race to bite the chest boosted by chat commands (`boi`, `rush`), and opening awards 1 of 4 gacha rewards (Neon Glow skin, +3cm growth, PvP Diamond Shield, or 20s Mini Bomb).

**Architecture:** Create `TreasureSystem` to manage chest lifecycle and collision detection. Extend `Koi` with reward flags (`isNeonGlow`, `hasPvPShield`, `isMiniFish`, `miniTimer`). Integrate `School` to attract fish towards the chest. Connect `LiveClient` to handle chat surge and trigger AI TTS. Render glowing chest, god rays, shields, and neon aura in `LiveOverlay`.

**Tech Stack:** TypeScript, Three.js, React 19, Vitest, Vite

## Global Constraints

- Preserve all existing comments and docstrings unrelated to this change.
- Keep `PvpArenaManager` and `School` compatible with `hasPvPShield`.
- All unit tests and Vite production build must pass with 0 errors.

---

### Task 1: Treasure Types, Koi Attributes, and `TreasureSystem` Core Logic with Unit Tests

**Files:**
- Create: `nagomi/src/treasure-types.ts`
- Create: `nagomi/src/treasure-system.ts`
- Create: `nagomi/src/treasure-system.test.ts`
- Modify: `nagomi/src/koi.ts:60-75`, `nagomi/src/koi.ts:160-180`
- Modify: `nagomi/src/pvp-arena-manager.ts:180-220`

**Interfaces:**
- Produces: `TreasureChest`, `TreasureRewardType`, `TreasureSystem`
  - `spawnChest(pos?: Vec2): TreasureChest`
  - `update(dt: number, school: School): void`
  - `claimReward(fish: Koi, chest: TreasureChest): TreasureRewardType`
  - `onEvent?: (event: { type: "spawn" | "open"; text: string; user?: string }) => void`

- [ ] **Step 1: Define types in `src/treasure-types.ts`**

```typescript
import type { Vec2 } from "./math";

export type TreasureRewardType = "growth" | "neon" | "shield" | "mini";

export interface TreasureReward {
  type: TreasureRewardType;
  title: string;
  description: string;
}

export interface TreasureChest {
  id: string;
  position: Vec2;
  phase: "falling" | "active" | "opened";
  timer: number;       // Remaining active seconds (up to 45s)
  openTimer: number;   // Opened animation seconds (4s)
  claimedBy: {
    id: string;
    name: string;
    avatar: string;
    reward: TreasureReward;
  } | null;
}
```

- [ ] **Step 2: Add reward attributes to `Koi` in `src/koi.ts`**

Add properties:
- `public isNeonGlow = false;`
- `public hasPvPShield = false;`
- `public isMiniFish = false;`
- `public miniTimer = 0;`
Update `reset()` to reset these values.

- [ ] **Step 3: Update `PvpArenaManager` to support `hasPvPShield`**

In `nagomi/src/pvp-arena-manager.ts`:
If the loser fish has `hasPvPShield === true`:
- Set `loserFish.hasPvPShield = false;`
- Do NOT remove fish from school! Push fish away with safety splash.
- Trigger alert: `🛡️ ${loser.name} đã kích hoạt Linh Khiên Kim Cương thoát chết trong gang tấc!`

- [ ] **Step 4: Write unit tests in `src/treasure-system.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { TreasureSystem } from "./treasure-system";
import { School } from "./school";
import { vec } from "./math";

describe("TreasureSystem", () => {
  it("spawns a treasure chest", () => {
    const sys = new TreasureSystem();
    const chest = sys.spawnChest(vec(200, 150));
    expect(chest.phase).toBe("active");
    expect(sys.activeChest).toBe(chest);
  });

  it("detects fish collision and awards a gacha reward", () => {
    const sys = new TreasureSystem();
    const school = new School();
    const fish = school.spawnFishForViewer("u1", "Hero", "hero.png");
    const chest = sys.spawnChest(vec(100, 100));

    // Place fish directly at chest position
    fish.position = vec(100, 100);

    sys.update(0.1, school);
    expect(chest.phase).toBe("opened");
    expect(chest.claimedBy?.name).toBe("Hero");
    expect(chest.claimedBy?.reward).toBeDefined();
  });

  it("protects fish with pvp shield from being eaten in arena", () => {
    const sys = new TreasureSystem();
    const school = new School();
    const fish = school.spawnFishForViewer("u1", "Hero", "hero.png");
    fish.hasPvPShield = true;
    expect(fish.hasPvPShield).toBe(true);
  });
});
```

- [ ] **Step 5: Implement `TreasureSystem` in `src/treasure-system.ts`**

Implement spawning, auto-drop timer (every 420s), mouth collision detection, and weighted gacha roll.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run src/treasure-system.test.ts
git add src/treasure-types.ts src/treasure-system.ts src/treasure-system.test.ts src/koi.ts src/pvp-arena-manager.ts
git commit -m "feat(treasure): implement TreasureSystem with gacha rewards and pvp shield integration"
```

---

### Task 2: School Fish Steering Attraction & Speed Burst on Chat

**Files:**
- Modify: `nagomi/src/school.ts:35-45`, `nagomi/src/school.ts:265-285`, `nagomi/src/school.ts:510-545`
- Modify: `nagomi/src/treasure-system.test.ts`

**Interfaces:**
- Consumes: `school.treasureSystem.activeChest`
- Produces: Magnetic attraction steering towards chest, `miniTimer` decrement, speed burst

- [ ] **Step 1: Wire `TreasureSystem` into `School`**

In `nagomi/src/school.ts`:
- Add `public treasureSystem: TreasureSystem | null = null;`
- In `update(dt, time)`:
  - If `this.treasureSystem`: call `this.treasureSystem.update(dt, this);`
  - For each fish:
    ```typescript
    if (fish.miniTimer > 0) {
      fish.miniTimer = Math.max(0, fish.miniTimer - dt);
      if (fish.miniTimer <= 0) fish.isMiniFish = false;
    }
    ```

- [ ] **Step 2: Add magnetic chest steering in `steeringFor`**

When `this.treasureSystem?.activeChest?.phase === "active"` and `!this.arena?.isActive`:
```typescript
const chest = this.treasureSystem.activeChest;
const toChest = sub(chest.position, fish.position);
const chestDist = length(toChest);
if (chestDist > 10) {
  const pullStrength = fish.state === SwimState.Burst ? 4.5 : 2.5;
  steering = add(steering, mul(normalize(toChest, forward), pullStrength));
}
```

- [ ] **Step 3: Run all unit tests**

Run: `npm test --prefix nagomi`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/school.ts src/treasure-system.test.ts
git commit -m "feat(school): add treasure chest attraction steering and mini fish timer"
```

---

### Task 3: LiveClient Integration & Control Panel Buttons

**Files:**
- Modify: `nagomi/src/live-client.ts:60-90`, `nagomi/src/live-client.ts:460-540`
- Modify: `nagomi/live-server/control.html:200-240`, `nagomi/live-server/control.html:410-435`

**Interfaces:**
- Consumes: `this.treasureSystem.spawnChest`
- Produces: Chat keywords `boi/rush` speed burst, gifts >= 10 diamonds trigger chest, control panel buttons

- [ ] **Step 1: Wire `TreasureSystem` in `LiveClient`**

In `nagomi/src/live-client.ts`:
- `public treasureSystem = new TreasureSystem();`
- In constructor:
  `this.school.treasureSystem = this.treasureSystem;`
  `this.treasureSystem.onEvent = (evt) => {`
  `  this.pushEventAlert(evt.text, "size");`
  `  this.send({ cmd: "say", text: evt.text });`
  `  this.notify();`
  `};`

- [ ] **Step 2: Add `boi` speed burst and gift trigger in `LiveClient`**

In `handleChat`:
- If `comment` matches `/(boi|bơi|nhanh|rush|speed|chay)/i`:
  - Find viewer fish, set `fish.state = SwimState.Burst; fish.speed = fish.maximumSpeed * 1.35;`

In `handleGift`:
- If `coins >= 10`:
  - `this.treasureSystem.spawnChest();`

- [ ] **Step 3: Add test buttons in `control.html`**

In `control.html`:
- Button: `🎁 Thả Rương Báu Ngay`
- Button: `🚀 Cá Người 1 Lướt Nhanh ("bơi")`

- [ ] **Step 4: Commit**

```bash
git add src/live-client.ts live-server/control.html
git commit -m "feat(live): connect treasure system to chat speed burst, gifts, and control panel"
```

---

### Task 4: UI Visuals: Glowing Chest, God Rays, Shields & Neon Aura

**Files:**
- Modify: `nagomi/src/components/live-overlay.tsx:170-270`
- Modify: `nagomi/src/styles.css:1750-1870`

**Interfaces:**
- Consumes: `school.treasureSystem.activeChest`, `fish.hasPvPShield`, `fish.isNeonGlow`, `fish.isMiniFish`
- Produces:
  - Floating glowing treasure chest with God Rays beam
  - Diamond Shield 🛡️ floating next to protected fish
  - Rainbow Neon Glow aura on lucky fish
  - Mini scale transform when hit by mini bomb

- [ ] **Step 1: Render Treasure Chest & God Rays in `LiveOverlay`**

When `treasureSystem.activeChest`:
Render animated golden chest with light beams and bubbling water particles.

- [ ] **Step 2: Render Shield, Neon, and Mini badges on Fish**

In `live-fish-nametag`:
- If `fish.hasPvPShield`: render floating `🛡️` diamond shield.
- If `fish.isNeonGlow`: add `.neon-glow-aura` class.
- If `fish.isMiniFish`: add `.mini-fish-badge` (10cm).

- [ ] **Step 3: Add styles and animations in `styles.css`**

Add CSS for:
- `.treasure-chest-root`
- `.treasure-god-rays`
- `.fish-pvp-shield`
- `.neon-glow-aura`
- `.mini-fish-badge`

- [ ] **Step 4: Run tests and production build**

Run:
`npm test --prefix nagomi`
`npm run build --prefix nagomi`
Expected: 100% tests pass, build completes with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/live-overlay.tsx src/styles.css
git commit -m "feat(ui): add glowing treasure chest, god rays, diamond shield, and neon glow aura"
```
