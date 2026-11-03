export interface TribulationContributor {
  name: string;
  avatar?: string;
  power: number;
}

export type TribulationResult = "ongoing" | "success" | "failed";

export interface TribulationState {
  active: boolean;
  targetFishId: string;
  ownerName: string;
  ownerAvatar: string;
  targetRealm: "Độ Kiếp Kỳ" | "Phi Thăng Hóa Long";
  targetCm: number;
  timeLeft: number;
  requiredPower: number;
  currentPower: number;
  contributors: Map<string, TribulationContributor>;
  result: TribulationResult;
}
