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
          Profile: 'profile',
        },
      },
      StorefrontDetail: 'storefronts/:storefrontId',
      HotDeals: 'hot-deals',
      Leaderboard: 'leaderboard',
      LegalCenter: 'legal',
      DeleteAccount: 'account-deletion',
    },
  },
};
