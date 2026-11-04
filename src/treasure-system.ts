import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import { length, sub, vec, type Vec2 } from "./math";
import type { School } from "./school";
import type { Koi } from "./koi";
import type {
  TreasureChest,
  TreasureReward,
  TreasureRewardType,
} from "./treasure-types";

export class TreasureSystem {
  public activeChest: TreasureChest | null = null;
  public autoSpawnTimer = 420; // Auto drop every 7 minutes
  private nextId = 1;

  public onEvent?: (event: {
    type: "spawn" | "open";
    text: string;
    user?: string;
  }) => void;

  public spawnChest(pos?: Vec2): TreasureChest {
    const position = pos ?? vec(
      CANVAS_WIDTH * 0.25 + Math.random() * CANVAS_WIDTH * 0.5,
      CANVAS_HEIGHT * 0.25 + Math.random() * CANVAS_HEIGHT * 0.5
    );

    const chest: TreasureChest = {
      id: `chest-${this.nextId++}`,
      position,
      phase: "active",
      timer: 45, // active for 45s
      openTimer: 4.0, // display opened reward for 4s
      claimedBy: null,
    };

    this.activeChest = chest;

    this.onEvent?.({
      type: "spawn",
      text: "🎁 RƯƠNG BÁU THỦY CUNG ĐÃ XUẤT HIỆN! Hãy chat 'bơi' hoặc 'nhanh' để phóng tới đớp rương báu!",
    });

    return chest;
  }

  public rollGachaReward(): TreasureReward {
    const r = Math.random();
    if (r < 0.4) {
      return {
        type: "growth",
        title: "Tăng Trưởng Thần Tốc 📈",
        description: "+3.0cm kích thước hồ cá",
      };
    } else if (r < 0.65) {
      return {
        type: "neon",
        title: "Hào Quang Neon 🌈",
        description: "Phát sáng cầu vồng rực rỡ",
      };
    } else if (r < 0.85) {
      return {
        type: "shield",
        title: "Linh Khiên Kim Cương 🛡️",
        description: "Miễn tử 1 lần khi thất bại võ đài PVP",
      };
    } else {
      return {
        type: "mini",
        title: "Bom Tí Hon 🫧",
        description: "Hóa nhỏ 10cm siêu tốc trong 20s!",
      };
    }
  }

  public claimReward(fish: Koi, chest: TreasureChest): TreasureRewardType {
    const reward = this.rollGachaReward();

    switch (reward.type) {
      case "growth":
        fish.eatCount += 6; // +3.0 cm (eatCount * 0.5)
        fish.updateDimensions();
        break;
      case "neon":
        fish.isNeonGlow = true;
        break;
      case "shield":
        fish.hasPvPShield = true;
        break;
      case "mini":
        fish.isMiniFish = true;
        fish.miniTimer = 20.0;
        break;
    }

    fish.nameVisibleTimer = 5.0;
    chest.phase = "opened";
    chest.openTimer = 4.0;
    chest.claimedBy = {
      id: fish.ownerId || "wild",
      name: fish.ownerName || "Cá hoang",
      avatar: fish.ownerAvatar || "",
      reward,
    };

    this.onEvent?.({
      type: "open",
      text: `🎁 ${chest.claimedBy.name} đã mở Rương Báu nhận được: ${reward.title}! (${reward.description})`,
      user: chest.claimedBy.name,
    });

    return reward.type;
  }

  public update(dt: number, school: School): void {
    // Auto spawn timer
    if (!this.activeChest) {
      this.autoSpawnTimer -= dt;
      if (this.autoSpawnTimer <= 0) {
        this.autoSpawnTimer = 420;
        this.spawnChest();
      }
      return;
    }

    if (this.activeChest.phase === "active") {
      this.activeChest.timer -= dt;
      if (this.activeChest.timer <= 0) {
        this.activeChest = null;
        return;
      }

      // Check collision with fish mouth (position)
      const count = school.count;
      for (let i = 0; i < count; i++) {
        const fish = school.fish[i];
        if (fish.isBeingFished) continue;

        const dist = length(sub(fish.position, this.activeChest.position));
        if (dist <= 24) {
          this.claimReward(fish, this.activeChest);
          break;
        }
      }
    } else if (this.activeChest.phase === "opened") {
      this.activeChest.openTimer -= dt;
      if (this.activeChest.openTimer <= 0) {
        this.activeChest = null;
      }
    }
  }
}
