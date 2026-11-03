import { describe, it, expect, vi } from "vitest";
import { TribulationManager } from "./tribulation-manager";

describe("TribulationManager", () => {
  it("initializes with idle state", () => {
    const manager = new TribulationManager();
    expect(manager.state.active).toBe(false);
  });

  it("starts tribulation with correct parameters for 72cm", () => {
    const manager = new TribulationManager();
    manager.start("fish_1", "NguyenVanA", "avatar.jpg", 72.0);

    expect(manager.state.active).toBe(true);
    expect(manager.state.targetFishId).toBe("fish_1");
    expect(manager.state.ownerName).toBe("NguyenVanA");
    expect(manager.state.ownerAvatar).toBe("avatar.jpg");
    expect(manager.state.targetCm).toBe(72.0);
    expect(manager.state.targetRealm).toBe("Độ Kiếp Kỳ");
    expect(manager.state.requiredPower).toBe(40);
    expect(manager.state.timeLeft).toBe(30.0);
    expect(manager.state.result).toBe("ongoing");
  });

  it("starts tribulation with 60 required power for 82cm", () => {
    const manager = new TribulationManager();
    manager.start("fish_2", "TranVanB", "avatar2.jpg", 82.0);
    expect(manager.state.requiredPower).toBe(60);
    expect(manager.state.targetRealm).toBe("Phi Thăng Hóa Long");
  });

  it("accumulates power from comments, likes, and gifts", () => {
    const manager = new TribulationManager();
    manager.start("fish_1", "NguyenVanA", "", 72.0);

    manager.addPower("chat", "Viewer1", 1);
    manager.addPower("like", "Viewer2", 2);
    manager.addPower("gift", "TopDonor", 25);

    expect(manager.state.currentPower).toBe(28);
    const top = manager.getTopContributors();
    expect(top[0].name).toBe("TopDonor");
    expect(top[0].power).toBe(25);
  });

  it("triggers victory immediately when required power is reached", () => {
    const manager = new TribulationManager();
    const onSuccess = vi.fn();
    manager.onSuccess = onSuccess;

    manager.start("fish_1", "NguyenVanA", "", 72.0);
    manager.addPower("gift", "Sponsor", 40);

    expect(manager.state.active).toBe(false);
    expect(manager.state.result).toBe("success");
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFishId: "fish_1",
        ownerName: "NguyenVanA",
        result: "success",
      })
    );
  });

  it("triggers failure when 30 seconds expire without enough power", () => {
    const manager = new TribulationManager();
    const onFail = vi.fn();
    manager.onFail = onFail;

    manager.start("fish_1", "NguyenVanA", "", 72.0);
    manager.addPower("chat", "Viewer1", 10);
    manager.update(30.1);

    expect(manager.state.active).toBe(false);
    expect(manager.state.result).toBe("failed");
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFishId: "fish_1",
        ownerName: "NguyenVanA",
        result: "failed",
      })
    );
  });

  it("ignores addPower and update when tribulation is inactive", () => {
    const manager = new TribulationManager();
    const onProgress = vi.fn();
    manager.onProgress = onProgress;

    manager.addPower("chat", "Viewer1", 10);
    expect(manager.state.currentPower).toBe(0);
    expect(onProgress).not.toHaveBeenCalled();

    manager.update(10);
    expect(manager.state.timeLeft).toBe(30.0);
  });

  it("aggregates power for same contributor case-insensitively and returns top N", () => {
    const manager = new TribulationManager();
    manager.start("fish_1", "NguyenVanA", "", 72.0);

    manager.addPower("chat", "ViewerA", 5);
    manager.addPower("like", "viewera", 3);
    manager.addPower("gift", "ViewerB", 10);
    manager.addPower("chat", "ViewerC", 2);
    manager.addPower("gift", "ViewerD", 15);

    const top2 = manager.getTopContributors(2);
    expect(top2).toHaveLength(2);
    expect(top2[0].name).toBe("ViewerD");
    expect(top2[0].power).toBe(15);
    expect(top2[1].name).toBe("ViewerB");
    expect(top2[1].power).toBe(10);

    const allContributors = manager.getTopContributors(10);
    const contA = allContributors.find((c) => c.name.toLowerCase() === "viewera");
    expect(contA?.power).toBe(8);
  });

  it("fires onStart and onProgress callbacks", () => {
    const manager = new TribulationManager();
    const onStart = vi.fn();
    const onProgress = vi.fn();
    manager.onStart = onStart;
    manager.onProgress = onProgress;

    manager.start("fish_3", "TestOwner", "test.png", 75.0);
    expect(onStart).toHaveBeenCalledTimes(1);

    manager.addPower("chat", "UserX", 5);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ currentPower: 5 }));
  });
});
