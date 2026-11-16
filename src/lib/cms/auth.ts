import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

// One admin password (env ADMIN_PASSWORD). A successful login sets a signed, http-only cookie.
// Changing the password signs everyone out.

const COOKIE = 'retal_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

const password = () => process.env.ADMIN_PASSWORD ?? '';
export const authConfigured = () => password().length >= 8;

function secret() {
  return createHash('sha256')
    .update(`${process.env.ADMIN_SESSION_SECRET ?? ''}:${password()}:retal-cms`)
    .digest();
}

const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url');

function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string) {
  return authConfigured() && safeEqual(input, password());
}

export async function startSession() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const store = await cookies();
  store.set(COOKIE, `${expires}.${sign(String(expires))}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  if (!authConfigured()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expires, signature] = value.split('.');
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(signature, sign(expires));
}
