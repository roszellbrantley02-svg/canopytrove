// iOS standalone (Add to Home Screen) navigation guard.
// Without this, tapping links or route changes can open Safari
// instead of staying inside the PWA shell.
(function () {
  var standalone = window.navigator.standalone;
  if (!standalone) return;

  document.addEventListener(
    'click',
    function (e) {
      var node = e.target;
      while (node && node !== document.body) {
        if (node.tagName === 'A') {
          var href = node.getAttribute('href');
          if (!href) break;

          // External links: let them open in Safari
          if (href.indexOf('http') === 0 && href.indexOf(window.location.origin) !== 0) break;
          // tel: and mailto: links: let the OS handle them
          if (/^(tel|mailto|sms):/.test(href)) break;

          // Internal link — prevent Safari from opening and navigate in-app
          e.preventDefault();
          window.location.href = href;
          return;
        }
        node = node.parentNode;
      }
    },
    true,
  );
})();
