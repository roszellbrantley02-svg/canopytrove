import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import type { OcmVerification } from '../types/storefrontBaseTypes';

export type LicenseVerifyQuery = {
  license?: string;
  address?: string;
  city?: string;
  zip?: string;
  name?: string;
};

export type LicenseVerifyResult = OcmVerification & {
  record: {
    licenseNumber: string;
    licenseType: string;
    licenseeName: string;
    dbaName: string | null;
    status: string;
    issueDate: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  disclaimer: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

function buildUrl(query: LicenseVerifyQuery): string | null {
  if (!storefrontApiBaseUrl) return null;
  const base = storefrontApiBaseUrl.endsWith('/')
    ? storefrontApiBaseUrl
    : `${storefrontApiBaseUrl}/`;
  const url = new URL('licenses/verify', base);
  if (query.license) url.searchParams.set('license', query.license);
  if (query.address) url.searchParams.set('address', query.address);
  if (query.city) url.searchParams.set('city', query.city);
  if (query.zip) url.searchParams.set('zip', query.zip);
  if (query.name) url.searchParams.set('name', query.name);
  return url.toString();
}

export async function verifyLicense(query: LicenseVerifyQuery): Promise<LicenseVerifyResult> {
  if (!query.license && !query.address && !query.name) {
    throw new Error('Provide a license number, address, or dispensary name.');
  }

  const url = buildUrl(query);
  if (!url) {
    throw new Error('Verification is unavailable right now.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Verification request failed (${response.status}).`);
    }
    const payload = (await response.json()) as LicenseVerifyResult;
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}
