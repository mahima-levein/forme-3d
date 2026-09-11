import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LogoCanvasTexture } from "./logo-texture";
import {
  PLACEMENTS,
  type AvailablePlacement,
  type LogoSettings,
  type PlacementKey,
  type ProductView,
} from "./types";

const DEFAULT_SETTINGS: LogoSettings = { size: 0.55, x: 0, y: 0, rotation: 0 };
const VIEW_DIRECTIONS: Record<ProductView, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
};

const requiredElement = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing customizer element: ${selector}`);
  return element;
};

class CoverallCustomizer {
  private readonly dialog: HTMLDialogElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly viewer: HTMLElement;
  private readonly loading: HTMLElement;
  private readonly error: HTMLElement;
  private readonly placementSelect: HTMLSelectElement;
  private readonly fileInput: HTMLInputElement;
  private readonly fileName: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly logoTexture = new LogoCanvasTexture();
  private readonly settings: LogoSettings = { ...DEFAULT_SETTINGS };
  private readonly printMaterials = new Map<PlacementKey, THREE.MeshBasicMaterial>();
  private availablePlacements: AvailablePlacement[] = [];
  private selectedPlacement: PlacementKey | null = null;
  private model: THREE.Group | null = null;
  private modelRadius = 1;
  private cameraDistance = 4;
  private targetCameraPosition: THREE.Vector3 | null = null;
  private animationFrame = 0;
  private initialized = false;
  private disposed = false;
  private previousBodyOverflow = "";
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly root: HTMLElement) {
    this.dialog = requiredElement(root, "[data-customizer-dialog]");
    this.canvas = requiredElement(root, "[data-three-canvas]");
    this.viewer = requiredElement(root, "[data-viewer]");
    this.loading = requiredElement(root, "[data-loading]");
    this.error = requiredElement(root, "[data-load-error]");
    this.placementSelect = requiredElement(root, "[data-placement]");
    this.fileInput = requiredElement(root, "[data-logo-input]");
    this.fileName = requiredElement(root, "[data-file-name]");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.addEventListener("start", () => { this.targetCameraPosition = null; });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.configureScene();
    this.bindEvents();
  }

  private configureScene(): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x66706c, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4, 6, 5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde8ff, 1.8);
    fill.position.set(-4, 2, 3);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xfff1df, 1.2);
    rim.position.set(1, 4, -5);
    this.scene.add(rim);
  }

  private bindEvents(): void {
    this.listen(requiredElement(this.root, "[data-open-customizer]"), "click", () => this.open());
    this.listen(requiredElement(this.root, "[data-close-customizer]"), "click", () => this.dialog.close());
    this.listen(this.dialog, "click", (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
    this.listen(this.dialog, "close", () => this.onClosed());
    this.listen(this.fileInput, "change", () => void this.loadLogo());
    this.listen(this.placementSelect, "change", () => this.selectPlacement(this.placementSelect.value as PlacementKey));

    for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-logo-setting]")) {
      this.listen(input, "input", () => {
        const key = input.dataset.logoSetting as keyof LogoSettings;
        this.settings[key] = Number(input.value);
        this.updateSettingOutput(input);
        this.updateLogo();
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-view]")) {
      this.listen(button, "click", () => this.moveToView(button.dataset.view as ProductView));
    }
    this.listen(requiredElement(this.root, "[data-reset]"), "click", () => this.reset());
  }

  private listen(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.cleanups.push(() => target.removeEventListener(type, handler));
  }

  private async open(): Promise<void> {
    if (!this.dialog.open) this.dialog.showModal();
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    this.resizeObserver.observe(this.viewer);
    this.resize();
    this.startRendering();
    if (!this.initialized) await this.loadModel();
  }

  private onClosed(): void {
    document.body.style.overflow = this.previousBodyOverflow;
    this.resizeObserver.unobserve(this.viewer);
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
  }

  private async loadModel(): Promise<void> {
    this.initialized = true;
    this.loading.hidden = false;
    this.error.hidden = true;
    try {
      const gltf = await new GLTFLoader().loadAsync("/models/industrial_coverall.glb");
      if (this.disposed) return;
      this.model = gltf.scene;
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          console.log("GLB mesh:", child.name);
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      this.scene.add(this.model);
      this.discoverPrintAreas();
      this.fitModel();
      this.loading.hidden = true;
    } catch (error) {
      console.error("Unable to load 3D preview.", error);
      this.loading.hidden = true;
      this.error.hidden = false;
    }
  }

  private discoverPrintAreas(): void {
    if (!this.model) return;
    this.availablePlacements = [];
    this.placementSelect.replaceChildren();
    for (const definition of PLACEMENTS) {
      const object = this.model.getObjectByName(definition.meshName);
      if (!(object instanceof THREE.Mesh)) {
        console.warn(`Missing optional GLB print mesh: ${definition.meshName}`);
        continue;
      }
      const mesh = object;
      const material = new THREE.MeshBasicMaterial({
        map: this.logoTexture.texture,
        transparent: true,
        alphaTest: 0.01,
        depthWrite: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      mesh.material = material;
      mesh.visible = false;
      this.printMaterials.set(definition.key, material);
      this.availablePlacements.push({ ...definition, mesh });
      this.placementSelect.add(new Option(definition.label, definition.key));
    }
    this.placementSelect.disabled = this.availablePlacements.length === 0;
    if (this.availablePlacements[0]) {
      this.selectedPlacement = this.availablePlacements[0].key;
      this.placementSelect.value = this.selectedPlacement;
    } else {
      this.placementSelect.add(new Option("No print areas available", ""));
      this.selectedPlacement = null;
    }
    this.updateLogo();
  }

  private fitModel(): void {
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.model.position.sub(centre);
    this.modelRadius = Math.max(size.x, size.y, size.z) / 2;
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const distanceForHeight = size.y / (2 * Math.tan(verticalFov / 2));
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect, 0.5));
    const distanceForWidth = size.x / (2 * Math.tan(horizontalFov / 2));
    this.cameraDistance = Math.max(distanceForHeight, distanceForWidth) * 1.2;
    this.camera.near = Math.max(this.modelRadius / 100, 0.01);
    this.camera.far = Math.max(this.cameraDistance * 10, 100);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = Math.max(this.modelRadius * 0.75, 0.1);
    this.controls.maxDistance = Math.max(this.cameraDistance * 2.5, this.controls.minDistance + 1);
    this.camera.position.copy(VIEW_DIRECTIONS.front).multiplyScalar(this.cameraDistance);
    this.camera.position.y = size.y * 0.02;
    this.controls.update();
  }

  private async loadLogo(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      this.fileName.textContent = "Choose a PNG, JPEG or WebP image.";
      this.fileInput.value = "";
      return;
    }
    try {
      await this.logoTexture.setFile(file);
      this.fileName.textContent = file.name;
      this.updateLogo();
    } catch {
      this.fileName.textContent = "Unable to read that image.";
      this.fileInput.value = "";
    }
  }

  private selectPlacement(key: PlacementKey): void {
    const placement = this.availablePlacements.find((entry) => entry.key === key);
    if (!placement) return;
    this.selectedPlacement = placement.key;
    this.updateLogo();
    this.moveToView(placement.preferredView);
  }

  private updateLogo(): void {
    this.logoTexture.redraw(this.settings);
    for (const placement of this.availablePlacements) {
      placement.mesh.visible = this.logoTexture.hasImage && placement.key === this.selectedPlacement;
      this.printMaterials.get(placement.key)!.needsUpdate = true;
    }
  }

  private moveToView(view: ProductView): void {
    const direction = VIEW_DIRECTIONS[view].clone();
    const currentDistance = Math.max(this.controls.getDistance(), this.cameraDistance);
    this.targetCameraPosition = direction.multiplyScalar(currentDistance);
    this.targetCameraPosition.y = this.camera.position.y * 0.25;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-view]")) {
      button.dataset.active = String(button.dataset.view === view);
    }
  }

  private reset(): void {
    Object.assign(this.settings, DEFAULT_SETTINGS);
    for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-logo-setting]")) {
      const key = input.dataset.logoSetting as keyof LogoSettings;
      input.value = String(this.settings[key]);
      this.updateSettingOutput(input);
    }
    this.fileInput.value = "";
    this.fileName.textContent = "PNG, JPEG or WebP";
    this.logoTexture.clear();
    this.selectedPlacement = this.availablePlacements[0]?.key ?? null;
    if (this.selectedPlacement) this.placementSelect.value = this.selectedPlacement;
    this.updateLogo();
    this.moveToView("front");
  }

  private updateSettingOutput(input: HTMLInputElement): void {
    const output = this.root.querySelector<HTMLOutputElement>(`[data-output="${input.dataset.logoSetting}"]`);
    if (!output) return;
    if (input.dataset.logoSetting === "rotation") output.value = `${input.value}°`;
    else if (input.dataset.logoSetting === "size") output.value = `${Math.round(Number(input.value) * 100)}%`;
    else output.value = `${input.value}%`;
  }

  private resize(): void {
    const width = this.viewer.clientWidth;
    const height = this.viewer.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private startRendering(): void {
    if (this.animationFrame) return;
    const render = () => {
      if (!this.dialog.open || this.disposed) {
        this.animationFrame = 0;
        return;
      }
      if (this.targetCameraPosition) {
        this.camera.position.lerp(this.targetCameraPosition, 0.1);
        if (this.camera.position.distanceTo(this.targetCameraPosition) < this.modelRadius * 0.005) {
          this.camera.position.copy(this.targetCameraPosition);
          this.targetCameraPosition = null;
        }
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.animationFrame = requestAnimationFrame(render);
    };
    this.animationFrame = requestAnimationFrame(render);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.cleanups.forEach((cleanup) => cleanup());
    this.controls.dispose();
    this.logoTexture.dispose();
    this.printMaterials.forEach((material) => material.dispose());
    this.model?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer.dispose();
    document.body.style.overflow = this.previousBodyOverflow;
  }
}

export const initializeCoverallCustomizer = (root: HTMLElement): (() => void) => {
  const customizer = new CoverallCustomizer(root);
  return () => customizer.dispose();
};
