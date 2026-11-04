import { describe, it, expect } from "vitest";

export function isDragonFish(fish) {
  return Boolean(fish && (Number(fish.sizeCm) >= 82.0 || fish.passed82));
}

export function handleWeatherAuth(fish) {
  if (!isDragonFish(fish)) {
    return { allowed: false, reason: "Chưa đạt cảnh giới Hóa Long (cần >= 82cm)" };
  }
  return { allowed: true };
}

export function handleThunderAuth(fish, lastThunderTime, now = Date.now()) {
  if (!isDragonFish(fish)) {
    return { allowed: false, reason: "Chưa đạt cảnh giới Hóa Long" };
  }
  if (now - (lastThunderTime || 0) < 15000) {
    return { allowed: false, reason: "Thiên Lôi đang hồi chiêu (15 giây)" };
  }
  return { allowed: true };
}

export const THIEN_LOI_KEYWORDS = [
  'thiên lôi', 'thien loi', 'sấm sét', 'sam set', 'gọi sét', 'goi set',
  'lôi phạt', 'loi phat', 'sét đánh', 'set danh', 'sét', 'lôi giáng'
];

describe("Server Dragon Permissions and Cooldown", () => {
  it("should deny weather control for non-dragon fish (< 82cm)", () => {
    const normalFish = { id: "u1", sizeCm: 45.0, passed82: false };
    expect(handleWeatherAuth(normalFish).allowed).toBe(false);
    expect(handleWeatherAuth(normalFish).reason).toContain("Chưa đạt cảnh giới Hóa Long");
  });

  it("should allow weather control for dragon fish (>= 82cm or passed82)", () => {
    const dragonFish1 = { id: "u2", sizeCm: 82.0, passed82: false };
    const dragonFish2 = { id: "u3", sizeCm: 75.0, passed82: true };
    const dragonFish3 = { id: "u4", sizeCm: "85.0", passed82: false };
    expect(handleWeatherAuth(dragonFish1).allowed).toBe(true);
    expect(handleWeatherAuth(dragonFish2).allowed).toBe(true);
    expect(handleWeatherAuth(dragonFish3).allowed).toBe(true);
  });

  it("should deny weather and thunder control for null or undefined fish", () => {
    expect(handleWeatherAuth(null).allowed).toBe(false);
    expect(handleWeatherAuth(undefined).allowed).toBe(false);
    expect(handleThunderAuth(null, 0).allowed).toBe(false);
    expect(handleThunderAuth(undefined, 0).allowed).toBe(false);
  });

  it("should enforce 15s cooldown on thunder summon", () => {
    const dragonFish = { id: "u2", sizeCm: 85.0, passed82: true };
    const t0 = 100000;
    expect(handleThunderAuth(dragonFish, 0, t0).allowed).toBe(true);
    expect(handleThunderAuth(dragonFish, t0, t0 + 5000).allowed).toBe(false);
    expect(handleThunderAuth(dragonFish, t0, t0 + 14999).allowed).toBe(false);
    expect(handleThunderAuth(dragonFish, t0, t0 + 15000).allowed).toBe(true);
    expect(handleThunderAuth(dragonFish, t0, t0 + 20000).allowed).toBe(true);
  });

  it("should match all expected keywords for Thiên Lôi command", () => {
    const sampleChats = [
      "gọi thiên lôi đi",
      "thien loi giáng lâm",
      "sấm sét đùng đùng",
      "sam set mau",
      "gọi sét xuống",
      "goi set",
      "lôi phạt kẻ địch",
      "loi phat",
      "sét đánh chết nó",
      "set danh di",
      "triệu hồi sét",
      "lôi giáng cửu thiên"
    ];

    for (const chat of sampleChats) {
      const lower = chat.toLowerCase();
      const matched = THIEN_LOI_KEYWORDS.some((kw) => lower.includes(kw));
      expect(matched).toBe(true);
    }
  });
});
