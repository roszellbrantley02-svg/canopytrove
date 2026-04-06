/**
 * Lightweight EXIF metadata stripper for uploaded images.
 *
 * Strips EXIF (including GPS location, device info, timestamps) from JPEG files
 * without requiring native dependencies like `sharp`. For PNG and WebP, metadata
 * is minimal and rarely contains GPS — this module handles the JPEG case which
 * is the primary privacy concern.
 *
 * Why: User-uploaded review photos may contain GPS coordinates, camera model,
 * and other PII embedded in EXIF. Stripping before storage protects user privacy.
 */

const JPEG_SOI = 0xffd8;
const JPEG_MARKER_PREFIX = 0xff;
const EXIF_APP1 = 0xe1;
const JFIF_APP0 = 0xe0;

/**
 * Returns true if the buffer looks like a JPEG file (starts with SOI marker).
 */
function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer.readUInt16BE(0) === JPEG_SOI;
}

/**
 * Strip all APP1 (EXIF) segments from a JPEG buffer.
 *
 * JPEG structure: SOI (2 bytes) followed by marker segments.
 * Each segment starts with 0xFF + marker byte + 2-byte length (big-endian).
 * We copy everything except APP1 segments which contain EXIF data.
 *
 * Returns a new buffer with EXIF removed, or the original buffer unchanged
 * if the input is not JPEG or has no EXIF to strip.
 */
export function stripExifFromJpeg(buffer: Buffer): Buffer {
  if (!isJpeg(buffer)) {
    return buffer;
  }

  const chunks: Buffer[] = [];
  let offset = 2; // Skip SOI (0xFFD8)

  // Write SOI marker
  chunks.push(buffer.subarray(0, 2));

  let strippedAny = false;

  while (offset < buffer.length - 1) {
    // Each marker starts with 0xFF
    if (buffer[offset] !== JPEG_MARKER_PREFIX) {
      // Not a valid marker — copy the rest as-is and stop
      chunks.push(buffer.subarray(offset));
      break;
    }

    const markerByte = buffer[offset + 1];

    // SOS (Start of Scan, 0xDA) means the rest is image data — copy everything remaining
    if (markerByte === 0xda) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    // Standalone markers (no length field): RST0-RST7 (0xD0-0xD7), SOI (0xD8), EOI (0xD9)
    if (markerByte >= 0xd0 && markerByte <= 0xd9) {
      chunks.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    // Ensure we can read the 2-byte length
    if (offset + 3 >= buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    const segmentEnd = offset + 2 + segmentLength;

    if (segmentEnd > buffer.length) {
      // Malformed segment — copy the rest as-is
      chunks.push(buffer.subarray(offset));
      break;
    }

    // Skip APP1 (EXIF) segments
    if (markerByte === EXIF_APP1) {
      strippedAny = true;
      offset = segmentEnd;
      continue;
    }

    // Keep all other segments (APP0/JFIF, DQT, DHT, SOF, etc.)
    chunks.push(buffer.subarray(offset, segmentEnd));
    offset = segmentEnd;
  }

  if (!strippedAny) {
    return buffer;
  }

  return Buffer.concat(chunks);
}

/**
 * Strip EXIF metadata from an image buffer based on content type.
 * Currently handles JPEG. PNG and WebP are returned as-is (they rarely
 * contain GPS data, and stripping them requires format-specific parsing).
 */
export function stripImageMetadata(buffer: Buffer, contentType: string): Buffer {
  if (contentType === 'image/jpeg') {
    return stripExifFromJpeg(buffer);
  }

  // PNG and WebP: return unchanged for now.
  // PNG metadata (tEXt/iTXt chunks) rarely contains GPS.
  // WebP EXIF is possible but uncommon from phone cameras.
  return buffer;
}
