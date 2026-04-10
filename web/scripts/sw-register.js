// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    var hasReloadedForServiceWorker = false;

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hasReloadedForServiceWorker) {
        return;
      }

      hasReloadedForServiceWorker = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/service-worker.js')
      .then(function (registration) {
        function activateWaitingWorker(worker) {
          if (!worker) {
            return;
          }

          worker.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.update().catch(function () {
          // Update checks are best effort only.
        });

        activateWaitingWorker(registration.waiting);

        registration.addEventListener('updatefound', function () {
          var nextWorker = registration.installing;
          if (!nextWorker) {
            return;
          }

          nextWorker.addEventListener('statechange', function () {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaitingWorker(nextWorker);
            }
          });
        });
      })
      .catch(function () {
        // SW registration failed — app works fine without it
      });
  });
}
