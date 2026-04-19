/**
 * Client-side feature flags driven by EXPO_PUBLIC_* env vars.
 *
 * These are snapshotted at app boot — flipping a flag requires either a
 * new OTA payload or re-running the app. Keep flag additions conservative
 * and always pair "on by default" flags with a kill-switch env var so we
 * can disable a misbehaving feature without a new EAS build.
 */

function normalizeConfiguredValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseBoolean(value: string | null | undefined, fallback: boolean): boolean {
  const normalized = normalizeConfiguredValue(value)?.toLowerCase();
  if (normalized === null || normalized === undefined) {
    return fallback;
  }
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

/**
 * Holographic Skia shine overlay on every StorefrontRouteCard.
 *
 * Default: ON. Kill-switch via `EXPO_PUBLIC_DISABLE_CARD_SKIA=true`.
 *
 * Design rationale: we want the 3D-feeling shine live by default for the
 * "wow" effect, but need a fast rollback path if Sentry surfaces frame-drop
 * regressions on lower-end devices. Setting this to `true` disables the
 * Skia overlay app-wide without shipping new native code.
 */
export function isCardSkiaEnabled(): boolean {
  const disabled = parseBoolean(process.env.EXPO_PUBLIC_DISABLE_CARD_SKIA, false);
  return !disabled;
}

export const featureFlags = {
  cardSkiaEnabled: isCardSkiaEnabled(),
} as const;
