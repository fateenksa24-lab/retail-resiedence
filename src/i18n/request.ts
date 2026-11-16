import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { loadCms, withMessageOverrides } from '@/lib/cms/content';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  // Admin edits (text, contact details, images) are applied here, before any page renders.
  const cms = await loadCms();
  return {
    locale,
    messages: withMessageOverrides((await import(`../../messages/${locale}.json`)).default, cms.messages[locale], cms.newImages),
  };
});
