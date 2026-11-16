// The site is a static export with no image server: scripts/optimize-images.mjs writes every
// width next/image requests as <name>-<width>.webp next to the master image.
// Images uploaded in the admin (/cms-media/) are already compressed and served as they are.
export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (src.startsWith('/cms-media/')) return `${src}?w=${width}`;
  if (!src.startsWith('/images/')) return src;
  return src.replace(/\.(jpg|webp)$/, `-${width}.webp`);
}
