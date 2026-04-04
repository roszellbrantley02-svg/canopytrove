import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './rootNavigatorConfig';

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['canopytrove://', 'https://canopytrove.com', 'https://www.canopytrove.com'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Nearby: 'nearby',
          Browse: 'browse',
          HotDeals: 'hot-deals',
          Profile: 'profile',
        },
      },
      StorefrontDetail: 'storefronts/:storefrontId',
      Leaderboard: 'leaderboard',
      LegalCenter: 'legal',
      DeleteAccount: 'account-deletion',
    },
  },
};
