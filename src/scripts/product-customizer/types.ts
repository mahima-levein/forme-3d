import type { Mesh } from "three";

export type PlacementKey =
  | "leftChest"
  | "rightChest"
  | "back"
  | "leftSleeve"
  | "rightSleeve";

export type ProductView = "front" | "back" | "left" | "right";

export type LogoSettings = {
  size: number;
  x: number;
  y: number;
  rotation: number;
};

export type PlacementDefinition = {
  key: PlacementKey;
  label: string;
  meshName: string;
  preferredView: ProductView;
};

export type AvailablePlacement = PlacementDefinition & {
  mesh: Mesh;
};

export const PLACEMENTS: readonly PlacementDefinition[] = [
  { key: "leftChest", label: "Left Chest", meshName: "LEFT_CHEST_PRINT", preferredView: "front" },
  { key: "rightChest", label: "Right Chest", meshName: "RIGHT_CHEST_PRINT", preferredView: "front" },
  { key: "back", label: "Back", meshName: "BACK_PRINT", preferredView: "back" },
  { key: "leftSleeve", label: "Left Sleeve", meshName: "LEFT_SLEEVE_PRINT", preferredView: "left" },
  { key: "rightSleeve", label: "Right Sleeve", meshName: "RIGHT_SLEEVE_PRINT", preferredView: "right" },
] as const;

