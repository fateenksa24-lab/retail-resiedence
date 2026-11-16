'use client';

import { useState } from 'react';
import type { CmsContent, CmsImage, ContactFields, ResidenceFields, SocialFields } from '@/lib/cms/types';
import type { StorageProblem, Version } from '@/lib/cms/storage';
import { cn } from '@/lib/cn';
import { useAdmin } from './lang';
import { input } from './styles';

/** A label in both dashboard languages. */
export type Bilingual = { en: string; ar: string };

export type AdminData = {
  content: CmsContent;
  versions: Version[];
  storageProblem: StorageProblem | null;
  locales: { code: string; name: string; dir: 'ltr' | 'rtl' }[];
  /** Default (code) messages per locale, flattened. */
  messages: Record<string, Record<string, string>>;
  contact: ContactFields;
  social: SocialFields;
  residences: { code: string; slug: string; name: Bilingual; plan: string }[];
  residenceDefaults: Record<string, ResidenceFields>;
  galleries: Record<string, string[]>;
  rooms: { key: string; name: Bilingual }[];
  destinations: { key: string; name: Bilingual }[];
  driveTimes: Record<string, number>;
  images: { id: string; alt: Bilingual; image: CmsImage }[];
};

export type Update = (fn: (draft: CmsContent) => void) => void;
export type Uploader = (file: File, name: string, kind: 'photo' | 'logo') => Promise<CmsImage | null>;

export const humanize = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_/]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

export function PanelIntro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 max-w-measure">
      <h1 className="text-h3 font-medium">{title}</h1>
      {children && <p className="mt-2 text-small text-ink-soft">{children}</p>}
    </div>
  );
}

export function EditedMark() {
  const { t } = useAdmin();
  return <span className="ms-2 text-micro font-normal text-copper-deep">{t.common.edited}</span>;
}

export function ResetButton({ onClick, children }: { onClick: () => void; children?: React.ReactNode }) {
  const { t } = useAdmin();
  return (
    <button type="button" onClick={onClick} className="min-h-8 text-micro text-ink-muted underline underline-offset-4 hover:text-ink">
      {children ?? t.common.restoreOriginal}
    </button>
  );
}

export function SimpleField(props: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  original: string;
  dir?: 'ltr';
  type?: 'text' | 'email' | 'tel' | 'url';
  onChange: (v: string) => void;
}) {
  const { t } = useAdmin();
  const edited = props.value !== props.original;
  return (
    <div>
      <div className="flex min-h-8 items-center justify-between gap-4">
        <label htmlFor={props.id} className="text-small font-medium">
          {props.label}
          {edited && <EditedMark />}
        </label>
        {edited && <ResetButton onClick={() => props.onChange(props.original)}>{t.common.restore}</ResetButton>}
      </div>
      <input
        id={props.id}
        type={props.type ?? 'text'}
        value={props.value}
        dir={props.dir}
        onChange={(e) => props.onChange(e.target.value)}
        className={cn(input, 'mt-1', edited && 'border-copper')}
      />
      {props.hint && <p className="mt-1 text-micro text-ink-muted">{props.hint}</p>}
    </div>
  );
}

/** Number field that lets people clear and retype without the value jumping back. */
export function NumberInput({ label, value, edited, onChange }: { label: string; value: number; edited: boolean; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(String(value));
  }
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={text}
      dir="ltr"
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, '');
        setText(t);
        if (t) onChange(Number(t));
      }}
      onBlur={() => setText(String(value))}
      className={cn(input, 'w-24 tabular-nums', edited && 'border-copper')}
    />
  );
}

/** Thumbnail URL: pre-rendered 640px versions for site photos, uploads as they are. */
export const thumb = (src: string) => (src.startsWith('/images/') ? src.replace(/\.(jpg|webp)$/, '-640.webp') : src);
