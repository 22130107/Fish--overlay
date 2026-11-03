import type { Vec2 } from "./math";

export interface LightningBolt {
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export class LightningEffect {
  private bolts: LightningBolt[] = [];
  private flashAlpha = 0;
  private strikeTimer = 0;

  public triggerBurstFlash(): void {
    this.flashAlpha = 0.65; // Bright golden-white screen flash
  }

  public updateAndRender(
    ctx: CanvasRenderingContext2D,
    dt: number,
    targetPos: Vec2,
    powerPercent: number,
    onStrike?: (pos: Vec2) => void
  ): void {
    this.strikeTimer -= dt;
    if (this.strikeTimer <= 0) {
      this.strikeTimer = 0.8 + Math.random() * 0.8; // Strike every ~1s
      this.spawnBolt(targetPos, powerPercent);
      this.flashAlpha = 0.22;
      onStrike?.(targetPos);
    }

    // Screen flash
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
    }

    // Render & update active bolts
    ctx.save();
    for (const bolt of this.bolts) {
      bolt.life -= dt;
      if (bolt.life <= 0) continue;

      const alpha = Math.max(0, bolt.life / bolt.maxLife);
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = bolt.width;
      ctx.lineCap = "round";
      ctx.shadowBlur = 12;
      ctx.shadowColor = bolt.color;
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      for (const seg of bolt.segments) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
    }
    ctx.restore();

    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    dt: number,
    targetPos: Vec2,
    powerPercent: number,
    onStrike?: (pos: Vec2) => void
  ): void {
    this.updateAndRender(ctx, dt, targetPos, powerPercent, onStrike);
  }

  public getBolts(): readonly LightningBolt[] {
    return this.bolts;
  }

  public getFlashAlpha(): number {
    return this.flashAlpha;
  }

  public spawnBolt(target: Vec2, powerPercent: number): void {
    const startX = target.x + (Math.random() - 0.5) * 80;
    const startY = 0;
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    let curX = startX;
    let curY = startY;
    const steps = 14;
    const dy = (target.y - startY) / steps;

    for (let i = 0; i < steps; i++) {
      const nextY = curY + dy;
      const nextX = curX + (Math.random() - 0.5) * 22;
      segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

      // Fork branch
      if (Math.random() < 0.35 && i < steps - 3) {
        const forkX = nextX + (Math.random() - 0.5) * 35;
        const forkY = nextY + dy * 0.7;
        segments.push({ x1: nextX, y1: nextY, x2: forkX, y2: forkY });
      }

      curX = nextX;
      curY = nextY;
    }
    // Connect to target
    segments.push({ x1: curX, y1: curY, x2: target.x, y2: target.y });

    const isGolden = powerPercent >= 80;
    const color = isGolden ? "#fbbf24" : Math.random() < 0.5 ? "#38bdf8" : "#c084fc";

    this.bolts.push({
      segments,
      life: 0.25,
      maxLife: 0.25,
      color,
      width: 2.5 + Math.random() * 1.5,
    });
  }

  public clear(): void {
    this.bolts = [];
    this.flashAlpha = 0;
    this.strikeTimer = 0;
  }
}
