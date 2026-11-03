import * as THREE from "three";
import {
  FISH,
  KOI_PALETTES,
  KOI_PATTERN_PATCHES,
  type KoiPatchSetting,
} from "./config";

export enum KoiPattern {
  Kohaku,
  Sanke,
  Showa,
  Ogon,
  Tancho,
  Shiro,
}

export interface FishAppearance {
  pattern: KoiPattern;
  base: THREE.Color;
  accent: THREE.Color;
  marking: THREE.Color;
  fin: THREE.Color;
  eye: THREE.Color;
}

export const createFishAppearance = (index: number): FishAppearance => {
  const pattern = index % KOI_PALETTES.length;
  const palette = KOI_PALETTES[pattern];
  return {
    pattern,
    base: new THREE.Color(palette.base),
    accent: new THREE.Color(palette.accent),
    marking: new THREE.Color(palette.marking),
    fin: new THREE.Color(palette.fin),
    eye: new THREE.Color(FISH.eyeColor),
  };
};

export const patchesFor = (
  appearance: FishAppearance,
): readonly KoiPatchSetting[] => KOI_PATTERN_PATCHES[appearance.pattern];

export const RANDOM_KOI_PRESETS = [
  { name: "Kohaku", pattern: KoiPattern.Kohaku, base: 0xfaf5ee, accent: 0xdc2626, marking: 0x1f2937, fin: 0xf1f5f9 },
  { name: "Sanke", pattern: KoiPattern.Sanke, base: 0xffffff, accent: 0xe11d48, marking: 0x0f172a, fin: 0xf8fafc },
  { name: "Showa", pattern: KoiPattern.Showa, base: 0x18181b, accent: 0xea580c, marking: 0xf8fafc, fin: 0x27272a },
  { name: "Ogon Vàng", pattern: KoiPattern.Ogon, base: 0xf59e0b, accent: 0xd97706, marking: 0x78350f, fin: 0xfbbf24 },
  { name: "Tancho", pattern: KoiPattern.Tancho, base: 0xf8fafc, accent: 0xef4444, marking: 0x334155, fin: 0xf1f5f9 },
  { name: "Shiro", pattern: KoiPattern.Shiro, base: 0xffffff, accent: 0x18181b, marking: 0x475569, fin: 0xe2e8f0 },
  { name: "Ki-Utsuri", pattern: KoiPattern.Showa, base: 0x171717, accent: 0xfacc15, marking: 0xfef08a, fin: 0x262626 },
  { name: "Bạch Kim", pattern: KoiPattern.Ogon, base: 0xf1f5f9, accent: 0xcfd9e3, marking: 0x94a3b8, fin: 0xffffff },
  { name: "Sakura Hồng", pattern: KoiPattern.Kohaku, base: 0xfff1f2, accent: 0xf43f5e, marking: 0xbe123c, fin: 0xffe4e6 },
  { name: "Ngọc Bích", pattern: KoiPattern.Sanke, base: 0xf0fdfa, accent: 0x0d9488, marking: 0x134e4a, fin: 0xccfbf1 },
  { name: "Cam Lửa", pattern: KoiPattern.Ogon, base: 0xf97316, accent: 0xc2410c, marking: 0x7c2d12, fin: 0xfb923c },
  { name: "Tím Huyền", pattern: KoiPattern.Tancho, base: 0xf5f3ff, accent: 0x8b5cf6, marking: 0x4c1d95, fin: 0xede9fe },
];

export const createRandomFishAppearance = (): FishAppearance & { name: string } => {
  const chosen = RANDOM_KOI_PRESETS[Math.floor(Math.random() * RANDOM_KOI_PRESETS.length)];
  return {
    name: chosen.name,
    pattern: chosen.pattern,
    base: new THREE.Color(chosen.base),
    accent: new THREE.Color(chosen.accent),
    marking: new THREE.Color(chosen.marking),
    fin: new THREE.Color(chosen.fin),
    eye: new THREE.Color(FISH.eyeColor),
  };
};
