import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LiveClient } from "./live-client";

describe("LiveClient Dragon Lightning Handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should trigger lightning bolt, flash, ripples, scatter and alert on dragon_lightning message", () => {
    const mockRipples = { trigger: vi.fn() };
    const mockFishRenderer = {
      lightning: {
        triggerBurstFlash: vi.fn(),
        spawnBolt: vi.fn(),
      },
    };
    const mockSchool = {
      fish: [
        {
          ownerId: "user_dragon",
          ownerName: "Lâm Động",
          position: { x: 300, y: 400 },
          tribulationAura: "dragon",
        },
      ],
      count: 1,
      ripples: mockRipples,
      scatter: vi.fn(),
      fishRenderer: mockFishRenderer,
    };
    const mockFoodSystem = { spawn: vi.fn() };

    const client = new LiveClient(mockSchool as any, mockFoodSystem as any);
    const pushAlertSpy = vi.spyOn(client, "pushEventAlert");

    (client as any).handleWsMessage(
      JSON.stringify({
        t: "dragon_lightning",
        user: "Lâm Động",
        id: "user_dragon",
      })
    );

    expect(mockFishRenderer.lightning.triggerBurstFlash).toHaveBeenCalled();
    expect(mockFishRenderer.lightning.spawnBolt).toHaveBeenCalledWith(
      expect.objectContaining({ x: 300, y: 400 }),
      95
    );
    expect(mockRipples.trigger).toHaveBeenCalledWith(
      "touch",
      expect.objectContaining({ x: 300, y: 400 })
    );
    expect(mockSchool.scatter).toHaveBeenCalled();
    expect(pushAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining("Lâm Động"),
      "size"
    );

    // Verify 3 ripples in total after timers advance
    vi.advanceTimersByTime(350);
    expect(mockRipples.trigger).toHaveBeenCalledTimes(3);
    client.dispose();
  });

  it("should fallback to canvas center area and default name when dragon fish is not in school", () => {
    const mockRipples = { trigger: vi.fn() };
    const mockFishRenderer = {
      lightning: {
        triggerBurstFlash: vi.fn(),
        spawnBolt: vi.fn(),
      },
    };
    const mockSchool = {
      fish: [],
      count: 0,
      ripples: mockRipples,
      scatter: vi.fn(),
      fishRenderer: mockFishRenderer,
    };
    const mockFoodSystem = { spawn: vi.fn() };

    const client = new LiveClient(mockSchool as any, mockFoodSystem as any);
    const pushAlertSpy = vi.spyOn(client, "pushEventAlert");

    (client as any).handleWsMessage(
      JSON.stringify({
        t: "dragon_lightning",
      })
    );

    expect(mockFishRenderer.lightning.triggerBurstFlash).toHaveBeenCalled();
    expect(mockFishRenderer.lightning.spawnBolt).toHaveBeenCalledWith(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      }),
      95
    );
    expect(mockRipples.trigger).toHaveBeenCalledWith(
      "touch",
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      })
    );
    expect(mockSchool.scatter).toHaveBeenCalled();
    expect(pushAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining("Thái Cổ Chân Long"),
      "size"
    );

    client.dispose();
  });

  it("should match fish by case-insensitive ownerName when id is empty", () => {
    const mockRipples = { trigger: vi.fn() };
    const mockFishRenderer = {
      lightning: {
        triggerBurstFlash: vi.fn(),
        spawnBolt: vi.fn(),
      },
    };
    const mockSchool = {
      fish: [
        {
          ownerId: "some_other_id",
          ownerName: "Tiêu Viêm",
          position: { x: 550, y: 650 },
          tribulationAura: "dragon",
        },
      ],
      count: 1,
      ripples: mockRipples,
      scatter: vi.fn(),
      fishRenderer: mockFishRenderer,
    };
    const mockFoodSystem = { spawn: vi.fn() };

    const client = new LiveClient(mockSchool as any, mockFoodSystem as any);

    (client as any).handleWsMessage(
      JSON.stringify({
        t: "dragon_lightning",
        user: "tiêu viêm",
      })
    );

    expect(mockFishRenderer.lightning.spawnBolt).toHaveBeenCalledWith(
      expect.objectContaining({ x: 550, y: 650 }),
      95
    );
    client.dispose();
  });
});
