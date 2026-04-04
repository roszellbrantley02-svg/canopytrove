# UI Polish Patterns for Canopy Trove

Research-backed best practices (2025-2026) for React Native/Expo dispensary discovery app.

## 1. Touch Targets & Spacing
- Minimum 48x48 dp (cross-platform compliant: Apple 44pt, Google 48dp)
- Use `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` on Pressable
- Spacing scale: xs:4, sm:8, md:12, lg:16, xl:24, xxl:32, xxxl:48
- Always account for safe areas on notched devices

## 2. Animation (Reanimated 3)
- All animations run on native UI thread via worklets — consistent 60fps
- Spring presets: Quick (damping:10, stiffness:200), Bouncy (damping:6, stiffness:150), Weighty (damping:12, mass:1.2, stiffness:100)
- Use `FadeInDown.springify()` for list item entrance, `Layout.springify()` for layout changes
- Gesture Handler integration: `Gesture.Pan()` with `withDecay()` for velocity-based animations
- Shared element transitions available but experimental

## 3. Typography
- Heading: SpaceGrotesk (Bold, Medium)
- Body: DM Sans (Regular, Medium)
- Scale: display1:48, h1:32, h2:28, h3:24, h4:20, bodyLarge:18, body:16, bodySmall:14, label:12, caption:12
- Line height: 1.4-1.6x font size for body, tighter for headlines
- Letter spacing: -0.25 for headlines, 0.1-0.5 for labels
- Cap font scaling at 1.3x with `maxFontSizeMultiplier={1.3}`
- Custom fonts don't auto-scale with Dynamic Type — multiply by `fontScale` from `useWindowDimensions()`

## 4. Color & Theming
- Background: `#121614`, Surface: `#1A1F1C` / `#232A26` / `#2E3631`
- Text: primary `#FFFBF7` (13.2:1 contrast), secondary `#C4B8B0` (7.1:1)
- Accent green: `#2ECC71`, Gold: `#E8A000`
- States: success `#27AE60`, warning `#F39C12`, error `#E74C3C`, info `#3498DB`
- Borders: `#2E3631` / `#3A4238`
- Dark mode via `useColorScheme()` + ThemeContext
- PlatformColor for native-adaptive colors

## 5. Loading States
- Skeleton screens for predictable layouts (storefront cards, lists)
- Spinners for uncertain content shapes
- Shimmer via Reanimated `withRepeat(withTiming(...))` + LinearGradient
- Optimistic UI for favorites — immediate toggle, revert on failure

## 6. Error States
- ErrorBoundary with FallbackComponent wrapping feature sections
- Empty state components with illustration, title, description, CTA
- Retry with exponential backoff: 1s, 2s, 4s (max 3 retries)
- Offline indicator bar with `NetInfo.addEventListener()`

## 7. Platform-Specific Polish
- `useSafeAreaInsets()` for notch/bottom bar padding
- StatusBar: `light-content` for dark theme, translucent
- iOS: `BlurView` (expo-blur) for glass morphism, Liquid Glass for iOS 26+
- Android: Extra paddingBottom:16 for nav bar
- Haptics: `Haptics.impactAsync(Light)` for presses, `selectionAsync()` for changes, `Heavy` for success

## 8. Performance
- FlatList: `windowSize={10}`, `initialNumToRender={12}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews={true}`
- Memoize `renderItem` with `useCallback`, `keyExtractor` with `useCallback`
- `getItemLayout` for fixed-height items (skip measurement)
- Image optimization: expo-image with `cachePolicy="memory-disk"` for hero, `"disk"` default
- Progressive loading: BlurHash placeholder + transition={300}
- `useMemo` for expensive computations, `useAnimatedReaction` for native-thread work
- Batch state updates: single `setState(prev => ({...prev, a:1, b:2}))`

## 9. Micro-Interactions
- Button press: scale to 0.95 with spring animation
- Pull-to-refresh: custom spin animation with `withRepeat(withTiming(360, {duration:800}))`
- Swipe actions: `Gesture.Pan()` with threshold-based snap to reveal delete/favorite buttons
- Toast/Snackbar: react-native-toast-message with bottom position, 3s duration

## 10. Accessibility
- `accessible={true}`, `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityHint`
- Semantic roles: header, list, listitem, button
- Reduced motion: check `useAccessibilityInfo()`, use `FadeIn.duration(100)` instead of springs
- Focus management: `AccessibilityInfo.setAccessibilityFocus()` for modals
- Contrast: WCAG AA minimum 4.5:1 for text, 3:1 for large text
- Dynamic Type: `allowFontScaling={true}`, cap with `maxFontSizeMultiplier={1.5}`

## Canopy Trove Specific Tokens
```javascript
const APP_TOKENS = {
  primary: '#2ECC71',
  secondary: '#E8A000',
  background: '#121614',
  spacing: [0, 4, 8, 12, 16, 24, 32, 48],
  minTouchSize: 48,
  animationDuration: { quick: 200, standard: 300, slow: 500 },
  headingFont: 'SpaceGrotesk',
  bodyFont: 'DM Sans',
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
};
```

## Performance Targets
- FlatList: 10-15 items per batch, 10-screen window
- Image load: <1s with progressive JPEG
- Animation: consistent 60fps (Reanimated, not Animated API)
- Touch response: <100ms with haptics
