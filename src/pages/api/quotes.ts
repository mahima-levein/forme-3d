import type { APIRoute } from "astro";
import catalogue from "../../data/customizer/catalog.generated.json";
import metadata from "../../data/customizer/product-overrides.json";
import { FilesystemOrderStorage } from "../../server/orders/filesystem-order-storage";
export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const isUpload = (value: FormDataEntryValue): value is File =>
  typeof value !== "string" && typeof value.arrayBuffer === "function";
export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const raw = form.get("quote");
    if (typeof raw !== "string" || raw.length > 100_000)
      return json({ success: false, error: "Invalid quote payload." }, 400);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ success: false, error: "Invalid quote payload." }, 400);
    }
    const name = String(body.customer?.name ?? "").trim(),
      mobile = String(body.customer?.mobile ?? "").trim(),
      email = String(body.customer?.email ?? "").trim();
    const errors: Record<string, string> = {};
    if (name.length < 2 || name.length > 100)
      errors.name = "Enter a name between 2 and 100 characters.";
    if (!/^\+?[0-9 ()-]{7,20}$/.test(mobile))
      errors.mobile = "Enter a valid mobile number.";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = "Enter a valid email address.";
    const product: any = (catalogue.products as any[]).find(
      (p) => p.id === body.productId,
    );
    if (!product) errors.design = "Unknown product.";
    const sizes = (metadata as any).products?.[body.productId]?.sizes ?? [];
    if (
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.some(
        (i: any) =>
          !product?.colours.some((c: any) => c.id === i.colourId) ||
          !sizes.includes(i.sizeId) ||
          !Number.isInteger(i.quantity) ||
          i.quantity < 1,
      )
    )
      errors.items = "One or more item rows are invalid.";
    const configuredAreas =
      (metadata as any).products?.[body.productId]?.areas ?? {};
    const placementEntries =
      body.placements &&
      typeof body.placements === "object" &&
      !Array.isArray(body.placements)
        ? Object.entries(body.placements)
        : [];
    const finite = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value);
    if (
      !placementEntries.length ||
      placementEntries.some(([view, value]: [string, any]) => {
        const transform = value?.transform;
        return (
          !configuredAreas[view] ||
          typeof value?.artworkId !== "string" ||
          value.artworkId.length > 100 ||
          !finite(transform?.centreX) ||
          transform.centreX < 0 ||
          transform.centreX > 1 ||
          !finite(transform?.centreY) ||
          transform.centreY < 0 ||
          transform.centreY > 1 ||
          !finite(transform?.widthFraction) ||
          transform.widthFraction <= 0 ||
          transform.widthFraction > 1 ||
          !finite(transform?.rotationDeg) ||
          Math.abs(transform.rotationDeg) > 180
        );
      })
    )
      errors.design = "One or more logo placements are invalid.";
    if (
      typeof body.specificInstructions !== "string" ||
      body.specificInstructions.length > 1000 ||
      body.schemaVersion !== 1
    )
      errors.design = "Invalid design settings.";
    const previews = form.getAll("previews").filter(isUpload);
    const logos = form.getAll("logos").filter(isUpload);
    const expectedPreviews = Array.isArray(body.items)
      ? body.items.length * placementEntries.length
      : 0;
    if (
      previews.length !== expectedPreviews ||
      previews.some(
        (x) => x.type !== "image/png" || x.size > 10 * 1024 * 1024,
      ) ||
      logos.some(
        (x) =>
          !["image/png", "image/jpeg"].includes(x.type) ||
          x.size > 10 * 1024 * 1024,
      ) ||
      [...previews, ...logos].reduce((n, x) => n + x.size, 0) > 30 * 1024 * 1024
    )
      errors.previews = "Valid PNG previews are required.";
    if (Object.keys(errors).length)
      return json({ success: false, errors }, 400);
    const storage = new FilesystemOrderStorage();
    const record = await storage.save(
      {
        customer: { name, mobile, email },
        productId: product.id,
        items: body.items.map((i: any) => ({
          itemId: Number(i.id),
          colourId: i.colourId,
          sizeId: i.sizeId,
          quantity: i.quantity,
        })),
        placements: body.placements ?? {},
        specificInstructions: String(body.specificInstructions ?? "").slice(
          0,
          1000,
        ),
      },
      previews,
      logos,
    );
    return json({ success: true, quoteId: record.id });
  } catch (error) {
    console.error("[quotes] save failed", error);
    return json(
      { success: false, error: "The quote could not be saved." },
      500,
    );
  }
};
