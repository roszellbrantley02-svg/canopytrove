import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CustomerStateCard } from './CustomerStateCard';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { HapticPressable } from './HapticPressable';
import type { GiphyGifResult } from '../services/giphyService';
import { AppUiIcon } from '../icons/AppUiIcon';

type GifPickerModalProps = {
  visible: boolean;
  query: string;
  results: GiphyGifResult[];
  isLoading: boolean;
  error: string | null;
  emptyText: string;
  providerText: string;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onSelectGif: (gifId: string) => void;
};

export function GifPickerModal({
  visible,
  query,
  results,
  isLoading,
  error,
  emptyText,
  providerText,
  onChangeQuery,
  onClose,
  onSelectGif,
}: GifPickerModalProps) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>Choose a GIF</Text>
              <Text style={styles.modalSubtitle}>
                Search for a reaction GIF and add it to the review.
              </Text>
            </View>
            <HapticPressable
              onPress={onClose}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close GIF picker"
              accessibilityHint="Closes the GIF selection modal."
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <AppUiIcon name="close" size={18} color={colors.text} />
            </HapticPressable>
          </View>

          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search GIFs"
            placeholderTextColor={colors.textSoft}
            style={styles.urlInput}
            accessibilityLabel="GIF search"
            accessibilityHint="Search for GIFs to add to the review."
          />

          {isLoading ? (
            <CustomerStateCard
              centered
              title="Loading GIF results"
              body="Canopy Trove is pulling reaction GIFs for this search."
              tone="info"
              iconName="images-outline"
              eyebrow="GIF search"
            >
              <View style={styles.gifLoadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.helperText}>Loading GIFs...</Text>
              </View>
            </CustomerStateCard>
          ) : null}

          {error ? (
            <CustomerStateCard
              title="GIF search is unavailable right now"
              body={error}
              tone="danger"
              iconName="alert-circle-outline"
              eyebrow="GIF search"
            />
          ) : null}

          <ScrollView
            contentContainerStyle={styles.gifGrid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {results.map((result) => (
              <HapticPressable
                key={result.id}
                hapticType="selection"
                onPress={() => onSelectGif(result.id)}
                style={styles.gifTile}
                accessibilityRole="button"
                accessibilityLabel="GIF selection"
                accessibilityHint="Selects this GIF to add to the review."
              >
                <Image source={{ uri: result.previewUrl }} style={styles.gifTileImage} />
              </HapticPressable>
            ))}
            {!isLoading && !error && results.length === 0 ? (
              <CustomerStateCard
                centered
                title="No GIFs found yet"
                body={emptyText}
                tone="neutral"
                iconName="search-outline"
                eyebrow="GIF search"
                note="Try a shorter search or a more general reaction phrase."
              />
            ) : null}
          </ScrollView>

          <Text style={styles.attributionText}>{providerText}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  modalCard: {
    maxHeight: '82%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: colors.textSoft,
    fontSize: typography.body,
    lineHeight: 20,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urlInput: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
  },
  gifLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  helperText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  gifTile: {
    width: '31%',
    aspectRatio: 1,
    minHeight: 48,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gifTileImage: {
    width: '100%',
    height: '100%',
  },
  attributionText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    textAlign: 'center',
  },
});
