'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ADMIN_LANG_COOKIE, adminDict, type AdminDict, type AdminLang } from '@/lib/cms/admin-i18n';

type Ctx = { lang: AdminLang; t: AdminDict; setLang: (lang: AdminLang) => void };
const AdminLangContext = createContext<Ctx>({ lang: 'en', t: adminDict.en, setLang: () => {} });

export function AdminLangProvider({ initial, children }: { initial: AdminLang; children: React.ReactNode }) {
  const [lang, setLangState] = useState(initial);
  const setLang = useCallback((next: AdminLang) => {
    setLangState(next);
    const t = adminDict[next];
    document.documentElement.lang = next;
    document.documentElement.dir = t.dir;
    document.title = t.pageTitle;
    document.cookie = `${ADMIN_LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  const value = useMemo(() => ({ lang, t: adminDict[lang], setLang }), [lang, setLang]);
  return <AdminLangContext.Provider value={value}>{children}</AdminLangContext.Provider>;
}

export const useAdmin = () => useContext(AdminLangContext);

/** Language toggle (English ⇄ العربية). */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, t, setLang } = useAdmin();
  const other: AdminLang = lang === 'en' ? 'ar' : 'en';
  return (
    <button type="button" onClick={() => setLang(other)} lang={other} aria-label={t.switchLangLabel} className={className}>
      {t.switchLang}
    </button>
  );
}
