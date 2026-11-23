'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { checkPassword, endSession, isAdmin, startSession } from './auth';
import {
  CMS_TAG,
  defaultContactFields,
  defaultDriveTimes,
  defaultGalleries,
  defaultImages,
  defaultResidenceFields,
  defaultSocialFields,
  readContentFresh,
} from './content';
import { flattenMessages } from './flatten';
import { adminT } from './lang-server';
import { bookingToday } from '@/content/booking';
import { listBookings, putMedia, readVersion, releaseSlot, storageReady, writeContentJson, writeVersion, type Booking } from './storage';
import { cmsContentSchema, messageTokens, type CmsContent } from './types';

const SESSION_EXPIRED = 'session-expired';

export type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  if (checkPassword(String(formData.get('password') ?? ''))) {
    await startSession();
    redirect('/admin/');
  }
  // Slow down guessing.
  await new Promise((r) => setTimeout(r, 1000));
  return { error: (await adminT()).login.wrong };
}

/** Signs in again from inside the editor (session expired), without leaving the page. */
export async function relogin(password: string): Promise<boolean> {
  if (checkPassword(password)) {
    await startSession();
    return true;
  }
  await new Promise((r) => setTimeout(r, 1000));
  return false;
}

export async function logout() {
  await endSession();
  redirect('/admin/');
}

export type SaveResult = { ok: true; content: CmsContent } | { ok: false; error: string };

export async function saveContent(input: unknown, baseUpdatedAt: string | undefined): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, error: SESSION_EXPIRED };
  const t = (await adminT()).server;
  if (!storageReady()) return { ok: false, error: t.notConnected };

  const parsed = cmsContentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: t.invalidField(issue?.path.join(' › ') ?? '', issue?.message ?? '') };
  }

  const previous = await readContentFresh();
  if (previous.updatedAt && previous.updatedAt !== baseUpdatedAt) {
    return { ok: false, error: t.conflict };
  }

  const draft = parsed.data;
  const next: CmsContent = {
    updatedAt: new Date().toISOString(),
    messages: {},
    contact: changed(draft.contact, defaultContactFields()),
    social: changed(draft.social, defaultSocialFields()),
    residences: {},
    driveTimes: changed(draft.driveTimes, defaultDriveTimes()) as Record<string, number>,
    images: {},
    galleries: {},
    newImages: {},
    logo: draft.logo,
  };

  for (const locale of routing.locales) {
    const defaults = flattenMessages((await import(`../../../messages/${locale}.json`)).default);
    const edits: Record<string, string> = {};
    for (const [key, value] of Object.entries(draft.messages[locale] ?? {})) {
      const original = defaults[key];
      if (original === undefined || value === original) continue;
      if (!value.trim()) return { ok: false, error: t.emptyText(key, locale.toUpperCase()) };
      if (messageTokens(value).join() !== messageTokens(original).join()) {
        return { ok: false, error: t.tokens(key, locale.toUpperCase(), messageTokens(original).join(' ')) };
      }
      edits[key] = value;
    }
    if (Object.keys(edits).length) next.messages[locale] = edits;
  }

  const residenceDefaults = defaultResidenceFields();
  for (const [code, fields] of Object.entries(draft.residences)) {
    const base = residenceDefaults[code];
    if (!base) continue;
    const diff = changed(fields, base);
    if (Object.keys(diff).length) next.residences[code] = diff;
  }

  const imageDefaults = defaultImages();
  for (const [id, image] of Object.entries(draft.images)) {
    if (imageDefaults[id] && imageDefaults[id].src !== image.src) next.images[id] = image;
  }

  const imageIds = new Set(Object.keys(imageDefaults));
  const galleryDefaults = defaultGalleries();
  for (const [code, ids] of Object.entries(draft.galleries)) {
    if (!galleryDefaults[code]) continue;
    const valid = ids.filter((id) => imageIds.has(id) || id in draft.newImages);
    if (!valid.length) return { ok: false, error: t.galleryEmpty };
    if (valid.join() !== galleryDefaults[code].join()) next.galleries[code] = valid;
  }
  // Keep only added photos that a gallery still shows.
  const shown = new Set(Object.values(next.galleries).flat());
  for (const [id, image] of Object.entries(draft.newImages)) if (shown.has(id)) next.newImages[id] = image;

  try {
    await writeContentJson(next);
    await writeVersion(next).catch((error) => console.error('[cms] could not write version history', error));
  } catch (error) {
    console.error('[cms] save failed', error);
    return { ok: false, error: t.saveFailed };
  }

  // Uploads are never deleted, so every saved version stays restorable.
  updateTag(CMS_TAG);
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/sitemap.xml');
  return { ok: true, content: next };
}

export type UploadResult = { ok: true; src: string } | { ok: false; error: string };

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

export async function uploadImage(formData: FormData): Promise<UploadResult> {
  if (!(await isAdmin())) return { ok: false, error: SESSION_EXPIRED };
  const t = (await adminT()).server;
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: t.noFile };
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: t.fileType };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: t.fileSize };
  const base = String(formData.get('name') ?? 'image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'image';
  try {
    const key = await putMedia(`${base}.${ext}`, await file.arrayBuffer(), file.type);
    return { ok: true, src: `/cms-media/${key}` };
  } catch (error) {
    console.error('[cms] upload failed', error);
    return { ok: false, error: t.uploadFailed };
  }
}

function changed<T extends object>(draft: Partial<T>, defaults: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(draft).filter(([k, v]) => v !== undefined && v !== (defaults as Record<string, unknown>)[k]),
  ) as Partial<T>;
}

export type VersionResult = { ok: true; content: CmsContent } | { ok: false; error: string };

/** Loads a saved version into the editor (it is published only when the admin saves). */
export async function loadVersion(key: string): Promise<VersionResult> {
  if (!(await isAdmin())) return { ok: false, error: SESSION_EXPIRED };
  const parsed = cmsContentSchema.safeParse(await readVersion(key));
  return parsed.success ? { ok: true, content: parsed.data } : { ok: false, error: (await adminT()).server.versionMissing };
}

export type BookingsResult = { ok: true; bookings: Booking[] } | { ok: false; error: string };

/** Upcoming visit bookings, soonest first. */
export async function loadBookings(): Promise<BookingsResult> {
  if (!(await isAdmin())) return { ok: false, error: SESSION_EXPIRED };
  const t = (await adminT()).server;
  if (!storageReady()) return { ok: false, error: t.notConnected };
  try {
    return { ok: true, bookings: await listBookings(bookingToday()) };
  } catch (error) {
    console.error('[cms] could not list bookings', error);
    return { ok: false, error: t.bookingsFailed };
  }
}

/** Frees a booked slot so visitors can book it again. */
export async function freeBooking(key: string): Promise<BookingsResult> {
  if (!(await isAdmin())) return { ok: false, error: SESSION_EXPIRED };
  try {
    await releaseSlot(key);
  } catch (error) {
    console.error('[cms] could not free slot', error);
    return { ok: false, error: (await adminT()).server.bookingsFailed };
  }
  return loadBookings();
}
