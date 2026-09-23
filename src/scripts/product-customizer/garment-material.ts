import * as THREE from "three";

export type ColorMode = "tint" | "solid";

/**
 * "tint" multiplies the existing diffuse texture by the selected color, which
 * preserves fabric shading/weave detail. "solid" drops the diffuse texture
 * and uses a flat color instead, for GLBs whose baked texture is too strongly
 * colored for tinting to look right. Switch this if a future model needs it.
 */
export const DEFAULT_COLOR_MODE: ColorMode = "tint";

/**
 * Manual override: exact material names (case-insensitive) that should
 * always be treated as garment materials, bypassing the keyword heuristic
 * below. Leave empty to rely on automatic detection.
 */
export const GARMENT_MATERIAL_NAMES: string[] = [];

const GARMENT_NAME_KEYWORDS = ["shirt", "fabric", "body", "mens_shirt"];

export interface GarmentMaterialRecord {
  material: THREE.MeshStandardMaterial;
  originalColor: THREE.Color;
  originalMap: THREE.Texture | null;
  originalRoughness: number;
  originalMetalness: number;
}

const collectMeshMaterials = (model: THREE.Object3D): THREE.MeshStandardMaterial[] => {
  const seen = new Set<THREE.MeshStandardMaterial>();
  const materials: THREE.MeshStandardMaterial[] = [];
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of childMaterials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (seen.has(material)) continue;
      seen.add(material);
      materials.push(material);
      console.log("Mesh:", child.name, "Material:", material.name, "Map:", material.map);
    }
  });
  return materials;
};

export function findGarmentMaterials(model: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const materials = collectMeshMaterials(model);
  if (materials.length === 0) {
    console.warn("Garment material could not be identified.");
    return [];
  }

  if (GARMENT_MATERIAL_NAMES.length > 0) {
    const overrideNames = GARMENT_MATERIAL_NAMES.map((name) => name.toLowerCase());
    const overrideMatches = materials.filter((material) =>
      overrideNames.includes(material.name.toLowerCase()),
    );
    if (overrideMatches.length > 0) return overrideMatches;
  }

  const keywordMatches = materials.filter((material) => {
    const name = material.name.toLowerCase();
    return GARMENT_NAME_KEYWORDS.some((keyword) => name.includes(keyword));
  });
  if (keywordMatches.length > 0) return keywordMatches;

  if (materials.length === 1) return materials;

  console.warn("Garment material could not be identified.");
  return [];
}

export function cloneGarmentMaterials(model: THREE.Object3D): GarmentMaterialRecord[] {
  const garmentMaterials = findGarmentMaterials(model);
  if (garmentMaterials.length === 0) return [];

  const clonesByOriginal = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
  for (const original of garmentMaterials) {
    clonesByOriginal.set(original, original.clone());
  }

  // A clone may be shared by more than one mesh (or material-array slot) if
  // the original material was shared; dispose() later disposes it once per
  // mesh that references it, which is safe because Material.dispose() is
  // idempotent.
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material;
        return clonesByOriginal.get(material) ?? material;
      });
    } else if (child.material instanceof THREE.MeshStandardMaterial) {
      const clone = clonesByOriginal.get(child.material);
      if (clone) child.material = clone;
    }
  });

  return garmentMaterials.map((original) => {
    const clone = clonesByOriginal.get(original)!;
    return {
      material: clone,
      originalColor: original.color.clone(),
      originalMap: original.map,
      originalRoughness: original.roughness,
      originalMetalness: original.metalness,
    };
  });
}

export function setGarmentColor(
  records: GarmentMaterialRecord[],
  hex: string,
  mode: ColorMode = DEFAULT_COLOR_MODE,
): void {
  for (const record of records) {
    record.material.color.set(hex);
    record.material.map = mode === "solid" ? null : record.originalMap;
    record.material.needsUpdate = true;
  }
}

export function restoreOriginalGarmentMaterial(records: GarmentMaterialRecord[]): void {
  for (const record of records) {
    record.material.color.copy(record.originalColor);
    record.material.map = record.originalMap;
    record.material.roughness = record.originalRoughness;
    record.material.metalness = record.originalMetalness;
    record.material.needsUpdate = true;
  }
}

/**
 * TODO: not wired up to any UI yet. A real implementation would neutralize a
 * strongly colored diffuse map toward grayscale (preserving luminance) before
 * multiplying in the selected garment color, likely via a custom shader
 * (`onBeforeCompile`) or an offscreen-canvas desaturation pass over
 * `originalMap`. The current GLB's base color texture isn't strongly colored,
 * so this isn't needed yet; left as a safe passthrough to keep the symbol
 * available without adding an unstable shader.
 */
export function applyNeutralizedFabricColor(record: GarmentMaterialRecord, hex: string): void {
  setGarmentColor([record], hex);
}
