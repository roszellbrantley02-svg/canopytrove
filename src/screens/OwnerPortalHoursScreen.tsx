import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { ownerPortalStyles as sharedStyles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';
import type { OwnerHoursEntry } from '../types/ownerPortal';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

type OwnerPortalHoursRoute = RouteProp<RootStackParamList, 'OwnerPortalHours'>;

const DAYS: OwnerHoursEntry['day'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const SHORT_DAY: Record<OwnerHoursEntry['day'], string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const TIME_OPTIONS = [
  '6:00 AM',
  '7:00 AM',
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
  '7:00 PM',
  '8:00 PM',
  '9:00 PM',
  '10:00 PM',
  '11:00 PM',
  '12:00 AM',
  '1:00 AM',
  '2:00 AM',
];

function buildDefaultHours(): OwnerHoursEntry[] {
  return DAYS.map((day) => ({
    day,
    open: '9:00 AM',
    close: '9:00 PM',
    closed: false,
  }));
}

function DayRow({
  entry,
  onToggleClosed,
  onChangeOpen,
  onChangeClose,
}: {
  entry: OwnerHoursEntry;
  onToggleClosed: () => void;
  onChangeOpen: (time: string) => void;
  onChangeClose: (time: string) => void;
}) {
  return (
    <View style={hourStyles.dayRow}>
      <View style={hourStyles.dayLabelWrap}>
        <Text style={hourStyles.dayLabel}>{SHORT_DAY[entry.day]}</Text>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`${entry.day} ${entry.closed ? 'closed' : 'open'}`}
        accessibilityState={{ checked: !entry.closed }}
        onPress={onToggleClosed}
        style={hourStyles.closedToggle}
      >
        <View style={entry.closed ? hourStyles.toggleOff : hourStyles.toggleOn}>
          <View style={hourStyles.toggleThumb} />
        </View>
      </Pressable>

      {entry.closed ? (
        <Text style={hourStyles.closedLabel}>Closed</Text>
      ) : (
        <View style={hourStyles.timePickers}>
          <TimePicker
            value={entry.open ?? '9:00 AM'}
            onChange={onChangeOpen}
            label={`${entry.day} open time`}
          />
          <Text style={hourStyles.timeSeparator}>{'\u2013'}</Text>
          <TimePicker
            value={entry.close ?? '9:00 PM'}
            onChange={onChangeClose}
            label={`${entry.day} close time`}
          />
        </View>
      )}
    </View>
  );
}

function TimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (time: string) => void;
  label: string;
}) {
  const currentIndex = TIME_OPTIONS.indexOf(value);

  const cycleTime = React.useCallback(
    (direction: 1 | -1) => {
      const nextIndex = (currentIndex + direction + TIME_OPTIONS.length) % TIME_OPTIONS.length;
      onChange(TIME_OPTIONS[nextIndex]);
    },
    [currentIndex, onChange],
  );

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      style={hourStyles.timePicker}
    >
      <Pressable
        accessibilityLabel="Earlier"
        onPress={() => cycleTime(-1)}
        hitSlop={8}
        style={[hourStyles.timeArrow, hourStyles.timeArrowFlipped]}
      >
        <AppUiIcon name="chevron-down" size={14} color={colors.textSoft} />
      </Pressable>
      <Text style={hourStyles.timeValue}>{value}</Text>
      <Pressable
        accessibilityLabel="Later"
        onPress={() => cycleTime(1)}
        hitSlop={8}
        style={hourStyles.timeArrow}
      >
        <AppUiIcon name="chevron-down" size={14} color={colors.textSoft} />
      </Pressable>
    </View>
  );
}

export function OwnerPortalHoursScreen() {
  const _route = useRoute<OwnerPortalHoursRoute>();
  const preview = false;
  const { workspace, isLoading, isSaving, errorText, saveProfileTools } =
    useOwnerPortalWorkspace(preview);

  const existingHours = workspace?.profileTools?.ownerHours ?? null;
  const [hours, setHours] = React.useState<OwnerHoursEntry[]>(
    existingHours?.length ? existingHours : buildDefaultHours(),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Sync with workspace when it loads
  const existingKey = JSON.stringify(existingHours);
  React.useEffect(() => {
    if (existingHours?.length) {
      setHours(existingHours);
      setHasUnsavedChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when serialized key changes
  }, [existingKey]);

  const updateDay = React.useCallback((dayIndex: number, patch: Partial<OwnerHoursEntry>) => {
    setHours((prev) => prev.map((entry, i) => (i === dayIndex ? { ...entry, ...patch } : entry)));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!workspace?.profileTools) return;
    saveProfileTools({
      ...workspace.profileTools,
      ownerHours: hours,
    });
    setHasUnsavedChanges(false);
  }, [workspace?.profileTools, hours, saveProfileTools]);

  if (isLoading) {
    return (
      <ScreenShell
        eyebrow="Owner Portal"
        title="Business Hours"
        subtitle="Loading your hours..."
        headerPill="Hours"
      />
    );
  }

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business Hours"
      subtitle="Set your dispensary's hours of operation. These override any third-party data and stay published even if your plan lapses."
      headerPill="Hours"
    >
      <ScrollView contentContainerStyle={sharedStyles.form}>
        {errorText ? <InlineFeedbackPanel title="Error" tone="danger" body={errorText} /> : null}

        <MotionInView delay={70}>
          <SectionCard
            title="Weekly schedule"
            body="Toggle each day open or closed and set your hours. Changes persist until you update them."
          >
            <View style={hourStyles.dayList}>
              {hours.map((entry, index) => (
                <DayRow
                  key={entry.day}
                  entry={entry}
                  onToggleClosed={() => updateDay(index, { closed: !entry.closed })}
                  onChangeOpen={(time) => updateDay(index, { open: time })}
                  onChangeClose={(time) => updateDay(index, { close: time })}
                />
              ))}
            </View>
          </SectionCard>
        </MotionInView>

        <MotionInView delay={140}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save hours"
            accessibilityState={{ disabled: isSaving || !hasUnsavedChanges }}
            disabled={isSaving || !hasUnsavedChanges}
            onPress={handleSave}
            style={[
              sharedStyles.primaryButton,
              (isSaving || !hasUnsavedChanges) && hourStyles.buttonDisabled,
            ]}
          >
            <Text style={sharedStyles.primaryButtonText}>
              {isSaving ? 'Saving...' : 'Save Hours'}
            </Text>
          </Pressable>
        </MotionInView>
      </ScrollView>
    </ScreenShell>
  );
}

const hourStyles = StyleSheet.create({
  dayList: {
    gap: spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  dayLabelWrap: {
    width: 36,
  },
  dayLabel: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  closedToggle: {
    minWidth: 40,
    minHeight: 48,
    justifyContent: 'center',
  },
  toggleOn: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  toggleOff: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceGlass,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.text,
  },
  closedLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
    flex: 1,
  },
  timePickers: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timePicker: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
  },
  timeArrow: {
    minHeight: 24,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeArrowFlipped: {
    transform: [{ rotate: '180deg' }],
  },
  timeValue: {
    ...textStyles.caption,
    color: colors.text,
  },
  timeSeparator: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
