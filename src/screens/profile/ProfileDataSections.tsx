import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { StorefrontSummary } from '../../types/storefront';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  iconName: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <SectionCard title={title} body={body}>
      {isLoading ? (
        <CustomerStateCard
          title={`Loading ${title.toLowerCase()}`}
          body="Canopy Trove is restoring this storefront list for your profile right now."
          tone="info"
          iconName="albums-outline"
          eyebrow="Profile state"
          note="Saved and recent storefront activity is still attached to your profile while this list refreshes."
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

export function AccountAccessSection({
  authSessionStatus,
  memberEmail,
  ownerPortalEnabled,
  ownerPortalPreviewEnabled,
  onOpenMemberSignIn,
  onOpenMemberSignUp,
  onOpenOwnerSignIn,
  onOpenOwnerPreviewPortal,
  showOwnerPreview = false,
  onDismissOwnerPreview,
}: {
  authSessionStatus: string;
  memberEmail: string | null;
  ownerPortalEnabled: boolean;
  ownerPortalPreviewEnabled: boolean;
  onOpenMemberSignIn: () => void;
  onOpenMemberSignUp: () => void;
  onOpenOwnerSignIn: () => void;
  onOpenOwnerPreviewPortal: () => void;
  showOwnerPreview?: boolean;
  onDismissOwnerPreview?: () => void;
}) {
  const isMemberAuthenticated = authSessionStatus === 'authenticated';

  return (
    <SectionCard
      title="Account access"
      body="Member accounts keep your saved storefronts, reviews, and badges together. Dispensary owners use a separate owner sign-in."
    >
      <View style={styles.infoGrid}>
        <Text style={styles.environmentNote}>
          {isMemberAuthenticated && memberEmail
            ? `Signed in as ${memberEmail}.`
            : 'No member account is signed in right now.'}
        </Text>
        <View style={styles.heroActions}>
          <Pressable onPress={onOpenMemberSignIn} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {isMemberAuthenticated ? 'Switch Member Account' : 'Member Sign In'}
            </Text>
          </Pressable>
          {!isMemberAuthenticated ? (
            <Pressable onPress={onOpenMemberSignUp} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Create Member Account</Text>
            </Pressable>
          ) : null}
          {ownerPortalEnabled ? (
            <Pressable onPress={onOpenOwnerSignIn} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Dispensary Owner Sign In</Text>
            </Pressable>
          ) : null}
        </View>
        {ownerPortalEnabled && ownerPortalPreviewEnabled && showOwnerPreview ? (
          <View style={styles.previewCard}>
            <View style={styles.previewCardHeader}>
              <Text style={styles.previewCardTitle}>Owner tools are coming soon</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss owner preview"
                onPress={onDismissOwnerPreview}
                style={styles.previewDismissButton}
              >
                <Ionicons name="close" size={18} color={colors.textSoft} />
              </Pressable>
            </View>
            <Text style={styles.previewCardBody}>
              Claiming, deal publishing, storefront photos, and owner badges are planned for a near-future release.
            </Text>
            <Text style={styles.previewCardBody}>
              Open the guided owner demo to review those tools without touching live owner data.
            </Text>
            <View style={styles.heroActions}>
              <Pressable onPress={onOpenOwnerPreviewPortal} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Open Owner Demo</Text>
              </Pressable>
            </View>
            <View style={styles.contactList}>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>Website</Text>
                <Text style={styles.contactValue}>https://canopytrove.com</Text>
              </View>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>Support</Text>
                <Text style={styles.contactValue}>support@canopytrove.com</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
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
    <SectionCard
      title="Privacy and safety"
      body="Review the legal center, moderation controls, and account deletion flow before release."
    >
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
          <Text style={styles.contactValue}>{supportEmail}</Text>
        </View>
      </View>
      <View style={styles.heroActions}>
        <Pressable onPress={onOpenLegalCenter} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Open Legal Center</Text>
        </Pressable>
        <Pressable onPress={onOpenDeleteAccount} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Delete Account</Text>
        </Pressable>
      </View>
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
}) {
  return (
    <SectionCard
      title="Internal environment"
      body="Development-only storefront source, seed, and backend controls."
    >
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
          <Text style={styles.environmentValue}>{`${activeLocationLabel} (${activeLocationMode})`}</Text>
        </View>
        <View style={styles.environmentRow}>
          <Text style={styles.environmentLabel}>Coordinates</Text>
          <Text style={styles.environmentValue}>{`${activeLatitude.toFixed(3)}, ${activeLongitude.toFixed(3)}`}</Text>
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
      >
        {isSeeding ? <ActivityIndicator color={colors.background} /> : null}
        <Text style={styles.primaryButtonText}>{seedButtonLabel}</Text>
      </Pressable>
      {seedStatus ? <Text style={styles.environmentNote}>{seedStatus}</Text> : null}
      {showLoadingSeedCounts ? (
        <Text style={styles.environmentNote}>Loading backend seed counts.</Text>
      ) : null}
    </SectionCard>
  );
}

