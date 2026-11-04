import { describe, it, expect } from "vitest";
import {
  isDragonFish,
  checkWeatherAuth,
  checkThunderCooldown,
  THIEN_LOI_KEYWORDS,
} from "./dragon-control.mjs";
import {
  calculateTuTienRank,
  getTuTienVoiceLine,
} from "./tu-tien.mjs";

describe("Server Dragon Permissions and Cooldown", () => {
  it("should deny weather control for non-dragon fish (< 82cm)", () => {
    const normalFish = { id: "u1", sizeCm: 45.0, passed82: false };
    const auth = checkWeatherAuth(normalFish);
    expect(auth.allowed).toBe(false);
    expect(auth.reason).toContain("Chưa đạt cảnh giới Hóa Long");
  });

  it("should allow weather control for dragon fish (>= 82cm or passed82)", () => {
    const dragonFish1 = { id: "u2", sizeCm: 82.0, passed82: false };
    const dragonFish2 = { id: "u3", sizeCm: 75.0, passed82: true };
    const dragonFish3 = { id: "u4", sizeCm: "85.0", passed82: false };
    expect(checkWeatherAuth(dragonFish1).allowed).toBe(true);
    expect(checkWeatherAuth(dragonFish2).allowed).toBe(true);
    expect(checkWeatherAuth(dragonFish3).allowed).toBe(true);
  });

  it("should deny weather control for null or undefined fish", () => {
    expect(checkWeatherAuth(null).allowed).toBe(false);
    expect(checkWeatherAuth(undefined).allowed).toBe(false);
    expect(isDragonFish(null)).toBe(false);
    expect(isDragonFish(undefined)).toBe(false);
  });

  it("should enforce 15s cooldown on thunder summon", () => {
    const userLastThunder = new Map();
    const id = "dragon_user";
    const t0 = 100000;

    const res0 = checkThunderCooldown(id, userLastThunder, t0);
    expect(res0.allowed).toBe(true);
    expect(userLastThunder.get(id)).toBe(t0);

    const res1 = checkThunderCooldown(id, userLastThunder, t0 + 5000);
    expect(res1.allowed).toBe(false);
    expect(res1.waitSec).toBe(10);
    expect(res1.reason).toContain("Thiên Lôi đang hồi chiêu");

    const res2 = checkThunderCooldown(id, userLastThunder, t0 + 14999);
    expect(res2.allowed).toBe(false);
    expect(res2.waitSec).toBe(1);

    const res3 = checkThunderCooldown(id, userLastThunder, t0 + 15000);
    expect(res3.allowed).toBe(true);
    expect(userLastThunder.get(id)).toBe(t0 + 15000);

    const res4 = checkThunderCooldown(id, userLastThunder, t0 + 20000);
    expect(res4.allowed).toBe(false);
    expect(res4.waitSec).toBe(10);

    const res5 = checkThunderCooldown(id, userLastThunder, t0 + 30000);
    expect(res5.allowed).toBe(true);
    expect(userLastThunder.get(id)).toBe(t0 + 30000);
  });

  it("should evict oldest entry when userLastThunder exceeds 500 entries", () => {
    const userLastThunder = new Map();
    for (let i = 0; i <= 500; i++) {
      userLastThunder.set(`user_${i}`, 1000 + i);
    }
    expect(userLastThunder.size).toBe(501);
    expect(userLastThunder.has("user_0")).toBe(true);

    const res = checkThunderCooldown("user_new", userLastThunder, 200000);
    expect(res.allowed).toBe(true);
    expect(userLastThunder.has("user_0")).toBe(false);
    expect(userLastThunder.has("user_new")).toBe(true);
    expect(userLastThunder.size).toBe(501);
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
      "lôi giáng cửu thiên",
    ];

    for (const chat of sampleChats) {
      const lower = chat.toLowerCase();
      const matched = THIEN_LOI_KEYWORDS.some((kw) => lower.includes(kw));
      expect(matched).toBe(true);
    }
  });
});

describe("Tu Tien Live-Server Rank and Voice Line", () => {
  it("should assert calculateTuTienRank contains weather and lightning in desc for >= 82cm", () => {
    const rank = calculateTuTienRank(82.0);
    expect(rank.fullName).toBe("Phi Thăng Hóa Long");
    expect(rank.desc).toBe(
      "Cá chép vượt long môn, đắc đạo thành Chân Long phi thăng tiên giới, hô mưa gọi gió, chưởng quản thời tiết và thiên lôi."
    );
  });

  it("should assert getTuTienVoiceLine announces weather and lightning command for >= 82cm", () => {
    const rank = calculateTuTienRank(85.0);
    const line = getTuTienVoiceLine("Lâm Động", 85.0, rank, 130);
    expect(line).toBe(
      "Kính báo thiên hạ! Linh ngư của đạo hữu Lâm Động đã đạt tám mươi lăm xăng ti mét, đắc đạo cảnh giới Phi Thăng Hóa Long, cá chép vượt Vũ Môn hóa thành Chân Long thượng giới, chưởng quản thời tiết và hiệu triệu thiên lôi!"
    );
  });
});
