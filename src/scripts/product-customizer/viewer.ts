import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import { LogoCanvasTexture } from "./logo-texture";
import {
  PLACEMENTS,
  PLACEMENT_KEYS,
  type LogoSettings,
  type PlacementConfig,
  type PlacementKey,
  type ProductView,
} from "./types";

const DEBUG_3D = false;
const PLACEMENT_DEBUG = true;

const MODEL_CONFIG = {
  rotation: new THREE.Euler(0, 0, 0),
  frontDirection: new THREE.Vector3(0, 0, 1),
};

const VIEW_DIRECTIONS: Record<ProductView, THREE.Vector3> = {
  front: MODEL_CONFIG.frontDirection.clone(),
  back: MODEL_CONFIG.frontDirection.clone().negate(),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
};

const DEFAULT_SETTINGS: LogoSettings = { size: 0.55, x: 0, y: 0, rotation: 0 };
const DECAL_DEPTH_RATIO = 0.12;

const requiredElement = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing customizer element: ${selector}`);
  return element;
};

const roundedTuple = (vector: THREE.Vector3): [number, number, number] =>
  vector.toArray().map((value) => Number(value.toFixed(5))) as [number, number, number];

class ShirtCustomizer {
  private readonly dialog: HTMLDialogElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly viewer: HTMLElement;
  private readonly loading: HTMLElement;
  private readonly error: HTMLElement;
  private readonly placementSelect: HTMLSelectElement;
  private readonly calibrationPanel: HTMLElement;
  private readonly calibrationSelect: HTMLSelectElement;
  private readonly calibrationStatus: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly fileName: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly logoTexture = new LogoCanvasTexture();
  private readonly settings: LogoSettings = { ...DEFAULT_SETTINGS };
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly decalMaterial: THREE.MeshBasicMaterial;
  private readonly garmentMeshes: THREE.Mesh[] = [];
  private selectedPlacement: PlacementKey = PLACEMENT_KEYS[0];
  private calibrationPlacement: PlacementKey = PLACEMENT_KEYS[0];
  private model: THREE.Group | null = null;
  private decal: THREE.Mesh | null = null;
  private debugMarker: THREE.Mesh | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private modelSize = 1;
  private modelRadius = 1;
  private cameraDistance = 4;
  private targetCameraPosition: THREE.Vector3 | null = null;
  private animationFrame = 0;
  private initialized = false;
  private disposed = false;
  private previousBodyOverflow = "";
  private pointerStart: { x: number; y: number } | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly root: HTMLElement) {
    this.dialog = requiredElement(root, "[data-customizer-dialog]");
    this.canvas = requiredElement(root, "[data-three-canvas]");
    this.viewer = requiredElement(root, "[data-viewer]");
    this.loading = requiredElement(root, "[data-loading]");
    this.error = requiredElement(root, "[data-load-error]");
    this.placementSelect = requiredElement(root, "[data-placement]");
    this.calibrationPanel = requiredElement(root, "[data-calibration-panel]");
    this.calibrationSelect = requiredElement(root, "[data-calibration-placement]");
    this.calibrationStatus = requiredElement(root, "[data-calibration-status]");
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
    this.decalMaterial = new THREE.MeshBasicMaterial({
      map: this.logoTexture.texture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      toneMapped: false,
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.configureScene();
    this.populatePlacementControls();
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
    if (DEBUG_3D) {
      this.axesHelper = new THREE.AxesHelper(25);
      this.scene.add(this.axesHelper);
    }
  }

  private populatePlacementControls(): void {
    this.placementSelect.replaceChildren();
    this.calibrationSelect.replaceChildren();
    for (const key of PLACEMENT_KEYS) {
      const placement = PLACEMENTS[key];
      this.placementSelect.add(new Option(placement.label, key));
      this.calibrationSelect.add(new Option(`Calibrate ${placement.label}`, key));
    }
    this.placementSelect.value = this.selectedPlacement;
    this.calibrationSelect.value = this.calibrationPlacement;
    this.calibrationPanel.hidden = !PLACEMENT_DEBUG;
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
    this.listen(this.calibrationSelect, "change", () => {
      this.calibrationPlacement = this.calibrationSelect.value as PlacementKey;
      this.calibrationStatus.textContent = `Click the real ${PLACEMENTS[this.calibrationPlacement].label.toLowerCase()} surface on the shirt.`;
      this.moveToView(PLACEMENTS[this.calibrationPlacement].preferredView);
    });
    this.listen(this.canvas, "pointerdown", (event) => {
      const pointerEvent = event as PointerEvent;
      this.pointerStart = { x: pointerEvent.clientX, y: pointerEvent.clientY };
    });
    this.listen(this.canvas, "pointerup", (event) => this.handleCalibrationPointer(event as PointerEvent));
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
      const gltf = await new GLTFLoader().loadAsync("/models/mens-shirt.glb");
      if (this.disposed) return;
      this.model = gltf.scene;
      this.model.rotation.copy(MODEL_CONFIG.rotation);
      this.model.updateMatrixWorld(true);
      this.model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = false;
        child.receiveShadow = false;
        this.garmentMeshes.push(child);
        if (DEBUG_3D) console.log("GLB mesh:", child.name);
      });
      this.scene.add(this.model);
      this.fitModel();
      this.placementSelect.disabled = false;
      this.loading.hidden = true;
      this.updateLogo();
    } catch (error) {
      console.error("Unable to load 3D preview.", error);
      this.loading.hidden = true;
      this.error.hidden = false;
    }
  }

  private fitModel(): void {
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.model.position.sub(centre);
    this.model.updateMatrixWorld(true);
    this.modelSize = Math.max(size.x, size.y, size.z);
    this.modelRadius = this.modelSize / 2;
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

  private handleCalibrationPointer(event: PointerEvent): void {
    if (!PLACEMENT_DEBUG || !this.pointerStart || !this.model) return;
    const travel = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    this.pointerStart = null;
    if (travel > 5) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.garmentMeshes, false)[0];
    if (!hit || !(hit.object instanceof THREE.Mesh) || !hit.face) {
      this.calibrationStatus.textContent = "No garment surface was hit. Rotate the shirt and try again.";
      return;
    }
    const mesh = hit.object;
    const worldNormal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
    const localPosition = mesh.worldToLocal(hit.point.clone());
    const localNormal = hit.face.normal.clone().normalize();
    const placement = PLACEMENTS[this.calibrationPlacement];
    placement.position = roundedTuple(localPosition);
    placement.normal = roundedTuple(localNormal);
    placement.meshName = mesh.name;
    this.showDebugMarker(hit.point, worldNormal);
    this.calibrationStatus.textContent = `${placement.label} calibrated on ${mesh.name || "unnamed mesh"}. Copy the configuration from the console.`;
    this.logPlacement(this.calibrationPlacement, placement, hit.point, worldNormal);
    if (this.selectedPlacement === this.calibrationPlacement) this.updateLogo();
  }

  private showDebugMarker(point: THREE.Vector3, normal: THREE.Vector3): void {
    if (this.debugMarker) {
      this.scene.remove(this.debugMarker);
      this.debugMarker.geometry.dispose();
      (this.debugMarker.material as THREE.Material).dispose();
    }
    const size = Math.max(this.modelSize * 0.012, 0.01);
    this.debugMarker = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false }));
    this.debugMarker.position.copy(point).addScaledVector(normal, size * 0.5);
    this.debugMarker.renderOrder = 20;
    this.scene.add(this.debugMarker);
  }

  private logPlacement(key: PlacementKey, placement: PlacementConfig, worldPosition: THREE.Vector3, worldNormal: THREE.Vector3): void {
    const readyToCopy = { [key]: { ...placement } };
    console.group(`Placement: ${placement.label}`);
    console.log("Mesh:", placement.meshName || "unnamed mesh");
    console.log("Position:", roundedTuple(worldPosition));
    console.log("Normal:", roundedTuple(worldNormal));
    console.log("Ready-to-copy local configuration:", JSON.stringify(readyToCopy, null, 2));
    console.groupEnd();
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
    if (!PLACEMENTS[key]) return;
    this.selectedPlacement = key;
    this.updateLogo();
    this.moveToView(PLACEMENTS[key].preferredView);
  }

  private updateLogo(): void {
    this.logoTexture.redraw(this.settings);
    this.decalMaterial.needsUpdate = true;
    this.rebuildDecal();
  }

  private rebuildDecal(): void {
    this.removeDecal();
    if (!this.model || !this.logoTexture.hasImage) return;
    const placement = PLACEMENTS[this.selectedPlacement];
    if (!placement.meshName) {
      console.warn(`Placement "${placement.label}" is not calibrated yet.`);
      return;
    }
    const target = this.model.getObjectByName(placement.meshName);
    if (!(target instanceof THREE.Mesh)) {
      console.warn(`Placement "${placement.label}" references missing mesh "${placement.meshName}".`);
      return;
    }
    target.updateWorldMatrix(true, false);
    const position = target.localToWorld(new THREE.Vector3().fromArray(placement.position));
    const normal = new THREE.Vector3().fromArray(placement.normal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(target.matrixWorld)).normalize();
    const orientation = this.projectorOrientation(normal, placement.rotation + this.settings.rotation);
    const width = Math.max(this.modelSize * placement.scale, 0.001);
    const size = new THREE.Vector3(width, width, Math.max(width * DECAL_DEPTH_RATIO, 0.001));
    const geometry = new DecalGeometry(target, position, orientation, size);
    this.decal = new THREE.Mesh(geometry, this.decalMaterial);
    this.decal.renderOrder = 10;
    this.scene.add(this.decal);
  }

  private projectorOrientation(normal: THREE.Vector3, rotationDegrees: number): THREE.Euler {
    const z = normal.clone().normalize();
    const referenceUp = Math.abs(z.dot(THREE.Object3D.DEFAULT_UP)) > 0.98 ? new THREE.Vector3(0, 0, 1) : THREE.Object3D.DEFAULT_UP.clone();
    const x = referenceUp.clone().cross(z).normalize();
    const y = z.clone().cross(x).normalize();
    const surfaceQuaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(rotationDegrees));
    return new THREE.Euler().setFromQuaternion(surfaceQuaternion.multiply(twist), "XYZ");
  }

  private removeDecal(): void {
    if (!this.decal) return;
    this.scene.remove(this.decal);
    this.decal.geometry.dispose();
    this.decal = null;
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
    this.selectedPlacement = PLACEMENT_KEYS[0];
    this.placementSelect.value = this.selectedPlacement;
    this.removeDecal();
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
    this.removeDecal();
    this.decalMaterial.dispose();
    this.logoTexture.dispose();
    if (this.debugMarker) {
      this.debugMarker.geometry.dispose();
      (this.debugMarker.material as THREE.Material).dispose();
    }
    this.axesHelper?.dispose();
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

export const initializeShirtCustomizer = (root: HTMLElement): (() => void) => {
  const customizer = new ShirtCustomizer(root);
  return () => customizer.dispose();
};
