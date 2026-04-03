import { ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../config/firebase';
import type { OwnerPortalUploadedFile } from '../types/ownerPortal';
import { ensureOwnerPortalSessionReady } from './ownerPortalSessionService';

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function getFileExtension(file: OwnerPortalUploadedFile) {
  const fileName = file.name.trim();
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex >= 0 && lastDotIndex < fileName.length - 1) {
    return `.${sanitizeFileSegment(fileName.slice(lastDotIndex + 1).toLowerCase())}`;
  }

  if (file.mimeType === 'application/pdf') {
    return '.pdf';
  }

  if (file.mimeType?.startsWith('image/')) {
    return '.jpg';
  }

  return '.bin';
}

async function createBlobFromUri(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read the selected file.');
  }

  return response.blob();
}

function createStorageUploadRecord(filePath: string, downloadUrl?: string | null) {
  return {
    filePath,
    downloadUrl: downloadUrl ?? null,
  };
}

export async function uploadOwnerPrivateFile(
  ownerUid: string,
  category: 'business' | 'identity',
  filePrefix: string,
  file: OwnerPortalUploadedFile,
) {
  const storage = getFirebaseStorage();
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }

  const timestamp = Date.now();
  const extension = getFileExtension(file);
  const fileName = `${sanitizeFileSegment(filePrefix)}-${timestamp}${extension}`;
  const filePath = `owner-private/${ownerUid}/${category}/${fileName}`;
  const fileRef = ref(storage, filePath);
  const blob = await createBlobFromUri(file.uri);

  await uploadBytes(fileRef, blob, {
    contentType: file.mimeType ?? undefined,
  });

  return filePath;
}

export async function uploadOwnerApprovedStorefrontMediaFile(input: {
  ownerUid: string;
  dispensaryId: string;
  mediaType: 'storefront-card' | 'storefront-gallery';
  file: OwnerPortalUploadedFile;
}) {
  await ensureOwnerPortalSessionReady();
  const storage = getFirebaseStorage();
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }

  const timestamp = Date.now();
  const extension = getFileExtension(input.file);
  const fileName = `${sanitizeFileSegment(input.mediaType)}-${timestamp}${extension}`;
  const filePath = `dispensary-media/${input.dispensaryId}/approved/owner/${input.ownerUid}/${input.mediaType}/${fileName}`;
  const fileRef = ref(storage, filePath);
  const blob = await createBlobFromUri(input.file.uri);

  await uploadBytes(fileRef, blob, {
    contentType: input.file.mimeType ?? undefined,
  });

  return createStorageUploadRecord(filePath, null);
}
