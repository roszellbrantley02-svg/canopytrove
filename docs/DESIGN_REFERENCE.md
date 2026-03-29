# Design Reference

## Source

Primary reference file:

- `C:\Users\eleve\Documents\New project\canopy-trove-3\Weed Finder App Design.make`

Extracted preview used for review:

- `C:\Users\eleve\Documents\New project\canopy-trove-3\_design_extract_2\thumbnail.png`
- `C:\Users\eleve\Documents\New project\canopy-trove-3\_design_extract_2\images\4768505ec53a494385d08f0c96296aebf2afc180`

## What the design is doing well

The file establishes a clear direction:

1. Dark, high-contrast background
2. Neon green as the primary brand color
3. Cyan and purple used as restrained accent colors
4. Thin glowing borders instead of heavy fills
5. Map-first hero surface
6. Wide cinematic cards
7. Strong CTA bars
8. Floating bottom navigation dock

## Visual rules to carry forward

### Color

- Background should stay near-black green, not flat gray
- Primary should stay neon emerald / route green
- Cyan can be used for map or route accents
- Purple can be used sparingly for secondary emphasis
- Avoid adding more accent colors than that

### Surfaces

- Cards should be dark and low-noise
- Borders should be thin and softly glowing
- Surface separation should come from contrast and outline, not heavy shadow stacks

### Shape language

- Rounded corners should be generous
- Chips and filters should be pill-shaped
- CTA bars should be long, simple, and high contrast

### Layout

- Map surface should feel important near the top
- List cards should read quickly:
  - title
  - distance
  - status
  - action
- Content density should stay controlled

## Product-specific adaptation for Canopy Trove

We should use the style system from this design, but not blindly copy all of its product decisions.

Keep:

- dark neon route aesthetic
- map-first list surfaces
- strong location and route emphasis
- floating dock navigation
- chip-based filtering

Adjust:

- keep the product focused on legal dispensary discovery
- avoid generic "smoke shop" emphasis unless the product scope changes
- list cards should remain map-first, not photo-first
- detail screens can hold photos, reviews, hours, and richer content

## Implementation rule

For the moment, this file is the visual source of truth for:

- color direction
- card treatment
- chip treatment
- top-of-screen hierarchy
- bottom navigation style

It is not the source of truth for:

- data architecture
- licensing logic
- storefront matching rules

## Practical standard

If a new screen or component is added to Canopy Trove, it should be checked against this design reference before being considered done.
