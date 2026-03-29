import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchIcon } from '../icons/AppIcons';
import { LayeredAppIcon } from '../icons/LayeredAppIcon';
import { colors, radii, spacing, typography } from '../theme/tokens';

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
};

function SearchFieldComponent({ value, onChangeText, placeholder, onSubmitEditing }: SearchFieldProps) {
  return (
    <View style={styles.shell}>
      <LayeredAppIcon icon={SearchIcon} size={18} outlineStroke={3.1} fillStroke={1.55} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={styles.input}
        selectionColor={colors.primary}
        returnKeyType="search"
      />
      {value.trim() ? (
        <Pressable onPress={() => onChangeText('')} style={styles.clearButton}>
          <Ionicons name="close" size={14} color={colors.text} />
        </Pressable>
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
