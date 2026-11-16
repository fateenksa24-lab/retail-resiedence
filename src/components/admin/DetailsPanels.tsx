'use client';

import type { AdminDict } from '@/lib/cms/admin-i18n';
import type { CmsContent, ContactFields, ResidenceFields, SocialFields } from '@/lib/cms/types';
import { cn } from '@/lib/cn';
import { useAdmin } from './lang';
import { NumberInput, PanelIntro, SimpleField, type AdminData, type Update } from './shared';
import { input } from './styles';

export const CONTACT_KINDS: Record<keyof ContactFields, 'phone' | 'email' | 'text'> = {
  phone: 'phone',
  whatsapp: 'phone',
  reservations1: 'phone',
  reservations2: 'phone',
  email: 'email',
  salesEmail: 'email',
  company: 'text',
  street: 'text',
  city: 'text',
  postalCode: 'text',
};

const SOCIAL_KEYS: (keyof SocialFields)[] = ['instagram', 'x', 'linkedin', 'facebook'];

export function contactProblem(kind: 'phone' | 'email' | 'text' | 'url', value: string, t: AdminDict, optional = false): string | null {
  const v = value.trim();
  const p = t.contact.problems;
  if (!v) return optional ? null : p.empty;
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return p.email;
  if (kind === 'phone' && v.replace(/\D/g, '').length < 7) return p.phone;
  if (kind === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) return p.url;
  return null;
}

export function ContactPanel({ data, draft, update }: { data: AdminData; draft: CmsContent; update: Update }) {
  const { t } = useAdmin();
  const fields = (Object.keys(CONTACT_KINDS) as (keyof ContactFields)[]).map((key) => ({ key, kind: CONTACT_KINDS[key], ...t.contact.fields[key]! }));
  return (
    <div className="max-w-3xl">
      <PanelIntro title={t.contact.title}>{t.contact.intro}</PanelIntro>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        {fields.map((f) => {
          const value = draft.contact[f.key] ?? data.contact[f.key];
          const problem = value !== data.contact[f.key] ? contactProblem(f.kind, value, t, f.key === 'reservations2') : null;
          return (
            <div key={f.key}>
              <SimpleField
                id={`c-${f.key}`}
                label={f.label}
                hint={f.hint}
                type={f.kind === 'email' ? 'email' : f.kind === 'phone' ? 'tel' : 'text'}
                value={value}
                original={data.contact[f.key]}
                dir={f.kind === 'text' ? undefined : 'ltr'}
                onChange={(v) =>
                  update((d) => {
                    if (v === data.contact[f.key]) delete d.contact[f.key];
                    else d.contact[f.key] = v;
                  })
                }
              />
              {problem && (
                <p role="alert" className="mt-1 text-small font-medium text-copper-deep">
                  {problem}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <h2 className="mt-12 mb-4 border-b border-line pb-2 text-h4 font-medium">{t.contact.socialTitle}</h2>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        {SOCIAL_KEYS.map((key) => ({ key, label: t.contact.social[key]! })).map((f) => {
          const value = draft.social[f.key] ?? data.social[f.key];
          const problem = value !== data.social[f.key] ? contactProblem('url', value, t) : null;
          return (
            <div key={f.key}>
              <SimpleField
                id={`s-${f.key}`}
                label={f.label}
                type="url"
                value={value}
                original={data.social[f.key]}
                dir="ltr"
                onChange={(v) =>
                  update((d) => {
                    if (v === data.social[f.key]) delete d.social[f.key];
                    else d.social[f.key] = v;
                  })
                }
              />
              {problem && (
                <p role="alert" className="mt-1 text-small font-medium text-copper-deep">
                  {problem}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RESIDENCE_COLUMNS: { key: keyof ResidenceFields; numeric: boolean }[] = [
  { key: 'size', numeric: true },
  { key: 'bedrooms', numeric: true },
  { key: 'bathrooms', numeric: true },
  { key: 'youtube', numeric: false },
  { key: 'vrTour', numeric: false },
];

/** Accepts a full YouTube link and keeps just the video ID. */
export function youtubeId(value: string) {
  const v = value.trim();
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{6,20})/);
  return m ? m[1]! : v.replace(/[^\w-]/g, '');
}

/** Accepts a full tour link (…?m=ID) and keeps just the ID. */
export function tourId(value: string) {
  const v = value.trim();
  const m = v.match(/[?&]m=([\w-]+)/);
  return m ? m[1]! : v.replace(/[^\w-]/g, '');
}

export function ResidencesPanel({ data, draft, update }: { data: AdminData; draft: CmsContent; update: Update }) {
  const { t, lang } = useAdmin();
  const columns = RESIDENCE_COLUMNS.map((c) => ({ ...c, ...t.residences.columns[c.key]! }));
  return (
    <div>
      <PanelIntro title={t.residences.title}>{t.residences.intro}</PanelIntro>
      <div className="overflow-x-auto">
        <table className="w-full min-w-3xl border-collapse text-small">
          <thead>
            <tr className="border-b border-ink">
              <th scope="col" className="py-3 pe-4 text-start font-medium">
                {t.residences.residence}
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-2 py-3 text-start align-bottom font-medium">
                  {c.label}
                  {c.hint && <span className="block text-micro font-normal text-ink-muted">{c.hint}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.residences.map((r) => {
              const base = data.residenceDefaults[r.code]!;
              const name = r.name[lang];
              return (
                <tr key={r.code} className="border-b border-line">
                  <th scope="row" className="py-3 pe-4 text-start font-medium">
                    {name}
                    <a
                      href={`/${lang}/residences/${r.slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-micro font-normal text-ink-muted underline underline-offset-4 hover:text-ink"
                    >
                      {t.common.seePage}
                    </a>
                  </th>
                  {columns.map((c) => {
                    const value = draft.residences[r.code]?.[c.key] ?? base[c.key];
                    const set = (v: string | number) =>
                      update((d) => {
                        const row = (d.residences[r.code] ??= {});
                        if (v === base[c.key]) delete row[c.key];
                        else (row as Record<string, unknown>)[c.key] = v;
                        if (!Object.keys(row).length) delete d.residences[r.code];
                      });
                    return (
                      <td key={c.key} className="px-2 py-2">
                        {c.numeric ? (
                          <NumberInput label={`${name}: ${c.label}`} value={Number(value)} edited={value !== base[c.key]} onChange={set} />
                        ) : (
                          <input
                            aria-label={`${name}: ${c.label}`}
                            value={String(value)}
                            dir="ltr"
                            placeholder={c.key === 'vrTour' ? t.residences.noTour : ''}
                            onChange={(e) => set(c.key === 'youtube' ? youtubeId(e.target.value) : tourId(e.target.value))}
                            className={cn(input, 'min-w-36', value !== base[c.key] && 'border-copper')}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-16 text-h3 font-medium">{t.residences.driveTitle}</h2>
      <p className="mt-2 mb-6 max-w-measure text-small text-ink-soft">{t.residences.driveIntro}</p>
      <div className="grid max-w-3xl gap-x-8 md:grid-cols-2">
        {data.destinations.map((dest) => {
          const base = data.driveTimes[dest.key]!;
          const value = draft.driveTimes[dest.key] ?? base;
          return (
            <div key={dest.key} className="flex items-center justify-between gap-4 border-b border-line py-2">
              <span className="text-small">{dest.name[lang]}</span>
              <span className="flex shrink-0 items-center gap-2">
                <NumberInput
                  label={t.residences.minutesOf(dest.name[lang])}
                  value={value}
                  edited={value !== base}
                  onChange={(v) =>
                    update((d) => {
                      if (v === base) delete d.driveTimes[dest.key];
                      else d.driveTimes[dest.key] = v;
                    })
                  }
                />
                <span className="text-micro text-ink-muted">{t.common.minutes}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
