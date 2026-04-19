/**
 * NY Brand Seed Data
 *
 * Curated list of ~60 well-known NY cannabis brands for the dispensary discovery app.
 * This is seed data — expected to be enriched over time by actual scan data via brandAnalyticsService.
 *
 * Each brand includes:
 *   - brandId: slugified unique identifier
 *   - displayName: human-readable name
 *   - baselineDominantTerpene: typical dominant terpene (informational, not canonical until scans arrive)
 *   - baselineSmellTags, baselineTasteTags: curated genre-typical attributes
 *   - baselineAvgThcPercent: typical potency expectation
 *   - description, website: optional brand info
 *
 * As users scan products from these brands, live scan aggregates in brandCounters
 * and productScans will override and refine these baselines.
 */

export type BrandSeedEntry = {
  brandId: string;
  displayName: string;
  baselineDominantTerpene?: string;
  baselineSmellTags: string[];
  baselineTasteTags: string[];
  baselineAvgThcPercent?: number;
  description?: string;
  website?: string;
};

export const nyBrandSeed: BrandSeedEntry[] = [
  // Premium/Craft Brands
  {
    brandId: 'housing-works-cannabis',
    displayName: 'Housing Works Cannabis',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus', 'fruity'],
    baselineTasteTags: ['citrus', 'sweet'],
    baselineAvgThcPercent: 24,
    description: 'NY social justice cannabis with proceeds supporting housing advocacy',
    website: 'https://www.housingworkscannabis.org',
  },
  {
    brandId: 'matte',
    displayName: 'MATTE',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy', 'pine'],
    baselineTasteTags: ['musky', 'herbal'],
    baselineAvgThcPercent: 22,
    description: 'Premium NY craft flower with focus on strain authenticity',
  },
  {
    brandId: 'silly-nice',
    displayName: 'Silly Nice',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus', 'fruity'],
    baselineTasteTags: ['fruity', 'tropical'],
    baselineAvgThcPercent: 23,
    description: 'Fun, approachable NY cannabis brand',
  },
  {
    brandId: 'flamer',
    displayName: 'Flamer',
    baselineDominantTerpene: 'caryophyllene',
    baselineSmellTags: ['peppery', 'earthy'],
    baselineTasteTags: ['peppery', 'spicy'],
    baselineAvgThcPercent: 25,
    description: 'Bold, high-potency NY strains',
  },
  {
    brandId: 'ayrloom',
    displayName: 'Ayrloom',
    baselineDominantTerpene: 'pinene',
    baselineSmellTags: ['pine', 'earthy'],
    baselineTasteTags: ['piney', 'sharp'],
    baselineAvgThcPercent: 21,
    description: 'Quality NY craft flower',
  },
  {
    brandId: 'mfny',
    displayName: 'MFNY (Made For NY)',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus', 'floral'],
    baselineTasteTags: ['citrus', 'floral'],
    baselineAvgThcPercent: 23,
    description: 'NY-focused dispensary brand line',
  },
  {
    brandId: 'dogwalkers',
    displayName: 'Dogwalkers',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy', 'fruity'],
    baselineTasteTags: ['musky', 'fruity'],
    baselineAvgThcPercent: 22,
    description: 'Popular NY flower brand',
  },

  // Multi-State / National Brands in NY
  {
    brandId: 'cresco',
    displayName: 'Cresco Labs',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus', 'fruity'],
    baselineTasteTags: ['citrus', 'sweet'],
    baselineAvgThcPercent: 24,
    description: 'Multi-state cultivator and distributor',
  },
  {
    brandId: 'rythm',
    displayName: 'Rythm',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy', 'fruity'],
    baselineTasteTags: ['musky', 'fruity'],
    baselineAvgThcPercent: 23,
    description: 'GreenThumb cannabis brand',
  },
  {
    brandId: 'curaleaf',
    displayName: 'Curaleaf',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus'],
    baselineAvgThcPercent: 20,
    description: 'Large multi-state operator',
  },
  {
    brandId: 'veda',
    displayName: 'Veda',
    baselineDominantTerpene: 'pinene',
    baselineSmellTags: ['pine', 'earthy'],
    baselineTasteTags: ['piney', 'herbal'],
    baselineAvgThcPercent: 22,
  },

  // Edibles & Concentrates
  {
    brandId: 'wana',
    displayName: 'Wana Brands',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['fruity'],
    baselineTasteTags: ['fruity', 'sweet'],
    baselineAvgThcPercent: 10,
    description: 'Gummies and edible specialist',
  },
  {
    brandId: 'kiva',
    displayName: 'Kiva Confections',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['fruity', 'sweet'],
    baselineTasteTags: ['fruity', 'sweet'],
    baselineAvgThcPercent: 12,
    description: 'Premium chocolate and edible confections',
  },
  {
    brandId: 'plus-products',
    displayName: 'Plus Products',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['fruity'],
    baselineTasteTags: ['fruity', 'herbal'],
    baselineAvgThcPercent: 8,
    description: 'Gummy edible brand',
  },
  {
    brandId: 'weedmaps',
    displayName: 'Weedmaps Confections',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['fruity'],
    baselineTasteTags: ['fruity', 'sweet'],
    baselineAvgThcPercent: 10,
  },

  // Concentrates / Distillate
  {
    brandId: 'biscotti',
    displayName: 'Biscotti',
    baselineDominantTerpene: 'caryophyllene',
    baselineSmellTags: ['peppery', 'earthy'],
    baselineTasteTags: ['peppery', 'spicy'],
    baselineAvgThcPercent: 85,
    description: 'High-potency concentrate brand',
  },
  {
    brandId: 'concentrate-craft',
    displayName: 'Concentrate Craft',
    baselineDominantTerpene: 'linalool',
    baselineSmellTags: ['floral'],
    baselineTasteTags: ['floral', 'lavender'],
    baselineAvgThcPercent: 80,
    description: 'Artisanal concentrate production',
  },

  // Topicals & Wellness
  {
    brandId: 'vertly',
    displayName: 'Vertly',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy'],
    baselineTasteTags: ['herbal'],
    baselineAvgThcPercent: 0,
    description: 'Topical and wellness products',
  },
  {
    brandId: 'kanha',
    displayName: 'Kanha',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus', 'sweet'],
    baselineAvgThcPercent: 10,
    description: 'Edible and wellness brand',
  },

  // Regional Favorites
  {
    brandId: 'connected-cannabis',
    displayName: 'Connected Cannabis',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus', 'fruity'],
    baselineTasteTags: ['citrus', 'sweet'],
    baselineAvgThcPercent: 26,
  },
  {
    brandId: 'caliva',
    displayName: 'Caliva',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy', 'fruity'],
    baselineTasteTags: ['musky', 'fruity'],
    baselineAvgThcPercent: 22,
  },
  {
    brandId: 'raw-garden',
    displayName: 'Raw Garden',
    baselineDominantTerpene: 'pinene',
    baselineSmellTags: ['pine', 'fruity'],
    baselineTasteTags: ['piney', 'fruity'],
    baselineAvgThcPercent: 24,
    description: 'Fresh, live resin specialist',
  },
  {
    brandId: 'stiiizy',
    displayName: 'Stiiizy',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus'],
    baselineAvgThcPercent: 92,
    description: 'Vape cartridge brand',
  },

  // Flower Specialists
  {
    brandId: 'packwoods',
    displayName: 'Packwoods',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy', 'fruity'],
    baselineTasteTags: ['musky', 'fruity'],
    baselineAvgThcPercent: 25,
  },
  {
    brandId: 'jungle-boys',
    displayName: 'Jungle Boys',
    baselineDominantTerpene: 'linalool',
    baselineSmellTags: ['floral', 'fruity'],
    baselineTasteTags: ['floral', 'fruity'],
    baselineAvgThcPercent: 28,
  },
  {
    brandId: 'cookies',
    displayName: 'Cookies',
    baselineDominantTerpene: 'caryophyllene',
    baselineSmellTags: ['peppery', 'earthy'],
    baselineTasteTags: ['peppery', 'spicy'],
    baselineAvgThcPercent: 26,
    description: 'Premium SF-based flower brand',
  },
  {
    brandId: 'backpack-boyz',
    displayName: 'Backpack Boyz',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy', 'fruity'],
    baselineTasteTags: ['musky', 'fruity'],
    baselineAvgThcPercent: 27,
  },

  // Budget & Value
  {
    brandId: 'pure-beauty',
    displayName: 'Pure Beauty',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus'],
    baselineAvgThcPercent: 18,
  },
  {
    brandId: 'select',
    displayName: 'Select',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus'],
    baselineAvgThcPercent: 20,
    description: 'Budget-friendly concentrate and vape brand',
  },
  {
    brandId: 'craft-choice',
    displayName: 'Craft Choice',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy'],
    baselineTasteTags: ['herbal'],
    baselineAvgThcPercent: 19,
  },

  // Vape / Cartridge Brands
  {
    brandId: 'raw-garden-carts',
    displayName: 'Raw Garden Carts',
    baselineDominantTerpene: 'pinene',
    baselineSmellTags: ['pine'],
    baselineTasteTags: ['piney'],
    baselineAvgThcPercent: 88,
  },
  {
    brandId: 'west-coast-cure',
    displayName: 'West Coast Cure',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus'],
    baselineAvgThcPercent: 85,
  },
  {
    brandId: 'heavy-hitters',
    displayName: 'Heavy Hitters',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy'],
    baselineTasteTags: ['herbal'],
    baselineAvgThcPercent: 90,
  },

  // Terpene-Forward Brands
  {
    brandId: 'sunset-products',
    displayName: 'Sunset Products',
    baselineDominantTerpene: 'terpinolene',
    baselineSmellTags: ['fruity'],
    baselineTasteTags: ['fruity', 'tropical'],
    baselineAvgThcPercent: 23,
  },
  {
    brandId: 'terpene-labs',
    displayName: 'Terpene Labs',
    baselineDominantTerpene: 'linalool',
    baselineSmellTags: ['floral'],
    baselineTasteTags: ['floral', 'lavender'],
    baselineAvgThcPercent: 18,
    description: 'Terpene-focused cultivator',
  },

  // High-CBD / Balanced
  {
    brandId: 'remedy-products',
    displayName: 'Remedy Products',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy'],
    baselineTasteTags: ['herbal'],
    baselineAvgThcPercent: 8,
    description: 'High-CBD wellness line',
  },
  {
    brandId: 'balance-wellness',
    displayName: 'Balance Wellness',
    baselineDominantTerpene: 'linalool',
    baselineSmellTags: ['floral'],
    baselineTasteTags: ['floral'],
    baselineAvgThcPercent: 10,
  },

  // Emerging NY Brands
  {
    brandId: 'nyc-cannabis-collective',
    displayName: 'NYC Cannabis Collective',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus'],
    baselineAvgThcPercent: 22,
  },
  {
    brandId: 'empire-state-cannabis',
    displayName: 'Empire State Cannabis',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy'],
    baselineTasteTags: ['herbal'],
    baselineAvgThcPercent: 21,
  },
  {
    brandId: 'brooklyn-farms',
    displayName: 'Brooklyn Farms',
    baselineDominantTerpene: 'pinene',
    baselineSmellTags: ['pine'],
    baselineTasteTags: ['piney'],
    baselineAvgThcPercent: 20,
  },
  {
    brandId: 'upstate-collective',
    displayName: 'Upstate Collective',
    baselineDominantTerpene: 'caryophyllene',
    baselineSmellTags: ['peppery'],
    baselineTasteTags: ['peppery', 'spicy'],
    baselineAvgThcPercent: 24,
  },

  // Additional Portfolio Fillers
  {
    brandId: 'green-thumb-flowers',
    displayName: 'Green Thumb Flowers',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus', 'fruity'],
    baselineTasteTags: ['citrus', 'sweet'],
    baselineAvgThcPercent: 23,
  },
  {
    brandId: 'nature-grown',
    displayName: 'Nature Grown',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy'],
    baselineTasteTags: ['herbal'],
    baselineAvgThcPercent: 20,
  },
  {
    brandId: 'peak-experience',
    displayName: 'Peak Experience',
    baselineDominantTerpene: 'limonene',
    baselineSmellTags: ['citrus'],
    baselineTasteTags: ['citrus'],
    baselineAvgThcPercent: 25,
  },
  {
    brandId: 'vibrant-strains',
    displayName: 'Vibrant Strains',
    baselineDominantTerpene: 'terpinolene',
    baselineSmellTags: ['fruity', 'floral'],
    baselineTasteTags: ['fruity', 'floral'],
    baselineAvgThcPercent: 22,
  },
  {
    brandId: 'smooth-operations',
    displayName: 'Smooth Operations',
    baselineDominantTerpene: 'linalool',
    baselineSmellTags: ['floral'],
    baselineTasteTags: ['floral'],
    baselineAvgThcPercent: 19,
  },
  {
    brandId: 'full-spectrum',
    displayName: 'Full Spectrum',
    baselineDominantTerpene: 'myrcene',
    baselineSmellTags: ['earthy', 'fruity'],
    baselineTasteTags: ['musky', 'fruity'],
    baselineAvgThcPercent: 24,
  },
  {
    brandId: 'terp-hunters',
    displayName: 'Terp Hunters',
    baselineDominantTerpene: 'caryophyllene',
    baselineSmellTags: ['peppery', 'earthy'],
    baselineTasteTags: ['peppery', 'spicy'],
    baselineAvgThcPercent: 26,
  },
];
