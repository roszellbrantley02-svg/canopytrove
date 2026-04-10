import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import type { StorefrontActivePromotion } from '../../types/storefront';
import { getUSHolidayInfo } from '../../utils/holidayUtils';
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
      title="Basic storefront details"
      body={
        error
          ? 'We could not refresh the latest storefront details right now, but the basic listing is still here.'
          : 'The basic storefront listing stays visible while extra details load.'
      }
    >
      <CustomerStateCard
        title="Basic listing still available"
        body="You can still view the storefront listing while the rest of the details catch up."
        tone="warm"
        iconName="shield-checkmark-outline"
        eyebrow="Still available"
        note="The storefront page stays usable even when extra details are not ready yet."
      />
    </SectionCard>
  );
}

export function DetailLiveUpdateUnavailableCard() {
  return (
    <SectionCard
      title="Latest details unavailable"
      body="Showing the storefront details already on your device while the latest refresh catches up."
    >
      <CustomerStateCard
        title="Showing the last available details"
        body="Hours, website, and reviews will refresh when the connection catches up."
        tone="info"
        iconName="cloud-offline-outline"
        eyebrow="Unavailable right now"
        note="You can keep using this page while the newest details load."
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
      title="About this storefront"
      body={editorialSummary || 'Highlights and amenities for this storefront.'}
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
  const holiday = getUSHolidayInfo();

  return (
    <SectionCard
      title="Hours"
      body={
        holiday
          ? `${holiday.name} today \u2014 hours may differ from the regular schedule.`
          : 'Store hours listed for this storefront.'
      }
    >
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
  const isAndroid = Platform.OS === 'android';

  switch (cardTone) {
    case 'hot_deal':
      return isAndroid ? 'Featured update' : 'Hot deal';
    case 'owner_featured':
      return 'Featured';
    default:
      return isAndroid ? 'Recent update' : 'Live deal';
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
  const isAndroid = Platform.OS === 'android';
  const body =
    promotions.length === 1
      ? isAndroid
        ? 'This storefront has one recent update right now.'
        : 'This storefront has one live deal right now.'
      : isAndroid
        ? `This storefront has ${promotions.length} recent updates right now.`
        : `This storefront has ${promotions.length} live deals right now.`;

  return (
    <SectionCard title={isAndroid ? 'Recent updates' : 'Live deals'} body={body}>
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
  const isAndroid = Platform.OS === 'android';
  const body =
    liveDealCount === 1
      ? isAndroid
        ? 'This storefront has a recent update, but the details are only available to members.'
        : 'This storefront has a live deal, but the details are only available to members.'
      : isAndroid
        ? `This storefront has ${liveDealCount} recent updates, but the details are only available to members.`
        : `This storefront has ${liveDealCount} live deals, but the details are only available to members.`;

  return (
    <SectionCard title={isAndroid ? 'Recent updates' : 'Live deals'} body={body}>
      <CustomerStateCard
        title={
          liveDealCount === 1
            ? isAndroid
              ? 'One recent update is waiting.'
              : 'One live deal is waiting.'
            : isAndroid
              ? `${liveDealCount} recent updates are waiting.`
              : `${liveDealCount} live deals are waiting.`
        }
        body={
          isAndroid
            ? 'Sign in to see update details, timing, and the full member-only context.'
            : 'Sign in to see promotion details, timing, and stacked deals.'
        }
        tone="warm"
        iconName="lock-closed-outline"
        eyebrow="Members only"
        note={
          isAndroid
            ? 'Guests can browse. Update details unlock with a member account.'
            : 'Guests can browse. Promotion details unlock with a member account.'
        }
      >
        <DetailLockedMemberActions
          onOpenMemberSignIn={onOpenMemberSignIn}
          onOpenMemberSignUp={onOpenMemberSignUp}
        />
      </CustomerStateCard>
    </SectionCard>
  );
}
