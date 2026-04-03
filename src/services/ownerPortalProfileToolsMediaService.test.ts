import { describe, expect, it } from 'vitest';
import { mergeUploadedStorefrontMediaIntoProfileTools } from './ownerPortalProfileToolsMediaService';

describe('ownerPortalProfileToolsMediaService', () => {
  it('promotes an uploaded card photo into both the card slot and gallery list when a display url is available', () => {
    expect(
      mergeUploadedStorefrontMediaIntoProfileTools(
        {
          cardPhotoUrl: 'https://cdn.example.com/old-card.jpg',
          featuredPhotoUrls: ['https://cdn.example.com/old-gallery.jpg'],
          cardPhotoPath:
            'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/old-card.jpg',
          featuredPhotoPaths: [
            'dispensary-media/disp-1/approved/owner/owner-1/storefront-gallery/old-gallery.jpg',
          ],
        },
        {
          mediaType: 'storefront-card',
          filePath: 'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/new-card.jpg',
          downloadUrl: 'https://cdn.example.com/new-card.jpg',
        },
      ),
    ).toEqual({
      cardPhotoUrl: 'https://cdn.example.com/new-card.jpg',
      cardPhotoPath: 'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/new-card.jpg',
      featuredPhotoUrls: [
        'https://cdn.example.com/new-card.jpg',
        'https://cdn.example.com/old-card.jpg',
        'https://cdn.example.com/old-gallery.jpg',
      ],
      featuredPhotoPaths: [
        'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/new-card.jpg',
        'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/old-card.jpg',
        'dispensary-media/disp-1/approved/owner/owner-1/storefront-gallery/old-gallery.jpg',
      ],
    });
  });

  it('appends an uploaded gallery photo path without disturbing the current visible card photo', () => {
    expect(
      mergeUploadedStorefrontMediaIntoProfileTools(
        {
          cardPhotoUrl: 'https://cdn.example.com/card.jpg',
          featuredPhotoUrls: ['https://cdn.example.com/gallery-a.jpg'],
          cardPhotoPath: 'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/card.jpg',
          featuredPhotoPaths: [
            'dispensary-media/disp-1/approved/owner/owner-1/storefront-gallery/gallery-a.jpg',
          ],
        },
        {
          mediaType: 'storefront-gallery',
          filePath:
            'dispensary-media/disp-1/approved/owner/owner-1/storefront-gallery/gallery-b.jpg',
          downloadUrl: null,
        },
      ),
    ).toEqual({
      cardPhotoUrl: 'https://cdn.example.com/card.jpg',
      cardPhotoPath: 'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/card.jpg',
      featuredPhotoUrls: ['https://cdn.example.com/gallery-a.jpg'],
      featuredPhotoPaths: [
        'dispensary-media/disp-1/approved/owner/owner-1/storefront-gallery/gallery-a.jpg',
        'dispensary-media/disp-1/approved/owner/owner-1/storefront-gallery/gallery-b.jpg',
      ],
    });
  });

  it('keeps a staged card photo even when no public download url is available yet', () => {
    expect(
      mergeUploadedStorefrontMediaIntoProfileTools(
        {
          cardPhotoUrl: null,
          featuredPhotoUrls: [],
          cardPhotoPath: null,
          featuredPhotoPaths: [],
        },
        {
          mediaType: 'storefront-card',
          filePath:
            'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/staged-card.jpg',
          downloadUrl: null,
        },
      ),
    ).toEqual({
      cardPhotoUrl: null,
      featuredPhotoUrls: [],
      cardPhotoPath:
        'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/staged-card.jpg',
      featuredPhotoPaths: [
        'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/staged-card.jpg',
      ],
    });
  });
});
