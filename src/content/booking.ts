// Visit booking on Home (after the hero). Visitors pick any date and a one-hour slot.

/** Days shown as quick buttons; any later date can be picked from the calendar. */
export const bookingDays = 14;

/** One-hour visiting slots, by start hour (24-hour clock, Al Khobar time): 10 AM to 10 PM. */
export const bookingSlots = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

/** Weekdays with no visits (0 = Sunday … 6 = Saturday): Friday. */
export const bookingClosedDays = [5];

/** Days with shorter hours: Saturday, 10 AM to 5 PM. */
export const bookingSlotsByWeekday: Partial<Record<number, number[]>> = {
  6: [10, 11, 12, 13, 14, 15, 16],
};

/** Al Khobar's time zone: "today" and "now" always come from here, never the device clock. */
export const BOOKING_TZ = 'Asia/Riyadh';

/** Today in Al Khobar as YYYY-MM-DD. */
export const bookingToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: BOOKING_TZ }).format(new Date());

/** Minutes past midnight in Al Khobar right now. */
export function bookingNowMinutes() {
  const [h, min] = new Intl.DateTimeFormat('en-GB', { timeZone: BOOKING_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date())
    .split(':')
    .map(Number) as [number, number];
  return h * 60 + min;
}

/** A calendar date as a Date at noon UTC, so formatting never slips a day. */
export const bookingDate = (iso: string) => {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, 12));
};
export const isClosedDay = (iso: string) => bookingClosedDays.includes(bookingDate(iso).getUTCDay());
export const slotsForDay = (iso: string | null) => (iso && bookingSlotsByWeekday[bookingDate(iso).getUTCDay()]) || bookingSlots;

/** One slot as a key, "2026-11-24T10". */
export const slotKey = (day: string, hour: number) => `${day}T${String(hour).padStart(2, '0')}`;

/** What a visitor can ask to see. Labels live in messages (home.booking.interests.*). */
export const bookingInterests = ['apartment', 'town-villa', 'executive-villa', 'clubhouse'] as const;
export type BookingInterest = (typeof bookingInterests)[number];

/** English names used in the WhatsApp message, so the team always reads the same words. */
export const bookingInterestNames: Record<BookingInterest, string> = {
  apartment: 'Apartments',
  'town-villa': 'Town villas',
  'executive-villa': 'Executive villas',
  clubhouse: 'The Clubhouse',
};
