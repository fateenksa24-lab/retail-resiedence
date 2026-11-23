// Visit slots on Vercel. GET lists the taken slots from today on; POST takes one when a visitor
// sends their booking to WhatsApp, so the next visitor sees it greyed out.
import { z } from 'zod';
import { bookingDate, bookingNowMinutes, bookingToday, isClosedDay, slotKey, slotsForDay } from '@/content/booking';
import { listBookedSlots, reserveSlot, storageReady } from '@/lib/cms/storage';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_DAYS_AHEAD = 365;

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
  phone: z.string().trim().min(8).max(40),
  interests: z.array(z.string().max(40)).max(8).default([]),
  locale: z.string().max(8).default('en'),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400, headers: NO_STORE });
  const { day, hour, ...guest } = parsed.data;

  const today = bookingToday();
  const daysAhead = (bookingDate(day).getTime() - bookingDate(today).getTime()) / 86_400_000;
  const valid =
    !Number.isNaN(daysAhead) &&
    daysAhead >= 0 &&
    daysAhead <= MAX_DAYS_AHEAD &&
    !isClosedDay(day) &&
    slotsForDay(day).includes(hour) &&
    !(day === today && hour * 60 <= bookingNowMinutes());
  if (!valid) return Response.json({ ok: false }, { status: 422, headers: NO_STORE });

  if (!storageReady()) return Response.json({ ok: false }, { status: 503, headers: NO_STORE });
  try {
    const ok = await reserveSlot(slotKey(day, hour), { ...guest, day, hour, bookedAt: new Date().toISOString() });
    return Response.json({ ok }, { status: ok ? 200 : 409, headers: NO_STORE });
  } catch (error) {
    console.error('[booking] could not save slot', error);
    return Response.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
