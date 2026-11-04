import { useEffect, useState } from "react";
import type { School } from "@/school";
import type { FoodSystem } from "@/food-system";
import type { LiveStreamState } from "@/live-client";
import type { TribulationContributor } from "@/tribulation-types";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/config";

function TribulationBanner({
  tribulation,
}: {
  tribulation: NonNullable<LiveStreamState["tribulation"]>;
}) {
  const req = Math.max(1, tribulation.requiredPower || 40);
  const percent = Math.min(100, Math.round((tribulation.currentPower / req) * 100));

  const contributors = tribulation.contributors;
  const rawList: TribulationContributor[] = contributors
    ? Array.from(
        contributors instanceof Map
          ? (contributors.values() as Iterable<TribulationContributor>)
          : (Object.values(contributors) as TribulationContributor[])
      )
    : [];

  const topContributors = rawList
    .sort((a, b) => b.power - a.power)
    .slice(0, 3);

  return (
    <div className="live-tribulation-banner">
      <div className="tribulation-header">
        <span className="thunder-icon">⚡</span>
        <span className="tribulation-title">
          THIÊN KIẾP GIÁNG LÂM: {tribulation.targetRealm.toUpperCase()}
        </span>
        <span className="thunder-icon">⚡</span>
      </div>

      <div className="tribulation-body">
        <div className="tribulation-user-row">
          {tribulation.ownerAvatar ? (
            <img
              src={tribulation.ownerAvatar}
              alt=""
              className="tribulation-avatar"
            />
          ) : (
            <div className="tribulation-avatar-fallback">🐉</div>
          )}
          <div className="tribulation-info">
            <div className="tribulation-target-name">
              Linh ngư của <b>{tribulation.ownerName}</b>
            </div>
            <div className="tribulation-realm-pill">
              {tribulation.targetCm}cm • Cửu Trọng Lôi Kiếp
            </div>
          </div>

          <div
            className={`tribulation-timer ${
              tribulation.timeLeft <= 10 ? "timer-urgent" : ""
            }`}
          >
            ⏳ {Math.ceil(tribulation.timeLeft)}s
          </div>
        </div>

        {/* Progress Energy Gauge */}
        <div className="tribulation-bar-wrap">
          <div
            className="tribulation-bar-fill"
            style={{ width: `${percent}%` }}
          >
            <div className="bar-sparkle" />
          </div>
          <span className="tribulation-bar-text">
            ⚡ Lực Hộ Pháp: {tribulation.currentPower} / {tribulation.requiredPower} ({percent}%)
          </span>
        </div>

        {/* Top 3 Contributors Badges */}
        {topContributors.length > 0 && (
          <div className="tribulation-contributors">
            <span className="contributors-label">Top Hộ Pháp:</span>
            <div className="contributors-list">
              {topContributors.map((c, idx) => (
                <span key={idx} className="tribulation-contributor-badge">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"} {c.name} (+{c.power})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="tribulation-call-action">
          💬 Bình luận <b>"HỘ PHÁP"</b> • ❤️ Thả Tim • 🎁 Quà tặng để trợ lực!
        </div>
      </div>
    </div>
  );
}

interface LiveOverlayProps {
  school: School;
  foodSystem: FoodSystem;
  liveState: LiveStreamState;
  showOverlay?: boolean;
}

export function LiveOverlay({
  school,
  foodSystem,
  liveState,
  showOverlay = true,
}: LiveOverlayProps) {
  // Throttled 30fps render loop for real-time tracking of swimming fish & food
  // (Prevents aggressive React VDOM thrashing and Garbage Collection lag during long live streams)
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!showOverlay) return;
    let animId = 0;
    let bgInterval = 0;
    let lastRenderTime = 0;
    const TARGET_MS = 1000 / 30; // 30 FPS cap for DOM nametags & badges

    const loop = (now: number) => {
      if (now - lastRenderTime >= TARGET_MS) {
        lastRenderTime = now;
        setTick((t) => (t + 1) % 1000000);
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    const handleVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        animId = 0;
        if (!bgInterval) {
          bgInterval = window.setInterval(() => {
            setTick((t) => (t + 1) % 1000000);
          }, 1000 / 15);
        }
      } else {
        if (bgInterval) {
          window.clearInterval(bgInterval);
          bgInterval = 0;
        }
        if (!animId) {
          lastRenderTime = performance.now();
          animId = requestAnimationFrame(loop);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVis);

    return () => {
      cancelAnimationFrame(animId);
      if (bgInterval) window.clearInterval(bgInterval);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [showOverlay]);

  if (!showOverlay) return null;

  // Active owned fish
  const arena = school.arena;
  const ownedFish = school.fish.slice(0, school.count).filter((f) => Boolean(f.ownerId));

  return (
    <div className="live-overlay-root">
      {/* 0. Thiên Kiếp & Lôi Đình Banner */}
      {liveState.tribulation && liveState.tribulation.active && (
        <TribulationBanner tribulation={liveState.tribulation} />
      )}

      {/* 0.1 PVP Arena HUD & Waiting Banner */}
      {arena && (arena.state.phase === "summon" || arena.state.phase === "fighting" || arena.state.phase === "knockout") && arena.state.fighter1 && arena.state.fighter2 && (
        <div className="pvp-battle-hud">
          <div className="pvp-hud-header">⚔️ VÕ ĐÀI THẦN NGƯ: QUYẾT ĐẤU SINH TỬ ⚔️</div>
          <div className="pvp-hud-body">
            <div className="pvp-fighter left">
              {arena.state.fighter1.avatar ? (
                <img src={arena.state.fighter1.avatar} className="pvp-avatar" alt="" />
              ) : (
                <div className="pvp-avatar-fallback">{arena.state.fighter1.name[0]}</div>
              )}
              <div className="pvp-info">
                <span className="pvp-name">{arena.state.fighter1.name}</span>
                <span className="pvp-power">Lực húc: {arena.state.fighter1.score}</span>
              </div>
            </div>

            <div className="pvp-meter-container">
              <div className="pvp-meter-timer">{arena.state.phase === "summon" ? `CHUẨN BỊ: ${Math.ceil(arena.state.timer)}s` : `CHIẾN: ${Math.ceil(arena.state.timer)}s`}</div>
              <div className="pvp-meter-track">
                <div
                  className="pvp-meter-fill"
                  style={{
                    width: `${Math.max(10, Math.min(90, 50 + (arena.state.fighter1.score - arena.state.fighter2.score) * 2))}%`,
                  }}
                />
              </div>
              <div className="pvp-meter-hint">Bình luận "huc" / "day" để tiếp sức!</div>
            </div>

            <div className="pvp-fighter right">
              <div className="pvp-info right">
                <span className="pvp-name">{arena.state.fighter2.name}</span>
                <span className="pvp-power">Lực húc: {arena.state.fighter2.score}</span>
              </div>
              {arena.state.fighter2.avatar ? (
                <img src={arena.state.fighter2.avatar} className="pvp-avatar" alt="" />
              ) : (
                <div className="pvp-avatar-fallback">{arena.state.fighter2.name[0]}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {arena && arena.state.phase === "idle" && arena.state.waitingChallenger && (
        <div className="pvp-waiting-banner">
          🥋 <b>{arena.state.waitingChallenger.name}</b> đang đứng trên lôi đài! Bình luận <b>"pvp"</b> để khiêu chiến!
        </div>
      )}

      {/* PVP Arena Center Ring */}
      {arena && arena.isActive && (
        <div className="pvp-arena-layer">
          <div className={`pvp-arena-ring phase-${arena.state.phase}`}>
            <div className="pvp-ring-title">⚔️ VÕ ĐÀI ⚔️</div>
          </div>
        </div>
      )}

      {/* 1. Fish Head Nametags, Avatars & Hunger Bars */}
      <div className="live-fish-layer">
        {ownedFish.map((fish, idx) => {
          const leftPct = (fish.position.x / CANVAS_WIDTH) * 100;
          const topPct = (fish.position.y / CANVAS_HEIGHT) * 100;
          const isDanger = fish.hunger < 30;
          const isWarning = fish.hunger < 60;

          return (
            <div
              key={fish.ownerId || idx}
              className={`live-fish-nametag ${fish.isBeingFished ? "being-fished" : ""}`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              {/* Fishing Hook Animation */}
              {fish.isBeingFished && (
                <div className="fishing-hook-container">
                  <div className="fishing-hook-line" />
                  <span className="fishing-hook-icon">🪝</span>
                </div>
              )}

              {/* Owner Avatar & Name Pill */}
              <div
                className={`fish-owner-pill ${isDanger ? "pill-danger" : ""} ${
                  fish.nameVisibleTimer <= 0 ? "avatar-only" : ""
                }`}
              >
                {fish.isKing && (
                  <span className="fish-crown-badge">👑</span>
                )}
                {fish.ownerAvatar ? (
                  <img
                    src={fish.ownerAvatar}
                    alt=""
                    className="fish-owner-avatar"
                  />
                ) : (
                  <div className="fish-owner-avatar-fallback">
                    {fish.ownerName ? fish.ownerName[0].toUpperCase() : "C"}
                  </div>
                )}
                {fish.nameVisibleTimer > 0 && (
                  <span className="fish-owner-name">{fish.ownerName}</span>
                )}
              </div>

              {/* Floating Size Popup when user comments 'size' (Tu Tiên Style) */}
              {fish.sizeAlertTimer > 0 && (
                <div
                  className="fish-size-popup tu-tien-popup"
                  style={{ borderColor: fish.tuTien.auraColor }}
                >
                  <div className="tu-tien-header">
                    <span>☯️ PHÁP BẢO SOI TU VI</span>
                  </div>
                  <div
                    className="tu-tien-realm-title"
                    style={{ color: fish.tuTien.auraColor }}
                  >
                    {fish.tuTien.badge} {fish.tuTien.fullName}
                  </div>
                  <div className="tu-tien-length">{fish.sizeCm} cm</div>
                  <div className="tu-tien-honorific">
                    Pháp hiệu: <b>{fish.tuTien.title}</b>
                  </div>

                  {/* Tu Tiên Cultivation Progress */}
                  <div className="tu-tien-progress-wrap">
                    <div className="tu-tien-progress-label">
                      <span>Độ kiếp {fish.tuTien.nextRealm}</span>
                      <span>{fish.tuTien.progressToNext}%</span>
                    </div>
                    <div className="tu-tien-progress-track">
                      <div
                        className="tu-tien-progress-bar"
                        style={{
                          width: `${fish.tuTien.progressToNext}%`,
                          background: fish.tuTien.auraColor,
                          boxShadow: `0 0 10px ${fish.tuTien.auraColor}`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="tu-tien-eaten">
                    💊 Đã luyện hóa {fish.eatCount} viên linh đan
                  </div>
                  <div
                    className="ruler-arrow"
                    style={{ borderTopColor: fish.tuTien.auraColor }}
                  />
                </div>
              )}

              {/* Hunger Gauge Bar */}
              <div className="fish-hunger-bar-bg">
                <div
                  className={`fish-hunger-bar-fill ${
                    isDanger ? "fill-danger" : isWarning ? "fill-warning" : "fill-healthy"
                  }`}
                  style={{ width: `${Math.max(4, fish.hunger)}%` }}
                />
              </div>

              {isDanger && !fish.isBeingFished && (
                <div className="fish-hunger-alert">⚠️ Đói bụng!</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Food Pellets & Floating Alerts inside pond */}
      <div className="live-pellets-layer">
        {foodSystem.pellets.map((pellet) => {
          const leftPct = (pellet.position.x / CANVAS_WIDTH) * 100;
          const topPct = (pellet.position.y / CANVAS_HEIGHT) * 100;
          return (
            <div
              key={pellet.id}
              className="live-food-pellet"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              <div className="food-dot" />
              {pellet.showTag !== false && (
                <div className="food-user-tag">🥖 {pellet.user}</div>
              )}
            </div>
          );
        })}

        {foodSystem.alerts.map((alert) => {
          const leftPct = (alert.position.x / CANVAS_WIDTH) * 100;
          const topPct = (alert.position.y / CANVAS_HEIGHT) * 100;
          return (
            <div
              key={alert.id}
              className="live-floating-alert"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                opacity: alert.opacity,
              }}
            >
              {alert.text}
            </div>
          );
        })}
      </div>

      {/* 3. Top Donors Leaderboard */}
      {liveState.topDonors.length > 0 && (
        <div className="live-donors-card">
          <div className="donors-title">🏆 Bảng Vàng Tài Trợ</div>
          <ol className="donors-list">
            {liveState.topDonors.slice(0, 3).map((d, index) => (
              <li key={d.id || index} className="donor-row">
                <span className="donor-rank">#{index + 1}</span>
                <span className="donor-name">{d.name}</span>
                <span className="donor-coins">💎 {d.coins}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 4. Notification Alert Popup (Fish Spawned, Hooked, or Size Checked) */}
      {liveState.latestEvent && (
        <div
          key={liveState.latestEvent.id}
          className={`live-event-notification ${
            liveState.latestEvent.type === "hook"
              ? "event-hook"
              : liveState.latestEvent.type === "size"
              ? "event-size"
              : "event-spawn"
          }`}
        >
          {liveState.latestEvent.text}
        </div>
      )}

      {/* 5. Big Gift Banner Alert */}
      {liveState.currentGift && (
        <div className="live-gift-banner">
          <div className="gift-badge">✨ CẢM ƠN QUÀ TẶNG ✨</div>
          <div className="gift-user">{liveState.currentGift.user}</div>
          <div className="gift-desc">
            đã tặng <b>{liveState.currentGift.giftName}</b> x{liveState.currentGift.count}
          </div>
          <div className="gift-diamonds">💎 +{liveState.currentGift.coins} kim cương</div>
        </div>
      )}

      {/* 6. Guidance Bar (status pill hidden per streamer request) */}
      <div className="live-bottom-dock">
        <div className="live-instruction-pill">
          {arena && arena.state.kingName && (<span className="king-title-pill">👑 <b>Vua Hồ Cá: {arena.state.kingName}</b> • </span>)}
          ⚔️ <b>Gõ "pvp": Lên đài</b> • 👋 <b>Vào xem: Nhận 1 Linh Ngư</b> • 💬 <b>Gõ "size": Soi Cảnh Giới Tu Tiên</b> • 🥖 <b>Bình luận: Ban linh đan</b> • ⚠️ <b>Đói lâu bị câu mất!</b>
        </div>
      </div>
    </div>
  );
}
