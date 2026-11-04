import type { Vec2 } from "./math";

export type PvpArenaPhase = "idle" | "summon" | "fighting" | "knockout";

export interface PvpFighter {
  id: string;
  name: string;
  avatar: string;
  targetFishId?: string;
  score: number;       // Push momentum/cheer score
  offsetDistance: number; // Distance from center along combat axis
}

export interface PvpArenaState {
  phase: PvpArenaPhase;
  center: Vec2;
  radius: number;          // Combat ring boundary (~110px)
  spectatorRadius: number; // Spectator fish circle (~155px)
  timer: number;
  fighter1: PvpFighter | null;
  fighter2: PvpFighter | null;
  winnerId: string | null;
  kingId: string | null;
  kingName: string | null;
  waitingChallenger: { id: string; name: string; avatar: string } | null;
}
