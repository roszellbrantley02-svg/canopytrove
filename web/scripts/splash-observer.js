// Hide splash once React mounts
(function () {
  var root = document.getElementById('root');
  if (!root) return;

  var observer = new MutationObserver(function () {
    if (root.children.length > 0) {
      var splash = document.getElementById('ct-splash');
      if (splash) {
        splash.classList.add('hidden');
        setTimeout(function () {
          splash.remove();
        }, 500);
      }
      observer.disconnect();
    }
  });
  observer.observe(root, { childList: true });
})();
