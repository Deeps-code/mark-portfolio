// Runs in <head> so the saved theme is applied before the page appears (no flash).
// "dark" = black-and-white look. No value = color mode (default).
(function () {
  // Tells the CSS that JavaScript is running, so scroll animations can start hidden
  document.documentElement.classList.add('js');
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();