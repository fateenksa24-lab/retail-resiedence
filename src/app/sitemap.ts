import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/content/contact';
import { getImage, type ImageId } from '@/content/images';
import { residences } from '@/content/residences';
import { routing } from '@/i18n/routing';
import { loadCms } from '@/lib/cms/content';
import { localePath } from '@/lib/seo';

export const dynamic = 'force-static';

/** Pages and the photographs that represent them in Google Images. */
const pages: [string, ImageId[]][] = [
  ['/', ['site/aerial-compound-dusk', 'clubhouse/pool-night']],
  ['/residences', residences.map((r) => r.cover)],
  ...residences.map((r): [string, ImageId[]] => [`/residences/${r.slug}`, [...new Set([r.cover, ...r.gallery.slice(0, 5), r.plan])]]),
  ['/clubhouse', ['clubhouse/facade-night-wide', 'clubhouse/tennis-night', 'clubhouse/bowling-portrait']],
  ['/living', ['living/playground', 'living/kids-zone-dusk']],
  ['/neighborhood', ['site/aerial-compound-dusk']],
  ['/book', []],
  ['/contact', ['site/gate-sign-dusk']],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await loadCms();
  const now = new Date();
  return pages.flatMap(([path, images]) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${localePath(locale, path)}`,
      lastModified: now,
      changeFrequency: path === '/' ? 'weekly' : 'monthly',
      priority: path === '/' ? 1 : path.startsWith('/residences/') ? 0.8 : 0.7,
      images: images.map((id) => `${SITE_URL}${getImage(id).src}`),
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}${localePath(l, path)}`])),
      },
    })),
  );
}
