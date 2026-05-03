import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon, type AppUiIconName } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { listOwnerInventory, type OwnerInventoryItem } from '../services/aiInventoryService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

/**
 * AI Inventory hub. Lists the owner's menu items and surfaces three
 * AI-powered actions:
 *   - Add product (scan a single product → catalog entry → menu item)
 *   - Receive shipment (two-step box + unit scan)
 *   - End-of-day reconcile (photo of receipts/POS summary)
 *
 * Spec: docs/AI_INVENTORY.md.
 *
 * Phase 1.7 status: SCAFFOLD — UI is wired, real backend calls land
 * in tomorrow's chunk. Until then `listOwnerInventory()` will throw,
 * which we surface as a friendly empty-state.
 */
function OwnerPortalInventoryScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = React.useState<OwnerInventoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const loadInventory = React.useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);
    try {
      const result = await listOwnerInventory();
      setItems(result.items);
    } catch (error) {
      reportRuntimeError(error, {
        source: 'inventory-list',
        screen: 'OwnerPortalInventory',
      });
      // Phase 1.7 SCAFFOLD: backend throws not_implemented. Surface the
      // empty state instead of an alarming error. Real loading will
      // wire in once the service layer fills in.
      setItems([]);
      setErrorText(
        error instanceof Error && error.message.includes('not implemented')
          ? null
          : error instanceof Error
            ? error.message
            : "We couldn't load your inventory.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Inventory"
      subtitle="Build your menu by scanning products. Reconcile end-of-day with one photo."
      headerPill="AI Inventory"
    >
      {/* Three primary actions, side by side. Same scan camera infrastructure
          powers all three; each just sets a different mode prop. */}
      <MotionInView delay={120}>
        <SectionCard
          title="Quick actions"
          body="Snap a photo. Our AI reads the package label, COA QR, lot number, and weight — then adds the product to your menu."
        >
          <View style={localStyles.actionStack}>
            <ActionRow
              iconName="sparkles-outline"
              title="Add product"
              body="Scan one product on your shelf. AI reads the label and adds it to your menu."
              onPress={() => navigation.navigate('OwnerPortalScanProduct', undefined)}
            />
            <ActionRow
              iconName="archive-outline"
              title="Receive shipment"
              body="Just got a wholesale case in? Scan the box, then one unit. We do the math."
              onPress={() => navigation.navigate('OwnerPortalReceiveShipment', undefined)}
            />
            <ActionRow
              iconName="document-text-outline"
              title="End-of-day reconcile"
              body="Snap your POS summary or a stack of receipts. We decrement the right items."
              onPress={() => navigation.navigate('OwnerPortalReconcileReceipt', undefined)}
            />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={160}>
        <SectionCard
          title="Your menu"
          body="Everything you've added so far. Tap an item to edit price, mark sold out, or see the change history."
        >
          {isLoading ? (
            <View style={styles.sectionStack}>
              <ActivityIndicator size="large" color="#2ECC71" />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.sectionStack}>
              <Text style={styles.fieldHint}>
                No items yet. Tap "Add product" above to scan your first one.
              </Text>
            </View>
          ) : (
            <View style={localStyles.itemStack}>
              {items.map((item) => (
                <ItemRow key={item.itemId} item={item} />
              ))}
            </View>
          )}
          {errorText ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {errorText}
            </Text>
          ) : null}
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

function ActionRow({
  iconName,
  title,
  body,
  onPress,
}: {
  iconName: AppUiIconName;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={localStyles.actionRow}
    >
      <View style={localStyles.actionIconWrap}>
        <AppUiIcon name={iconName} size={20} color="#2ECC71" />
      </View>
      <View style={localStyles.actionCopy}>
        <Text style={localStyles.actionTitle}>{title}</Text>
        <Text style={localStyles.actionBody}>{body}</Text>
      </View>
      <AppUiIcon name="chevron-forward" size={18} color="#C4B8B0" />
    </Pressable>
  );
}

function ItemRow({ item }: { item: OwnerInventoryItem }) {
  return (
    <View style={localStyles.itemRow}>
      <View style={localStyles.itemRowCopy}>
        {/* SCAFFOLD: catalogId surrogate; phase 1.7 fill-in joins against
            productCatalog so brand+productName render here. */}
        <Text style={localStyles.itemTitle}>{item.catalogId}</Text>
        <Text style={localStyles.itemMeta}>
          ${item.retailPrice.toFixed(2)} · {item.stockLevel} in stock
        </Text>
      </View>
      <View
        style={[
          localStyles.itemBadge,
          item.isInStock ? localStyles.itemBadgeInStock : localStyles.itemBadgeSoldOut,
        ]}
      >
        <Text
          style={[
            localStyles.itemBadgeText,
            item.isInStock ? localStyles.itemBadgeInStockText : localStyles.itemBadgeSoldOutText,
          ]}
        >
          {item.isInStock ? 'In stock' : 'Sold out'}
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  actionStack: {
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.18)',
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: '#FFFBF7',
    fontSize: 14,
    fontWeight: '600',
  },
  actionBody: {
    color: '#C4B8B0',
    fontSize: 12,
    lineHeight: 16,
  },
  itemStack: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 12,
  },
  itemRowCopy: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    color: '#FFFBF7',
    fontSize: 14,
    fontWeight: '500',
  },
  itemMeta: {
    color: '#C4B8B0',
    fontSize: 12,
  },
  itemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemBadgeInStock: {
    backgroundColor: 'rgba(46, 204, 113, 0.18)',
  },
  itemBadgeSoldOut: {
    backgroundColor: 'rgba(196, 184, 176, 0.18)',
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemBadgeInStockText: {
    color: '#2ECC71',
  },
  itemBadgeSoldOutText: {
    color: '#C4B8B0',
  },
});

const OwnerPortalInventoryScreen = withScreenErrorBoundary(
  OwnerPortalInventoryScreenInner,
  'owner-portal-inventory',
);
export default OwnerPortalInventoryScreen;
