'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { tracking } from '@/content/tracking';
import { trackLead, type LeadMethod } from '@/lib/analytics';

const linkMethod = (href: string): LeadMethod | null =>
  href.startsWith('https://wa.me/') ? 'whatsapp' : href.startsWith('tel:') ? 'phone' : href.startsWith('mailto:') ? 'email' : null;

/** GA4 and the Snap Pixel, loaded after the page is interactive, plus clicks on WhatsApp, phone and email links. */
export function Analytics() {
  const { ga4, snapPixel } = tracking;
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  // GA4 counts client-side navigations itself (enhanced measurement); the Snap Pixel needs telling.
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    window.snaptr?.('track', 'PAGE_VIEW');
  }, [pathname]);

  useEffect(() => {
    if (!ga4 && !snapPixel) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      const method = a && linkMethod(a.getAttribute('href') ?? '');
      if (method) trackLead(method, { link_url: a.getAttribute('href') ?? undefined });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [ga4, snapPixel]);

  return (
    <>
      {ga4 ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      ) : null}
      {snapPixel ? (
        <Script id="snap-pixel" strategy="lazyOnload">
          {`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${snapPixel}');snaptr('track','PAGE_VIEW');`}
        </Script>
      ) : null}
    </>
  );
}
