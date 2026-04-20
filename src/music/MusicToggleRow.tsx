import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import { useMusicPlayer } from './MusicPlayerContext';

/**
 * Profile-screen row that lets any visitor (guest, member, or owner) turn
 * background music on or off.
 *
 * Owners see the row too, but the switch is disabled with an explanatory
 * note — music is automatically silenced while they're signed in as a
 * business account (music is a customer-experience feature).
 */
export function MusicToggleRow() {
  const { isMusicEnabled, isSuppressed, suppressionReason, setMusicEnabled } = useMusicPlayer();

  const description = (() => {
    if (suppressionReason === 'owner-signed-in') {
      return 'Background music is paused while you\u2019re signed in as an owner so the business workspace stays quiet.';
    }
    if (isMusicEnabled) {
      return 'Soft background music plays while you explore the app \u2014 including during navigation.';
    }
    return 'Background music is off. Turn it on to hear soft tracks while you browse.';
  })();

  const switchValue = isSuppressed ? false : isMusicEnabled;

  const handleToggle = React.useCallback(() => {
    if (isSuppressed) {
      return;
    }
    setMusicEnabled(!isMusicEnabled);
  }, [isSuppressed, isMusicEnabled, setMusicEnabled]);

  return (
    <SectionCard
      title="Background music"
      body="Off by default. Your choice sticks between sessions."
      iconName="sparkles-outline"
      badgeLabel="Ambient"
      tone="primary"
    >
      <View
        style={styles.row}
        accessibilityRole="switch"
        accessibilityLabel="Background music"
        accessibilityState={{ checked: switchValue, disabled: isSuppressed }}
      >
        <Pressable
          onPress={handleToggle}
          disabled={isSuppressed}
          style={({ pressed }) => [styles.copyPress, pressed && !isSuppressed && styles.pressed]}
        >
          <View style={styles.iconChip}>
            <AppUiIcon
              name={isMusicEnabled && !isSuppressed ? 'sparkles' : 'sparkles-outline'}
              size={20}
              color={isMusicEnabled && !isSuppressed ? colors.accent : colors.textMuted}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{isMusicEnabled ? 'Music on' : 'Music off'}</Text>
            <Text style={styles.body}>{description}</Text>
          </View>
        </Pressable>
        <Switch
          value={switchValue}
          disabled={isSuppressed}
          onValueChange={setMusicEnabled}
          trackColor={{ false: colors.surfaceElevated, true: colors.primaryDeep }}
          thumbColor={switchValue ? colors.accent : colors.textSoft}
          ios_backgroundColor={colors.surfaceElevated}
        />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  copyPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  body: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
