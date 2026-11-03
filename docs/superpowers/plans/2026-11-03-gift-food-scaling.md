# Gift Food Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scale the number of food pellets dropped when viewers send gifts (10 to 60 pellets based on gift value/count) and optimize display to keep the screen clean.

**Architecture:** Extend `FoodSystem` with `showTag?: boolean` parameter and higher capacity (120 pellets). Update `LiveOverlay` to only render donor tags on pellets where `showTag !== false`. Update `LiveClient` gift handler to compute pellet count from coins/count and spawn pellets across the pond.

**Tech Stack:** TypeScript, React, Vite.

## Global Constraints
- Preserve existing food physics and consumption logic in `FoodSystem`.
- Backward compatible with regular chat feed (which defaults to `showTag: true`).

---

### Task 1: Update FoodSystem with showTag and higher pellet limit

**Files:**
- Modify: `src/food-system.ts:5-45`

**Interfaces:**
- Consumes: `Vec2`
- Produces: `FoodPellet.showTag?: boolean`, `FoodSystem.spawn(point, user, avatar?, showTag?)`

- [x] **Step 1: Update `src/food-system.ts`**

Update `FoodPellet`:
```typescript
export interface FoodPellet {
  id: number;
  position: Vec2;
  user: string;
  avatar?: string;
  life: number;
  maxLife: number;
  size: number;
  eaten: boolean;
  showTag?: boolean;
}
```

Update `spawn` method:
```typescript
  public spawn(point: Vec2, user: string, avatar?: string, showTag = true): FoodPellet {
    const pellet: FoodPellet = {
      id: this.nextId++,
      position: {
        x: Math.max(20, Math.min(CANVAS_WIDTH - 20, point.x)),
        y: Math.max(20, Math.min(CANVAS_HEIGHT - 20, point.y)),
      },
      user: user || "Người xem",
      avatar,
      life: 18.0,
      maxLife: 18.0,
      size: 3.5,
      eaten: false,
      showTag,
    };
    this.pellets.push(pellet);
    if (this.pellets.length > 120) this.pellets.shift();
    return pellet;
  }
```

- [x] **Step 2: Verify tests compile and pass**

Run: `npm test`

---

### Task 2: Update LiveOverlay to respect showTag

**Files:**
- Modify: `src/components/live-overlay.tsx:180-188`

**Interfaces:**
- Consumes: `FoodPellet.showTag`
- Produces: Cleaner pellet rendering without overlapping username tags

- [x] **Step 1: Update `src/components/live-overlay.tsx`**

Replace:
```tsx
              <div className="food-dot" />
              <div className="food-user-tag">🥖 {pellet.user}</div>
```
With:
```tsx
              <div className="food-dot" />
              {pellet.showTag !== false && (
                <div className="food-user-tag">🥖 {pellet.user}</div>
              )}
```

- [x] **Step 2: Verify tests and build**

Run: `npm test && npm run build`

---

### Task 3: Update LiveClient gift handler to scale food drops

**Files:**
- Modify: `src/live-client.ts:276-292`

**Interfaces:**
- Consumes: `msg.coins`, `msg.count`, `msg.user`, `msg.avatar`
- Produces: Dynamic pellets spawn (10 to 60) across pond with `showTag: i < 3`

- [x] **Step 1: Update `src/live-client.ts` in `case "gift":`**

Replace:
```typescript
      case "gift": {
        // Spawn multiple food pellets (a feast)
        for (let i = 0; i < Math.min(msg.count * 2, 8); i++) {
          const rx = 40 + Math.random() * (CANVAS_WIDTH - 80);
          const ry = 40 + Math.random() * (CANVAS_HEIGHT - 80);
          const point = vec(rx, ry);
          this.foodSystem.spawn(point, msg.user, msg.avatar);
        }

        // Call all fish to feast
        this.school.callTo(vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5));
```
With:
```typescript
      case "gift": {
        const coins = Math.max(1, msg.coins || 1);
        const count = Math.max(1, msg.count || 1);
        const pelletCount = Math.min(60, Math.max(10, Math.floor(coins * 1.5) + count * 2));

        for (let i = 0; i < pelletCount; i++) {
          const rx = 30 + Math.random() * (CANVAS_WIDTH - 60);
          const ry = 30 + Math.random() * (CANVAS_HEIGHT - 60);
          const point = vec(rx, ry);
          this.foodSystem.spawn(point, msg.user, msg.avatar, i < 3);
          if (i % 5 === 0) {
            this.school.ripples.trigger("touch", point);
          }
        }

        // Call all fish to feast
        this.school.callTo(vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5));
```

- [x] **Step 2: Verify full build and test suite**

Run: `npm run build && npm test`
Expected: 0 errors, all tests pass.

- [x] **Step 3: Commit implementation**

```bash
git add src/food-system.ts src/components/live-overlay.tsx src/live-client.ts
git commit -m "feat: scale gift food drops from 10 to 60 pellets based on gift value"
```
