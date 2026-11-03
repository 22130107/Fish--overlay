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
});
