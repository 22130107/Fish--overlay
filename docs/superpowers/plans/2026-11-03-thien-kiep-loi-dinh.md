# Thiên Kiếp & Lôi Đình Độ Kiếp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng sự kiện tương tác thời gian thực "Thiên Kiếp & Lôi Đình Độ Kiếp" trên TikTok LIVE: khi cá của viewer chạm mốc 72cm hoặc 82cm, lôi kiếp 30 giây kích hoạt với hiệu ứng sấm sét giáng trần, toàn phòng live cùng bình luận "HỘ PHÁP"/thả tim/tặng quà để giúp cá vượt kiếp thành rồng vàng.

**Architecture:** 
- `TribulationManager` quản lý vòng đời sự kiện, bộ đếm 30s và tính điểm Hộ Pháp.
- `LightningEffect` và `FishRenderer` trên Canvas vẽ tia sét phân nhánh procedural, sóng xung kích, chớp sáng và hào quang Chân Long/khói xám.
- `LiveOverlay` hiển thị Banner Lôi Kiếp với thanh năng lượng điện giật và bảng công đức.
- `live-server` xử lý bắt từ khóa chat, like, gift, điều phối giọng đọc Edge TTS ưu tiên và cung cấp nút bấm kiểm thử trên `/control`.

**Tech Stack:** TypeScript, React 19, HTML5 Canvas 2D / WebGL, TailwindCSS, WebSockets, Node.js, MsEdgeTTS, Vitest.

## Global Constraints

- Mốc kích hoạt: chính xác 72.0 cm (Độ Kiếp Kỳ) và 82.0 cm (Phi Thăng Hóa Long).
- Thời gian đếm ngược: chính xác 30.0 giây.
- Điểm yêu cầu: 40 điểm (mốc 72cm), 60 điểm (mốc 82cm).
- Tác động thành công: thưởng +1.5 cm, đầy 100% đói, hào quang Chân Long rực rỡ, mưa 30 viên linh đan.
- Tác động thất bại: phạt -2.0 cm, tụt 20% đói, hiệu ứng khói đen trong 20s.
- Khóa trạng thái đói không để cá bị câu mất trong suốt 30s sự kiện (`isBeingFished = false`).

---

### Task 1: Tribulation Manager Core Logic & Unit Tests

**Files:**
- Create: `nagomi/src/tribulation-types.ts`
- Create: `nagomi/src/tribulation-manager.ts`
- Test: `nagomi/src/tribulation-manager.test.ts`

**Interfaces:**
- Consumes: Nothing
- Produces: `TribulationState`, `TribulationManager`, `TribulationResult`

- [ ] **Step 1: Write the failing unit tests for TribulationManager**

Create `nagomi/src/tribulation-manager.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { TribulationManager } from "./tribulation-manager";

describe("TribulationManager", () => {
  it("initializes with idle state", () => {
    const manager = new TribulationManager();
    expect(manager.state.active).toBe(false);
  });

  it("starts tribulation with correct parameters for 72cm", () => {
    const manager = new TribulationManager();
    manager.start("fish_1", "NguyenVanA", "avatar.jpg", 72.0);

    expect(manager.state.active).toBe(true);
    expect(manager.state.targetFishId).toBe("fish_1");
    expect(manager.state.ownerName).toBe("NguyenVanA");
    expect(manager.state.requiredPower).toBe(40);
    expect(manager.state.timeLeft).toBe(30.0);
    expect(manager.state.result).toBe("ongoing");
  });

  it("starts tribulation with 60 required power for 82cm", () => {
    const manager = new TribulationManager();
    manager.start("fish_2", "TranVanB", "avatar2.jpg", 82.0);
    expect(manager.state.requiredPower).toBe(60);
    expect(manager.state.targetRealm).toBe("Phi Thăng Hóa Long");
  });

  it("accumulates power from comments, likes, and gifts", () => {
    const manager = new TribulationManager();
    manager.start("fish_1", "NguyenVanA", "", 72.0);

    manager.addPower("chat", "Viewer1", 1);
    manager.addPower("like", "Viewer2", 2);
    manager.addPower("gift", "TopDonor", 25);

    expect(manager.state.currentPower).toBe(28);
    const top = manager.getTopContributors();
    expect(top[0].name).toBe("TopDonor");
    expect(top[0].power).toBe(25);
  });

  it("triggers victory immediately when required power is reached", () => {
    const manager = new TribulationManager();
    const onSuccess = vi.fn();
    manager.onSuccess = onSuccess;

    manager.start("fish_1", "NguyenVanA", "", 72.0);
    manager.addPower("gift", "Sponsor", 40);

    expect(manager.state.active).toBe(false);
    expect(manager.state.result).toBe("success");
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFishId: "fish_1",
        ownerName: "NguyenVanA",
        result: "success",
      })
    );
  });

  it("triggers failure when 30 seconds expire without enough power", () => {
    const manager = new TribulationManager();
    const onFail = vi.fn();
    manager.onFail = onFail;

    manager.start("fish_1", "NguyenVanA", "", 72.0);
    manager.addPower("chat", "Viewer1", 10);
    manager.update(30.1);

    expect(manager.state.active).toBe(false);
    expect(manager.state.result).toBe("failed");
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFishId: "fish_1",
        ownerName: "NguyenVanA",
        result: "failed",
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nagomi; npx vitest run src/tribulation-manager.test.ts`
Expected: FAIL with "Cannot find module './tribulation-manager'"

- [ ] **Step 3: Implement `tribulation-types.ts` and `tribulation-manager.ts`**

Create `nagomi/src/tribulation-types.ts`:
```typescript
export interface TribulationContributor {
  name: string;
  avatar?: string;
  power: number;
}

export type TribulationResult = "ongoing" | "success" | "failed";

export interface TribulationState {
  active: boolean;
  targetFishId: string;
  ownerName: string;
  ownerAvatar: string;
  targetRealm: "Độ Kiếp Kỳ" | "Phi Thăng Hóa Long";
  targetCm: number;
  timeLeft: number;
  requiredPower: number;
  currentPower: number;
  contributors: Map<string, TribulationContributor>;
  result: TribulationResult;
}
```

Create `nagomi/src/tribulation-manager.ts`:
```typescript
import type {
  TribulationContributor,
  TribulationResult,
  TribulationState,
} from "./tribulation-types";

export class TribulationManager {
  public state: TribulationState = {
    active: false,
    targetFishId: "",
    ownerName: "",
    ownerAvatar: "",
    targetRealm: "Độ Kiếp Kỳ",
    targetCm: 72.0,
    timeLeft: 30.0,
    requiredPower: 40,
    currentPower: 0,
    contributors: new Map(),
    result: "ongoing",
  };

  public onStart?: (state: TribulationState) => void;
  public onProgress?: (state: TribulationState) => void;
  public onSuccess?: (state: TribulationState) => void;
  public onFail?: (state: TribulationState) => void;

  public start(
    fishId: string,
    ownerName: string,
    ownerAvatar: string = "",
    targetCm: number = 72.0
  ): void {
    const isDragon = targetCm >= 82.0;
    this.state = {
      active: true,
      targetFishId: fishId,
      ownerName: ownerName || "Đạo hữu",
      ownerAvatar: ownerAvatar || "",
      targetRealm: isDragon ? "Phi Thăng Hóa Long" : "Độ Kiếp Kỳ",
      targetCm,
      timeLeft: 30.0,
      requiredPower: isDragon ? 60 : 40,
      currentPower: 0,
      contributors: new Map(),
      result: "ongoing",
    };
    this.onStart?.(this.state);
  }

  public addPower(
    _source: "chat" | "like" | "gift",
    userName: string,
    points: number = 1,
    avatar: string = ""
  ): void {
    if (!this.state.active) return;

    const safePoints = Math.max(1, points);
    this.state.currentPower += safePoints;

    const userKey = userName.toLowerCase().trim() || "khán giả";
    let cont = this.state.contributors.get(userKey);
    if (!cont) {
      cont = { name: userName || "Khán giả", avatar, power: 0 };
      this.state.contributors.set(userKey, cont);
    }
    cont.power += safePoints;
    if (avatar && !cont.avatar) cont.avatar = avatar;

    this.onProgress?.(this.state);

    if (this.state.currentPower >= this.state.requiredPower) {
      this.resolve(true);
    }
  }

  public update(dt: number): void {
    if (!this.state.active) return;

    this.state.timeLeft -= dt;
    if (this.state.timeLeft <= 0) {
      this.state.timeLeft = 0;
      this.resolve(this.state.currentPower >= this.state.requiredPower);
    }
  }

  public resolve(success: boolean): void {
    if (!this.state.active) return;
    this.state.active = false;
    this.state.result = success ? "success" : "failed";

    if (success) {
      this.onSuccess?.(this.state);
    } else {
      this.onFail?.(this.state);
    }
  }

  public getTopContributors(limit = 3): TribulationContributor[] {
    return Array.from(this.state.contributors.values())
      .sort((a, b) => b.power - a.power)
      .slice(0, limit);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nagomi; npx vitest run src/tribulation-manager.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
cd nagomi
git add src/tribulation-types.ts src/tribulation-manager.ts src/tribulation-manager.test.ts
git commit -m "feat: add TribulationManager core and unit tests"
```

---

### Task 2: Koi Model State & Client Event Integration

**Files:**
- Modify: `nagomi/src/koi.ts`
- Modify: `nagomi/src/live-client.ts`

**Interfaces:**
- Consumes: `TribulationManager`, `TribulationState` from `src/tribulation-manager.ts`
- Produces: Updated `Koi` properties (`passedTribulation72`, `passedTribulation82`, `tribulationAura`, `smokeTimer`), integrated `liveClient.tribulation`

- [ ] **Step 1: Update `nagomi/src/koi.ts` to add tribulation tracking fields**

In `nagomi/src/koi.ts`, add properties:
```typescript
  public passedTribulation72 = false;
  public passedTribulation82 = false;
  public tribulationAura: "dragon" | "smoke" | null = null;
  public smokeTimer = 0;
```
And inside `reset(index, random)` initialize them cleanly:
```typescript
  this.passedTribulation72 = false;
  this.passedTribulation82 = false;
  this.tribulationAura = null;
  this.smokeTimer = 0;
```

- [ ] **Step 2: Update `nagomi/src/live-client.ts` to integrate `TribulationManager`**

Add import:
```typescript
import { TribulationManager } from "./tribulation-manager";
import type { TribulationState } from "./tribulation-types";
```
In `LiveStreamState`, add:
```typescript
  tribulation: TribulationState | null;
```
In `LiveClient` constructor:
- Instantiate `public tribulation = new TribulationManager();`
- Wire up callbacks:
  ```typescript
  this.tribulation.onStart = (st) => {
    this.state.tribulation = { ...st };
    this.pushEventAlert(
      `⚡ THIÊN KIẾP! Cá của ${st.ownerName} đang nghênh đón lôi kiếp!`,
      "info"
    );
    this.notify();
  };

  this.tribulation.onProgress = (st) => {
    this.state.tribulation = { ...st };
    this.notify();
  };

  this.tribulation.onSuccess = (st) => {
    this.state.tribulation = { ...st };
    const fish = this.school.fish
      .slice(0, this.school.count)
      .find((f) => f.ownerId === st.targetFishId);

    if (fish) {
      if (st.targetCm >= 82) {
        fish.passedTribulation82 = true;
        fish.tribulationAura = "dragon";
      } else {
        fish.passedTribulation72 = true;
        fish.tribulationAura = "dragon";
      }
      fish.hunger = 100;
      fish.eatCount += 3; // +1.5cm bonus
    }

    // Trigger celebratory rain of 30 food pellets
    for (let i = 0; i < 30; i++) {
      const rx = 30 + Math.random() * (CANVAS_WIDTH - 60);
      const ry = 30 + Math.random() * (CANVAS_HEIGHT - 60);
      this.foodSystem.spawn(vec(rx, ry), "Thiên Đạo Chúc Phúc", undefined, i < 3);
    }
    this.school.callTo(vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5));

    this.pushEventAlert(
      `🎉 CHÚC MỪNG! ${st.ownerName} đã độ kiếp thành công hóa Chân Long!`,
      "size"
    );
    this.notify();
  };

  this.tribulation.onFail = (st) => {
    this.state.tribulation = { ...st };
    const fish = this.school.fish
      .slice(0, this.school.count)
      .find((f) => f.ownerId === st.targetFishId);

    if (fish) {
      fish.eatCount = Math.max(0, fish.eatCount - 4); // -2.0cm penalty
      fish.hunger = 20;
      fish.hungerTimeLeft = fish.maxHungerTime * 0.2;
      fish.tribulationAura = "smoke";
      fish.smokeTimer = 20.0;
    }

    this.pushEventAlert(
      `🌩️ ĐỘ KIẾP THẤT BẠI! Cá của ${st.ownerName} bị thương tích -2cm!`,
      "hook"
    );
    this.notify();
  };
  ```

In `LiveClient.onMessage`:
- Handle message types:
  ```typescript
  case "tribulation_start":
    this.tribulation.start(msg.targetFishId, msg.ownerName, msg.ownerAvatar, msg.targetCm);
    break;
  case "tribulation_power":
    this.tribulation.addPower(msg.source, msg.user, msg.points, msg.avatar);
    break;
  case "tribulation_resolve":
    this.tribulation.resolve(msg.success);
    break;
  ```
- And in `update(dt)`:
  ```typescript
  if (this.tribulation.state.active) {
    this.tribulation.update(dt);
  }
  ```

- [ ] **Step 3: Run all unit tests to verify no regressions**

Run: `cd nagomi; npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd nagomi
git add src/koi.ts src/live-client.ts
git commit -m "feat: integrate TribulationManager into Koi and LiveClient"
```

---

### Task 3: Canvas Lightning Effect & Fish Aura/Smoke Renderer

**Files:**
- Create: `nagomi/src/lightning-effect.ts`
- Modify: `nagomi/src/fish-renderer.ts`

**Interfaces:**
- Consumes: `Vec2` from `src/math.ts`, `School` from `src/school.ts`, `TribulationState` from `src/tribulation-types.ts`
- Produces: `LightningEffect.render(ctx, dt, targetPos, powerPercent)`

- [ ] **Step 1: Create `nagomi/src/lightning-effect.ts`**

```typescript
import type { Vec2 } from "./math";

interface LightningBolt {
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export class LightningEffect {
  private bolts: LightningBolt[] = [];
  private flashAlpha = 0;
  private strikeTimer = 0;

  public updateAndRender(
    ctx: CanvasRenderingContext2D,
    dt: number,
    targetPos: Vec2,
    powerPercent: number,
    onStrike?: (pos: Vec2) => void
  ): void {
    this.strikeTimer -= dt;
    if (this.strikeTimer <= 0) {
      this.strikeTimer = 0.8 + Math.random() * 0.8; // Strike every ~1s
      this.spawnBolt(targetPos, powerPercent);
      this.flashAlpha = 0.22;
      onStrike?.(targetPos);
    }

    // Screen flash
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
    }

    // Render & update active bolts
    ctx.save();
    for (const bolt of this.bolts) {
      bolt.life -= dt;
      if (bolt.life <= 0) continue;

      const alpha = Math.max(0, bolt.life / bolt.maxLife);
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = bolt.width;
      ctx.lineCap = "round";
      ctx.shadowBlur = 12;
      ctx.shadowColor = bolt.color;
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      for (const seg of bolt.segments) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
    }
    ctx.restore();

    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  private spawnBolt(target: Vec2, powerPercent: number): void {
    const startX = target.x + (Math.random() - 0.5) * 80;
    const startY = 0;
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    let curX = startX;
    let curY = startY;
    const steps = 14;
    const dy = (target.y - startY) / steps;

    for (let i = 0; i < steps; i++) {
      const nextY = curY + dy;
      const nextX = curX + (Math.random() - 0.5) * 22;
      segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

      // Fork branch
      if (Math.random() < 0.35 && i < steps - 3) {
        const forkX = nextX + (Math.random() - 0.5) * 35;
        const forkY = nextY + dy * 0.7;
        segments.push({ x1: nextX, y1: nextY, x2: forkX, y2: forkY });
      }

      curX = nextX;
      curY = nextY;
    }
    // Connect to target
    segments.push({ x1: curX, y1: curY, x2: target.x, y2: target.y });

    const isGolden = powerPercent >= 80;
    const color = isGolden ? "#fbbf24" : Math.random() < 0.5 ? "#38bdf8" : "#c084fc";

    this.bolts.push({
      segments,
      life: 0.25,
      maxLife: 0.25,
      color,
      width: 2.5 + Math.random() * 1.5,
    });
  }

  public clear(): void {
    this.bolts = [];
    this.flashAlpha = 0;
  }
}
```

- [ ] **Step 2: Update `nagomi/src/fish-renderer.ts` to draw lightning and fish auras**

In `FishRenderer`, when rendering each koi:
- If `fish.tribulationAura === "dragon"` or `fish.sizeCm >= 82`:
  Draw golden aura around fish body:
  ```typescript
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#fbbf24";
  ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  ```
- If `fish.tribulationAura === "smoke"` and `fish.smokeTimer > 0`:
  Render drifting smoke particles above fish.
- When tribulation is active, invoke `LightningEffect.updateAndRender(ctx, dt, targetPos, powerPercent)`.

- [ ] **Step 3: Run build test to verify TypeScript compilation**

Run: `cd nagomi; npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
cd nagomi
git add src/lightning-effect.ts src/fish-renderer.ts
git commit -m "feat: add procedural lightning and dragon aura renderer"
```

---

### Task 4: Stream Overlay HUD & Animated Electric Banner

**Files:**
- Modify: `nagomi/src/components/live-overlay.tsx`
- Modify: `nagomi/src/styles.css`

**Interfaces:**
- Consumes: `liveState.tribulation` from `src/live-client.ts`
- Produces: Rendered `TribulationBanner` HUD on screen

- [ ] **Step 1: Add TribulationBanner in `nagomi/src/components/live-overlay.tsx`**

Inside `LiveOverlay`, insert the TribulationBanner at the top:
```tsx
      {/* 0. Thiên Kiếp & Lôi Đình Banner */}
      {liveState.tribulation && liveState.tribulation.active && (
        <div className="live-tribulation-banner">
          <div className="tribulation-header">
            <span className="thunder-icon">⚡</span>
            <span className="tribulation-title">
              THIÊN KIẾP GIÁNG LÂM: {liveState.tribulation.targetRealm.toUpperCase()}
            </span>
            <span className="thunder-icon">⚡</span>
          </div>

          <div className="tribulation-body">
            <div className="tribulation-user-row">
              {liveState.tribulation.ownerAvatar ? (
                <img
                  src={liveState.tribulation.ownerAvatar}
                  alt=""
                  className="tribulation-avatar"
                />
              ) : (
                <div className="tribulation-avatar-fallback">🐉</div>
              )}
              <div className="tribulation-info">
                <div className="tribulation-target-name">
                  Linh ngư của <b>{liveState.tribulation.ownerName}</b>
                </div>
                <div className="tribulation-realm-pill">
                  {liveState.tribulation.targetCm}cm • Cửu Trọng Lôi Kiếp
                </div>
              </div>

              <div
                className={`tribulation-timer ${
                  liveState.tribulation.timeLeft <= 10 ? "timer-urgent" : ""
                }`}
              >
                ⏳ {Math.ceil(liveState.tribulation.timeLeft)}s
              </div>
            </div>

            {/* Progress Energy Gauge */}
            <div className="tribulation-bar-wrap">
              <div
                className="tribulation-bar-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (liveState.tribulation.currentPower /
                        liveState.tribulation.requiredPower) *
                        100
                    )
                  )}%`,
                }}
              >
                <div className="bar-sparkle" />
              </div>
              <span className="tribulation-bar-text">
                ⚡ Lực Hộ Pháp: {liveState.tribulation.currentPower} /{" "}
                {liveState.tribulation.requiredPower} (
                {Math.min(
                  100,
                  Math.round(
                    (liveState.tribulation.currentPower /
                      liveState.tribulation.requiredPower) *
                      100
                  )
                )}
                %)
              </span>
            </div>

            <div className="tribulation-call-action">
              💬 Bình luận <b>"HỘ PHÁP"</b> • ❤️ Thả Tim • 🎁 Quà tặng để trợ lực!
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Add CSS styles in `nagomi/src/styles.css`**

Add styling for `.live-tribulation-banner`, `.tribulation-header`, `.tribulation-bar-wrap`, `.tribulation-bar-fill`, `.timer-urgent`, with neon electric glow and pulsing border keyframes.

- [ ] **Step 3: Run Vitest and build check**

Run: `cd nagomi; npx vitest run; npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd nagomi
git add src/components/live-overlay.tsx src/styles.css
git commit -m "feat: add Tribulation HUD banner to live overlay"
```

---

### Task 5: Server Automation, Priority TTS & Control Panel Testing

**Files:**
- Modify: `nagomi/live-server/server.mjs`
- Modify: `nagomi/live-server/control.html`

**Interfaces:**
- Consumes: Chat keywords, Likes, Gifts from TikTok Live event streams
- Produces: `tribulation_start`, `tribulation_power`, `tribulation_resolve` broadcast messages, `/control` test actions

- [ ] **Step 1: Update `nagomi/live-server/server.mjs`**

Add server-side tribulation tracking:
```javascript
let currentTribulation = null; // { targetFishId, ownerName, ownerAvatar, targetCm, timeLeft, requiredPower, currentPower }
```
In `handleChat`:
- Check tribulation keywords:
  ```javascript
  const HO_PHAP_KEYWORDS = ['hộ pháp', 'ho phap', 'độ kiếp', 'do kiep', 'cố lên', 'co len', 'hóa rồng', 'hoa rong', 'lên', 'len'];
  if (currentTribulation && HO_PHAP_KEYWORDS.some(kw => lower.includes(kw))) {
    broadcast({ t: 'tribulation_power', source: 'chat', user: name, points: 1, avatar });
  }
  ```
- Check fish growth for automatic threshold trigger:
  ```javascript
  if (fish.sizeCm >= 72.0 && !fish.passed72) {
    fish.passed72 = true;
    startTribulation(fish.id, fish.name, fish.avatar, 72.0);
  } else if (fish.sizeCm >= 82.0 && !fish.passed82) {
    fish.passed82 = true;
    startTribulation(fish.id, fish.name, fish.avatar, 82.0);
  }
  ```
In `handleLike`:
- If `currentTribulation`, boost tribulation power:
  ```javascript
  if (currentTribulation) {
    broadcast({ t: 'tribulation_power', source: 'like', user: name, points: 1 });
  }
  ```
In `handleGift`:
- If `currentTribulation`, add gift power:
  ```javascript
  if (currentTribulation) {
    const pts = coins >= 10 ? Math.min(50, coins * 2) : Math.max(5, coins);
    broadcast({ t: 'tribulation_power', source: 'gift', user: name, points: pts, avatar });
  }
  ```
Add HTTP API handlers in request router:
- `/api/tribulation/test`: triggers test tribulation event.
- `/api/tribulation/power`: injects test power points.
- `/api/tribulation/resolve`: resolves immediately.

- [ ] **Step 2: Update `nagomi/live-server/control.html`**

Add Card "⚡ Thử Nghiệm Thiên Kiếp (Lôi Đình Độ Kiếp)":
- Buttons:
  - `[⚡ Test Lôi Kiếp 72cm]`
  - `[🐉 Test Lôi Kiếp 82cm]`
  - `[+5 Lực Hộ Pháp]`
  - `[Thắng Ngay]` / `[Thua Ngay]`
- Wire up with fetch calls to `/api/tribulation/*`.

- [ ] **Step 3: Test server syntax and endpoints**

Run: `cd nagomi; node --check live-server/server.mjs`
Expected: PASS (Syntax valid)

- [ ] **Step 4: Commit**

```bash
cd nagomi
git add live-server/server.mjs live-server/control.html
git commit -m "feat: add server tribulation handling, priority TTS and control panel testing buttons"
```

---

### Task 6: Full Verification & End-to-End Test

**Files:**
- Test all components end-to-end

- [ ] **Step 1: Run complete Vitest suite**

Run: `cd nagomi; npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run production bundle build check**

Run: `cd nagomi; npm run build`
Expected: Vite build succeeds with 0 errors

- [ ] **Step 3: Verification commit & clean up**

```bash
cd nagomi
git status
```
Verify working directory is clean.
