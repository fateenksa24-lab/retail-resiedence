declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    snaptr?: (...args: unknown[]) => void;
  }
}

export type LeadMethod = 'booking_whatsapp' | 'contact_form' | 'whatsapp' | 'phone' | 'email';

/** A visitor reached out. GA4 `generate_lead` and Snap `SIGN_UP` are the conversions to mark in each dashboard. */
export function trackLead(method: LeadMethod, params: Record<string, string | undefined> = {}) {
  window.gtag?.('event', 'generate_lead', { method, ...params });
  window.snaptr?.('track', 'SIGN_UP', { sign_up_method: method });
}
