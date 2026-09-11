const sources = import.meta.glob("../../assets/{apron,shirts}/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const sampleSources = import.meta.glob("../../assets/logo-*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function assetUrl(assetKey: string): string | undefined {
  const relative = `../..${assetKey.replace("/src", "")}`;
  return sources[relative];
}
export const sampleLogoUrls = {
  white: sampleSources["../../assets/logo-white.png"],
  black: sampleSources["../../assets/logo-black.png"],
};
