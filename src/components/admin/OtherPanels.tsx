'use client';

import { useRef, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import type { Version } from '@/lib/cms/storage';
import type { CmsContent, CmsImage } from '@/lib/cms/types';
import { cn } from '@/lib/cn';
import { useAdmin } from './lang';
import { PanelIntro, type Update, type Uploader } from './shared';
import { btn } from './styles';

export function LogoPanel({ draft, update, upload }: { draft: CmsContent; update: Update; upload: Uploader }) {
  const { t } = useAdmin();
  const slots = [
    { key: 'onDark' as const, ...t.logo.onDark, dark: true },
    { key: 'onLight' as const, ...t.logo.onLight, dark: false },
  ];
  return (
    <div className="max-w-4xl">
      <PanelIntro title={t.logo.title}>{t.logo.intro}</PanelIntro>
      <div className="grid gap-8 md:grid-cols-2">
        {slots.map((slot) => (
          <LogoSlot
            key={slot.key}
            title={slot.title}
            where={slot.where}
            dark={slot.dark}
            custom={draft.logo[slot.key]}
            onUpload={async (file) => {
              const next = await upload(file, `logo-${slot.key === 'onDark' ? 'dark' : 'light'}`, 'logo');
              if (next) update((d) => void (d.logo[slot.key] = next));
            }}
            onRestore={() => update((d) => void delete d.logo[slot.key])}
          />
        ))}
      </div>
    </div>
  );
}

function LogoSlot(props: { title: string; where: string; dark: boolean; custom?: CmsImage; onUpload: (file: File) => Promise<void>; onRestore: () => void }) {
  const { t } = useAdmin();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className={cn('grid aspect-2/1 place-items-center px-8', props.dark ? 'bg-night text-bone' : 'border border-line bg-canvas text-ink')}>
        {busy ? <span className="text-small">{t.logo.uploading}</span> : <Logo className="h-14 w-auto max-w-full" custom={props.custom} />}
      </div>
      <h2 className="mt-3 text-small font-medium">{props.title}</h2>
      <p className="text-micro text-ink-muted">{props.where}</p>
      <div className="mt-1 flex flex-wrap gap-x-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/svg+xml,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            await props.onUpload(file);
            setBusy(false);
          }}
        />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={btn.quiet}>
          {props.custom ? t.common.replace : t.logo.upload}
        </button>
        {props.custom && (
          <button type="button" onClick={props.onRestore} className={btn.quiet}>
            {t.logo.useBuiltIn}
          </button>
        )}
      </div>
    </div>
  );
}

export function HistoryPanel({
  versions,
  current,
  onOpen,
  onStartOver,
  loading,
}: {
  versions: Version[];
  current?: string;
  onOpen: (v: Version) => void;
  onStartOver: () => void;
  loading: string | null;
}) {
  const { t } = useAdmin();
  return (
    <div className="max-w-3xl">
      <PanelIntro title={t.history.title}>{t.history.intro}</PanelIntro>
      {versions.length === 0 ? (
        <p className="border-y border-line py-6 text-small text-ink-muted">{t.history.empty}</p>
      ) : (
        <ol className="border-t border-line">
          {versions.map((v, i) => {
            const isCurrent = v.savedAt === current || (!current && i === 0);
            return (
              <li key={v.key} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-3">
                <span className="text-small">
                  {t.formatDate(v.savedAt)}
                  {isCurrent && <span className="ms-3 rounded-pill bg-ink px-2.5 py-1 text-micro text-canvas">{t.history.current}</span>}
                </span>
                {!isCurrent && (
                  <button type="button" disabled={loading !== null} onClick={() => onOpen(v)} className={btn.outline}>
                    {loading === v.key ? t.history.opening : t.history.open}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-12 border border-line p-5">
        <h2 className="text-small font-medium">{t.history.startOverTitle}</h2>
        <p className="mt-1 text-small text-ink-soft">{t.history.startOverBody}</p>
        <button type="button" onClick={onStartOver} className={cn(btn.outline, 'mt-4')}>
          {t.history.startOverButton}
        </button>
      </div>
    </div>
  );
}
