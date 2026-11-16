import { AdminEditor, type AdminData } from '@/components/admin/AdminEditor';
import { LoginForm } from '@/components/admin/LoginForm';
import { destinations } from '@/content/neighborhood';
import { residences } from '@/content/residences';
import { dirFor, localeNames, routing } from '@/i18n/routing';
import { authConfigured, isAdmin } from '@/lib/cms/auth';
import {
  defaultContactFields,
  defaultDriveTimes,
  defaultGalleries,
  defaultImages,
  defaultResidenceFields,
  defaultSocialFields,
  readContentFresh,
} from '@/lib/cms/content';
import { flattenMessages } from '@/lib/cms/flatten';
import { adminT } from '@/lib/cms/lang-server';
import { listVersions, storageProblem } from '@/lib/cms/storage';
import { emptyContent } from '@/lib/cms/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!authConfigured()) {
    const t = await adminT();
    return (
      <main className="mx-auto max-w-prose px-6 py-24">
        <h1 className="text-h3 font-medium">{t.setup.title}</h1>
        <p className="mt-4 text-ink-soft">{t.setup.body}</p>
      </main>
    );
  }
  if (!(await isAdmin())) return <LoginForm />;

  const messages = Object.fromEntries(
    await Promise.all(
      routing.locales.map(async (l) => [l, flattenMessages((await import(`../../../messages/${l}.json`)).default)] as const),
    ),
  );
  const en = messages.en!;
  const ar = messages.ar!;
  /** A website label in both dashboard languages. */
  const both = (key: string, fallback: string) => ({ en: en[key] ?? fallback, ar: ar[key] ?? en[key] ?? fallback });
  const problem = await storageProblem();

  const data: AdminData = {
    content: problem ? emptyContent() : await readContentFresh(),
    versions: problem ? [] : await listVersions().catch(() => []),
    storageProblem: problem,
    locales: routing.locales.map((code) => ({ code, name: localeNames[code], dir: dirFor(code) })),
    messages,
    contact: defaultContactFields(),
    social: defaultSocialFields(),
    residences: residences.map((r) => ({ code: r.code, slug: r.slug, name: both(`residences.items.${r.slug}.name`, r.code), plan: r.plan })),
    residenceDefaults: defaultResidenceFields(),
    galleries: defaultGalleries(),
    rooms: Object.keys(en)
      .filter((k) => k.startsWith('rooms.'))
      .map((k) => ({ key: k.slice('rooms.'.length), name: both(k, k) })),
    destinations: destinations.map((d) => ({ key: d.key, name: both(`neighborhood.destinations.${d.key}`, d.key) })),
    driveTimes: defaultDriveTimes(),
    images: Object.entries(defaultImages()).map(([id, image]) => ({ id, alt: both(`images.${id}`, ''), image })),
  };

  return <AdminEditor data={data} />;
}
