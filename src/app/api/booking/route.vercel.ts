// Visit slots on Vercel. GET lists the taken slots from today on; POST takes one when a visitor
// sends their booking to WhatsApp, so the next visitor sees it greyed out.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { bookingDate, bookingNowMinutes, bookingToday, isClosedDay, slotKey, slotsForDay } from '@/content/booking';
import { countPhoneBookings, listBookedSlots, noteAttempt, reserveSlot, storageReady } from '@/lib/cms/storage';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_DAYS_AHEAD = 365;
/** Upcoming slots one phone number can hold. */
const MAX_PER_PHONE = 2;
/** Booking attempts one visitor can make in an hour. */
const MAX_PER_HOUR = 6;

export async function GET() {
  if (!storageReady()) return Response.json({ taken: [] }, { headers: NO_STORE });
  const today = bookingToday();
  const taken = (await listBookedSlots().catch(() => [])).filter((k) => k.slice(0, 10) >= today);
  return Response.json({ taken }, { headers: NO_STORE });
}

const bodySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int(),
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((p) => p.replace(/\D/g, '').length >= 8),
  interests: z.array(z.string().max(40)).max(8).default([]),
  locale: z.string().max(8).default('en'),
  // Honeypot: hidden from people, filled in by bots.
  company: z.string().max(200).optional(),
});

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false }, 400);
  const { day, hour, company, ...guest } = parsed.data;
  // Answer bots as if it worked, without taking anything.
  if (company) return json({ ok: true });

  const today = bookingToday();
  const daysAhead = (bookingDate(day).getTime() - bookingDate(today).getTime()) / 86_400_000;
  const valid =
    !Number.isNaN(daysAhead) &&
    daysAhead >= 0 &&
    daysAhead <= MAX_DAYS_AHEAD &&
    !isClosedDay(day) &&
    slotsForDay(day).includes(hour) &&
    !(day === today && hour * 60 <= bookingNowMinutes());
  if (!valid) return json({ ok: false }, 422);

  if (!storageReady()) return json({ ok: false }, 503);
  try {
    // Limits against someone blocking the calendar: the booking still reaches WhatsApp, it just
    // doesn't lock the slot.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const visitor = createHash('sha256').update(ip).digest('hex').slice(0, 16);
    if ((await noteAttempt(visitor)) > MAX_PER_HOUR) return json({ ok: false }, 429);
    if ((await countPhoneBookings(guest.phone, today)) >= MAX_PER_PHONE) return json({ ok: false }, 429);

    const ok = await reserveSlot(slotKey(day, hour), { ...guest, day, hour, bookedAt: new Date().toISOString() });
    return json({ ok }, ok ? 200 : 409);
  } catch (error) {
    console.error('[booking] could not save slot', error);
    return json({ ok: false }, 503);
  }
}
