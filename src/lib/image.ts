/**
 * Client-side image preparation for uploads (shared: field intake + coordinator evidence).
 *
 * Decodes the image, honours EXIF orientation, redraws it on a canvas (max `maxDim` px on the
 * long side) and re-encodes it. Re-encoding through a canvas drops ALL metadata — EXIF, GPS
 * location, camera serials — and compresses the file for low-bandwidth connections.
 *
 * Never uploads the original bytes: if the browser cannot decode the file, this throws
 * `ImagePrepareError` and the caller should ask for another photo.
 *
 * Signature is stable (used by Lane B field PhotoPicker and Lane D evidence uploads).
 */

export type PrepareImageOptions = {
  /** Max width/height in px (default 1600). Images are never upscaled. */
  maxDim?: number;
  /** Encoder quality 0..1 (default 0.8). */
  quality?: number;
};

export class ImagePrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepareError";
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img> decoding (older Safari rejects the options bag)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    // <img> applies EXIF orientation by default in modern browsers (image-orientation: from-image).
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImagePrepareError("decode_failed");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImageForUpload(file: File, opts?: PrepareImageOptions): Promise<Blob> {
  const maxDim = Math.max(64, Math.round(opts?.maxDim ?? 1600));
  const quality = Math.min(1, Math.max(0.1, opts?.quality ?? 0.8));

  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new ImagePrepareError("empty_image");
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImagePrepareError("no_canvas");
    // JPEG has no alpha — paint white so transparent PNGs don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, w, h);

    // JPEG is universally encodable (Safari can't encode WebP); try WebP only if it's smaller.
    const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
    const webp = await canvasToBlob(canvas, "image/webp", quality);
    const candidates = [jpeg, webp].filter(
      (b): b is Blob => !!b && (b.type === "image/jpeg" || b.type === "image/webp"),
    );
    if (!candidates.length) throw new ImagePrepareError("encode_failed");
    return candidates.reduce((a, b) => (b.size < a.size ? b : a));
  } finally {
    img.close();
  }
}

/** Convenience: same as prepareImageForUpload but returns a File (keeps a sensible name). */
export async function prepareImageFile(file: File, opts?: PrepareImageOptions): Promise<File> {
  const blob = await prepareImageForUpload(file, opts);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}
