'use client';

import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import type { CmsContent, CmsImage } from '@/lib/cms/types';
import { cn } from '@/lib/cn';
import { useAdmin } from './lang';
import { humanize, PanelIntro, thumb, type AdminData, type Update, type Uploader } from './shared';
import { btn, input } from './styles';

const randomId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
const orientation = (i: CmsImage) => (i.height > i.width * 1.05 ? 'portrait' : i.width > i.height * 1.05 ? 'landscape' : 'square');

type Group = { key: string; name: string; residence?: AdminData['residences'][number] };

export function PhotosPanel({ data, draft, update, upload }: { data: AdminData; draft: CmsContent; update: Update; upload: Uploader }) {
  const { t, lang } = useAdmin();
  const groups = useMemo<Group[]>(
    () => [
      { key: 'site', name: t.photos.groups.site! },
      { key: 'clubhouse', name: t.photos.groups.clubhouse! },
      { key: 'living', name: t.photos.groups.living! },
      ...data.residences.map((r) => ({ key: `residences/${r.code}`, name: r.name[lang], residence: r })),
    ],
    [data.residences, t, lang],
  );
  const [active, setActive] = useState(groups[0]!.key);
  const group = groups.find((g) => g.key === active) ?? groups[0]!;
  const defaults = useMemo(() => Object.fromEntries(data.images.map((i) => [i.id, i])), [data.images]);

  const editedCount = (g: Group) => {
    const own = Object.keys(draft.images).filter((id) => id.startsWith(`${g.key}/`)).length;
    return own + (g.residence && draft.galleries[g.residence.code] ? 1 : 0);
  };

  return (
    <div>
      <PanelIntro title={t.photos.title}>{t.photos.intro}</PanelIntro>

      <nav aria-label={t.photos.groupsLabel} className="-mx-1 mb-8 flex flex-wrap gap-1">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActive(g.key)}
            aria-pressed={active === g.key}
            className={cn(
              'min-h-tap rounded-pill border px-4 text-small transition-colors duration-(--dur-fast)',
              active === g.key ? 'border-ink bg-ink text-canvas' : 'border-line hover:border-ink',
            )}
          >
            {g.name}
            {editedCount(g) > 0 && <span className="ms-1.5 text-copper">•</span>}
          </button>
        ))}
      </nav>

      {group.residence ? (
        <ResidencePhotos key={group.key} data={data} draft={draft} update={update} upload={upload} residence={group.residence} defaults={defaults} />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-5">
          {data.images
            .filter((i) => i.id.startsWith(`${group.key}/`))
            .map(({ id, alt, image }) => (
              <PhotoCard
                key={id}
                title={lang === 'en' ? humanize(id.split('/').pop() ?? id) : ''}
                alt={alt[lang]}
                current={draft.images[id] ?? image}
                original={image}
                edited={Boolean(draft.images[id])}
                onReplace={async (file) => {
                  const next = await upload(file, id.replace(/\//g, '-'), 'photo');
                  if (next) update((d) => void (d.images[id] = next));
                }}
                onRestore={() => update((d) => void delete d.images[id])}
              />
            ))}
        </ul>
      )}
    </div>
  );
}

function ResidencePhotos({
  data,
  draft,
  update,
  upload,
  residence,
  defaults,
}: {
  data: AdminData;
  draft: CmsContent;
  update: Update;
  upload: Uploader;
  residence: AdminData['residences'][number];
  defaults: Record<string, AdminData['images'][number]>;
}) {
  const { t, lang } = useAdmin();
  const code = residence.code;
  const original = data.galleries[code] ?? [];
  const gallery = draft.galleries[code] ?? original;
  const edited = Boolean(draft.galleries[code]);
  const rooms = useMemo(() => Object.fromEntries(data.rooms.map((r) => [r.key, r.name[lang]])), [data.rooms, lang]);
  const addRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const setGallery = (d: CmsContent, ids: string[]) => {
    if (ids.join() === original.join()) delete d.galleries[code];
    else d.galleries[code] = ids;
  };
  const move = (from: number, to: number) =>
    update((d) => {
      const ids = [...(d.galleries[code] ?? original)];
      const [item] = ids.splice(from, 1);
      ids.splice(to, 0, item!);
      setGallery(d, ids);
    });

  const addFiles = async (files: File[]) => {
    setAdding((n) => n + files.length);
    for (const file of files) {
      const image = await upload(file, `${code}-photo`, 'photo');
      setAdding((n) => n - 1);
      if (!image) continue;
      const id = `cms/${randomId()}/living-room`;
      update((d) => {
        d.newImages[id] = { ...image, alt: '' };
        setGallery(d, [...(d.galleries[code] ?? original), id]);
      });
    }
  };

  const plan = residence.plan;
  const planDefault = defaults[plan];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="text-h4 font-medium">
          {t.photos.gallery} <span className="text-small font-normal text-ink-muted">· {t.photos.galleryCount(gallery.length)}</span>
        </h2>
        <div className="flex gap-4">
          {edited && (
            <button
              type="button"
              onClick={() =>
                update((d) => {
                  for (const id of d.galleries[code] ?? []) if (id.startsWith('cms/')) delete d.newImages[id];
                  delete d.galleries[code];
                })
              }
              className={btn.quiet}
            >
              {t.photos.restoreGallery}
            </button>
          )}
          <a href={`/${lang}/residences/${residence.slug}/`} target="_blank" rel="noopener noreferrer" className={btn.quiet}>
            {t.common.seePage}
          </a>
        </div>
      </div>
      <p className="-mt-2 mb-6 text-small text-ink-muted">{t.photos.galleryHint}</p>

      <ol className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-5">
        {gallery.map((id, index) => {
          const added = draft.newImages[id];
          const base = defaults[id];
          const current = added ?? draft.images[id] ?? base?.image;
          if (!current) return null;
          const room = id.slice(id.lastIndexOf('/') + 1);
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragFrom(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== index) move(dragFrom, index);
                setDragFrom(null);
              }}
              onDragEnd={() => setDragFrom(null)}
              className={cn('cursor-grab active:cursor-grabbing', dragFrom === index && 'opacity-40')}
            >
              <PhotoCard
                as="div"
                badge={String(index + 1)}
                title={rooms[room] ?? humanize(room)}
                alt={added ? added.alt : (base?.alt[lang] ?? '')}
                current={current}
                original={base?.image}
                edited={!added && Boolean(draft.images[id])}
                isNew={Boolean(added)}
                onReplace={async (file) => {
                  const next = await upload(file, `${code}-${room}`, 'photo');
                  if (!next) return;
                  update((d) => {
                    if (d.newImages[id]) d.newImages[id] = { ...next, alt: d.newImages[id].alt };
                    else d.images[id] = next;
                  });
                }}
                onRestore={() => update((d) => void delete d.images[id])}
                extra={
                  <>
                    {added && (
                      <div className="mt-2 grid gap-2">
                        <label className="text-micro text-ink-muted">
                          {t.photos.room}
                          <select
                            value={room}
                            onChange={(e) => {
                              const nextId = `cms/${randomId()}/${e.target.value}`;
                              update((d) => {
                                const image = d.newImages[id];
                                if (!image) return;
                                delete d.newImages[id];
                                d.newImages[nextId] = image;
                                setGallery(d, (d.galleries[code] ?? original).map((x) => (x === id ? nextId : x)));
                              });
                            }}
                            className={cn(input, 'mt-1 py-2 text-small')}
                          >
                            {data.rooms.map((r) => (
                              <option key={r.key} value={r.key}>
                                {r.name[lang]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-micro text-ink-muted">
                          {t.photos.description}
                          <input
                            value={added.alt}
                            maxLength={300}
                            placeholder={t.photos.descriptionPlaceholder}
                            onChange={(e) =>
                              update((d) => {
                                const image = d.newImages[id];
                                if (image) image.alt = e.target.value;
                              })
                            }
                            className={cn(input, 'mt-1 py-2 text-small')}
                          />
                        </label>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                        className={cn(btn.quiet, 'disabled:opacity-30')}
                        aria-label={t.photos.moveEarlier(index + 1)}
                      >
                        {t.photos.earlier}
                      </button>
                      <button
                        type="button"
                        disabled={index === gallery.length - 1}
                        onClick={() => move(index, index + 1)}
                        className={cn(btn.quiet, 'disabled:opacity-30')}
                        aria-label={t.photos.moveLater(index + 1)}
                      >
                        {t.photos.later}
                      </button>
                      {gallery.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            update((d) => {
                              setGallery(d, (d.galleries[code] ?? original).filter((x) => x !== id));
                              if (id.startsWith('cms/')) delete d.newImages[id];
                            })
                          }
                          className={cn(btn.quiet, 'text-copper-deep')}
                        >
                          {t.photos.remove}
                        </button>
                      )}
                    </div>
                  </>
                }
              />
            </li>
          );
        })}
        <li>
          <input
            ref={addRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              if (files.length) void addFiles(files);
            }}
          />
          <button
            type="button"
            onClick={() => addRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
              if (files.length) void addFiles(files);
            }}
            className="grid aspect-4/3 w-full place-items-center border border-dashed border-ink-muted text-center text-small transition-colors duration-(--dur-fast) hover:border-ink hover:bg-canvas-deep"
          >
            <span>
              <span className="block text-h3 leading-none">+</span>
              {adding ? t.photos.uploadingN(adding) : t.photos.add}
              <span className="mt-1 block text-micro text-ink-muted">{t.photos.addHint}</span>
            </span>
          </button>
        </li>
      </ol>

      {planDefault && (
        <section className="mt-14">
          <h2 className="mb-5 border-b border-line pb-2 text-h4 font-medium">{t.photos.floorPlan}</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <PhotoCard
              title={t.photos.floorPlan}
              alt={planDefault.alt[lang]}
              current={draft.images[plan] ?? planDefault.image}
              original={planDefault.image}
              edited={Boolean(draft.images[plan])}
              contain
              onReplace={async (file) => {
                const next = await upload(file, `${code}-plan`, 'photo');
                if (next) update((d) => void (d.images[plan] = next));
              }}
              onRestore={() => update((d) => void delete d.images[plan])}
            />
          </ul>
        </section>
      )}
    </div>
  );
}

function PhotoCard(props: {
  as?: 'li' | 'div';
  title: string;
  alt: string;
  current: CmsImage;
  original?: CmsImage;
  edited: boolean;
  isNew?: boolean;
  badge?: string;
  contain?: boolean;
  extra?: React.ReactNode;
  onReplace: (file: File) => Promise<void>;
  onRestore: () => void;
}) {
  const { t } = useAdmin();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Tag = props.as ?? 'li';
  const portrait = props.current.height > props.current.width;
  const mismatch = props.edited && props.original && orientation(props.original) !== orientation(props.current);
  return (
    <Tag>
      <div className={cn('relative overflow-hidden bg-canvas-deep', portrait ? 'aspect-3/4' : 'aspect-4/3')}>
        <Image
          src={thumb(props.current.src)}
          alt={props.alt}
          fill
          unoptimized
          sizes="20vw"
          draggable={false}
          className={cn(props.contain ? 'object-contain p-2' : 'object-cover', busy && 'opacity-40')}
        />
        {busy && <span className="absolute inset-0 grid place-items-center text-small font-medium">{t.photos.uploading}</span>}
        {props.badge && (
          <span className="absolute start-2 top-2 grid size-7 place-items-center rounded-pill bg-night text-micro text-bone tabular-nums">{props.badge}</span>
        )}
        {(props.edited || props.isNew) && !busy && (
          <span className="absolute end-2 top-2 rounded-pill bg-copper px-2.5 py-1 text-micro text-night">
            {props.isNew ? t.photos.badgeNew : t.photos.badgeReplaced}
          </span>
        )}
      </div>
      {props.title && <p className="mt-2 text-small font-medium">{props.title}</p>}
      {!props.isNew && props.alt && <p className={cn('line-clamp-2 text-micro text-ink-muted', !props.title && 'mt-2')}>{props.alt}</p>}
      {mismatch && (
        <p className="mt-1 text-micro text-copper-deep">
          {t.photos.mismatch(t.photos.orientation[orientation(props.original!)], t.photos.orientation[orientation(props.current)])}
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            await props.onReplace(file);
            setBusy(false);
          }}
        />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={btn.quiet}>
          {t.common.replace}
        </button>
        {props.edited && (
          <button type="button" onClick={props.onRestore} className={btn.quiet}>
            {t.common.restoreOriginal}
          </button>
        )}
      </div>
      {props.extra}
    </Tag>
  );
}
