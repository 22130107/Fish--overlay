# Biến Hình Hoàng Kim Chân Long (82cm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực hóa biến đổi mô hình cá Koi thành Hoàng Kim Chân Long Á Đông procedurally rendered hoàn chỉnh (sừng rồng, râu rồng dài lướt sóng, bờm lưng lửa, vây móng vuốt và đuôi rồng thần) khi vượt qua Lôi Kiếp 82cm thành công.

**Architecture:**
- `Koi.isDragon` xác định trạng thái Chân Long khi cá vượt mốc 82cm thành công.
- `FishRenderer.drawEasternDragon` dựng hình giải phẫu Chân Long 3D trực tiếp theo chuỗi xương sống (`renderSpine`), vẽ sừng rồng phân nhánh, râu rồng lướt sóng sin, dải bờm lưng lửa, 4 chân móng vuốt và đuôi rồng lửa.
- `LiveClient` và `LightningEffect` kích hoạt hiệu ứng bùng nổ Kim Quang Chói Lòa (`burst flash`) và 3 đợt sóng xung kích mặt nước ngay tại thời khắc biến hình.

**Tech Stack:** TypeScript, Three.js (BufferGeometry / Canvas 2D), Vitest.

## Global Constraints

- Chỉ biến hình thành Chân Long khi mốc tu vi $\ge 82.0$ cm và độ kiếp thành công (`passedTribulation82` hoặc `isDragon`).
- Đầy đủ 5 đặc trưng giải phẫu Chân Long:
  1. Cặp sừng rồng (dragon antlers) có nhánh phụ vươn ra sau gáy.
  2. 2 sợi râu rồng dài (dynamic barbels) vẫy lượn nhịp nhàng theo sóng nước.
  3. Dải bờm vây lưng lửa (flaming dorsal crest) chạy dọc từ gáy tới đuôi.
  4. 4 vây móng vuốt rồng (dragon claws) sắc sảo.
  5. Đuôi rồng rực lửa (flaming tail plume).
- Giữ vững 60 FPS, không dùng file 3D ngoại vi làm chậm stream.

---

### Task 1: Model State & Unit Tests for `isDragon` Property

**Files:**
- Modify: `nagomi/src/koi.ts`
- Create: `nagomi/src/dragon-transformation.test.ts`

**Interfaces:**
- Consumes: `Koi` from `src/koi.ts`
- Produces: `Koi.isDragon: boolean`

- [ ] **Step 1: Write failing unit test in `nagomi/src/dragon-transformation.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { Koi } from "./koi";
import { XorShift32 } from "./random";

describe("Koi isDragon state", () => {
  it("defaults isDragon to false for normal fish", () => {
    const fish = new Koi(0, new XorShift32(1234));
    expect(fish.isDragon).toBe(false);
  });

  it("becomes dragon when passedTribulation82 is true", () => {
    const fish = new Koi(0, new XorShift32(1234));
    fish.passedTribulation82 = true;
    expect(fish.isDragon).toBe(true);
  });

  it("becomes dragon when sizeCm >= 82 and tribulationAura is dragon", () => {
    const fish = new Koi(0, new XorShift32(1234));
    fish.eatCount = 130; // sizeCm = 85cm
    fish.tribulationAura = "dragon";
    expect(fish.isDragon).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nagomi; npx vitest run src/dragon-transformation.test.ts`
Expected: FAIL (property `isDragon` does not exist on `Koi`)

- [ ] **Step 3: Implement `isDragon` in `nagomi/src/koi.ts`**

Add getter in `Koi`:
```typescript
  public get isDragon(): boolean {
    return Boolean(
      this.passedTribulation82 ||
      (this.sizeCm >= 82.0 && this.tribulationAura === "dragon")
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nagomi; npx vitest run src/dragon-transformation.test.ts`
Expected: PASS (3/3 tests passed)

- [ ] **Step 5: Commit**

```bash
cd nagomi
git add src/koi.ts src/dragon-transformation.test.ts
git commit -m "feat: add isDragon state to Koi with unit tests"
```

---

### Task 2: Procedural Eastern Dragon Geometry (`drawEasternDragon`)

**Files:**
- Modify: `nagomi/src/fish-renderer.ts`

**Interfaces:**
- Consumes: `Koi.isDragon`, `GeometryBatch` from `src/fish-renderer.ts`
- Produces: `drawEasternDragon(fish: Koi, appearance: FishAppearance): void`

- [ ] **Step 1: Implement `drawEasternDragon` in `nagomi/src/fish-renderer.ts`**

In `FishRenderer`, add `drawEasternDragon`:
- Head & Branched Horns:
  - Calculate head tangent and normal at node 0.
  - From left and right head crest, extend horn segments backwards at 45 degree angle.
  - Add secondary prongs (`silhouetteTriangle`) in golden/ivory colors (`#fef08a`, `#fbbf24`).
- Dynamic Undulating Whiskers:
  - 2 long barbels from snout (node 0) extending back 5-6 spine steps.
  - Curve modulated by `Math.sin(fish.swimPhase * 1.5 - step * 0.4)`.
  - Draw with thin ribbon triangles or lines.
- Serpentine Body & Golden Scales:
  - Compute `left` and `right` spine points with tapered dragon profile.
  - Triangulate body quads with golden color scheme (`#fbbf24` base, `#d97706` markings).
- Flaming Dorsal Crest (Bờm lưng lửa):
  - Along nodes 1 to 14, at each spine node, draw triangular flame peaks pointing upward and backward:
    `silhouetteTriangle(crestBasePrev, crestTip, crestBaseNext, flameColor)`.
- Dragon Claws (4 Vây móng vuốt):
  - At node 4 (front) and node 9 (back), draw 3-pronged dragon claws with sharp tips.
- Flaming Dragon Tail Plume:
  - At tail node (15), extend 5 undulating flame ribbon triangles fanning out backwards.

- [ ] **Step 2: Connect renderer branch in `drawKoi` / `renderFishBatch`**

In `FishRenderer.renderFishBatch` (or where `this.drawKoi(fish, appearance)` is called):
```typescript
if (fish.isDragon) {
  this.drawEasternDragon(fish, targetAppearance);
} else {
  this.drawKoi(fish, targetAppearance);
}
```

- [ ] **Step 3: Run TypeScript check and Vitest tests**

Run: `cd nagomi; npx tsc --noEmit; npx vitest run`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
cd nagomi
git add src/fish-renderer.ts
git commit -m "feat: implement procedural Eastern Dragon geometry in fish renderer"
```

---

### Task 3: Transformation Burst Effects & Client Integration

**Files:**
- Modify: `nagomi/src/lightning-effect.ts`
- Modify: `nagomi/src/live-client.ts`

**Interfaces:**
- Consumes: `LightningEffect`, `LiveClient.tribulation.onSuccess`
- Produces: Golden burst flash and shockwave ripples at moment of transformation

- [ ] **Step 1: Add `triggerBurstFlash` in `nagomi/src/lightning-effect.ts`**

Add public method:
```typescript
public triggerBurstFlash(): void {
  this.flashAlpha = 0.65; // Bright golden-white screen flash
}
```

- [ ] **Step 2: Update `LiveClient.onSuccess` in `nagomi/src/live-client.ts`**

When tribulation succeeds and `st.targetCm >= 82.0`:
- Set `fish.passedTribulation82 = true;`
- Set `fish.tribulationAura = "dragon";`
- Call `(this.school as any).fishRenderer?.lightning?.triggerBurstFlash?.()` or trigger lightning burst flash.
- Trigger 3 consecutive water ripples around fish position:
  ```typescript
  this.school.ripples.trigger("touch", fish.position);
  setTimeout(() => this.school.ripples.trigger("touch", fish.position), 150);
  setTimeout(() => this.school.ripples.trigger("touch", fish.position), 300);
  ```

- [ ] **Step 3: Run Vitest tests and build check**

Run: `cd nagomi; npx vitest run; npm run build`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
cd nagomi
git add src/lightning-effect.ts src/live-client.ts
git commit -m "feat: add burst transformation flash and shockwave ripples for dragon morph"
```

---

### Task 4: Full Verification & Live Simulator Test

**Files:**
- Test end-to-end functionality

- [ ] **Step 1: Run complete Vitest suite**

Run: `cd nagomi; npx vitest run`
Expected: 9/9 test suites pass

- [ ] **Step 2: Run TypeScript check and production build**

Run: `cd nagomi; npx tsc --noEmit; npm run build`
Expected: 0 errors, build succeeds

- [ ] **Step 3: Verify simulator on `/control`**

Verify that clicking `[🐉 Test Lôi Kiếp 82cm]` followed by `[Thắng Ngay]` transforms the test fish into a majestic Eastern Dragon.
