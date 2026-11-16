import type { CmsImage } from '@/lib/cms/types';

// Photos are resized and re-encoded in the browser before upload: max 2560px on the long edge,
// progressive-quality JPEG under ~600 KB, all metadata (including GPS) dropped by the re-encode.

const MAX_EDGE = 2560;
const TARGET_BYTES = 600 * 1024;

/** A problem with a chosen file; the dashboard words it in the admin's language. */
export class ImageError extends Error {
  constructor(public code: 'heic' | 'unreadable' | 'logoTooBig') {
    super(code);
  }
}

export type Prepared = { file: Blob; width: number; height: number; blurDataURL: string };

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError('unreadable'))), type, quality));

export async function preparePhoto(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new ImageError(/heic|heif/i.test(file.type + file.name) ? 'heic' : 'unreadable');
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);

  let out = await toBlob(canvas, 'image/jpeg', 0.82);
  for (const q of [0.74, 0.66]) {
    if (out.size <= TARGET_BYTES) break;
    out = await toBlob(canvas, 'image/jpeg', q);
  }

  const tiny = document.createElement('canvas');
  tiny.width = 16;
  tiny.height = Math.max(1, Math.round((16 * height) / width));
  tiny.getContext('2d')!.drawImage(bitmap, 0, 0, tiny.width, tiny.height);
  bitmap.close();

  return { file: out, width, height, blurDataURL: tiny.toDataURL('image/jpeg', 0.6) };
}

const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Logos are uploaded as they are (SVG stays vector); only the size is read. */
export async function prepareLogo(file: File): Promise<Prepared> {
  if (file.size > 1024 * 1024) throw new ImageError('logoTooBig');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new ImageError('unreadable');
    });
    return { file, width: img.naturalWidth || 300, height: img.naturalHeight || 119, blurDataURL: TRANSPARENT };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const toCmsImage = (p: Prepared, src: string): CmsImage => ({ src, width: p.width, height: p.height, blurDataURL: p.blurDataURL });
