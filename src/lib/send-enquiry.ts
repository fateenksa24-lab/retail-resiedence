import { enquirySchema, formToObject, invalidFields, type EnquiryField, type EnquiryState } from './enquiry';

/** Where the form posts: public/contact.php on Apache, the api/contact function on Vercel (next.config.ts). */
const ENDPOINT = process.env.NEXT_PUBLIC_ENQUIRY_ENDPOINT ?? '/contact.php';

// Checked here for instant feedback, then again on the server before anything is sent.
export async function sendEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const raw = formToObject(formData);

  // A filled honeypot means a bot: answer as if it worked, send nothing.
  if (raw.company) return { status: 'sent' };

  const result = enquirySchema.safeParse(raw);
  if (!result.success) return { status: 'invalid', fields: invalidFields(result) };

  try {
    const res = await fetch(ENDPOINT, { method: 'POST', body: formData, headers: { Accept: 'application/json' } });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; fields?: EnquiryField[] };
    if (res.ok && body.ok) return { status: 'sent' };
    if (body.fields?.length) return { status: 'invalid', fields: body.fields };
    return { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
