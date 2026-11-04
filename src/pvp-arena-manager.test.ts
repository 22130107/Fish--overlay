import { describe, expect, it } from "vitest";
import { PvpArenaManager } from "./pvp-arena-manager";
import { School } from "./school";

describe("PvpArenaManager", () => {
  it("initializes in idle phase with no fighters", () => {
    const arena = new PvpArenaManager();
    expect(arena.state.phase).toBe("idle");
    expect(arena.state.fighter1).toBeNull();
    expect(arena.state.fighter2).toBeNull();
    expect(arena.state.waitingChallenger).toBeNull();
  });

  it("queues first challenger when registered", () => {
    const arena = new PvpArenaManager();
    const queued = arena.registerChallenger("user1", "Alice", "alice.png");
    expect(queued).toBe(true);
    expect(arena.state.waitingChallenger?.id).toBe("user1");
    expect(arena.state.phase).toBe("idle");
  });

  it("does not queue the same challenger twice", () => {
    const arena = new PvpArenaManager();
    arena.registerChallenger("user1", "Alice", "alice.png");
    const reQueued = arena.registerChallenger("user1", "Alice", "alice.png");
    expect(reQueued).toBe(false);
    expect(arena.state.phase).toBe("idle");
  });

  it("starts summon phase when second challenger joins", () => {
    const arena = new PvpArenaManager();
    arena.registerChallenger("user1", "Alice", "alice.png");
    const started = arena.registerChallenger("user2", "Bob", "bob.png");

    expect(started).toBe(true);
    expect(arena.state.phase).toBe("summon");
    expect(arena.state.fighter1?.id).toBe("user1");
    expect(arena.state.fighter2?.id).toBe("user2");
    expect(arena.state.waitingChallenger).toBeNull();
    expect(arena.state.timer).toBe(3.0);
  });

  it("transitions from summon to fighting after countdown", () => {
    const arena = new PvpArenaManager();
    arena.registerChallenger("user1", "Alice", "alice.png");
    arena.registerChallenger("user2", "Bob", "bob.png");

    const school = new School();
    arena.update(3.1, school);
    expect(arena.state.phase).toBe("fighting");
    expect(arena.state.timer).toBe(30.0);
  });

  it("boosts cheer power for specific fighter", () => {
    const arena = new PvpArenaManager();
    arena.registerChallenger("user1", "Alice", "alice.png");
    arena.registerChallenger("user2", "Bob", "bob.png");

    arena.addCheerPower("Alice", 10);
    expect(arena.state.fighter1?.score).toBe(10);
    expect(arena.state.fighter2?.score).toBe(0);

    arena.addCheerPower("user2", 15);
    expect(arena.state.fighter2?.score).toBe(15);
  });

  it("handles knockout and crowns the winner", () => {
    const arena = new PvpArenaManager();
    const school = new School();
    const fish1 = school.spawnFishForViewer("user1", "Alice", "alice.png");
    const fish2 = school.spawnFishForViewer("user2", "Bob", "bob.png");

    arena.registerChallenger("user1", "Alice", "alice.png");
    arena.registerChallenger("user2", "Bob", "bob.png");

    // Transition to fighting
    arena.update(3.1, school);
    expect(arena.state.phase).toBe("fighting");

    // Give Alice massive cheer power to push Bob out
    arena.addCheerPower("Alice", 100);
    arena.update(5.0, school);

    expect(arena.state.phase).toBe("knockout");
    expect(arena.state.winnerId).toBe("user1");

    // Knockout animation finishes -> Bob is eaten, Alice is crowned
    arena.update(3.5, school);
    expect(arena.state.phase).toBe("idle");
    expect(arena.state.kingId).toBe("user1");
    expect(arena.state.kingName).toBe("Alice");
    expect((fish1 as any).isKing).toBe(true);
    // Bob's fish should be removed or no longer owned by user2
    const bobFish = school.fish.slice(0, school.count).find((f) => f.ownerId === "user2");
    expect(bobFish).toBeUndefined();
  });
});
