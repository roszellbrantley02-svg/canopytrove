import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * Cross-platform alert that uses `Alert.alert()` on native and
 * `window.confirm()` / `window.alert()` on web.
 *
 * On web:
 * - If buttons include a destructive/default action alongside a cancel button,
 *   `window.confirm()` is used. Pressing OK triggers the non-cancel action.
 * - If no buttons or only informational, `window.alert()` is used.
 */
export function crossPlatformAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const displayText = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(displayText);
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const actionButton = buttons.find((b) => b.style !== 'cancel');

  if (!actionButton) {
    window.alert(displayText);
    cancelButton?.onPress?.();
    return;
  }

  const confirmed = window.confirm(displayText);
  if (confirmed) {
    actionButton.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
