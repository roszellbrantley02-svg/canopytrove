# Accessibility and Design Reference

## WCAG 2.2 — What Actually Matters

WCAG 2.2 is the current accessibility standard. It goes far beyond color contrast.

### Contrast

- Normal text: 4.5:1 minimum contrast ratio
- Large text (18pt+ or 14pt+ bold): 3:1 minimum
- UI components and graphical objects: 3:1 minimum
- Canopy Trove tokens: `#FFFBF7` on `#121614` = excellent contrast

### Touch Target Size

- W3C guidance: 24×24 CSS px minimum with spacing allowances
- Canopy Trove standard: 48dp minimum — exceeds the requirement
- Ensure spacing between adjacent targets prevents accidental taps
- HapticPressable components should include `hitSlop` for smaller visual targets

### Keyboard Accessibility

- Every interactive element must be reachable via Tab key
- Focus order must follow visual reading order
- Visible focus indicators on all focusable elements
- No keyboard traps (user can always Tab away)
- Custom components need explicit `tabIndex`, `role`, and keyboard handlers
- Modals must trap focus while open and restore it on close

### Semantic HTML

Use the right element before reaching for ARIA:

| Want this | Use this | Not this |
|-----------|----------|----------|
| Button | `<button>` | `<div onClick>` |
| Link | `<a href>` | `<span onClick>` |
| Heading | `<h1>`–`<h6>` | `<div class="title">` |
| List | `<ul>/<ol>` | Nested `<div>`s |
| Form field | `<input>` + `<label>` | `<div>` with text |
| Navigation | `<nav>` | `<div class="nav">` |

In React Native Web, `accessibilityRole` maps to semantic HTML roles automatically.

### ARIA — For Gaps Only

- Prefer native HTML semantics over ARIA roles
- ARIA doesn't add behavior — only labels and relationships
- If you build custom dialogs, menus, or popups, you need:
  - Correct `role` attribute
  - Focus management (auto-focus on open, return focus on close)
  - Keyboard behavior (Escape to close, arrow keys for menus)
- Test with a screen reader, not just by reading the code

### Motion and Animation

- Honor `prefers-reduced-motion` media query
- Non-essential animation should be skippable
- Canopy Trove already skips MotionInView animations on web
- On native, `useNativeDriver: true` keeps animations off the JS thread
- Avoid animation that flashes, strobes, or causes vestibular discomfort

### Accessible Authentication (WCAG 2.2 new)

- Don't require cognitive puzzles (CAPTCHAs) as the only auth method
- Don't require users to memorize or transcribe codes
- Support password managers (don't block paste in password fields)
- Provide alternatives for any memory-dependent step

### Redundant Entry (WCAG 2.2 new)

- Don't make users re-enter information they already provided in the same session
- Auto-fill from previous steps where possible
- If you must ask again, pre-populate the field

## Design Principles

### Visual Hierarchy

- Establish hierarchy with spacing and typography before adding decorative effects
- SpaceGrotesk for headings, DM Sans for body (Canopy Trove design tokens)
- Use the spacing scale consistently: 4, 8, 12, 16, 24, 32, 48

### Navigation

- Labels should be literal and descriptive ("Nearby Dispensaries" not "Explore")
- Large tap targets with adequate spacing
- Click-activated submenus, not hover-only
- Consistent navigation location across all screens
- Fewer deep cascading menus — flat is usually better

### Forms

- Number of fields matters more than number of steps
- Inline validation when done correctly reduces friction
- Preserve user input after validation errors
- Required vs optional fields should be visually clear
- Don't break browser gesture chains with async operations before file inputs

### Images

- Use responsive images with explicit dimensions
- Don't lazy-load hero/LCP images
- Provide alt text that describes purpose, not decoration
- Decorative images get `alt=""` (empty alt, not missing alt)
- expo-image with caching for performance on native

## Common Failures (WebAIM Million)

The WebAIM Million report consistently finds these top failures on the live web:

1. Low contrast text
2. Missing alternative text for images
3. Missing form input labels
4. Empty links (links with no text)
5. Missing document language
6. Empty buttons

Check your app against all six. Canopy Trove's dark theme with `#FFFBF7` primary text on
`#121614` background has strong contrast, but check secondary text (`#C4B8B0`) and accent
colors against background variants.

## Testing Approach

1. Keyboard-only navigation test (Tab through every screen)
2. Screen reader test (VoiceOver on iOS/Mac, TalkBack on Android)
3. Zoom to 200% — does layout hold?
4. `prefers-reduced-motion` — do animations stop?
5. Color contrast checker on all text/background combinations
6. Real device testing, not just simulators
