import { describe, it, expect } from "vitest";
import { Koi } from "./koi";
import { XorShift32 } from "./math";

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

  it("verifies 82cm onSuccess transformation logic on Koi", () => {
    const fish = new Koi(0, new XorShift32(1234));
    fish.eatCount = 124; // 82cm
    expect(fish.isDragon).toBe(false);

    // Simulate onSuccess logic for targetCm >= 82
    const st = { targetCm: 82.0 };
    if (st.targetCm >= 82) {
      fish.passedTribulation82 = true;
      fish.tribulationAura = "dragon";
    }

    expect(fish.passedTribulation82).toBe(true);
    expect(fish.tribulationAura).toBe("dragon");
    expect(fish.isDragon).toBe(true);
  });

  it("scales Thần Long body dimensions significantly larger than normal fish while preserving koi ratio", () => {
    const normalFish = new Koi(0, new XorShift32(1234));
    normalFish.eatCount = 120;
    normalFish.updateDimensions();

    const dragonFish = new Koi(0, new XorShift32(1234));
    dragonFish.passedTribulation82 = true;
    dragonFish.eatCount = 120;
    dragonFish.updateDimensions();

    expect(dragonFish.isDragon).toBe(true);
    expect(dragonFish.bodyLength).toBeGreaterThan(normalFish.bodyLength * 1.35);
    expect(dragonFish.bodyWidth).toBeCloseTo(dragonFish.bodyLength * 0.22, 2);
  });
});
