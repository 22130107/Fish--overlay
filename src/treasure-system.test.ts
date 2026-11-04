import { describe, expect, it } from "vitest";
import { TreasureSystem } from "./treasure-system";
import { School } from "./school";
import { vec } from "./math";
import { PvpArenaManager } from "./pvp-arena-manager";

describe("TreasureSystem", () => {
  it("spawns a treasure chest", () => {
    const sys = new TreasureSystem();
    const chest = sys.spawnChest(vec(200, 150));
    expect(chest.phase).toBe("active");
    expect(sys.activeChest).toBe(chest);
    expect(chest.position.x).toBe(200);
    expect(chest.position.y).toBe(150);
  });

  it("detects fish collision and awards a gacha reward", () => {
    const sys = new TreasureSystem();
    const school = new School();
    const fish = school.spawnFishForViewer("u1", "Hero", "hero.png");
    const chest = sys.spawnChest(vec(100, 100));

    // Place fish directly at chest position
    fish.position = vec(100, 100);

    sys.update(0.1, school);
    expect(chest.phase).toBe("opened");
    expect(chest.claimedBy?.name).toBe("Hero");
    expect(chest.claimedBy?.reward).toBeDefined();
    expect(["growth", "neon", "shield", "mini"]).toContain(
      chest.claimedBy?.reward.type
    );
  });

  it("sets fish sizeCm to 10cm when mini reward is applied", () => {
    const school = new School();
    const fish = school.spawnFishForViewer("u1", "Hero", "hero.png");
    expect(fish.sizeCm).toBeGreaterThan(15);
    fish.isMiniFish = true;
    fish.miniTimer = 20;
    expect(fish.sizeCm).toBe(10.0);
  });

  it("protects fish with pvp shield from being removed in arena knockout", () => {
    const arena = new PvpArenaManager();
    const school = new School();
    school.spawnFishForViewer("u1", "Fighter1", "f1.png");
    const fish2 = school.spawnFishForViewer("u2", "Fighter2", "f2.png");

    fish2.hasPvPShield = true;

    // Start battle by registering challengers
    arena.registerChallenger("u1", "Fighter1", "f1.png");
    arena.registerChallenger("u2", "Fighter2", "f2.png");
    expect(arena.isActive).toBe(true);

    // Fast-forward summon
    arena.update(3.5, school);
    expect(arena.state.phase).toBe("fighting");

    // Give massive cheer to fighter1 so fighter1 wins
    arena.addCheerPower("u1", 500);
    arena.update(1.0, school);
    expect(arena.state.phase).toBe("knockout");
    expect(arena.state.winnerId).toBe("u1");

    // Fast-forward knockout celebration (3s)
    arena.update(3.5, school);
    expect(arena.state.phase).toBe("idle");

    // Fish 2 should NOT have been removed because of diamond shield!
    const remainingF2 = school.fish.find((f) => f.ownerId === "u2");
    expect(remainingF2).toBeDefined();
    expect(remainingF2?.hasPvPShield).toBe(false); // Shield consumed
  });
});
