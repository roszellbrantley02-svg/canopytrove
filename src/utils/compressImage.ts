import { Platform } from 'react-native';

/**
 * Maximum dimension (width or height) for uploaded review photos.
 * Images larger than this are scaled down proportionally.
 */
const MAX_DIMENSION = 1200;

/**
 * JPEG compression quality (0–1). 0.72 is the sweet spot for review photos:
 * good visual quality while cutting 5 MB originals down to ~300–500 KB.
 */
const JPEG_QUALITY = 0.72;

/**
 * Hard ceiling for the compressed output in bytes. The backend rejects raw
 * images over 8 MB, but after base64 encoding the JSON body grows ~33%.
 * Keeping the raw file under ~7.5 MB keeps the base64 payload comfortably
 * inside the backend's 12 MB JSON body limit while avoiding false rejections
 * for modern phone photos that are valid but slightly above 6 MB.
 */
const MAX_OUTPUT_BYTES = Math.floor(7.5 * 1024 * 1024);
const DIMENSION_STEPS = [MAX_DIMENSION, 960, 768, 640];
const QUALITY_STEPS = [JPEG_QUALITY, 0.6, 0.48, 0.36];

export type CompressedImage = {
  uri: string;
  mimeType: string;
  size: number;
  blob?: Blob | null;
};

export type CompressImageInput = {
  uri: string;
  file?: Blob | File | null;
};

/**
 * Compress and resize a picked image before upload.
 *
 * - **Web**: uses OffscreenCanvas / HTMLCanvasElement to resize and re-encode
 *   as JPEG. Works with any image the browser can decode (JPEG, PNG, WebP,
 *   HEIC on Safari, etc.).
 * - **Native (iOS / Android)**: the image picker's `quality` param already
 *   compresses; this function is a lightweight pass-through that only
 *   re-fetches the blob to measure its size accurately.
 *
 * Returns a new blob URI, MIME type, and byte size.
 */
export async function compressImage(input: string | CompressImageInput): Promise<CompressedImage> {
  const normalizedInput =
    typeof input === 'string'
      ? {
          uri: input,
          file: null,
        }
      : input;

  if (Platform.OS === 'web') {
    return compressImageWeb(normalizedInput);
  }

  // On native, expo-image-picker applies JPEG quality when the image is
  // selected. We still fetch the blob to get an accurate byte size (the
  // picker's `fileSize` is sometimes null).
  return compressImageNative(normalizedInput.uri);
}

// ---------------------------------------------------------------------------
// Web implementation — canvas resize + JPEG encode
// ---------------------------------------------------------------------------

function createPassthroughImage(uri: string, blob: Blob): CompressedImage {
  return {
    uri,
    mimeType: blob.type || 'image/jpeg',
    size: blob.size,
    blob,
  };
}

type DecodedImageSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function compressImageWeb(input: CompressImageInput): Promise<CompressedImage> {
  let originalBlob: Blob;
  if (input.file) {
    originalBlob = input.file;
  } else {
    const response = await fetch(input.uri);
    if (!response.ok) {
      throw new Error('Upload failed: unable to read the selected photo.');
    }
    originalBlob = await response.blob();
  }

  if (!originalBlob.size) {
    return createPassthroughImage(input.uri, originalBlob);
  }

  let decodedImage: DecodedImageSource | null = null;
  try {
    decodedImage = await decodeImageForCompression(originalBlob);
  } catch {
    // Some browsers or image formats fail in createImageBitmap but can still
    // be uploaded safely if they are already under the backend limit.
    if (originalBlob.size <= MAX_OUTPUT_BYTES) {
      return createPassthroughImage(input.uri, originalBlob);
    }
    throw new Error(
      'This photo is too large and could not be compressed. Please use a smaller image.',
    );
  }

  try {
    for (const maxDimension of DIMENSION_STEPS) {
      for (const quality of QUALITY_STEPS) {
        const result = await encodeToJpeg(decodedImage, quality, maxDimension);
        if (result && result.size <= MAX_OUTPUT_BYTES) {
          const compressedUri = URL.createObjectURL(result);
          return {
            uri: compressedUri,
            mimeType: 'image/jpeg',
            size: result.size,
            blob: result,
          };
        }
      }
    }
  } finally {
    decodedImage.close();
  }

  if (originalBlob.size <= MAX_OUTPUT_BYTES) {
    return createPassthroughImage(input.uri, originalBlob);
  }

  throw new Error(
    'This photo is too large to upload even after compression. Please use a smaller image.',
  );
}

async function decodeImageForCompression(blob: Blob): Promise<DecodedImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the HTMLImageElement path below.
    }
  }

  if (typeof Image !== 'function' || typeof URL.createObjectURL !== 'function') {
    throw new Error('This browser cannot decode the selected photo for compression.');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.decoding = 'async';
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Could not decode the selected photo.'));
      nextImage.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * Resize to MAX_DIMENSION and encode as JPEG at the given quality.
 * Returns the compressed Blob, or null if canvas encoding fails.
 */
async function encodeToJpeg(
  decodedImage: DecodedImageSource,
  quality: number,
  maxDimension: number,
): Promise<Blob | null> {
  let targetWidth = decodedImage.width;
  let targetHeight = decodedImage.height;

  if (!targetWidth || !targetHeight) {
    return null;
  }

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    const ratio = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
  }

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(targetWidth, targetHeight);
    ctx = canvas.getContext('2d');
  } else {
    const el = document.createElement('canvas');
    el.width = targetWidth;
    el.height = targetHeight;
    canvas = el;
    ctx = el.getContext('2d');
  }

  if (!ctx) {
    return null;
  }

  try {
    ctx.drawImage(decodedImage.source, 0, 0, targetWidth, targetHeight);

    if (canvas instanceof OffscreenCanvas) {
      return await canvas.convertToBlob({
        type: 'image/jpeg',
        quality,
      });
    }

    return await new Promise<Blob | null>((resolve) => {
      (canvas as HTMLCanvasElement).toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Native implementation — rely on picker quality, just measure accurately
// ---------------------------------------------------------------------------

async function compressImageNative(uri: string): Promise<CompressedImage> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return {
      uri,
      mimeType: blob.type || 'image/jpeg',
      size: blob.size,
    };
  } catch {
    // If we can't even read the blob, return the URI with unknown size.
    // The upload service will re-fetch and measure later.
    return {
      uri,
      mimeType: 'image/jpeg',
      size: 0,
    };
  }
}
