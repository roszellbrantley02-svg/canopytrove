/**
 * Cloud Storage helper — uploads screenshot buffers to a GCS bucket
 * and returns a `gs://` URL the API side can use to download for
 * Claude vision input.
 *
 * Bucket is configurable via SCREENSHOT_BUCKET env var, defaulting to
 * the existing canopy-trove.firebasestorage.app bucket. Object names
 * are namespaced by date for easy cleanup: `shop-bootstrap/YYYY-MM-DD/{draftId or random}.png`.
 *
 * Auth: when deployed to Cloud Run, the service account
 * (canopytrove-scraper@…) auto-authenticates via the metadata server.
 * Locally, set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON.
 */

const crypto = require('node:crypto');
const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = process.env.SCREENSHOT_BUCKET || 'canopy-trove.firebasestorage.app';
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'canopy-trove';

const storage = new Storage({ projectId: PROJECT_ID });

/**
 * Upload a PNG screenshot buffer to GCS.
 *
 * @param {Buffer} buffer       PNG bytes
 * @param {Object} opts
 * @param {string} [opts.draftId]   Bootstrap draft ID for traceability;
 *                                  random short hex if not provided.
 * @returns {Promise<{ gcsUrl: string, publicUrl: string, objectName: string }>}
 */
async function uploadScreenshot(buffer, opts = {}) {
  const draftId = opts.draftId || crypto.randomBytes(6).toString('hex');
  const today = new Date().toISOString().slice(0, 10);
  const objectName = `shop-bootstrap/${today}/${draftId}.png`;

  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType: 'image/png',
    // Cache aggressively — these screenshots are immutable per draft.
    metadata: {
      cacheControl: 'private, max-age=31536000',
      metadata: {
        source: 'canopytrove-scraper',
        draftId,
      },
    },
    // Resumable uploads are unnecessary for ~1MB PNGs and add latency.
    resumable: false,
  });

  return {
    gcsUrl: `gs://${BUCKET_NAME}/${objectName}`,
    // Public URL is signed-URL-style; only valid if bucket allows public
    // reads. The API side should generate signed URLs for Claude to fetch
    // when it needs the image (Storage v4 signed URLs).
    publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${objectName}`,
    objectName,
  };
}

module.exports = { uploadScreenshot, BUCKET_NAME };
