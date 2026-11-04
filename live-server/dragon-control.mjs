/**
 * Shared dragon permissions, weather control, and thunder cooldown logic
 */

export function isDragonFish(fish) {
  return Boolean(fish && (Number(fish.sizeCm) >= 82.0 || fish.passed82));
}

export function checkWeatherAuth(fish) {
  if (!isDragonFish(fish)) {
    return {
      allowed: false,
      reason: "Chưa đạt cảnh giới Hóa Long (cần >= 82cm)",
    };
  }
  return { allowed: true };
}

export function checkThunderCooldown(id, userLastThunder, now = Date.now()) {
  const lastTime = userLastThunder.get(id) || 0;
  if (now - lastTime < 15000) {
    const waitSec = Math.ceil((15000 - (now - lastTime)) / 1000);
    return {
      allowed: false,
      waitSec,
      reason: `Thiên Lôi đang hồi chiêu (${waitSec} giây)`,
    };
  }

  if (userLastThunder.size > 500) {
    const oldest = userLastThunder.keys().next().value;
    if (oldest !== undefined) {
      userLastThunder.delete(oldest);
    }
  }

  userLastThunder.set(id, now);
  return { allowed: true };
}

export const THIEN_LOI_KEYWORDS = [
  'thiên lôi', 'thien loi', 'sấm sét', 'sam set', 'gọi sét', 'goi set',
  'lôi phạt', 'loi phat', 'sét đánh', 'set danh', 'sét', 'lôi giáng'
];
