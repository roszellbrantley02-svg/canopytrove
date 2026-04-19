import type { AppProfile } from '../types/storefront';

// Standalone cache module so consumers that only need the cached profile
// (e.g. storefrontBackendHttp) can import it without pulling in the full
// appProfileService. This breaks the require cycle:
//   storefrontBackendService -> storefrontBackendReadApi -> storefrontBackendHttp
//     -> appProfileService -> storefrontBackendService

let memoryCachedAppProfile: AppProfile | null = null;

export function getCachedAppProfile(): AppProfile | null {
  return memoryCachedAppProfile;
}

export function setCachedAppProfile(profile: AppProfile | null): void {
  memoryCachedAppProfile = profile;
}
