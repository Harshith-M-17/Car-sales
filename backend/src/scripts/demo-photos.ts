/**
 * Real, freely-licensed car photos for demo listings, curated from Wikimedia Commons
 * (see demo-photos.json for the file list, authors and licences).
 *
 * Images are downloaded once into backend/.cache/demo-photos (git-ignored) and reused.
 * Development data only: CC BY / CC BY-SA require crediting the author, which seed-demo
 * does in each listing's description.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Imported (not read from disk) so the build copies it next to the compiled script.
import curated from './demo-photos.json';

export interface DemoPhoto {
  /** "<makeSlug>/<modelSlug>" from the catalog. */
  model: string;
  /** Commons file title, e.g. "File:2021 Hyundai Creta SX(O) CRDi (India) front view.jpg". */
  file: string;
  /** Paint colour visible in the photo, used as the listing colour. */
  color: string;
  /** Model year shown in the photo, when known. */
  year?: number;
  author: string;
  license: string;
}

export interface LoadedDemoPhoto extends DemoPhoto {
  buffer: Buffer;
  source: string;
}

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'CarBazaarDemoSeeder/1.0 (local development seed script)';
const WIDTH = 1280; // a standard Commons thumbnail size

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(300);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status} for ${url}`);
    await sleep(1500 * 2 ** attempt);
  }
  throw new Error(`Gave up fetching ${url}`);
}

/** Resolves Commons file titles to thumbnail + description URLs, 50 titles per request. */
async function resolveUrls(
  titles: string[],
): Promise<Map<string, { thumb: string; page: string }>> {
  const out = new Map<string, { thumb: string; page: string }>();
  for (let i = 0; i < titles.length; i += 50) {
    const url = new URL(API);
    for (const [k, v] of Object.entries({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: String(WIDTH),
      titles: titles.slice(i, i + 50).join('|'),
    })) {
      url.searchParams.set(k, v);
    }
    const data = JSON.parse((await politeFetch(url.toString())).toString()) as {
      query?: {
        normalized?: { from: string; to: string }[];
        pages?: { title: string; imageinfo?: { thumburl: string; descriptionurl: string }[] }[];
      };
    };
    const renamed = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (info)
        out.set(renamed.get(page.title) ?? page.title, {
          thumb: info.thumburl,
          page: info.descriptionurl,
        });
    }
  }
  return out;
}

/**
 * Loads every curated photo, downloading any that aren't cached yet. Photos that can't be
 * fetched are skipped (the seeder falls back to rendered placeholders for those models).
 */
export async function loadDemoPhotos(
  log: (msg: string) => void = () => undefined,
): Promise<Map<string, LoadedDemoPhoto[]>> {
  const manifest = curated as DemoPhoto[];
  const cacheDir = resolve('.cache/demo-photos');
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = (file: string) =>
    join(cacheDir, `${createHash('sha1').update(file).digest('hex').slice(0, 16)}.jpg`);

  const missing = manifest.filter((p) => !existsSync(cachePath(p.file)));
  if (missing.length) {
    log(`Downloading ${missing.length} demo photos from Wikimedia Commons…`);
    try {
      const urls = await resolveUrls(missing.map((p) => p.file));
      for (const photo of missing) {
        const url = urls.get(photo.file);
        if (!url) {
          log(`  not found on Commons: ${photo.file}`);
          continue;
        }
        try {
          writeFileSync(cachePath(photo.file), await politeFetch(url.thumb));
        } catch (err) {
          log(`  failed: ${photo.file} (${(err as Error).message})`);
        }
      }
    } catch (err) {
      log(`  Commons unreachable (${(err as Error).message}); using rendered placeholders`);
    }
  }

  const byModel = new Map<string, LoadedDemoPhoto[]>();
  for (const photo of manifest) {
    const path = cachePath(photo.file);
    if (!existsSync(path)) continue;
    const list = byModel.get(photo.model) ?? [];
    list.push({
      ...photo,
      buffer: readFileSync(path),
      source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(photo.file.replace(/ /g, '_'))}`,
    });
    byModel.set(photo.model, list);
  }
  return byModel;
}
