import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./config";
import { vec } from "./math";
import type { School } from "./school";
import type { PvpArenaState } from "./pvp-arena-types";

export class PvpArenaManager {
  public readonly state: PvpArenaState = {
    phase: "idle",
    center: vec(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5),
    radius: 110,
    spectatorRadius: 155,
    timer: 0,
    fighter1: null,
    fighter2: null,
    winnerId: null,
    kingId: null,
    kingName: null,
    waitingChallenger: null,
  };

  public onEvent?: (event: {
    type: "waiting" | "start" | "knockout" | "eat";
    text: string;
    user?: string;
  }) => void;

  public get isActive(): boolean {
    return this.state.phase !== "idle";
  }

  public registerChallenger(id: string, name: string, avatar: string = ""): boolean {
    if (this.state.phase !== "idle") {
      return false;
    }

    if (this.state.waitingChallenger) {
      if (this.state.waitingChallenger.id === id) {
        return false;
      }

      // Match found! Start duel
      const first = this.state.waitingChallenger;
      this.state.fighter1 = {
        id: first.id,
        name: first.name,
        avatar: first.avatar,
        score: 0,
        offsetDistance: -35,
      };
      this.state.fighter2 = {
        id,
        name,
        avatar,
        score: 0,
        offsetDistance: 35,
      };
      this.state.waitingChallenger = null;
      this.state.phase = "summon";
      this.state.timer = 3.0;
      this.state.winnerId = null;

      this.onEvent?.({
        type: "start",
        text: `⚔️ QUYẾT CHIẾN: ${this.state.fighter1.name} VS ${this.state.fighter2.name}!`,
        user: name,
      });

      return true;
    }

    // Queue first challenger
    this.state.waitingChallenger = { id, name, avatar };
    this.onEvent?.({
      type: "waiting",
      text: `🥋 ${name} đang đứng trên lôi đài chờ đối thủ! (Gõ "pvp" để khiêu chiến)`,
      user: name,
    });
    return true;
  }

  public addCheerPower(idOrName: string, power: number = 1): void {
    if (this.state.phase !== "fighting" && this.state.phase !== "summon") return;
    const target = idOrName.toLowerCase();

    if (
      this.state.fighter1 &&
      (this.state.fighter1.id === idOrName ||
        this.state.fighter1.name.toLowerCase() === target)
    ) {
      this.state.fighter1.score += power;
    } else if (
      this.state.fighter2 &&
      (this.state.fighter2.id === idOrName ||
        this.state.fighter2.name.toLowerCase() === target)
    ) {
      this.state.fighter2.score += power;
    }
  }

  public update(dt: number, school: School): void {
    if (this.state.phase === "idle") return;

    this.state.timer -= dt;

    if (this.state.phase === "summon") {
      if (this.state.timer <= 0) {
        this.state.phase = "fighting";
        this.state.timer = 30.0; // 30 seconds max combat
      }
      return;
    }

    if (this.state.phase === "fighting") {
      if (!this.state.fighter1 || !this.state.fighter2) {
        this.state.phase = "idle";
        return;
      }

      const fish1 = school.fish
        .slice(0, school.count)
        .find((f) => f.ownerId === this.state.fighter1?.id);
      const fish2 = school.fish
        .slice(0, school.count)
        .find((f) => f.ownerId === this.state.fighter2?.id);

      // Push forces calculation
      const size1 = fish1 ? fish1.sizeCm : 20.0;
      const size2 = fish2 ? fish2.sizeCm : 20.0;
      const force1 = (size1 - 20.0) * 0.4 + this.state.fighter1.score * 0.8 + 1.0;
      const force2 = (size2 - 20.0) * 0.4 + this.state.fighter2.score * 0.8 + 1.0;

      // Net movement along combat axis (positive moves toward fighter 2 side, i.e. Fighter 1 advances)
      const pushSpeed = (force1 - force2) * 5.0;
      const midpoint =
        (this.state.fighter1.offsetDistance + this.state.fighter2.offsetDistance) * 0.5 +
        pushSpeed * dt;

      this.state.fighter1.offsetDistance = midpoint - 18;
      this.state.fighter2.offsetDistance = midpoint + 18;

      // Trigger impact ripples
      if (Math.random() < dt * 6.0) {
        school.ripples.trigger("touch", {
          x: this.state.center.x + midpoint,
          y: this.state.center.y,
        });
      }

      // Knockout check: pushed outside combat ring radius
      const combatRingLimit = this.state.radius - 25;
      let hasWinner = false;

      if (midpoint > combatRingLimit) {
        // Fighter 1 pushed Fighter 2 out
        this.state.winnerId = this.state.fighter1.id;
        hasWinner = true;
      } else if (midpoint < -combatRingLimit) {
        // Fighter 2 pushed Fighter 1 out
        this.state.winnerId = this.state.fighter2.id;
        hasWinner = true;
      } else if (this.state.timer <= 0) {
        // Time ran out -> decision by push lead
        this.state.winnerId =
          midpoint >= 0 ? this.state.fighter1.id : this.state.fighter2.id;
        hasWinner = true;
      }

      if (hasWinner) {
        this.state.phase = "knockout";
        this.state.timer = 3.0; // 3 seconds feast & celebration
        const winner =
          this.state.winnerId === this.state.fighter1.id
            ? this.state.fighter1
            : this.state.fighter2;
        const loser =
          this.state.winnerId === this.state.fighter1.id
            ? this.state.fighter2
            : this.state.fighter1;

        this.onEvent?.({
          type: "knockout",
          text: `💥 ${winner.name} ĐÃ HÚC VĂNG ${loser.name}!`,
          user: winner.name,
        });
      }
      return;
    }

    if (this.state.phase === "knockout") {
      if (this.state.timer <= 0) {
        // Winner consumes loser
        const winnerId = this.state.winnerId;
        const loserId =
          winnerId === this.state.fighter1?.id
            ? this.state.fighter2?.id
            : this.state.fighter1?.id;

        const winnerFish = school.fish
          .slice(0, school.count)
          .find((f) => f.ownerId === winnerId);
        const loserIdx = school.fish.findIndex((f) => f.ownerId === loserId);

        if (winnerFish) {
          winnerFish.eatCount += 4; // +2.0 cm
          winnerFish.gulpAnimation = 1.0;
          winnerFish.nameVisibleTimer = 5.0;

          // Remove crown from previous king and award to this winner
          for (let i = 0; i < school.count; i++) {
            school.fish[i].isKing = false;
          }
          winnerFish.isKing = true;

          const winnerName =
            winnerId === this.state.fighter1?.id
              ? this.state.fighter1.name
              : this.state.fighter2?.name || "";

          this.state.kingId = winnerId;
          this.state.kingName = winnerName;

          this.onEvent?.({
            type: "eat",
            text: `👑 ${winnerName} ĐÃ NUỐT CHỬNG ĐỐI THỦ ĐOẠT NGÔI VUA HỒ CÁ!`,
            user: winnerName,
          });
        }

        const loserFish = loserIdx >= 0 ? school.fish[loserIdx] : null;
        if (loserFish?.hasPvPShield) {
          loserFish.hasPvPShield = false;
          loserFish.speed = loserFish.maximumSpeed * 1.5;
          loserFish.nameVisibleTimer = 5.0;
          const loserName =
            loserId === this.state.fighter1?.id
              ? this.state.fighter1?.name
              : this.state.fighter2?.name || "";
          this.onEvent?.({
            type: "eat",
            text: `🛡️ ${loserName} đã kích hoạt Linh Khiên Kim Cương thoát chết trong gang tấc!`,
            user: loserName,
          });
        } else if (loserIdx >= 0) {
          school.removeFish(loserIdx);
        }

        // Return to idle
        this.state.phase = "idle";
        this.state.fighter1 = null;
        this.state.fighter2 = null;
        this.state.winnerId = null;
      }
    }
  }

  public reset(): void {
    this.state.phase = "idle";
    this.state.timer = 0;
    this.state.fighter1 = null;
    this.state.fighter2 = null;
    this.state.winnerId = null;
    this.state.waitingChallenger = null;
  }
}
