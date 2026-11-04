# Spawn Fish On Comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the TikTok Live Koi Pond interaction logic so that viewers only receive a fish when they comment (chat) or send gifts, rather than automatically upon joining the stream.

**Architecture:** Update `School.spawnFishForViewer` to reuse unowned fish (such as the initial demo fish) before growing the school count. In `LiveClient`, drop fish spawning from the `join` handler and ensure fish creation is reserved for `chat` and `gift`. Update server logging, TTS announcements, and the UI top guidance marquee to reflect that commenting yields a fish and feeds it.

**Tech Stack:** TypeScript, React, Three.js, Vitest, Node.js WebSocket Server.

## Global Constraints
- Only comment (`chat`) and `gift` award fish to viewers.
- Join events (`join`) must not spawn fish or trigger fish creation ripples.
- Pond starts with 1 demo fish (clean pond) in live mode, which gets claimed by the first commenter.
- All existing tests must continue to pass, with new tests verifying unowned fish assignment and join behavior.

---

### Task 1: Unowned Fish Re-use in School & Initial Fish Count

**Files:**
- Modify: `nagomi/src/school.ts`
- Modify: `nagomi/src/app.tsx`
- Test: `nagomi/src/school-spawn.test.ts`

**Interfaces:**
- `School.prototype.spawnFishForViewer(id: string, name: string, avatar?: string): Koi`
  - Consumes: viewer id, name, avatar.
  - Produces: `Koi` instance. If unowned fish exists in `[0, count)`, assigns it without increasing `count`.

- [ ] **Step 1: Write unit tests for unowned fish claiming**
Create `nagomi/src/school-spawn.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { School } from "./school";

describe("School viewer fish assignment", () => {
  it("claims the unowned initial fish before expanding the school", () => {
    const school = new School(1);
    expect(school.count).toBe(1);
    expect(school.fish[0].ownerId).toBeNull();

    const fish1 = school.spawnFishForViewer("u1", "User 1", "av1");
    expect(school.count).toBe(1);
    expect(fish1.ownerId).toBe("u1");
    expect(school.fish[0].ownerId).toBe("u1");

    const fish2 = school.spawnFishForViewer("u2", "User 2", "av2");
    expect(school.count).toBe(2);
    expect(fish2.ownerId).toBe("u2");
  });

  it("returns existing fish if viewer already has one", () => {
    const school = new School(1);
    const fish1 = school.spawnFishForViewer("u1", "User 1");
    const fish1Again = school.spawnFishForViewer("u1", "User 1");
    expect(fish1Again).toBe(fish1);
    expect(school.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**
Run: `npm --prefix nagomi test src/school-spawn.test.ts`
Confirm failure because current `school.ts` increments `this.count` if `this.count < MAX_FISH`.

- [ ] **Step 3: Implement unowned fish re-use in `school.ts` & set initial count in `app.tsx`**
In `nagomi/src/school.ts` `spawnFishForViewer`:
Check for unowned fish among existing fish `0 <= i < this.count`:
```ts
    let targetIndex = -1;
    for (let i = 0; i < this.count; i++) {
      if (!this.fish[i].ownerId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      if (this.count < MAX_FISH) {
        targetIndex = this.count;
        this.count += 1;
      } else {
        let minHunger = Infinity;
        let minIdx = 0;
        for (let i = 0; i < this.count; i++) {
          if (this.fish[i].hungerTimeLeft < minHunger) {
            minHunger = this.fish[i].hungerTimeLeft;
            minIdx = i;
          }
        }
        targetIndex = minIdx;
      }
    }
```
In `nagomi/src/app.tsx` line 522:
Change:
```ts
const school = new School(1);
```
(Initializes pond with 1 fish for both live mode and clean presentation).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix nagomi test src/school-spawn.test.ts`

- [ ] **Step 5: Commit changes**
`git -C nagomi commit -am "feat(school): reuse unowned fish and initialize pond with single fish"`

---

### Task 2: Live Client Event Handling (`live-client.ts`)

**Files:**
- Modify: `nagomi/src/live-client.ts`

**Interfaces:**
- `LiveClient`: WebSocket message dispatcher handling `"join"`, `"chat"`, `"gift"`, `"share"`, `"follow"`.

- [ ] **Step 1: Update `live-client.ts` handlers**
1. In `case "join"`:
   - Remove fish spawning:
   ```ts
   case "join": {
     // Viewers entering the room no longer automatically spawn a fish.
     // They must comment (chat) or send gifts to receive a fish.
     break;
   }
   ```
2. In `this.school.onViewerSpawned`:
   - Update event alert:
   ```ts
   this.school.onViewerSpawned = (name) => {
     this.pushEventAlert(`✨ ${name} đã bình luận và nhận 1 chú cá Koi!`, "spawn");
   };
   ```
3. In `case "share"`:
   - Remove fish spawning if viewer doesn't have a fish. Only feed/boost if `fish` already exists:
   ```ts
   case "share": {
     const id = msg.id || msg.user;
     const name = msg.user || "Khán giả";
     const avatar = msg.avatar || "";
     let fish = this.school.fish
       .slice(0, this.school.count)
       .find((f) => f.ownerId === id || (f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase()));
     if (fish) {
       fish.hunger = 100;
       fish.hungerTimeLeft = fish.maxHungerTime;
       fish.state = 3;
       this.refreshFishNameTimer(id, name);
     }
     this.pushEventAlert(`🚀 ${name} vừa chia sẻ phiên Live!`, "info");
     for (let i = 0; i < 5; i++) {
       const rx = 40 + Math.random() * (CANVAS_WIDTH - 80);
       const ry = 40 + Math.random() * (CANVAS_HEIGHT - 80);
       this.foodSystem.spawn(vec(rx, ry), name, avatar);
     }
     this.school.callTo(vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5));
     break;
   }
   ```
4. In `case "follow"`:
   - Remove fish spawning if viewer doesn't have a fish:
   ```ts
   case "follow": {
     const id = msg.id || msg.user;
     const name = msg.user || "Khán giả";
     let fish = this.school.fish
       .slice(0, this.school.count)
       .find((f) => f.ownerId === id || (f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase()));
     if (fish) {
       fish.hunger = 100;
       fish.hungerTimeLeft = fish.maxHungerTime;
       this.refreshFishNameTimer(id, name);
     }
     this.pushEventAlert(`❤️ ${name} vừa theo dõi kênh!`, "info");
     break;
   }
   ```

- [ ] **Step 2: Run all tests to make sure no regressions**
Run: `npm --prefix nagomi test`

- [ ] **Step 3: Commit changes**
`git -C nagomi commit -am "feat(live): only spawn fish when commenting or gifting, not joining"`

---

### Task 3: Server & Control Panel Updates (`server.mjs` & `control.html`)

**Files:**
- Modify: `nagomi/live-server/server.mjs`
- Modify: `nagomi/live-server/control.html`

- [ ] **Step 1: Update `server.mjs` logging & TTS**
1. In `handleJoin`:
   - Change log: `addLog(`👋 ${name} đã vào phòng Live!`);`
   - Change TTS welcome: `say(`Chào mừng ${spokenName} đã vào xem live!`, { tag: 'join', id, user: name });`
2. In `handleShare`:
   - Remove `handleJoin(id, name, avatar, false);`.
3. In `handleFollow`:
   - Remove `handleJoin(id, name, avatar, false);`.

- [ ] **Step 2: Update `control.html` button labels**
1. Change button:
   `<button class="secondary" onclick="testNewUserFish()">👤 Người mới vào xem (Chào mừng)</button>`
2. Change description / comment test button:
   `<button class="primary" onclick="testChat()">💬 Khán giả bình luận (Cấp cá & Cho ăn)</button>`

- [ ] **Step 3: Commit changes**
`git -C nagomi commit -am "feat(server): update join TTS greeting and control panel labels"`

---

### Task 4: UI Guidance Marquee & Build Verification

**Files:**
- Modify: `nagomi/src/components/live-overlay.tsx`

- [ ] **Step 1: Update guidance marquee in `live-overlay.tsx`**
In both standard and aria-hidden tracks:
Replace:
```tsx
<span>🥖 <b>Bình luận: Cho ăn</b></span>
<span className="sep">•</span>
<span>👋 <b>Vào xem: Nhận cá</b></span>
```
With:
```tsx
<span>💬 <b>Bình luận: Nhận cá & Cho ăn</b></span>
```

- [ ] **Step 2: Run all unit tests**
Run: `npm --prefix nagomi test`

- [ ] **Step 3: Build application to verify compilation**
Run: `npm --prefix nagomi run build`

- [ ] **Step 4: Commit changes**
`git -C nagomi commit -am "feat(ui): update top guidance marquee for comment to spawn fish"`
