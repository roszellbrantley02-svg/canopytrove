import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import type { StorefrontActivePromotion } from '../../types/storefront';
import { formatStorefrontPromotionExpiry } from '../../utils/storefrontPromotions';
import { styles } from './storefrontDetailStyles';

function splitHoursLine(line: string) {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) {
    return {
      day: 'Hours',
      value: line,
    };
  }

  return {
    day: line.slice(0, separatorIndex).trim(),
    value: line.slice(separatorIndex + 1).trim(),
  };
}

export function DetailOfficialRecordCard({ error }: { error: string | null }) {
  return (
    <SectionCard
      title="Official storefront record"
      body={
        error
          ? 'Canopy Trove could not refresh the live detail state right now. The official storefront listing is still available.'
          : 'Canopy Trove shows the official storefront record first, then layers richer public detail when it is available.'
      }
    >
      <CustomerStateCard
        title="Official record remains visible"
        body="The official listing stays visible as the baseline."
        tone="warm"
        iconName="shield-checkmark-outline"
        eyebrow="Fallback state"
        note="The verified record stays visible even without live data."
      />
    </SectionCard>
  );
}

export function DetailLiveUpdateUnavailableCard() {
  return (
    <SectionCard
      title="Live update unavailable"
      body="Showing the storefront details currently available on-device while live refresh catches up."
    >
      <CustomerStateCard
        title="Using the last available detail state"
        body="Showing cached hours, website, and review data until refresh."
        tone="info"
        iconName="cloud-offline-outline"
        eyebrow="Unavailable right now"
        note="Detail screen stays usable while refresh catches up."
      />
    </SectionCard>
  );
}

export function DetailStoreSummarySection({
  editorialSummary,
  displayAmenities,
}: {
  editorialSummary: string | null;
  displayAmenities: string[];
}) {
  return (
    <SectionCard
      title="Storefront summary"
      body={editorialSummary || 'Official summary and amenities for this storefront.'}
    >
      <View style={styles.amenityWrap}>
        {displayAmenities.map((amenity) => (
          <View key={amenity} style={styles.amenityChip}>
            <Text numberOfLines={1} style={styles.amenityText}>
              {amenity}
            </Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

export function DetailHoursSection({ hours }: { hours: string[] }) {
  return (
    <SectionCard title="Hours" body="Official business hours from the detail payload.">
      <View style={styles.listBlock}>
        {hours.map((line) => {
          const { day, value } = splitHoursLine(line);
          const isClosed = value.toLowerCase().includes('closed');

          return (
            <View key={line} style={styles.hoursCard}>
              <Text numberOfLines={1} style={styles.hoursDay}>
                {day}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.hoursValue, isClosed && styles.hoursValueMuted]}
              >
                {value}
              </Text>
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

function getPromotionToneLabel(cardTone: StorefrontActivePromotion['cardTone']) {
  switch (cardTone) {
    case 'hot_deal':
      return 'Hot deal';
    case 'owner_featured':
      return 'Owner featured';
    default:
      return 'Live deal';
  }
}

function DetailLockedMemberActions({
  onOpenMemberSignIn,
  onOpenMemberSignUp,
}: {
  onOpenMemberSignIn: () => void;
  onOpenMemberSignUp: () => void;
}) {
  return (
    <View style={styles.ctaRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in to unlock member-only storefront content"
        accessibilityHint="Opens the sign in screen."
        onPress={onOpenMemberSignIn}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Sign In</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create an account to unlock member-only storefront content"
        accessibilityHint="Opens the account creation screen."
        onPress={onOpenMemberSignUp}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Create Account</Text>
      </Pressable>
    </View>
  );
}

export function DetailLiveDealsSection({
  promotions,
}: {
  promotions: StorefrontActivePromotion[];
}) {
  const body =
    promotions.length === 1
      ? 'This owner-posted promotion is live on the storefront right now.'
      : `${promotions.length} owner-posted promotions are live on this storefront right now.`;

  return (
    <SectionCard title="Live deals" body={body}>
      <View style={styles.liveDealsList}>
        {promotions.map((promotion) => {
          const expiryLabel = formatStorefrontPromotionExpiry(promotion.endsAt);
          const toneLabel = getPromotionToneLabel(promotion.cardTone);

          return (
            <View key={promotion.id} style={styles.liveDealCard}>
              <View style={styles.liveDealHeader}>
                <View style={styles.liveDealTitleWrap}>
                  <Text numberOfLines={2} style={styles.liveDealTitle}>
                    {promotion.title}
                  </Text>
                  <Text numberOfLines={3} style={styles.liveDealDescription}>
                    {promotion.description}
                  </Text>
                </View>
                <View style={styles.liveDealMetaColumn}>
                  <View style={styles.liveDealToneChip}>
                    <Text numberOfLines={1} style={styles.liveDealToneChipText}>
                      {toneLabel}
                    </Text>
                  </View>
                  {expiryLabel ? (
                    <View style={styles.liveDealExpiryChip}>
                      <Text numberOfLines={1} style={styles.liveDealExpiryChipText}>
                        {expiryLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {promotion.badges.length ? (
                <View style={styles.liveDealBadgeWrap}>
                  {promotion.badges.slice(0, 5).map((badge) => (
                    <View key={`${promotion.id}-${badge}`} style={styles.liveDealBadge}>
                      <Text numberOfLines={1} style={styles.liveDealBadgeText}>
                        {badge}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

export function DetailLockedLiveDealsSection({
  liveDealCount,
  onOpenMemberSignIn,
  onOpenMemberSignUp,
}: {
  liveDealCount: number;
  onOpenMemberSignIn: () => void;
  onOpenMemberSignUp: () => void;
}) {
  const body =
    liveDealCount === 1
      ? 'This storefront has a live owner-posted promotion, but the offer details are reserved for members.'
      : `This storefront has ${liveDealCount} live owner-posted promotions, but the offer details are reserved for members.`;

  return (
    <SectionCard title="Live deals" body={body}>
      <CustomerStateCard
        title={
          liveDealCount === 1
            ? 'One live deal is waiting.'
            : `${liveDealCount} live deals are waiting.`
        }
        body="Sign in to see deal details, timing, and stacked promotions."
        tone="warm"
        iconName="lock-closed-outline"
        eyebrow="Members only"
        note="Guests can browse. Deal details unlock with a member account."
      >
        <DetailLockedMemberActions
          onOpenMemberSignIn={onOpenMemberSignIn}
          onOpenMemberSignUp={onOpenMemberSignUp}
        />
      </CustomerStateCard>
    </SectionCard>
  );
}
