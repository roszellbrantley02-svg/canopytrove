import {
  getRegisteredDevicePushToken,
  initializeDevicePushNotifications,
} from './devicePushNotificationService';

export async function initializeOpsAlertNotifications() {
  await initializeDevicePushNotifications();
}

export async function getRegisteredOpsAlertPushToken(options?: { prompt?: boolean }) {
  await initializeOpsAlertNotifications();
  return getRegisteredDevicePushToken(options);
}
