import { z } from 'zod';

// Everything the admin can change. Only values that differ from the code defaults are stored,
// so content that nobody edited keeps following the code.

const text = (max: number) => z.string().trim().max(max);

export const cmsImageSchema = z.object({
  src: z.string().regex(/^\/(cms-media|images)\/[\w./-]+$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataURL: z.string().max(4000).regex(/^data:image\//),
});
export type CmsImage = z.infer<typeof cmsImageSchema>;

/** A photo added in the admin. Its id is `cms/<random>/<room>`, so galleries caption it with the room name. */
export const NEW_IMAGE_ID = /^cms\/[a-z0-9]{4,16}\/[a-z0-9-]{1,40}$/;
export const newImageSchema = cmsImageSchema.extend({ alt: z.string().trim().max(300) });
export type NewImage = z.infer<typeof newImageSchema>;

export const contactSchema = z.object({
  company: text(120),
  street: text(160),
  city: text(80),
  postalCode: text(40),
  phone: text(40),
  reservations1: text(40),
  reservations2: text(40),
  whatsapp: text(40),
  email: z.email().max(120),
  salesEmail: z.email().max(120),
});
export type ContactFields = z.infer<typeof contactSchema>;

export const socialSchema = z.object({
  instagram: z.url().max(200),
  x: z.url().max(200),
  linkedin: z.url().max(200),
  facebook: z.url().max(200),
});
export type SocialFields = z.infer<typeof socialSchema>;

export const residenceFieldsSchema = z.object({
  size: z.number().int().min(1).max(5000),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  youtube: z.string().trim().regex(/^[\w-]{0,20}$/),
  vrTour: z.string().trim().regex(/^[\w-]{0,30}$/),
});
export type ResidenceFields = z.infer<typeof residenceFieldsSchema>;

export const cmsContentSchema = z.object({
  updatedAt: z.string().optional(),
  /** Per locale: message path (`home.hero.title`) → text. */
  messages: z.record(z.string(), z.record(z.string().max(200), z.string().max(5000))).default({}),
  contact: contactSchema.partial().default({}),
  social: socialSchema.partial().default({}),
  /** Residence code → changed fields. */
  residences: z.record(z.string(), residenceFieldsSchema.partial()).default({}),
  /** Destination key → minutes. */
  driveTimes: z.record(z.string(), z.number().int().min(1).max(600)).default({}),
  /** Image id → replacement. */
  images: z.record(z.string(), cmsImageSchema).default({}),
  /** Residence code → ordered photo ids (existing ids and `cms/…` ids). */
  galleries: z.record(z.string(), z.array(z.string().max(120)).min(1).max(40)).default({}),
  /** Photos added in the admin, by id. */
  newImages: z.record(z.string().regex(NEW_IMAGE_ID), newImageSchema).default({}),
  logo: z.object({ onDark: cmsImageSchema.optional(), onLight: cmsImageSchema.optional() }).default({}),
});
export type CmsContent = z.infer<typeof cmsContentSchema>;

export const emptyContent = (): CmsContent => cmsContentSchema.parse({});

/** `{name}` arguments and `<tag>` markup in an ICU message; edits must keep the same set. */
export function messageTokens(value: string): string[] {
  const args = [...value.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => `{${m[1]}}`);
  const tags = [...value.matchAll(/<\/?(\w+)\s*\/?>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...args, ...tags])].sort();
}

/** `+966 13 825 9600` → `tel:+966138259600` */
export const telHref = (display: string) => `tel:+${display.replace(/\D/g, '')}`;
/** `+966 56 241 6136` → `966562416136` */
export const waDigits = (display: string) => display.replace(/\D/g, '');
