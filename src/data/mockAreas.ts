import type { MarketArea } from '../types/storefront';

export const mockAreas: MarketArea[] = [
  {
    id: 'central-ny',
    label: 'Central NY',
    subtitle: 'Wolcott and nearby',
    center: { latitude: 43.2207, longitude: -76.8158 },
  },
  {
    id: 'finger-lakes',
    label: 'Finger Lakes',
    subtitle: 'Seneca Falls and nearby',
    center: { latitude: 42.9101, longitude: -76.7966 },
  },
  {
    id: 'rochester',
    label: 'Rochester',
    subtitle: 'Rochester metro',
    center: { latitude: 43.1566, longitude: -77.6088 },
  },
  {
    id: 'western-ny',
    label: 'Western NY',
    subtitle: 'Buffalo and nearby',
    center: { latitude: 42.8864, longitude: -78.8784 },
  },
  {
    id: 'capital-region',
    label: 'Capital Region',
    subtitle: 'Albany and nearby',
    center: { latitude: 42.6526, longitude: -73.7562 },
  },
  {
    id: 'hudson-valley',
    label: 'Hudson Valley',
    subtitle: 'Mid-Hudson corridor',
    center: { latitude: 41.7004, longitude: -73.921 },
  },
  {
    id: 'nyc',
    label: 'NYC',
    subtitle: 'New York City',
    center: { latitude: 40.7128, longitude: -74.006 },
  },
  {
    id: 'long-island',
    label: 'Long Island',
    subtitle: 'Nassau and Suffolk',
    center: { latitude: 40.7891, longitude: -73.135 },
  },
  {
    id: 'southern-tier',
    label: 'Southern Tier',
    subtitle: 'Binghamton and nearby',
    center: { latitude: 42.0987, longitude: -75.9179 },
  },
  {
    id: 'north-country',
    label: 'North Country',
    subtitle: 'Watertown and nearby',
    center: { latitude: 43.9748, longitude: -75.9108 },
  },
];
