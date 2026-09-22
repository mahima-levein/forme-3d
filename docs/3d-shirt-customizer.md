# 3D Shirt Customizer

This document describes the current 3D men's shirt customization feature, including the Astro modal, Three.js scene, GLB model loading, logo texture generation, print placements, user controls, lifecycle, and maintenance points.

## Feature summary

The feature opens a native HTML `<dialog>` containing an interactive Three.js preview of a men's shirt. A user can:

- rotate and zoom the shirt;
- jump to front, back, left, and right views;
- upload a PNG, JPEG, or WebP logo;
- choose a chest, back, or sleeve placement;
- resize, move, and rotate the logo; and
- reset the customizer.

The shirt is loaded from a GLB file. The uploaded logo is never stretched. It is drawn with CSS-like `contain` behavior onto a transparent HTML canvas, then that canvas becomes a `THREE.CanvasTexture` used by the selected print-area mesh.

## File structure

```text
public/
└── models/
    └── mens-shirt.glb                     # Current 3D shirt asset

src/
├── components/
│   └── ProductCustomizer.astro            # Modal markup and browser initialization
├── pages/
│   └── index.astro                        # Adds the 3D customizer to the page
└── scripts/
    └── product-customizer/
        ├── viewer.ts                      # Three.js scene and customizer behavior
        ├── logo-texture.ts                # Uploaded image -> canvas -> CanvasTexture
        └── types.ts                       # Shared types and placement definitions
```

The project uses `three` and `@types/three`, declared in `package.json`.

## High-level architecture

```text
ProductCustomizer.astro
        │
        ├── renders the button, dialog, canvas, and controls
        │
        └── calls initializeShirtCustomizer(root)
                        │
                        ▼
                    viewer.ts
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
 mens-shirt.glb   logo-texture.ts      types.ts
 GLTFLoader       transparent canvas   placements
 shirt mesh       CanvasTexture        view types
```

The Astro component owns the HTML interface. `viewer.ts` connects that interface to Three.js. `logo-texture.ts` owns all uploaded-logo image processing. `types.ts` is the configuration source for the available print locations.

## Page integration

The home page imports the component in `src/pages/index.astro`:

```astro
import ProductCustomizer3D from '../components/ProductCustomizer.astro';
```

It renders the component with:

```astro
<ProductCustomizer3D />
```

This 3D customizer is separate from `ProductCustomizerV3.tsx`, which is the existing 2D/Fabric product customization experience.

## Modal component

`src/components/ProductCustomizer.astro` contains the entire modal interface.

### Main elements

The component uses `data-*` attributes as stable JavaScript hooks:

| Selector | Purpose |
|---|---|
| `[data-shirt-customizer]` | Root element for one customizer instance |
| `[data-open-customizer]` | Opens the modal |
| `[data-customizer-dialog]` | Native HTML dialog |
| `[data-close-customizer]` | Closes the modal |
| `[data-viewer]` | Container used for responsive renderer sizing |
| `[data-three-canvas]` | Canvas used by `THREE.WebGLRenderer` |
| `[data-loading]` | Loading overlay shown while the GLB loads |
| `[data-load-error]` | Error message shown when model loading fails |
| `[data-logo-input]` | Logo file input |
| `[data-file-name]` | Selected file name or validation message |
| `[data-placement]` | Placement selector |
| `[data-logo-setting]` | Size, X, Y, and rotation range inputs |
| `[data-output]` | Visible value for a range input |
| `[data-view]` | Front, back, left, and right view buttons |
| `[data-reset]` | Resets the logo and camera |

### Dialog behavior

The component uses the browser's native `<dialog>` element and calls `showModal()` from `viewer.ts`. This provides modal semantics and keyboard focus handling from the browser.

The dialog can be closed by:

- the close button;
- clicking the dialog backdrop; or
- browser-native dialog behavior where supported.

While the dialog is open, page scrolling is disabled by setting `document.body.style.overflow = "hidden"`. The previous value is restored when the dialog closes.

### Responsive layout

On larger screens, the dialog has two columns:

- the 3D canvas on the left; and
- logo controls on the right.

At widths below 760 px, it changes to a single-column layout with the preview above the controls. The modal becomes full-screen on small devices.

### Initialization

The component's script finds every `[data-shirt-customizer]` root and initializes it once:

```ts
const dispose = initializeShirtCustomizer(root);
```

The `data-initialized` flag prevents duplicate initialization. The returned cleanup function is registered with `astro:before-swap`, allowing the feature to release Three.js and DOM resources before Astro replaces the page.

## Three.js viewer

`src/scripts/product-customizer/viewer.ts` contains the `ShirtCustomizer` class.

### Core Three.js objects

Each customizer creates:

- one `THREE.Scene`;
- one `THREE.PerspectiveCamera` with a 34-degree field of view;
- one transparent, antialiased `THREE.WebGLRenderer`;
- one `OrbitControls` instance; and
- one shared `LogoCanvasTexture`.

The renderer uses the sRGB color space and limits its pixel ratio to `2` to balance image quality and GPU cost on high-density displays.

The renderer background is transparent. The visible gray background comes from the HTML section behind the canvas.

### Orbit controls

`OrbitControls` allows mouse, touch, trackpad, and wheel interaction.

- Damping is enabled for smoother movement.
- Panning is disabled so users cannot lose the product off-screen.
- Zoom is limited after the model is measured.
- Starting a manual orbit cancels any automatic camera transition.

### Lighting

The scene uses four lights:

1. a hemisphere light for overall illumination;
2. a strong white key light from the upper front-right;
3. a cool fill light from the left; and
4. a warm rim light from behind.

This setup lights the shirt without requiring an HDR environment map.

## Model loading

The shirt is loaded only the first time the modal opens:

```ts
new GLTFLoader().loadAsync('/models/mens-shirt.glb')
```

The `initialized` flag prevents repeated network requests on later modal openings.

The current GLB contains one shirt mesh named `Mens_Shirt_3`. It does not contain dedicated print-area meshes.

### Axis correction

The source shirt uses Z as its vertical axis, while Three.js normally uses Y as up. The loaded scene is rotated 90 degrees around X:

```ts
model.rotation.x = Math.PI / 2;
```

If the model is replaced with an asset exported Y-up, this correction may need to be changed or removed.

### Automatic fitting

`fitModel()` calculates a `THREE.Box3` around the shirt and uses it to:

- find the model center;
- move the model center to the scene origin;
- measure its width, height, and depth;
- calculate a camera distance that fits both its width and height;
- set appropriate near and far clipping planes; and
- set minimum and maximum zoom distances.

Because this is calculated from the model bounds, the viewer is not tied to the shirt's original measurement units.

### Loading and error states

The loading overlay is visible while `GLTFLoader` is working. When loading succeeds, it is hidden. If loading fails, the loading state is hidden and the error panel is displayed.

Common model-loading failures include:

- a missing `public/models/mens-shirt.glb` file;
- a renamed model without a matching code change;
- an invalid or unsupported GLB; or
- missing texture data referenced by the model.

## Print placements

Placement definitions live in `src/scripts/product-customizer/types.ts`.

The available placements are:

| Key | Label | Preferred view | Relative anchor | Plane scale |
|---|---|---|---|---|
| `leftChest` | Left Chest | Front | `[-0.14, 0.18, 1]` | `0.20` |
| `rightChest` | Right Chest | Front | `[0.14, 0.18, 1]` | `0.20` |
| `back` | Back | Back | `[0, 0.08, -1]` | `0.36` |
| `leftSleeve` | Left Sleeve | Left | `[-1, 0.15, 0]` | `0.18` |
| `rightSleeve` | Right Sleeve | Right | `[1, 0.15, 0]` | `0.18` |

### How placement planes work

The shirt GLB is a single mesh, so print areas are generated at runtime. For every placement, `createPrintAreas()` creates:

- a square `THREE.PlaneGeometry`;
- a transparent `THREE.MeshBasicMaterial`; and
- a mesh positioned relative to the shirt's bounding box.

The plane size is based on the shirt width:

```ts
planeSize = shirtWidth * placement.scale
```

Anchor values use two forms:

- values between `-1` and `1`, such as `0.18`, position the plane relative to the measured shirt size;
- exact `-1` or `1` on an outer axis snap the plane just outside the corresponding bounding-box edge.

Front planes face forward. Back planes rotate 180 degrees around Y. Sleeve planes rotate 90 degrees around Y toward their corresponding side.

The planes use a small bounding-box-based offset, `renderOrder = 10`, and polygon offset to reduce flickering where the logo surface is close to the shirt.

Only the currently selected placement is visible, and only after a logo has been loaded.

### Important limitation

These print areas are flat planes. They do not deform around the shirt surface and are not UV regions embedded in the GLB. If a future shirt is strongly curved, posed, or animated, the placement implementation may need decals, authored print meshes, or a shader-based texture compositing approach.

## Logo texture pipeline

`src/scripts/product-customizer/logo-texture.ts` implements the required pipeline:

```text
uploaded image
      ↓
HTML Canvas
      ↓
THREE.CanvasTexture
      ↓
selected Three.js print plane
```

### Canvas creation

`LogoCanvasTexture` creates an in-memory 1024 × 1024 canvas. A normal canvas starts transparent, and the class clears it before every redraw:

```ts
context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
```

No background color is painted, so unused texture pixels remain transparent.

### Loading an uploaded image

The UI accepts:

- `image/png`;
- `image/jpeg`; and
- `image/webp`.

The selected `File` is converted to a temporary object URL. An `HTMLImageElement` loads and decodes that URL asynchronously. The previous object URL is revoked before a replacement is created, preventing unused browser-memory references from accumulating.

JPEG files do not contain transparency, but the surrounding canvas remains transparent. PNG and WebP transparency is preserved.

### Aspect-ratio preservation

The logo uses `contain` behavior. Its original aspect ratio is calculated as:

```ts
aspect = naturalWidth / naturalHeight
```

The largest logo dimension is set from the size control. The other dimension is derived from the image aspect ratio:

```ts
if (aspect >= 1) {
  width = maxDimension
  height = maxDimension / aspect
} else {
  width = maxDimension * aspect
  height = maxDimension
}
```

This means:

- landscape logos are limited by width;
- portrait logos are limited by height; and
- neither dimension is independently stretched.

The final `drawImage()` call receives the calculated width and height, so the uploaded artwork keeps its natural proportions.

### Logo transforms

Before drawing the logo, the canvas context:

1. moves to the requested center position;
2. rotates by the requested angle; and
3. draws the image centered around that point.

The X and Y controls modify the logo's center within the canvas rather than moving the Three.js placement plane.

### CanvasTexture configuration

The canvas is wrapped in `THREE.CanvasTexture` and configured with:

- `SRGBColorSpace` for correct logo color;
- `flipY = false` for the expected plane orientation;
- clamp-to-edge wrapping;
- generated mipmaps; and
- linear mipmap filtering.

After every clear or redraw, `texture.needsUpdate = true` tells Three.js to upload the latest canvas pixels to the GPU.

## Logo material

Every print plane receives a `THREE.MeshBasicMaterial` using the shared canvas texture.

Important material settings are:

- `transparent: true` so cleared canvas pixels reveal the shirt;
- `alphaTest: 0.01` to discard almost fully transparent fragments;
- `side: THREE.DoubleSide` so the plane remains renderable from either side;
- `toneMapped: false` so scene lighting does not alter logo colors; and
- polygon offset to reduce z-fighting.

`MeshBasicMaterial` is intentionally unaffected by lights. The logo therefore stays visually consistent while the shirt itself responds to the GLB's material and scene lighting.

## Controls and state

The default logo settings are:

```ts
{
  size: 0.55,
  x: 0,
  y: 0,
  rotation: 0
}
```

### Size

The size slider ranges from `0.20` to `1.00`. It controls the maximum logo dimension as a percentage of the 1024-pixel texture canvas.

### Horizontal and vertical position

X and Y range from `-50` to `50`. These values are converted into travel distances within the canvas. The calculation allows useful movement while keeping part of the logo near the texture area.

### Rotation

Rotation ranges from `-180` to `180` degrees. The value is converted to radians for the Canvas 2D API.

### Placement selector

The selector is disabled until the model has loaded and its print planes have been created. Selecting a placement:

1. updates the active placement;
2. hides the old placement plane;
3. shows the new plane if a logo exists; and
4. moves the camera toward that placement's preferred view.

### Product view buttons

The four buttons map to fixed camera directions:

| View | Direction vector |
|---|---|
| Front | `(0, 0, 1)` |
| Back | `(0, 0, -1)` |
| Left | `(-1, 0, 0)` |
| Right | `(1, 0, 0)` |

The camera moves smoothly using linear interpolation in the animation loop. Users can interrupt an automatic transition by dragging the model.

### Reset

Reset performs all of the following:

- restores the default size, X, Y, and rotation values;
- updates all visible control values;
- clears the file input and displayed file name;
- removes the uploaded image from the transparent canvas;
- revokes its object URL;
- selects the first placement; and
- returns the camera to the front view.

## Rendering lifecycle

The animation loop only runs while the dialog is open.

When opened:

1. the modal is displayed;
2. body scrolling is disabled;
3. the viewer starts observing size changes;
4. the renderer is resized;
5. the animation loop starts; and
6. the model is loaded if this is the first opening.

On every frame:

1. an active camera transition is interpolated;
2. orbit-control damping is updated;
3. the Three.js scene is rendered; and
4. the next frame is requested.

When closed, the resize observer stops and the animation frame is cancelled. The loaded model remains in memory so reopening the modal is immediate.

## Responsive resizing

A `ResizeObserver` watches the preview container while the modal is open. When its size changes, the viewer:

- updates the WebGL renderer dimensions;
- updates the camera aspect ratio; and
- recalculates the camera projection matrix.

This covers window resizing and the modal's desktop/mobile layout change.

## Cleanup

`dispose()` releases resources when the Astro page is replaced:

- cancels the animation frame;
- disconnects the resize observer;
- removes registered DOM event listeners;
- disposes `OrbitControls`;
- clears and disposes the canvas texture;
- disposes print materials;
- disposes model geometry and materials;
- disposes the WebGL renderer; and
- restores body overflow.

Keeping this cleanup is important for preventing duplicate listeners and GPU-memory leaks during Astro client-side navigation.

## Replacing the shirt model

To replace the model while keeping the same filename:

1. replace `public/models/mens-shirt.glb`;
2. confirm the model is a valid self-contained GLB;
3. check whether it is Y-up or Z-up;
4. update or remove the X-axis correction in `loadModel()` if necessary;
5. verify front and back orientation;
6. adjust placement anchors and scales in `types.ts`; and
7. run the project build.

To use a different filename, also update the path passed to `GLTFLoader.loadAsync()` and the modal's model-loading error message.

The model may contain one mesh or several meshes. The current placement system does not depend on mesh names because it creates its own logo planes from the complete model bounds.

## Adding or changing placements

Edit the `PLACEMENTS` array in `src/scripts/product-customizer/types.ts`.

A placement requires:

```ts
{
  key: 'uniqueKey',
  label: 'Visible Label',
  preferredView: 'front',
  anchor: [x, y, z],
  scale: 0.2
}
```

Also add a new key to the `PlacementKey` union. If the placement requires an orientation other than front, back, left, or right, update `createPrintAreas()` to apply the correct plane rotation.

## Troubleshooting

### The model does not appear

- Confirm `public/models/mens-shirt.glb` exists.
- Confirm the browser can request `/models/mens-shirt.glb`.
- Check the browser console for a `GLTFLoader` error.
- Verify the GLB is valid and contains renderable mesh geometry.

### The model is sideways or upside down

The replacement asset probably uses a different up axis. Adjust this line in `loadModel()`:

```ts
model.rotation.x = Math.PI / 2
```

### Front and back are reversed

The new asset faces the opposite Z direction. Adjust `VIEW_DIRECTIONS` and the front/back print-plane rotations together.

### The logo is stretched

Logo width and height must continue to be calculated from `image.naturalWidth / image.naturalHeight`. Do not set both logo dimensions independently. Keep the uploaded-image-to-canvas-to-`CanvasTexture` pipeline.

### The logo has a solid background

- Use a transparent PNG or WebP if the artwork itself needs transparency.
- Do not fill the logo canvas with a color.
- Keep the print material's `transparent` option enabled.

### The logo flickers against the shirt

The plane may be too close to the shirt surface. Adjust the calculated `offset`, polygon offset, or placement anchor. Large changes can make the logo appear to float.

### The logo floats away from a curved area

This is a limitation of flat print planes. Use authored print meshes, decals, or shader-based projection for models requiring surface-conforming artwork.

### The logo looks blurry

The texture is currently 1024 × 1024. Increasing `TEXTURE_SIZE` can improve large-logo detail but consumes more GPU memory and makes texture uploads more expensive.

## Build and development

Install dependencies if needed, then use the project's existing scripts:

```bash
npm run dev
npm run build
npm exec astro check
```

In this project environment, the Astro development server should be started in background mode according to the repository instructions.

## Current design decisions

- The GLB is loaded lazily on the first modal opening.
- The model is kept in memory between modal openings.
- The logo exists only in browser memory and is not uploaded to a server.
- One placement is visible at a time.
- All placements share the same canvas texture and transformation settings.
- Print areas are generated from the shirt bounds instead of GLB mesh names.
- The logo uses a transparent canvas and aspect-ratio-preserving `contain` sizing.
- The 3D customizer is independent from the separate 2D/Fabric customizer.

