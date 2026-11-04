# Fish Username Visibility Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide fish viewer username nametags 5 seconds after spawning, showing only the avatar and size badge, and re-display the username for 5 seconds whenever that viewer interacts.

**Architecture:** Add a `nameVisibleTimer` property to `Koi`, initialized to `5.0` on spawn, decremented each frame in `School.update(dt)`. Refresh `nameVisibleTimer = 5.0` on viewer chat, gift, or like in `LiveClient`. Render `fish.ownerName` in `LiveOverlay` conditionally when `nameVisibleTimer > 0` with smooth CSS transition.

**Tech Stack:** TypeScript, Three.js, React 19, Vitest, Vite

## Global Constraints

- Preserve all existing comments and docstrings unrelated to this change.
- Keep `fish.ownerName` and `fish.ownerAvatar` intact on the `Koi` instance.
- Only hide the username text in the fish floating nametag pill; keep avatar and size badge visible.
- Full type-check and Vitest test suite must pass without warnings or errors.

---

### Task 1: Model & School Timer Logic with Unit Tests

**Files:**
- Create: `nagomi/src/fish-name-visibility.test.ts`
- Modify: `nagomi/src/koi.ts:50-70`, `nagomi/src/koi.ts:150-170`
- Modify: `nagomi/src/school.ts:80-95`, `nagomi/src/school.ts:106-120`, `nagomi/src/school.ts:255-275`

**Interfaces:**
- Consumes: `Koi` class and `School` class from `src/koi.ts` and `src/school.ts`
- Produces: `fish.nameVisibleTimer: number` on `Koi`, updated in `School.update(dt)`

- [ ] **Step 1: Write the failing unit tests for `nameVisibleTimer`**

Create `nagomi/src/fish-name-visibility.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { Koi } from "./koi";
import { School } from "./school";
import { Vec2 } from "./math";

describe("Fish Name Visibility Timer", () => {
  it("initializes nameVisibleTimer to 0 on Koi instance", () => {
    const koi = new Koi(0, 18, 18 * 0.22, 100, 100, 1);
    expect(koi.nameVisibleTimer).toBe(0);
  });

  it("sets nameVisibleTimer to 5.0 when spawning fish for viewer", () => {
    const fakeRipples = { trigger: () => {} } as any;
    const fakeFood = {} as any;
    const school = new School(fakeRipples, fakeFood);
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");

    expect(fish.ownerId).toBe("viewer_123");
    expect(fish.ownerName).toBe("ViewerName");
    expect(fish.nameVisibleTimer).toBe(5.0);
  });

  it("decrements nameVisibleTimer in school.update(dt) and caps at 0", () => {
    const fakeRipples = { trigger: () => {} } as any;
    const fakeFood = {} as any;
    const school = new School(fakeRipples, fakeFood);
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");

    expect(fish.nameVisibleTimer).toBe(5.0);

    school.update(2.0, false);
    expect(fish.nameVisibleTimer).toBeCloseTo(3.0);

    school.update(4.0, false);
    expect(fish.nameVisibleTimer).toBe(0);
  });

  it("resets nameVisibleTimer to 0 on reset and removeFish", () => {
    const fakeRipples = { trigger: () => {} } as any;
    const fakeFood = {} as any;
    const school = new School(fakeRipples, fakeFood);
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");
    expect(fish.nameVisibleTimer).toBe(5.0);

    school.removeFish(0);
    expect(fish.nameVisibleTimer).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fish-name-visibility.test.ts`
Expected: FAIL due to `nameVisibleTimer` undefined on `Koi`.

- [ ] **Step 3: Implement `nameVisibleTimer` in `Koi` and `School`**

In `nagomi/src/koi.ts`:
- Add `public nameVisibleTimer = 0;` alongside `sizeAlertTimer`.
- In `reset()`: add `this.nameVisibleTimer = 0;`.

In `nagomi/src/school.ts`:
- In `spawnFishForViewer()`: set `fish.nameVisibleTimer = 5.0;`.
- In `removeFish()`: set `removedFish.nameVisibleTimer = 0;`.
- In `update(dt)`:
```typescript
if (fish.nameVisibleTimer > 0) {
  fish.nameVisibleTimer = Math.max(0, fish.nameVisibleTimer - dt);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/fish-name-visibility.test.ts`
Expected: PASS (4 tests passing)

- [ ] **Step 5: Commit**

```bash
git add src/koi.ts src/school.ts src/fish-name-visibility.test.ts
git commit -m "feat(fish): add nameVisibleTimer to Koi and decrement in school update"
```

---

### Task 2: Live Client Event Handling to Refresh Name Timer

**Files:**
- Modify: `nagomi/src/live-client.ts:100-500`
- Modify: `nagomi/src/fish-name-visibility.test.ts`

**Interfaces:**
- Consumes: `school.fish` array, `fish.nameVisibleTimer`
- Produces: `refreshFishNameTimer(id: string, name?: string): void` in `LiveClient`

- [ ] **Step 1: Write unit tests verifying timer refresh on interactions**

Add test cases to `nagomi/src/fish-name-visibility.test.ts`:
```typescript
  it("refreshes nameVisibleTimer to 5.0 when refreshFishNameTimer is called", () => {
    const fakeRipples = { trigger: () => {} } as any;
    const fakeFood = {} as any;
    const school = new School(fakeRipples, fakeFood);
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");
    fish.nameVisibleTimer = 1.0;

    // Simulate interaction refresh
    const target = school.fish.slice(0, school.count).find(f => f.ownerId === "viewer_123");
    if (target) target.nameVisibleTimer = 5.0;

    expect(fish.nameVisibleTimer).toBe(5.0);
  });
```

- [ ] **Step 2: Implement `refreshFishNameTimer` in `LiveClient`**

In `nagomi/src/live-client.ts`:
Add helper method:
```typescript
private refreshFishNameTimer(id?: string, name?: string): void {
  if (!id && !name) return;
  const targetFish = this.school.fish
    .slice(0, this.school.count)
    .find(
      (f) =>
        (id && f.ownerId === id) ||
        (name && f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase())
    );
  if (targetFish) {
    targetFish.nameVisibleTimer = 5.0;
  }
}
```

Call `this.refreshFishNameTimer(id, name)` in:
- `handleChat`: when viewer chats or enters commands.
- `handleGift`: when viewer gives gifts.
- `handleLike`: when viewer likes / feeds.

- [ ] **Step 3: Run all unit tests**

Run: `npm test --prefix nagomi`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/live-client.ts src/fish-name-visibility.test.ts
git commit -m "feat(live): refresh fish nameVisibleTimer on viewer interactions"
```

---

### Task 3: Live Overlay Conditional Rendering & Smooth CSS Transition

**Files:**
- Modify: `nagomi/src/components/live-overlay.tsx:195-235`
- Modify: `nagomi/src/styles.css:1772-1825`

**Interfaces:**
- Consumes: `fish.nameVisibleTimer`
- Produces: Conditionally rendered `<span className="fish-owner-name">` when `fish.nameVisibleTimer > 0`

- [ ] **Step 1: Update `live-overlay.tsx`**

In `nagomi/src/components/live-overlay.tsx`, update the owner pill rendering:
```tsx
{/* Owner Avatar & Name Pill */}
<div className={`fish-owner-pill ${isDanger ? "pill-danger" : ""}`}>
  {fish.ownerAvatar ? (
    <img
      src={fish.ownerAvatar}
      alt=""
      className="fish-owner-avatar"
    />
  ) : (
    <div className="fish-owner-avatar-fallback">
      {fish.ownerName ? fish.ownerName[0].toUpperCase() : "C"}
    </div>
  )}
  {fish.nameVisibleTimer > 0 && (
    <span className="fish-owner-name">{fish.ownerName}</span>
  )}
  {fish.isDragon ? (
    <span
      className="fish-size-pill dragon-tag"
      style={{
        background: "linear-gradient(135deg, #f59e0b, #ef4444)",
        color: "#fff",
        borderColor: "#fbbf24",
        boxShadow: "0 0 8px rgba(245, 158, 11, 0.7)",
        fontWeight: 700,
      }}
    >
      🐉 {fish.sizeCm}cm • Chân Long
    </span>
  ) : (
    <span
      className="fish-size-pill tu-tien-tag"
      style={{ borderColor: fish.tuTien.auraColor }}
    >
      {fish.sizeCm}cm
    </span>
  )}
</div>
```

- [ ] **Step 2: Add smooth transitions in `styles.css`**

In `nagomi/src/styles.css`:
Update `.fish-owner-pill` and `.fish-owner-name`:
```css
.fish-owner-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(15, 23, 42, 0.88);
  border: 1.5px solid rgba(16, 185, 129, 0.6);
  padding: 2px 7px 2px 4px;
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  transition: border-color 0.2s, background 0.2s, padding 0.25s ease;
}

.fish-owner-name {
  font-size: 11px;
  font-weight: 600;
  color: #f8fafc;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  animation: fade-in-name 0.25s ease-out;
}

@keyframes fade-in-name {
  from {
    opacity: 0;
    max-width: 0;
  }
  to {
    opacity: 1;
    max-width: 70px;
  }
}
```

- [ ] **Step 3: Verify build and tests**

Run:
`npm test --prefix nagomi`
`npm run build --prefix nagomi`
Expected: Build succeeds with 0 TypeScript errors and tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/live-overlay.tsx src/styles.css
git commit -m "feat(ui): conditionally render fish username with smooth transition"
```
