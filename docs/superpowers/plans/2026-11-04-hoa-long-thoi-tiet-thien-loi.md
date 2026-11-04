# Cảnh Giới Hóa Long Điều Khiển Thời Tiết & Thiên Lôi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi quyền năng đổi thời tiết và bổ sung tính năng triệu hồi Thiên Lôi thành đặc quyền độc quyền cho người xem có cá đạt cảnh giới Phi Thăng Hóa Long ($\ge 82.0\text{ cm}$).

**Architecture:** 
1. `src/tu-tien.ts`: Cập nhật mô tả cảnh giới Hóa Long và câu thoại AI tôn vinh khả năng hô mưa gọi gió, chưởng quản thiên lôi.
2. `src/lightning-effect.ts` & `src/fish-renderer.ts`: Cung cấp hàm kích hoạt tia sét độc lập ngoài sự kiện Độ Kiếp, vẽ và giải phóng các tia sét chủ động.
3. `src/live-client.ts`: Lắng nghe bản tin `dragon_lightning`, định vị Chân Long, bắn tia sét kim sắc, tạo sóng chấn động và đẩy thông báo banner.
4. `live-server/server.mjs`: Phân quyền chặt chẽ cho lệnh thời tiết và bổ sung từ khóa gọi Thiên Lôi kèm cơ chế cooldown 15s; hỗ trợ nút bấm test trên `control.html`.

**Tech Stack:** TypeScript, Three.js / Canvas 2D, WebSocket, Node.js (ESM), Vitest.

## Global Constraints

- Chỉ người xem có `fish.sizeCm >= 82.0` hoặc `fish.passed82 === true` mới được kích hoạt lệnh thời tiết hoặc gọi thiên lôi.
- Người xem chưa Hóa Long ($< 82.0\text{ cm}$) bị từ chối và ghi log cảnh báo, không đọc TTS để tránh spam âm thanh.
- Lệnh gọi Thiên Lôi có thời gian hồi chiêu 15 giây đối với mỗi người dùng.
- Giữ nguyên các tính năng tu tiên, độ kiếp, PvP, bảng quà và quy tắc hiển thị đã có.

---

### Task 1: Cập Nhật Cảnh Giới Tu Tiên (`src/tu-tien.ts`)

**Files:**
- Modify: `src/tu-tien.ts:168-195`
- Test: `src/tu-tien.test.ts`

**Interfaces:**
- Consumes: `calculateTuTienRank(sizeCm: number)`, `getTuTienVoiceLine(name: string, sizeCm: number, rank: TuTienRank, eatCount: number)`
- Produces: Updated `desc` and voice line for size $\ge 82\text{ cm}$ highlighting weather and lightning mastery.

- [ ] **Step 1: Write the failing test**

Tạo file `src/tu-tien.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { calculateTuTienRank, getTuTienVoiceLine } from "./tu-tien";

describe("Tu Tien Dragon Realm Description and Voice", () => {
  it("should mention weather and lightning control in Hóa Long realm description", () => {
    const rank = calculateTuTienRank(82.0);
    expect(rank.fullName).toBe("Phi Thăng Hóa Long");
    expect(rank.desc).toContain("thời tiết");
    expect(rank.desc).toContain("thiên lôi");
  });

  it("should announce weather and lightning command in Hóa Long voice line", () => {
    const rank = calculateTuTienRank(85.0);
    const line = getTuTienVoiceLine("Lâm Động", 85.0, rank, 130);
    expect(line).toContain("thời tiết");
    expect(line).toContain("thiên lôi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nagomi; npx vitest run src/tu-tien.test.ts`
Expected: FAIL (desc does not contain "thời tiết" / "thiên lôi").

- [ ] **Step 3: Write minimal implementation**

Cập nhật `src/tu-tien.ts`:
```typescript
  // 7. Phi Thăng Hóa Long (>= 82 cm)
  return {
    realm: "Phi Thăng Kỳ",
    subStage: "Chân Long Thần Cấp",
    fullName: "Phi Thăng Hóa Long",
    title: "Thái Cổ Chân Long",
    badge: "🐉👑",
    auraColor: "#fbbf24",
    progressToNext: 100,
    nextRealm: "Đắc Đạo Thần Thoại",
    desc: "Cá chép vượt long môn, đắc đạo thành Chân Long phi thăng tiên giới, hô mưa gọi gió, chưởng quản thời tiết và thiên lôi.",
  };
```
Và trong `getTuTienVoiceLine`:
```typescript
  if (sizeCm >= 82) {
    return `Kính báo thiên hạ! Linh ngư của đạo hữu ${spokenName} đã đạt ${sizeWords} xăng ti mét, đắc đạo cảnh giới Phi Thăng Hóa Long, cá chép vượt Vũ Môn hóa thành Chân Long thượng giới, chưởng quản thời tiết và hiệu triệu thiên lôi!`;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nagomi; npx vitest run src/tu-tien.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tu-tien.ts src/tu-tien.test.ts
git commit -m "feat(tu-tien): update Hóa Long description and voice line for weather and lightning control"
```

---

### Task 2: Hỗ Trợ Tia Sét Độc Lập Trong `LightningEffect` & `FishRenderer`

**Files:**
- Modify: `src/lightning-effect.ts:35-75`
- Modify: `src/fish-renderer.ts:660-692`
- Test: `src/lightning-effect.test.ts`

**Interfaces:**
- Consumes: `LightningEffect.spawnBolt(target: Vec2, powerPercent: number)`, `LightningEffect.triggerBurstFlash()`
- Produces: `LightningEffect.updateAndRenderBolts(ctx: CanvasRenderingContext2D, dt: number): void` ensuring active bolts and screen flash render even when `tribulation.active === false`.

- [ ] **Step 1: Write the failing test**

Mở `src/lightning-effect.test.ts` và thêm test case kiểm tra vẽ tia sét khi không có sự kiện tribulation:
```typescript
  it("should update and render active bolts independently without tribulation loop", () => {
    const lightning = new LightningEffect();
    const ctx = createMockContext();
    const target = { x: 200, y: 300 };
    lightning.spawnBolt(target, 95);
    expect(lightning.getBolts().length).toBe(1);

    lightning.updateAndRenderBolts(ctx, 0.05);
    expect(lightning.getBolts().length).toBe(1);
    expect(lightning.getBolts()[0].life).toBeLessThan(0.25);

    // After remaining lifetime expires
    lightning.updateAndRenderBolts(ctx, 0.3);
    expect(lightning.getBolts().length).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nagomi; npx vitest run src/lightning-effect.test.ts`
Expected: FAIL (`updateAndRenderBolts` is not a function).

- [ ] **Step 3: Write minimal implementation**

Trong `src/lightning-effect.ts`:
Tách logic vẽ các tia sét hiện có thành method `updateAndRenderBolts(ctx: CanvasRenderingContext2D, dt: number)`:
```typescript
  public updateAndRenderBolts(ctx: CanvasRenderingContext2D, dt: number): void {
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
```
Và trong `updateAndRender`:
```typescript
    // Screen flash
    this.renderFlash(ctx, dt);

    // Render & update active bolts
    this.updateAndRenderBolts(ctx, dt);
```
Trong `src/fish-renderer.ts` (dòng 685-692):
```typescript
    } else {
      if (this.lightning.getFlashAlpha() > 0) {
        this.lightning.renderFlash(ctx, dt);
      }
      if (this.lightning.getBolts().length > 0) {
        this.lightning.updateAndRenderBolts(ctx, dt);
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nagomi; npx vitest run src/lightning-effect.test.ts`
Expected: PASS (all 14 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/lightning-effect.ts src/lightning-effect.test.ts src/fish-renderer.ts
git commit -m "feat(renderer): allow independent lightning bolt rendering outside tribulation"
```

---

### Task 3: Xử Lý Sự Kiện `dragon_lightning` Trên Client (`src/live-client.ts`)

**Files:**
- Modify: `src/live-client.ts:600-720`
- Test: `src/dragon-lightning-client.test.ts`

**Interfaces:**
- Consumes: WebSocket message `{ t: 'dragon_lightning', user: string, id: string }`
- Produces: Screen flash, golden branching lightning bolt, 3 wave ripples, school scatter, and alert notification.

- [ ] **Step 1: Write the failing test**

Tạo `src/dragon-lightning-client.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { LiveClient } from "./live-client";

describe("LiveClient Dragon Lightning Handler", () => {
  it("should trigger lightning bolt, flash, ripples and alert on dragon_lightning message", () => {
    const mockRipples = { trigger: vi.fn() };
    const mockFishRenderer = {
      lightning: {
        triggerBurstFlash: vi.fn(),
        spawnBolt: vi.fn(),
      },
    };
    const mockSchool = {
      fish: [
        {
          ownerId: "user_dragon",
          ownerName: "Lâm Động",
          position: { x: 300, y: 400 },
          tribulationAura: "dragon",
        },
      ],
      count: 1,
      ripples: mockRipples,
      frighten: vi.fn(),
      fishRenderer: mockFishRenderer,
    };
    const mockFoodSystem = { spawn: vi.fn() };

    const client = new LiveClient(mockSchool as any, mockFoodSystem as any);
    const pushAlertSpy = vi.spyOn(client, "pushEventAlert");

    // Call private handleWsMessage or mock dispatch
    (client as any).handleWsMessage(
      JSON.stringify({
        t: "dragon_lightning",
        user: "Lâm Động",
        id: "user_dragon",
      })
    );

    expect(mockFishRenderer.lightning.triggerBurstFlash).toHaveBeenCalled();
    expect(mockFishRenderer.lightning.spawnBolt).toHaveBeenCalledWith(
      expect.objectContaining({ x: 300, y: 400 }),
      95
    );
    expect(mockRipples.trigger).toHaveBeenCalledWith(
      "touch",
      expect.objectContaining({ x: 300, y: 400 })
    );
    expect(pushAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining("Lâm Động"),
      "size"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nagomi; npx vitest run src/dragon-lightning-client.test.ts`
Expected: FAIL (`dragon_lightning` case unhandled).

- [ ] **Step 3: Write minimal implementation**

Trong `src/live-client.ts`, thêm `case "dragon_lightning":` trong switch `msg.t`:
```typescript
      case "dragon_lightning": {
        const id = msg.id || "";
        const name = msg.user || "Thái Cổ Chân Long";
        let dragonFish = this.school.fish
          .slice(0, this.school.count)
          .find(
            (f) =>
              (id && f.ownerId === id) ||
              (f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase())
          );

        const targetPos = dragonFish
          ? dragonFish.position
          : vec(
              CANVAS_WIDTH * 0.5 + (Math.random() - 0.5) * 160,
              CANVAS_HEIGHT * 0.5 + (Math.random() - 0.5) * 160
            );

        const renderer = (this.school as any).fishRenderer;
        renderer?.lightning?.triggerBurstFlash?.();
        renderer?.lightning?.spawnBolt?.(targetPos, 95);

        this.school.ripples.trigger("touch", targetPos);
        const t1 = setTimeout(() => this.school.ripples.trigger("touch", targetPos), 150);
        const t2 = setTimeout(() => this.school.ripples.trigger("touch", targetPos), 300);
        this.transformationTimers.push(t1, t2);

        this.school.frighten(targetPos);

        this.pushEventAlert(
          `⚡ THÁI CỔ CHÂN LONG ${name} HIỆU TRIỆU THIÊN LÔI GIÁNG LÂM! ⚡`,
          "size"
        );
        this.notify();
        break;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nagomi; npx vitest run src/dragon-lightning-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/live-client.ts src/dragon-lightning-client.test.ts
git commit -m "feat(client): handle dragon_lightning message with bolts, ripples, and alerts"
```

---

### Task 4: Phân Quyền Hóa Long & Xử Lý Lệnh Trong Server (`live-server/server.mjs`)

**Files:**
- Modify: `live-server/server.mjs:98-120`, `live-server/server.mjs:280-320`, `live-server/server.mjs:1230-1250`
- Modify: `live-server/control.html:170-195`
- Test: `live-server/dragon-control.test.mjs`

**Interfaces:**
- Consumes: `isDragonFish(fish)`
- Produces: Protected weather commands, `THIEN_LOI_KEYWORDS` command with 15s cooldown, and test control button.

- [ ] **Step 1: Write the failing test**

Tạo `live-server/dragon-control.test.mjs`:
```javascript
import { describe, it, expect } from "vitest";

// Logic helpers matching server implementation
export function isDragonFish(fish) {
  return Boolean(fish && (Number(fish.sizeCm) >= 82.0 || fish.passed82));
}

export function handleWeatherAuth(fish) {
  if (!isDragonFish(fish)) {
    return { allowed: false, reason: "Chưa đạt cảnh giới Hóa Long (cần >= 82cm)" };
  }
  return { allowed: true };
}

export function handleThunderAuth(fish, lastThunderTime, now = Date.now()) {
  if (!isDragonFish(fish)) {
    return { allowed: false, reason: "Chưa đạt cảnh giới Hóa Long" };
  }
  if (now - (lastThunderTime || 0) < 15000) {
    return { allowed: false, reason: "Thiên Lôi đang hồi chiêu (15 giây)" };
  }
  return { allowed: true };
}

describe("Server Dragon Permissions and Cooldown", () => {
  it("should deny weather control for non-dragon fish (< 82cm)", () => {
    const normalFish = { id: "u1", sizeCm: 45.0, passed82: false };
    expect(handleWeatherAuth(normalFish).allowed).toBe(false);
  });

  it("should allow weather control for dragon fish (>= 82cm or passed82)", () => {
    const dragonFish1 = { id: "u2", sizeCm: 82.0, passed82: false };
    const dragonFish2 = { id: "u3", sizeCm: 75.0, passed82: true };
    expect(handleWeatherAuth(dragonFish1).allowed).toBe(true);
    expect(handleWeatherAuth(dragonFish2).allowed).toBe(true);
  });

  it("should enforce 15s cooldown on thunder summon", () => {
    const dragonFish = { id: "u2", sizeCm: 85.0, passed82: true };
    const t0 = 100000;
    expect(handleThunderAuth(dragonFish, 0, t0).allowed).toBe(true);
    expect(handleThunderAuth(dragonFish, t0, t0 + 5000).allowed).toBe(false);
    expect(handleThunderAuth(dragonFish, t0, t0 + 15000).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes unit logic**

Run: `cd nagomi; npx vitest run live-server/dragon-control.test.mjs`
Expected: PASS.

- [ ] **Step 3: Implement server logic in `live-server/server.mjs`**

1. Định nghĩa `isDragonFish` và `userLastThunder`:
```javascript
const userLastThunder = new Map(); // id -> timestamp

function isDragonFish(f) {
  return Boolean(f && (Number(f.sizeCm) >= 82.0 || f.passed82));
}

const THIEN_LOI_KEYWORDS = [
  'thiên lôi', 'thien loi', 'sấm sét', 'sam set', 'gọi sét', 'goi set',
  'lôi phạt', 'loi phat', 'sét đánh', 'set danh', 'sét', 'lôi giáng'
];
```

2. Cập nhật xử lý thời tiết trong `handleChat`:
```javascript
  // Check weather command - ĐẶC QUYỀN HÓA LONG (>= 82cm)
  if (settings.rainKeyword) {
    for (const item of WEATHER_KEYWORDS) {
      if (item.words.some((w) => lower.includes(w))) {
        if (currentTribulation) { return; } // Weather locked during tribulation
        
        if (!isDragonFish(fish)) {
          addLog(`⚠️ ${name} chưa đạt cảnh giới Hóa Long (${fish.sizeCm}cm < 82cm), chưa thể đổi thời tiết.`);
          return;
        }

        const weatherNames = {
          'rain': 'Mưa Rơi',
          'sunny': 'Nắng Ấm',
          'sunset': 'Hoàng Hôn',
          'moonlight': 'Ánh Trăng',
          'mist': 'Sương Mù',
          'deep-clear': 'Trong Xanh'
        };
        const weatherLabel = weatherNames[item.preset] || item.preset;
        addLog(`🌤️ 🐉 Thái Cổ Chân Long ${name} đổi thời tiết: ${item.preset}`);
        broadcast({ t: 'weather', preset: item.preset, user: name });
        const spokenName = cleanSpokenName(name);
        say(`Thái Cổ Chân Long của đạo hữu ${spokenName} hô mưa gọi gió, biến hóa càn khôn sang tiết trời ${weatherLabel}!`, { tag: 'weather' });
        return;
      }
    }
  }

  // Check Thiên Lôi command - ĐẶC QUYỀN HÓA LONG (>= 82cm)
  if (THIEN_LOI_KEYWORDS.some((kw) => lower.includes(kw))) {
    if (currentTribulation) { return; }

    if (!isDragonFish(fish)) {
      addLog(`⚠️ ${name} chưa đạt cảnh giới Hóa Long (${fish.sizeCm}cm < 82cm), chưa thể hiệu triệu Thiên Lôi.`);
      return;
    }

    const now = Date.now();
    const lastTime = userLastThunder.get(id) || 0;
    if (now - lastTime < 15000) {
      const waitSec = Math.ceil((15000 - (now - lastTime)) / 1000);
      addLog(`⏳ ${name} gọi Thiên Lôi quá nhanh, cần hồi khí ${waitSec}s.`);
      return;
    }
    userLastThunder.set(id, now);

    addLog(`⚡ 🐉 Thái Cổ Chân Long ${name} triệu hoán Thiên Lôi giáng lâm!`);
    broadcast({ t: 'dragon_lightning', user: name, id: fish.id });
    broadcast({ t: 'scatter', user: name });

    const spokenName = cleanSpokenName(name);
    say(`Thái Cổ Chân Long của đạo hữu ${spokenName} hiệu triệu Thiên Lôi giáng thế, uy chấn bát hoang!`, { tag: 'lightning', priority: true });
    return;
  }
```

3. Thêm handler WebSocket / API cho test `dragon_lightning`:
```javascript
      case 'dragon_lightning': {
        const userName = msg.user || 'Thái Cổ Chân Long';
        const fishId = msg.id || 'test_dragon_1';
        addLog(`⚡ 🐉 [Control Test] Triệu hoán Thiên Lôi: ${userName}`);
        broadcast({ t: 'dragon_lightning', user: userName, id: fishId });
        broadcast({ t: 'scatter', user: userName });
        const spoken = cleanSpokenName(userName);
        say(`Thái Cổ Chân Long của đạo hữu ${spoken} hiệu triệu Thiên Lôi giáng thế, uy chấn bát hoang!`, { tag: 'lightning', priority: true });
        break;
      }
```

4. Cập nhật `live-server/control.html`:
Thêm nút test Thiên Lôi:
```html
<button class="primary" onclick="testDragonLightning()">⚡ Test Thiên Lôi (Chân Long)</button>
```
Script:
```javascript
function testDragonLightning() {
  ws.send(JSON.stringify({ cmd: 'dragon_lightning', user: 'Thái Cổ Chân Long' }));
}
```
Và thêm chú thích:
`<div style="font-size: 11px; color: #888; margin-top: 4px;">* Lệnh đổi thời tiết & thiên lôi trong chat chỉ dành cho cá đạt Hóa Long (>= 82cm).</div>`

- [ ] **Step 4: Run test to verify**

Run: `cd nagomi; npx vitest run live-server/dragon-control.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add live-server/server.mjs live-server/control.html live-server/dragon-control.test.mjs
git commit -m "feat(server): restrict weather and add heavenly thunder command for Hóa Long realm"
```

---

### Task 5: Kiểm Thử Toàn Diện & Build Dist

**Files:**
- Test all: `npm test`
- Build: `npm run build`

- [ ] **Step 1: Run full test suite**

Run: `cd nagomi; npm test`
Expected: All tests pass across the entire project.

- [ ] **Step 2: Run production build**

Run: `cd nagomi; npm run build`
Expected: Vite build succeeds with zero errors, updating `dist/`.

- [ ] **Step 3: Commit**

```bash
git add dist/
git commit -m "build: rebuild distribution bundle with Hóa Long weather and thunder feature"
```
