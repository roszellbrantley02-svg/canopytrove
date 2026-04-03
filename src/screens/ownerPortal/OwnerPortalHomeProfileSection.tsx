import React from 'react';
import { Text, View } from 'react-native';
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
  if (isLoading) {
    return (
      <InlineFeedbackPanel
        tone="info"
        iconName="time-outline"
        label="Workspace state"
        title="Loading owner profile"
        body="Loading the current owner profile."
      />
    );
  }

  if (errorText) {
    return (
      <InlineFeedbackPanel
        tone="danger"
        iconName="alert-circle-outline"
        label="Workspace issue"
        title="Owner profile could not load"
        body={errorText}
      />
    );
  }

  if (!ownerProfile) {
    return (
      <InlineFeedbackPanel
        tone="warning"
        iconName="briefcase-outline"
        label="Workspace state"
        title="No owner profile found"
        body="Finish owner setup to unlock deals, media, and storefront tools."
      />
    );
  }

  const ownerTitle = getOwnerIdentityTitle(ownerProfile);
  const ownerSubtitle =
    ownerProfile.legalName && ownerProfile.legalName !== ownerTitle
      ? ownerProfile.legalName
      : ownerProfile.phone
        ? ownerProfile.phone
        : 'Primary owner profile';
  const storefrontState = ownerProfile.dispensaryId ? 'Connected' : 'Unclaimed';
  const storefrontBody = ownerProfile.dispensaryId
    ? ownerProfile.dispensaryId
    : 'Claim the live listing to unlock storefront controls.';
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
                <Text style={styles.sectionEyebrow}>Owner profile</Text>
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
            <Text style={styles.badgeText}>Owner level {ownerProfile.badgeLevel}</Text>
          </View>
        </View>
        <Text style={styles.portalHeroBody}>
          Track verification, storefront connection, and plan status from one owner profile.
        </Text>
        <View style={styles.ownerProfileStatusGrid}>
          <View style={styles.ownerProfileStatusCard}>
            <Text style={styles.ownerProfileStatusValue}>
              {formatOwnerValue(ownerProfile.businessVerificationStatus)}
            </Text>
            <Text style={styles.ownerProfileStatusLabel}>Business status</Text>
            <Text style={styles.ownerProfileStatusBody}>Company verification on file.</Text>
          </View>
          <View style={styles.ownerProfileStatusCard}>
            <Text style={styles.ownerProfileStatusValue}>
              {formatOwnerValue(ownerProfile.identityVerificationStatus)}
            </Text>
            <Text style={styles.ownerProfileStatusLabel}>Identity status</Text>
            <Text style={styles.ownerProfileStatusBody}>Authorized operator verification.</Text>
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
          <Text style={styles.detailTileBody}>Business identity on file.</Text>
        </View>
        <View style={styles.detailTile}>
          <Text style={styles.detailTileLabel}>Contact line</Text>
          <Text style={styles.detailTileValue} numberOfLines={1} ellipsizeMode="tail">
            {ownerProfile.phone || 'Not added'}
          </Text>
          <Text style={styles.detailTileBody}>Primary owner contact.</Text>
        </View>
        <View style={styles.detailTile}>
          <Text style={styles.detailTileLabel}>Storefront link</Text>
          <Text style={styles.detailTileValue} numberOfLines={1} ellipsizeMode="tail">
            {ownerProfile.dispensaryId ? 'Connected' : 'Not claimed yet'}
          </Text>
          <Text style={styles.detailTileBody} numberOfLines={2} ellipsizeMode="middle">
            {ownerProfile.dispensaryId ?? 'Claim the listing to unlock live storefront control.'}
          </Text>
        </View>
        <View style={styles.detailTile}>
          <Text style={styles.detailTileLabel}>Setup step</Text>
          <Text style={styles.detailTileValue} numberOfLines={2} ellipsizeMode="tail">
            {formatOwnerValue(ownerProfile.onboardingStep)}
          </Text>
          <Text style={styles.detailTileBody}>Current owner setup step.</Text>
        </View>
      </View>
    </View>
  );
}
