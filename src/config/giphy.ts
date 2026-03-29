export const giphyApiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY?.trim() || null;
export const hasGiphyConfig = Boolean(giphyApiKey);
