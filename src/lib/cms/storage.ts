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
// never overwrites, so two people can't take the same slot. Two marker folders keep the abuse
// limits cheap to check: cms/booking-phones/<digits>/<slot> and cms/booking-ips/<hash>/<time>.
const BOOKINGS = 'cms/bookings/';
const PHONES = 'cms/booking-phones/';
const IPS = 'cms/booking-ips/';
const SLOT = /^\d{4}-\d{2}-\d{2}T\d{2}$/;

/** Names (without .json) of the files under a prefix. */
async function listNames(prefix: string): Promise<string[]> {
  let names: string[] = [];
  if (blobEnabled()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, limit: 1000, cursor });
      names.push(...page.blobs.map((b) => b.pathname.slice(prefix.length)));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } else if (localEnabled()) {
    names = await readdir(localPath(prefix)).catch(() => []);
  }
  return names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));
}

/** Writes a new file; false when it already exists. */
async function putNew(key: string, body: string): Promise<boolean> {
  if (blobEnabled()) {
    try {
      await put(key, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false });
      return true;
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) return false;
      throw error;
    }
  }
  if (localEnabled()) {
    await mkdir(path.dirname(localPath(key)), { recursive: true });
    try {
      await writeFile(localPath(key), body, { flag: 'wx' });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
  }
  throw new Error('Storage is not connected.');
}

async function readJson(key: string): Promise<unknown> {
  if (blobEnabled()) {
    const res = await get(key, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text());
  }
  if (localEnabled()) {
    try {
      return JSON.parse(await readFile(localPath(key), 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

async function remove(keys: string[]): Promise<void> {
  if (!keys.length) return;
  if (blobEnabled()) await del(keys);
  else if (localEnabled()) await Promise.all(keys.map((k) => rm(localPath(k), { force: true })));
}

export type Booking = { key: string; day: string; hour: number; name: string; phone: string; interests: string[]; locale: string; bookedAt: string };

/** Keys of every taken slot ("2026-11-24T10"). */
export const listBookedSlots = () => listNames(BOOKINGS);

/** Takes a slot; false when someone already has it. */
export async function reserveSlot(key: string, booking: Omit<Booking, 'key'>): Promise<boolean> {
  if (!SLOT.test(key)) throw new Error('Invalid slot');
  const ok = await putNew(`${BOOKINGS}${key}.json`, JSON.stringify(booking));
  const digits = booking.phone.replace(/\D/g, '');
  if (ok && digits) await putNew(`${PHONES}${digits}/${key}.json`, '{}').catch(() => undefined);
  return ok;
}

/** Slots this phone number holds from `fromDay` on. */
export async function countPhoneBookings(phone: string, fromDay: string): Promise<number> {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return 0;
  return (await listNames(`${PHONES}${digits}/`)).filter((k) => k.slice(0, 10) >= fromDay).length;
}

/** Records one booking attempt from this visitor and returns how many they made in the last hour. */
export async function noteAttempt(visitor: string): Promise<number> {
  const prefix = `${IPS}${visitor}/`;
  const now = Date.now();
  const times = (await listNames(prefix)).map(Number).filter(Number.isFinite);
  const old = times.filter((t) => now - t > 3_600_000);
  await remove(old.map((t) => `${prefix}${t}.json`)).catch(() => undefined);
  await putNew(`${prefix}${now}.json`, '{}').catch(() => undefined);
  return times.length - old.length + 1;
}

/** Bookings from `fromDay` on, soonest first (admin). */
export async function listBookings(fromDay: string): Promise<Booking[]> {
  const keys = (await listNames(BOOKINGS)).filter((k) => SLOT.test(k) && k.slice(0, 10) >= fromDay).sort();
  const rows = await Promise.all(keys.map(async (key) => ({ key, data: (await readJson(`${BOOKINGS}${key}.json`)) as Partial<Booking> | null })));
  return rows.map(({ key, data }) => ({
    key,
    day: key.slice(0, 10),
    hour: Number(key.slice(11)),
    name: String(data?.name ?? ''),
    phone: String(data?.phone ?? ''),
    interests: Array.isArray(data?.interests) ? data.interests.map(String) : [],
    locale: String(data?.locale ?? ''),
    bookedAt: String(data?.bookedAt ?? ''),
  }));
}

/** Frees a slot so visitors can book it again (admin). */
export async function releaseSlot(key: string): Promise<void> {
  if (!SLOT.test(key)) throw new Error('Invalid slot');
  const data = (await readJson(`${BOOKINGS}${key}.json`)) as Partial<Booking> | null;
  const digits = String(data?.phone ?? '').replace(/\D/g, '');
  await remove([`${BOOKINGS}${key}.json`, ...(digits ? [`${PHONES}${digits}/${key}.json`] : [])]);
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
