import * as DocumentPicker from 'expo-document-picker';
import { OwnerPortalUploadedFile } from '../../types/ownerPortal';

export function formatStorefrontAddress(storefrontSummary?: {
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}) {
  if (!storefrontSummary) {
    return '';
  }

  return `${storefrontSummary.addressLine1}, ${storefrontSummary.city}, ${storefrontSummary.state} ${storefrontSummary.zip}`;
}

export async function pickVerificationDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['application/pdf', 'image/*'],
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
  } satisfies OwnerPortalUploadedFile;
}
