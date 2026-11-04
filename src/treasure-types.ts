import type { Vec2 } from "./math";

export type TreasureRewardType = "growth" | "neon" | "shield" | "mini";

export interface TreasureReward {
  type: TreasureRewardType;
  title: string;
  description: string;
}

export interface TreasureChest {
  id: string;
  position: Vec2;
  phase: "falling" | "active" | "opened";
  timer: number;       // Remaining active seconds (up to 45s)
  openTimer: number;   // Opened animation seconds (4s)
  claimedBy: {
    id: string;
    name: string;
    avatar: string;
    reward: TreasureReward;
  } | null;
}
