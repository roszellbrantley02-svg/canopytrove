import { Router } from 'express';
import { verifyAgainstCache, type VerificationMatch } from '../services/ocmLicenseCacheService';

export const licenseVerifyRoutes = Router();

function clean(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

licenseVerifyRoutes.get('/licenses/verify', async (request, response) => {
  const query = request.query as Record<string, unknown>;
  const licenseNumber = clean(query.license, 40);
  const address = clean(query.address, 240);
  const city = clean(query.city, 120);
  const zip = clean(query.zip, 12);
  const name = clean(query.name, 240);

  if (!licenseNumber && !address && !name) {
    response.status(400).json({
      error: 'Provide at least one of: license, address, or name.',
    });
    return;
  }

  const match = await verifyAgainstCache({ licenseNumber, address, city, zip, name });
  const payload = shapeResponse(match);

  response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  response.json(payload);
});

function shapeResponse(match: VerificationMatch) {
  return {
    licensed: match.licensed,
    confidence: match.confidence,
    asOf: match.asOf,
    source: match.source,
    record: match.record
      ? {
          licenseNumber: match.record.license_number,
          licenseType: match.record.license_type,
          licenseeName: match.record.licensee_name,
          dbaName: match.record.dba_name ?? null,
          status: match.record.license_status,
          issueDate: match.record.issue_date ?? null,
          address: match.record.address ?? null,
          city: match.record.city ?? null,
          state: match.record.state ?? null,
          zip: match.record.zip_code ?? null,
        }
      : null,
    disclaimer:
      'Verification reflects the most recent public record from the NY Office of Cannabis Management. A "not found" result does not confirm a shop is unlicensed; data refreshes hourly and OCM publishes on its own cadence.',
  };
}
