import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import {
  checkWebPushAvailability,
  disableOwnerPortalWebPush,
  enableOwnerPortalWebPush,
  getWebPushPermissionStatus,
  isOwnerPortalWebPushActive,
  type WebPushUnsupportedReason,
} from '../../services/ownerPortalWebPushService';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

// Browser opt-in for review push notifications. Lives next to the existing
// "Enable Fast Alerts" native button — on web the native expo-notifications
// path is unavailable and this control wires up the Web Push pipeline
// instead. On native it returns null so callers can render this
// unconditionally.

type Props = {
  preview?: boolean;
};

type AsyncState = 'idle' | 'enabling' | 'disabling';

function describeUnsupportedReason(reason: WebPushUnsupportedReason): string {
  switch (reason) {
    case 'not_web':
      return 'This browser flow only runs on web.';
    case 'no_service_worker':
      return 'Your browser does not support service workers — push notifications cannot run here.';
    case 'no_push_manager':
      return 'Your browser does not support the Push API.';
    case 'no_notification_api':
      return 'Your browser does not support the Notification API.';
    case 'insecure_context':
      return 'Web push requires HTTPS — open the owner portal over a secure connection to enable.';
    case 'vapid_public_key_missing':
      return 'Web push is not configured for this build yet.';
    default:
      return 'Web push is not available in this browser.';
  }
}

export function OwnerPortalWebPushToggle({ preview = false }: Props) {
  // Native is a hard gate — web-push has no analog and we want the parent
  // screen to render this unconditionally. Splitting into a wrapper keeps
  // the hooks list stable on the inner component and avoids the
  // react-hooks/rules-of-hooks lint violation that comes from early-
  // returning before hooks run.
  if (Platform.OS !== 'web') {
    return null;
  }
  return <OwnerPortalWebPushToggleWeb preview={preview} />;
}

function OwnerPortalWebPushToggleWeb({ preview }: { preview: boolean }) {
  const [availability] = React.useState(() => checkWebPushAvailability());
  const [permission, setPermission] = React.useState(() => getWebPushPermissionStatus());
  const [active, setActive] = React.useState<boolean>(false);
  const [asyncState, setAsyncState] = React.useState<AsyncState>('idle');
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const isActive = await isOwnerPortalWebPushActive();
      if (!cancelled) {
        setActive(isActive);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!availability.supported) {
    return (
      <View style={styles.ctaPanel}>
        <Text style={styles.helperText}>{describeUnsupportedReason(availability.reason)}</Text>
      </View>
    );
  }

  const onEnable = async () => {
    if (preview || asyncState !== 'idle') return;
    setAsyncState('enabling');
    setStatusMessage(null);
    const result = await enableOwnerPortalWebPush();
    setAsyncState('idle');
    setPermission(getWebPushPermissionStatus());

    switch (result.status) {
      case 'enabled':
        setActive(true);
        setStatusMessage('Browser notifications are on. New reviews will alert this device.');
        return;
      case 'permission_denied':
        setStatusMessage(
          'Notification permission was declined. Re-enable it in your browser settings to turn alerts on.',
        );
        return;
      case 'not_supported':
        setStatusMessage(describeUnsupportedReason(result.reason));
        return;
      case 'error':
        setStatusMessage(result.message);
    }
  };

  const onDisable = async () => {
    if (preview || asyncState !== 'idle') return;
    setAsyncState('disabling');
    setStatusMessage(null);
    const result = await disableOwnerPortalWebPush();
    setAsyncState('idle');

    if (result.status === 'disabled') {
      setActive(false);
      setStatusMessage('Browser notifications are off for this device.');
      return;
    }
    if (result.status === 'not_supported') {
      setStatusMessage(describeUnsupportedReason(result.reason));
      return;
    }
    setStatusMessage(result.message);
  };

  const buttonLabel = (() => {
    if (asyncState === 'enabling') return 'Enabling...';
    if (asyncState === 'disabling') return 'Disabling...';
    if (active) return 'Turn off browser alerts';
    return 'Enable browser alerts';
  })();

  const helperLine = (() => {
    if (!hydrated) return 'Checking browser notification status...';
    if (active) return 'Browser alerts are on for this device.';
    if (permission === 'denied') {
      return 'Notifications are blocked in this browser. Update site permissions to receive review alerts here.';
    }
    return 'Get a browser notification the moment a new review comes in. Works on this laptop or PWA-installed device.';
  })();

  const handlePress = active ? onDisable : onEnable;
  const isDisabled = preview || asyncState !== 'idle' || (!active && permission === 'denied');

  return (
    <View style={[styles.ctaPanel, active ? styles.statusPanelSuccess : styles.statusPanelWarm]}>
      <Text style={styles.helperText}>{helperLine}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={() => {
          void handlePress();
        }}
        style={[styles.primaryButton, isDisabled && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonText}>{preview ? 'Preview Only' : buttonLabel}</Text>
      </Pressable>
      {statusMessage ? <Text style={styles.helperText}>{statusMessage}</Text> : null}
    </View>
  );
}
