import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import type {
  OwnerPortalLicenseComplianceInput,
  OwnerPortalWorkspaceDocument,
} from '../../types/ownerPortal';
import { useOwnerPortalLicenseCompliance } from './useOwnerPortalLicenseCompliance';
import { useOwnerPortalLicenseComplianceDraft } from './useOwnerPortalLicenseComplianceDraft';

type Props = {
  workspace: OwnerPortalWorkspaceDocument | null;
  isSaving?: boolean;
  onSave?: (input: OwnerPortalLicenseComplianceInput) => Promise<unknown>;
};

function normalizeDateInput(value: string) {
  return value.trim();
}

export function OwnerPortalLicenseComplianceCard({ workspace, isSaving = false, onSave }: Props) {
  const { buildSaveInput, draft, hasChanges, resetDraft, setDraftField } =
    useOwnerPortalLicenseComplianceDraft(workspace);
  const compliance = useOwnerPortalLicenseCompliance(workspace);
  const licenseNumber = workspace?.licenseCompliance?.licenseNumber ?? 'Waiting';
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const handleSave = React.useCallback(async () => {
    if (!onSave || !hasChanges || isSaving) {
      return;
    }

    setErrorText(null);
    try {
      await onSave(buildSaveInput());
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to save license details.');
    }
  }, [buildSaveInput, hasChanges, isSaving, onSave]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>License renewal tracker</Text>
          <Text style={styles.title}>{compliance.licenseIdentityLabel}</Text>
          <Text style={styles.body}>{compliance.statusBody}</Text>
        </View>
        <View
          style={[
            styles.statusPill,
            compliance.stage === 'expired'
              ? styles.statusPillDanger
              : compliance.stage === 'urgent'
                ? styles.statusPillWarning
                : compliance.stage === 'renewal_window_open'
                  ? styles.statusPillInfo
                  : styles.statusPillSuccess,
          ]}
        >
          <AppUiIcon
            name={
              compliance.stage === 'expired'
                ? 'warning-outline'
                : compliance.stage === 'urgent'
                  ? 'flash-outline'
                  : 'shield-checkmark-outline'
            }
            size={16}
            color="#0B1116"
          />
          <Text style={styles.statusPillText}>{compliance.statusLabel}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <LinearGradient
          colors={['rgba(245, 200, 106, 0.18)', 'rgba(245, 200, 106, 0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.metricCard}
        >
          <Text style={styles.metricLabel}>License number</Text>
          <Text style={styles.metricValue}>{licenseNumber}</Text>
          <Text style={styles.metricCaption}>Business license ID</Text>
        </LinearGradient>

        <LinearGradient
          colors={['rgba(0, 245, 140, 0.14)', 'rgba(0, 245, 140, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.metricCard}
        >
          <Text style={styles.metricLabel}>Expires at</Text>
          <Text style={styles.metricValue}>{compliance.primaryMetricValue}</Text>
          <Text style={styles.metricCaption}>{compliance.statusLabel}</Text>
        </LinearGradient>

        <LinearGradient
          colors={['rgba(142, 220, 255, 0.16)', 'rgba(142, 220, 255, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.metricCard}
        >
          <Text style={styles.metricLabel}>Renewal window</Text>
          <Text style={styles.metricValue}>{compliance.secondaryMetricValue}</Text>
          <Text style={styles.metricCaption}>{compliance.renewalWindowLabel}</Text>
        </LinearGradient>

        <LinearGradient
          colors={['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.metricCard}
        >
          <Text style={styles.metricLabel}>Last reminder</Text>
          <Text style={styles.metricValue}>
            {compliance.lastReminderLabel.replace('Last reminder: ', '')}
          </Text>
          <Text style={styles.metricCaption}>Reminder cadence</Text>
        </LinearGradient>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Renewal progress</Text>
          <Text style={styles.progressValue}>{Math.round(compliance.progress)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(6, compliance.progress)}%` }]} />
        </View>
      </View>

      <View style={styles.editorBlock}>
        <View style={styles.editorHeader}>
          <View style={styles.editorHeaderCopy}>
            <Text style={styles.sectionLabel}>Renewal record</Text>
            <Text style={styles.editorTitle}>
              Save the license dates the scheduler should track
            </Text>
            <Text style={styles.editorBody}>
              Store the license number, key renewal dates, and follow-up notes here. The reminder
              sweep uses these fields to track the 120-day and 60-day New York renewal windows.
            </Text>
          </View>
          <AppUiIcon name="create-outline" size={18} color="#F5C86A" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>License number</Text>
          <TextInput
            value={draft.licenseNumber}
            onChangeText={(value) => setDraftField('licenseNumber', value)}
            placeholder="OCM-XXXX"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="characters"
            style={styles.inputPremium}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>License type</Text>
          <TextInput
            value={draft.licenseType}
            onChangeText={(value) => setDraftField('licenseType', value)}
            placeholder="Adult-use retail dispensary"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="words"
            style={styles.inputPremium}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Issued at</Text>
          <TextInput
            value={draft.issuedAt}
            onChangeText={(value) => setDraftField('issuedAt', normalizeDateInput(value))}
            placeholder="YYYY-MM-DD or ISO string"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            style={styles.inputPremium}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Expires at</Text>
          <TextInput
            value={draft.expiresAt}
            onChangeText={(value) => setDraftField('expiresAt', normalizeDateInput(value))}
            placeholder="YYYY-MM-DD or ISO string"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            style={styles.inputPremium}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Renewal submitted at</Text>
          <TextInput
            value={draft.renewalSubmittedAt}
            onChangeText={(value) => setDraftField('renewalSubmittedAt', normalizeDateInput(value))}
            placeholder="Leave blank until submitted"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            style={styles.inputPremium}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            value={draft.notes}
            onChangeText={(value) => setDraftField('notes', value)}
            placeholder="Renewal notes, reminders, or internal follow-up"
            placeholderTextColor={colors.textSoft}
            multiline
            style={[styles.inputPremium, styles.textAreaPremium]}
          />
        </View>

        {errorText ? <Text style={styles.helperText}>{errorText}</Text> : null}
        {hasChanges ? (
          <Text style={styles.helperText}>You have unsaved renewal changes.</Text>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => {
              void handleSave();
            }}
            style={[styles.primaryButton, (!hasChanges || isSaving) && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Saving…' : 'Save renewal record'}
            </Text>
          </Pressable>
          <Pressable
            onPress={resetDraft}
            style={[styles.secondaryButton, (!hasChanges || isSaving) && styles.buttonDisabled]}
          >
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.timelineGrid}>
        {[
          { label: 'Last update', value: compliance.lastUpdatedLabel },
          { label: 'Last reminder', value: compliance.lastReminderLabel },
          { label: 'Next action', value: compliance.nextActionLabel },
        ].map((item) => (
          <View key={item.label} style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>{item.label}</Text>
            <Text style={styles.timelineValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.checklistBlock}>
        <Text style={styles.checklistTitle}>{compliance.nextActionLabel}</Text>
        <Text style={styles.checklistBody}>{compliance.nextActionBody}</Text>
        <View style={styles.checklistList}>
          {compliance.checklist.map((item) => (
            <View key={item.id} style={styles.checklistItem}>
              <View
                style={[
                  styles.checkIcon,
                  item.completed ? styles.checkIconComplete : styles.checkIconPending,
                ]}
              >
                <AppUiIcon
                  name={item.completed ? 'checkmark-circle-outline' : 'radio-button-off-outline'}
                  size={14}
                  color={item.completed ? '#0B1116' : colors.textMuted}
                />
              </View>
              <View style={styles.checkCopy}>
                <Text style={styles.checkLabel}>{item.label}</Text>
                <Text style={styles.checkDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '900',
    lineHeight: 30,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusPillSuccess: {
    backgroundColor: '#00F58C',
  },
  statusPillInfo: {
    backgroundColor: '#8EDCFF',
  },
  statusPillWarning: {
    backgroundColor: '#F5C86A',
  },
  statusPillDanger: {
    backgroundColor: '#FF9F92',
  },
  statusPillText: {
    color: '#0B1116',
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 108,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  metricLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '900',
  },
  metricCaption: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  progressBlock: {
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  progressValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  progressTrack: {
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: '#F5C86A',
  },
  editorBlock: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: spacing.lg,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  editorHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  editorTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  editorBody: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputPremium: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  textAreaPremium: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  primaryButtonText: {
    color: '#0B1116',
    fontSize: typography.body,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  timelineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timelineItem: {
    flexBasis: '31%',
    flexGrow: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceGlass,
    padding: spacing.md,
    gap: 4,
  },
  timelineLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timelineValue: {
    color: colors.text,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  checklistBlock: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  checklistTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  checklistBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  checklistList: {
    gap: spacing.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkIconComplete: {
    backgroundColor: '#00F58C',
  },
  checkIconPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  checkCopy: {
    flex: 1,
    gap: 2,
  },
  checkLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  checkDetail: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
