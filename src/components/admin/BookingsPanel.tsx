'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { freeBooking, loadBookings, type BookingsResult } from '@/lib/cms/actions';
import type { Booking } from '@/lib/cms/storage';
import { cn } from '@/lib/cn';
import { useAdmin } from './lang';
import { PanelIntro } from './shared';
import { btn } from './styles';

/** Upcoming visit bookings by day, each with a button that frees the time again. */
export function BookingsPanel({ requestLogin }: { requestLogin: () => Promise<boolean> }) {
  const { t } = useAdmin();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeing, setFreeing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Runs an action; an expired session asks for the password once, then tries again. */
  const run = useCallback(
    async (action: () => Promise<BookingsResult>) => {
      let r = await action();
      if (!r.ok && r.error === 'session-expired' && (await requestLogin())) r = await action();
      if (r.ok) {
        setBookings(r.bookings);
        setError(null);
      } else if (r.error !== 'session-expired') setError(r.error);
    },
    [requestLogin],
  );
  const refresh = useCallback(() => startTransition(() => run(loadBookings)), [run]);
  useEffect(refresh, [refresh]);

  const lang = t.lang === 'ar' ? 'ar' : 'en-GB';
  const dayText = (iso: string) =>
    new Intl.DateTimeFormat(lang, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00Z`));
  const hourText = (h: number) =>
    new Intl.DateTimeFormat(lang, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(Date.UTC(2000, 0, 1, h)));

  const free = (b: Booking) => {
    if (!window.confirm(t.bookings.confirmFree(`${dayText(b.day)}${t.lang === 'ar' ? '، ' : ', '}${hourText(b.hour)}`))) return;
    setFreeing(b.key);
    startTransition(async () => {
      await run(() => freeBooking(b.key));
      setFreeing(null);
    });
  };

  const days = [...new Set((bookings ?? []).map((b) => b.day))];

  return (
    <div className="max-w-3xl">
      <PanelIntro title={t.bookings.title}>{t.bookings.intro}</PanelIntro>
      <button type="button" onClick={refresh} disabled={pending} className={cn(btn.outline, 'mb-8')}>
        {pending && !freeing ? t.bookings.loading : t.bookings.refresh}
      </button>
      {error && (
        <p className="mb-6 border border-copper-deep p-4 text-small text-copper-deep" role="alert">
          {error}
        </p>
      )}
      {bookings && bookings.length === 0 && <p className="border-y border-line py-6 text-small text-ink-muted">{t.bookings.empty}</p>}
      {days.map((day) => (
        <section key={day} className="mb-10">
          <h2 className="mb-2 text-small font-medium">{dayText(day)}</h2>
          <ul className="border-t border-line">
            {(bookings ?? [])
              .filter((b) => b.day === day)
              .map((b) => (
                <li key={b.key} className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-4">
                  <div className="flex gap-5">
                    <span className="tabular w-20 shrink-0 text-small font-medium" dir="ltr">
                      {hourText(b.hour)}
                    </span>
                    <div className="text-small">
                      <p className="font-medium">{b.name}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <a href={`tel:+${b.phone.replace(/\D/g, '')}`} className="tabular underline decoration-line underline-offset-4 hover:decoration-current" dir="ltr">
                          {b.phone}
                        </a>
                        <a
                          href={`https://wa.me/${b.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-line underline-offset-4 hover:decoration-current"
                        >
                          {t.bookings.whatsapp}
                        </a>
                      </p>
                      <p className="mt-1 text-ink-soft">{b.interests.length ? b.interests.map((i) => t.bookings.interests[i] ?? i).join(' · ') : t.bookings.notDecided}</p>
                      {b.bookedAt && <p className="mt-1 text-micro text-ink-muted">{t.bookings.booked(t.formatDate(b.bookedAt))}</p>}
                    </div>
                  </div>
                  <button type="button" onClick={() => free(b)} disabled={pending} className={btn.outline}>
                    {freeing === b.key ? t.bookings.freeing : t.bookings.free}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
