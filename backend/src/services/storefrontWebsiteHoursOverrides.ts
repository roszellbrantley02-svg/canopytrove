type OfficialWebsiteHoursOverride = {
  sourceUrl: string;
  hours: string[];
};

const OFFICIAL_WEBSITE_HOURS_OVERRIDES = new Map<string, OfficialWebsiteHoursOverride>([
  [
    'ocm-11361-bayside-aroma-farms',
    {
      sourceUrl: 'https://aromafarmsinc.com',
      hours: [
        'Monday: 10:00 AM - 11:45 PM',
        'Tuesday: 10:00 AM - 11:45 PM',
        'Wednesday: 10:00 AM - 11:45 PM',
        'Thursday: 10:00 AM - 11:45 PM',
        'Friday: 10:00 AM - 11:45 PM',
        'Saturday: 10:00 AM - 11:45 PM',
        'Sunday: 10:00 AM - 11:45 PM',
      ],
    },
  ],
  [
    'ocm-11361-bayside-ny-elite-cannabis',
    {
      sourceUrl: 'https://nyelitecannabis.com',
      hours: [
        'Monday: 10:00 AM - 10:00 PM',
        'Tuesday: 10:00 AM - 10:00 PM',
        'Wednesday: 10:00 AM - 10:00 PM',
        'Thursday: 10:00 AM - 10:00 PM',
        'Friday: 10:00 AM - 10:00 PM',
        'Saturday: 10:00 AM - 10:00 PM',
        'Sunday: 10:00 AM - 10:00 PM',
      ],
    },
  ],
  [
    'ocm-10011-new-york-gotham-chelsea',
    {
      sourceUrl: 'https://gotham.nyc/locations/chelsea/',
      hours: [
        'Monday: 11:00 AM - 9:00 PM',
        'Tuesday: 11:00 AM - 9:00 PM',
        'Wednesday: 11:00 AM - 9:00 PM',
        'Thursday: 11:00 AM - 9:00 PM',
        'Friday: 11:00 AM - 9:00 PM',
        'Saturday: 11:00 AM - 9:00 PM',
        'Sunday: 11:00 AM - 9:00 PM',
      ],
    },
  ],
  [
    'ocm-10017-new-york-terrapin-greens-llc-dba-the-travel-agency-fifth-avenue',
    {
      sourceUrl: 'https://www.thetravelagency.co/dispensaries/',
      hours: [
        'Monday: 9:00 AM - 11:00 PM',
        'Tuesday: 9:00 AM - 11:00 PM',
        'Wednesday: 9:00 AM - 11:00 PM',
        'Thursday: 9:00 AM - 11:00 PM',
        'Friday: 9:00 AM - 12:00 AM',
        'Saturday: 9:00 AM - 12:00 AM',
        'Sunday: 9:00 AM - 11:00 PM',
      ],
    },
  ],
  [
    'ocm-10018-new-york-indoor-treez',
    {
      sourceUrl: 'https://www.indoortreez.com',
      hours: [
        'Monday: 8:00 AM - 2:00 AM',
        'Tuesday: 8:00 AM - 2:00 AM',
        'Wednesday: 8:00 AM - 2:00 AM',
        'Thursday: 8:00 AM - 2:00 AM',
        'Friday: 8:00 AM - 2:00 AM',
        'Saturday: 8:00 AM - 2:00 AM',
        'Sunday: 8:00 AM - 2:00 AM',
      ],
    },
  ],
  [
    'ocm-11217-brooklyn-the-travel-agency-downtown-brooklyn',
    {
      sourceUrl: 'https://www.thetravelagency.co/dispensaries/downtown-brooklyn-new-york/',
      hours: [
        'Monday: 9:00 AM - 11:00 PM',
        'Tuesday: 9:00 AM - 11:00 PM',
        'Wednesday: 9:00 AM - 11:00 PM',
        'Thursday: 9:00 AM - 11:00 PM',
        'Friday: 9:00 AM - 12:00 AM',
        'Saturday: 9:00 AM - 12:00 AM',
        'Sunday: 9:00 AM - 11:00 PM',
      ],
    },
  ],
  [
    'ocm-11233-brooklyn-easy-times',
    {
      sourceUrl: 'https://easytimesny.com',
      hours: [
        'Monday: 8:00 AM - 11:00 PM',
        'Tuesday: 8:00 AM - 11:00 PM',
        'Wednesday: 8:00 AM - 11:00 PM',
        'Thursday: 8:00 AM - 11:00 PM',
        'Friday: 8:00 AM - 12:00 AM',
        'Saturday: 9:00 AM - 12:00 AM',
        'Sunday: 9:00 AM - 11:00 PM',
      ],
    },
  ],
  [
    'ocm-10927-haverstraw-the-flowery-haverstraw',
    {
      sourceUrl: 'https://www.thefloweryny.com/locations/haverstraw-dispensary',
      hours: [
        'Monday: 10:00 AM - 9:00 PM',
        'Tuesday: 10:00 AM - 9:00 PM',
        'Wednesday: 10:00 AM - 9:00 PM',
        'Thursday: 10:00 AM - 10:00 PM',
        'Friday: 10:00 AM - 10:00 PM',
        'Saturday: 10:00 AM - 10:00 PM',
        'Sunday: 11:00 AM - 7:00 PM',
      ],
    },
  ],
  [
    'ocm-10941-middletown-canna-planet-middletown',
    {
      sourceUrl: 'https://cannaplanet.com/locations/',
      hours: [
        'Monday: 9:30 AM - 8:30 PM',
        'Tuesday: 9:30 AM - 8:30 PM',
        'Wednesday: 9:30 AM - 8:30 PM',
        'Thursday: 9:30 AM - 8:30 PM',
        'Friday: 9:30 AM - 9:00 PM',
        'Saturday: 9:30 AM - 9:00 PM',
        'Sunday: 10:00 AM - 7:00 PM',
      ],
    },
  ],
  [
    'ocm-12401-kingston-canna-planet-kingston',
    {
      sourceUrl: 'https://cannaplanet.com/location/kingston/',
      hours: [
        'Monday: 10:00 AM - 8:00 PM',
        'Tuesday: 10:00 AM - 8:00 PM',
        'Wednesday: 10:00 AM - 8:00 PM',
        'Thursday: 10:00 AM - 8:00 PM',
        'Friday: 10:00 AM - 9:00 PM',
        'Saturday: 10:00 AM - 9:00 PM',
        'Sunday: 10:00 AM - 6:00 PM',
      ],
    },
  ],
  [
    'ocm-12590-wappingers-falls-canna-planet-wappingers',
    {
      sourceUrl: 'https://cannaplanet.com/location/wappingers/',
      hours: [
        'Monday: 10:00 AM - 8:00 PM',
        'Tuesday: 10:00 AM - 8:00 PM',
        'Wednesday: 10:00 AM - 8:00 PM',
        'Thursday: 10:00 AM - 8:00 PM',
        'Friday: 10:00 AM - 9:00 PM',
        'Saturday: 10:00 AM - 9:00 PM',
        'Sunday: 10:00 AM - 6:00 PM',
      ],
    },
  ],
  [
    'ocm-11414-howard-beach-indoor-treez-howard-beach',
    {
      sourceUrl: 'https://www.indoortreez.com',
      hours: [
        'Monday: 8:00 AM - 12:00 AM',
        'Tuesday: 8:00 AM - 12:00 AM',
        'Wednesday: 8:00 AM - 12:00 AM',
        'Thursday: 8:00 AM - 12:00 AM',
        'Friday: 8:00 AM - 12:00 AM',
        'Saturday: 8:00 AM - 12:00 AM',
        'Sunday: 8:00 AM - 12:00 AM',
      ],
    },
  ],
  [
    'ocm-11735-farmingdale-happy-days-dispensary-inc',
    {
      sourceUrl: 'https://happydaysli.com/cannabis-dispensary-delivery-amityville-ny/',
      hours: [
        'Monday: 9:00 AM - 9:00 PM',
        'Tuesday: 9:00 AM - 9:00 PM',
        'Wednesday: 9:00 AM - 9:00 PM',
        'Thursday: 9:00 AM - 9:00 PM',
        'Friday: 9:00 AM - 9:00 PM',
        'Saturday: 9:00 AM - 9:00 PM',
        'Sunday: 10:00 AM - 6:00 PM',
      ],
    },
  ],
  [
    'ocm-12550-newburgh-green-leaf-cannabis-and-wellness',
    {
      sourceUrl: 'https://greenleafny.co/contact-us/',
      hours: [
        'Monday: 10:00 AM - 8:00 PM',
        'Tuesday: 10:00 AM - 8:00 PM',
        'Wednesday: 10:00 AM - 8:00 PM',
        'Thursday: 10:00 AM - 9:00 PM',
        'Friday: 10:00 AM - 9:00 PM',
        'Saturday: 10:00 AM - 9:00 PM',
        'Sunday: 10:00 AM - 6:00 PM',
      ],
    },
  ],
  [
    'ocm-13754-deposit-canna-vibes-ny',
    {
      sourceUrl:
        'https://www.cannavibesny.com/welcome-to-canna-vibes-ny-celebrating-cannabis-diversity/contact-canna-vibes-ny-get-in-touch/',
      hours: [
        'Monday: 10:00 AM - 7:00 PM',
        'Tuesday: 10:00 AM - 7:00 PM',
        'Wednesday: 10:00 AM - 7:00 PM',
        'Thursday: 10:00 AM - 7:00 PM',
        'Friday: 10:00 AM - 8:00 PM',
        'Saturday: 10:00 AM - 8:00 PM',
        'Sunday: 11:00 AM - 5:00 PM',
      ],
    },
  ],
  [
    'ocm-14055-east-concord-waterman-s-greenhouse-dba-greenside-cannabis',
    {
      sourceUrl: 'https://greensidecannabis.com/contact/',
      hours: [
        'Monday: 9:00 AM - 9:00 PM',
        'Tuesday: 9:00 AM - 9:00 PM',
        'Wednesday: 9:00 AM - 9:00 PM',
        'Thursday: 9:00 AM - 10:00 PM',
        'Friday: 9:00 AM - 10:00 PM',
        'Saturday: 9:00 AM - 10:00 PM',
        'Sunday: 10:00 AM - 7:00 PM',
      ],
    },
  ],
  [
    'ocm-14203-buffalo-dank-716-llc',
    {
      sourceUrl: 'https://www.716dank.com/contact',
      hours: [
        'Monday: 10:00 AM - 9:00 PM',
        'Tuesday: 10:00 AM - 9:00 PM',
        'Wednesday: 10:00 AM - 9:00 PM',
        'Thursday: 10:00 AM - 9:00 PM',
        'Friday: 10:00 AM - 9:00 PM',
        'Saturday: 10:00 AM - 9:00 PM',
        'Sunday: Closed',
      ],
    },
  ],
  [
    'ocm-14424-canandaigua-sunwalker-farms',
    {
      sourceUrl: 'https://sunwalkerfarms.com/',
      hours: [
        'Monday: 9:00 AM - 9:00 PM',
        'Tuesday: 9:00 AM - 9:00 PM',
        'Wednesday: 9:00 AM - 9:00 PM',
        'Thursday: 9:00 AM - 9:00 PM',
        'Friday: 9:00 AM - 10:00 PM',
        'Saturday: 9:00 AM - 10:00 PM',
        'Sunday: 9:00 AM - 9:00 PM',
      ],
    },
  ],
  [
    'ocm-10459-bronx-the-thc-shop-bronx',
    {
      sourceUrl: 'https://ourthcshop.com/bronx/',
      hours: [
        'Monday: 11:00 AM - 9:00 PM',
        'Tuesday: 11:00 AM - 9:00 PM',
        'Wednesday: 11:00 AM - 9:00 PM',
        'Thursday: 11:00 AM - 9:00 PM',
        'Friday: 11:00 AM - 10:00 PM',
        'Saturday: 11:00 AM - 10:00 PM',
        'Sunday: 11:00 AM - 9:00 PM',
      ],
    },
  ],
  [
    'ocm-10470-bronx-two-buds-dispensary',
    {
      sourceUrl: 'https://twobudsdispensary.nyc',
      hours: [
        'Monday: 10:00 AM - 10:00 PM',
        'Tuesday: 10:00 AM - 10:00 PM',
        'Wednesday: 10:00 AM - 10:00 PM',
        'Thursday: 10:00 AM - 10:00 PM',
        'Friday: 10:00 AM - 10:00 PM',
        'Saturday: 10:00 AM - 10:00 PM',
        'Sunday: 11:00 AM - 8:00 PM',
      ],
    },
  ],
]);

export function getOfficialWebsiteHoursOverride(storefrontId: string) {
  return OFFICIAL_WEBSITE_HOURS_OVERRIDES.get(storefrontId) ?? null;
}
