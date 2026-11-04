import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import type { School } from "./school";
import { length, sub, type Vec2 } from "./math";

export interface FoodPellet {
  id: number;
  position: Vec2;
  user: string;
  avatar?: string;
  life: number;
  maxLife: number;
  size: number;
  eaten: boolean;
  showTag?: boolean;
}

export interface FloatingAlert {
  id: number;
  text: string;
  position: Vec2;
  opacity: number;
}

export class FoodSystem {
  public pellets: FoodPellet[] = [];
  public alerts: FloatingAlert[] = [];
  private nextId = 1;

  public spawn(point: Vec2, user: string, avatar?: string, showTag = true): FoodPellet {
    const pellet: FoodPellet = {
      id: this.nextId++,
      position: {
        x: Math.max(20, Math.min(CANVAS_WIDTH - 20, point.x)),
        y: Math.max(20, Math.min(CANVAS_HEIGHT - 20, point.y)),
      },
      user: user || "Người xem",
      avatar,
      life: 18.0,
      maxLife: 18.0,
      size: 3.5,
      eaten: false,
      showTag,
    };
    this.pellets.push(pellet);
    if (this.pellets.length > 60) this.pellets.shift();
    return pellet;
  }

  public update(dt: number, school: School): void {
    // Update active pellets
    for (const pellet of this.pellets) {
      if (pellet.eaten) continue;
      pellet.life -= dt;
      if (pellet.life <= 0) {
        pellet.eaten = true;
        continue;
      }

      // Check collision with any koi
      for (let i = 0; i < school.count; i++) {
        const fish = school.fish[i];
        if (fish.isBeingFished) continue;

        const dist = length(sub(fish.position, pellet.position));
        if (dist < 15) {
          pellet.eaten = true;
          school.ripples.trigger("mouth", pellet.position);
          fish.gulpAnimation = 0.6;

          // Refill hunger & grow if owned
          if (fish.ownerId) {
            fish.hungerTimeLeft = fish.maxHungerTime;
            fish.hunger = 100;
            fish.eatCount += 1;
            // Visually grow fish body with eating (scaled larger for Thần Long)
            fish.updateDimensions();
          }

          // Spawn floating text alert
          this.alerts.push({
            id: this.nextId++,
            text: fish.ownerName
              ? `${fish.ownerName} luyện linh đan! 💊 (${fish.tuTien.badge} ${fish.sizeCm}cm)`
              : `+1 Linh đan! ✨`,
            position: { ...pellet.position },
            opacity: 1.0,
          });
          if (this.alerts.length > 15) this.alerts.shift();
          break;
        }
      }
    }

    this.pellets = this.pellets.filter((p) => !p.eaten && p.life > 0);

    // Update floating alerts
    for (const alert of this.alerts) {
      alert.position.y -= dt * 15; // Float upwards
      alert.opacity -= dt * 0.8;   // Fade out
    }
    this.alerts = this.alerts.filter((a) => a.opacity > 0);
  }
}
