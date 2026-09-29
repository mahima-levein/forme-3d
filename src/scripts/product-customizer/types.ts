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
      8.00506,
      13.30794,
      -48.27851
    ],
    normal: [
      0.09508,
      0.97306,
      -0.21005
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  rightChest: {
    label: "Right Chest",
    preferredView: "front",
    position: [
      -8.96305,
      11.37465,
      -48.34653
    ],
    normal: [
      -0.39097,
      0.91366,
      -0.11122
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  back: {
    label: "Back",
    preferredView: "back",
    position: [
      2.00625,
      -8.91172,
      -52.31657
    ],
    normal: [
      0.25089,
      -0.93652,
      -0.24492
    ],
    scale: 0.3,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  leftSleeve: {
    label: "Left Sleeve",
    preferredView: "left",
    position: [
      -24.55068,
      -2.06773,
      -50.18243
    ],
    normal: [
      -0.95945,
      0.11308,
      -0.25821
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  },
  rightSleeve: {
    label: "Right Sleeve",
    preferredView: "right",
    position: [
      25.64731,
      2.54216,
      -50.34515
    ],
    normal: [
      0.92552,
      0.29862,
      -0.23291
    ],
    scale: 0.18,
    rotation: 0,
    meshName: "Mens_Shirt_3"
  }
};

export const PLACEMENT_KEYS = Object.keys(PLACEMENTS) as PlacementKey[];
