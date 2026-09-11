import { useEffect, useRef } from "react";
import { Canvas, FabricImage, Rect, type FabricObject } from "fabric";

type RectSpec = { x: number; y: number; width: number; height: number };
type AreaSpec = { printRect: RectSpec; safeRect: RectSpec };
export type CanvasPlacement = {
  src: string;
  source: string;
  cx: number;
  cy: number;
  size: number;
  angle: number;
};

type Props = {
  active: boolean;
  source: string;
  area?: AreaSpec;
  placement?: CanvasPlacement;
  editing: boolean;
  onPlacementChange: (placement: CanvasPlacement) => void;
  onError: (message: string) => void;
};

type Transform = {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
};

const inside = (
  object: FabricObject,
  safe: { left: number; top: number; right: number; bottom: number },
) => {
  const box = object.getBoundingRect();
  return (
    box.left >= safe.left - 0.5 &&
    box.top >= safe.top - 0.5 &&
    box.left + box.width <= safe.right + 0.5 &&
    box.top + box.height <= safe.bottom + 0.5
  );
};

const snapshot = (object: FabricObject): Transform => ({
  left: object.left,
  top: object.top,
  scaleX: object.scaleX,
  scaleY: object.scaleY,
  angle: object.angle,
});

export default function FabricProductCanvas({
  active,
  source,
  area,
  placement,
  editing,
  onPlacementChange,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | undefined>(undefined);
  const changeRef = useRef(onPlacementChange);
  const errorRef = useRef(onError);
  changeRef.current = onPlacementChange;
  errorRef.current = onError;

  useEffect(() => {
    if (!elementRef.current) return;
    const canvas = new Canvas(elementRef.current, {
      preserveObjectStacking: true,
      selection: false,
      enableRetinaScaling: true,
    });
    canvasRef.current = canvas;
    return () => {
      canvasRef.current = undefined;
      void canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!active || !source || !area || !hostRef.current || !canvasRef.current)
      return;
    const canvas = canvasRef.current;
    let cancelled = false;
    let generation = 0;

    const rebuild = async () => {
      const run = ++generation;
      const host = hostRef.current;
      if (!host || host.clientWidth < 2 || host.clientHeight < 2) return;
      const width = Math.max(1, Math.round(host.clientWidth));
      const height = Math.max(1, Math.round(host.clientHeight));

      try {
        const base = await FabricImage.fromURL(source);
        if (cancelled || run !== generation) return;
        canvas.clear();
        canvas.setDimensions({ width, height });
        base.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          scaleX: width / (base.width || 1),
          scaleY: height / (base.height || 1),
          selectable: false,
          evented: false,
          excludeFromExport: false,
        });
        canvas.add(base);

        const print = area.printRect;
        const safeRect = area.safeRect;
        const safe = {
          left: safeRect.x * width,
          top: safeRect.y * height,
          right: (safeRect.x + safeRect.width) * width,
          bottom: (safeRect.y + safeRect.height) * height,
        };

        if (editing) {
          canvas.add(
            new Rect({
              left: print.x * width,
              top: print.y * height,
              originX: "left",
              originY: "top",
              width: print.width * width,
              height: print.height * height,
              fill: "transparent",
              stroke: "#222",
              strokeWidth: 1,
              selectable: false,
              evented: false,
              excludeFromExport: true,
            }),
          );
          canvas.add(
            new Rect({
              left: safe.left,
              top: safe.top,
              originX: "left",
              originY: "top",
              width: safeRect.width * width,
              height: safeRect.height * height,
              fill: "transparent",
              stroke: "#222",
              strokeWidth: 1.5,
              strokeDashArray: [10, 7],
              selectable: false,
              evented: false,
              excludeFromExport: true,
            }),
          );
        }

        if (placement) {
          const logo = await FabricImage.fromURL(placement.src);
          if (cancelled || run !== generation) return;
          const desiredWidth = placement.size * safeRect.width * width;
          const uniformScale = desiredWidth / (logo.width || 1);
          logo.set({
            left: safe.left + placement.cx * safeRect.width * width,
            top: safe.top + placement.cy * safeRect.height * height,
            originX: "center",
            originY: "center",
            scaleX: uniformScale,
            scaleY: uniformScale,
            angle: placement.angle,
            selectable: editing,
            evented: editing,
            hasControls: editing,
            hasBorders: editing,
            lockScalingFlip: true,
            centeredRotation: true,
            centeredScaling: true,
            transparentCorners: false,
            cornerColor: "#7547ed",
            cornerStrokeColor: "#ffffff",
            borderColor: "#7547ed",
            cornerStyle: "circle",
            cornerSize: 13,
            padding: 1,
            hoverCursor: "move",
            moveCursor: "move",
          });
          logo.setControlsVisibility({
            mt: false,
            mb: false,
            ml: false,
            mr: false,
          });
          logo.setCoords();
          const initialBox = logo.getBoundingRect();
          const fitRatio = Math.min(
            1,
            Math.min(
              (safe.right - safe.left) / initialBox.width,
              (safe.bottom - safe.top) / initialBox.height,
            ) * 0.98,
          );
          if (fitRatio < 1) {
            logo.set({
              scaleX: logo.scaleX * fitRatio,
              scaleY: logo.scaleY * fitRatio,
            });
          }
          logo.setCoords();
          let lastValid = snapshot(logo);

          const restore = () => {
            logo.set(lastValid);
            logo.setCoords();
            canvas.requestRenderAll();
          };
          const remember = () => {
            logo.setCoords();
            if (inside(logo, safe)) lastValid = snapshot(logo);
          };
          const clampMove = () => {
            logo.setCoords();
            const box = logo.getBoundingRect();
            let dx = 0;
            let dy = 0;
            if (box.left < safe.left) dx = safe.left - box.left;
            if (box.left + box.width > safe.right)
              dx = safe.right - box.left - box.width;
            if (box.top < safe.top) dy = safe.top - box.top;
            if (box.top + box.height > safe.bottom)
              dy = safe.bottom - box.top - box.height;
            logo.set({ left: logo.left + dx, top: logo.top + dy });
            logo.setCoords();
            if (inside(logo, safe)) lastValid = snapshot(logo);
          };
          clampMove();
          lastValid = snapshot(logo);
          const fittedPlacement = {
            ...placement,
            cx: (logo.left - safe.left) / (safeRect.width * width),
            cy: (logo.top - safe.top) / (safeRect.height * height),
            size: logo.getScaledWidth() / (safeRect.width * width),
            angle: logo.angle,
          };
          if (
            Math.abs(fittedPlacement.cx - placement.cx) > 0.0001 ||
            Math.abs(fittedPlacement.cy - placement.cy) > 0.0001 ||
            Math.abs(fittedPlacement.size - placement.size) > 0.0001
          )
            changeRef.current(fittedPlacement);
          const commit = () => {
            logo.setCoords();
            if (!inside(logo, safe)) restore();
            changeRef.current({
              ...placement,
              cx: (logo.left - safe.left) / (safeRect.width * width),
              cy: (logo.top - safe.top) / (safeRect.height * height),
              size: logo.getScaledWidth() / (safeRect.width * width),
              angle: logo.angle,
            });
          };

          canvas.add(logo);
          if (editing) {
            canvas.setActiveObject(logo);
            canvas.on("object:moving", clampMove);
            canvas.on("object:scaling", () =>
              inside(logo, safe) ? remember() : restore(),
            );
            canvas.on("object:rotating", () =>
              inside(logo, safe) ? remember() : restore(),
            );
            canvas.on("object:modified", commit);
          }
        }
        canvas.calcOffset();
        canvas.requestRenderAll();
      } catch {
        if (!cancelled)
          errorRef.current(
            "The product preview could not be loaded. Please retry.",
          );
      }
    };

    const observer = new ResizeObserver(() => void rebuild());
    observer.observe(hostRef.current);
    requestAnimationFrame(() => void rebuild());
    return () => {
      cancelled = true;
      generation++;
      observer.disconnect();
      canvas.off();
    };
  }, [
    active,
    source,
    area,
    editing,
    placement?.src,
    placement?.source,
    placement?.cx,
    placement?.cy,
    placement?.size,
    placement?.angle,
  ]);

  return (
    <div
      ref={hostRef}
      className={`h-full w-full ${editing ? "touch-none" : ""}`}
    >
      <canvas
        ref={elementRef}
        aria-label="Interactive product design preview"
      />
    </div>
  );
}
