// Web Vitals reporter — field measurement of LCP, INP, CLS
// Uses native PerformanceObserver API (no external dependencies).
// Previously imported web-vitals from unpkg.com which was a supply-chain risk.
(function () {
  'use strict';

  // __CT_API_BASE_URL__ is replaced at build time by post-export.js
  var endpoint = '__CT_API_BASE_URL__/v1/web-vitals';
  var reported = {};

  function send(name, value, rating) {
    if (reported[name]) return;
    reported[name] = true;

    var body = JSON.stringify({
      name: name,
      value: Math.round(value * 1000) / 1000,
      rating: rating,
      navigationType:
        performance.getEntriesByType && performance.getEntriesByType('navigation').length
          ? performance.getEntriesByType('navigation')[0].type
          : 'unknown',
    });

    // Use fetch with keepalive instead of sendBeacon to avoid CORS credential issues.
    // mode:'no-cors' makes this an opaque request — no preflight, no CORS headers needed.
    // The tradeoff: we can't read the response, but beacons are fire-and-forget anyway.
    if (typeof fetch === 'function') {
      fetch(endpoint, {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
        mode: 'no-cors',
      }).catch(function () {});
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
    }
  }

  function rate(name, value) {
    // Thresholds per web.dev Core Web Vitals
    if (name === 'LCP')
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    if (name === 'INP') return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
    if (name === 'CLS') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    return 'unknown';
  }

  if (typeof PerformanceObserver === 'undefined') return;

  // LCP — Largest Contentful Paint
  try {
    new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      if (entries.length) {
        var last = entries[entries.length - 1];
        send('LCP', last.startTime, rate('LCP', last.startTime));
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // LCP observer not supported
  }

  // CLS — Cumulative Layout Shift
  try {
    var clsValue = 0;
    new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].hadRecentInput) {
          clsValue += entries[i].value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });

    // Report CLS on page visibility change (standard approach)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        send('CLS', clsValue, rate('CLS', clsValue));
      }
    });
  } catch {
    // CLS observer not supported
  }

  // INP — Interaction to Next Paint
  try {
    var inpValue = 0;
    new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].duration > inpValue) {
          inpValue = entries[i].duration;
        }
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        send('INP', inpValue, rate('INP', inpValue));
      }
    });
  } catch {
    // INP observer not supported
  }
})();
