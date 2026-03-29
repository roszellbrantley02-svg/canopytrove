import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type PostVisitNotificationPromptKind = 'guest_first_visit' | 'return_visit';

export const POST_VISIT_NOTIFICATION_CHANNEL_ID = 'post-visit-follow-up';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export async function initializePostVisitNotifications() {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(POST_VISIT_NOTIFICATION_CHANNEL_ID, {
      name: 'Post-visit follow-ups',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 240, 120, 240],
    });
  } catch {
    // Notification channel setup should never block the app.
  }
}

export async function requestPostVisitNotificationPermission() {
  try {
    const currentPermission = await Notifications.getPermissionsAsync();
    const permission =
      currentPermission.status === 'granted'
        ? currentPermission
        : await Notifications.requestPermissionsAsync();

    return permission.status === 'granted';
  } catch {
    return false;
  }
}

export async function schedulePostVisitNotification(options: {
  storefrontId: string;
  storefrontName: string;
  promptKind: PostVisitNotificationPromptKind;
  journeyId: string;
  delaySeconds: number;
}) {
  const hasPermission = await requestPostVisitNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Thanks for using Canopy Trove',
        body:
          options.promptKind === 'guest_first_visit'
            ? `Visited ${options.storefrontName}? Sign up to leave a review and start earning badges.`
            : `How was ${options.storefrontName}? Leave a review on Canopy Trove to keep your badges growing.`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          kind: 'post_visit_prompt',
          storefrontId: options.storefrontId,
          journeyId: options.journeyId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: options.delaySeconds,
        channelId: POST_VISIT_NOTIFICATION_CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function clearPostVisitNotification(identifier?: string | null) {
  if (!identifier) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Ignore cancellation errors.
  }

  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // Ignore dismissal errors.
  }
}
