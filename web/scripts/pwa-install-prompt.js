/**
 * Canopy Trove — PWA Install Prompt
 *
 * Captures the browser's beforeinstallprompt event and shows a custom
 * install banner after the user has been on the site for 30 seconds.
 * Dismissal is remembered for 14 days via a cookie (no localStorage).
 *
 * iOS Safari doesn't fire beforeinstallprompt, so we show a manual
 * "Add to Home Screen" instruction for standalone-capable iOS browsers.
 */
(function () {
  'use strict';

  var DISMISS_COOKIE = 'ct_pwa_dismiss';
  var DISMISS_DAYS = 14;
  var SHOW_DELAY_MS = 30000;
  var deferredPrompt = null;

  // Don't show if already installed as PWA
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone === true) return;

  // Don't show if user dismissed recently
  if (getCookie(DISMISS_COOKIE)) return;

  // Capture the browser's install prompt before it auto-fires
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  // Show the banner after a delay
  setTimeout(function () {
    var isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (deferredPrompt) {
      showBanner('install');
    } else if (isIos && isSafari) {
      showBanner('ios');
    }
  }, SHOW_DELAY_MS);

  function showBanner(mode) {
    var banner = document.createElement('div');
    banner.id = 'ct-pwa-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install Canopy Trove');

    var message =
      mode === 'ios'
        ? 'Install Canopy Trove: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>'
        : 'Get the full experience — install Canopy Trove on your device';

    banner.innerHTML =
      '<div class="ct-pwa-inner">' +
      '  <div class="ct-pwa-icon">' +
      '    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">' +
      '      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#2ECC71"/>' +
      '    </svg>' +
      '  </div>' +
      '  <p class="ct-pwa-text">' +
      message +
      '</p>' +
      '  <div class="ct-pwa-actions">' +
      (mode !== 'ios'
        ? '    <button class="ct-pwa-install" id="ct-pwa-install-btn">Install</button>'
        : '') +
      '    <button class="ct-pwa-dismiss" id="ct-pwa-dismiss-btn">Not now</button>' +
      '  </div>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent =
      '#ct-pwa-banner{position:fixed;bottom:0;left:0;right:0;z-index:10000;padding:12px;pointer-events:none;animation:ct-pwa-slide-up .35s ease-out}' +
      '.ct-pwa-inner{pointer-events:auto;max-width:420px;margin:0 auto;background:#1a1f1c;border:1px solid rgba(46,204,113,.25);border-radius:16px;padding:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;box-shadow:0 -4px 24px rgba(0,0,0,.4)}' +
      '.ct-pwa-icon{width:40px;height:40px;border-radius:10px;background:rgba(0,245,140,.08);border:1px solid rgba(143,255,209,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.ct-pwa-text{flex:1;min-width:180px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.4;color:#C4B8B0;margin:0}' +
      '.ct-pwa-text strong{color:#FFFBF7}' +
      '.ct-pwa-actions{display:flex;gap:8px;width:100%;justify-content:flex-end}' +
      '.ct-pwa-install{padding:10px 20px;background:#2ECC71;color:#121614;font-size:14px;font-weight:600;border:none;border-radius:8px;cursor:pointer;min-height:44px}' +
      '.ct-pwa-install:hover{opacity:.85}' +
      '.ct-pwa-dismiss{padding:10px 16px;background:transparent;color:#C4B8B0;font-size:13px;font-weight:500;border:1px solid rgba(196,184,176,.2);border-radius:8px;cursor:pointer;min-height:44px}' +
      '.ct-pwa-dismiss:hover{border-color:rgba(196,184,176,.4)}' +
      '@keyframes ct-pwa-slide-up{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}';

    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Install button handler
    var installBtn = document.getElementById('ct-pwa-install-btn');
    if (installBtn && deferredPrompt) {
      installBtn.addEventListener('click', function () {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          deferredPrompt = null;
          removeBanner(banner);
          if (choice.outcome === 'dismissed') {
            setCookie(DISMISS_COOKIE, '1', DISMISS_DAYS);
          }
        });
      });
    }

    // Dismiss button handler
    var dismissBtn = document.getElementById('ct-pwa-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        setCookie(DISMISS_COOKIE, '1', DISMISS_DAYS);
        removeBanner(banner);
      });
    }
  }

  function removeBanner(banner) {
    banner.style.transition = 'opacity 0.25s ease-out';
    banner.style.opacity = '0';
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 300);
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
})();
