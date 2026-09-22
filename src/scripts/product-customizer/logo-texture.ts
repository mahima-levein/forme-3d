import * as THREE from "three";
import type { LogoSettings } from "./types";

const TEXTURE_SIZE = 1024;

export class LogoCanvasTexture {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private objectUrl: string | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = TEXTURE_SIZE;
    this.canvas.height = TEXTURE_SIZE;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable.");
    this.context = context;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // DecalGeometry generates conventional bottom-left UVs. Canvas pixel data
    // starts at the top-left, so Three.js must flip it vertically during upload
    // to keep the decal identical to the user's uploaded image.
    this.texture.flipY = true;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
  }

  async setFile(file: File): Promise<void> {
    this.revokeObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    try {
      await image.decode();
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
    this.objectUrl = objectUrl;
    this.image = image;
  }

  redraw(settings: LogoSettings): void {
    const { context, image } = this;
    context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    if (!image) {
      this.texture.needsUpdate = true;
      return;
    }

    const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
    const maxDimension = TEXTURE_SIZE * settings.size;
    const width = aspect >= 1 ? maxDimension : maxDimension * aspect;
    const height = aspect >= 1 ? maxDimension / aspect : maxDimension;
    const travelX = Math.max(TEXTURE_SIZE * 0.08, (TEXTURE_SIZE - width * 0.25) / 2);
    const travelY = Math.max(TEXTURE_SIZE * 0.08, (TEXTURE_SIZE - height * 0.25) / 2);
    const centreX = TEXTURE_SIZE / 2 + (settings.x / 50) * travelX;
    const centreY = TEXTURE_SIZE / 2 + (settings.y / 50) * travelY;

    context.save();
    context.translate(centreX, centreY);
    context.rotate((settings.rotation * Math.PI) / 180);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
    this.texture.needsUpdate = true;
  }

  clear(): void {
    this.image = null;
    this.revokeObjectUrl();
    this.context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    this.texture.needsUpdate = true;
  }

  get hasImage(): boolean {
    return this.image !== null;
  }

  dispose(): void {
    this.clear();
    this.texture.dispose();
  }

  private revokeObjectUrl(): void {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
