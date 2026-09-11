import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const root = process.cwd();
const assetRoot = join(root, 'src', 'assets');
const output = join(root, 'src', 'data', 'customizer', 'catalog.generated.json');
const roots = ['apron', 'shirts'];
const viewOrder = ['front', 'back', 'left', 'right'];
const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });
const pngDimensions = (file) => {
  const bytes = readFileSync(file);
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`Unsupported or corrupt PNG: ${relative(root, file)}`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
const label = (name) => name === 'NEVY' ? 'Navy' : name.charAt(0) + name.slice(1).toLowerCase();
const files = (dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [];
const products = [];
for (const category of roots) {
  for (const set of files(join(assetRoot, category)).filter(x => x.isDirectory()).map(x => x.name).sort(natural.compare)) {
    const colourRecords = [];
    for (const colour of files(join(assetRoot, category, set)).filter(x => x.isDirectory()).map(x => x.name).sort(natural.compare)) {
      const views = {};
      const seen = new Map();
      for (const entry of files(join(assetRoot, category, set, colour)).filter(x => x.isFile())) {
        const match = /^(front|back|left|right)\.png$/i.exec(entry.name);
        if (!match) continue;
        const view = match[1].toLowerCase();
        if (seen.has(view)) throw new Error(`View collision for ${category}/${set}/${colour}: ${seen.get(view)} and ${entry.name}`);
        seen.set(view, entry.name);
        const file = join(assetRoot, category, set, colour, entry.name);
        const { width, height } = pngDimensions(file);
        if (!width || !height) throw new Error(`Invalid image dimensions: ${relative(root, file)}`);
        views[view] = { assetKey: `/src/assets/${category}/${set}/${colour}/${entry.name}`, width, height };
      }
      if (Object.keys(views).length) colourRecords.push({ id: colour, label: label(colour), views: Object.fromEntries(viewOrder.filter(x => views[x]).map(x => [x, views[x]])) });
    }
    if (colourRecords.length) products.push({ id: `${category}/${set}`, category, setKey: set, name: `${category === 'shirts' ? 'Shirt' : 'Apron'} ${set}`, colours: colourRecords });
  }
}
if (!products.length) throw new Error('No usable product PNGs were found under src/assets/apron or src/assets/shirts.');
const content = `${JSON.stringify({ schemaVersion: 2, products }, null, 2)}\n`;
mkdirSync(dirname(output), { recursive: true });
if (!existsSync(output) || readFileSync(output, 'utf8') !== content) { const temp = `${output}.tmp`; writeFileSync(temp, content); renameSync(temp, output); }
console.log(`Generated customizer catalogue with ${products.length} products.`);
