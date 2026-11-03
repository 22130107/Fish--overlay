# Remove Realm From Nametag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove cultivation realm name from fish nametag pill, leaving only size (cm) next to the viewer's name.

**Architecture:** Update `LiveOverlay` component in `src/components/live-overlay.tsx` to render `{fish.sizeCm}cm` inside `span.fish-size-pill.tu-tien-tag` instead of `{fish.tuTien.badge} {fish.tuTien.realm} • {fish.sizeCm}cm`.

**Tech Stack:** React, TypeScript, Vite.

## Global Constraints
- Only modify nametag rendering; preserve floating "soi tu vi" popup and audio announcements.
- Maintain existing `borderColor: fish.tuTien.auraColor` styling.

---

### Task 1: Update Nametag in LiveOverlay

**Files:**
- Modify: `src/components/live-overlay.tsx:99-105`

**Interfaces:**
- Consumes: `fish.sizeCm` (number), `fish.tuTien.auraColor` (string)
- Produces: Updated JSX element displaying `{fish.sizeCm}cm`

- [ ] **Step 1: Update `src/components/live-overlay.tsx`**

Replace:
```tsx
                <span
                  className="fish-size-pill tu-tien-tag"
                  style={{ borderColor: fish.tuTien.auraColor }}
                >
                  {fish.tuTien.badge} {fish.tuTien.realm} • {fish.sizeCm}cm
                </span>
```
With:
```tsx
                <span
                  className="fish-size-pill tu-tien-tag"
                  style={{ borderColor: fish.tuTien.auraColor }}
                >
                  {fish.sizeCm}cm
                </span>
```

- [ ] **Step 2: Verify build and test suite**

Run: `npm run build` and `npm test`
Expected: Build passes with 0 errors and all unit tests pass.

- [ ] **Step 3: Commit changes**

```bash
git add src/components/live-overlay.tsx
git commit -m "fix: remove cultivation realm name from fish nametag"
```
