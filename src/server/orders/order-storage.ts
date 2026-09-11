export type StoredQuote = {
  id: string;
  createdAt: string;
  status: "new";
  customer: { name: string; mobile: string; email: string };
  productId: string;
  items: Array<{
    itemId: number;
    colourId: string;
    sizeId: string;
    quantity: number;
  }>;
  placements: Record<string, unknown>;
  specificInstructions: string;
  previewPaths: string[];
  originalLogoKeys: string[];
};
export interface OrderStorage {
  save(
    record: Omit<
      StoredQuote,
      "id" | "createdAt" | "status" | "previewPaths" | "originalLogoKeys"
    >,
    previews: File[],
    logos: File[],
  ): Promise<StoredQuote>;
}
