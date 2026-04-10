import React from 'react';
import { Platform, Text, View } from 'react-native';
import { InlineFeedbackPanel } from '../../components/InlineFeedbackPanel';
import type { OwnerProfileDocument } from '../../types/ownerPortal';
import type { OwnerPortalHomeSummaryTile } from './ownerPortalHomeData';
import { formatOwnerValue } from './ownerPortalHomeData';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

function getOwnerIdentityTitle(ownerProfile: OwnerProfileDocument) {
  return ownerProfile.companyName || ownerProfile.legalName || 'Owner company';
}

function getOwnerInitials(ownerProfile: OwnerProfileDocument) {
  const source = getOwnerIdentityTitle(ownerProfile).trim();
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'CT';
}

export function OwnerPortalHomeProfileSection({
  isLoading,
  errorText,
  ownerProfile,
  profileSummaryTiles,
}: {
  isLoading: boolean;
  errorText: string | null;
  ownerProfile: OwnerProfileDocument | null;
  profileSummaryTiles: OwnerPortalHomeSummaryTile[];
}) {
  const isAndroid = Platform.OS === 'android';

  if (isLoading) {
    return (
      <InlineFeedbackPanel
        tone="info"
        iconName="time-outline"
        label="Business profile"
        title="Loading your business details"
        body="Pulling in the current business profile."
      />
    );
  }

  if (errorText) {
    return (
      <InlineFeedbackPanel
        tone="danger"
        iconName="alert-circle-outline"
        label="Business profile"
        title="Could not load your business details"
        body={errorText}
      />
    );
  }

  if (!ownerProfile) {
    return (
      <InlineFeedbackPanel
        tone="warning"
        iconName="briefcase-outline"
        label="Business profile"
        title="Your business profile is not ready yet"
        body={
          isAndroid
            ? 'Finish setup to unlock storefront photos, updates, and business tools.'
            : 'Finish setup to unlock storefront photos, offers, and business tools.'
        }
      />
    );
  }

  const ownerTitle = getOwnerIdentityTitle(ownerProfile);
  const ownerSubtitle =
    ownerProfile.legalName && ownerProfile.legalName !== ownerTitle
      ? ownerProfile.legalName
      : ownerProfile.phone
        ? ownerProfile.phone
        : 'Business account';
  const storefrontState = ownerProfile.dispensaryId ? 'Connected' : 'Not connected';
  const storefrontBody = ownerProfile.dispensaryId
    ? ownerProfile.dispensaryId
    : isAndroid
      ? 'Connect your storefront to start editing photos, details, and updates.'
      : 'Connect your storefront to start editing photos, details, and offers.';
  const workspaceChipLabel = ownerProfile.dispensaryId
    ? 'Storefront connected'
    : 'Setup in progress';

  return (
    <View style={styles.cardStack}>
      <View style={styles.ownerProfileSpotlight}>
        <View pointerEvents="none" style={styles.ownerProfileGlow} />
        <View style={styles.ownerProfileTopRow}>
          <View style={styles.ownerProfileIdentityRow}>
            <View style={styles.ownerProfileMonogram}>
              <Text style={styles.ownerProfileMonogramText}>{getOwnerInitials(ownerProfile)}</Text>
            </View>
            <View style={styles.ownerProfileIdentityCopy}>
              <View style={styles.ownerProfileKickerRow}>
                <Text style={styles.sectionEyebrow}>Business profile</Text>
                <View style={styles.ownerProfileLiveChip}>
                  <Text style={styles.ownerProfileLiveChipText}>{workspaceChipLabel}</Text>
                </View>
              </View>
              <Text style={styles.ownerProfileTitle} numberOfLines={2} ellipsizeMode="tail">
                {ownerTitle}
              </Text>
              <Text style={styles.ownerProfileMeta} numberOfLines={2} ellipsizeMode="tail">
                {ownerSubtitle}
              </Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Level {ownerProfile.badgeLevel}</Text>
          </View>
        </View>
        <Text style={styles.portalHeroBody}>
          Keep your business details, storefront connection, and plan status in one place.
        </Text>
        <View style={styles.ownerProfileStatusGrid}>
          <View style={styles.ownerProfileStatusCard}>
            <Text style={styles.ownerProfileStatusValue}>
              {formatOwnerValue(ownerProfile.businessVerificationStatus)}
            </Text>
            <Text style={styles.ownerProfileStatusLabel}>Business approval</Text>
            <Text style={styles.ownerProfileStatusBody}>Where your business review stands.</Text>
          </View>
          <View style={styles.ownerProfileStatusCard}>
            <Text style={styles.ownerProfileStatusValue}>
              {formatOwnerValue(ownerProfile.identityVerificationStatus)}
            </Text>
            <Text style={styles.ownerProfileStatusLabel}>Identity</Text>
            <Text style={styles.ownerProfileStatusBody}>Your owner verification status.</Text>
          </View>
          <View style={styles.ownerProfileStatusCard}>
            <Text style={styles.ownerProfileStatusValue}>{storefrontState}</Text>
            <Text style={styles.ownerProfileStatusLabel}>Storefront</Text>
            <Text style={styles.ownerProfileStatusBody} numberOfLines={2} ellipsizeMode="middle">
              {storefrontBody}
            </Text>
          </View>
        </View>
        <View style={styles.portalHeroMetaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              Business {formatOwnerValue(ownerProfile.businessVerificationStatus)}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              Identity {formatOwnerValue(ownerProfile.identityVerificationStatus)}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              Plan {formatOwnerValue(ownerProfile.subscriptionStatus)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.summaryStrip}>
        {profileSummaryTiles.map((tile) => (
          <View key={tile.label} style={styles.summaryTile}>
            <Text style={styles.summaryTileValue}>{tile.value}</Text>
            <Text style={styles.summaryTileLabel}>{tile.label}</Text>
            <Text style={styles.summaryTileBody}>{tile.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.detailTileGrid}>
        <View style={styles.detailTile}>
          <Text style={styles.detailTileLabel}>Legal name</Text>
          <Text style={styles.detailTileValue} numberOfLines={2} ellipsizeMode="tail">
            {ownerProfile.legalName || 'Not added'}
          </Text>
          <Text style={styles.detailTileBody}>The business name tied to this account.</Text>
        </View>
        <View style={styles.detailTile}>
          <Text style={styles.detailTileLabel}>Contact number</Text>
          <Text style={styles.detailTileValue} numberOfLines={1} ellipsizeMode="tail">
            {ownerProfile.phone || 'Not added'}
          </Text>
          <Text style={styles.detailTileBody}>The best number to reach the business.</Text>
        </View>
        <View style={styles.detailTile}>
          <Text style={styles.detailTileLabel}>Storefront connection</Text>
          <Text style={styles.detailTileValue} numberOfLines={1} ellipsizeMode="tail">
            {ownerProfile.dispensaryId ? 'Connected' : 'Not claimed yet'}
          </Text>
          <Text style={styles.detailTileBody} numberOfLines={2} ellipsizeMode="middle">
            {ownerProfile.dispensaryId ?? 'Connect your storefront to unlock live edits.'}
          </Text>
        </View>
        <View style={styles.detailTile}>
          <Text style={styles.detailTileLabel}>Next step</Text>
          <Text style={styles.detailTileValue} numberOfLines={2} ellipsizeMode="tail">
            {formatOwnerValue(ownerProfile.onboardingStep)}
          </Text>
          <Text style={styles.detailTileBody}>Where you left off in setup.</Text>
        </View>
      </View>
    </View>
  );
}
