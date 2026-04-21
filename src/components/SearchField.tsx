import React from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { HapticPressable } from './HapticPressable';
import { AppUiIcon } from '../icons/AppUiIcon';
import { SearchGlyphIconV4c as SearchGlyphIcon } from '../icons/ProvidedGlyphIconsV4c';
import { colors, spacing, typography } from '../theme/tokens';

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
  isActive?: boolean;
  testID?: string;
};

function SearchFieldComponent({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  isActive,
  testID,
}: SearchFieldProps) {
  const inputRef = React.useRef<TextInput>(null);

  const handleSubmitEditing = React.useCallback(() => {
    Keyboard.dismiss();
    inputRef.current?.blur();
    onSubmitEditing?.();
  }, [onSubmitEditing]);

  return (
    <View testID={testID} style={[styles.shell, isActive && styles.shellActive]}>
      <SearchGlyphIcon size={18} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={handleSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={styles.input}
        selectionColor={colors.primary}
        returnKeyType="search"
        accessibilityLabel="Search"
        accessibilityHint={`Enter search term, ${placeholder.toLowerCase()}`}
      />
      {value.trim() ? (
        <HapticPressable
          hapticType="selection"
          onPress={() => onChangeText('')}
          style={styles.clearButton}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          accessibilityHint="Clears the current search query."
          hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
        >
          <AppUiIcon name="close" size={14} color={colors.text} />
        </HapticPressable>
      ) : null}
    </View>
  );
}

export const SearchField = React.memo(SearchFieldComponent);

const styles = StyleSheet.create({
  shell: {
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: colors.surfaceGlassStrong,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  shellActive: {
    borderColor: 'rgba(245, 200, 106, 0.42)',
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    paddingVertical: spacing.md,
  },
  clearButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
