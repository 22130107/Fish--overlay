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
