import { toStorefrontDetailDocument, toStorefrontSummaryDocument } from '../adapters/firestoreDocumentAdapter';
import { storefrontSeedRecords } from './storefrontSeedRecords';

export const mockStorefrontSummaryDocuments = Object.fromEntries(
  storefrontSeedRecords.map((record) => [record.id, toStorefrontSummaryDocument(record)])
);

export const mockStorefrontDetailDocuments = Object.fromEntries(
  storefrontSeedRecords.map((record) => [record.id, toStorefrontDetailDocument(record)])
);
