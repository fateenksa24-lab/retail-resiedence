const base =
  'inline-flex min-h-tap items-center justify-center gap-2 rounded-pill px-5 text-small font-medium transition-colors duration-(--dur-fast) ease-out disabled:cursor-not-allowed disabled:opacity-50';

export const btn = {
  solid: `${base} bg-ink text-canvas hover:bg-copper-deep`,
  outline: `${base} border border-line bg-canvas text-ink hover:border-ink`,
  copper: `${base} bg-copper text-night hover:bg-bone`,
  quiet: 'inline-flex min-h-tap items-center text-small text-ink-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-current',
};

const field =
  'block w-full rounded-none border px-3 py-2.5 text-body outline-none transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2';

export const input = `${field} border-line bg-canvas text-ink focus:border-ink focus-visible:outline-(--focus)`;

/** The same field on a dark background (sign-in page). */
export const inputDark = `${field} border-night-line bg-night-raised text-bone caret-copper placeholder:text-bone-soft focus:border-bone-soft focus-visible:outline-copper`;

export const label = 'block text-micro tracking-(--ls-eyebrow) text-ink-muted uppercase';
