export interface GarmentColor {
  key: string;
  label: string;
  hex: string;
}

export const GARMENT_COLORS: GarmentColor[] = [
  { key: "deep-black", label: "Deep Black", hex: "#111111" },
  { key: "jet-black", label: "Jet Black", hex: "#171717" },
  { key: "black-smoke", label: "Black Smoke", hex: "#343434" },

  { key: "arctic-white", label: "Arctic White", hex: "#F4F3EF" },
  { key: "desert-sand", label: "Desert Sand", hex: "#D8C1AB" },
  { key: "natural-stone", label: "Natural Stone", hex: "#B7AA9D" },

  { key: "vanilla-milkshake", label: "Vanilla Milkshake", hex: "#EADCBF" },
  { key: "cornflower-blue", label: "Cornflower Blue", hex: "#4F8FC7" },
  { key: "dusty-blue", label: "Dusty Blue", hex: "#71899A" },
  { key: "ice-blue", label: "Ice Blue", hex: "#A9CCE5" },
  { key: "sky-blue", label: "Sky Blue", hex: "#78B7DE" },
  { key: "airforce-blue", label: "Airforce Blue", hex: "#255D78" },

  { key: "atlantic-blue", label: "Atlantic Blue", hex: "#56769B" },
  { key: "hawaiian-blue", label: "Hawaiian Blue", hex: "#15A6C8" },
  { key: "tropical-blue", label: "Tropical Blue", hex: "#0B7CB2" },
  { key: "deep-sea-blue", label: "Deep Sea Blue", hex: "#0C506C" },
  { key: "denim", label: "Denim", hex: "#24668E" },
  { key: "ink-blue", label: "Ink Blue", hex: "#144A68" },

  { key: "navy-smoke", label: "Navy Smoke", hex: "#22354F" },
  { key: "new-french-navy", label: "New French Navy", hex: "#1E2442" },
  { key: "oxford-navy", label: "Oxford Navy", hex: "#262B4A" },
  { key: "bright-royal", label: "Bright Royal", hex: "#1F57A4" },
  { key: "royal-blue", label: "Royal Blue", hex: "#075DAA" },
  { key: "sapphire-blue", label: "Sapphire Blue", hex: "#169CC9" },

  { key: "lagoon-blue", label: "Lagoon Blue", hex: "#108A97" },
  { key: "seafoam", label: "Seafoam", hex: "#7EA6A6" },
  { key: "teal", label: "Teal", hex: "#47727A" },
  { key: "turquoise-surf", label: "Turquoise Surf", hex: "#45AFC2" },

  { key: "digital-lavender", label: "Digital Lavender", hex: "#8E75A8" },
  { key: "dusty-lilac", label: "Dusty Lilac", hex: "#827D88" },
  { key: "dusty-purple", label: "Dusty Purple", hex: "#906F7A" },
  { key: "lavender", label: "Lavender", hex: "#AAA0CE" },
  { key: "lilac", label: "Lilac", hex: "#CAC8D7" },
  { key: "magenta-magic", label: "Magenta Magic", hex: "#74186C" },
  { key: "true-violet", label: "True Violet", hex: "#5558A8" },
  { key: "plum", label: "Plum", hex: "#712748" },
];

export const GARMENT_COLOR_KEYS: string[] = GARMENT_COLORS.map((color) => color.key);

export const GARMENT_COLOR_BY_KEY: Record<string, GarmentColor> = Object.fromEntries(
  GARMENT_COLORS.map((color) => [color.key, color]),
);

console.assert(
  new Set(GARMENT_COLOR_KEYS).size === GARMENT_COLORS.length,
  "Duplicate key found in GARMENT_COLORS.",
);
