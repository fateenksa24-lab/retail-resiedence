import { del, get, list, put } from '@vercel/blob';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Where CMS content lives. On Vercel: a private Vercel Blob store (persists across deployments,
// no database). In local development without a Blob token: a `.cms/` folder in the project.

const CONTENT = 'cms/content.json';
const HISTORY = 'cms/history/';
const KEEP_VERSIONS = 40;
const LOCAL_DIR = path.join(process.cwd(), '.cms');

export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const localEnabled = () => !blobEnabled() && (process.env.NODE_ENV === 'development' || process.env.CMS_LOCAL === '1');
export const storageReady = () => blobEnabled() || localEnabled();

const localPath = (key: string) => {
  const file = path.join(LOCAL_DIR, key);
  if (!file.startsWith(LOCAL_DIR + path.sep)) throw new Error('Invalid path');
  return file;
};

export async function readContentJson(): Promise<unknown> {
  if (blobEnabled()) {
    const res = await get(CONTENT, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text());
  }
  if (localEnabled()) {
    try {
      return JSON.parse(await readFile(localPath(CONTENT), 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

export async function writeContentJson(data: unknown): Promise<void> {
  const body = JSON.stringify(data);
  if (blobEnabled()) {
    await put(CONTENT, body, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
    return;
  }
  if (localEnabled()) {
    await mkdir(path.dirname(localPath(CONTENT)), { recursive: true });
    await writeFile(localPath(CONTENT), body);
    return;
  }
  throw new Error('Storage is not connected. Add a Vercel Blob store to the project.');
}

/** Stores an uploaded file and returns its key (served at /cms-media/<key>). */
export async function putMedia(name: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const key = `media/${Date.now().toString(36)}-${name}`;
  if (blobEnabled()) {
    await put(`cms/${key}`, Buffer.from(bytes), { access: 'private', contentType, addRandomSuffix: false });
    return key;
  }
  if (localEnabled()) {
    await mkdir(path.dirname(localPath(`cms/${key}`)), { recursive: true });
    await writeFile(localPath(`cms/${key}`), Buffer.from(bytes));
    return key;
  }
  throw new Error('Storage is not connected. Add a Vercel Blob store to the project.');
}

export async function getMedia(key: string): Promise<{ body: BodyInit; contentType: string } | null> {
  if (!/^media\/[\w.-]+$/.test(key)) return null;
  if (blobEnabled()) {
    const res = await get(`cms/${key}`, { access: 'private' });
    if (!res || res.statusCode !== 200) return null;
    return { body: res.stream, contentType: res.blob.contentType };
  }
  if (localEnabled()) {
    try {
      const data = await readFile(localPath(`cms/${key}`));
      const ext = key.split('.').pop();
      const type = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return { body: new Uint8Array(data), contentType: type };
    } catch {
      return null;
    }
  }
  return null;
}

// Visit bookings: one small file per taken slot (cms/bookings/2026-11-24T10.json). Writing
// never overwrites, so two people can't take the same slot.
const BOOKINGS = 'cms/bookings/';

/** Keys of every taken slot ("2026-11-24T10"). */
export async function listBookedSlots(): Promise<string[]> {
  let names: string[] = [];
  if (blobEnabled()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BOOKINGS, limit: 1000, cursor });
      names.push(...page.blobs.map((b) => b.pathname.slice(BOOKINGS.length)));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } else if (localEnabled()) {
    names = await readdir(localPath(BOOKINGS)).catch(() => []);
  }
  return names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));
}

/** Takes a slot; false when someone already has it. */
export async function reserveSlot(key: string, data: unknown): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key)) throw new Error('Invalid slot');
  const body = JSON.stringify(data);
  if (blobEnabled()) {
    try {
      await put(`${BOOKINGS}${key}.json`, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false });
      return true;
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) return false;
      throw error;
    }
  }
  if (localEnabled()) {
    await mkdir(localPath(BOOKINGS), { recursive: true });
    try {
      await writeFile(localPath(`${BOOKINGS}${key}.json`), body, { flag: 'wx' });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
  }
  throw new Error('Storage is not connected.');
}

/** Saved versions, newest first. */
export type Version = { key: string; savedAt: string };

const versionKey = (savedAt: string) => `${savedAt.replace(/[:.]/g, '-')}.json`;
const savedAtFromKey = (key: string) => key.replace(/\.json$/, '').replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z$/, 'T$1:$2:$3.$4Z');

export async function writeVersion(data: { updatedAt?: string }): Promise<void> {
  if (!data.updatedAt) return;
  const key = versionKey(data.updatedAt);
  const body = JSON.stringify(data);
  if (blobEnabled()) {
    await put(HISTORY + key, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  } else if (localEnabled()) {
    await mkdir(localPath(HISTORY), { recursive: true });
    await writeFile(localPath(HISTORY + key), body);
  } else return;
  // Keep the most recent versions only.
  const old = (await listVersions()).slice(KEEP_VERSIONS);
  if (!old.length) return;
  if (blobEnabled()) await del(old.map((v) => HISTORY + v.key)).catch(() => undefined);
  else await Promise.all(old.map((v) => rm(localPath(HISTORY + v.key), { force: true })));
}

export async function listVersions(): Promise<Version[]> {
  let keys: string[] = [];
  if (blobEnabled()) {
    const { blobs } = await list({ prefix: HISTORY, limit: 1000 });
    keys = blobs.map((b) => b.pathname.slice(HISTORY.length));
  } else if (localEnabled()) {
    keys = await readdir(localPath(HISTORY)).catch(() => []);
  }
  return keys
    .filter((k) => k.endsWith('.json'))
    .sort()
    .reverse()
    .map((key) => ({ key, savedAt: savedAtFromKey(key) }));
}

export async function readVersion(key: string): Promise<unknown> {
  if (!/^[\w-]+\.json$/.test(key)) return null;
  if (blobEnabled()) {
    const res = await get(HISTORY + key, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text());
  }
  if (localEnabled()) {
    try {
      return JSON.parse(await readFile(localPath(HISTORY + key), 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

export type StorageProblem = { code: 'notConnected' } | { code: 'publicStore' } | { code: 'unavailable'; detail: string };

/** What is wrong with the storage connection, or null when it works. The dashboard words it. */
export async function storageProblem(): Promise<StorageProblem | null> {
  if (!storageReady()) return { code: 'notConnected' };
  try {
    await readContentJson();
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/access|private|public/i.test(message)) return { code: 'publicStore' };
    return { code: 'unavailable', detail: message };
  }
}
