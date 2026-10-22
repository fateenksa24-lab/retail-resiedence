// Public tracking and search-console IDs. Leave a value empty to switch that service off.
export const tracking = {
  /** Google Analytics 4 measurement ID, e.g. "G-XXXXXXXXXX". */
  ga4: '',
  /** Snap Pixel, carried over from the old site so Snapchat ad reporting continues. */
  snapPixel: '6b964c08-429a-4407-ba8d-4844f5bdec67',
  /** Content of each search engine's HTML-tag verification code. */
  verification: {
    google: '',
    bing: '',
    yandex: '',
  },
  /** IndexNow key (Bing, Yandex, Seznam, Naver). Served at /<key>.txt; `npm run indexnow` pings them. */
  indexNowKey: '8f3c1e9a4b7d42f6a0e5c9d1b2f47a63',
};
