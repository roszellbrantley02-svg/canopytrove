import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import type { AppUiIconName } from '../../icons/AppUiIcon';
import { colors } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { StorefrontSummary } from '../../types/storefront';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStorefrontList } from './ProfileStorefrontList';
import { styles } from './profileStyles';

export function StorefrontCollectionSection({
  title,
  body,
  isLoading,
  storefronts,
  navigation,
  emptyText,
  iconName,
}: {
  title: string;
  body: string;
  isLoading: boolean;
  storefronts: StorefrontSummary[];
  navigation: NativeStackNavigationProp<RootStackParamList>;
  emptyText: string;
  iconName: AppUiIconName;
}) {
  return (
    <SectionCard title={title} body={body}>
      {isLoading ? (
        <CustomerStateCard
          title={`Loading ${title.toLowerCase()}`}
          body="Refreshing list."
          tone="info"
          iconName="albums-outline"
          eyebrow="Refreshing"
          note="Your latest activity will appear here shortly."
        >
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </CustomerStateCard>
      ) : (
        <ProfileStorefrontList
          storefronts={storefronts}
          navigation={navigation}
          emptyText={emptyText}
          iconName={iconName}
        />
      )}
    </SectionCard>
  );
}

export function ProfileSafetySection({
  hasAcceptedGuidelines,
  blockedAuthorCount,
  supportEmail,
  onOpenLegalCenter,
  onOpenDeleteAccount,
}: {
  hasAcceptedGuidelines: boolean;
  blockedAuthorCount: number;
  supportEmail: string;
  onOpenLegalCenter: () => void;
  onOpenDeleteAccount: () => void;
}) {
  return (
    <SectionCard title="Privacy and safety" body="">
      <View style={styles.contactList}>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Guidelines</Text>
          <Text style={styles.contactValue}>
            {hasAcceptedGuidelines ? 'Accepted' : 'Review required'}
          </Text>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Blocked authors</Text>
          <Text style={styles.contactValue}>{String(blockedAuthorCount)}</Text>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Support</Text>
          <Text
            style={styles.contactValue}
            numberOfLines={1}
            ellipsizeMode="middle"
            maxFontSizeMultiplier={1.05}
          >
            {supportEmail}
          </Text>
        </View>
      </View>
      <View style={styles.heroActions}>
        <Pressable
          onPress={onOpenLegalCenter}
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel="Open legal center"
          accessibilityHint="Opens the legal center with terms, privacy, and guidelines."
        >
          <Text style={styles.primaryButtonText}>Open Legal Center</Text>
        </Pressable>
        <Pressable
          onPress={onOpenDeleteAccount}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          accessibilityHint="Opens the account deletion flow."
        >
          <Text style={styles.secondaryButtonText}>Delete Account</Text>
        </Pressable>
      </View>
    </SectionCard>
  );
}

export function ProfileEmailUpdatesSection({
  authSessionStatus,
  memberEmail,
  subscribed,
  welcomeEmailState,
  welcomeEmailSentAt,
  isLoading,
  isSaving,
  actionStatus,
  onSubscribe,
  onUnsubscribe,
}: {
  authSessionStatus: string;
  memberEmail: string | null;
  subscribed: boolean;
  welcomeEmailState: 'not_requested' | 'pending_provider' | 'sent' | 'failed';
  welcomeEmailSentAt: string | null;
  isLoading: boolean;
  isSaving: boolean;
  actionStatus: string | null;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}) {
  if (authSessionStatus !== 'authenticated') {
    return (
      <SectionCard title="Email updates" body="Sign in to manage.">
        <View style={styles.contactList}>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Status</Text>
            <Text style={styles.contactValue}>Sign in required</Text>
          </View>
        </View>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Email updates" body="Welcome notes and product news.">
      <View style={styles.contactList}>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Email</Text>
          <Text
            style={styles.contactValue}
            numberOfLines={1}
            ellipsizeMode="middle"
            maxFontSizeMultiplier={1.05}
          >
            {memberEmail ?? 'Unavailable'}
          </Text>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Subscription</Text>
          <Text style={styles.contactValue}>
            {isLoading ? 'Loading...' : subscribed ? 'Subscribed' : 'Off'}
          </Text>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Welcome email</Text>
          <Text style={styles.contactValue}>
            {welcomeEmailState === 'sent'
              ? welcomeEmailSentAt
                ? `Sent ${new Date(welcomeEmailSentAt).toLocaleDateString()}`
                : 'Sent'
              : welcomeEmailState === 'failed'
                ? 'Needs retry'
                : welcomeEmailState === 'pending_provider'
                  ? 'Waiting on email setup'
                  : 'Not requested'}
          </Text>
        </View>
      </View>
      <View style={styles.heroActions}>
        {subscribed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Turn off email updates"
            accessibilityHint="Unsubscribes you from email notifications."
            disabled={isSaving || isLoading}
            onPress={onUnsubscribe}
            style={[styles.secondaryButton, (isSaving || isLoading) && styles.buttonDisabled]}
          >
            <Text style={styles.secondaryButtonText}>
              {isSaving ? 'Saving...' : 'Turn Off Email Updates'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Turn on email updates"
            accessibilityHint="Subscribes you to email notifications."
            disabled={isSaving || isLoading}
            onPress={onSubscribe}
            style={[styles.primaryButton, (isSaving || isLoading) && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Saving...' : 'Turn On Email Updates'}
            </Text>
          </Pressable>
        )}
      </View>
      {actionStatus ? <Text style={styles.environmentNote}>{actionStatus}</Text> : null}
    </SectionCard>
  );
}

export function AccountEnvironmentSection({
  authSessionStatus,
  dataSource,
  backendHealthStatus,
  activeLocationLabel,
  activeLocationMode,
  activeLatitude,
  activeLongitude,
  seedPayloadLabel,
  environmentNote,
  canSeed,
  isSeeding,
  seedButtonLabel,
  seedStatus,
  showLoadingSeedCounts,
  onSeed,
  onOpenAdminRuntime,
}: {
  authSessionStatus: string;
  dataSource: string;
  backendHealthStatus: string;
  activeLocationLabel: string;
  activeLocationMode: string;
  activeLatitude: number;
  activeLongitude: number;
  seedPayloadLabel: string;
  environmentNote: string;
  canSeed: boolean;
  isSeeding: boolean;
  seedButtonLabel: string;
  seedStatus: string | null;
  showLoadingSeedCounts: boolean;
  onSeed: () => void;
  onOpenAdminRuntime?: () => void;
}) {
  return (
    <SectionCard title="Internal environment" body="Dev: source, seed, backend.">
      <View style={styles.environmentList}>
        <View style={styles.environmentRow}>
          <Text style={styles.environmentLabel}>Identity session</Text>
          <Text style={styles.environmentValue}>{authSessionStatus}</Text>
        </View>
        <View style={styles.environmentRow}>
          <Text style={styles.environmentLabel}>Data source</Text>
          <Text style={styles.environmentValue}>{dataSource}</Text>
        </View>
        <View style={styles.environmentRow}>
          <Text style={styles.environmentLabel}>Backend health</Text>
          <Text style={styles.environmentValue}>{backendHealthStatus}</Text>
        </View>
        <View style={styles.environmentRow}>
          <Text style={styles.environmentLabel}>Location</Text>
          <Text
            style={styles.environmentValue}
          >{`${activeLocationLabel} (${activeLocationMode})`}</Text>
        </View>
        <View style={styles.environmentRow}>
          <Text style={styles.environmentLabel}>Coordinates</Text>
          <Text
            style={styles.environmentValue}
          >{`${activeLatitude.toFixed(3)}, ${activeLongitude.toFixed(3)}`}</Text>
        </View>
        <View style={styles.environmentRow}>
          <Text style={styles.environmentLabel}>Seed payload</Text>
          <Text style={styles.environmentValue}>{seedPayloadLabel}</Text>
        </View>
      </View>
      <Text style={styles.environmentNote}>{environmentNote}</Text>
      <Pressable
        disabled={!canSeed || isSeeding}
        onPress={onSeed}
        style={[styles.primaryButton, (!canSeed || isSeeding) && styles.buttonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={seedButtonLabel}
        accessibilityHint="Triggers a data seed operation for development."
      >
        {isSeeding ? <ActivityIndicator color={colors.background} /> : null}
        <Text style={styles.primaryButtonText}>{seedButtonLabel}</Text>
      </Pressable>
      {onOpenAdminRuntime ? (
        <Pressable
          onPress={onOpenAdminRuntime}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel="Open runtime controls"
          accessibilityHint="Opens the runtime control panel for development."
        >
          <Text style={styles.secondaryButtonText}>Open Runtime Controls</Text>
        </Pressable>
      ) : null}
      {seedStatus ? <Text style={styles.environmentNote}>{seedStatus}</Text> : null}
      {showLoadingSeedCounts ? (
        <Text style={styles.environmentNote}>Loading seed counts.</Text>
      ) : null}
    </SectionCard>
  );
}
