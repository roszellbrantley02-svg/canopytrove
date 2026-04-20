export type ReactionGifCatalogEntry = {
  id: string;
  title: string;
  keywords: string[];
  previewUrl: string;
  mediaUrl: string;
};

function createGiphyMediaUrl(id: string) {
  return `https://media.giphy.com/media/${id}/giphy.gif`;
}

export const reactionGifCatalog: ReactionGifCatalogEntry[] = [
  {
    id: '111ebonMs90YLu',
    title: 'Thumbs up',
    keywords: ['thumbs up', 'approve', 'yes', 'good', 'solid'],
    previewUrl: createGiphyMediaUrl('111ebonMs90YLu'),
    mediaUrl: createGiphyMediaUrl('111ebonMs90YLu'),
  },
  {
    id: '9Ai5dIk8xvBm0',
    title: 'Nice',
    keywords: ['nice', 'great', 'clean', 'approved'],
    previewUrl: createGiphyMediaUrl('9Ai5dIk8xvBm0'),
    mediaUrl: createGiphyMediaUrl('9Ai5dIk8xvBm0'),
  },
  {
    id: 'qIXVd1RoKGqlO',
    title: 'Clapping',
    keywords: ['clap', 'applause', 'bravo', 'well done'],
    previewUrl: createGiphyMediaUrl('qIXVd1RoKGqlO'),
    mediaUrl: createGiphyMediaUrl('qIXVd1RoKGqlO'),
  },
  {
    id: 'Hc8PMCBjo9BXa',
    title: 'Cheering',
    keywords: ['cheer', 'hype', 'celebrate', 'crowd'],
    previewUrl: createGiphyMediaUrl('Hc8PMCBjo9BXa'),
    mediaUrl: createGiphyMediaUrl('Hc8PMCBjo9BXa'),
  },
  {
    id: 'bznNJlqAi4pBC',
    title: 'Happy dance',
    keywords: ['happy', 'dance', 'excited', 'vibes'],
    previewUrl: createGiphyMediaUrl('bznNJlqAi4pBC'),
    mediaUrl: createGiphyMediaUrl('bznNJlqAi4pBC'),
  },
  {
    id: 'Xw6yFn7frR3Y4',
    title: 'Celebration',
    keywords: ['celebrate', 'party', 'win', 'lets go'],
    previewUrl: createGiphyMediaUrl('Xw6yFn7frR3Y4'),
    mediaUrl: createGiphyMediaUrl('Xw6yFn7frR3Y4'),
  },
  {
    id: '13JipyoTNNvM2c',
    title: 'Fire',
    keywords: ['fire', 'lit', 'heat', 'top shelf'],
    previewUrl: createGiphyMediaUrl('13JipyoTNNvM2c'),
    mediaUrl: createGiphyMediaUrl('13JipyoTNNvM2c'),
  },
  {
    id: 'zfNAMCrhSQzte',
    title: 'Cheers',
    keywords: ['cheers', 'toast', 'celebrate', 'good times'],
    previewUrl: createGiphyMediaUrl('zfNAMCrhSQzte'),
    mediaUrl: createGiphyMediaUrl('zfNAMCrhSQzte'),
  },
  {
    id: 'lYjA4tfvCc8UAju1Op',
    title: 'Smooth',
    keywords: ['smooth', 'easy', 'clean', 'easy to find'],
    previewUrl: createGiphyMediaUrl('lYjA4tfvCc8UAju1Op'),
    mediaUrl: createGiphyMediaUrl('lYjA4tfvCc8UAju1Op'),
  },
  {
    id: 'UmnWEKDFoPmcZHmwFl',
    title: 'Wow',
    keywords: ['wow', 'impressed', 'surprised', 'selection'],
    previewUrl: createGiphyMediaUrl('UmnWEKDFoPmcZHmwFl'),
    mediaUrl: createGiphyMediaUrl('UmnWEKDFoPmcZHmwFl'),
  },
  {
    id: 'zDeQTAYJQgLf0nszLs',
    title: 'Love it',
    keywords: ['love', 'favorite', 'great vibes', 'green'],
    previewUrl: createGiphyMediaUrl('zDeQTAYJQgLf0nszLs'),
    mediaUrl: createGiphyMediaUrl('zDeQTAYJQgLf0nszLs'),
  },
  {
    id: 'td5eq6qlu1UL6',
    title: 'Yes',
    keywords: ['yes', 'absolutely', 'definitely', 'locked in'],
    previewUrl: createGiphyMediaUrl('td5eq6qlu1UL6'),
    mediaUrl: createGiphyMediaUrl('td5eq6qlu1UL6'),
  },
];
