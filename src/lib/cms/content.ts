import { unstable_cache } from 'next/cache';
import { contact, social } from '@/content/contact';
import manifest from '@/content/image-manifest.json';
import { destinations } from '@/content/neighborhood';
import { residences } from '@/content/residences';
import { readContentJson } from './storage';
import { cmsContentSchema, emptyContent, telHref, waDigits, type CmsContent, type CmsImage, type ContactFields, type ResidenceFields, type SocialFields } from './types';

// Loads the saved CMS content and applies it on top of the code defaults. The content is
// cached under the `cms` tag; saving in the admin expires the tag, so pages pick up changes
// on the next request without a deployment.

export const CMS_TAG = 'cms';

type ManifestEntry = (typeof manifest)[keyof typeof manifest];
const images = manifest as Record<string, ManifestEntry & { og?: string }>;

const defaults = structuredClone({
  contact,
  social: social.map((s) => ({ ...s })),
  residences: residences.map((r) => ({ ...r })),
  destinations: destinations.map((d) => ({ ...d })),
  images,
});

export function defaultContactFields(): ContactFields {
  const c = defaults.contact;
  return {
    company: c.company,
    street: c.address.street,
    city: c.address.city,
    postalCode: c.address.postalCode,
    phone: c.phone.display,
    reservations1: c.reservations[0]?.display ?? '',
    reservations2: c.reservations[1]?.display ?? '',
    whatsapp: c.whatsapp.display,
    email: c.email,
    salesEmail: c.salesEmail,
  };
}

export function defaultSocialFields(): SocialFields {
  return Object.fromEntries(defaults.social.map((s) => [s.key, s.href])) as SocialFields;
}

export function defaultResidenceFields(): Record<string, ResidenceFields> {
  return Object.fromEntries(
    defaults.residences.map((r) => [
      r.code,
      { size: r.size, bedrooms: r.bedrooms, bathrooms: r.bathrooms, youtube: r.youtube, vrTour: r.vrTour ?? '' },
    ]),
  );
}

export function defaultDriveTimes(): Record<string, number> {
  return Object.fromEntries(defaults.destinations.map((d) => [d.key, d.minutes]));
}

export function defaultImages(): Record<string, CmsImage> {
  return Object.fromEntries(
    Object.entries(defaults.images)
      .filter(([id]) => !id.startsWith('map/') && !id.startsWith('tour/'))
      .map(([id, e]) => [id, { src: e.src, width: e.width, height: e.height, blurDataURL: e.blurDataURL }]),
  );
}

const readCached = unstable_cache(
  async (): Promise<CmsContent> => {
    const raw = await readContentJson();
    if (!raw) return emptyContent();
    const parsed = cmsContentSchema.safeParse(raw);
    return parsed.success ? parsed.data : emptyContent();
  },
  ['retal-cms-content-v1'],
  { tags: [CMS_TAG] },
);

let current: CmsContent = emptyContent();

/** Fresh content straight from storage (admin only). */
export async function readContentFresh(): Promise<CmsContent> {
  const raw = await readContentJson();
  const parsed = cmsContentSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : emptyContent();
}

/**
 * Loads the CMS content and applies it to the shared content modules (contact, residences,
 * drive times, image manifest). Called from the i18n request config, which every page awaits
 * before it renders, so components keep importing their data as before.
 */
export async function loadCms(): Promise<CmsContent> {
  current = await readCached();
  apply(current);
  return current;
}

function apply(cms: CmsContent) {
  const c = { ...defaultContactFields(), ...cms.contact };
  contact.company = c.company;
  contact.address.street = c.street;
  contact.address.city = c.city;
  contact.address.postalCode = c.postalCode;
  contact.phone = { display: c.phone, href: telHref(c.phone) };
  contact.reservations = [c.reservations1, c.reservations2].filter(Boolean).map((p) => ({ display: p, href: telHref(p) }));
  contact.whatsapp = { display: c.whatsapp, href: `https://wa.me/${waDigits(c.whatsapp)}` };
  contact.email = c.email;
  contact.salesEmail = c.salesEmail;

  for (const s of social as unknown as { key: keyof SocialFields; href: string }[]) {
    s.href = cms.social[s.key] ?? defaultSocialFields()[s.key];
  }

  residences.forEach((r, i) => {
    const base = defaults.residences[i]!;
    const o = cms.residences[r.code] ?? {};
    r.size = o.size ?? base.size;
    r.bedrooms = o.bedrooms ?? base.bedrooms;
    r.bathrooms = o.bathrooms ?? base.bathrooms;
    r.youtube = o.youtube ?? base.youtube;
    r.vrTour = (o.vrTour ?? base.vrTour) || undefined;
    const gallery = cms.galleries[r.code]?.filter((id) => id in defaults.images || id in cms.newImages);
    r.gallery = (gallery?.length ? gallery : base.gallery) as typeof r.gallery;
    // With an edited gallery, its first photo is also the residence's cover.
    r.cover = (gallery?.length ? gallery[0] : base.cover) as typeof r.cover;
  });

  destinations.forEach((d, i) => {
    d.minutes = cms.driveTimes[d.key] ?? defaults.destinations[i]!.minutes;
  });

  for (const [id, base] of Object.entries(defaults.images)) {
    const o = cms.images[id];
    // A replaced photo drops its pre-rendered Open Graph crop and uses the new file instead.
    images[id] = o ? { ...base, ...o, og: undefined } : { ...base };
  }
  // Photos added in the admin join the manifest; ones removed since the last load leave it.
  for (const id of Object.keys(images)) if (!(id in defaults.images) && !(id in cms.newImages)) delete images[id];
  for (const [id, image] of Object.entries(cms.newImages)) {
    images[id] = { src: image.src, width: image.width, height: image.height, blurDataURL: image.blurDataURL, hash: '' };
  }
}

export function defaultGalleries(): Record<string, string[]> {
  return Object.fromEntries(defaults.residences.map((r) => [r.code, [...r.gallery]]));
}

/** Uploaded logos (if any) for the current request. */
export function currentLogo(): CmsContent['logo'] {
  return current.logo;
}

/** Site details client components need; passed down as props from the layout. */
export function clientSiteSettings() {
  return {
    phone: { ...contact.phone },
    whatsapp: { ...contact.whatsapp },
    logo: current.logo,
  };
}
export type SiteSettings = ReturnType<typeof clientSiteSettings>;

/** Default messages with the saved overrides for one locale. */
export function withMessageOverrides<T extends Record<string, unknown>>(
  messages: T,
  overrides: Record<string, string> | undefined,
  newImages: CmsContent['newImages'] = {},
): T {
  if (!overrides && !Object.keys(newImages).length) return messages;
  const out = structuredClone(messages) as Record<string, unknown>;
  // Descriptions of photos added in the admin (one text for every language).
  const alts = out.images as Record<string, string> | undefined;
  if (alts) for (const [id, image] of Object.entries(newImages)) alts[id] = image.alt || ' ';
  if (!overrides) return out as T;
  for (const [key, value] of Object.entries(overrides)) {
    const parts = key.split('.');
    let node = out;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (!next || typeof next !== 'object') {
        node = {};
        break;
      }
      node = next as Record<string, unknown>;
    }
    const last = parts.at(-1)!;
    // Only existing keys can be changed; stale keys from older content are ignored.
    if (typeof node[last] === 'string') node[last] = value;
  }
  return out as T;
}
