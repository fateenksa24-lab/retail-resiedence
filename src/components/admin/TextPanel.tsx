'use client';

import { useState } from 'react';
import type { AdminDict } from '@/lib/cms/admin-i18n';
import { messageTokens, type CmsContent } from '@/lib/cms/types';
import { cn } from '@/lib/cn';
import { useAdmin } from './lang';
import { EditedMark, humanize, PanelIntro, ResetButton, type AdminData, type Update } from './shared';
import { input, label } from './styles';

/** Where each group of text appears on the site. */
const GROUP_PATHS: Record<string, string | undefined> = {
  home: '/',
  nav: '/',
  footer: '/',
  residences: '/residences',
  clubhouse: '/clubhouse',
  living: '/living',
  neighborhood: '/neighborhood',
  contact: '/contact',
  common: undefined,
  meta: undefined,
  notFound: undefined,
  images: undefined,
  rooms: undefined,
};

function sectionOf(key: string, t: AdminDict, names: Record<string, string>) {
  const parts = key.split('.');
  const role = (segment: string) => t.text.roles[segment] ?? humanize(segment);
  const sub = (segment: string) => t.text.sections[segment] ?? humanize(segment);
  const groupName = t.text.groups[parts[0]!] ?? humanize(parts[0]!);
  const path = GROUP_PATHS[parts[0]!];
  if (parts.length <= 2) return { heading: groupName, path, label: role(parts[1] ?? key) };
  // Each residence has its own page.
  if (parts[0] === 'residences' && parts[1] === 'items') {
    const slug = parts[2]!;
    return {
      heading: `${groupName} › ${names[`residences.items.${slug}.name`] ?? humanize(slug)}`,
      path: `/residences/${slug}`,
      label: parts.slice(3).map(role).join(' › '),
    };
  }
  return { heading: `${groupName} › ${sub(parts[1]!)}`, path, label: parts.slice(2).map(role).join(' › ') };
}

/** A text edit that would break the site: empty, or a {placeholder} removed. */
export function textProblem(value: string, original: string, t: AdminDict): string | null {
  if (!value.trim()) return t.text.empty;
  const need = messageTokens(original);
  if (need.join() !== messageTokens(value).join()) return t.text.tokens(need.join(' '), need.length);
  return null;
}

export function TextPanel({ data, draft, update, focus }: { data: AdminData; draft: CmsContent; update: Update; focus?: { locale: string; key: string } }) {
  const { t, lang } = useAdmin();
  const [locale, setLocale] = useState(focus?.locale ?? lang);
  const [group, setGroup] = useState('home');
  const [query, setQuery] = useState(focus?.key ?? '');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const defaults = data.messages[locale] ?? {};
  const english = data.messages.en ?? {};
  const edits = draft.messages[locale] ?? {};
  const dir = data.locales.find((l) => l.code === locale)?.dir ?? 'ltr';

  // Grammar templates such as `{n, plural, one {…} other {…}}` are not content; keep them out of the editor.
  const icu = /,\s*(plural|select|selectordinal)\s*,/;
  const keys = Object.keys(english).filter((k) => !icu.test(english[k] ?? '') && !icu.test(defaults[k] ?? ''));
  const q = query.trim().toLowerCase();
  const searching = q.length > 0 || onlyEdited;
  const visible = keys
    .filter((k) => (onlyEdited ? k in edits : true))
    .filter((k) => (q ? [k, edits[k] ?? defaults[k] ?? '', english[k] ?? ''].some((s) => s.toLowerCase().includes(q)) : true))
    .filter((k) => (searching ? true : k.split('.')[0] === group))
    .slice(0, searching ? 120 : undefined);

  const setValue = (key: string, value: string) =>
    update((d) => {
      const map = (d.messages[locale] ??= {});
      if (value === defaults[key]) delete map[key];
      else map[key] = value;
      if (!Object.keys(map).length) delete d.messages[locale];
    });

  const editedIn = (code: string, prefix?: string) =>
    Object.keys(draft.messages[code] ?? {}).filter((k) => !prefix || k.split('.')[0] === prefix).length;

  let lastHeading = '';
  return (
    <div>
      <PanelIntro title={t.text.title}>{t.text.intro}</PanelIntro>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <fieldset>
          <legend className={label}>{t.text.language}</legend>
          <div className="mt-2 flex flex-wrap gap-1">
            {data.locales.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLocale(l.code)}
                aria-pressed={locale === l.code}
                className={cn(
                  'min-h-tap rounded-pill border px-4 text-small transition-colors duration-(--dur-fast)',
                  locale === l.code ? 'border-ink bg-ink text-canvas' : 'border-line hover:border-ink',
                )}
              >
                {l.name}
                {editedIn(l.code) > 0 && (
                  <span className="ms-1.5 text-copper" aria-label={t.text.editedCount(editedIn(l.code))}>
                    •
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="min-w-60 flex-1 md:max-w-sm">
          <label htmlFor="text-search" className={label}>
            {t.text.search}
          </label>
          <input
            id="text-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.text.searchPlaceholder}
            className={`${input} mt-2`}
          />
        </div>
        <label className="flex min-h-tap cursor-pointer items-center gap-2 text-small">
          <input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} className="size-4 accent-ink" />
          {t.text.onlyEdited}
        </label>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        {!searching && (
          <nav aria-label={t.text.pagesLabel} className="lg:sticky lg:top-40 lg:self-start">
            <ul className="flex flex-wrap gap-1 lg:flex-col">
              {Object.keys(GROUP_PATHS).map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setGroup(key);
                      window.scrollTo({ top: 0 });
                    }}
                    aria-current={group === key ? 'true' : undefined}
                    className={cn(
                      'flex min-h-tap w-full items-center justify-between gap-3 px-3 text-start text-small transition-colors duration-(--dur-fast)',
                      group === key ? 'bg-ink text-canvas' : 'hover:bg-canvas-deep',
                    )}
                  >
                    {t.text.groups[key]}
                    {editedIn(locale, key) > 0 && <span className={group === key ? 'text-stone' : 'text-copper-deep'}>{editedIn(locale, key)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className={cn('max-w-3xl min-w-0', searching && 'lg:col-span-2')}>
          {searching && (
            <p className="mb-6 text-small text-ink-muted">
              {visible.length === 0
                ? onlyEdited && !q
                  ? t.text.noneChanged(data.locales.find((l) => l.code === locale)?.name ?? locale)
                  : t.text.noMatch
                : visible.length >= 120
                  ? t.text.first120
                  : t.text.matches(visible.length)}
            </p>
          )}
          {visible.map((key) => {
            const section = sectionOf(key, t, data.messages[lang] ?? english);
            const showHeading = section.heading !== lastHeading;
            lastHeading = section.heading;
            const value = edits[key] ?? defaults[key] ?? '';
            return (
              <div key={key}>
                {showHeading && (
                  <div className="mt-10 mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-2 first:mt-0">
                    <h2 className="text-h4 font-medium">{section.heading}</h2>
                    {section.path && (
                      <a
                        href={`/${locale}${section.path === '/' ? '/' : `${section.path}/`}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-micro text-ink-muted underline underline-offset-4 hover:text-ink"
                      >
                        {t.common.seeOnSite}
                      </a>
                    )}
                  </div>
                )}
                <TextField
                  id={`f-${key}`}
                  label={section.label}
                  value={value}
                  original={defaults[key] ?? ''}
                  dir={dir}
                  english={locale !== 'en' ? english[key] : undefined}
                  t={t}
                  onChange={(v) => setValue(key, v)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  original: string;
  dir: 'ltr' | 'rtl';
  english?: string;
  t: AdminDict;
  onChange: (v: string) => void;
}) {
  const { t } = props;
  const edited = props.value !== props.original;
  const rows = Math.min(10, Math.max(1, Math.ceil(props.value.length / 72) + (props.value.match(/\n/g)?.length ?? 0)));
  const tooLong = props.value.length > props.original.length * 1.5 + 15;
  const problem = edited ? textProblem(props.value, props.original, t) : null;
  return (
    <div className="mb-6">
      <div className="flex min-h-8 items-center justify-between gap-4">
        <label htmlFor={props.id} className="text-small font-medium">
          {props.label}
          {edited && <EditedMark />}
        </label>
        {edited && <ResetButton onClick={() => props.onChange(props.original)} />}
      </div>
      <textarea
        id={props.id}
        value={props.value}
        dir={props.dir}
        rows={rows}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${props.id}-problem` : undefined}
        className={cn(input, 'mt-1 resize-y field-sizing-content', edited && 'border-copper', problem && 'border-2 border-copper-deep')}
      />
      {problem && (
        <p id={`${props.id}-problem`} role="alert" className="mt-1 text-small font-medium text-copper-deep">
          {problem}
        </p>
      )}
      {!problem && tooLong && (
        <p className="mt-1 text-micro text-copper-deep">{t.text.tooLong}</p>
      )}
      {props.english && (
        <p className="mt-1 text-micro text-ink-muted">
          {t.text.english} <span dir="ltr">{props.english}</span>
        </p>
      )}
    </div>
  );
}
