/**
 * Hệ thống Cảnh Giới Tu Tiên cho Cá Koi (Tu Tiên Linh Ngư)
 * Mô phỏng quá trình cá chép tu luyện hấp thu linh khí, ngưng tụ nội đan,
 * vượt lôi kiếp để hóa thành Chân Long (Phi Thăng Thượng Giới).
 */

export interface TuTienRank {
  realm: string;          // Cảnh giới chính: Luyện Khí, Trúc Cơ, Kim Đan...
  subStage: string;       // Giai đoạn: Sơ Kỳ, Trung Kỳ, Hậu Kỳ, Viên Mãn
  fullName: string;       // Tên đầy đủ: "Kim Đan Kỳ (Trung Kỳ)"
  title: string;          // Danh hiệu tu vi: "Kim Quang Ngưng Đan"
  badge: string;          // Icon huy hiệu: ⭐, 🐉👑...
  auraColor: string;      // Màu hào quang phát sáng
  progressToNext: number; // 0 - 100% tiến độ độ kiếp
  nextRealm: string;      // Cảnh giới kế tiếp
  desc: string;           // Miêu tả tu vi
}

export function formatNumberToVietnamese(num: number): string {
  const rounded = Math.round(num * 10) / 10;
  const intPart = Math.floor(rounded);
  const decPart = Math.round((rounded - intPart) * 10);

  const digitWords = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

  function intToWords(n: number): string {
    if (n < 10) return digitWords[n];
    if (n === 10) return "mười";
    if (n < 20) {
      const unit = n % 10;
      if (unit === 0) return "mười";
      if (unit === 5) return "mười lăm";
      return `mười ${digitWords[unit]}`;
    }
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    const tenWord =
      ten === 2 ? "hai mươi" :
      ten === 3 ? "ba mươi" :
      ten === 4 ? "bốn mươi" :
      ten === 5 ? "năm mươi" :
      ten === 6 ? "sáu mươi" :
      ten === 7 ? "bảy mươi" :
      ten === 8 ? "tám mươi" :
      ten === 9 ? "chín mươi" : `${digitWords[ten]} mươi`;

    if (unit === 0) return tenWord;
    if (unit === 1) return `${tenWord} mốt`;
    if (unit === 4) return `${tenWord} tư`;
    if (unit === 5) return `${tenWord} lăm`;
    return `${tenWord} ${digitWords[unit]}`;
  }

  const intWords = intToWords(intPart);
  if (decPart > 0) {
    const decWord = decPart === 5 ? "năm" : digitWords[decPart];
    return `${intWords} phẩy ${decWord}`;
  }
  return intWords;
}

export function calculateTuTienRank(sizeCm: number): TuTienRank {
  const cm = Math.max(15, sizeCm);

  // 1. Luyện Khí Kỳ (18 - 25 cm)
  if (cm < 25) {
    const p = Math.min(100, Math.max(0, Math.round(((cm - 18) / (25 - 18)) * 100)));
    const sub = p < 35 ? "Sơ Kỳ" : p < 70 ? "Trung Kỳ" : "Hậu Kỳ";
    return {
      realm: "Luyện Khí Kỳ",
      subStage: sub,
      fullName: `Luyện Khí Kỳ (${sub})`,
      title: "Phàm Thể Linh Ngư",
      badge: "🌱",
      auraColor: "#38bdf8",
      progressToNext: p,
      nextRealm: "Trúc Cơ Kỳ",
      desc: "Mới dẫn linh khí thiên địa nhập thể, gân cốt mềm mại",
    };
  }

  // 2. Trúc Cơ Kỳ (25 - 36 cm)
  if (cm < 36) {
    const p = Math.min(100, Math.max(0, Math.round(((cm - 25) / (36 - 25)) * 100)));
    const sub = p < 35 ? "Sơ Kỳ" : p < 70 ? "Trung Kỳ" : "Viên Mãn";
    return {
      realm: "Trúc Cơ Kỳ",
      subStage: sub,
      fullName: `Trúc Cơ Kỳ (${sub})`,
      title: "Đạo Cơ Linh Ngư",
      badge: "🌿",
      auraColor: "#10b981",
      progressToNext: p,
      nextRealm: "Kim Đan Kỳ",
      desc: "Đúc thành đạo cơ linh ngư, bơi lội nhẹ tựa mây trôi",
    };
  }

  // 3. Kim Đan Kỳ (36 - 48 cm)
  if (cm < 48) {
    const p = Math.min(100, Math.max(0, Math.round(((cm - 36) / (48 - 36)) * 100)));
    const sub = p < 35 ? "Sơ Kỳ" : p < 70 ? "Trung Kỳ" : "Viên Mãn";
    return {
      realm: "Kim Đan Kỳ",
      subStage: sub,
      fullName: `Kim Đan Kỳ (${sub})`,
      title: "Kim Quang Ngưng Đan",
      badge: "⭐",
      auraColor: "#f59e0b",
      progressToNext: p,
      nextRealm: "Nguyên Anh Kỳ",
      desc: "Nội đan kết tinh, vảy cá phát kim quang chói lọi",
    };
  }

  // 4. Nguyên Anh Kỳ (48 - 60 cm)
  if (cm < 60) {
    const p = Math.min(100, Math.max(0, Math.round(((cm - 48) / (60 - 48)) * 100)));
    const sub = p < 35 ? "Sơ Kỳ" : p < 70 ? "Trung Kỳ" : "Viên Mãn";
    return {
      realm: "Nguyên Anh Kỳ",
      subStage: sub,
      fullName: `Nguyên Anh Kỳ (${sub})`,
      title: "Linh Ngư Hóa Hình",
      badge: "🔮",
      auraColor: "#c084fc",
      progressToNext: p,
      nextRealm: "Hóa Thần Kỳ",
      desc: "Nguyên anh hiển hiện, linh trí thông tuệ phi phàm",
    };
  }

  // 5. Hóa Thần Kỳ (60 - 72 cm)
  if (cm < 72) {
    const p = Math.min(100, Math.max(0, Math.round(((cm - 60) / (72 - 60)) * 100)));
    const sub = p < 35 ? "Sơ Kỳ" : p < 70 ? "Trung Kỳ" : "Viên Mãn";
    return {
      realm: "Hóa Thần Kỳ",
      subStage: sub,
      fullName: `Hóa Thần Kỳ (${sub})`,
      title: "Thần Thú Trấn Thủy",
      badge: "⚡",
      auraColor: "#f97316",
      progressToNext: p,
      nextRealm: "Độ Kiếp Kỳ",
      desc: "Thần niệm thông thiên, dấy sóng làm mưa uy chấn một phương",
    };
  }

  // 6. Độ Kiếp Kỳ (72 - 82 cm)
  if (cm < 82) {
    const p = Math.min(100, Math.max(0, Math.round(((cm - 72) / (82 - 72)) * 100)));
    const sub = p < 50 ? "Nghênh Kiếp" : "Lôi Kiếp Viên Mãn";
    return {
      realm: "Độ Kiếp Kỳ",
      subStage: sub,
      fullName: `Độ Kiếp Kỳ (${sub})`,
      title: "Chuẩn Long Vượt Kiếp",
      badge: "🌩️",
      auraColor: "#ef4444",
      progressToNext: p,
      nextRealm: "Phi Thăng Hóa Long",
      desc: "Toàn thân vảy rồng phát tiết, nghênh tiếp thiên kiếp lôi đình",
    };
  }

  // 7. Phi Thăng Hóa Long (>= 82 cm)
  return {
    realm: "Phi Thăng Kỳ",
    subStage: "Chân Long Thần Cấp",
    fullName: "Phi Thăng Hóa Long",
    title: "Thái Cổ Chân Long",
    badge: "🐉👑",
    auraColor: "#fbbf24",
    progressToNext: 100,
    nextRealm: "Đắc Đạo Thần Thoại",
    desc: "Cá chép vượt long môn, đắc đạo thành Chân Long phi thăng tiên giới, hô mưa gọi gió, chưởng quản thời tiết và thiên lôi.",
  };
}

export function getTuTienVoiceLine(
  name: string,
  sizeCm: number,
  rank: TuTienRank,
  eatCount: number
): string {
  const sizeWords = formatNumberToVietnamese(sizeCm);
  const spokenName = String(name).replace(/[_@.]+/g, " ").slice(0, 25).trim() || "Đạo hữu";

  if (sizeCm >= 82) {
    return `Kính báo thiên hạ! Linh ngư của đạo hữu ${spokenName} đã đạt ${sizeWords} xăng ti mét, đắc đạo cảnh giới Phi Thăng Hóa Long, cá chép vượt Vũ Môn hóa thành Chân Long thượng giới, chưởng quản thời tiết và hiệu triệu thiên lôi!`;
  }
  if (sizeCm >= 72) {
    return `Thiên kiếp xuất hiện! Linh ngư của đạo hữu ${spokenName} dài ${sizeWords} xăng ti mét, đạt cảnh giới ${rank.realm} ${rank.subStage}, chuẩn bị vượt lôi kiếp hóa rồng!`;
  }
  if (sizeCm >= 60) {
    return `Thần thông cái thế! Linh ngư của đạo hữu ${spokenName} đạt ${sizeWords} xăng ti mét, cảnh giới ${rank.realm} ${rank.subStage}, thần thú uy trấn bốn phương!`;
  }
  if (sizeCm >= 48) {
    return `Chúc mừng đạo hữu ${spokenName}, linh ngư của người đạt ${sizeWords} xăng ti mét, tu vi đột phá ${rank.realm} ${rank.subStage}, linh khí ngút ngàn!`;
  }
  if (sizeCm >= 36) {
    return `Báo cáo đạo hữu ${spokenName}, linh ngư của người hiện dài ${sizeWords} xăng ti mét, đạt cảnh giới ${rank.realm} ${rank.subStage}, kim quang rực rỡ!`;
  }
  if (sizeCm >= 25) {
    return `Đạo hữu ${spokenName}, linh ngư của bạn dài ${sizeWords} xăng ti mét, cảnh giới ${rank.realm} ${rank.subStage}, đạo cơ vững chắc!`;
  }
  return `Đạo hữu ${spokenName}, linh ngư của bạn dài ${sizeWords} xăng ti mét, cảnh giới ${rank.realm} ${rank.subStage}, đã hấp thu ${eatCount} viên linh đan!`;
}
