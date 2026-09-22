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

export type PlacementConfig = {
  label: string;
  preferredView: ProductView;
  /** Position in the target mesh's local coordinate system. */
  position: [number, number, number];
  /** Surface normal in the target mesh's local coordinate system. */
  normal: [number, number, number];
  /** Projector width relative to the fitted model's largest dimension. */
  scale: number;
  /** Developer-calibrated rotation around the surface normal, in degrees. */
  rotation: number;
  meshName?: string;
};

/**
 * Surface placements are intentionally initialized as uncalibrated.
 * Enable PLACEMENT_DEBUG in viewer.ts, click each real garment surface, then
 * copy the logged values here to make them permanent across page loads.
 */
export const PLACEMENTS: Record<PlacementKey, PlacementConfig> = {
  leftChest: { label: "Left Chest", preferredView: "front", position: [0, 0, 0], normal: [0, 0, 1], scale: 0.18, rotation: 0 },
  rightChest: { label: "Right Chest", preferredView: "front", position: [0, 0, 0], normal: [0, 0, 1], scale: 0.18, rotation: 0 },
  back: { label: "Back", preferredView: "back", position: [0, 0, 0], normal: [0, 0, -1], scale: 0.3, rotation: 0 },
  leftSleeve: { label: "Left Sleeve", preferredView: "left", position: [0, 0, 0], normal: [-1, 0, 0], scale: 0.14, rotation: 0 },
  rightSleeve: { label: "Right Sleeve", preferredView: "right", position: [0, 0, 0], normal: [1, 0, 0], scale: 0.14, rotation: 0 },
};

export const PLACEMENT_KEYS = Object.keys(PLACEMENTS) as PlacementKey[];
