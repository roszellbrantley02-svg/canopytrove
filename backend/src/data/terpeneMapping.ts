/**
 * Terpene → Smell → Taste Mapping
 *
 * Canonical mapping used by both frontend and backend.
 * Ensures consistent categorization of terpenes across the app.
 */

export type TerpeneEntry = {
  terpene: string;
  smell: string;
  tastes: string[];
};

export const TERPENE_MAPPING: Record<string, TerpeneEntry> = {
  myrcene: {
    terpene: 'myrcene',
    smell: 'earthy',
    tastes: ['musky', 'herbal'],
  },
  limonene: {
    terpene: 'limonene',
    smell: 'citrus',
    tastes: ['citrus', 'sweet'],
  },
  pinene: {
    terpene: 'pinene',
    smell: 'pine',
    tastes: ['piney', 'sharp'],
  },
  linalool: {
    terpene: 'linalool',
    smell: 'floral',
    tastes: ['floral', 'lavender'],
  },
  caryophyllene: {
    terpene: 'caryophyllene',
    smell: 'peppery',
    tastes: ['peppery', 'spicy'],
  },
  humulene: {
    terpene: 'humulene',
    smell: 'earthy',
    tastes: ['hoppy', 'woody'],
  },
  terpinolene: {
    terpene: 'terpinolene',
    smell: 'fruity',
    tastes: ['fruity', 'tropical'],
  },
  ocimene: {
    terpene: 'ocimene',
    smell: 'fruity',
    tastes: ['sweet', 'herbal'],
  },
  bisabolol: {
    terpene: 'bisabolol',
    smell: 'floral',
    tastes: ['floral', 'chamomile'],
  },
};

export function getTerpeneSmell(terpene: string): string | null {
  return TERPENE_MAPPING[terpene.toLowerCase()]?.smell ?? null;
}

export function getTerpeneTastes(terpene: string): string[] {
  return TERPENE_MAPPING[terpene.toLowerCase()]?.tastes ?? [];
}

export function getSmellTags(): string[] {
  return Array.from(new Set(Object.values(TERPENE_MAPPING).map((entry) => entry.smell)));
}

export function getTasteTagsForSmell(smell: string): string[] {
  return Array.from(
    new Set(
      Object.values(TERPENE_MAPPING)
        .filter((entry) => entry.smell === smell.toLowerCase())
        .flatMap((entry) => entry.tastes),
    ),
  );
}
