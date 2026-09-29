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
  leftChest: {
    label: "Left Chest",
    preferredView: "front",
    position: [
      7.78945,
      48.50131,
      13.25801
    ],
    normal: [
      0.07624,
      0.31561,
      0.94582
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  rightChest: {
    label: "Right Chest",
    preferredView: "front",
    position: [
      -7.93951,
      48.64093,
      11.77084
    ],
    normal: [
      -0.28976,
      0.14077,
      0.94669
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  back: {
    label: "Back",
    preferredView: "back",
    position: [
      1.89341,
      52.54543,
      -8.89183
    ],
    normal: [
      0.25518,
      0.07171,
      -0.96423
    ],
    scale: 0.3,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  leftSleeve: {
    label: "Left Sleeve",
    preferredView: "left",
    position: [
      -24.7342,
      49.40743,
      -1.86493
    ],
    normal: [
      -0.95853,
      0.2382,
      0.15645
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  rightSleeve: {
    label: "Right Sleeve",
    preferredView: "right",
    position: [
      25.96497,
      49.31998,
      2.33814
    ],
    normal: [
      0.89057,
      0.18434,
      0.41582
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  }
};

export const PLACEMENT_KEYS = Object.keys(PLACEMENTS) as PlacementKey[];
