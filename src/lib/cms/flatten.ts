/** `{ home: { hero: { title: 'x' } } }` → `{ 'home.hero.title': 'x' }` */
export function flattenMessages(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') Object.assign(out, flattenMessages(value as Record<string, unknown>, path));
  }
  return out;
}
