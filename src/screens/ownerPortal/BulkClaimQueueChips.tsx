/**
 * Per-shop progress chips for the parallel claim queue (Phase 1).
 *
 * Each chip = one slot in useBulkClaimSubmission. Chips render in their
 * current phase: idle / submitting / awaitingCode (with code input) /
 * verifying / verified / failed (with escape-hatch button to the existing
 * per-shop verification screen).
 *
 * The chips deliberately DON'T re-implement the cooldown / daily_limit /
 * shop_unavailable UI from OwnerPortalShopOwnershipVerificationScreen —
 * for any hard-stop failure, the chip surfaces an "Open verification screen"
 * button that navigates to that screen with the failed storefrontId. Lets
 * us reuse the entire dedicated state machine for edge cases without
 * doubling the chip's complexity.
 */

import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { colors } from '../../theme/tokens';
import type { BulkClaimSlot } from '../../hooks/useBulkClaimSubmission';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

type Props = {
  slots: BulkClaimSlot[];
  onSubmitCode: (storefrontId: string, code: string) => void | Promise<void>;
  onResetSlot: (storefrontId: string) => void;
};

type ChipProps = {
  slot: BulkClaimSlot;
  onSubmitCode: (storefrontId: string, code: string) => void | Promise<void>;
  onResetSlot: (storefrontId: string) => void;
};

function BulkClaimQueueChip({ slot, onSubmitCode, onResetSlot }: ChipProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [code, setCode] = React.useState('');

  const phaseLabel = (() => {
    switch (slot.phase) {
      case 'idle':
        return 'Queued';
      case 'submitting':
        return 'Calling shop…';
      case 'awaitingCode':
        return 'Waiting for code';
      case 'verifying':
        return 'Verifying…';
      case 'verified':
        return 'Verified';
      case 'failed':
        return 'Needs attention';
      default:
        return '';
    }
  })();

  const phaseIconName = (() => {
    switch (slot.phase) {
      case 'verified':
        return 'checkmark-circle' as const;
      case 'failed':
        return 'alert-circle-outline' as const;
      case 'awaitingCode':
        return 'call-outline' as const;
      case 'submitting':
      case 'verifying':
        return 'time-outline' as const;
      default:
        return 'storefront-outline' as const;
    }
  })();

  const phaseIconColor =
    slot.phase === 'verified'
      ? colors.primary
      : slot.phase === 'failed'
        ? colors.danger
        : colors.gold;

  const canSubmitCode = slot.phase === 'awaitingCode' && /^\d{6}$/.test(code.trim());

  const handleOpenDedicatedScreen = () => {
    navigation.navigate('OwnerPortalShopOwnershipVerification', {
      storefrontId: slot.storefrontId,
      storefrontDisplayName: slot.displayName,
    });
  };

  return (
    <View style={styles.actionTile}>
      <View style={styles.splitHeaderRow}>
        <View style={styles.splitHeaderCopy}>
          <Text style={styles.actionTileMeta}>{phaseLabel}</Text>
          <Text style={styles.actionTileTitle}>{slot.displayName}</Text>
        </View>
        <AppUiIcon name={phaseIconName} size={20} color={phaseIconColor} />
      </View>

      {slot.phase === 'awaitingCode' ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>6-digit code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            placeholderTextColor={colors.textSoft}
            style={styles.inputPremium}
            accessibilityLabel={`Verification code for ${slot.displayName}`}
            autoComplete="one-time-code"
            maxLength={6}
          />
          {slot.errorMessage ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {slot.errorMessage}
            </Text>
          ) : (
            <Text style={styles.fieldHint}>
              Answer the shop&apos;s phone and enter the code you hear.
            </Text>
          )}
          <Pressable
            disabled={!canSubmitCode}
            onPress={() => {
              if (!canSubmitCode) return;
              void onSubmitCode(slot.storefrontId, code.trim());
              setCode('');
            }}
            style={[styles.primaryButton, !canSubmitCode && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Verify</Text>
          </Pressable>
        </View>
      ) : null}

      {slot.phase === 'failed' ? (
        <View style={styles.fieldGroup}>
          {slot.errorMessage ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {slot.errorMessage}
            </Text>
          ) : null}
          <Pressable onPress={handleOpenDedicatedScreen} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Open verification screen</Text>
          </Pressable>
          <Pressable onPress={() => onResetSlot(slot.storefrontId)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Remove from queue</Text>
          </Pressable>
        </View>
      ) : null}

      {slot.phase === 'verified' ? (
        <Text style={styles.successText}>Shop ownership verified.</Text>
      ) : null}

      {slot.phase === 'submitting' || slot.phase === 'verifying' ? (
        <Text style={styles.fieldHint}>
          {slot.phase === 'submitting'
            ? 'Placing the call now — the shop&apos;s phone will ring shortly.'
            : 'Confirming the code with the server.'}
        </Text>
      ) : null}
    </View>
  );
}

export function BulkClaimQueueChips({ slots, onSubmitCode, onResetSlot }: Props) {
  if (slots.length === 0) return null;
  return (
    <View style={styles.actionGrid}>
      {slots.map((slot) => (
        <BulkClaimQueueChip
          key={slot.storefrontId}
          slot={slot}
          onSubmitCode={onSubmitCode}
          onResetSlot={onResetSlot}
        />
      ))}
    </View>
  );
}
