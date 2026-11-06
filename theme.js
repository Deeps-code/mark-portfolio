// Runs in <head> so the saved theme is applied before the page appears (no flash).
// "dark" = original black-and-white look. No value = color mode (default).
(function () {
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();