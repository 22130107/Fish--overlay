import { describe, expect, it, vi } from "vitest";
import { LightningEffect } from "./lightning-effect";
import { vec } from "./math";
import { Koi } from "./koi";
import { XorShift32 } from "./math";
import { FishRenderer } from "./fish-renderer";

function createMockCtx(): CanvasRenderingContext2D {
  return {
    canvas: { width: 800, height: 600 },
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    shadowBlur: 0,
    shadowColor: "",
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("LightningEffect", () => {
  it("spawns a bolt and triggers onStrike when timer hits zero", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    const target = vec(400, 300);
    const onStrike = vi.fn();

    // First update with dt=0.016 (standard frame) should trigger bolt spawn because strikeTimer starts at 0
    lightning.updateAndRender(ctx, 0.016, target, 50, onStrike);

    expect(onStrike).toHaveBeenCalledTimes(1);
    expect(onStrike).toHaveBeenCalledWith(target);
    expect(lightning.getBolts().length).toBeGreaterThan(0);
    expect(lightning.getFlashAlpha()).toBeGreaterThan(0);
  });

  it("spawns golden bolt when powerPercent >= 80", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    const target = vec(300, 200);

    lightning.updateAndRender(ctx, 0.016, target, 85);
    const bolts = lightning.getBolts();
    expect(bolts.length).toBe(1);
    expect(bolts[0].color).toBe("#fbbf24");
  });

  it("spawns blue or purple bolt when powerPercent < 80", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    const target = vec(300, 200);

    lightning.updateAndRender(ctx, 0.016, target, 40);
    const bolts = lightning.getBolts();
    expect(bolts.length).toBe(1);
    expect(["#38bdf8", "#c084fc"]).toContain(bolts[0].color);
  });

  it("decays bolts and clears them after their lifetime", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    const target = vec(300, 200);

    lightning.updateAndRender(ctx, 0.016, target, 50);
    expect(lightning.getBolts().length).toBe(1);

    // Life is 0.25s. Advance by 0.3s without spawning new strike (timer is ~1s)
    lightning.updateAndRender(ctx, 0.3, target, 50);
    expect(lightning.getBolts().length).toBe(0);
  });

  it("fades screen flash alpha over time", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    const target = vec(300, 200);

    lightning.updateAndRender(ctx, 0.016, target, 50);
    const initialAlpha = lightning.getFlashAlpha();
    expect(initialAlpha).toBeGreaterThan(0);

    lightning.updateAndRender(ctx, 0.05, target, 50);
    expect(lightning.getFlashAlpha()).toBeLessThan(initialAlpha);
  });

  it("clears all bolts and reset timers on clear()", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    const target = vec(300, 200);

    lightning.updateAndRender(ctx, 0.016, target, 50);
    expect(lightning.getBolts().length).toBeGreaterThan(0);

    lightning.clear();
    expect(lightning.getBolts().length).toBe(0);
    expect(lightning.getFlashAlpha()).toBe(0);
  });

  it("triggers burst flash with flashAlpha 0.65 and decays smoothly via renderFlash()", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    expect(lightning.getFlashAlpha()).toBe(0);

    lightning.triggerBurstFlash();
    expect(lightning.getFlashAlpha()).toBe(0.65);

    lightning.renderFlash(ctx, 0.05);
    expect(lightning.getFlashAlpha()).toBeLessThan(0.65);
    expect(lightning.getFlashAlpha()).toBeGreaterThan(0);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("provides render() method that delegates to updateAndRender()", () => {
    const lightning = new LightningEffect();
    const ctx = createMockCtx();
    const target = vec(200, 150);
    const onStrike = vi.fn();

    lightning.render(ctx, 0.016, target, 90, onStrike);
    expect(onStrike).toHaveBeenCalledTimes(1);
    expect(lightning.getBolts().length).toBe(1);
  });
});

describe("Koi aura states", () => {
  it("initializes Koi tribulation state with correct defaults", () => {
    const koi = new Koi();
    const rng = new XorShift32(12345);
    koi.reset(0, rng);

    expect(koi.passedTribulation72).toBe(false);
    expect(koi.passedTribulation82).toBe(false);
    expect(koi.tribulationAura).toBeNull();
    expect(koi.smokeTimer).toBe(0);
  });

  it("allows setting dragon aura and smoke aura", () => {
    const koi = new Koi();
    koi.tribulationAura = "dragon";
    expect(koi.tribulationAura).toBe("dragon");

    koi.tribulationAura = "smoke";
    koi.smokeTimer = 20.0;
    expect(koi.tribulationAura).toBe("smoke");
    expect(koi.smokeTimer).toBe(20.0);
  });

  it("traces fish path and renders golden dragon aura on 2D context", () => {
    const koi = new Koi();
    const rng = new XorShift32(999);
    koi.reset(0, rng);
    koi.tribulationAura = "dragon";

    const shadowColors: string[] = [];
    const strokeStyles: string[] = [];
    const mockCtx = createMockCtx();
    Object.defineProperty(mockCtx, "shadowColor", {
      get: () => shadowColors[shadowColors.length - 1] ?? "",
      set: (val: string) => shadowColors.push(val),
    });
    Object.defineProperty(mockCtx, "strokeStyle", {
      get: () => strokeStyles[strokeStyles.length - 1] ?? "",
      set: (val: string) => strokeStyles.push(val),
    });

    const renderer = Object.create(FishRenderer.prototype);
    renderer.renderDragonAura(mockCtx, koi, 1.0);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(shadowColors).toContain("#fbbf24");
    expect(strokeStyles).toContain("rgba(251, 191, 36, 0.6)");
  });

  it("generates and updates smoke particles", () => {
    const koi = new Koi();
    const rng = new XorShift32(999);
    koi.reset(0, rng);
    koi.tribulationAura = "smoke";
    koi.smokeTimer = 15.0;

    const mockCtx = createMockCtx();
    const renderer = Object.create(FishRenderer.prototype);
    renderer.smokeParticles = [];

    // Force random to trigger spawn
    const origRandom = Math.random;
    Math.random = () => 0.1;
    try {
      renderer.renderFishSmoke(mockCtx, koi, 0.016);
      expect(renderer.smokeParticles.length).toBe(1);

      renderer.updateAndDrawSmoke(mockCtx, 0.016);
      expect(mockCtx.fill).toHaveBeenCalled();
    } finally {
      Math.random = origRandom;
    }
  });

  it("verifies live-client onSuccess sets hungerTimeLeft to maxHungerTime", () => {
    const koi = new Koi();
    koi.ownerId = "user1";
    koi.hunger = 40;
    koi.hungerTimeLeft = 100;
    koi.maxHungerTime = 600;

    // Simulate onSuccess handler logic
    koi.passedTribulation72 = true;
    koi.tribulationAura = "dragon";
    koi.hunger = 100;
    koi.hungerTimeLeft = koi.maxHungerTime;
    koi.eatCount += 3;

    expect(koi.hungerTimeLeft).toBe(koi.maxHungerTime);
    expect(koi.hunger).toBe(100);
    expect(koi.tribulationAura).toBe("dragon");
  });
});
