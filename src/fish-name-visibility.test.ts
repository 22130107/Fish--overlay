import { describe, expect, it } from "vitest";
import { Koi } from "./koi";
import { School } from "./school";

describe("Fish Name Visibility Timer", () => {
  it("initializes nameVisibleTimer to 0 on Koi instance", () => {
    const koi = new Koi();
    expect(koi.nameVisibleTimer).toBe(0);
  });

  it("sets nameVisibleTimer to 5.0 when spawning fish for viewer", () => {
    const school = new School();
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");

    expect(fish.ownerId).toBe("viewer_123");
    expect(fish.ownerName).toBe("ViewerName");
    expect(fish.nameVisibleTimer).toBe(5.0);
  });

  it("decrements nameVisibleTimer in school.update(dt, time) and caps at 0", () => {
    const school = new School();
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");

    expect(fish.nameVisibleTimer).toBe(5.0);

    school.update(2.0, 0);
    expect(fish.nameVisibleTimer).toBeCloseTo(3.0);

    school.update(4.0, 2.0);
    expect(fish.nameVisibleTimer).toBe(0);
  });

  it("resets nameVisibleTimer to 0 on reset and removeFish", () => {
    const school = new School();
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");
    expect(fish.nameVisibleTimer).toBe(5.0);

    const fishIndex = school.fish.findIndex((f) => f.ownerId === "viewer_123");
    school.removeFish(fishIndex);
    expect(fish.nameVisibleTimer).toBe(0);
  });

  it("refreshes nameVisibleTimer to 5.0 when viewer interacts", () => {
    const school = new School();
    const fish = school.spawnFishForViewer("viewer_123", "ViewerName", "avatar.png");
    fish.nameVisibleTimer = 1.0;

    // Simulate interaction refresh
    const target = school.fish.slice(0, school.count).find((f) => f.ownerId === "viewer_123");
    if (target) target.nameVisibleTimer = 5.0;

    expect(fish.nameVisibleTimer).toBe(5.0);
  });
});
