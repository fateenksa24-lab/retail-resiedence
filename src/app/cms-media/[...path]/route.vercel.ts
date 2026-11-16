// Serves images uploaded in the admin from the private Blob store. Each upload has a unique
// name, so responses are cached by the CDN for a year.
import { getMedia } from '@/lib/cms/storage';

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const media = await getMedia((await params).path.join('/'));
  if (!media) return new Response('Not found', { status: 404 });
  return new Response(media.body, {
    headers: {
      'Content-Type': media.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
