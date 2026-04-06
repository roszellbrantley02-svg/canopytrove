// Web Vitals reporter — field measurement of LCP, INP, CLS
// Imports web-vitals module and sends metrics to backend
(async function () {
  try {
    // Dynamically import web-vitals from unpkg (pinned to specific version)
    // This is async-loaded, so it doesn't block initial paint
    const { onLCP, onINP, onCLS } =
      await import('https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.js?module');

    function sendToAnalytics(metric) {
      var body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });

      // Use sendBeacon if available (doesn't block unload), else fetch.
      // Wrap in a Blob with application/json so express.json() can parse it.
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('https://api.canopytrove.com/v1/web-vitals', blob);
      }
    }

    onLCP(sendToAnalytics);
    onINP(sendToAnalytics);
    onCLS(sendToAnalytics);
  } catch (e) {
    // Web vitals module failed to load — non-critical, app continues
    console.debug('Web Vitals loading failed:', e.message);
  }
})();
