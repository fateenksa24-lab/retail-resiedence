// Visit requests from the contact form, on Vercel. The `.vercel.ts` extension keeps this file out
// of the static export (next.config.ts); Apache hosting uses public/contact.php instead.
// Env: RESEND_API_KEY (required in production), ENQUIRY_TO, ENQUIRY_FROM (a Resend-verified sender).
import { enquirySchema, formToObject, invalidFields, RESIDENCE_ANY } from '@/lib/enquiry';
import en from '../../../../messages/en.json';

const TO = process.env.ENQUIRY_TO ?? 'sales@retalresidence.com';
const FROM = process.env.ENQUIRY_FROM ?? 'Retal Residence website <website@retalresidence.com>';
const LANGUAGES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  fr: 'French',
  it: 'Italian',
  es: 'Spanish',
  zh: 'Chinese',
  ko: 'Korean',
};

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ ok: false }, { status: 400 });

  const raw = formToObject(formData);
  // Honeypot: people never see this field; bots fill it in. Answer as if it worked.
  if (raw.company) return Response.json({ ok: true });

  const result = enquirySchema.safeParse(raw);
  if (!result.success) return Response.json({ ok: false, fields: invalidFields(result) }, { status: 422 });

  const e = result.data;
  const items: Record<string, { name: string } | undefined> = en.residences.items;
  const residence = e.residence === RESIDENCE_ANY ? 'Not decided yet' : (items[e.residence]?.name ?? e.residence);
  const language = LANGUAGES[String(formData.get('locale') ?? '')] ?? 'English';
  const subject = `Visit request: ${e.name.replace(/[\r\n]/g, ' ')}, ${e.date}`;
  const text = [
    `Name: ${e.name}`,
    `Phone: ${e.phone}`,
    `Email: ${e.email}`,
    `Residence: ${residence}`,
    `Preferred date: ${e.date}`,
    `Language: ${language}`,
    '',
    e.message || '(no message)',
  ].join('\n');

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[enquiry] ${subject}\n${text}`);
      return Response.json({ ok: true });
    }
    console.error('[enquiry] RESEND_API_KEY is not set; the enquiry was not sent.');
    return Response.json({ ok: false }, { status: 500 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: e.email, subject, text }),
  }).catch(() => null);

  if (!res?.ok) {
    console.error('[enquiry] Resend rejected the email', res?.status, await res?.text().catch(() => ''));
    return Response.json({ ok: false }, { status: 502 });
  }
  return Response.json({ ok: true });
}
