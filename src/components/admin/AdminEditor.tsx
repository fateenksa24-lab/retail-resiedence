'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Logo } from '@/components/brand/Logo';
import { loadVersion, logout, relogin, saveContent, uploadImage } from '@/lib/cms/actions';
import type { AdminDict } from '@/lib/cms/admin-i18n';
import type { Version } from '@/lib/cms/storage';
import { emptyContent, type CmsContent, type CmsImage, type ContactFields } from '@/lib/cms/types';
import { cn } from '@/lib/cn';
import { CONTACT_KINDS, contactProblem, ContactPanel, ResidencesPanel } from './DetailsPanels';
import { ImageError, prepareLogo, preparePhoto, toCmsImage } from './image-tools';
import { LangSwitch, useAdmin } from './lang';
import { BookingsPanel } from './BookingsPanel';
import { HistoryPanel, LogoPanel } from './OtherPanels';
import { PhotosPanel } from './PhotosPanel';
import type { AdminData, Update } from './shared';
import { btn, input } from './styles';
import { textProblem, TextPanel } from './TextPanel';

export type { AdminData } from './shared';

type Tab = 'text' | 'photos' | 'contact' | 'residences' | 'logo' | 'history' | 'bookings';
const TABS: Tab[] = ['text', 'photos', 'contact', 'residences', 'logo', 'history', 'bookings'];

const DRAFT_KEY = 'retal-cms-draft-v1';
const WELCOME_KEY = 'retal-cms-welcome-v1';
const SESSION_EXPIRED = 'session-expired';

/** Messages are worded at render time, so they follow the dashboard language. */
type Words = string | ((t: AdminDict) => string);
type Notice = { kind: 'ok' | 'error'; text: Words; action?: { label: Words; run: () => void } };
const say = (w: Words, t: AdminDict) => (typeof w === 'function' ? w(t) : w);

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

const versionKey = (savedAt: string) => `${savedAt.replace(/[:.]/g, '-')}.json`;

export function AdminEditor({ data }: { data: AdminData }) {
  const { t } = useAdmin();
  const [saved, setSaved] = useState(data.content);
  const [draft, setDraft] = useState(data.content);
  const [versions, setVersions] = useState<Version[]>(data.versions);
  const [tab, setTab] = useState<Tab>('text');
  const [textFocus, setTextFocus] = useState<{ locale: string; key: string } | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toast, setToast] = useState(false);
  const [saving, startSaving] = useTransition();
  const [uploads, setUploads] = useState(0);
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [recovered, setRecovered] = useState<CmsContent | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const loginWaiters = useRef<((ok: boolean) => void)[]>([]);

  const changes = useMemo(() => countChanges(saved, draft), [saved, draft]);
  const blocked = Boolean(data.storageProblem);
  const canSave = !blocked && changes > 0 && !saving && uploads === 0;

  const update: Update = useCallback((fn) => {
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next);
      return next;
    });
    setNotice((n) => (n?.kind === 'ok' ? null : n));
  }, []);

  // First-visit guide, and recovery of unsaved edits from a closed tab or an expired session.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage once after mount
    setWelcome(!store.get(WELCOME_KEY));
    const raw = store.get(DRAFT_KEY);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as { base: string; draft: CmsContent };
      if (stored.base === (data.content.updatedAt ?? '') && countChanges(data.content, stored.draft) > 0) setRecovered(stored.draft);
      else store.remove(DRAFT_KEY);
    } catch {
      store.remove(DRAFT_KEY);
    }
  }, [data.content]);

  // Keep a copy of unsaved edits in this browser.
  useEffect(() => {
    if (recovered) return;
    if (changes > 0) store.set(DRAFT_KEY, JSON.stringify({ base: saved.updatedAt ?? '', draft }));
    else store.remove(DRAFT_KEY);
  }, [draft, saved.updatedAt, changes, recovered]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 7000);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Opens the sign-in dialog and resolves once the admin has signed in again. */
  const requestLogin = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        loginWaiters.current.push(resolve);
        setLoginOpen(true);
      }),
    [],
  );
  const finishLogin = (ok: boolean) => {
    setLoginOpen(false);
    loginWaiters.current.splice(0).forEach((resolve) => resolve(ok));
  };

  const findProblem = useCallback((): Notice | null => {
    for (const [locale, edits] of Object.entries(draft.messages)) {
      for (const [key, value] of Object.entries(edits)) {
        const original = data.messages[locale]?.[key] ?? '';
        if (textProblem(value, original, t)) {
          const language = data.locales.find((l) => l.code === locale)?.name ?? locale;
          return {
            kind: 'error',
            text: (tt) => tt.notices.textProblem(language, textProblem(value, original, tt) ?? ''),
            action: {
              label: (tt) => tt.showMe,
              run: () => {
                setTextFocus({ locale, key });
                setTab('text');
              },
            },
          };
        }
      }
    }
    for (const [key, value] of Object.entries(draft.contact)) {
      if (contactProblem(CONTACT_KINDS[key as keyof ContactFields] ?? 'text', value ?? '', t, key === 'reservations2')) {
        return { kind: 'error', text: (tt) => tt.notices.contactProblem, action: { label: (tt) => tt.showMe, run: () => setTab('contact') } };
      }
    }
    for (const value of Object.values(draft.social)) {
      if (contactProblem('url', value ?? '', t)) {
        return { kind: 'error', text: (tt) => tt.notices.socialProblem, action: { label: (tt) => tt.showMe, run: () => setTab('contact') } };
      }
    }
    return null;
  }, [draft, data.messages, data.locales, t]);

  const save = useCallback(() => {
    if (!canSave) return;
    const problem = findProblem();
    if (problem) {
      setNotice(problem);
      return;
    }
    startSaving(async () => {
      const attempt = () => saveContent(draft, saved.updatedAt).catch(() => ({ ok: false as const, error: '' }));
      let res = await attempt();
      if (!res.ok && res.error === SESSION_EXPIRED && (await requestLogin())) res = await attempt();
      if (res.ok) {
        setSaved(res.content);
        setDraft(res.content);
        store.remove(DRAFT_KEY);
        if (res.content.updatedAt) setVersions((v) => [{ key: versionKey(res.content.updatedAt!), savedAt: res.content.updatedAt! }, ...v].slice(0, 40));
        setNotice(null);
        setToast(true);
      } else if (res.error !== SESSION_EXPIRED) {
        const message = res.error;
        setNotice({ kind: 'error', text: message || ((tt) => tt.notices.saveOffline) });
      }
    });
  }, [canSave, draft, saved.updatedAt, findProblem, requestLogin]);

  const discard = () => {
    if (!window.confirm(t.confirm.discard(changes))) return;
    setDraft(saved);
    setNotice(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (changes > 0) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [save, changes]);

  const upload = useCallback(
    async (file: File, name: string, kind: 'photo' | 'logo'): Promise<CmsImage | null> => {
      setUploads((n) => n + 1);
      try {
        const prepared = kind === 'photo' ? await preparePhoto(file) : await prepareLogo(file);
        const send = () => {
          const form = new FormData();
          const ext = kind === 'photo' ? 'jpg' : (file.name.split('.').pop() ?? 'png');
          form.append('file', prepared.file, `${name}.${ext}`);
          form.append('name', name);
          return uploadImage(form);
        };
        let res = await send().catch(() => ({ ok: false as const, error: '' }));
        if (!res.ok && res.error === SESSION_EXPIRED && (await requestLogin())) res = await send();
        if (!res.ok) {
          const message = res.error;
          setNotice({
            kind: 'error',
            text: message === SESSION_EXPIRED ? (tt) => tt.notices.uploadSignIn : message || ((tt) => tt.notices.uploadOffline),
          });
          return null;
        }
        return toCmsImage(prepared, res.src);
      } catch (error) {
        const code = error instanceof ImageError ? error.code : null;
        setNotice({ kind: 'error', text: (tt) => (code ? tt.imageErrors[code] : tt.notices.uploadFailed) });
        return null;
      } finally {
        setUploads((n) => n - 1);
      }
    },
    [requestLogin],
  );

  const openVersion = async (v: Version) => {
    if (changes > 0 && !window.confirm(t.confirm.openVersion)) return;
    setLoadingVersion(v.key);
    let res = await loadVersion(v.key);
    if (!res.ok && res.error === SESSION_EXPIRED && (await requestLogin())) res = await loadVersion(v.key);
    setLoadingVersion(null);
    if (!res.ok) {
      const message = res.error;
      if (message !== SESSION_EXPIRED) setNotice({ kind: 'error', text: message });
      return;
    }
    setDraft({ ...res.content, updatedAt: saved.updatedAt });
    setNotice({ kind: 'ok', text: (tt) => tt.notices.versionOpen(tt.formatDate(v.savedAt)) });
  };

  const startOver = () => {
    if (!window.confirm(t.confirm.startOver)) return;
    setDraft({ ...emptyContent(), updatedAt: saved.updatedAt });
    setNotice({ kind: 'ok', text: (tt) => tt.notices.originalOpen });
  };

  const status = saving
    ? t.header.saving
    : uploads
      ? t.header.uploading
      : changes
        ? t.header.unsaved(changes)
        : saved.updatedAt
          ? t.header.savedAt(t.formatDate(saved.updatedAt))
          : t.header.noChanges;

  const storageText = data.storageProblem
    ? data.storageProblem.code === 'unavailable'
      ? t.storage.unavailable(data.storageProblem.detail)
      : t.storage[data.storageProblem.code]
    : null;

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logo markOnly className="h-8 w-auto" />
            <span className="text-small font-medium">{t.appName}</span>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2 md:gap-3">
            <span className={cn('text-small', changes ? 'font-medium text-copper-deep' : 'text-ink-muted')} aria-live="polite">
              {status}
            </span>
            {changes > 0 && !saving && (
              <button type="button" onClick={discard} className={btn.quiet}>
                {t.header.discard}
              </button>
            )}
            <button type="button" onClick={save} disabled={!canSave} className={btn.solid} title={t.header.saveShortcut}>
              {saving ? t.header.saving : t.header.save}
            </button>
            <a href={`/${t.lang}/`} target="_blank" rel="noopener noreferrer" className={btn.outline}>
              {t.header.viewSite}
            </a>
            <LangSwitch className={btn.quiet} />
            <form action={logout}>
              <button type="submit" className={btn.quiet}>
                {t.header.signOut}
              </button>
            </form>
          </div>
        </div>
        <nav aria-label={t.sectionsLabel} className="flex gap-1 overflow-x-auto px-3 md:px-6">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              data-tab={key}
              onClick={() => {
                setTab(key);
                setTextFocus(undefined);
              }}
              aria-current={tab === key ? 'page' : undefined}
              className={cn(
                'min-h-tap shrink-0 border-b-2 px-3 text-small whitespace-nowrap transition-colors duration-(--dur-fast)',
                tab === key ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {t.tabs[key]}
            </button>
          ))}
        </nav>
      </header>

      {welcome && (
        <section aria-label={t.welcome.label} className="mx-5 mt-6 flex flex-wrap items-start gap-x-10 gap-y-4 bg-night px-6 py-5 text-bone md:mx-8">
          <ol className="grid flex-1 gap-4 text-small sm:grid-cols-3">
            {t.welcome.steps.map(([title, body], i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-copper text-micro text-night">{i + 1}</span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-bone-soft">{body}</span>
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              store.set(WELCOME_KEY, '1');
              setWelcome(false);
            }}
            className="inline-flex min-h-tap items-center text-small text-bone underline underline-offset-4"
          >
            {t.welcome.gotIt}
          </button>
        </section>
      )}

      {storageText && <Banner kind="error">{storageText}</Banner>}

      {recovered && (
        <Banner kind="ok">
          {t.recovered.text}{' '}
          <span className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              className={btn.solid}
              onClick={() => {
                setDraft(recovered);
                setRecovered(null);
              }}
            >
              {t.recovered.restore}
            </button>
            <button
              type="button"
              className={btn.outline}
              onClick={() => {
                store.remove(DRAFT_KEY);
                setRecovered(null);
              }}
            >
              {t.recovered.discard}
            </button>
          </span>
        </Banner>
      )}

      {notice && (
        <Banner kind={notice.kind} onClose={() => setNotice(null)}>
          {say(notice.text, t)}
          {notice.action && (
            <button type="button" onClick={notice.action.run} className="ms-3 font-medium underline underline-offset-4">
              {say(notice.action.label, t)}
            </button>
          )}
        </Banner>
      )}

      <div className="px-5 pt-8 md:px-8">
        {tab === 'text' && <TextPanel key={textFocus ? `${textFocus.locale}:${textFocus.key}` : 'text'} data={data} draft={draft} update={update} focus={textFocus} />}
        {tab === 'photos' && <PhotosPanel data={data} draft={draft} update={update} upload={upload} />}
        {tab === 'contact' && <ContactPanel data={data} draft={draft} update={update} />}
        {tab === 'residences' && <ResidencesPanel data={data} draft={draft} update={update} />}
        {tab === 'logo' && <LogoPanel draft={draft} update={update} upload={upload} />}
        {tab === 'bookings' && <BookingsPanel requestLogin={requestLogin} />}
        {tab === 'history' && (
          <HistoryPanel versions={versions} current={saved.updatedAt} onOpen={openVersion} onStartOver={startOver} loading={loadingVersion} />
        )}
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 bg-night px-5 py-4 text-small text-bone md:bottom-6">
          <span>✓ {t.toast}</span>
          <a href={`/${t.lang}/`} target="_blank" rel="noopener noreferrer" className="font-medium text-copper underline underline-offset-4">
            {t.header.viewSite}
          </a>
        </div>
      )}

      {loginOpen && <LoginDialog onDone={finishLogin} />}
    </div>
  );
}

function Banner({ kind, children, onClose }: { kind: 'ok' | 'error'; children: React.ReactNode; onClose?: () => void }) {
  const { t } = useAdmin();
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'mx-5 mt-6 flex items-start justify-between gap-4 border-s-4 bg-canvas-deep px-4 py-3 text-small md:mx-8',
        kind === 'ok' ? 'border-ink' : 'border-copper-deep text-copper-deep',
      )}
    >
      <div>{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={t.closeMessage} className="-my-2 -me-2 grid size-tap shrink-0 place-items-center text-ink-muted hover:text-ink">
          ✕
        </button>
      )}
    </div>
  );
}

function LoginDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const { t } = useAdmin();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={() => onDone(false)} className="m-auto w-[min(26rem,calc(100%-2rem))] bg-canvas p-6 text-ink backdrop:bg-night/60">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          const ok = await relogin(String(new FormData(e.currentTarget).get('password') ?? '')).catch(() => false);
          setPending(false);
          if (ok) onDone(true);
          else setError(true);
        }}
      >
        <h2 className="text-h4 font-medium">{t.relogin.title}</h2>
        <p className="mt-2 text-small text-ink-soft">{t.relogin.body}</p>
        <label htmlFor="relogin-password" className="mt-5 block text-small font-medium">
          {t.relogin.password}
        </label>
        <input id="relogin-password" name="password" type="password" required autoFocus autoComplete="current-password" className={cn(input, 'mt-1')} />
        {error && (
          <p role="alert" className="mt-2 text-small text-copper-deep">
            {t.relogin.wrong}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={btn.solid}>
            {pending ? t.relogin.submitting : t.relogin.submit}
          </button>
          <button type="button" onClick={() => onDone(false)} className={btn.quiet}>
            {t.relogin.cancel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Number of individual values that differ between two content objects. */
function countChanges(a: CmsContent, b: CmsContent): number {
  const fa = leaves(a);
  const fb = leaves(b);
  let n = 0;
  for (const key of new Set([...Object.keys(fa), ...Object.keys(fb)])) if (fa[key] !== fb[key]) n++;
  return n;
}

function leaves(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(obj)) {
    out[prefix] = obj.join('|');
  } else if (obj && typeof obj === 'object') {
    // An image counts as one change, not four.
    if ('src' in obj) out[prefix] = `${String((obj as CmsImage).src)}|${'alt' in obj ? String(obj.alt) : ''}`;
    else for (const [k, v] of Object.entries(obj)) if (k !== 'updatedAt') leaves(v, prefix ? `${prefix}\u0000${k}` : k, out);
  } else if (obj !== undefined) {
    out[prefix] = String(obj);
  }
  return out;
}
