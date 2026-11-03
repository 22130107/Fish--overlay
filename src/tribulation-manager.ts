import type {
  TribulationContributor,
  TribulationState,
} from "./tribulation-types";

export class TribulationManager {
  public state: TribulationState = {
    active: false,
    targetFishId: "",
    ownerName: "",
    ownerAvatar: "",
    targetRealm: "Độ Kiếp Kỳ",
    targetCm: 72.0,
    timeLeft: 30.0,
    requiredPower: 40,
    currentPower: 0,
    contributors: new Map(),
    result: "ongoing",
  };

  public onStart?: (state: TribulationState) => void;
  public onProgress?: (state: TribulationState) => void;
  public onSuccess?: (state: TribulationState) => void;
  public onFail?: (state: TribulationState) => void;

  public start(
    fishId: string,
    ownerName: string,
    ownerAvatar: string = "",
    targetCm: number = 72.0
  ): void {
    const isDragon = targetCm >= 82.0;
    this.state = {
      active: true,
      targetFishId: fishId,
      ownerName: ownerName || "Đạo hữu",
      ownerAvatar: ownerAvatar || "",
      targetRealm: isDragon ? "Phi Thăng Hóa Long" : "Độ Kiếp Kỳ",
      targetCm,
      timeLeft: 30.0,
      requiredPower: isDragon ? 60 : 40,
      currentPower: 0,
      contributors: new Map(),
      result: "ongoing",
    };
    this.onStart?.(this.state);
  }

  public addPower(
    _source: "chat" | "like" | "gift",
    userName: string,
    points: number = 1,
    avatar: string = ""
  ): void {
    if (!this.state.active) return;

    const safePoints = Math.max(1, points);
    this.state.currentPower += safePoints;

    const userKey = userName.toLowerCase().trim() || "khán giả";
    let cont = this.state.contributors.get(userKey);
    if (!cont) {
      cont = { name: userName || "Khán giả", avatar, power: 0 };
      this.state.contributors.set(userKey, cont);
    }
    cont.power += safePoints;
    if (avatar && !cont.avatar) cont.avatar = avatar;

    this.onProgress?.(this.state);

    if (this.state.currentPower >= this.state.requiredPower) {
      this.resolve(true);
    }
  }

  public update(dt: number): void {
    if (!this.state.active) return;

    this.state.timeLeft -= dt;
    if (this.state.timeLeft <= 0) {
      this.state.timeLeft = 0;
      this.resolve(this.state.currentPower >= this.state.requiredPower);
    }
  }

  public resolve(success: boolean): void {
    if (!this.state.active) return;
    this.state.active = false;
    this.state.result = success ? "success" : "failed";

    if (success) {
      this.onSuccess?.(this.state);
    } else {
      this.onFail?.(this.state);
    }
  }

  public getTopContributors(limit = 3): TribulationContributor[] {
    return Array.from(this.state.contributors.values())
      .sort((a, b) => b.power - a.power)
      .slice(0, limit);
  }
}
