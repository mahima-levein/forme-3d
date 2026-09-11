import { useRef, useState } from "react";
import catalog from "../data/customizer/catalog.generated.json";
import metadataFile from "../data/customizer/product-overrides.json";
import { assetUrl, sampleLogoUrls } from "../lib/customizer/assets";
import FabricProductCanvas from "./customizer/FabricProductCanvas";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Palette,
  Pencil,
  Shirt,
  X,
} from "lucide-react";

type View = "front" | "back" | "left" | "right";
type Panel = "home" | "placement" | "items" | "notes" | "products";
type Item = { id: number; colourId: string; sizeId: string; quantity: number };
type Placement = {
  src: string;
  source: string;
  cx: number;
  cy: number;
  size: number;
  angle: number;
};
type Design = {
  view: View;
  activeItem: number;
  items: Item[];
  placements: Partial<Record<View, Placement>>;
  notes: string;
};
const order: View[] = ["front", "back", "left", "right"];
const products = catalog.products as any[];
const metadata = (metadataFile as any).products as Record<string, any>;
const title = (v: View) =>
  ({
    front: "Front Logo",
    back: "Back Logo",
    left: "Left Sleeve",
    right: "Right Sleeve",
  })[v];
const makeDesign = (product: any): Design => {
  const colour = metadata[product.id]?.defaultColour ?? product.colours[0].id;
  return {
    view: "front",
    activeItem: 1,
    items: [{ id: 1, colourId: colour, sizeId: "", quantity: 1 }],
    placements: {},
    notes: "",
  };
};

export default function ProductCustomizerV3() {
  const dialog = useRef<HTMLDialogElement>(null);
  const nextItem = useRef(2);
  const defaultProduct =
    products.find((p) => p.id === "shirts/SET1") ?? products[0];
  const [productId, setProductId] = useState(defaultProduct.id);
  const [designs, setDesigns] = useState<Record<string, Design>>(() =>
    Object.fromEntries(products.map((p) => [p.id, makeDesign(p)])),
  );
  const [panel, setPanel] = useState<Panel>("home");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<Partial<Record<View, Placement>> | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState({ name: "", mobile: "", email: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState("");
  const product = products.find((p) => p.id === productId)!;
  const meta = metadata[productId] ?? {};
  const design = designs[productId];
  const item =
    design.items.find((x) => x.id === design.activeItem) ?? design.items[0];
  const colour =
    product.colours.find((x: any) => x.id === item.colourId) ??
    product.colours[0];
  const available = order.filter((v) => colour.views[v]);
  const view = colour.views[design.view] ? design.view : (available[0] as View);
  const photo = colour.views[view];
  const url = assetUrl(photo.assetKey);
  const area = meta.areas?.[view];
  const placement = design.placements[view];
  const setDesign = (fn: (d: Design) => Design) =>
    setDesigns((all) => ({ ...all, [productId]: fn(all[productId]) }));
  const patchPlacement = (v: View, next?: Placement) =>
    setDesign((d) => {
      const placements = { ...d.placements };
      if (next) placements[v] = next;
      else delete placements[v];
      return { ...d, view: v, placements };
    });
  const open = () => {
    dialog.current?.showModal();
    setIsOpen(true);
    setPanel("home");
  };
  const close = () => {
    setQuoteOpen(false);
    setIsOpen(false);
    dialog.current?.close();
  };
  const setView = (v: View) => setDesign((d) => ({ ...d, view: v }));
  const selectProduct = (id: string) => {
    setProductId(id);
    setPanel("home");
    setNotice("");
  };
  const setColour = async (id: string) => {
    const variant = product.colours.find((c: any) => c.id === id);
    if (!variant) return;
    const target = variant.views[view]
      ? view
      : ((variant.views.front
          ? "front"
          : order.find((v) => variant.views[v])) as View);
    const source = variant.views[target];
    const resolved = source && assetUrl(source.assetKey);
    if (!resolved) {
      setNotice(
        "That colour image is unavailable. Your current preview was kept.",
      );
      return;
    }
    setBusy(true);
    try {
      const image = new Image();
      image.src = resolved;
      await image.decode();
      setDesign((d) => ({
        ...d,
        view: target,
        items: d.items.map((x) =>
          x.id === d.activeItem ? { ...x, colourId: id, sizeId: "" } : x,
        ),
      }));
      if (target !== view)
        setNotice(
          `This colour opens on ${target} because the previous view is unavailable.`,
        );
      else setNotice("");
    } catch {
      setNotice("The selected colour could not be loaded. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  const addDefault = async (v: View) => {
    if (design.placements[v]) {
      const before = { ...design.placements };
      setUndo(before);
      patchPlacement(v);
      return;
    }
    const src = sampleLogoUrls.black;
    if (!src) {
      setNotice("Missing src/assets/logo-black.png.");
      return;
    }
    setBusy(true);
    try {
      const image = new Image();
      image.src = src;
      await image.decode();
      const first = Object.keys(design.placements).length === 0;
      patchPlacement(v, {
        src,
        source: "sample-black",
        cx: 0.5,
        cy: 0.5,
        size: 0.6,
        angle: 0,
      });
      setUndo(null);
      if (first) setPanel("items");
    } finally {
      setBusy(false);
    }
  };
  const clearAll = () => {
    setUndo({ ...design.placements });
    setDesign((d) => ({ ...d, placements: {} }));
  };
  const replace = async (src: string, source: string) => {
    if (!placement) return;
    const image = new Image();
    image.src = src;
    try {
      await image.decode();
      patchPlacement(view, { ...placement, src, source });
      setNotice("");
    } catch {
      setNotice("That logo could not be decoded. The existing logo was kept.");
    }
  };
  const upload = (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setNotice("Choose a PNG or JPEG smaller than 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () =>
        image.width * image.height <= 16_000_000
          ? void replace(reader.result as string, "custom")
          : setNotice("Choose an image below 16 megapixels.");
      image.onerror = () => setNotice("That image could not be decoded.");
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  const changeItem = (id: number, patch: Partial<Item>) =>
    setDesign((d) => ({
      ...d,
      items: d.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  const total = design.items.reduce(
    (n, x) => n + Math.max(1, x.quantity || 1),
    0,
  );
  const downloadCurrentView = async () => {
    if (!currentSrc || busy) return;
    const base = new Image();
    base.src = currentSrc;
    await base.decode();
    const canvas = document.createElement("canvas");
    canvas.width = base.naturalWidth;
    canvas.height = base.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(base, 0, 0);
    if (placement && area) {
      const logo = new Image();
      logo.src = placement.src;
      await logo.decode();
      const safe = area.safeRect;
      const width = placement.size * safe.width * canvas.width;
      const height = (width * logo.naturalHeight) / logo.naturalWidth;
      const x = (safe.x + placement.cx * safe.width) * canvas.width;
      const y = (safe.y + placement.cy * safe.height) * canvas.height;
      context.save();
      context.translate(x, y);
      context.rotate((placement.angle * Math.PI) / 180);
      context.drawImage(logo, -width / 2, -height / 2, width, height);
      context.restore();
    }
    const link = document.createElement("a");
    link.download = `${product.setKey}-${view}-preview.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const panelDone = () => {
    setPanel("home");
    setNotice("");
  };
  const activeIndex = available.indexOf(view);
  const currentSrc = url ?? "";
  const swatch = (id: string) => meta.swatches?.[id];
  const renderQuotePreview = async (row: Item, targetView: View) => {
    const variant = product.colours.find((c: any) => c.id === row.colourId);
    const source = variant?.views[targetView];
    const productUrl = source && assetUrl(source.assetKey);
    if (!productUrl) throw new Error("Missing product view");
    const base = new Image();
    base.src = productUrl;
    await base.decode();
    const canvas = document.createElement("canvas");
    canvas.width = base.naturalWidth;
    canvas.height = base.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(base, 0, 0);
    const applied = design.placements[targetView],
      configured = meta.areas?.[targetView];
    if (applied && configured) {
      const logo = new Image();
      logo.src = applied.src;
      await logo.decode();
      const safe = configured.safeRect;
      const width = applied.size * safe.width * canvas.width;
      const height = (width * logo.naturalHeight) / logo.naturalWidth;
      context.save();
      context.translate(
        (safe.x + applied.cx * safe.width) * canvas.width,
        (safe.y + applied.cy * safe.height) * canvas.height,
      );
      context.rotate((applied.angle * Math.PI) / 180);
      context.drawImage(logo, -width / 2, -height / 2, width, height);
      context.restore();
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Preview export failed")),
        "image/png",
      ),
    );
  };
  const submitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const errors: Record<string, string> = {};
    const name = customer.name.trim(),
      mobile = customer.mobile.trim(),
      email = customer.email.trim();
    if (name.length < 2 || name.length > 100)
      errors.name = "Enter a name between 2 and 100 characters.";
    if (!/^\+?[0-9 ()-]{7,20}$/.test(mobile))
      errors.mobile = "Enter a valid mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      errors.email = "Enter a valid email address.";
    if (
      design.items.some(
        (x) => !x.sizeId || x.quantity < 1 || !Number.isInteger(x.quantity),
      )
    )
      errors.design = "Choose a size and valid quantity for every item.";
    if (!Object.keys(design.placements).length)
      errors.design = "Add at least one logo placement.";
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    setFormErrors({});
    try {
      const form = new FormData();
      const placements = Object.fromEntries(
        Object.entries(design.placements).map(([v, p]) => [
          v,
          p && {
            areaId: `${v}-logo`,
            artworkId: p.source,
            transform: {
              centreX: p.cx,
              centreY: p.cy,
              widthFraction: p.size,
              rotationDeg: p.angle,
            },
          },
        ]),
      );
      form.append(
        "quote",
        JSON.stringify({
          schemaVersion: 1,
          customer: { name, mobile, email },
          productId,
          items: design.items,
          placements,
          specificInstructions: design.notes,
        }),
      );
      for (const row of design.items)
        for (const targetView of Object.keys(design.placements) as View[]) {
          const blob = await renderQuotePreview(row, targetView);
          form.append("previews", blob, `item-${row.id}-${targetView}.png`);
        }
      for (const [targetView, p] of Object.entries(design.placements))
        if (p?.source === "custom")
          form.append(
            "logos",
            await (await fetch(p.src)).blob(),
            `logo-${targetView}.png`,
          );
      const response = await fetch("/api/quotes", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setFormErrors(
          result.errors ?? {
            submit: result.error ?? "Quote could not be saved.",
          },
        );
        return;
      }
      setSavedId(result.quoteId);
    } catch {
      setFormErrors({
        submit: "Quote could not be saved. Your design is still here.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  const panelTitle =
    panel === "placement"
      ? "Logo Placement"
      : panel === "items"
        ? "Colours and Sizes"
        : panel === "notes"
          ? "Specific Instructions"
          : panel === "products"
            ? "Change Product"
            : "";
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex cursor-pointer items-center gap-3.5 text-[11px] border border-[#c97834] text-[#c97834] px-[18px] py-[13px] text-md no-underline transition-colors duration-200 hover:bg-white hover:text-[#1c211f]"
      >
        Discover our materials <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        onClose={() => setIsOpen(false)}
        className="relative m-auto h-[min(800px,calc(100dvh-48px))] w-[min(1320px,calc(100vw-32px))] max-h-none max-w-none overflow-hidden border border-[#343434] rounded-2xl bg-[#f7f7f7] p-0 text-[#202020] backdrop:bg-[#1d2422]/70 max-[800px]:m-0 max-[800px]:h-dvh max-[800px]:w-screen"
        aria-label="Product customizer"
      >
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_380px] max-[800px]:grid-cols-1 max-[800px]:grid-rows-[46dvh_minmax(0,1fr)]">
          <section
            className="relative min-h-0 min-w-0 overflow-hidden bg-[#f6f6f6] max-[800px]:row-start-1"
            aria-label="Product preview"
          >
            <div className="absolute inset-8 bottom-20 flex items-center justify-center max-[800px]:inset-3 max-[800px]:bottom-14">
              <div
                className="relative max-h-full max-w-full"
                style={{
                  aspectRatio: `${photo.width}/${photo.height}`,
                  width: `min(100%, calc((100vh - 150px) * ${photo.width / photo.height}))`,
                }}
                aria-label={`${meta.title ?? product.name}, ${colour.label}, ${view} view`}
              >
                <FabricProductCanvas
                  active={isOpen}
                  source={currentSrc}
                  area={area}
                  placement={placement}
                  editing={panel === "placement"}
                  onPlacementChange={(next) => patchPlacement(view, next)}
                  onError={setNotice}
                />
              </div>
            </div>
            {available.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setView(
                      available[
                        (activeIndex - 1 + available.length) % available.length
                      ] as View,
                    )
                  }
                  className="absolute left-5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/70 text-black/45 shadow-sm transition hover:bg-white"
                  aria-label="Previous view"
                >
                  <ChevronLeft size={28} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <button
                  onClick={() =>
                    setView(
                      available[(activeIndex + 1) % available.length] as View,
                    )
                  }
                  className="absolute right-5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/70 text-black/45 shadow-sm transition hover:bg-white"
                  aria-label="Next view"
                >
                  <ChevronRight size={28} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
                  {available.map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      aria-label={`${title(v)} view`}
                      className={`h-3 w-3 rounded-full ${v === view ? "bg-black" : "bg-black/15"}`}
                    />
                  ))}
                </div>
              </>
            )}
            <button
              disabled={busy}
              onClick={() => void downloadCurrentView()}
              className="absolute bottom-3 left-4 grid h-10 w-10 place-items-center rounded-full border border-black/15 bg-white/90 text-[#202020] shadow-sm transition hover:bg-white disabled:opacity-40"
              aria-label="Download current view"
              title="Download current view"
            >
              <Download size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="absolute bottom-4 right-0 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.18em] text-black/45">
              Powered By LeveinGroup
            </span>
            {busy && (
              <span className="absolute left-4 top-4 rounded bg-white px-3 py-2 text-sm shadow">
                Updating preview…
              </span>
            )}
          </section>
          <aside className="flex min-h-0 flex-col border-l border-black/10 bg-white max-[800px]:row-start-2 max-[800px]:border-l-0 max-[800px]:border-t">
            <header className="flex items-start justify-between border-b border-black/10 bg-[#e9e9e9] px-6 py-5">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c97834]">
                  Product customizer
                </p>
                <h2 className="max-w-[285px] font-display text-[25px] font-semibold leading-[1.08] tracking-[-0.03em] text-[#111827]">
                  {meta.title ?? product.name}
                </h2>
                <button
                  onClick={() => setPanel("products")}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#626262] underline decoration-black/25 underline-offset-4 transition hover:text-[#c97834]"
                >
                  Change product <ArrowRight size={13} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
              <button
                onClick={close}
                className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/70 text-[#444] transition hover:bg-white hover:text-black"
                aria-label="Close customizer"
                title="Close customizer"
              >
                <X size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>
            {panel === "home" ? (
              <div className="min-h-0 overflow-y-auto">
                <button
                  onClick={() => setPanel("placement")}
                  className="flex w-full items-center gap-4 border-b border-black/5 bg-[#f4f4f4] px-6 py-5 text-left transition hover:bg-[#ededed]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#dce9e5] text-[#315e55]"><Shirt size={21} strokeWidth={1.7} aria-hidden="true" /></span>
                  <span className="text-base uppercase tracking-wide">
                    Logo Placement
                  </span>
                </button>
                <button
                  onClick={() => setPanel("items")}
                  className="flex w-full items-center gap-4 border-b border-black/5 bg-[#f4f4f4] px-6 py-5 text-left transition hover:bg-[#ededed]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f3e4d7] text-[#a65b27]"><Palette size={21} strokeWidth={1.7} aria-hidden="true" /></span>
                  <span className="text-base uppercase tracking-wide">
                    Colours and Sizes
                  </span>
                  <span className="ml-auto rounded-full border border-black/15 bg-white px-3 py-1 text-[11px]">
                    List view
                  </span>
                </button>
                <button
                  onClick={() => setPanel("notes")}
                  className="flex w-full items-center gap-4 border-b border-black/5 bg-[#f4f4f4] px-6 py-5 text-left transition hover:bg-[#ededed]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e7e2ee] text-[#614b79]"><Pencil size={21} strokeWidth={1.7} aria-hidden="true" /></span>
                  <span className="text-base uppercase tracking-wide">
                    Specific Instructions
                  </span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-black/10 bg-[#ededed] px-5 py-4">
                  <button onClick={() => setPanel("home")} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/70 transition hover:bg-white">
                    <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <h3 className="text-base uppercase tracking-wide">
                    {panelTitle}
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  {panel === "placement" && (
                    <>
                      <ul className="ml-5 list-disc text-sm leading-6">
                        <li>Select your placement(s) below.</li>
                        <li>Tap again if you want to remove.</li>
                        <li>Choose Blank for no logo.</li>
                      </ul>
                      <div className="mt-5 grid grid-cols-3 gap-4 text-center">
                        <button
                          onClick={clearAll}
                          className={`text-xs ${Object.keys(design.placements).length ? "" : "font-bold"}`}
                        >
                          <span className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full border-2 border-[#888] bg-[#222] text-white">
                            —
                          </span>
                          BLANK
                        </button>
                        {available
                          .filter((v) => meta.areas?.[v])
                          .map((v) => (
                            <button
                              key={v}
                              onClick={() => void addDefault(v)}
                              className={`text-xs ${design.placements[v] ? "font-bold text-[#c97834]" : ""}`}
                            >
                              <span
                                className={`mx-auto mb-2 block h-14 w-14 overflow-hidden rounded-full border-2 ${design.placements[v] ? "border-[#c97834]" : "border-[#888]"}`}
                              >
                                <img
                                  src={assetUrl(colour.views[v].assetKey)}
                                  className="h-full w-full object-cover"
                                  alt=""
                                />
                              </span>
                              {title(v).toUpperCase()}
                            </button>
                          ))}
                      </div>
                      {undo && (
                        <button
                          onClick={() => {
                            setDesign((d) => ({ ...d, placements: undo }));
                            setUndo(null);
                          }}
                          className="mt-4 text-sm underline"
                        >
                          Undo removal
                        </button>
                      )}
                      {placement && (
                        <div className="mt-7 border-t pt-5">
                          <p className="font-semibold">Edit {title(view)}</p>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                              onClick={() =>
                                void replace(
                                  sampleLogoUrls.white!,
                                  "sample-white",
                                )
                              }
                              className="rounded border bg-[linear-gradient(45deg,#ddd_25%,transparent_25%),linear-gradient(-45deg,#ddd_25%,transparent_25%)] p-2 text-xs"
                            >
                              White
                            </button>
                            <button
                              onClick={() =>
                                void replace(
                                  sampleLogoUrls.black!,
                                  "sample-black",
                                )
                              }
                              className="rounded border p-2 text-xs"
                            >
                              Black
                            </button>
                            <label className="cursor-pointer rounded border p-2 text-center text-xs">
                              Upload
                              <input
                                type="file"
                                accept="image/png,image/jpeg"
                                className="sr-only"
                                onChange={(e) => upload(e.target.files?.[0])}
                              />
                            </label>
                          </div>
                          <label className="mt-4 block text-sm">
                            Size
                            <input
                              type="range"
                              min=".15"
                              max=".9"
                              step=".01"
                              value={placement.size}
                              onChange={(e) =>
                                patchPlacement(view, {
                                  ...placement,
                                  size: +e.target.value,
                                })
                              }
                              className="mt-2 w-full accent-[#e78335]"
                            />
                          </label>
                          <label className="mt-4 block text-sm">
                            Rotation
                            <input
                              type="range"
                              min="-180"
                              max="180"
                              value={placement.angle}
                              onChange={(e) =>
                                patchPlacement(view, {
                                  ...placement,
                                  angle: +e.target.value,
                                })
                              }
                              className="mt-2 w-full accent-[#e78335]"
                            />
                          </label>
                          <button
                            onClick={() =>
                              patchPlacement(view, {
                                ...placement,
                                cx: 0.5,
                                cy: 0.5,
                              })
                            }
                            className="mt-3 text-sm underline"
                          >
                            Centre
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {panel === "items" && (
                    <>
                      <p className="text-sm text-[#666]">
                        All item rows share the same logo design and notes.
                      </p>
                      {design.items.map((row, index) => (
                        <div
                          key={row.id}
                          className={`mt-4 border ${row.id === design.activeItem ? "border-[#e78335]" : "border-black/10"}`}
                        >
                          <button
                            onClick={() =>
                              setDesign((d) => ({ ...d, activeItem: row.id }))
                            }
                            className="flex w-full justify-between bg-[#f4f4f4] p-3 text-sm"
                          >
                            <span>
                              {index + 1} &nbsp; Item {index + 1}
                            </span>
                            <span>×{row.quantity}</span>
                          </button>
                          <div className="p-4">
                            <p className="text-sm font-semibold">ITEM COLOUR</p>
                            <div className="mt-3 grid grid-cols-4 gap-3">
                              {product.colours.map((c: any) => (
                                <button
                                  key={c.id}
                                  onClick={() => {
                                    setDesign((d) => ({
                                      ...d,
                                      activeItem: row.id,
                                      view: c.views?.[d.view]
                                        ? d.view
                                        : ((c.views?.front
                                            ? "front"
                                            : order.find(
                                                (v) => c.views?.[v],
                                              )) as View),
                                      items: d.items.map((x) =>
                                        x.id === row.id
                                          ? { ...x, colourId: c.id, sizeId: "" }
                                          : x,
                                      ),
                                    }));
                                  }}
                                  className="text-[11px]"
                                >
                                  <span
                                    className={`mx-auto mb-1 block h-11 w-11 rounded-full border-[3px] ${row.colourId === c.id ? "border-[#e78335]" : "border-[#888]"}`}
                                    style={{
                                      backgroundColor: swatch(c.id) ?? "#ddd",
                                    }}
                                  />
                                  {c.label.toUpperCase()}
                                </button>
                              ))}
                            </div>
                            <label className="mt-5 block text-sm font-semibold">
                              SIZE
                              <select
                                value={row.sizeId}
                                onChange={(e) =>
                                  changeItem(row.id, { sizeId: e.target.value })
                                }
                                className="mt-2 w-full rounded border border-[#888] bg-white p-3"
                              >
                                <option value="">Choose your size</option>
                                {(meta.sizes ?? []).map((s: string) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            </label>
                            <label className="mt-4 block text-sm font-semibold">
                              QUANTITY
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={row.quantity}
                                onChange={(e) =>
                                  changeItem(row.id, {
                                    quantity: Math.max(
                                      1,
                                      Math.floor(+e.target.value || 1),
                                    ),
                                  })
                                }
                                className="mt-2 w-full rounded border border-[#888] p-3"
                              />
                            </label>
                            {design.items.length > 1 && (
                              <button
                                onClick={() =>
                                  setDesign((d) => ({
                                    ...d,
                                    items: d.items.filter(
                                      (x) => x.id !== row.id,
                                    ),
                                    activeItem: d.items[0].id,
                                  }))
                                }
                                className="mt-3 text-xs underline"
                              >
                                Remove item
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const id = nextItem.current++;
                          setDesign((d) => ({
                            ...d,
                            activeItem: id,
                            items: [
                              ...d.items,
                              {
                                id,
                                colourId: item.colourId,
                                sizeId: "",
                                quantity: 1,
                              },
                            ],
                          }));
                        }}
                        className="mt-4 w-full border border-[#333] p-3 text-sm font-semibold"
                      >
                        Add Another Item
                      </button>
                      <p className="mt-3 text-right text-sm">
                        Total quantity: {total}
                      </p>
                    </>
                  )}
                  {panel === "notes" && (
                    <>
                      <label className="block text-sm font-semibold">
                        Special notes or requirements
                        <textarea
                          value={design.notes}
                          maxLength={1000}
                          onChange={(e) =>
                            setDesign((d) => ({ ...d, notes: e.target.value }))
                          }
                          placeholder="Add any notes about your logo, placement, or special requirements."
                          className="mt-3 h-36 w-full rounded border border-[#999] p-3 font-normal"
                        />
                      </label>
                      <p className="mt-1 text-right text-xs text-[#777]">
                        {design.notes.length}/1000
                      </p>
                      <p className="mt-4 text-sm text-[#666]">
                        Notes stay with this product design and are included
                        with your quote.
                      </p>
                    </>
                  )}
                  {panel === "products" && (
                    <div className="grid grid-cols-2 gap-3">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectProduct(p.id)}
                          className={`rounded border p-3 text-left text-sm ${p.id === productId ? "border-2 border-[#e78335]" : "border-black/15"}`}
                        >
                          <span className="text-xs uppercase text-[#777]">
                            {p.category}
                          </span>
                          <strong className="mt-1 block">
                            {metadata[p.id]?.title ?? p.name}
                          </strong>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <footer className="flex gap-2 border-t border-black/10 p-4">
                  <button
                    onClick={() => setPanel("home")}
                    className="flex-1 border border-[#333] p-3 text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={panelDone}
                    className="flex-1 bg-[#252525] p-3 text-sm text-white"
                  >
                    Done
                  </button>
                </footer>
              </>
            )}
            <button
              onClick={() => {
                setQuoteOpen(true);
                setSavedId("");
                setFormErrors({});
              }}
              disabled={submitting}
              className="m-4 mt-auto bg-[#252525] p-4 text-base font-semibold text-white disabled:opacity-50"
            >
              Get Quote
            </button>
            {notice && (
              <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                {notice}
              </p>
            )}
          </aside>
        </div>
        {quoteOpen && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="quote-title"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuoteOpen(false);
                }
              }}
              className="w-full max-w-md bg-white p-7 shadow-2xl"
            >
              {savedId ? (
                <div className="text-center">
                  <h2
                    id="quote-title"
                    className="font-display text-2xl font-bold"
                  >
                    Saved Successfully
                  </h2>
                  <p className="mt-3 text-sm text-[#666]">
                    Quote ID: <strong>{savedId}</strong>
                  </p>
                  <button
                    onClick={() => {
                      setQuoteOpen(false);
                      setSavedId("");
                    }}
                    className="mt-6 w-full bg-[#252525] p-3 text-white"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={submitQuote}>
                  <div className="flex items-center justify-between">
                    <h2
                      id="quote-title"
                      className="font-display text-2xl font-bold"
                    >
                      Get Quote
                    </h2>
                    <button
                      type="button"
                      onClick={() => setQuoteOpen(false)}
                      aria-label="Close customer details"
                      className="grid h-8 w-8 place-items-center rounded-full border border-black/10 text-[#555] hover:bg-black/5"
                    >
                      <X size={16} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-[#666]">
                    Enter your details to save this design for a quote.
                  </p>
                  {(["name", "mobile", "email"] as const).map((key) => (
                    <label
                      key={key}
                      className="mt-4 block text-sm font-semibold"
                    >
                      {key === "mobile"
                        ? "Mobile Number"
                        : key[0].toUpperCase() + key.slice(1)}
                      <input
                        autoFocus={key === "name"}
                        value={customer[key]}
                        onChange={(e) =>
                          setCustomer((x) => ({ ...x, [key]: e.target.value }))
                        }
                        type={key === "email" ? "email" : "text"}
                        maxLength={
                          key === "email" ? 254 : key === "name" ? 100 : 20
                        }
                        className="mt-1 w-full border border-[#888] p-3 font-normal"
                      />
                      {formErrors[key] && (
                        <span className="mt-1 block text-xs text-red-700">
                          {formErrors[key]}
                        </span>
                      )}
                    </label>
                  ))}
                  {(formErrors.design ||
                    formErrors.items ||
                    formErrors.previews ||
                    formErrors.submit) && (
                    <p className="mt-4 text-sm text-red-700">
                      {formErrors.design ||
                        formErrors.items ||
                        formErrors.previews ||
                        formErrors.submit}
                    </p>
                  )}
                  <button
                    disabled={submitting}
                    className="mt-6 w-full bg-[#252525] p-4 font-semibold text-white disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Submit Quote"}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </dialog>
    </>
  );
}
