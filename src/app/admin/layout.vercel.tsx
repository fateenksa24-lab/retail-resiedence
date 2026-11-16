import type { Metadata } from 'next';
import { AdminLangProvider } from '@/components/admin/lang';
import { adminDict } from '@/lib/cms/admin-i18n';
import { adminLang } from '@/lib/cms/lang-server';
import { alexandria, generalSans } from '../fonts';
import '../globals.css';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: adminDict[await adminLang()].pageTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const lang = await adminLang();
  return (
    <html lang={lang} dir={adminDict[lang].dir} className={`${generalSans.variable} ${alexandria.variable}`}>
      <body className="bg-canvas text-ink">
        <AdminLangProvider initial={lang}>{children}</AdminLangProvider>
      </body>
    </html>
  );
}
