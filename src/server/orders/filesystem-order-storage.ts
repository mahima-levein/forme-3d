import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { OrderStorage, StoredQuote } from './order-storage';

let queue = Promise.resolve();
const safeName = (value: string, fallback: string) => value.replace(/[^a-z0-9._-]/gi, '-').slice(0, 80) || fallback;
export class FilesystemOrderStorage implements OrderStorage {
  async save(input: Omit<StoredQuote, 'id' | 'createdAt' | 'status' | 'previewPaths' | 'originalLogoKeys'>, previews: File[], logos: File[]) {
    let release!: () => void; const previous = queue; queue = new Promise<void>(resolve => { release = resolve; }); await previous;
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', ''); const id = `Q-${stamp}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const publicRoot = join(process.cwd(), 'public', 'assets', 'orders'); const privateRoot = join(process.cwd(), 'data', 'orders'); const temp = join(publicRoot, `.tmp-${id}`); const final = join(publicRoot, id); const privateLogoRoot = join(privateRoot, id); const db = join(privateRoot, 'orders.json');
    let tempCreated = false; let privateCreated = false; let finalCreated = false; let dbTempCreated = false;
    try {
      await mkdir(publicRoot, { recursive: true }); await mkdir(privateRoot, { recursive: true }); await mkdir(temp); tempCreated = true; if (logos.length) { await mkdir(privateLogoRoot); privateCreated = true; }
      const previewPaths: string[] = []; for (let i = 0; i < previews.length; i++) { const name = safeName(previews[i].name, `preview-${i + 1}.png`); await writeFile(join(temp, name), new Uint8Array(await previews[i].arrayBuffer())); previewPaths.push(`/assets/orders/${id}/${name}`); }
      const originalLogoKeys: string[] = []; for (let i = 0; i < logos.length; i++) { const name = safeName(logos[i].name, `logo-${i + 1}.png`); await writeFile(join(privateLogoRoot, name), new Uint8Array(await logos[i].arrayBuffer())); originalLogoKeys.push(`private/${id}/${name}`); }
      let collection: { schemaVersion: number; quotes: StoredQuote[] } = { schemaVersion: 1, quotes: [] }; try { collection = JSON.parse(await readFile(db, 'utf8')); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
      const record: StoredQuote = { ...input, id, createdAt: new Date().toISOString(), status: 'new', previewPaths, originalLogoKeys }; const dbTemp = `${db}.tmp`; await writeFile(dbTemp, `${JSON.stringify({ ...collection, quotes: [...collection.quotes, record] }, null, 2)}\n`); dbTempCreated = true; await rename(temp, final); tempCreated = false; finalCreated = true; await rename(dbTemp, db); dbTempCreated = false; return record;
    } catch (error) { if (tempCreated) await rm(temp, { recursive: true, force: true }); if (finalCreated) await rm(final, { recursive: true, force: true }); if (dbTempCreated) await rm(`${db}.tmp`, { force: true }); if (privateCreated) await rm(privateLogoRoot, { recursive: true, force: true }); throw error; } finally { release(); }
  }
}
