import { describe, it, expect } from "vitest";
import { calculateTuTienRank, getTuTienVoiceLine } from "./tu-tien";

describe("Tu Tien Dragon Realm Description and Voice", () => {
  it("should mention weather and lightning control in Hóa Long realm description", () => {
    const rank = calculateTuTienRank(82.0);
    expect(rank.fullName).toBe("Phi Thăng Hóa Long");
    expect(rank.desc).toContain("thời tiết");
    expect(rank.desc).toContain("thiên lôi");
  });

  it("should announce weather and lightning command in Hóa Long voice line", () => {
    const rank = calculateTuTienRank(85.0);
    const line = getTuTienVoiceLine("Lâm Động", 85.0, rank, 130);
    expect(line).toContain("thời tiết");
    expect(line).toContain("thiên lôi");
  });
});
