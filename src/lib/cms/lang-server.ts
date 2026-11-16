import { cookies } from 'next/headers';
import { ADMIN_LANG_COOKIE, adminDict, isAdminLang, type AdminLang } from './admin-i18n';

/** The dashboard language the admin picked (cookie), English by default. */
export async function adminLang(): Promise<AdminLang> {
  const value = (await cookies()).get(ADMIN_LANG_COOKIE)?.value;
  return isAdminLang(value) ? value : 'en';
}

export async function adminT() {
  return adminDict[await adminLang()];
}
