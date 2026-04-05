// Scroll-reveal via IntersectionObserver
(function () {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  targets.forEach(function (el) {
    observer.observe(el);
  });
})();

// Mobile nav toggle
(function () {
  var btn = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
})();
