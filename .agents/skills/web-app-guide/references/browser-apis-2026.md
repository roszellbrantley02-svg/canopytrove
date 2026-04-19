# Modern Browser APIs and Interop 2026

Research compiled April 2026 from Chrome DevRel, MDN, WebKit, Mozilla, and web.dev.

## Interop 2026

Interop 2026 is a cross-browser initiative between Apple, Google, Igalia, Microsoft, and Mozilla
to align browser implementations on 20 focus areas (33 proposals) and 4 investigation areas.
Progress is tracked on a public dashboard.

Key focus areas relevant to web apps:

### View Transitions API

View Transitions let the browser handle hardware-accelerated transitions between DOM states or
full page navigations with minimal code. Cross-document view transitions (page-to-page without
JavaScript) shipped in Safari 18.2 and are an Interop 2026 focus.

For React Native Web / Expo Router: View Transitions require CSS `view-transition-name` and
`document.startViewTransition()`. Since Expo Router manages navigation in JS, integration requires
explicit opt-in. Consider for polish on route changes once browser support is universal.

### Popover API

The Popover API is now Baseline — stable in every major browser. It provides native popover/dialog
behavior with less custom JavaScript. Combined with CSS Anchor Positioning, it enables tooltips,
menus, and overlays that stay visually attached to trigger elements.

For Canopy Trove: Potential use for filter dropdowns, tooltip explanations, and context menus on web.
Low priority since React Native's Modal works cross-platform.

### Speculation Rules API

Speculation Rules let browsers preload or prerender likely next pages in the background. Combined
with View Transitions, this makes navigation feel instant.

```html
<script type="speculationrules">
{
  "prerender": [
    { "where": { "href_matches": "/storefront/*" } }
  ]
}
</script>
```

For Canopy Trove: Could prerender storefront detail pages when a user is browsing the list. Requires
multi-page architecture (not applicable to SPA unless using Expo Router web with static rendering).

### CSS contrast-color()

A CSS function that automatically selects a color with guaranteed contrast against a specified
background. Interop 2026 focus area. When available, this simplifies accessible text-on-dynamic-
background scenarios.

### Scroll-Driven Animations

CSS-only animations triggered by scroll position, without JavaScript. Interop 2026 priority.
For Canopy Trove: Could replace JS-based parallax effects on storefront detail pages with pure CSS.

## Safari-Specific Updates (2025-2026)

- **LCP and INP metrics**: Coming to Safari in 2026, expanding field measurement across all browsers.
- **Declarative Web Push**: Safari 18.4 added simplified push mechanism.
- **iOS 26**: Every site added to Home Screen now defaults to opening as a web app.
- **command/commandfor**: Safari 26.2 adds declarative button-to-popover/dialog relationships.

## Web Vitals Field Measurement

The web-vitals library (~2KB) is the standard way to measure Core Web Vitals in production:

```typescript
import { onLCP, onINP, onCLS } from 'web-vitals';

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

With LCP and INP coming to Safari in 2026, field measurement will finally cover all major browsers.

### Reporting API and NEL

- **Reporting API** (`Report-To` header): Surfaces browser-detected issues — CSP violations,
  deprecation warnings, and intervention reports — without client-side JavaScript.
- **NEL (Network Error Logging)** (`NEL` header): Captures network failures from the client's
  perspective that server logs never see (DNS failures, TLS errors, timeouts).

```
Report-To: {"group":"default","max_age":31536000,"endpoints":[{"url":"https://api.canopytrove.com/reports"}]}
NEL: {"report_to":"default","max_age":31536000}
```

## Canopy Trove Gaps

| Feature | Status | Priority |
|---------|--------|----------|
| web-vitals library | Missing | Medium |
| Reporting API / NEL | Missing | Low |
| View Transitions | Not applicable (SPA) | Low |
| Speculation Rules | Not applicable (SPA) | Low |
| Popover API | Not needed (RN Modal) | Low |
| Scroll-Driven Animations | Not implemented | Low |

Sources: Chrome DevRel Blog, WebKit Blog (Interop 2026), MDN Web Docs, web.dev
